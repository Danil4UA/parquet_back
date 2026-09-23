/**
 * Numbers for the admin "Room visualizer" dashboard.
 * "Today" is the shop's calendar day (Asia/Jerusalem), not the server's.
 */
import RoomVisualization from "../../model/RoomVisualization";
import { countStoredCustomerImages, visualizerConfig } from "./index";
import { priceForModel } from "./pricing";
import { customerRendersToday, dailyLimit, ipLimit, ipWindowMs, limitsDisabled, topIps } from "./limits";
import { startOfTodayInShopTz } from "./time";

const DAY_MS = 24 * 60 * 60 * 1000;

export { startOfTodayInShopTz, customerRendersToday, dailyLimit };

interface Bucket { done: number; failed: number; costUsd: number }

const bucket = async (since?: Date): Promise<Bucket> => {
  const match: Record<string, unknown> = { status: { $in: ["done", "failed"] } };
  if (since) match.createdAt = { $gte: since };
  const rows = await RoomVisualization.aggregate<{ _id: string; n: number; cost: number }>([
    { $match: match },
    { $group: { _id: "$status", n: { $sum: 1 }, cost: { $sum: { $ifNull: ["$estimatedCostUsd", 0] } } } },
  ]);
  const by = new Map(rows.map((r) => [r._id, r]));
  return {
    done: by.get("done")?.n || 0,
    failed: by.get("failed")?.n || 0,
    costUsd: Math.round(((by.get("done")?.cost || 0) + (by.get("failed")?.cost || 0)) * 100) / 100,
  };
};

export const getVisualizerStats = async () => {
  const now = new Date();
  const todayStart = startOfTodayInShopTz(now);
  const config = visualizerConfig();

  const [today, last7d, last30d, allTime, samples, storedCustomerImages, avg, recentFailures, lastDone, lastHour, topIpsToday] = await Promise.all([
    bucket(todayStart),
    bucket(new Date(now.getTime() - 7 * DAY_MS)),
    bucket(new Date(now.getTime() - 30 * DAY_MS)),
    bucket(),
    RoomVisualization.countDocuments({ status: "room", isSample: true }),
    countStoredCustomerImages(),
    RoomVisualization.aggregate<{ ms: number }>([{ $match: { status: "done", durationMs: { $gt: 0 } } }, { $group: { _id: null, ms: { $avg: "$durationMs" } } }]),
    RoomVisualization.find({ status: "failed", acknowledged: { $ne: true } }).sort({ createdAt: -1 }).limit(8).select("createdAt error errorKind productId source isSample durationMs").lean(),
    RoomVisualization.findOne({ status: "done" }).sort({ createdAt: -1 }).select("createdAt").lean(),
    bucket(new Date(now.getTime() - 60 * 60 * 1000)),
    topIps(todayStart),
  ]);

  const todayUsed = today.done + today.failed;
  const attempts7d = last7d.done + last7d.failed;
  const successRate7d = attempts7d ? Math.round((last7d.done / attempts7d) * 100) : null;
  const avgCostUsd = allTime.done ? Math.round((allTime.costUsd / allTime.done) * 1000) / 1000 : null;

  const warnings: string[] = [];
  if (limitsDisabled()) warnings.push("All generation limits are OFF (VISUALIZER_SKIP_LIMITS=true). Fine for development, dangerous in production.");
  if (!process.env.OPENAI_API_KEY) warnings.push("OPENAI_API_KEY is not set — every generation will fail.");
  if (!priceForModel(config.model)) warnings.push(`No price known for model "${config.model}" — cost estimates will be empty.`);
  if (todayUsed >= dailyLimit()) warnings.push(`Daily limit reached (${todayUsed}/${dailyLimit()}). Shoppers see "try again tomorrow" until midnight.`);
  else if (todayUsed >= dailyLimit() * 0.8) warnings.push(`Daily limit almost reached (${todayUsed}/${dailyLimit()}).`);
  if (lastHour.failed >= 3 && lastHour.failed >= lastHour.done) warnings.push(`${lastHour.failed} failed generation(s) in the last hour — check the errors below.`);
  const heaviest = topIpsToday[0];
  if (heaviest && heaviest.count >= 10 && heaviest.count >= todayUsed * 0.3) {
    warnings.push(`One IP (${heaviest._id}) made ${heaviest.count} of today's ${todayUsed} generations — possible abuse. Per-IP limit is ${ipLimit()} per ${ipWindowMs() / 3600000}h.`);
  }
  if (storedCustomerImages > 0) warnings.push(`${storedCustomerImages} customer image record(s) from before the privacy change are still stored — use "Delete stored customer photos".`);

  return {
    today: { ...today, used: todayUsed, limit: dailyLimit() },
    last7d: { ...last7d, successRate: successRate7d },
    last30d,
    allTime: { ...allTime, avgCostUsd },
    avgDurationMs: Math.round(avg[0]?.ms || 0),
    samples,
    storedCustomerImages,
    lastSuccessAt: lastDone?.createdAt || null,
    lastFailureAt: recentFailures[0]?.createdAt || null,
    recentFailures,
    config,
    limits: { perIp: ipLimit(), perIpWindowHours: ipWindowMs() / 3600000, daily: dailyLimit() },
    topIpsToday,
    warnings,
  };
};
