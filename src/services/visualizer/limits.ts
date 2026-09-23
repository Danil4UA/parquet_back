/**
 * Abuse protection for paid generations. Every generation costs real money, so the
 * limits are layered and persisted in MongoDB (the render records themselves), which
 * makes them survive restarts and work across several server instances.
 *
 *   1. One generation at a time per IP  — a spammer can't fire 30 requests in parallel.
 *   2. Per-IP rolling window            — VISUALIZER_IP_LIMIT (default 10) per
 *                                         VISUALIZER_IP_WINDOW_HOURS (default 6).
 *   3. Global daily budget              — VISUALIZER_DAILY_LIMIT (default 300) per shop day.
 *
 * A cheap express-rate-limit layer in the router still catches raw request floods
 * before any database work happens.
 */
import RoomVisualization from "../../model/RoomVisualization";
import { startOfTodayInShopTz } from "./time";

export type LimitCode = "busy" | "ip_limit" | "daily_limit";

export class RenderLimitError extends Error {
  status = 429;
  code: LimitCode;
  /** Seconds until the caller may try again (when known). */
  retryAfterSec?: number;

  constructor(code: LimitCode, message: string, retryAfterSec?: number) {
    super(message);
    this.code = code;
    this.retryAfterSec = retryAfterSec;
  }
}

export const dailyLimit = () => Number(process.env.VISUALIZER_DAILY_LIMIT || 300);

/** Development switch: VISUALIZER_SKIP_LIMITS=true turns every limit off. Never set it in production. */
export const limitsDisabled = () => process.env.VISUALIZER_SKIP_LIMITS === "true";

// Requests from the machine itself (local `npm run dev`) are never limited.
const isLoopback = (ip?: string) => !!ip && /^(127\.0\.0\.1|::1|::ffff:127\.0\.0\.1)$/.test(ip);

const paidStatuses = ["pending", "done", "failed"];

/** Paid customer generations started today (done + failed + in flight). Used for the daily budget. */
// Uploads rejected before reaching the AI (errorKind "image") cost nothing and don't count.
const paidFilter = { source: "customer", status: { $in: paidStatuses }, errorKind: { $ne: "image" } };

export const customerRendersToday = () =>
  RoomVisualization.countDocuments({ ...paidFilter, createdAt: { $gte: startOfTodayInShopTz() } });

export const ipLimit = () => Math.max(1, Number(process.env.VISUALIZER_IP_LIMIT || 10));
export const ipWindowMs = () => Math.max(0.1, Number(process.env.VISUALIZER_IP_WINDOW_HOURS || 6)) * 60 * 60 * 1000;

// A "pending" record older than this is a crashed/abandoned render, not a live one.
const IN_FLIGHT_MAX_AGE_MS = 3 * 60 * 1000;

/** Throws RenderLimitError when `ip` may not start a paid generation right now. */
export const assertCanRender = async (ip?: string): Promise<void> => {
  if (limitsDisabled() || isLoopback(ip)) return;
  if (ip) {
    const inFlight = await RoomVisualization.countDocuments({
      ip,
      source: "customer",
      status: "pending",
      createdAt: { $gte: new Date(Date.now() - IN_FLIGHT_MAX_AGE_MS) },
    });
    if (inFlight > 0) {
      throw new RenderLimitError("busy", "A preview is already being generated for you. Wait for it to finish.", 30);
    }

    const windowStart = new Date(Date.now() - ipWindowMs());
    const recent = await RoomVisualization.find({ ...paidFilter, ip, createdAt: { $gte: windowStart } })
      .sort({ createdAt: 1 })
      .select("createdAt")
      .lean();
    if (recent.length >= ipLimit()) {
      const oldest = recent[0].createdAt.getTime();
      const retryAfterSec = Math.max(60, Math.ceil((oldest + ipWindowMs() - Date.now()) / 1000));
      throw new RenderLimitError("ip_limit", "You have reached the preview limit for now. Please try again later.", retryAfterSec);
    }
  }

  if ((await customerRendersToday()) >= dailyLimit()) {
    throw new RenderLimitError("daily_limit", "Daily limit reached, try again tomorrow");
  }
};

/** IPs with the most paid generations since `since` (for the admin dashboard). */
export const topIps = async (since: Date, limit = 5) =>
  RoomVisualization.aggregate<{ _id: string; count: number; failed: number }>([
    { $match: { ...paidFilter, createdAt: { $gte: since }, ip: { $exists: true, $ne: null } } },
    { $group: { _id: "$ip", count: { $sum: 1 }, failed: { $sum: { $cond: [{ $eq: ["$status", "failed"] }, 1, 0] } } } },
    { $sort: { count: -1 } },
    { $limit: limit },
  ]);
