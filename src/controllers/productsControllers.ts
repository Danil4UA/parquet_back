import { Request, Response } from "express";
import Product from "../model/Product";
import { isValidLanguage } from "../utils";

const RANDOM_SEED = Array.from({ length: 1000 }, () => Math.random());

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
  const { 
    category, 
    search, 
    color, 
    type,
    isRandom
  } = req.query;
  const language = req.query.language?.toString() || "en";
  const page = Math.max(1, parseInt(req.query.page?.toString() || "1"));
  const limit = parseInt(req.query.limit?.toString() || "16");
  const useRandomOrder = isRandom === "true";

  try {
    let query: Record<string, any> = {};
    if (category === "all") {
    } else if (category === "sales") {
      query = { discount: { $gt: 0 } };
    } else if (category) {
      query = { category: { $regex: new RegExp(category as string, "i") } };
    }

    if (color) {
      const colors = (color as string).split(',');
      query.color = { $in: colors.map(c => new RegExp(c, "i")) };
    }

    if (type) {
      const types = (type as string).split(',');
      query.type = { $in: types.map(t => new RegExp(t, "i")) };
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
    
    if (useRandomOrder) {
      const allProducts = await Product.find(query);
      
      const sortedProducts = allProducts.sort((a, b) => {
        const seedIndexA = Math.abs(a._id.toString().split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)) % RANDOM_SEED.length;
        const seedIndexB = Math.abs(b._id.toString().split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)) % RANDOM_SEED.length;
        
        return RANDOM_SEED[seedIndexA] - RANDOM_SEED[seedIndexB];
      });
      
      const start = (page - 1) * limit;
      const end = start + limit;
      const paginatedProducts = sortedProducts.slice(start, end);
      
      const localizedProducts = paginatedProducts.map((product) => {
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
      return;
    }
    
    const skip = Math.max(0, (page - 1) * limit);
    const products = await Product.find(query)
      .skip(skip)
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
