import { Response } from "express";
import Utils from "../utils/utils";
import OrderUtils from "../utils/orderUtils";
import { OrderData } from "../types/orderTypes";

class OrderRequestValidator {
    static isValidEditOrderRequest = (
        body: Partial<OrderData> & { id: string }, 
        response: Response
    ): boolean => {
    const { 
        id,
        name,
        lastName,
        address,
        apartment,
        postalCode,
        city,
        phoneNumber,
        email,
        deliveryMethod,
        shippingCost,
        totalPrice,
        status,
        paymentStatus,
        notes,
    } = body;

    if (!Utils.isNonEmptyString(id)){
        Utils.badRequest(response, "id is invalid")
        return false;
    }

    if ((name !== undefined && !Utils.isString(name)) 
    || (lastName !== undefined && !Utils.isString(lastName))
    || (address !== undefined && !Utils.isString(address))
    || (apartment !== undefined && !Utils.isString(apartment))
    || (postalCode !== undefined && !Utils.isString(postalCode)) 
    || (city !== undefined && !Utils.isString(city)) 
    || (phoneNumber !== undefined && !Utils.isString(phoneNumber))
    || (email !== undefined && !Utils.isString(email)) 
    || (deliveryMethod !== undefined && !OrderUtils.isValidDeliveryMethod(deliveryMethod)) 
    || (shippingCost !== undefined && !Utils.isNumber(shippingCost)) 
    || (totalPrice !== undefined && !Utils.isNumber(totalPrice)) 
    || (status !== undefined && !OrderUtils.isValidOrderStatus(status))
    || (paymentStatus !== undefined && !OrderUtils.isValidPaymentStatus(paymentStatus)) 
    || (notes !== undefined && !Utils.isString(notes)) 
    ){
        Utils.badRequest(response)
        return false
    }
    return true;
  }  
}

export default OrderRequestValidator;