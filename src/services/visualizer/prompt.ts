export interface ProductForPrompt {
  name: string;
  category: string;
  color?: string;
  type?: string;
  material?: string;
  finish?: string;
  width?: number;
  length?: number;
}

/** Which surface of the room a product category is applied to; null = the product cannot be visualized. */
export type VisualizerSurface = "floor" | "wall";

const SURFACE_BY_CATEGORY: Record<string, VisualizerSurface | null> = {
  Wood: "floor",
  Laminate: "floor",
  SPC: "floor",
  Cladding: "wall",
  // Skirting boards and cleaning products have nothing to show on a room photo.
  Panels: null,
  Cleaning: null,
};

export const visualizerSurface = (category: string): VisualizerSurface | null =>
  category in SURFACE_BY_CATEGORY ? SURFACE_BY_CATEGORY[category] : "floor";

const TYPE_HINTS: Record<string, string> = {
  Plank: "straight planks laid parallel, staggered joints",
  Fishbone: "herringbone (fishbone) pattern",
  Chevron: "chevron pattern",
};

const describe = (product: ProductForPrompt) =>
  `"${product.name}", ${product.category}${product.color ? `, ${product.color.toLowerCase()} tone` : ""}${product.finish ? `, ${product.finish} finish` : ""}`;

const KEEP_RULES = [
  "Photorealistic result, no text, no watermark, no added or removed objects.",
];

/** Flooring: the floor is replaced, everything else in the photo stays. */
export const buildFloorPrompt = (product: ProductForPrompt) => {
  const size = product.width && product.length ? `${product.width} × ${product.length} mm planks` : "standard plank format";
  const layout = TYPE_HINTS[product.type || ""] || "straight planks";
  return [
    "Photo edit task. The first image is a customer's room photo. The other image(s) show a flooring product, close-up.",
    `Replace ONLY the floor surface of the room with this exact flooring: ${describe(product)}.`,
    `Lay it as ${layout}, ${size}, at a realistic scale for the room, following the room's perspective and vanishing points.`,
    "Keep everything else pixel-identical: walls, ceiling, windows, doors, furniture, rugs on top of the floor, skirting boards, lighting, shadows, reflections, colour balance and camera angle.",
    "Objects standing on the floor stay in place and keep casting the same shadows on the new floor. The new floor must receive the same light and reflections as the original.",
    ...KEEP_RULES,
  ].join(" ");
};

/** Wall cladding: the main wall facing the camera is covered, the floor and everything else stay. */
export const buildWallPrompt = (product: ProductForPrompt) => {
  const size = product.width && product.length ? `${product.width} × ${product.length} mm panels` : "standard panel format";
  return [
    "Photo edit task. The first image is a customer's room photo. The other image(s) show a decorative wall cladding product, close-up.",
    `Cover ONLY the main wall of the room (the largest wall facing the camera) from floor to ceiling with this exact wall cladding: ${describe(product)}.`,
    `Mount the panels vertically, ${size}, at a realistic scale for the room, following the wall's perspective and vanishing points.`,
    "The floor stays exactly as it is. Keep everything else pixel-identical: the other walls, ceiling, windows, doors, furniture, lighting, shadows, reflections, colour balance and camera angle.",
    "Windows, doors, sockets, pictures and furniture in front of that wall stay in place and keep casting the same shadows on the new cladding. The cladding must receive the same light and reflections as the original wall.",
    ...KEEP_RULES,
  ].join(" ");
};

/** Edit instruction for the product's surface; throws for products that cannot be visualized. */
export const buildPrompt = (product: ProductForPrompt) => {
  const surface = visualizerSurface(product.category);
  if (surface === "wall") return buildWallPrompt(product);
  if (surface === "floor") return buildFloorPrompt(product);
  throw new Error(`Products in category "${product.category}" cannot be visualized`);
};
