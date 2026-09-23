import { Request, Response } from "express";
import mongoose from "mongoose";
import Product from "../model/Product";
import CategoryRecommendation from "../model/CategoryRecommendation";
import { localizeProduct, resolveLanguage } from "../utils/productUtils";
import { listCatalog, parseCatalogQuery } from "../services/catalogService";

const productsControllers = {
  getAllProducts: async (req: Request, res: Response) => {
    try {
      const language = resolveLanguage(req.query.language);
      const products = await Product.find().lean();
      res.status(200).json(products.map((product) => localizeProduct(product, language)));
    } catch (error) {
      console.error("Error fetching products:", error);
      res.status(500).json({ message: "Error fetching products" });
    }
  },

  getProductById: async (req: Request, res: Response): Promise<any> => {
    const { id } = req.params;
    const language = resolveLanguage(req.query.language);

    if (!mongoose.isValidObjectId(id)) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    try {
      const product = await Product.findById(id).lean();
      if (!product) {
        return res.status(404).json({ success: false, message: "Product not found" });
      }
      res.status(200).json(localizeProduct(product, language));
    } catch (error) {
      console.error("Error fetching product:", error);
      res.status(500).json({ message: "Error fetching product" });
    }
  },

  // Catalog listing with filters, sorting and pagination. See services/catalogService.ts.
  getProductByCategory: async (req: Request, res: Response) => {
    try {
      const query = parseCatalogQuery(req.query as Record<string, unknown>);
      res.json(await listCatalog(query));
    } catch (error) {
      console.error("Error fetching products:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },

  getFilterOptions: async (req: Request, res: Response) => {
    try {
      const [colors, types, categories] = await Promise.all([
        Product.distinct("color"),
        Product.distinct("type"),
        Product.distinct("category")
      ]);

      res.status(200).json({
        colors: colors.filter(Boolean),
        types: types.filter(Boolean),
        categories: categories.filter(Boolean)
      });
    } catch (error) {
      console.error("Error fetching filter options:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },

  // Returns "recommended" products for a product page. Resolution order:
  //   1. The product's own recommendedProducts list (manual override).
  //   2. Categories configured to be recommended for the product's category (admin).
  //   3. Fallback: other products from the same category.
  getRecommendedProducts: async (req: Request, res: Response): Promise<any> => {
    const language = resolveLanguage(req.query.language);
    const productId = req.query.productId?.toString();
    const limit = Math.max(1, Math.min(parseInt(req.query.limit?.toString() || "12"), 24));

    try {
      if (!productId || !mongoose.isValidObjectId(productId)) {
        return res.status(200).json({ products: [] });
      }

      const product = await Product.findById(productId);
      if (!product) {
        return res.status(200).json({ products: [] });
      }

      let products: any[] = [];

      // 1. Manual per-product override.
      if (product.recommendedProducts && product.recommendedProducts.length > 0) {
        products = await Product.find({
          _id: { $in: product.recommendedProducts }
        }).limit(limit);
      }

      // 2. Category-level recommendations.
      if (products.length === 0) {
        const rec = await CategoryRecommendation.findOne({ fromCategory: product.category });
        if (rec && rec.recommends && rec.recommends.length > 0) {
          products = await Product.aggregate([
            {
              $match: {
                category: { $in: rec.recommends },
                _id: { $ne: product._id },
                isAvailable: true
              }
            },
            { $sample: { size: limit } }
          ]);
        }
      }

      // 3. Fallback: same category.
      if (products.length === 0) {
        products = await Product.aggregate([
          {
            $match: {
              category: product.category,
              _id: { $ne: product._id },
              isAvailable: true
            }
          },
          { $sample: { size: limit } }
        ]);
      }

      const localized = products.map((p) => localizeProduct(p, language));
      res.status(200).json({ products: localized });
    } catch (error) {
      console.error("Error fetching recommended products:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
};

export default productsControllers;
