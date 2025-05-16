import { Response } from "express";

class Utils {
    static isString(value: unknown) {
        return typeof value === 'string' || value instanceof String;
    };

    static isNumber(value: unknown) {
        return typeof value === 'number' && !isNaN(value);
    };

    static isBoolean(value: unknown) {
        return typeof value === 'boolean';
    };

    static isObject(value: unknown) {
        return value !== null && typeof value === 'object' && !Array.isArray(value);
    };

    static isArray(value: unknown) {
        return Array.isArray(value);
    };

    static isNonEmptyString(value: unknown) {
        return this.isString(value) && value.trim() !== '';
    };

    static badRequest(response: Response, message: string) {
        return response.status(400).json({
            success: false,
            message: message || "Bad Request",
        });
    };
}

export default Utils;