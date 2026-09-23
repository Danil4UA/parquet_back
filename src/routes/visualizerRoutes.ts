import express from "express";
import rateLimit from "express-rate-limit";
import { roomUploadMiddleware, visualizerController } from "../controllers/visualizerController";
import { limitsDisabled } from "../services/visualizer/limits";

const router = express.Router();

// Cheap flood guard on raw requests (in memory). The real per-IP and daily limits on paid
// generations are persisted in the database, see services/visualizer/limits.ts.
const renderLimiter = rateLimit({ windowMs: 10 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false, skip: () => limitsDisabled() });

router.get("/samples", visualizerController.samples);
router.get("/download", visualizerController.download);
router.post("/render", renderLimiter, roomUploadMiddleware, visualizerController.render);
// Cheap CPU work, no AI: a looser flood guard is enough.
const prepareLimiter = rateLimit({ windowMs: 10 * 60 * 1000, max: 40, standardHeaders: true, legacyHeaders: false, skip: () => limitsDisabled() });
router.post("/prepare", prepareLimiter, roomUploadMiddleware, visualizerController.prepare);

export default router;
