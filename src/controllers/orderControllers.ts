import { Request, Response } from "express";
import axios from "axios";
import { formatOrderMessage } from "../utils";
import Order from "../model/Order";
import OrderUtils from "../utils/orderUtils";

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
  country?: string;
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

  createOrder: async (req: Request, res: Response) : Promise<any> => {
    try {
      const orderData = OrderUtils.setOrderData(req.body);
      const validation = OrderUtils.validateOrderData(orderData);

      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          message: "Missing required fields",
          missingFields: validation.missingFields,
          invalidFields: validation.invalidFields
        });
      }
      
      const newOrder = new Order(orderData);
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
  },

  getOrders: async (req: Request, res: Response) => {
    try {
      const orders = await Order.find().sort({ createdAt: -1 });
      res.status(200).json({
        success: true,
        orders
      });
    } catch (error) {
      console.error("Error fetching orders:", error);
      res.status(500).json({
        success: false,
        message: "Error fetching orders"
      });
    }
  },

  getOrderById: async (req: Request, res: Response) => {
    try {
      const order = await Order.findById(req.params.id);
      
      if (!order) {
        return res.status(404).json({
          success: false,
          message: "Order not found"
        });
      }
      
      res.status(200).json({
        success: true,
        order
      });
    } catch (error) {
      console.error("Error fetching order:", error);
      res.status(500).json({
        success: false,
        message: "Error fetching order"
      });
    }
  }
};

export default orderControllers;
