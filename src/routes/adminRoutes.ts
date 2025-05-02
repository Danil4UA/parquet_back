import express from 'express';
import { authenticateToken } from "../middleware/authMiddleware";
import adminController from "../controllers/adminController"

const router = express.Router();

router.get("/product/:id", authenticateToken, adminController.getFullProduct);
router.post("/product", authenticateToken, adminController.createProduct);
router.patch("/product/:id", authenticateToken, adminController.editProduct);
router.delete("/products", authenticateToken, adminController.deleteProducts);
export default router;