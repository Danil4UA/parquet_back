// services/catalogService.ts
//
// Public catalog listing: filtering, sorting and pagination of products.
//
// Default order (no `sortBy`):
//   1. Products with a photo of a finished interior (`hasInteriorPhoto`) come first.
//   2. Inside each group the order is a deterministic shuffle keyed by `seed`.
//      The seed defaults to today's date, so the catalog is reshuffled once a day
//      while every page of a single listing stays consistent (no repeats / gaps
//      while the user scrolls). Pass `seed` explicitly to pin a particular order.
//
// Explicit sorts (`sortBy`) are done by MongoDB with skip/limit. Price sorts use
// the effective price (after discount).

import { FilterQuery, PipelineStage } from "mongoose";
import Product, { IProductSchema } from "../model/Product";
import {
  Language,
  containsInsensitive,
  exactInsensitive,
  localizeProduct,
  resolveLanguage,
  splitCsv
} from "../utils/productUtils";

export const CATALOG_SORTS = ["price_asc", "price_desc", "newest", "oldest", "name_asc", "name_desc"] as const;
export type CatalogSort = (typeof CATALOG_SORTS)[number];

export type Availability = "in_stock" | "out_of_stock";
export type InteriorPhotoFilter = "with" | "without";

export interface CatalogQuery {
  category?: string;
  search?: string;
  colors: string[];
  types: string[];
  // Narrows by product category (used by the "all" catalog filter).
  materials: string[];
  availability?: Availability;
  interiorPhoto?: InteriorPhotoFilter;
  sortBy?: CatalogSort;
  page: number;
  limit: number;
  language: Language;
  seed: string;
}

export interface CatalogPage {
  products: any[];
  pagination: { total: number; page: number; limit: number; pages: number };
}

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const MAX_SEED_LENGTH = 64;

const isCatalogSort = (value: unknown): value is CatalogSort =>
  typeof value === "string" && (CATALOG_SORTS as readonly string[]).includes(value);

const parsePositiveInt = (value: unknown, fallback: number): number => {
  const parsed = parseInt(typeof value === "string" ? value : "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const asString = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;

// Today's date in the shop's timezone, e.g. "2026-09-23".
const dailySeed = (): string =>
  new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jerusalem" });

// Parses and validates raw Express query params into a CatalogQuery.
export const parseCatalogQuery = (query: Record<string, unknown>): CatalogQuery => {
  const availability = asString(query.availability);
  const interiorPhoto = asString(query.interiorPhoto);
  const seed = asString(query.seed);

  return {
    category: asString(query.category),
    search: asString(query.search),
    colors: splitCsv(query.color),
    types: splitCsv(query.type),
    materials: splitCsv(query.material),
    availability:
      availability === "in_stock" || availability === "out_of_stock" ? availability : undefined,
    interiorPhoto: interiorPhoto === "with" || interiorPhoto === "without" ? interiorPhoto : undefined,
    sortBy: isCatalogSort(query.sortBy) ? query.sortBy : undefined,
    page: parsePositiveInt(query.page, 1),
    limit: Math.min(parsePositiveInt(query.limit, DEFAULT_LIMIT), MAX_LIMIT),
    language: resolveLanguage(query.language),
    seed: seed ? seed.slice(0, MAX_SEED_LENGTH) : dailySeed()
  };
};

// Builds the MongoDB filter for a catalog query.
export const buildCatalogFilter = (q: CatalogQuery): FilterQuery<IProductSchema> => {
  const filter: FilterQuery<IProductSchema> = {};

  if (q.category === "sales") {
    filter.discount = { $gt: 0 };
  } else if (q.category && q.category !== "all") {
    filter.category = exactInsensitive(q.category);
  }

  // "material" is a category filter for the "all" page; it takes precedence over `category`.
  if (q.materials.length > 0) {
    filter.category = { $in: q.materials.map(exactInsensitive) };
  }

  if (q.colors.length > 0) {
    filter.color = { $in: q.colors.map(exactInsensitive) };
  }

  if (q.types.length > 0) {
    filter.type = { $in: q.types.map(exactInsensitive) };
  }

  // Older products may not have `isAvailable` at all — treat them as in stock.
  if (q.availability === "in_stock") {
    filter.isAvailable = { $ne: false };
  } else if (q.availability === "out_of_stock") {
    filter.isAvailable = false;
  }

  // Same for `hasInteriorPhoto`: a missing field means "no interior photo".
  if (q.interiorPhoto === "with") {
    filter.hasInteriorPhoto = true;
  } else if (q.interiorPhoto === "without") {
    filter.hasInteriorPhoto = { $ne: true };
  }

  if (q.search) {
    const searchRegex = containsInsensitive(q.search);
    filter.$or = [
      { "name.en": searchRegex },
      { "name.ru": searchRegex },
      { "name.he": searchRegex },
      { model: searchRegex },
      { type: searchRegex }
    ];
  }

  return filter;
};

// 32-bit FNV-1a hash. Fast, deterministic, good enough to spread ids evenly.
const fnv1a = (input: string): number => {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
};

const paginate = (total: number, page: number, limit: number) => ({
  total,
  page,
  limit,
  pages: Math.ceil(total / limit)
});

// Default order: interior photos first, then a seeded shuffle.
// Only ids are loaded for the whole result set (cheap for a catalog-sized collection);
// full documents are fetched for the requested page only.
const listShuffled = async (
  filter: FilterQuery<IProductSchema>,
  q: CatalogQuery
): Promise<CatalogPage> => {
  const rows = await Product.find(filter, { _id: 1, hasInteriorPhoto: 1 }).lean();

  const ordered = rows
    .map((row) => {
      const id = String(row._id);
      return { id, interior: row.hasInteriorPhoto === true, rank: fnv1a(`${q.seed}:${id}`) };
    })
    .sort((a, b) => {
      if (a.interior !== b.interior) return a.interior ? -1 : 1;
      return a.rank - b.rank || a.id.localeCompare(b.id);
    });

  const start = (q.page - 1) * q.limit;
  const pageIds = ordered.slice(start, start + q.limit).map((row) => row.id);

  const docs = pageIds.length > 0 ? await Product.find({ _id: { $in: pageIds } }).lean() : [];
  const byId = new Map(docs.map((doc) => [String(doc._id), doc]));
  const products = pageIds
    .map((id) => byId.get(id))
    .filter(Boolean)
    .map((doc) => localizeProduct(doc, q.language));

  return { products, pagination: paginate(ordered.length, q.page, q.limit) };
};

// Explicit sort: done in MongoDB with skip/limit.
const listSorted = async (
  filter: FilterQuery<IProductSchema>,
  q: CatalogQuery,
  sortBy: CatalogSort
): Promise<CatalogPage> => {
  const nameField = `name.${q.language}`;
  const sortStages: Record<CatalogSort, Record<string, 1 | -1>> = {
    price_asc: { effectivePrice: 1 },
    price_desc: { effectivePrice: -1 },
    newest: { createdAt: -1 },
    oldest: { createdAt: 1 },
    name_asc: { [nameField]: 1 },
    name_desc: { [nameField]: -1 }
  };
  const sortStage = sortStages[sortBy];

  const pipeline: PipelineStage[] = [
    { $match: filter },
    {
      $addFields: {
        effectivePrice: {
          $multiply: [
            { $ifNull: ["$price", 0] },
            { $subtract: [1, { $divide: [{ $ifNull: ["$discount", 0] }, 100] }] }
          ]
        }
      }
    },
    // `_id` as a tiebreaker keeps pagination stable when sort values are equal.
    { $sort: { ...sortStage, _id: 1 } },
    { $skip: (q.page - 1) * q.limit },
    { $limit: q.limit },
    { $project: { effectivePrice: 0 } }
  ];

  const aggregation = Product.aggregate(pipeline);
  if (sortBy === "name_asc" || sortBy === "name_desc") {
    // Case-insensitive alphabetical order.
    aggregation.collation({ locale: "en", strength: 2 });
  }

  const [total, docs] = await Promise.all([Product.countDocuments(filter), aggregation.exec()]);

  return {
    products: docs.map((doc) => localizeProduct(doc, q.language)),
    pagination: paginate(total, q.page, q.limit)
  };
};

export const listCatalog = async (q: CatalogQuery): Promise<CatalogPage> => {
  const filter = buildCatalogFilter(q);
  return q.sortBy ? listSorted(filter, q, q.sortBy) : listShuffled(filter, q);
};
