// utils/productUtils.ts
import { Request } from 'express';

// Define valid product fields
const validProductFields = [
  'name', 'description', 'price', 'images', 'category', 
  'stock', 'discount', 'isAvailable', 'color', 'model', 
  'type', 'finish', 'width', 'length', 'thickness', 
  'countryOfOrigin', 'detailedDescription'
];

const translatableFields = ['name', 'description', 'detailedDescription'];


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