import { Request, Response } from "express";
import axios from "axios";
import { formatOrderMessage } from "../utils";
import Order from "../model/Order";
import Product from "../model/Product";

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


class orderControllers {
  static sendTelegramNotification = async (orderData: any) => {
    try {
      const message = formatOrderMessage(orderData);
      await axios.post(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        chat_id: process.env.CHAT_ID,
        text: message,
        parse_mode: "Markdown"
      });
    } catch (error) {
      console.error("Error sending Telegram notification:", error);
    }
  }

  static createOrder = async (req: Request, res: Response): Promise<any> => {
    try {
      const orderNumber = await Order.generateOrderNumber();
      
      const cartItemIds = req.body.cartItems.map((item: any) => item.id);
      
      const products = await Product.find({ _id: { $in: cartItemIds } });
      if (products.length !== cartItemIds.length) {
        const foundIds = products.map(p => p._id.toString());
        const missingIds = cartItemIds.filter((id: string) => !foundIds.includes(id));
        
        return res.status(400).json({
          success: false,
          message: "Some products not found",
          missingProducts: missingIds
        });
      }

      const productMap = new Map(
        products.map(product => [product._id.toString(), product])
      );

      const processedCartItems = req.body.cartItems.map((item: any, index: number) => {
        
        const product = productMap.get(item.id);
        
        if (!product) {
          throw new Error(`Product ${item.id} not found`);
        }

        const pricePerSqm = product.discount > 0 
          ? product.price * (1 - product.discount / 100)
          : product.price;
        

        let actualArea: number;
        let boxes: number;
        let totalPrice: number;

        if (product.boxCoverage) {
          const requestedArea = item.quantity;
          
          boxes = Math.ceil(requestedArea / product.boxCoverage);
          
          actualArea = boxes * product.boxCoverage;
          
          totalPrice = pricePerSqm * actualArea;
        } else {
          boxes = item.quantity;
          actualArea = item.quantity;
          totalPrice = pricePerSqm * item.quantity;
        }
        
        const processedItem = {
          productId: product._id.toString(),
          name: product.name,
          model: product.model,
          quantity: item.quantity,
          price: pricePerSqm,
          actualArea: Number(actualArea.toFixed(2)),
          boxes: boxes,
          totalPrice: Number(totalPrice.toFixed(2))
        };
              
        return processedItem;
      });

      const subtotal = processedCartItems.reduce(
        (sum: number, item: any) => sum + item.totalPrice, 
        0
      );
      
      const shippingCost = req.body.deliveryMethod === 'shipping' ? 250 : 0;

      const totalPrice = Number((subtotal + shippingCost).toFixed(2));
      
      const orderData = {
        orderNumber,
        name: req.body.name,
        lastName: req.body.lastName,
        phoneNumber: req.body.phoneNumber,
        email: req.body.email,
        deliveryMethod: req.body.deliveryMethod,
        address: req.body.address || '',
        apartment: req.body.apartment || '',
        city: req.body.city || '',
        postalCode: req.body.postalCode || '',
        cartItems: processedCartItems,
        shippingCost,
        totalPrice,
        status: 'pending',
        paymentStatus: 'pending',
        notes: req.body.notes
      };


      const newOrder = new Order(orderData);
      const savedOrder = await newOrder.save();
      
      await this.sendTelegramNotification(savedOrder);
      res.status(201).json({
        success: true,
        order: savedOrder,
        orderNumber,
        totalPrice,
        message: `Order ${savedOrder.orderNumber} created successfully`
      });

    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || "Error creating order"
      });
    }
  }

  static getOrders = async (req: Request, res: Response) => {
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
  }

  static getOrderById = async (req: Request, res: Response) => {
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
