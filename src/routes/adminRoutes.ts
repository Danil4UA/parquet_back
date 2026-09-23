import express from 'express';
import { authenticateToken } from "../middleware/authMiddleware";
import adminController from "../controllers/adminController";
import adminVisualizerController, { sampleUploadMiddleware } from "../controllers/adminVisualizerController";

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

router.get("/recommendations", authenticateToken, adminController.getRecommendations);
router.put("/recommendations", authenticateToken, adminController.saveRecommendations);

// Room visualizer management
router.get("/visualizer/stats", authenticateToken, adminVisualizerController.stats);
router.get("/visualizer/rooms", authenticateToken, adminVisualizerController.rooms);
router.get("/visualizer/renders", authenticateToken, adminVisualizerController.renders);
router.post("/visualizer/samples", authenticateToken, sampleUploadMiddleware, adminVisualizerController.uploadSample);
router.post("/visualizer/samples/generate", authenticateToken, adminVisualizerController.generateSample);
router.patch("/visualizer/rooms/:id", authenticateToken, adminVisualizerController.updateRoom);
router.delete("/visualizer/rooms/:id", authenticateToken, adminVisualizerController.deleteRoom);
router.post("/visualizer/render", authenticateToken, adminVisualizerController.render);
router.post("/visualizer/renders/:id/regenerate", authenticateToken, adminVisualizerController.regenerate);
router.delete("/visualizer/renders/:id", authenticateToken, adminVisualizerController.deleteRender);
router.delete("/visualizer/customer-images", authenticateToken, adminVisualizerController.purgeCustomerImages);
router.post("/visualizer/failures/acknowledge", authenticateToken, adminVisualizerController.acknowledgeFailures);

export default router;