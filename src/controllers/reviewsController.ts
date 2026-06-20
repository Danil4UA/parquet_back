import axios from "axios";
import { Request, Response } from "express";
import ReviewsSnapshot, { IReviewsSnapshot } from "../model/Review";

// How long a cached snapshot is considered fresh before we refresh it from Google.
// Defaults to 7 days. Can be overridden via REVIEWS_CACHE_TTL_HOURS.
const CACHE_TTL_MS = (Number(process.env.REVIEWS_CACHE_TTL_HOURS) || 24 * 7) * 60 * 60 * 1000;

type GoogleSnapshot = Pick<IReviewsSnapshot, "name" | "rating" | "total_reviews" | "reviews">;

class reviewsController {
    // Fetches the latest reviews straight from the Google Places API.
    private static fetchFromGoogle = async (lng: string): Promise<GoogleSnapshot> => {
        const { GOOGLE_API_KEY, GOOGLE_PLACE_ID } = process.env;
        const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${GOOGLE_PLACE_ID}&fields=name,rating,reviews,user_ratings_total&key=${GOOGLE_API_KEY}&language=${lng}`;

        const response = await axios.get(url);

        if (response.data.status !== "OK") {
            throw new Error(`Google Places API returned status: ${response.data.status}`);
        }

        return {
            name: response.data.result.name,
            rating: response.data.result.rating,
            total_reviews: response.data.result.user_ratings_total,
            reviews: response.data.result.reviews || []
        };
    };

    // Fetches from Google and upserts the snapshot for the given language into our DB.
    private static refreshSnapshot = async (lng: string): Promise<IReviewsSnapshot> => {
        console.log(`[reviews] Calling GOOGLE Places API for lng="${lng}"...`);
        const fresh = await reviewsController.fetchFromGoogle(lng);
        const snapshot = await ReviewsSnapshot.findOneAndUpdate(
            { lng },
            { ...fresh, lng, fetchedAt: new Date() },
            { new: true, upsert: true }
        );
        console.log(`[reviews] Saved snapshot to DB for lng="${lng}" (${snapshot.reviews.length} reviews)`);
        return snapshot;
    };

    // Public endpoint used by the site. Serves reviews from our DB and only calls
    // Google when the cache is missing or stale. Google is a fallback, not the
    // per-request source of truth.
    static getAllReviews = async (req: Request, res: Response): Promise<any> => {
        const lng = (req.query?.lng as string) || "en";

        try {
            const cached = await ReviewsSnapshot.findOne({ lng });
            const ageMs = cached ? Date.now() - new Date(cached.fetchedAt).getTime() : null;
            const isFresh = cached && ageMs! < CACHE_TTL_MS;

            console.log(
                `[reviews] GET lng="${lng}" | cached=${!!cached} | ` +
                `ageHours=${ageMs !== null ? (ageMs / 3600000).toFixed(1) : "n/a"} | ` +
                `ttlHours=${(CACHE_TTL_MS / 3600000).toFixed(1)} | fresh=${!!isFresh}`
            );

            if (cached && isFresh) {
                console.log(`[reviews] -> Served from DB cache (no Google call) for lng="${lng}"`);
                return res.json({
                    name: cached.name,
                    rating: cached.rating,
                    total_reviews: cached.total_reviews,
                    reviews: cached.reviews
                });
            }

            // Cache is missing or stale — try to refresh from Google.
            console.log(`[reviews] Cache ${cached ? "STALE" : "MISSING"} for lng="${lng}", refreshing from Google...`);
            try {
                const refreshed = await reviewsController.refreshSnapshot(lng);
                console.log(`[reviews] -> Served FRESH data from Google for lng="${lng}"`);
                return res.json({
                    name: refreshed.name,
                    rating: refreshed.rating,
                    total_reviews: refreshed.total_reviews,
                    reviews: refreshed.reviews
                });
            } catch (googleError) {
                console.error("Failed to refresh reviews from Google:", googleError);

                // Fall back to the stale cache if we have one, so the site never
                // breaks just because Google is unavailable or rate-limited.
                if (cached) {
                    console.log(`[reviews] -> Google failed, served STALE DB cache as fallback for lng="${lng}"`);
                    return res.json({
                        name: cached.name,
                        rating: cached.rating,
                        total_reviews: cached.total_reviews,
                        reviews: cached.reviews
                    });
                }

                return res.status(502).json({ message: "Failed to fetch reviews" });
            }
        } catch (error) {
            console.error("Error retrieving reviews:", error);
            res.status(500).json({ message: "Server error" });
        }
    };

    // Admin-triggered force refresh from Google for the given language (or "en").
    static refreshReviews = async (req: Request, res: Response): Promise<any> => {
        const lng = (req.query?.lng as string) || "en";

        try {
            const refreshed = await reviewsController.refreshSnapshot(lng);
            return res.json({
                message: "Reviews refreshed",
                lng,
                fetchedAt: refreshed.fetchedAt,
                total_reviews: refreshed.total_reviews,
                reviews_count: refreshed.reviews.length
            });
        } catch (error) {
            console.error("Error refreshing reviews:", error);
            res.status(502).json({ message: "Failed to refresh reviews from Google" });
        }
    };
}

export default reviewsController;
