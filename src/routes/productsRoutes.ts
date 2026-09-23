import express from "express";
import productsControllers from "../controllers/productsControllers";

const router = express.Router();
router.get("/", productsControllers.getProductByCategory);
router.get("/all", productsControllers.getAllProducts);
router.get("/filters", productsControllers.getFilterOptions);
router.get("/categories-summary", productsControllers.getCategoriesSummary);
router.get("/batch", productsControllers.getProductsByIds);
router.get("/recommendations", productsControllers.getRecommendedProducts);
router.get("/:id", productsControllers.getProductById);


export default router;
