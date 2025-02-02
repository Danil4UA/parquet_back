import { Request, Response } from "express";
import axios from "axios";
import { formatOrderMessage } from "../utils";
import Order from "../model/Order";

export interface OrderData {
  name: string;
  lastName: string;
  address: string;
  apartment: string;
  postalCode: string;
  city: string;
  phoneNumber: string;
  deliveryMethod: "shipping" | "pickup";
  cartItems: Array<{ name: string; quantity: number }>;
  country: string;
}

const orderControllers = {
  completeOrder: async (req: Request, res: Response) => {
    try {
      const orderData = req.body;
      const message = formatOrderMessage(orderData);
      await axios.post(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        chat_id: process.env.CHAT_ID,
        text: message,
        parse_mode: "Markdown"
      });
      res.status(200).json({ success: true, message: "sentSuccess" });
    } catch (error) {
      res.status(500).json({ success: false, message: "sentFailed", error });
    }
  },
  createOrder: async (req: Request, res: Response) => {
    try {
      const orderData: OrderData = req.body;

      const newOrder = new Order({
        name: orderData.name,
        lastName: orderData.lastName,
        address: orderData.address,
        apartment: orderData.apartment,
        postalCode: orderData.postalCode,
        city: orderData.city,
        phoneNumber: orderData.phoneNumber,
        deliveryMethod: orderData.deliveryMethod,
        cartItems: orderData.cartItems
      });
      const savedOrder = await newOrder.save();
      res.status(200).json({
        success: true,
        order: savedOrder
      });
    } catch (error) {
      console.error("Order creation error:", error);
      res.status(500).json({
        success: false,
        message: "Error creating order"
      });
    }
  }
};

export default orderControllers;
