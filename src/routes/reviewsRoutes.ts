import express from 'express';
import reviewsController from "../controllers/reviewsController";
import { authenticateToken } from "../middleware/authMiddleware";
const router = express.Router();

router.get("/", reviewsController.getAllReviews);
router.post("/refresh", authenticateToken, reviewsController.refreshReviews);

export default router;
