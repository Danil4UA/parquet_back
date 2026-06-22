import mongoose, { Schema } from "mongoose";

export interface ICategoryRecommendation {
  fromCategory: string;
  recommends: string[];
}

const CategoryRecommendationSchema = new Schema<ICategoryRecommendation>(
  {
    // Source category (e.g. "Wood"). One document per category.
    fromCategory: { type: String, required: true, unique: true, index: true },
    // Categories recommended for the source category (e.g. ["Panels", "Cladding"]).
    recommends: { type: [String], default: [] }
  },
  { timestamps: true }
);

const CategoryRecommendation = mongoose.model<ICategoryRecommendation>(
  "CategoryRecommendation",
  CategoryRecommendationSchema
);

export default CategoryRecommendation;
