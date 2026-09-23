/**
 * OpenAI Images Edit provider.
 * Sends the room photo as the first image and the product photo(s) as references,
 * asks the model to swap the floor. Uses Node's built-in fetch/FormData (Node 18+).
 *
 * Tuning (env):
 *   OPENAI_IMAGE_MODEL            gpt-image-1 (default) | gpt-image-1-mini (≈5x cheaper, lower quality)
 *   OPENAI_IMAGE_QUALITY          low | medium (default) | high
 *   OPENAI_IMAGE_INPUT_FIDELITY   high (default) | low — "high" keeps the room intact but costs more input tokens;
 *                                 only sent for models that support it.
 *   VISUALIZER_TIMEOUT_MS         default 120000
 */
import { IRenderUsage } from "../../../model/RoomVisualization";

export interface RenderInput {
  roomImage: Buffer;
  roomMime: string;
  referenceImages: { buffer: Buffer; mime: string }[];
  prompt: string;
}

export interface RenderOutput {
  image: Buffer;
  mime: string;
  provider: string;
  model: string;
  quality: string;
  usage?: IRenderUsage;
}

/** Thrown for errors the shopper caused (e.g. the safety filter rejected the photo). */
export class ProviderRejectedError extends Error {
  status = 422;
  kind = "rejected" as const;
}

const API_URL = "https://api.openai.com/v1/images/edits";

export const openAIConfig = () => ({
  model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-1",
  quality: process.env.OPENAI_IMAGE_QUALITY || "medium",
  inputFidelity: process.env.OPENAI_IMAGE_INPUT_FIDELITY || "high",
  timeoutMs: Number(process.env.VISUALIZER_TIMEOUT_MS || 120000),
});

// input_fidelity is only accepted by the full gpt-image-1 family, not the mini model.
const supportsInputFidelity = (model: string) => /^gpt-image-1(?!-mini)/.test(model);

const parseUsage = (usage: any): IRenderUsage | undefined => {
  if (!usage) return undefined;
  return {
    inputTextTokens: Number(usage.input_tokens_details?.text_tokens || 0),
    inputImageTokens: Number(usage.input_tokens_details?.image_tokens || 0),
    outputTokens: Number(usage.output_tokens || 0),
  };
};

export const renderWithOpenAI = async (input: RenderInput): Promise<RenderOutput> => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set");

  const { model, quality, inputFidelity, timeoutMs } = openAIConfig();

  const form = new FormData();
  form.append("model", model);
  form.append("prompt", input.prompt);
  form.append("quality", quality);
  form.append("size", "auto");
  form.append("output_format", "jpeg");
  if (supportsInputFidelity(model)) form.append("input_fidelity", inputFidelity);
  // First image = the room to edit, then references.
  form.append("image[]", new Blob([new Uint8Array(input.roomImage)], { type: input.roomMime }), "room.jpg");
  input.referenceImages.forEach((ref, i) => {
    form.append("image[]", new Blob([new Uint8Array(ref.buffer)], { type: ref.mime }), `floor-${i + 1}.jpg`);
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
      signal: controller.signal,
    });
    const text = await res.text();
    if (!res.ok) {
      if (res.status === 400 && /moderation|safety|content_policy/i.test(text)) {
        throw new ProviderRejectedError("The photo was rejected by the AI safety filter");
      }
      throw new Error(`OpenAI ${res.status}: ${text.slice(0, 500)}`);
    }
    const json = JSON.parse(text);
    const b64 = json?.data?.[0]?.b64_json;
    if (!b64) throw new Error("OpenAI returned no image");
    return { image: Buffer.from(b64, "base64"), mime: "image/jpeg", provider: "openai", model, quality, usage: parseUsage(json.usage) };
  } finally {
    clearTimeout(timeout);
  }
};
