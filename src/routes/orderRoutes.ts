import express from "express";
import orderControllers from "../controllers/orderControllers";

const router = express.Router();
router.post("/", orderControllers.completeOrder);
router.post("/create", orderControllers.createOrder);

export default router;
