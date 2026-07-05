import User from "../model/userModel"
import bcrypt from "bcryptjs";
import { Request, Response } from 'express';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  hashToken,
  ACCESS_TOKEN_TTL_MS,
  REFRESH_TOKEN_TTL_MS,
  MAX_REFRESH_TOKENS_PER_USER,
  REFRESH_ROTATION_GRACE_MS
} from "../utils/tokenUtils";

interface AuthRequest extends Request {
  user?: { userId: string };
}

const issueTokens = async (user: InstanceType<typeof User>, oldTokenHash?: string) => {
  const accessToken = generateAccessToken(user._id.toString());
  const refreshToken = generateRefreshToken(user._id.toString());

  const now = Date.now();
  let tokens = user.refreshTokens
    .filter(t => t.expiresAt.getTime() > now)
    .map(t => ({
      tokenHash: t.tokenHash,
      // The rotated-out token keeps a short grace window instead of dying instantly
      expiresAt: t.tokenHash === oldTokenHash
        ? new Date(Math.min(t.expiresAt.getTime(), now + REFRESH_ROTATION_GRACE_MS))
        : t.expiresAt,
      createdAt: t.createdAt
    }));

  tokens.push({
    tokenHash: hashToken(refreshToken),
    expiresAt: new Date(now + REFRESH_TOKEN_TTL_MS),
    createdAt: new Date(now)
  });

  // Cap concurrent sessions — drop the oldest ones
  if (tokens.length > MAX_REFRESH_TOKENS_PER_USER) {
    tokens = tokens
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, MAX_REFRESH_TOKENS_PER_USER);
  }

  user.set("refreshTokens", tokens);

  await user.save();

  return {
    accessToken,
    accessTokenExpires: now + ACCESS_TOKEN_TTL_MS,
    refreshToken
  };
};

const userController = {
  register: async (req: Request, res: Response): Promise<any> => {
    try {
      const { username, password, email } = req.body;

      if (!username || !password || !email) {
        return res.status(400).json({ message: "Username, email and password are required" });
      }

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
      console.error("Register error:", error);
      return res.status(500).json({ message: "Server error" });
    }
  },

  login: async (req: Request, res: Response): Promise<any> => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }

      const user = await User.findOne({ email });
      if (!user) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      const tokens = await issueTokens(user);

      res.status(200).json({
        ...tokens,
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

  refresh: async (req: Request, res: Response): Promise<any> => {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(400).json({ message: "Refresh token is required" });
      }

      let payload: { userId: string };
      try {
        payload = verifyRefreshToken(refreshToken);
      } catch {
        return res.status(401).json({ message: "Invalid refresh token", code: "INVALID_REFRESH_TOKEN" });
      }

      const user = await User.findById(payload.userId);
      if (!user) {
        return res.status(401).json({ message: "Invalid refresh token", code: "INVALID_REFRESH_TOKEN" });
      }

      const tokenHash = hashToken(refreshToken);
      const storedToken = user.refreshTokens.find(t => t.tokenHash === tokenHash);

      if (!storedToken) {
        // Valid JWT that is not in the store — likely a stolen/reused token.
        // Revoke every session for this user as a precaution.
        user.set("refreshTokens", []);
        await user.save();
        return res.status(401).json({ message: "Invalid refresh token", code: "INVALID_REFRESH_TOKEN" });
      }

      if (storedToken.expiresAt.getTime() <= Date.now()) {
        return res.status(401).json({ message: "Refresh token expired", code: "INVALID_REFRESH_TOKEN" });
      }

      const tokens = await issueTokens(user, tokenHash);

      res.status(200).json(tokens);
    } catch (error) {
      console.error("Refresh error:", error);
      res.status(500).json({ message: "Server error" });
    }
  },

  getUser: async (req: Request, res: Response): Promise<any> => {
    try {
      const userId = (req as AuthRequest).user?.userId;

      const user = await User.findById(userId).select("-password -refreshTokens");

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      res.status(200).json(user);
    } catch (error) {
      console.error("Get user error:", error);
      res.status(500).json({ message: "Server error" });
    }
  },

  logout: async (req: Request, res: Response): Promise<any> => {
    try {
      const { refreshToken } = req.body;

      if (refreshToken) {
        try {
          const payload = verifyRefreshToken(refreshToken);
          const tokenHash = hashToken(refreshToken);
          await User.updateOne(
            { _id: payload.userId },
            { $pull: { refreshTokens: { tokenHash } } }
          );
        } catch {
          // Expired/invalid token — nothing to revoke
        }
      }

      res.status(200).json({ message: "Logged out successfully" });
    } catch (error) {
      console.error("Logout error:", error);
      res.status(500).json({ message: "Server error" });
    }
  }
};

export default userController;
