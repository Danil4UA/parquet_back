import { Request, Response, NextFunction } from "express";
import multer from "multer";
import RoomVisualization from "../model/RoomVisualization";
import { renderCustomerPhoto, renderRoom, getObjectStream, prepareRoomImage } from "../services/visualizer";
import { assertCanRender, RenderLimitError } from "../services/visualizer/limits";
import { recordRejectedUpload } from "../services/visualizer";

const MAX_UPLOAD_MB = 25;

// The photo lives in memory only for the duration of the request; nothing is written to disk.
export const roomUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_MB * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (/^image\/(jpeg|png|webp|heic|heif)$/.test(file.mimetype)) cb(null, true);
    else cb(new Error("Unsupported image type"));
  },
}).single("photo");

/**
 * Multer as middleware with a JSON error instead of the default HTML page. Non-multipart requests pass through.
 * A rejected upload (too large, wrong type) is recorded as a failed generation so it shows up in the admin dashboard.
 */
export const roomUploadMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  roomUpload(req, res, (err: unknown) => {
    if (err) {
      const message = err instanceof Error ? err.message : "Upload failed";
      const productId = typeof req.body?.productId === "string" ? req.body.productId : undefined;
      console.warn("[visualizer] upload rejected:", message, { ip: req.ip, productId, contentLength: req.headers["content-length"] });
      void recordRejectedUpload(message, req.ip, productId);
      res.status(400).json({ success: false, message });
      return;
    }
    next();
  });
};

const publicRoom = (doc: { roomKey?: string; roomUrl?: string; title?: string }) => ({ roomKey: doc.roomKey, roomUrl: doc.roomUrl, title: doc.title });

// Only sample rooms and their results are stored, so only those keys can be downloaded.
const SAMPLE_ROOM_KEY_RE = /^rooms\/samples\/[0-9a-f-]{36}\.jpg$/;
const SAMPLE_RESULT_KEY_RE = /^rooms\/samples\/[0-9a-f-]{36}(\/[0-9a-f]{24}(-[a-z0-9]+)?)?\.jpg$/;

const sendError = (res: Response, err: unknown, fallback: string) => {
  const e = err as { status?: number; message?: string };
  const status = e?.status || 500;
  if (status >= 500) console.error("[visualizer]", fallback, err);
  if (err instanceof RenderLimitError) {
    if (err.retryAfterSec) res.setHeader("Retry-After", String(err.retryAfterSec));
    res.status(429).json({ success: false, code: err.code, message: err.message, retryAfterSec: err.retryAfterSec });
    return;
  }
  res.status(status).json({ success: false, message: status >= 500 ? fallback : e.message });
};

export const visualizerController = {
  /** GET /api/visualizer/download?key=rooms/samples/...jpg&name=file.jpg — streams S3 with an attachment header. */
  download: async (req: Request, res: Response): Promise<void> => {
    const key = String(req.query.key || "");
    if (!SAMPLE_RESULT_KEY_RE.test(key)) {
      res.status(400).json({ success: false, message: "Bad key" });
      return;
    }
    const name = String(req.query.name || "floor.jpg").replace(/[^\w.-]+/g, "_").slice(0, 80) || "floor.jpg";
    try {
      const file = await getObjectStream(key);
      res.setHeader("Content-Type", file.contentType);
      if (file.contentLength) res.setHeader("Content-Length", String(file.contentLength));
      res.setHeader("Content-Disposition", `attachment; filename="${name}"`);
      res.setHeader("Cache-Control", "private, max-age=3600");
      file.body.pipe(res);
    } catch (err) {
      console.error("[visualizer] download failed", err);
      res.status(404).json({ success: false, message: "File not found" });
    }
  },

  /**
   * POST /api/visualizer/prepare (multipart: photo) → image/jpeg
   * Converts a photo the browser cannot decode itself (HEIC from an iPhone opened on a desktop)
   * into a resized, upright JPEG. No AI call, nothing stored, nothing counted against limits.
   */
  prepare: async (req: Request, res: Response): Promise<void> => {
    const photo = req.file?.buffer;
    if (!photo) {
      res.status(400).json({ success: false, message: "No photo" });
      return;
    }
    try {
      const jpeg = await prepareRoomImage(photo);
      res.setHeader("Cache-Control", "no-store");
      res.type("image/jpeg").send(jpeg);
    } catch (err) {
      const detail = String((err as Error)?.message || err);
      console.warn("[visualizer] cannot decode photo for preview:", detail, { ip: req.ip, bytes: photo.length });
      void recordRejectedUpload(`Cannot decode photo (${photo.length} bytes): ${detail}`, req.ip, typeof req.body?.productId === "string" ? req.body.productId : undefined);
      res.status(400).json({ success: false, message: "Unsupported or corrupt image" });
    }
  },

  /** GET /api/visualizer/samples */
  samples: async (_req: Request, res: Response): Promise<void> => {
    const docs = await RoomVisualization.find({ isSample: true, status: "room", isActive: { $ne: false } }).sort({ createdAt: 1 }).limit(12);
    res.json({ success: true, rooms: docs.map(publicRoom) });
  },

  /**
   * POST /api/visualizer/render
   *   multipart: photo (customer's room photo) + productId   → result returned inline, nothing stored
   *   json/multipart: roomKey (sample room) + productId       → result cached in S3
   */
  render: async (req: Request, res: Response): Promise<void> => {
    const productId = typeof req.body?.productId === "string" ? req.body.productId : "";
    const roomKey = typeof req.body?.roomKey === "string" ? req.body.roomKey : "";
    const photo = req.file?.buffer;

    if (!/^[0-9a-f]{24}$/.test(productId)) {
      res.status(400).json({ success: false, message: "productId is required" });
      return;
    }
    if (!photo && !SAMPLE_ROOM_KEY_RE.test(roomKey)) {
      res.status(400).json({ success: false, message: "Send a photo or a sample roomKey" });
      return;
    }

    try {
      if (photo) {
        // Per-IP and global limits, persisted in the database (see services/visualizer/limits.ts).
        await assertCanRender(req.ip);
        const out = await renderCustomerPhoto(photo, productId, { ip: req.ip });
        res.setHeader("Cache-Control", "no-store");
        res.json({
          success: true,
          result: {
            image: `data:${out.mime};base64,${out.image.toString("base64")}`,
            productId,
            durationMs: out.durationMs,
            cached: out.cached,
            stored: false,
          },
        });
        return;
      }

      const cached = await RoomVisualization.findOne({ roomKey, productId, status: "done" });
      if (!cached) await assertCanRender(req.ip); // a cached sample result is free, no limit applies
      const doc = cached || (await renderRoom(roomKey, productId, { ip: req.ip, source: "customer" }));
      res.json({
        success: true,
        result: { resultUrl: doc.resultUrl, resultKey: doc.resultKey, roomUrl: doc.roomUrl, productId, durationMs: doc.durationMs, cached: !!cached, stored: true },
      });
    } catch (err) {
      sendError(res, err, "Render failed");
    }
  },
};
