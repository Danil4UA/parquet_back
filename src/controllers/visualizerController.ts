import { Request, Response, NextFunction } from "express";
import multer from "multer";
import RoomVisualization from "../model/RoomVisualization";
import { createRoom, renderRoom, getObjectStream } from "../services/visualizer";

const MAX_UPLOAD_MB = 15;

export const roomUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_MB * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (/^image\/(jpeg|png|webp|heic|heif)$/.test(file.mimetype)) cb(null, true);
    else cb(new Error("Unsupported image type"));
  },
}).single("photo");

/** Multer as middleware with a JSON error instead of the default HTML page. */
export const roomUploadMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  roomUpload(req, res, (err: unknown) => {
    if (err) {
      res.status(400).json({ success: false, message: err instanceof Error ? err.message : "Upload failed" });
      return;
    }
    next();
  });
};

// Simple global daily budget so a spike can't run up the bill (single-instance safe).
let dailyCount = 0;
let dailyStamp = new Date().toDateString();
const dailyLimit = () => Number(process.env.VISUALIZER_DAILY_LIMIT || 300);
const takeDailySlot = () => {
  const today = new Date().toDateString();
  if (today !== dailyStamp) { dailyStamp = today; dailyCount = 0; }
  if (dailyCount >= dailyLimit()) return false;
  dailyCount += 1;
  return true;
};

const publicRoom = (doc: { roomKey: string; roomUrl: string; title?: string }) => ({ roomKey: doc.roomKey, roomUrl: doc.roomUrl, title: doc.title });

const RESULT_KEY_RE = /^rooms\/(samples\/)?[0-9a-f-]{36}(\/[0-9a-f]{24}(-[a-z0-9]+)?)?\.jpg$/;

export const visualizerController = {
  /** GET /api/visualizer/download?key=rooms/...jpg&name=file.jpg — streams S3 with an attachment header. */
  download: async (req: Request, res: Response): Promise<void> => {
    const key = String(req.query.key || "");
    if (!RESULT_KEY_RE.test(key)) {
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

  /** POST /api/visualizer/rooms  (multipart field: photo) */
  uploadRoom: async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.file) {
        res.status(400).json({ success: false, message: "No photo" });
        return;
      }
      const doc = await createRoom(req.file.buffer, { ip: req.ip, source: "customer" });
      res.status(201).json({ success: true, room: publicRoom(doc) });
    } catch (err) {
      console.error("[visualizer] upload failed", err);
      res.status(500).json({ success: false, message: "Upload failed" });
    }
  },

  /** GET /api/visualizer/samples */
  samples: async (_req: Request, res: Response): Promise<void> => {
    const docs = await RoomVisualization.find({ isSample: true, status: "room", isActive: { $ne: false } }).sort({ createdAt: 1 }).limit(12);
    res.json({ success: true, rooms: docs.map(publicRoom) });
  },

  /** POST /api/visualizer/render  { roomKey, productId } */
  render: async (req: Request, res: Response): Promise<void> => {
    const { roomKey, productId } = req.body || {};
    if (typeof roomKey !== "string" || typeof productId !== "string") {
      res.status(400).json({ success: false, message: "roomKey and productId are required" });
      return;
    }
    if (!/^rooms\/(samples\/)?[0-9a-f-]{36}\.jpg$/.test(roomKey)) {
      res.status(400).json({ success: false, message: "Bad roomKey" });
      return;
    }
    try {
      const cached = await RoomVisualization.findOne({ roomKey, productId, status: "done" });
      if (!cached && !takeDailySlot()) {
        res.status(429).json({ success: false, message: "Daily limit reached, try again tomorrow" });
        return;
      }
      const doc = cached || (await renderRoom(roomKey, productId, { ip: req.ip, source: "customer" }));
      res.json({
        success: true,
        result: { resultUrl: doc.resultUrl, resultKey: doc.resultKey, roomUrl: doc.roomUrl, productId, durationMs: doc.durationMs, cached: !!cached },
      });
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      const status = e?.status || 500;
      if (status >= 500) console.error("[visualizer] render failed", err);
      res.status(status).json({ success: false, message: status >= 500 ? "Render failed" : e.message });
    }
  },
};
