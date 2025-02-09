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
    origin: [
      `${
        process.env.FRONT_URL
        // ||
        // "http://localhost:3000"
      }`
    ]
  })
);

app.use("/api/products", productsRoutes);
app.use("/api/order", orderRoutes);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
