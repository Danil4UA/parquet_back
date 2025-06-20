import { LocalizedString } from "./model/Product";

export function isValidLanguage(language: string): language is keyof LocalizedString {
  return ["en", "ru", "he"].includes(language);
}
export const formatOrderMessage = (order: any) => {
  const { 
    orderNumber, 
    name, 
    lastName, 
    phoneNumber, 
    email,
    deliveryMethod,
    address, 
    apartment, 
    city, 
    postalCode,
    cartItems, 
    shippingCost,
    totalPrice,
    notes
  } = order;

  const getProductName = (productName: any) => {
    if (typeof productName === 'object' && productName.ru) {
      return productName.ru;
    }
    return 'Товар';
  };

  const itemsList = cartItems.map((item: any) => {
    const productName = getProductName(item.name);
  
    let itemText = `• *${productName}*`;
    
    if (item.model) {
      itemText += ` (${item.model})`;
    }
    
    if (item.boxes && item.actualArea) {
      itemText += `\n  Количество: ${item.quantity} м², Коробки: ${item.boxes}, Площадь: ${item.actualArea} м²`;
    } else {
      itemText += `\n  Количество: ${item.quantity} шт.`;
    }
    
    itemText += `\n  Цена: ${item.price}₪/ед., Сумма: ${item.totalPrice}₪`;
    
    return itemText;
  }).join("\n\n");

  let deliveryInfo = `Доставка: *${deliveryMethod === 'shipping' ? 'Доставка' : 'Самовывоз'}*`;
  
  if (deliveryMethod === 'shipping' && address) {
    deliveryInfo += `\nАдрес: ${address}`;
    if (apartment) deliveryInfo += `, кв. ${apartment}`;
    if (city) deliveryInfo += `\nГород: ${city}`;
    if (postalCode) deliveryInfo += `, ${postalCode}`;
  }

  const subtotal = totalPrice - shippingCost;
  let priceInfo = `*Сумма заказа:*\n`;
  priceInfo += `Товары: ${subtotal}₪\n`;
  if (shippingCost > 0) {
    priceInfo += `Доставка: ${shippingCost}₪\n`;
  }
  priceInfo += `*ИТОГО: ${totalPrice}₪*`;

  let message = `🆕 *НОВЫЙ ЗАКАЗ #${orderNumber}*\n\n`;
  
  message += `*Клиент:*\n`;
  message += `${name} ${lastName}\n`;
  message += `📞 ${phoneNumber}\n`;
  if (email) message += `Email: ${email}\n`;
  
  message += `\n${deliveryInfo}\n\n`;
  
  message += `*Товары:*\n${itemsList}\n\n`;
  
  message += priceInfo;
  
  if (notes) {
    message += `\n\n*Примечания:* ${notes}`;
  }
  
  message += `\n\nЗаказ создан: ${new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Kiev' })}`;

  return message;
};