import { Response } from "express";
import Utils from "../utils/utils";
import { ContactUsForm } from "../types/contactTypes";

class ContactRequestValidator {
  static isValidSendContactUsForm = async (body: ContactUsForm, response: Response) =>{
    const {
        name,
        email,
        phone,
        message,
    } = body;

    if(!Utils.isNonEmptyString(name) || 
       !Utils.isNonEmptyString(phone) || 
       !Utils.isNonEmptyString(message) ||
       (email !== undefined && !Utils.isNonEmptyString(email))
    ){
        return response.status(400).json({
            success: false,
            message: "Missing required fields",
        });
    }
    return true;
  }  

  static isValidConsultationForm = (body: any, res: any): boolean => {
    if (!body.name || !body.phone || !body.productId || !body.formType) {
        Utils.badRequest(res, "Missing required fields");
        return false;
    }
    return true;
  }
}

export default ContactRequestValidator;