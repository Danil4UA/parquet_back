import express from "express";
import contactController from "../controllers/contactController";

const router = express.Router();

router.post("/", contactController.sendContactForm);

export default router;