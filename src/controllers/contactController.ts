import { Request, Response } from 'express';
import ContactRequestValidator from '../requestValidator/contactRequestValidator';
import ContactUtils from '../utils/contactUtils';
import Contact from '../model/Contact';
import Utils from '../utils/utils';
import axios from 'axios';

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
}
export default contactController