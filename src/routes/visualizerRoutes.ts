import express from "express";
import rateLimit from "express-rate-limit";
import { roomUploadMiddleware, visualizerController } from "../controllers/visualizerController";

const router = express.Router();

const uploadLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 12, standardHeaders: true, legacyHeaders: false });
const renderLimiter = rateLimit({ windowMs: 24 * 60 * 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false });

router.get("/samples", visualizerController.samples);
router.get("/download", visualizerController.download);
router.post("/rooms", uploadLimiter, roomUploadMiddleware, visualizerController.uploadRoom);
router.post("/render", renderLimiter, visualizerController.render);

export default router;
