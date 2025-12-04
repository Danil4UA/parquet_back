class ContactUtils {
    static setContactUsObject(body) {
        const contactData = {};

        const validFields = [
            "name",
            "email",
            "phone",
            "message"
        ]

        for (const field of validFields) {
            if (body[field] !== undefined) {
                contactData[field] = body[field];
            }
        }

        return contactData
    }

    static formatContactMessage(contactData) {
        const { name, email, phone, message } = contactData;

        let formattedMessage = "*Новое сообщение*\n\n";

         if (name) {
            formattedMessage += `*Имя:* ${name}\n`;
        }
        
        if (email) {
            formattedMessage += `*Email:* ${email}\n`;
        }
        
        if (phone) {
            formattedMessage += `*Телефон:* ${phone}\n`;
        }
        
        if (message) {
            formattedMessage += `*Сообщение:*\n${message}\n`;
        }
        
        formattedMessage += `\n*Время:* ${new Date().toLocaleString('ru-RU', {
            timeZone: 'Asia/Jerusalem',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        })}`;
        
        return formattedMessage;
    }

    static setConsultationObject = (body) => {
        return {
            name: body.name,
            phone: body.phone,
            message: body.message || '',
            productId: body.productId,
            formType: body.formType
        };
    }

    static formatConsultationMessage = (consultationData, productData) => {
        let productInfo = '';
        
        if (productData) {
            const productName = productData.name?.ru || 
                            'Неизвестный продукт';
                            
            
            productInfo = `*Продукт:* ${productName}\n*ID продукта:* ${productData._id}\n`;
        } else {
            productInfo = `*ID продукта:* ${consultationData.productId}\n`;
        }

        return `🔔 *Новая заявка на консультацию*\n\n` +
            `*Имя:* ${consultationData.name}\n` +
            `*Телефон:* ${consultationData.phone}\n` +
            productInfo +
            `*Модель:* ${productData.model}\n` +
            `*Тип формы:* ${consultationData.formType}\n` +
            `${consultationData.message ? `*Сообщение:* ${consultationData.message}\n` : ''}` +
            `*Время:* ${new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })}`;
    }
}

export default ContactUtils;