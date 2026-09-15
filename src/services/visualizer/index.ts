import sharp from "sharp";
import { PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { v4 as uuidv4 } from "uuid";
import s3Client from "../../config/s3";
import Product from "../../model/Product";
import RoomVisualization, { IRoomVisualization } from "../../model/RoomVisualization";
import { buildFloorPrompt } from "./prompt";
import { renderWithOpenAI, RenderOutput } from "./providers/openaiProvider";

const ROOM_MAX_SIDE = Number(process.env.VISUALIZER_ROOM_MAX_SIDE || 1536);
const REF_MAX_SIDE = 1024;
const BUCKET = process.env.AWS_S3_BUCKET || "";
const REGION = process.env.AWS_REGION || "";

type Source = "customer" | "admin" | "cli";

const s3Url = (key: string) => `https://${BUCKET}.s3.${REGION}.amazonaws.com/${key}`;

const putObject = async (key: string, body: Buffer, contentType: string) => {
  await s3Client.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: body, ContentType: contentType }));
  return s3Url(key);
};

const deleteObject = async (key?: string) => {
  if (!key) return;
  try {
    await s3Client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
  } catch (e) {
    console.warn("[visualizer] cannot delete", key, e);
  }
};

/** Raw S3 stream for proxied downloads (the bucket has no CORS, so the browser can't fetch it directly). */
export const getObjectStream = async (key: string) => {
  const res = await s3Client.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
  return { body: res.Body as NodeJS.ReadableStream, contentType: res.ContentType || "image/jpeg", contentLength: res.ContentLength };
};

const getObject = async (key: string): Promise<Buffer> => {
  const res = await s3Client.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
  const bytes = await res.Body!.transformToByteArray();
  return Buffer.from(bytes);
};

const fetchBuffer = async (url: string): Promise<{ buffer: Buffer; mime: string }> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Cannot download ${url}: ${res.status}`);
  const mime = res.headers.get("content-type") || "image/jpeg";
  return { buffer: Buffer.from(await res.arrayBuffer()), mime };
};

/** Normalises a photo: fixes EXIF rotation, caps the size, re-encodes as JPEG. */
export const prepareRoomImage = async (input: Buffer): Promise<Buffer> =>
  sharp(input).rotate().resize({ width: ROOM_MAX_SIDE, height: ROOM_MAX_SIDE, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 88 }).toBuffer();

const prepareReference = async (input: Buffer): Promise<Buffer> =>
  sharp(input).rotate().resize({ width: REF_MAX_SIDE, height: REF_MAX_SIDE, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 88 }).toBuffer();

/** Stores a prepared room photo and registers it. */
export const createRoom = async (file: Buffer, opts: { ip?: string; isSample?: boolean; title?: string; source?: Source } = {}) => {
  const prepared = await prepareRoomImage(file);
  const roomKey = `${opts.isSample ? "rooms/samples" : "rooms"}/${uuidv4()}.jpg`;
  const roomUrl = await putObject(roomKey, prepared, "image/jpeg");
  return RoomVisualization.create({
    roomKey,
    roomUrl,
    isSample: !!opts.isSample,
    isActive: true,
    title: opts.title,
    status: "room",
    ip: opts.ip,
    source: opts.source || "customer",
  });
};

/** Text-to-image for sample rooms (admin tool). */
export const generateSampleImage = async (prompt: string): Promise<Buffer> => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set");
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-1", prompt, size: "1536x1024", quality: process.env.OPENAI_IMAGE_QUALITY || "medium", output_format: "jpeg" }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${text.slice(0, 300)}`);
  return Buffer.from(JSON.parse(text).data[0].b64_json, "base64");
};

export const DEFAULT_SAMPLE_PROMPT =
  "Photo of an empty modern living room in an Israeli apartment, taken with a phone from standing height, daylight from a large window, white walls, old plain grey ceramic tile floor clearly visible, a sofa against the wall, no people, no text.";

const providers: Record<string, (i: Parameters<typeof renderWithOpenAI>[0]) => Promise<RenderOutput>> = {
  openai: renderWithOpenAI,
};

/** Renders a product floor into a room. Cached per (room, product) unless `force`. */
export const renderRoom = async (roomKey: string, productId: string, opts: { ip?: string; source?: Source; force?: boolean } = {}): Promise<IRoomVisualization> => {
  if (!opts.force) {
    const cached = await RoomVisualization.findOne({ roomKey, productId, status: "done" });
    if (cached) return cached;
  }

  const room = await RoomVisualization.findOne({ roomKey, status: "room" });
  if (!room) throw Object.assign(new Error("Room not found"), { status: 404 });

  const product = await Product.findById(productId);
  if (!product) throw Object.assign(new Error("Product not found"), { status: 404 });

  const providerName = process.env.VISUALIZER_PROVIDER || "openai";
  const render = providers[providerName];
  if (!render) throw new Error(`Unknown visualizer provider: ${providerName}`);

  const record = await RoomVisualization.create({
    roomKey,
    roomUrl: room.roomUrl,
    isSample: room.isSample,
    productId,
    provider: providerName,
    status: "pending",
    ip: opts.ip,
    source: opts.source || "customer",
  });

  const started = Date.now();
  try {
    const [roomImage, ...refs] = await Promise.all([
      getObject(roomKey),
      ...product.images.slice(0, 2).map((url: string) => fetchBuffer(url)),
    ]);
    const referenceImages = await Promise.all(
      (refs as { buffer: Buffer; mime: string }[]).map(async (r) => ({ buffer: await prepareReference(r.buffer), mime: "image/jpeg" }))
    );
    const prompt = buildFloorPrompt({
      name: product.name?.en || (product.name as unknown as string),
      category: product.category,
      color: product.color,
      type: product.type,
      material: product.material,
      finish: product.finish,
      width: product.width,
      length: product.length,
    });

    const out = await render({ roomImage, roomMime: "image/jpeg", referenceImages, prompt });
    const resultKey = `${roomKey.replace(/\.jpg$/, "")}/${productId}-${Date.now().toString(36)}.jpg`;
    const resultUrl = await putObject(resultKey, out.image, out.mime);

    record.set({ status: "done", resultKey, resultUrl, aiModel: out.model, durationMs: Date.now() - started });
    await record.save();
    return record;
  } catch (err: unknown) {
    record.set({ status: "failed", error: String((err as Error)?.message || err).slice(0, 1000), durationMs: Date.now() - started });
    await record.save();
    throw err;
  }
};

/** Admin: drop a render (S3 + record) and run it again. Older "done" renders for the pair are removed too. */
export const regenerateRender = async (renderId: string) => {
  const render = await RoomVisualization.findById(renderId);
  if (!render || !render.productId) throw Object.assign(new Error("Render not found"), { status: 404 });
  const { roomKey, productId } = render;
  const siblings = await RoomVisualization.find({ roomKey, productId, status: { $in: ["done", "failed"] } });
  for (const doc of siblings) {
    await deleteObject(doc.resultKey);
    await doc.deleteOne();
  }
  return renderRoom(roomKey, productId, { source: "admin", force: true });
};

export const deleteRender = async (renderId: string) => {
  const render = await RoomVisualization.findById(renderId);
  if (!render || render.status === "room") throw Object.assign(new Error("Render not found"), { status: 404 });
  await deleteObject(render.resultKey);
  await render.deleteOne();
};

/** Admin: delete a room photo together with everything rendered from it. */
export const deleteRoom = async (roomId: string) => {
  const room = await RoomVisualization.findById(roomId);
  if (!room || room.status !== "room") throw Object.assign(new Error("Room not found"), { status: 404 });
  const renders = await RoomVisualization.find({ roomKey: room.roomKey, status: { $ne: "room" } });
  for (const doc of renders) {
    await deleteObject(doc.resultKey);
    await doc.deleteOne();
  }
  await deleteObject(room.roomKey);
  await room.deleteOne();
};
