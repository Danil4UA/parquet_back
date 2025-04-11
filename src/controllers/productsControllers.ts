import { Request, Response } from "express";
import Product from "../model/Product";
import { isValidLanguage } from "../utils";

const productsControllers = {
  getAllProducts: async (req: Request, res: Response) => {
    try {
      const language = req.query.language?.toString() || "en";
      const products = await Product.find();
      const localizedProducts = products.map((product) => {
        const localizedName = isValidLanguage(language) ? product.name[language] : product.name.en;

        const localizedDescription = isValidLanguage(language) ? product.description[language] : product.description.en;
        const localizedDetailedDescription = isValidLanguage(language)
          ? product.detailedDescription[language]
          : product.detailedDescription.en;
        return {
          ...product.toObject(),
          name: localizedName,
          description: localizedDescription,
          detailedDescription: localizedDetailedDescription
        };
      });

      res.status(200).json(localizedProducts);
    } catch (error) {
      res.status(500).json({ message: "Error fetching products", error });
    }
  },
  getProductById: async (req: Request, res: Response) => {
    const { id } = req.params;
    const language = req.query.language?.toString() || "en";
    try {
      const product = await Product.findById(id);
      if (product) {
        const localizedName = isValidLanguage(language) ? product.name[language] : product.name.en;
        const localizedDescription = isValidLanguage(language) ? product.description[language] : product.description.en;
        const localizedDetailedDescription = isValidLanguage(language)
          ? product.detailedDescription[language]
          : product.detailedDescription.en;
        const localizedProduct = {
          ...product.toObject(),
          name: localizedName,
          description: localizedDescription,
          detailedDescription: localizedDetailedDescription
        };
        res.status(200).json(localizedProduct);
      } else {
        res.status(404).json({ success: false, message: "failed fetch the product" });
      }
    } catch (error) {
      res.status(500).json({ message: "Error fetching product", error });
    }
  },

  getProductByCategory: async (req: Request, res: Response) => {
    const { category, search, color, type } = req.query;
    const language = req.query.language?.toString() || "en";
    const page = parseInt(req.query.page?.toString() || "1");
    const limit = parseInt(req.query.limit?.toString() || "16"); 

    try {
      let query: Record<string, any> = {};
      if (category === "all") {
      } else if (category === "sales") {
        query = { discount: { $gt: 0 } };
      } else if (category) {
        query = { category: { $regex: new RegExp(category as string, "i") } };
      }

      if (color) {
        query.color = { $regex: new RegExp(color as string, "i") };
      }
      
      if (type) {
        query.type = { $regex: new RegExp(type as string, "i") };
      }
      
      if (search) {
        const searchRegex = new RegExp(search as string, "i");
        query.$or = [
          { "name.en": searchRegex },
          { "name.ru": searchRegex },
          { "name.he": searchRegex },
          { model: searchRegex },
          { type: searchRegex }
        ];
      }

        const totalProducts = await Product.countDocuments(query);
        const products = await Product.find(query)
          .skip((page - 1) * limit)
          .limit(limit);

        const localizedProducts = products.map((product) => {
        const localizedName = isValidLanguage(language) ? product.name[language] : product.name.en;

        const localizedDescription = isValidLanguage(language) ? product.description[language] : product.description.en;
        const localizedDetailedDescription = isValidLanguage(language)
          ? product.detailedDescription[language]
          : product.detailedDescription.en;
        return {
          ...product.toObject(),
          name: localizedName,
          description: localizedDescription,
          detailedDescription: localizedDetailedDescription
        };
      });

      res.json({
        products: localizedProducts,
        pagination: {
          total: totalProducts,
          page,
          limit,
          pages: Math.ceil(totalProducts / limit)
        }
      });
      } catch (error) {
      console.error("Error fetching products:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },
  getFilterOptions: async (req: Request, res: Response) => {
    try {
      const colors = await Product.distinct("color");
      
      const types = await Product.distinct("type");
      
      const categories = await Product.distinct("category");
      
      res.status(200).json({
        colors: colors.filter(Boolean),
        types: types.filter(Boolean),
        categories: categories.filter(Boolean)
      });
    } catch (error) {
      console.error("Error fetching filter options:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
};

export default productsControllers;
