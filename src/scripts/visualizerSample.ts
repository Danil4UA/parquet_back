/**
 * Registers local photos as sample rooms (shown as "try on a sample room"):
 *   npm run visualizer:sample -- /path/room1.jpg /path/room2.jpg
 */
// .env values win over anything inherited from the shell (e.g. a globally exported API key).
import dotenv from "dotenv";
dotenv.config({ override: true });
import fs from "fs";
import mongoose from "mongoose";
import connectDB from "../config/db";
import { createSampleRoom } from "../services/visualizer";

const main = async () => {
  const files = process.argv.slice(2);
  if (!files.length) {
    console.error("usage: visualizer:sample <room1.jpg> [room2.jpg ...]");
    process.exit(1);
  }
  await connectDB();
  for (const file of files) {
    const doc = await createSampleRoom(fs.readFileSync(file), { source: "cli" });
    console.log("sample room:", doc.roomKey, doc.roomUrl);
  }
  await mongoose.disconnect();
};

main().catch((e) => { console.error(e); process.exit(1); });
