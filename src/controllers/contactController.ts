import { Request, Response } from 'express';
import ContactRequestValidator from '../requestValidator/contactRequestValidator';
import ContactUtils from '../utils/contactUtils';
import Contact from '../model/Contact';
import Utils from '../utils/utils';
import axios from 'axios';
import Consultation from '../model/Consultation';
import Product from '../model/Product';

class contactController {
    static sendTelegramMessage =  async (contactData: any): Promise<any> => {
        try {
            const message = ContactUtils.formatContactMessage(contactData);
            await axios.post(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
                chat_id: process.env.CHAT_ID,
                text: message,
                parse_mode: "Markdown"
            });
        } catch (error) {
            console.error("Error sending Telegram notification:", error);
        }
    }

    static sendTelegramConsultationMessage = async (consultationData: any, productData: any): Promise<any> => {
        try {
            const message = ContactUtils.formatConsultationMessage(consultationData, productData);
            await axios.post(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
                chat_id: process.env.CHAT_ID,
                text: message,
                parse_mode: "Markdown"
            });
        } catch (error) {
            console.error("Error sending Telegram consultation notification:", error);
        }
    }

    static sendContactForm = async (req: Request, res: Response): Promise<any> => {
        if(!ContactRequestValidator.isValidSendContactUsForm(req.body, res)){
            return false;
        }

        try {
            const validContactForm = ContactUtils.setContactUsObject(req.body);

            if(!validContactForm){
                Utils.badRequest(res, "Invalid contact form data");
                return;
            }

            // Anti-spam: drop duplicate messages from the same phone within a
            // 10-minute window (silently ack so bots don't adapt).
            const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
            const duplicate = await Contact.findOne({
                phone: req.body.phone,
                createdAt: { $gte: tenMinutesAgo },
            });

            if (duplicate) {
                console.warn("[contact] duplicate request ignored:", req.body.phone);
                return res.status(200).json({
                    success: true,
                    message: "Contact form sent successfully"
                });
            }

            const contactRequest = new Contact ({
                ...validContactForm,
                createdAt: new Date(),
            })

            await contactRequest.save();
            await this.sendTelegramMessage(req.body);
            res.status(200).json({
                success: true,
                message: "Contact form sent successfully"
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: "Error sending contact form",
            });
        }
    }

    static sendConsultationRequest = async (req: Request, res: Response): Promise<any> => {
        if(!ContactRequestValidator.isValidConsultationForm(req.body, res)){
            return false;
        }

        try {
            const validConsultationForm = ContactUtils.setConsultationObject(req.body);

            if(!validConsultationForm){
                Utils.badRequest(res, "Invalid consultation form data");
                return;
            }

            // Anti-spam: drop duplicate requests for the same phone + product
            // within a 10-minute window. Bots resubmit the identical lead over
            // and over; we silently ack so they don't adapt, but skip saving and
            // skip the Telegram notification.
            const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
            const duplicate = await Consultation.findOne({
                phone: validConsultationForm.phone,
                productId: validConsultationForm.productId,
                createdAt: { $gte: tenMinutesAgo },
            });

            if (duplicate) {
                console.warn("[consultation] duplicate request ignored:", validConsultationForm.phone);
                return res.status(200).json({
                    success: true,
                    message: "Consultation request sent successfully"
                });
            }

            const product = await Product.findById(req.body.productId);

            const consultationRequest = new Consultation ({
                ...validConsultationForm,
                createdAt: new Date(),
            });

            await consultationRequest.save();
            await this.sendTelegramConsultationMessage(req.body, product);
            res.status(200).json({
                success: true,
                message: "Consultation request sent successfully"
            });
        } catch (error) {
            console.error("Error sending consultation request:", error);
            res.status(500).json({
                success: false,
                message: "Error sending consultation request",
            });
        }
    }
    }
export default contactController