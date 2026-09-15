import { Request, Response, NextFunction } from "express";
import multer from "multer";
import Product from "../model/Product";
import RoomVisualization from "../model/RoomVisualization";
import { createRoom, renderRoom, regenerateRender, deleteRender, deleteRoom, generateSampleImage, DEFAULT_SAMPLE_PROMPT } from "../services/visualizer";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024, files: 1 } }).single("photo");
export const sampleUploadMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  upload(req, res, (err: unknown) => {
    if (err) {
      res.status(400).json({ success: false, message: err instanceof Error ? err.message : "Upload failed" });
      return;
    }
    next();
  });
};

const fail = (res: Response, err: unknown, fallback: string) => {
  const e = err as { status?: number; message?: string };
  const status = e?.status || 500;
  if (status >= 500) console.error("[admin/visualizer]", err);
  res.status(status).json({ success: false, message: status >= 500 ? fallback : e.message });
};

const pageParams = (req: Request) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 24));
  return { page, limit, skip: (page - 1) * limit };
};

/** Attaches a small product summary (name/model/image) to render records. */
const withProducts = async (docs: { productId?: string }[]) => {
  const ids = Array.from(new Set(docs.map((d) => d.productId).filter(Boolean))) as string[];
  const products = ids.length ? await Product.find({ _id: { $in: ids } }).select("name model images category") : [];
  const map = new Map(products.map((p) => [String(p._id), { _id: String(p._id), name: p.name?.en || "", model: p.model, image: p.images?.[0], category: p.category }]));
  return docs.map((d) => ({ ...(d as unknown as Record<string, unknown>), product: d.productId ? map.get(d.productId) || null : null }));
};

const adminVisualizerController = {
  stats: async (_req: Request, res: Response): Promise<void> => {
    try {
      const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
      const [samples, customerRooms, done, failed, today, avg] = await Promise.all([
        RoomVisualization.countDocuments({ status: "room", isSample: true }),
        RoomVisualization.countDocuments({ status: "room", isSample: false }),
        RoomVisualization.countDocuments({ status: "done" }),
        RoomVisualization.countDocuments({ status: "failed" }),
        RoomVisualization.countDocuments({ status: { $in: ["done", "failed"] }, createdAt: { $gte: startOfDay } }),
        RoomVisualization.aggregate([{ $match: { status: "done", durationMs: { $gt: 0 } } }, { $group: { _id: null, ms: { $avg: "$durationMs" } } }]),
      ]);
      res.json({ success: true, stats: { samples, customerRooms, done, failed, today, avgDurationMs: Math.round(avg[0]?.ms || 0), dailyLimit: Number(process.env.VISUALIZER_DAILY_LIMIT || 300) } });
    } catch (err) { fail(res, err, "Cannot load stats"); }
  },

  /** GET /rooms?type=sample|customer&page&limit */
  rooms: async (req: Request, res: Response): Promise<void> => {
    try {
      const { page, limit, skip } = pageParams(req);
      const isSample = req.query.type !== "customer";
      const filter = { status: "room", isSample };
      const [rooms, total] = await Promise.all([
        RoomVisualization.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
        RoomVisualization.countDocuments(filter),
      ]);
      const keys = rooms.map((r) => r.roomKey);
      const counts = await RoomVisualization.aggregate([
        { $match: { roomKey: { $in: keys }, status: { $ne: "room" } } },
        { $group: { _id: "$roomKey", renders: { $sum: 1 }, done: { $sum: { $cond: [{ $eq: ["$status", "done"] }, 1, 0] } } } },
      ]);
      const countMap = new Map(counts.map((c) => [c._id, c]));
      res.json({
        success: true,
        rooms: rooms.map((r) => ({ ...r, renders: countMap.get(r.roomKey)?.renders || 0, done: countMap.get(r.roomKey)?.done || 0 })),
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      });
    } catch (err) { fail(res, err, "Cannot load rooms"); }
  },

  /** GET /renders?roomKey&status&page&limit */
  renders: async (req: Request, res: Response): Promise<void> => {
    try {
      const { page, limit, skip } = pageParams(req);
      const filter: Record<string, unknown> = { status: { $ne: "room" } };
      if (typeof req.query.roomKey === "string" && req.query.roomKey) filter.roomKey = req.query.roomKey;
      if (typeof req.query.status === "string" && ["done", "failed", "pending"].includes(req.query.status)) filter.status = req.query.status;
      const [docs, total] = await Promise.all([
        RoomVisualization.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
        RoomVisualization.countDocuments(filter),
      ]);
      res.json({ success: true, renders: await withProducts(docs), pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
    } catch (err) { fail(res, err, "Cannot load renders"); }
  },

  /** POST /samples (multipart photo, title) */
  uploadSample: async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.file) { res.status(400).json({ success: false, message: "No photo" }); return; }
      const doc = await createRoom(req.file.buffer, { isSample: true, title: String(req.body?.title || "").slice(0, 80) || undefined, source: "admin" });
      res.status(201).json({ success: true, room: doc });
    } catch (err) { fail(res, err, "Upload failed"); }
  },

  /** POST /samples/generate { prompt?, title? } */
  generateSample: async (req: Request, res: Response): Promise<void> => {
    try {
      const prompt = String(req.body?.prompt || DEFAULT_SAMPLE_PROMPT).slice(0, 2000);
      const image = await generateSampleImage(prompt);
      const doc = await createRoom(image, { isSample: true, title: String(req.body?.title || "").slice(0, 80) || undefined, source: "admin" });
      res.status(201).json({ success: true, room: doc, prompt });
    } catch (err) { fail(res, err, "Generation failed"); }
  },

  /** PATCH /rooms/:id { isActive?, title? } */
  updateRoom: async (req: Request, res: Response): Promise<void> => {
    try {
      const patch: Record<string, unknown> = {};
      if (typeof req.body?.isActive === "boolean") patch.isActive = req.body.isActive;
      if (typeof req.body?.title === "string") patch.title = req.body.title.slice(0, 80);
      const doc = await RoomVisualization.findOneAndUpdate({ _id: req.params.id, status: "room" }, patch, { new: true });
      if (!doc) { res.status(404).json({ success: false, message: "Room not found" }); return; }
      res.json({ success: true, room: doc });
    } catch (err) { fail(res, err, "Update failed"); }
  },

  deleteRoom: async (req: Request, res: Response): Promise<void> => {
    try { await deleteRoom(req.params.id); res.json({ success: true }); } catch (err) { fail(res, err, "Delete failed"); }
  },

  /** POST /render { roomKey, productId, force? } — admin render, no public limits. */
  render: async (req: Request, res: Response): Promise<void> => {
    try {
      const { roomKey, productId, force } = req.body || {};
      if (typeof roomKey !== "string" || typeof productId !== "string") { res.status(400).json({ success: false, message: "roomKey and productId are required" }); return; }
      const doc = await renderRoom(roomKey, productId, { source: "admin", force: !!force });
      res.json({ success: true, render: (await withProducts([doc.toObject()]))[0] });
    } catch (err) { fail(res, err, "Render failed"); }
  },

  regenerate: async (req: Request, res: Response): Promise<void> => {
    try {
      const doc = await regenerateRender(req.params.id);
      res.json({ success: true, render: (await withProducts([doc.toObject()]))[0] });
    } catch (err) { fail(res, err, "Regeneration failed"); }
  },

  deleteRender: async (req: Request, res: Response): Promise<void> => {
    try { await deleteRender(req.params.id); res.json({ success: true }); } catch (err) { fail(res, err, "Delete failed"); }
  },
};

export default adminVisualizerController;
