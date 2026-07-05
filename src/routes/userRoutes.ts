import express from "express";
import userController from "../controllers/userController"
import { authenticateToken } from "../middleware/authMiddleware";

const router = express.Router();

// Only an already-authenticated admin can create new users
router.post("/register", authenticateToken, userController.register);
router.post("/login", userController.login);
router.post("/refresh", userController.refresh);
router.post("/logout", userController.logout);
router.get("/", authenticateToken, userController.getUser);

export default router;
