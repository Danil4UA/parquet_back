const mongoose = require("mongoose");
const { Schema } = mongoose;

const ContactSchema = new Schema({
  name: {
    type: String,
    required: [true, "Name is required"],
    trim: true
  },
  email: {
    type: String,
    required: [true, "Email is required"],
    trim: true,
    lowercase: true
  },
  phone: {
    type: String,
    required: [true, "Phone is required"],
    trim: true
  },
  message: {
    type: String,
    required: [true, "Message is required"],
    trim: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

ContactSchema.index({ email: 1 });
ContactSchema.index({ createdAt: -1 });



const Contact = mongoose.model("Contact", ContactSchema);

export default Contact;