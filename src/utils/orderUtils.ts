import { OrderData } from "../controllers/orderControllers";

export default class OrderUtils {
    static ValidDeliveryMethod = {
        SHIPPING: "shipping",
        PICK_UP: "pickup"
    }

    static setOrderData = (body: any): Partial<OrderData> => {
        const orderData: Partial<OrderData> = {};
        
        const orderProperties = [
          'name',
          'lastName',
          'address',
          'apartment',
          'postalCode',
          'city',
          'phoneNumber',
          'deliveryMethod',
          'cartItems',
          'country'
        ];
        
        for (const prop of orderProperties) {
          if (body[prop] !== undefined) {
            orderData[prop as keyof OrderData] = body[prop];
          }
        }
        
        return orderData;
      }

      static validateOrderData = (orderData: Partial<OrderData>): { 
        isValid: boolean; 
        missingFields?: string[];
        invalidFields?: string[];
      } => {
        const requiredFields = [
          'name',
          'lastName',
          'phoneNumber',
          'deliveryMethod',
          'cartItems'
        ];
        
        if (orderData.deliveryMethod === this.ValidDeliveryMethod.SHIPPING) {
          requiredFields.push('address');
        }
        
        const missingFields = requiredFields.filter(field => !orderData[field as keyof OrderData]);
        const invalidFields: string[] = [];

        if (orderData.cartItems && (!Array.isArray(orderData.cartItems) || orderData.cartItems.length === 0)) {
            invalidFields.push('cartItems');
        }
        return {
          isValid: missingFields.length === 0,
          missingFields: missingFields.length > 0 ? missingFields : undefined,
          invalidFields: invalidFields.length > 0 ? invalidFields : undefined
        };
      }
}