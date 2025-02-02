import mongoose, { Schema, Document } from "mongoose";

interface IOrder extends Document {
  name: string;
  lastName: string;
  address: string;
  apartment?: string;
  postalCode: string;
  city: string;
  phoneNumber: string;
  deliveryMethod: string;
  cartItems: {
    name: string;
    quantity: number;
  }[];
  status: string;
  createdAt: Date;
}

const orderSchema: Schema<IOrder> = new mongoose.Schema(
  {
    name: { type: String, required: true },
    lastName: { type: String, required: true },
    address: { type: String, required: true },
    apartment: { type: String },
    postalCode: { type: String, required: true },
    city: { type: String, required: true },
    phoneNumber: { type: String, required: true },
    deliveryMethod: { type: String, required: true },
    cartItems: [
      {
        name: { type: String, required: true },
        quantity: { type: Number, required: true }
      }
    ],
    status: { type: String, default: "processing" },
    createdAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);
const Order = mongoose.model<IOrder>("Order", orderSchema);

export default Order;
