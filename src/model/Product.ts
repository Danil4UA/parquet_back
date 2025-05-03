import mongoose, { Schema, Document } from "mongoose";

export interface LocalizedString {
  en: string;
  ru: string;
  he: string;
}
export interface IProductSchema {
  productId: string;
  name: LocalizedString;
  description: LocalizedString;
  detailedDescription: LocalizedString;
  price: number;
  images: string[];
  category: string;
  stock: number;
  discount: number;
  isAvailable: boolean;
  color: string;
  type: string;
  material: string;
  countryOfOrigin: string;
  boxCoverage?: number;   
  model?: string;        
  finish?: string;       
  width?: number;        
  length?: number;       
  thickness?: number;    
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
    detailedDescription: {
      type: LocalizedStringSchema,
      require: true
    },
    price: { type: Number, required: true },
    images: { type: [String], required: true },
    category: { type: String, required: true },
    stock: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    isAvailable: { type: Boolean, default: true },
    color: { type: String, required: true },
    type: { type: String, required: true },
    material: { type: String, required: false },
    countryOfOrigin: { type: String, required: false },
    boxCoverage: { type: Number, required: false },
    model: { type: String, required: true },
    finish: { type: String, required: false },
    width: { type: Number, required: false },
    length: { type: Number, required: false },
    thickness: { type: Number, required: false }
  },
  { timestamps: true }
);

const Product = mongoose.model<IProductSchema>("Product", ProductSchema);

export default Product;
