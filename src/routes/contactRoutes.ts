import express from "express";
import contactController from "../controllers/contactController";

const router = express.Router();

router.post("/", contactController.sendContactForm);
router.post("/consultation", contactController.sendConsultationRequest);


export default router;