import express from "express";
import productsControllers from "../controllers/productsControllers";

const router = express.Router();
router.get("/all", productsControllers.getAllProducts);
router.get("/:id", productsControllers.getProductById);
router.get("/", productsControllers.getProductByCategory);

export default router;
