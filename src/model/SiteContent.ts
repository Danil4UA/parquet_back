import mongoose, { Schema } from "mongoose";

// Named content slots editable from the admin panel,
// e.g. key: "hero_slider" -> value: ["https://...jpg", ...]
//      key: "category_images" -> value: { SPC: "https://...jpg", ... }
const SiteContentSchema = new Schema(
  {
    key: { type: String, required: true, unique: true },
    value: { type: Schema.Types.Mixed, default: null }
  },
  { timestamps: true }
);

const SiteContent = mongoose.model("SiteContent", SiteContentSchema);

export default SiteContent;
