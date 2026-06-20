import mongoose, { Schema } from "mongoose";

export interface IReview {
  author_name: string;
  author_url: string;
  language: string;
  original_language: string;
  profile_photo_url: string;
  rating: number;
  relative_time_description: string;
  text: string;
  time: number;
  translated: boolean;
}

export interface IReviewsSnapshot {
  lng: string;
  name: string;
  rating: number;
  total_reviews: number;
  reviews: IReview[];
  fetchedAt: Date;
}

const ReviewSchema = new Schema<IReview>(
  {
    author_name: { type: String },
    author_url: { type: String },
    language: { type: String },
    original_language: { type: String },
    profile_photo_url: { type: String },
    rating: { type: Number },
    relative_time_description: { type: String },
    text: { type: String },
    time: { type: Number },
    translated: { type: Boolean }
  },
  { _id: false }
);

const ReviewsSnapshotSchema = new Schema<IReviewsSnapshot>(
  {
    lng: { type: String, required: true, unique: true, index: true },
    name: { type: String },
    rating: { type: Number },
    total_reviews: { type: Number },
    reviews: { type: [ReviewSchema], default: [] },
    fetchedAt: { type: Date, default: () => new Date() }
  },
  { timestamps: true }
);

const ReviewsSnapshot = mongoose.model<IReviewsSnapshot>("ReviewsSnapshot", ReviewsSnapshotSchema);

export default ReviewsSnapshot;
