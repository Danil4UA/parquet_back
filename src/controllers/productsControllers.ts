import { Request, Response } from "express";
import Product from "../model/Product";
import CategoryRecommendation from "../model/CategoryRecommendation";
import { isValidLanguage } from "../utils";

const RANDOM_SEED = Array.from({ length: 1000 }, () => Math.random());

// Localizes a product (works for both Mongoose docs and plain aggregate objects).
const localizeProduct = (product: any, language: string) => {
  const obj = typeof product.toObject === "function" ? product.toObject() : product;
  const valid = isValidLanguage(language);
  return {
    ...obj,
    name: valid ? obj.name?.[language] : obj.name?.en,
    description: valid ? obj.description?.[language] : obj.description?.en,
    detailedDescription: valid ? obj.detailedDescription?.[language] : obj.detailedDescription?.en
  };
};

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
    material,
    isRandom,
    sortBy,
  } = req.query;
  const language = req.query.language?.toString() || "en";
  const page = Math.max(1, parseInt(req.query.page?.toString() || "1"));
  const limit = parseInt(req.query.limit?.toString() || "20");
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

    // "material" narrows the catalog by product category (SPC / Laminate / Wood / Cladding / Panels).
    // Used by the "all" catalog filter; matches the product's `category` field exactly (case-insensitive).
    if (material) {
      const materials = (material as string).split(',');
      query.category = { $in: materials.map(m => new RegExp(`^${m}$`, "i")) };
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
      
      let sortedProducts;
  
      if (sortBy === "price_asc" || sortBy === "price_desc") {
        const getEffectivePrice = (product: any) => {
          const discount = product.discount || 0;
          return Number(product.price) * (1 - discount / 100);
        };
        
        sortedProducts = allProducts.sort((a, b) => {
          const priceA = getEffectivePrice(a);
          const priceB = getEffectivePrice(b);
          
          if (sortBy === "price_asc") {
            return priceA - priceB;
          } else {
            return priceB - priceA;
          }
        });
      } else {
        sortedProducts = allProducts.sort((a, b) => {
          const seedIndexA = Math.abs(a._id.toString().split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)) % RANDOM_SEED.length;
          const seedIndexB = Math.abs(b._id.toString().split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)) % RANDOM_SEED.length;
          
          return RANDOM_SEED[seedIndexA] - RANDOM_SEED[seedIndexB];
        });
      }
    
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

    let sortOption: Record<string, 1 | -1> = {};
    if (sortBy === "price_asc") {
      sortOption = { price: 1 };
    } else if (sortBy === "price_desc") {
      sortOption = { price: -1 };
    }

    const products = await Product.find(query)
      .sort(sortOption)
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
  },

  // Returns "recommended" products for a product page. Resolution order:
  //   1. The product's own recommendedProducts list (manual override).
  //   2. Categories configured to be recommended for the product's category (admin).
  //   3. Fallback: other products from the same category.
  getRecommendedProducts: async (req: Request, res: Response): Promise<any> => {
    const language = req.query.language?.toString() || "en";
    const productId = req.query.productId?.toString();
    const limit = Math.max(1, Math.min(parseInt(req.query.limit?.toString() || "12"), 24));

    try {
      if (!productId) {
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
