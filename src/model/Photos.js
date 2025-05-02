const mongoose = require("mongoose");
const { Schema } = mongoose;

const FileSizeSchema = new Schema({
  original: { type: Number, required: true },
  optimized: { type: Number, required: true },
  savedPercent: { type: String, required: true }
}, { _id: false });

const PhotoSchema = new Schema({
  file_url: { type: String, required: true },
  original_filename: { type: String, required: true },
  file_name: { type: String, required: true, unique: true },
  content_type: { type: String, required: true },
  file_size: { type: FileSizeSchema, required: true },
  uploaded_at: { type: Date, default: Date.now },
  status: { type: String, default: 'active', enum: ['active', 'deleted', 'processing'] },
  product_id: { type: Schema.Types.ObjectId, ref: 'Products' },
  entity_type: { type: String },
  entity_id: { type: Schema.Types.ObjectId, refPath: 'entity_type' }
}, { timestamps: true });

PhotoSchema.index({ product_id: 1 });
PhotoSchema.index({ file_name: 1 });
PhotoSchema.index({ entity_type: 1, entity_id: 1 });
PhotoSchema.index({ status: 1 });

const Photos = mongoose.model("Photos", PhotoSchema);

module.exports = Photos; 