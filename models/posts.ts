import mongoose from "mongoose";

const postSchema = new mongoose.Schema({
  title: { type: String, required: true },
  ownerId: { type: String, required: true },
  ownerName: { type: String, required: true },
  ownerAvatar: { type: String },
  cloudinary_url: { type: String, required: true },
  cloudinary_id: { type: String, required: true },
  description: { type: String, required: true },
  commentAccess: { type: String, required: true },
  country: { type: String, required: true },
  continent: { type: String, required: true },
  likes: { type: [String], default: [] },
  comments: {
    type: [
      {
        createdAt: { type: Date, default: new Date() },
        commentOwnerId: String,
        message: String,
      },
    ],
    default: [],
  },
  createdAt: {
    type: Date,
    default: new Date(),
  },
});

export default mongoose.model("posts", postSchema);
