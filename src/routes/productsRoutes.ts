import express from "express";
import productsControllers from "../controllers/productsControllers";

const router = express.Router();
router.get("/", productsControllers.getProductByCategory);
router.get("/all", productsControllers.getAllProducts);
router.get("/filters", productsControllers.getFilterOptions);
router.get("/:id", productsControllers.getProductById);


export default router;
