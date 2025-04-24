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
      

    deleteProduct: async (req: Request, res: Response): Promise<any> => {
        try {
          const { id } = req.params;
          
          const deletedProduct = await Product.findByIdAndDelete(id);
          
          if (!deletedProduct) {
            return res.status(404).json({ message: 'Product not found' });
          }
          
          res.status(200).json({
            message: 'Product deleted successfully',
            product: deletedProduct
          });
        } catch (error) {
          console.error('Error deleting product:', error);
          res.status(500).json({ message: 'Server error' });
        }
      }

}

export default adminController