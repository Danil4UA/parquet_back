/**
 * Cost estimate for one image generation, from the token usage OpenAI returns.
 *
 * Prices are USD per 1M tokens. They are a snapshot of OpenAI's public price list
 * and should be checked against https://openai.com/api/pricing/ from time to time.
 * Override with VISUALIZER_PRICES_JSON, e.g.
 *   {"gpt-image-1":{"textIn":5,"imageIn":10,"imageOut":40}}
 */
import { IRenderUsage } from "../../model/RoomVisualization";

interface ModelPrice {
  textIn: number;
  imageIn: number;
  imageOut: number;
}

const DEFAULT_PRICES: Record<string, ModelPrice> = {
  "gpt-image-1": { textIn: 5, imageIn: 10, imageOut: 40 },
  "gpt-image-1-mini": { textIn: 2, imageIn: 2.5, imageOut: 8 },
};

const loadPrices = (): Record<string, ModelPrice> => {
  const raw = process.env.VISUALIZER_PRICES_JSON;
  if (!raw) return DEFAULT_PRICES;
  try {
    return { ...DEFAULT_PRICES, ...(JSON.parse(raw) as Record<string, ModelPrice>) };
  } catch {
    console.warn("[visualizer] VISUALIZER_PRICES_JSON is not valid JSON, using defaults");
    return DEFAULT_PRICES;
  }
};

export const priceForModel = (model: string): ModelPrice | undefined => {
  const prices = loadPrices();
  if (prices[model]) return prices[model];
  // "gpt-image-1-2025-04-15" style ids fall back to their base name; the longest prefix wins
  // so "gpt-image-1-mini-…" is not mistaken for "gpt-image-1".
  const base = Object.keys(prices)
    .filter((key) => model.startsWith(`${key}-`))
    .sort((a, b) => b.length - a.length)[0];
  return base ? prices[base] : undefined;
};

/** Returns the estimated cost in USD, or undefined when the model's price is unknown. */
export const estimateCostUsd = (model: string, usage: IRenderUsage | undefined): number | undefined => {
  const price = priceForModel(model);
  if (!price || !usage) return undefined;
  const usd =
    (usage.inputTextTokens * price.textIn + usage.inputImageTokens * price.imageIn + usage.outputTokens * price.imageOut) /
    1_000_000;
  return Math.round(usd * 10_000) / 10_000;
};
