import express from "express";
import contactController from "../controllers/contactController";
import { honeypot, contactRateLimiter } from "../middleware/contactProtection";

const router = express.Router();

router.post("/", contactRateLimiter, honeypot, contactController.sendContactForm);
router.post("/consultation", contactRateLimiter, honeypot, contactController.sendConsultationRequest);


export default router;