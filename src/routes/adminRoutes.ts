import express from 'express';
import { authenticateToken } from "../middleware/authMiddleware";
import adminController from "../controllers/adminController"

const router = express.Router();

router.post("/product", authenticateToken, adminController.createProduct);
router.patch("/product/:id", authenticateToken, adminController.editProduct);
router.delete("/products", authenticateToken, adminController.deleteProducts);
export default router;