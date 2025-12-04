import mongoose, { Schema, Document } from 'mongoose';

export interface IConsultation extends Document {
    name: string;
    phone: string;
    message?: string;
    productId: string;
    formType: string;
    createdAt: Date;
}

const consultationSchema: Schema = new Schema({
    name: { type: String, required: true },
    phone: { type: String, required: true },
    message: { type: String },
    productId: { type: String, required: true },
    formType: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});

export default mongoose.model<IConsultation>('Consultation', consultationSchema);