import express from "express";
import rateLimit from "express-rate-limit";
import { roomUploadMiddleware, visualizerController } from "../controllers/visualizerController";

const router = express.Router();

// Cheap flood guard on raw requests (in memory). The real per-IP and daily limits on paid
// generations are persisted in the database, see services/visualizer/limits.ts.
const renderLimiter = rateLimit({ windowMs: 10 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false });

router.get("/samples", visualizerController.samples);
router.get("/download", visualizerController.download);
router.post("/render", renderLimiter, roomUploadMiddleware, visualizerController.render);

export default router;
