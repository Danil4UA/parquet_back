import express from 'express';
import reviewsController from "../controllers/reviewsController";
const router = express.Router();

router.get("/", reviewsController.getAllReviews);

export default router;
