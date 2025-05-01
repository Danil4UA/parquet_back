import { Request, Response } from "express";
import Product from "../model/Product";
import { sanitizeProductData } from "../utils/productUtils";

const adminController = {
    createProduct: async () => {

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
}

export default adminController