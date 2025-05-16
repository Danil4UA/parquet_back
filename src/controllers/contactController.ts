import { Request, Response } from 'express';
import ContactRequestValidator from '../requestValidator/contactRequestValidator';
import ContactUtils from '../utils/contactUtils';
import Contact from '../model/Contact';
import Utils from '../utils/utils';

const contactController = {
    sendContactForm: async (req: Request, res: Response): Promise<any> => {
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