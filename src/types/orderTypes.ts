export type PaymentStatus = "pending" | "notPaid" | "paid" | "refund";

export type OrderStatus = "pending" | "completed" | "canceled";

export type DeliveryMethod = "shipping" | "pickup";

export type OrderData = {
    id: string;
    orderNumber: string
    name: string;
    lastName: string;
    address: string;
    apartment: string;
    postalCode: string;
    city: string;
    phoneNumber: string;
    email: string;
    deliveryMethod: DeliveryMethod;
    shippingCost: number;
    totalPrice: number;
    status: OrderStatus;
    paymentStatus: PaymentStatus;
    notes: string;
}