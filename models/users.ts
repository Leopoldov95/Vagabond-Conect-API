import mongoose, { Schema } from "mongoose";
import { type } from "os";

// Schema is a mongoose data structure
// may need a nested message object
const userSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  country: { type: String, required: true },
  email: { type: String, required: true },
  password: { type: String, required: true },
  privacy: { type: String, default: "everyone", required: true },
  profile_cloudinary: { type: String },
  profile_cloudinary_id: { type: String },
  background_cloudinary: { type: String },
  background_cloudinary_id: { type: String },
  bio: { type: String, default: "Hi! I'm new to Vagabond Connect!" },
  followers: { type: [String] },
  following: { type: [String] },
  notifications: { type: [] },
  favoriteCountries: { type: [String] },
  visitedCountries: { type: [String] },
  likedPosts: { type: [String] },
  commentedPosts: { type: [String] },
  messageRooms: { type: [String] },
});

export default mongoose.model("users", userSchema);
