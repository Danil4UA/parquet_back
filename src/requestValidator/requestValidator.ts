import { Response } from "express";
import Utils from "../utils/utils";

class RequestValidator {
    static isValidIdRequest(id: string, response: Response): boolean {
        if(!Utils.isNonEmptyString(id)){
            Utils.badRequest(response, "Missing required fields");
            return false;
        }
        return true;
    }
}

export default RequestValidator;