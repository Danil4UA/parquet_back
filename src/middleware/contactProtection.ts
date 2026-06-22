import { Request, Response, NextFunction } from "express";
import rateLimit from "express-rate-limit";

/**
 * Anti-spam protection for public contact/consultation endpoints.
 *
 * Layer 1 — honeypot: a hidden field (`website`) that real users never fill in.
 *   Bots auto-fill every input, so a non-empty value means it's a bot. We answer
 *   200 OK so the bot thinks it succeeded and doesn't adapt, but we drop the request.
 *
 * Layer 2 — rate limit by IP: caps how many submissions a single IP can make in
 *   a short window. Stops a bot hammering the endpoint.
 */

// Layer 1: honeypot
export const honeypot = (req: Request, res: Response, next: NextFunction) => {
  const trap = req.body?.website;
  if (typeof trap === "string" && trap.trim() !== "") {
    console.warn("[contact] honeypot triggered, dropping request from", req.ip);
    // Pretend success so the bot doesn't retry / adapt.
    res.status(200).json({ success: true });
    return;
  }
  next();
};

// Layer 2: rate limit by IP
export const contactRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 5, // max 5 submissions per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Слишком много запросов. Пожалуйста, попробуйте позже.",
  },
});
