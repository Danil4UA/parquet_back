/**
 * OpenAI Images Edit provider.
 * Sends the room photo as the first image and the product photo(s) as references,
 * asks the model to swap the floor. Uses Node's built-in fetch/FormData (Node 18+).
 */
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
}

const API_URL = "https://api.openai.com/v1/images/edits";

export const renderWithOpenAI = async (input: RenderInput): Promise<RenderOutput> => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set");

  const model = process.env.OPENAI_IMAGE_MODEL || "gpt-image-1";
  const quality = process.env.OPENAI_IMAGE_QUALITY || "medium";

  const form = new FormData();
  form.append("model", model);
  form.append("prompt", input.prompt);
  form.append("quality", quality);
  form.append("size", "auto");
  form.append("output_format", "jpeg");
  form.append("input_fidelity", "high");
  // First image = the room to edit, then references.
  form.append("image[]", new Blob([new Uint8Array(input.roomImage)], { type: input.roomMime }), "room.jpg");
  input.referenceImages.forEach((ref, i) => {
    form.append("image[]", new Blob([new Uint8Array(ref.buffer)], { type: ref.mime }), `floor-${i + 1}.jpg`);
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(process.env.VISUALIZER_TIMEOUT_MS || 120000));
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
      signal: controller.signal,
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`OpenAI ${res.status}: ${text.slice(0, 500)}`);
    }
    const json = JSON.parse(text);
    const b64 = json?.data?.[0]?.b64_json;
    if (!b64) throw new Error("OpenAI returned no image");
    return { image: Buffer.from(b64, "base64"), mime: "image/jpeg", provider: "openai", model };
  } finally {
    clearTimeout(timeout);
  }
};
