import mongoose, { Schema, Document } from "mongoose";

/**
 * Two kinds of records live here:
 *
 *  - status "room": an admin-managed sample room (photo stored in S3). Shoppers can
 *    pick it instead of uploading their own photo.
 *  - status "pending" | "done" | "failed": one render attempt (a room + a product).
 *
 * Renders of a *sample* room keep their result in S3 so the same (room, product)
 * pair is never paid for twice.
 *
 * Renders of a *customer photo* store NO images at all (privacy): the photo is
 * processed in memory, the result goes straight back to the shopper, and only the
 * statistics below are kept (status, duration, token usage, estimated cost, error).
 * Such records have neither roomKey/roomUrl nor resultKey/resultUrl.
 */
export type RenderErrorKind = "provider" | "timeout" | "image" | "rejected" | "internal";

export interface IRenderUsage {
  inputTextTokens: number;
  inputImageTokens: number;
  outputTokens: number;
}

export interface IRoomVisualization extends Document {
  roomKey?: string;          // S3 key of the prepared room photo (samples only)
  roomUrl?: string;
  isSample: boolean;
  isActive: boolean;         // samples only: shown to shoppers when true
  title?: string;            // samples only: admin label
  productId?: string;
  resultKey?: string;        // sample renders only
  resultUrl?: string;
  provider?: string;
  aiModel?: string;
  quality?: string;
  status: "room" | "pending" | "done" | "failed";
  error?: string;
  errorKind?: RenderErrorKind;
  acknowledged?: boolean;    // failed renders: admin dismissed the error from the dashboard
  durationMs?: number;
  usage?: IRenderUsage;
  estimatedCostUsd?: number;
  ip?: string;
  source?: "customer" | "admin" | "cli";
  createdAt: Date;
  updatedAt: Date;
}

const RoomVisualizationSchema = new Schema<IRoomVisualization>(
  {
    roomKey: { type: String, index: true },
    roomUrl: { type: String },
    isSample: { type: Boolean, default: false, index: true },
    isActive: { type: Boolean, default: true },
    title: { type: String },
    productId: { type: String, index: true },
    resultKey: { type: String },
    resultUrl: { type: String },
    provider: { type: String },
    aiModel: { type: String },
    quality: { type: String },
    status: { type: String, enum: ["room", "pending", "done", "failed"], default: "room", index: true },
    error: { type: String },
    errorKind: { type: String, enum: ["provider", "timeout", "image", "rejected", "internal"] },
    acknowledged: { type: Boolean, default: false },
    durationMs: { type: Number },
    usage: {
      type: new Schema<IRenderUsage>(
        {
          inputTextTokens: { type: Number, default: 0 },
          inputImageTokens: { type: Number, default: 0 },
          outputTokens: { type: Number, default: 0 },
        },
        { _id: false }
      ),
    },
    estimatedCostUsd: { type: Number },
    ip: { type: String },
    source: { type: String, enum: ["customer", "admin", "cli"], default: "customer" },
  },
  { timestamps: true }
);

RoomVisualizationSchema.index({ roomKey: 1, productId: 1 });
// Stats and "recent failures" queries.
RoomVisualizationSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model<IRoomVisualization>("RoomVisualization", RoomVisualizationSchema);
