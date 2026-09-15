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

const TYPE_HINTS: Record<string, string> = {
  Plank: "straight planks laid parallel, staggered joints",
  Fishbone: "herringbone (fishbone) pattern",
  Chevron: "chevron pattern",
};

/** Builds the edit instruction. The reference image(s) carry the actual look of the floor. */
export const buildFloorPrompt = (product: ProductForPrompt) => {
  const size = product.width && product.length ? `${product.width} × ${product.length} mm planks` : "standard plank format";
  const layout = TYPE_HINTS[product.type || ""] || "straight planks";
  return [
    "Photo edit task. The first image is a customer's room photo. The other image(s) show a flooring product, close-up.",
    `Replace ONLY the floor surface of the room with this exact flooring: "${product.name}", ${product.category}${product.color ? `, ${product.color.toLowerCase()} tone` : ""}${product.finish ? `, ${product.finish} finish` : ""}.`,
    `Lay it as ${layout}, ${size}, at a realistic scale for the room, following the room's perspective and vanishing points.`,
    "Keep everything else pixel-identical: walls, ceiling, windows, doors, furniture, rugs on top of the floor, skirting boards, lighting, shadows, reflections, colour balance and camera angle.",
    "Objects standing on the floor stay in place and keep casting the same shadows on the new floor. The new floor must receive the same light and reflections as the original.",
    "Photorealistic result, no text, no watermark, no added or removed objects.",
  ].join(" ");
};
