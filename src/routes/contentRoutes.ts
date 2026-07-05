import express from "express";
import contentController from "../controllers/contentController";
import { authenticateToken } from "../middleware/authMiddleware";

const router = express.Router();

router.get("/", contentController.getContent);
router.put("/:key", authenticateToken, contentController.updateContent);

export default router;
