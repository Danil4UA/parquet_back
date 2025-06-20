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
}

export default ContactUtils;