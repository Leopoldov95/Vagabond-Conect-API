// This file will serve as a helper file to handle cloudinary uploads, edit, and deletion
const { cloudinary } = require("../utils/cloudinary.js");

// upload IMG to cloudinary, need v2 to allow for upload options
const uploadCloudinary = async (file, folderName) => {
  return await cloudinary.v2.uploader.upload(file, {
    upload_preset: "socialmediaimgapi",
    folder: folderName,
  });
};

const deleteCloudinaryImg = async (id) => {
  return await cloudinary.uploader.destroy(id);
};
module.exports = { uploadCloudinary, deleteCloudinaryImg };
