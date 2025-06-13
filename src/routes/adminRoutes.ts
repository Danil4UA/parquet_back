import express from 'express';
import { authenticateToken } from "../middleware/authMiddleware";
import adminController from "../controllers/adminController"

const router = express.Router();

router.get("/product/:id", authenticateToken, adminController.getFullProduct);
router.post("/product", authenticateToken, adminController.createProduct);
router.patch("/product/:id", authenticateToken, adminController.editProduct);
router.delete("/products", authenticateToken, adminController.deleteProducts);

router.get("/orders", authenticateToken, adminController.getAllOrders);
router.patch("/order", authenticateToken, adminController.editOrderById);
router.delete("/order/:id", authenticateToken, adminController.deleteOrderById);
router.get("/order/:id", authenticateToken, adminController.getOrderById);

router.get("/products-by-category", authenticateToken, adminController.getProductsByCategory);
router.get("/order-status-distribution", authenticateToken, adminController.getOrderStatusDistribution);
router.get("/orders-timeline", authenticateToken, adminController.getOrdersTimeline);
router.get("/stats", authenticateToken, adminController.getDashboardStats);

export default router;