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
}

export default ContactUtils;