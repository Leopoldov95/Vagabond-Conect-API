// This file will serve as a helper file to handle cloudinary uploads, edit, and deletion
import { cloudinary } from "../utils/cloudinary";
// const { cloudinary } = require("../utils/cloudinary.js");

// upload IMG to cloudinary, need v2 to allow for upload options
export const uploadCloudinary = async (file, folderName) => {
  return await cloudinary.v2.uploader.upload(file, {
    upload_preset: "socialmediaimgapi",
    folder: folderName,
  });
};

export const deleteCloudinaryImg = async (id) => {
  return await cloudinary.uploader.destroy(id);
};
