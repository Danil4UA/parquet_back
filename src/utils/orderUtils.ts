import { OrderData } from "../controllers/orderControllers";
import { DeliveryMethod, OrderStatus, PaymentStatus } from "../types/orderTypes";

export default class OrderUtils {

    static readonly ValidDeliveryMethod: DeliveryMethod[] = ["shipping", "pickup", null];

    static readonly ValidOrderStatus: OrderStatus[] = ["pending", "completed", "canceled", null];

    static readonly ValidPaymentStatus: PaymentStatus[] = ["pending", "notPaid", "paid", "refund", null];

    static setOrderData = (body: any): Partial<OrderData> => {
      const orderData: Partial<OrderData> = {};
      
      const orderProperties = [
        'orderNumber',
        'name',
        'lastName',
        'address',
        'apartment',
        'postalCode',
        'city',
        'phoneNumber',
        'email',
        'deliveryMethod',
        'cartItems',
        'shippingCost',
        'totalPrice',
        'status',
        'paymentStatus',
        'notes'
      ];
      
      for (const prop of orderProperties) {
        if (body[prop] !== undefined) {
          orderData[prop as keyof OrderData] = body[prop];
        }
      }
      
      return orderData;
    }

    static isValidPaymentStatus = (paymentStatus: string): paymentStatus is PaymentStatus => {
        return this.ValidPaymentStatus.includes(paymentStatus as PaymentStatus);
    }

    static isValidOrderStatus = (status: string): status is OrderStatus => {
        return this.ValidOrderStatus.includes(status as OrderStatus);
    }

    static isValidDeliveryMethod = (deliveryMethod: string): deliveryMethod is DeliveryMethod => {
        return this.ValidDeliveryMethod.includes(deliveryMethod as DeliveryMethod);
    }

    static calculatePriceWithDiscount = (price: number, discount: number = 0): number => {
      return discount > 0 ? price * (1 - discount / 100) : price;
    };
}