// utils/productUtils.ts
import { LocalizedString } from "../model/Product";
import { isValidLanguage } from "../utils";

export type Language = keyof LocalizedString;

// Define valid product fields
const validProductFields = [
  'name', 'description', 'price', 'images', 'category',
  'stock', 'discount', 'isAvailable', 'color', 'model',
  'type', 'finish', 'width', 'length', 'thickness',
  'countryOfOrigin', 'detailedDescription', "boxCoverage",
  'hasInteriorPhoto'
];

const translatableFields = ['name', 'description', 'detailedDescription'];

const booleanFields = ['isAvailable', 'hasInteriorPhoto'];

// Accepts true/false and their string forms ("true"/"false"); anything else is invalid.
const parseBoolean = (value: unknown): boolean | undefined => {
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
};

export const sanitizeProductData = (reqBody: any, isNew = false): { data: any; errors: string[] } => {
  const sanitizedData: any = {};
  const errors: string[] = [];

  for (const field of validProductFields) {
    if (!(field in reqBody)) continue;

    const value = reqBody[field];

    if (translatableFields.includes(field)) {
      if (value && typeof value === 'object') {
        sanitizedData[field] = {};

        for (const lang of ['en', 'ru', 'he']) {
          if (value[lang] !== undefined) {
            sanitizedData[field][lang] = value[lang] === '' ? undefined : value[lang];
          }
        }

        if (isNew && (field === 'name' || field === 'detailedDescription')) {
          for (const lang of ['en', 'ru', 'he']) {
            if (!sanitizedData[field] || !sanitizedData[field][lang]) {
              errors.push(`${field}.${lang} is required`);
            }
          }
        }
      }
    } else if (booleanFields.includes(field)) {
      const parsed = parseBoolean(value);
      if (parsed === undefined) {
        errors.push(`${field} must be a boolean`);
      } else {
        sanitizedData[field] = parsed;
      }
    } else {
      sanitizedData[field] = value === '' ? undefined : value;

      if (isNew && ['price', 'category'].includes(field) && !sanitizedData[field]) {
        errors.push(`${field} is required`);
      }
    }
  }

  if ('images' in reqBody) {
    if (Array.isArray(reqBody.images)) {
      sanitizedData.images = reqBody.images.filter((img: string) => img && img.trim() !== '');

      if (sanitizedData.images.length === 0) {
        errors.push('At least one valid image is required. Empty image URLs are not allowed.');
      }
    } else {
      errors.push('images must be an array');
    }
  } else if (isNew) {
    errors.push('images are required');
  }

  return { data: sanitizedData, errors };
};

// Resolves the `language` query param to a supported language, defaulting to English.
export const resolveLanguage = (value: unknown): Language => {
  const language = typeof value === 'string' ? value : '';
  return isValidLanguage(language) ? language : 'en';
};

// Replaces the localized {en, ru, he} objects with the string for the requested language.
// Works for both Mongoose documents and plain (lean / aggregate) objects.
export const localizeProduct = (product: any, language: Language) => {
  const obj = typeof product?.toObject === 'function' ? product.toObject() : product;
  return {
    ...obj,
    name: obj.name?.[language] ?? obj.name?.en,
    description: obj.description?.[language] ?? obj.description?.en,
    detailedDescription: obj.detailedDescription?.[language] ?? obj.detailedDescription?.en
  };
};

// Escapes user input so it can be embedded in a RegExp literally.
export const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Case-insensitive exact match ("wood" matches "Wood", but not "Woodland").
export const exactInsensitive = (value: string): RegExp => new RegExp(`^${escapeRegex(value.trim())}$`, 'i');

// Case-insensitive substring match.
export const containsInsensitive = (value: string): RegExp => new RegExp(escapeRegex(value.trim()), 'i');

// Splits a comma-separated query value ("Brown,Gray") into trimmed, non-empty parts.
export const splitCsv = (value: unknown): string[] =>
  typeof value === 'string'
    ? value.split(',').map((part) => part.trim()).filter(Boolean)
    : [];
