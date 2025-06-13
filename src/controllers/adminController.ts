import { Request, Response } from "express";
import Product from "../model/Product";
import { sanitizeProductData } from "../utils/productUtils";
import Order from "../model/Order";
import RequestValidator from "../requestValidator/requestValidator";
import OrderRequestValidator from "../requestValidator/orderRequestValidator";
import OrderUtils from "../utils/orderUtils";
import Utils from "../utils/utils";

const adminController = {
    getFullProduct: async (req: Request, res: Response): Promise<any> => {
      try {
          const { id } = req.params;
          
          if (!id) {
              return res.status(400).json({ message: 'Product ID is required' });
          }
          
          const product = await Product.findById(id);
          
          if (!product) {
              return res.status(404).json({ message: 'Product not found' });
          }
          
          res.status(200).json({
              message: 'Product retrieved successfully',
              product
          });
      } catch (error) {
          console.error('Error retrieving product:', error);
          res.status(500).json({ message: 'Server error' });
      }
    },

    createProduct: async (req: Request, res: Response): Promise<any> => {
      try {
        const { data, errors } = sanitizeProductData(req.body, true);

        if (errors.length > 0) {
          return res.status(400).json({ 
            message: 'Validation failed',
            errors 
          });
        }

        const product = new Product ({
          ...data,
          createdAt: new Date(),
        })

        const saveProduct = await product.save();
        
        res.status(200).json({
          message: 'Product created successfully',
          product: saveProduct
        });
      } catch(error) {
        console.error('Error creating product:', error);
        res.status(500).json({ message: 'Server error' });
      }
    },

    editProduct: async (req: Request, res: Response): Promise<any> => {
        try {
          const { id } = req.params;
          const { data, errors } = sanitizeProductData(req.body);
          
          if (errors.length > 0) {
            return res.status(400).json({ 
              message: 'Validation failed',
              errors 
            });
          }
          
          const updatedProduct = await Product.findByIdAndUpdate(
            id,
            { $set: data },
            { new: true, runValidators: true }
          );
          
          if (!updatedProduct) {
            return res.status(404).json({ message: 'Product not found' });
          }
          
          res.status(200).json({
            message: 'Product updated successfully',
            product: updatedProduct
          });
        } catch (error) {
          console.error('Error updating product:', error);
          res.status(500).json({ message: 'Server error' });
        }
    },
      

    deleteProducts: async (req: Request, res: Response): Promise<any> => {
      try {
        const idsParam = req.query.ids as string;
        if (!idsParam) {
          return res.status(400).json({ message: 'No product IDs provided' });
        }
        
        const productIds = idsParam.split(',').filter(id => id.trim().length > 0);
        
        if (productIds.length === 0) {
          return res.status(400).json({ message: 'No valid product IDs provided' });
        }
        
        const deleteResult = await Product.deleteMany({ _id: { $in: productIds } });
        
        if (deleteResult.deletedCount === 0) {
          return res.status(404).json({ message: 'No products found with the provided IDs' });
        }
        
        res.status(200).json({
          message: `Successfully deleted ${deleteResult.deletedCount} products`,
          deletedCount: deleteResult.deletedCount
        });
      } catch (error) {
        res.status(500).json({ message: 'Server error' });
      }
    },

    getAllOrders: async (req: Request, res: Response): Promise<any> => {
      const { 
        page = 1,
        limit = 10,
        search
      } = req.query;

      const pageNumber = Math.max(1, parseInt(page.toString()));
      const pageLimit = parseInt(limit.toString());
      const skip = Math.max(0, (pageNumber - 1) * pageLimit);

      try {
        let query: Record<string, any> = {};
        if (search) {
          const searchRegex = new RegExp(search as string, "i");
          query.$or = [
            { orderNumber: searchRegex },
            { "customer.email": searchRegex },
            { "customer.name": searchRegex },
          ];
        }
        const totalOrders = await Order.countDocuments(query);
        const orders = await Order.find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(pageLimit);

          res.status(200).json({
            orders,
            pagination: {
              total: totalOrders,
              page: pageNumber,
              limit: pageLimit,
              pages: Math.ceil(totalOrders / pageLimit)
            }
          });
      } catch (error) {
        console.error("Error fetching orders:", error);
        res.status(500).json({ message: 'Server error' });
      }
    },

    getOrderById: async (req: Request, res: Response): Promise<any> => {
      const { id } = req.params;

      if(!RequestValidator.isValidIdRequest(id, res)){
        return;
      }
      try {
        const order = await Order.findById(id);
        if (!order) {
          return res.status(404).json({ message: 'Order not found' });
        }
        res.status(200).json({
          message: 'Order retrieved successfully',
          order
        });
      } catch (error) {
        console.error('Error retrieving order:', error);
        res.status(500).json({ message: 'Server error' });
      }
    },

    deleteOrderById: async (req: Request, res: Response): Promise<any> => {
      const { id } = req.params;

      if(!RequestValidator.isValidIdRequest(id, res)){
        return
      }
      try {
        const deleteResult = await Order.deleteOne({ _id: id });

        if(deleteResult.deletedCount === 0){
          return res.status(404).json({ message: 'No order found with the provided ID' });
        }
        res.status(200).json({
          message: `Successfully deleted ${deleteResult.deletedCount} order`,
          deletedCount: deleteResult.deletedCount
        });
      } catch (error) {
        console.error('Error retrieving order:', error);
        res.status(500).json({ message: 'Server error' });
      }
    },

    editOrderById: async (req: Request, res: Response): Promise<any> => {
      if(!OrderRequestValidator.isValidEditOrderRequest(req.body, res)){
        return
      }
      try {
        const { id } = req.body;
        const orderData = OrderUtils.setOrderData(req.body);

        if(!orderData){
          Utils.badRequest(res, "Order data is not valid")
          return
        }

        const updatedOrder = await Order.findByIdAndUpdate(
          id,
          { $set: orderData },
          { new: true, runValidators: true }
        );

        if (!updatedOrder) {
          Utils.badRequest(res, "Order is not found")
          return
        }

        res.json({
            message: 'Order updated successfully',
            product: updatedOrder
        });
      } catch (error) {
        console.error('Error updating order:', error);
        res.status(500).json({ message: 'Server error' });
      }
    },

    getProductsByCategory: async (req: Request, res: Response): Promise<any> => {
      try {
        const categoryData = await Product.aggregate([
          {
            $group: {
              _id: "$category",
              count: { $sum: 1 }
            }
          },
          {
            $project: {
              category: "$_id",
              count: 1,
              _id: 0
            }
          },
          {
            $sort: { count: -1 }
          }
        ]);
        
        res.status(200).json(categoryData);
      } catch (error) {
        console.error('Error retrieving products by category:', error);
        res.status(500).json({ message: 'Server error' });
      }
    },

    getOrderStatusDistribution: async (req: Request, res: Response): Promise<any> => {
      try {
        const statusDistribution = await Order.aggregate([
          {
            $group: {
              _id: "$status",
              count: { $sum: 1 }
            }
          },
          {
            $project: {
              name: {
                $switch: {
                  branches: [
                    { case: { $eq: ["$_id", "pending"] }, then: "Pending" },
                    { case: { $eq: ["$_id", "completed"] }, then: "Completed" },
                    { case: { $eq: ["$_id", "canceled"] }, then: "Canceled" },
                    { case: { $eq: ["$_id", "processing"] }, then: "Processing" },
                    { case: { $eq: ["$_id", "shipped"] }, then: "Shipped" }
                  ],
                  default: "Other"
                }
              },
              value: "$count",
              color: {
                $switch: {
                  branches: [
                    { case: { $eq: ["$_id", "pending"] }, then: "#f59e0b" },
                    { case: { $eq: ["$_id", "completed"] }, then: "#22c55e" },
                    { case: { $eq: ["$_id", "canceled"] }, then: "#ef4444" },
                    { case: { $eq: ["$_id", "processing"] }, then: "#3b82f6" },
                    { case: { $eq: ["$_id", "shipped"] }, then: "#8b5cf6" }
                  ],
                  default: "#6b7280"
                }
              },
              _id: 0
            }
          }
        ]);
        
        res.status(200).json(statusDistribution);
      } catch (error) {
        console.error('Error retrieving order status distribution:', error);
        res.status(500).json({ message: 'Server error' });
      }
    },
    getOrdersTimeline: async (req: Request, res: Response): Promise<any> => {
      try {
        const { days, all } = req.query;
        
        let matchStage: any = {};
        
        if (all === 'true') {
          matchStage = {};
        } else {
          const numDays = parseInt((days || 7).toString());
          const endDate = new Date();
          const startDate = new Date();
          startDate.setDate(startDate.getDate() - numDays);
          
          matchStage = {
            createdAt: {
              $gte: startDate,
              $lte: endDate
            }
          };
        }
        
        const pipeline: any = [];
        
        if (Object.keys(matchStage).length > 0) {
          pipeline.push({ $match: matchStage });
        }
        
        pipeline.push(
          {
            $group: {
              _id: {
                $dateToString: {
                  format: "%Y-%m-%d",
                  date: "$createdAt"
                }
              },
              orders: { $sum: 1 }
            }
          },
          {
            $sort: { _id: 1 }
          },
          {
            $project: {
              date: "$_id",
              orders: 1,
              _id: 0
            }
          }
        );
        
        const ordersTimeline = await Order.aggregate(pipeline);
        
        if (all === 'true') {
          return res.status(200).json(ordersTimeline);
        }
        
        const numDays = parseInt((days || 7).toString());
        const timelineData = [];
        for (let i = numDays - 1; i >= 0; i--) {
          const date = new Date();
          date.setDate(date.getDate() - i);
          const dateString = date.toISOString().split('T')[0];
          
          const existingData = ordersTimeline.find(item => item.date === dateString);
          timelineData.push({
            date: dateString,
            orders: existingData ? existingData.orders : 0
          });
        }
        
        res.status(200).json(timelineData);
      } catch (error) {
        console.error('Error retrieving orders timeline:', error);
        res.status(500).json({ message: 'Server error' });
      }
    },

    getDashboardStats: async (req: Request, res: Response): Promise<any> => {
      try {
        const totalOrders = await Order.countDocuments();
        
        const completedOrders = await Order.countDocuments({ status: 'completed' });
        
        const pendingOrders = await Order.countDocuments({ status: 'pending' });
        
        const canceledOrders = await Order.countDocuments({ status: 'canceled' });
        
        const totalProducts = await Product.countDocuments();
        
        const successRate = totalOrders > 0 ? ((completedOrders / totalOrders) * 100).toFixed(1) : 0;
        
        const lastWeek = new Date();
        lastWeek.setDate(lastWeek.getDate() - 7);
        const ordersThisWeek = await Order.countDocuments({
          createdAt: { $gte: lastWeek }
        });

        const stats = {
            totalOrders,
            completedOrders,
            pendingOrders,
            canceledOrders,
            totalProducts,
            successRate,
            ordersThisWeek
          }
        
        res.status(200).json(stats);
      } catch (error) {
        console.error('Error retrieving dashboard stats:', error);
        res.status(500).json({ message: 'Server error' });
      }
    },
}

export default adminController