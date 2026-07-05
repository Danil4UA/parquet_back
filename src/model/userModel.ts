import mongoose from "mongoose";

const refreshTokenSchema = new mongoose.Schema({
  tokenHash: {
    type: String,
    required: true
  },
  expiresAt: {
    type: Date,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true
  },
  refreshTokens: {
    type: [refreshTokenSchema],
    default: []
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const User = mongoose.model("User", userSchema);

export default User;
