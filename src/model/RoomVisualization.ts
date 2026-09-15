import mongoose, { Schema, Document } from "mongoose";

/**
 * One "room" = one uploaded customer photo or an admin-managed sample room.
 * One "render" = that room with a specific product's floor applied.
 * Nothing expires automatically; admins manage everything from the dashboard.
 */
export interface IRoomVisualization extends Document {
  roomKey: string;          // S3 key of the prepared room photo
  roomUrl: string;
  isSample: boolean;
  isActive: boolean;        // samples only: shown to shoppers when true
  title?: string;           // samples only: admin label
  productId?: string;
  resultKey?: string;
  resultUrl?: string;
  provider?: string;
  aiModel?: string;
  status: "room" | "pending" | "done" | "failed";
  error?: string;
  durationMs?: number;
  ip?: string;
  source?: "customer" | "admin" | "cli";
  createdAt: Date;
  updatedAt: Date;
}

const RoomVisualizationSchema = new Schema<IRoomVisualization>(
  {
    roomKey: { type: String, required: true, index: true },
    roomUrl: { type: String, required: true },
    isSample: { type: Boolean, default: false, index: true },
    isActive: { type: Boolean, default: true },
    title: { type: String },
    productId: { type: String, index: true },
    resultKey: { type: String },
    resultUrl: { type: String },
    provider: { type: String },
    aiModel: { type: String },
    status: { type: String, enum: ["room", "pending", "done", "failed"], default: "room", index: true },
    error: { type: String },
    durationMs: { type: Number },
    ip: { type: String },
    source: { type: String, enum: ["customer", "admin", "cli"], default: "customer" },
  },
  { timestamps: true }
);

RoomVisualizationSchema.index({ roomKey: 1, productId: 1 });

export default mongoose.model<IRoomVisualization>("RoomVisualization", RoomVisualizationSchema);
