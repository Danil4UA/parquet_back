import mongoose, { Schema, Document, Model } from "mongoose";
import { v4 as uuidv4 } from 'uuid';
interface IOrderItem {
  productId: string;     
  name: string;         
  model: string;        
  quantity: number;
  price: number;
  actualArea?: number;
  boxes?: number;
  totalPrice: number;
}


interface IOrder extends Document {
  orderNumber: string;
  name: string;
  lastName: string;
  address?: string;
  apartment?: string;
  postalCode?: string;
  city?: string;
  phoneNumber: string;
  email?: string;
  deliveryMethod: string;
  cartItems: IOrderItem[];
  status: string;
  paymentStatus: string;
  shippingCost: number;
  totalPrice: number;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface IOrderModel extends Model<IOrder> {
  generateOrderNumber(): Promise<string>;
}

const orderItemSchema = new Schema({
  productId: { 
    type: String, 
    required: true,
    ref: 'Product'
  },
  name: { type: String, required: true },
  model: { type: String, required: true },
  quantity: { type: Number, required: true, min: 1 },
  price: { type: Number, required: true },
  actualArea: { type: Number, required: false },
  boxes: { type: Number, required: false },
  totalPrice: { type: Number, required: true }
}, { _id: false });


const orderSchema: Schema<IOrder> = new mongoose.Schema(
  {
    orderNumber: { 
      type: String, 
      required: true, 
      unique: true,
      index: true 
    },
    name: { type: String, required: true },
    lastName: { type: String, required: false },
    address: { type: String, required: false },
    apartment: { type: String, required: false },
    postalCode: { type: String, required: false },
    city: { type: String, required: false },
    phoneNumber: { type: String, required: true },
    email: { type: String, required: false },
    deliveryMethod: { type: String, required: false },
    shippingCost: { type: Number, required: true, default: 0 },
    cartItems: {
      type: [orderItemSchema],
      required: true,
      validate: {
        validator: function(items: IOrderItem[]) {
          return items.length > 0;
        },
        message: 'Order must contain at least one item'
      }
    },
    totalPrice: { type: Number, required: true },
    status: { type: String, default: "pending", required: false},
    paymentStatus: { type: String, required: false },
    notes: { type: String, required: false },
    createdAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

orderSchema.statics.generateOrderNumber = function(): string {
  const year = new Date().getFullYear();
  const timestamp = Date.now().toString(36); // Base36 encoding for shorter string
  const uuid = uuidv4().split('-')[0]; // Take first part of UUID
  
  return `ORD-${year}-${timestamp}-${uuid}`.toUpperCase();
};
const Order = mongoose.model<IOrder, IOrderModel>("Order", orderSchema);

export default Order;
