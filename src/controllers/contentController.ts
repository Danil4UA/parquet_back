import { Request, Response } from "express";
import SiteContent from "../model/SiteContent";

const MAX_HERO_IMAGES = 10;
const MAX_HOME_PRODUCTS = 12;

const isImageUrl = (value: unknown): value is string =>
  typeof value === "string" && /^https:\/\/.+/.test(value);

const isObjectId = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{24}$/.test(value);

// A hand-picked, ordered list of product ids for a home page section; [] means "automatic".
const productList = (name: string) => (value: any) => {
  if (!Array.isArray(value)) return `${name} must be an array of product ids`;
  if (value.length > MAX_HOME_PRODUCTS) return `${name} can contain at most ${MAX_HOME_PRODUCTS} products`;
  if (!value.every(isObjectId)) return `${name} must contain product ids`;
  if (new Set(value).size !== value.length) return `${name} must not repeat a product`;
  return null;
};

// Every editable slot has a validator so the admin UI can't store garbage
const validators: Record<string, (value: any) => string | null> = {
  // Home page: photo behind the headline (null = the site's default photo)
  hero_image: (value) => (value === null || isImageUrl(value) ? null : "hero_image must be an https image URL or null"),
  // Home page: which sample-room render is shown in the before/after demo (null = latest)
  home_showcase: (value) => (value === null || isObjectId(value) ? null : "home_showcase must be a render id or null"),
  // Home page: hand-picked products for "Most chosen" and "Our work" ([] = automatic)
  home_popular: productList("home_popular"),
  home_works: productList("home_works"),
  hero_slider: (value) => {
    if (!Array.isArray(value)) return "hero_slider must be an array of image URLs";
    if (value.length > MAX_HERO_IMAGES) return `hero_slider can contain at most ${MAX_HERO_IMAGES} images`;
    if (!value.every(isImageUrl)) return "hero_slider must contain https image URLs";
    return null;
  },
  category_images: (value) => {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      return "category_images must be an object of category -> URL";
    }
    for (const [category, url] of Object.entries(value)) {
      if (!isImageUrl(url)) return `category_images.${category} must be an https image URL`;
    }
    return null;
  }
};

const contentController = {
  // Public: returns all slots at once, e.g. { hero_slider: [...], category_images: {...} }
  getContent: async (req: Request, res: Response): Promise<any> => {
    try {
      const entries = await SiteContent.find({ key: { $in: Object.keys(validators) } });

      const content: Record<string, unknown> = {};
      for (const entry of entries) {
        content[entry.key] = entry.value;
      }

      res.status(200).json(content);
    } catch (error) {
      console.error("Error fetching site content:", error);
      res.status(500).json({ message: "Server error" });
    }
  },

  updateContent: async (req: Request, res: Response): Promise<any> => {
    try {
      const { key } = req.params;
      const { value } = req.body;

      const validate = validators[key];
      if (!validate) {
        return res.status(400).json({ message: `Unknown content key: ${key}` });
      }

      const validationError = validate(value);
      if (validationError) {
        return res.status(400).json({ message: validationError });
      }

      const updated = await SiteContent.findOneAndUpdate(
        { key },
        { $set: { value } },
        { new: true, upsert: true }
      );

      res.status(200).json({ key: updated.key, value: updated.value });
    } catch (error) {
      console.error("Error updating site content:", error);
      res.status(500).json({ message: "Server error" });
    }
  }
};

export default contentController;
