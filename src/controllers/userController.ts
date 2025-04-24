import User from "../model/userModel"
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Request, Response } from 'express';

const userController = {
  register: async (req: Request, res: Response): Promise<any> => {
    try {
      const { username, password, email } = req.body;
      
      const existingUser = await User.findOne({ 
        $or: [{ email }, { username }] 
      });
      
      if (existingUser) {
        return res.status(400).json({ 
          message: "User with this email or username already exists" 
        });
      }
      
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);
      
      const newUser = new User({
        username,
        email,
        password: hashedPassword
      });
      
      await newUser.save();
      
      return res.status(201).json({ 
        message: "User registered successfully" 
      });
    } catch (error) {
      return res.status(500).json({ message: "Server error" });
    }
  },
  
  login: async (req: Request, res: Response): Promise<any> => {
    try {
      const { email, password } = req.body;
      
      const user = await User.findOne({ email });
      if (!user) {
        return res.status(401)
      }
      
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(401);
      }
      
      const accessToken = jwt.sign(
        { userId: user._id },
        process.env.JWT_SECRET || "",
        { expiresIn: '1h' }
      );
      
      const refreshToken = jwt.sign(
        { userId: user._id },
        process.env.JWT_REFRESH_SECRET || "",
        { expiresIn: '7d' }
      );
      
      res.status(200).json({
        accessToken,
        refreshToken,
        user: {
          id: user._id,
          username: user.username,
          email: user.email
        }
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Server error" });
    }
  },
  
  getUser: async (req: Request, res: Response): Promise<any> => {
    try {

      const token = req.headers.authorization?.split(" ")[1];
      
      if (!token) {
        return res.status(401).json({ message: "No token provided" });
      }
      
      const decoded: any = jwt.verify(token, process.env.JWT_SECRET || "");
      const user = await User.findById(decoded.userId).select("-password");
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.status(200).json(user);
    } catch (error) {
      console.error("Get user error:", error);
      res.status(401).json({ message: "Invalid token" });
    }
  },
  
  logout: async (req: Request, res: Response): Promise<any> => {
    try {
      const { refresh_token } = req.params;

      res.status(200).json({ message: "Logged out successfully" });
    } catch (error) {
      console.error("Logout error:", error);
      res.status(500).json({ message: "Server error" });
    }
  }
};

export default userController;