import mongoose from "mongoose";
import "dotenv/config";

const connectDB = async () => {
  try {
    const uri = `mongodb+srv://${process.env.USERNAME_DB}:${process.env.PASSWORD_DB}@cluster0.ueird.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
    const conn = await mongoose.connect(uri);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Error: ${error}`);
    process.exit(1);
  }
};

export default connectDB;
