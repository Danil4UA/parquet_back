/**
 * Generates sample rooms with the image API and registers them as "try on a sample room" options.
 *   npm run visualizer:gen-samples            -> 3 default rooms
 *   npm run visualizer:gen-samples -- 2       -> only the first N
 */
// .env values win over anything inherited from the shell (e.g. a globally exported API key).
import dotenv from "dotenv";
dotenv.config({ override: true });
import mongoose from "mongoose";
import connectDB from "../config/db";
import { createSampleRoom } from "../services/visualizer";

const ROOMS = [
  "Photo of an empty modern living room in an Israeli apartment, taken with a phone from standing height, daylight from a large window, white walls, old plain grey ceramic tile floor clearly visible, a sofa against the wall, no people, no text.",
  "Photo of a bedroom taken with a phone, morning daylight, light walls, a bed with a grey blanket, a wooden nightstand, old beige ceramic tile floor clearly visible in the foreground, no people, no text.",
  "Photo of an empty room with a window and a white door, taken with a phone from the doorway, natural light, plain worn concrete-look tile floor filling the lower half of the frame, no furniture, no people, no text.",
];

const generate = async (prompt: string): Promise<Buffer> => {
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-1", prompt, size: "1536x1024", quality: "medium", output_format: "jpeg" }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${text.slice(0, 300)}`);
  return Buffer.from(JSON.parse(text).data[0].b64_json, "base64");
};

const main = async () => {
  const n = Number(process.argv[2] || ROOMS.length);
  await connectDB();
  for (const prompt of ROOMS.slice(0, n)) {
    const img = await generate(prompt);
    const doc = await createSampleRoom(img, { source: "cli" });
    console.log("sample:", doc.roomUrl);
  }
  await mongoose.disconnect();
};

main().catch((e) => { console.error(e); process.exit(1); });
