import { LocalizedString } from "./model/Product";

export function isValidLanguage(language: string): language is keyof LocalizedString {
  return ["en", "ru", "he"].includes(language);
}

export const formatOrderMessage = (order: any) => {
  const { city, name, phoneNumber, address, apartment, cartItems } = order;

  const itemsList = cartItems.map((item: any) => `📌 ${item.name} — ${item.quantity} шт.`).join("\n");

  return `📦 *Новый заказ!*\n🏙 Город: ${city}\n📍 Адрес: ${address}, кв. ${apartment}\n👤 Имя: ${name}\n📞 Телефон: ${phoneNumber}\n🛍 Товары:\n${itemsList}`;
};
