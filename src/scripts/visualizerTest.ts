/**
 * Local quality check without the UI:
 *   npm run visualizer:test -- /path/to/room.jpg <productId> [out.jpg]
 * Sends the photo through the same pipeline the API uses and writes the result next to it.
 */
// .env values win over anything inherited from the shell (e.g. a globally exported API key).
import dotenv from "dotenv";
dotenv.config({ override: true });
import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import connectDB from "../config/db";
import { createRoom, renderRoom } from "../services/visualizer";

const main = async () => {
  const [roomPath, productId, outPath] = process.argv.slice(2);
  if (!roomPath || !productId) {
    console.error("usage: visualizer:test <room.jpg> <productId> [out.jpg]");
    process.exit(1);
  }
  await connectDB();
  const room = await createRoom(fs.readFileSync(roomPath), { source: "cli" });
  console.log("room uploaded:", room.roomUrl);
  const started = Date.now();
  const result = await renderRoom(room.roomKey, productId, { source: "cli" });
  console.log(`rendered in ${((Date.now() - started) / 1000).toFixed(1)}s:`, result.resultUrl);
  const target = outPath || path.join(path.dirname(roomPath), `${path.basename(roomPath, path.extname(roomPath))}-${productId}.jpg`);
  const res = await fetch(result.resultUrl!);
  fs.writeFileSync(target, Buffer.from(await res.arrayBuffer()));
  console.log("saved:", target);
  await mongoose.disconnect();
};

main().catch((e) => { console.error(e); process.exit(1); });
