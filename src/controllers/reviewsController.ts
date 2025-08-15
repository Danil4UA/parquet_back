import axios from "axios";
import { Request, Response } from "express";
import Utils from "../utils/utils";

class reviewsController {
    static getAllReviews = async (req: Request, res: Response): Promise<any> => {
        const { lng }= req.query ?? {};
        try{
            const {
                GOOGLE_API_KEY,
                GOOGLE_PLACE_ID,
            } = process.env;
            const url =`https://maps.googleapis.com/maps/api/place/details/json?place_id=${GOOGLE_PLACE_ID}&fields=name,rating,reviews,user_ratings_total&key=${GOOGLE_API_KEY}&language=${lng || "en"}`

            const response = await axios.get(url);

            if (response.data.status !== 'OK') {
                return res.status(400).json({ 
                    message: 'Failed to fetch reviews',
                    status: response.data.status 
                });
            }
            return res.json({
                name: response.data.result.name,
                rating: response.data.result.rating,
                total_reviews: response.data.result.user_ratings_total,
                reviews: response.data.result.reviews || []
            });
        } catch (error) {
            console.error('Error retrieving product:', error);
            res.status(500).json({ message: 'Server error' });
        }
    }
}

export default reviewsController
