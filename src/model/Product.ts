import mongoose, { Schema, Document } from "mongoose";

export interface LocalizedString {
  en: string;
  ru: string;
  he: string;
}
export interface IProduct extends Document {
  productId: string;
  name: LocalizedString;
  description: LocalizedString;
  price: string;
  images: string[];
  category: string;
  stock: number;
  discount: number;
  isAvailable: boolean;
  color: string;
  type: string;
  material: string;
  countryOfOrigin: string;
}

const LocalizedStringSchema = {
  en: { type: String, required: true },
  ru: { type: String, required: true },
  he: { type: String, required: true }
};

const ProductSchema: Schema = new Schema(
  {
    name: {
      type: LocalizedStringSchema,
      required: true
    },
    description: {
      type: LocalizedStringSchema,
      required: true
    },
    price: { type: String, required: true },
    images: { type: [String], required: true },
    category: { type: String, required: true },
    stock: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    isAvailable: { type: Boolean, default: true },
    color: { type: String, required: true },
    type: { type: String, required: true },
    material: { type: String, required: true },
    countryOfOrigin: { type: String, required: true }
  },
  { timestamps: true }
);

const Product = mongoose.model<IProduct>("Product", ProductSchema);

export default Product;
