import express from "express";
import "dotenv/config";
import cors from "cors";
import connectDB from "./config/db";
import productsRoutes from "./routes/productsRoutes";
import orderRoutes from "./routes/orderRoutes";
connectDB();
const app = express();
const PORT = process.env.PORT;

app.use(express.json());
app.use(
  cors({
    credentials: true,
    origin: (origin, callback) => {
      const allowedOrigins = [process.env.FRONT_URL_RENDER, process.env.FRONT_URL_CUSTOM];

      if (allowedOrigins.includes(origin) || !origin) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    }
  })
);

app.use("/api/products", productsRoutes);
app.use("/api/order", orderRoutes);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
