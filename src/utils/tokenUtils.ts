import jwt from "jsonwebtoken";
import crypto from "crypto";

export const ACCESS_TOKEN_TTL = "15m";
export const ACCESS_TOKEN_TTL_MS = 15 * 60 * 1000;
export const REFRESH_TOKEN_TTL = "30d";
export const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

// Maximum stored refresh tokens per user (= concurrent sessions/devices)
export const MAX_REFRESH_TOKENS_PER_USER = 5;

// After rotation the old refresh token stays valid for a short window so
// concurrent requests refreshing at the same moment don't trip reuse detection
export const REFRESH_ROTATION_GRACE_MS = 60 * 1000;

const getSecret = (name: "JWT_SECRET" | "JWT_REFRESH_SECRET"): string => {
  const secret = process.env[name];
  if (!secret) {
    throw new Error(`${name} is not configured`);
  }
  return secret;
};

export const generateAccessToken = (userId: string): string => {
  return jwt.sign({ userId }, getSecret("JWT_SECRET"), {
    expiresIn: ACCESS_TOKEN_TTL
  });
};

export const generateRefreshToken = (userId: string): string => {
  return jwt.sign({ userId }, getSecret("JWT_REFRESH_SECRET"), {
    expiresIn: REFRESH_TOKEN_TTL
  });
};

export const verifyRefreshToken = (token: string): { userId: string } => {
  return jwt.verify(token, getSecret("JWT_REFRESH_SECRET")) as { userId: string };
};

// Refresh tokens are high-entropy JWTs, so a fast sha256 is enough for storage
export const hashToken = (token: string): string => {
  return crypto.createHash("sha256").update(token).digest("hex");
};
