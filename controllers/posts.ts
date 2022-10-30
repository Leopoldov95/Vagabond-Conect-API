import mongoose from "mongoose";
import Posts from "../models/posts";
import Users from "../models/users";
import { Request, Response } from "express";
import { checkUserComments } from "./helper";
import { uploadCloudinary, deleteCloudinaryImg } from "./cloudinaryHelper";

// fetch users posts only
export const getUsersPosts = async (req: Request, res: Response) => {
  try {
    const { id: _id } = req.params;
    // retieve all posts we have in the data base
    if (!mongoose.Types.ObjectId.isValid(_id))
      return res.status(404).send("No User with that ID");
    const fetchedPosts = await Posts.find({ ownerId: _id }).limit(10);
    res.status(200).json(fetchedPosts);
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
};

// fetch only auth user posts

// creta post
export const createPost = async (req: any, res: Response) => {
  // with POST requests, we have access to req.body
  const {
    title,
    description,
    country,
    selectedFile,
    commentAccess,
    continent,
  } = req.body;
  const { profile_cloudinary, firstName, lastName } = await Users.findById(
    req?.userId
  );
  // create img on cloudinary
  const { secure_url, public_id } = await uploadCloudinary(
    selectedFile,
    "posts"
  );
  const newPost = new Posts({
    title,
    description,
    country,
    continent,
    commentAccess,
    cloudinary_url: secure_url,
    cloudinary_id: public_id,
    ownerId: req?.userId,
    ownerName: `${firstName} ${lastName}`,
    ownerAvatar: profile_cloudinary ? profile_cloudinary : "",
    createdAt: new Date().toISOString(),
  });
  try {
    await newPost.save(); //save() is asynchronous\
    res.status(201).json(newPost);
  } catch (err) {
    console.log(err);
    res.status(409).json({ message: err.message });
  }
};

// update posts

export const updatePost = async (req: any, res: Response) => {
  // will want to send cloudinary_id here!
  // when destructuring, we can rename our properties such as { id:_id }
  const { id: _id } = req.params;
  const {
    title,
    description,
    selectedFile,
    country,
    continent,
    commentAccess,
    cloudinary_id,
  } = req.body;
  let existingPostId;
  let newImg;

  if (!mongoose.Types.ObjectId.isValid(_id))
    return res.status(404).send("No post with that ID");
  // the selectedFile is not an url, therefore we need exisitng cloudinary_id
  // const exisitngCloudinaryId = post.selectedFile.includes("cloudinary") ? null : await Posts.findById(_id)
  if (!selectedFile.includes("cloudinary")) {
    const { cloudinary_id } = await Posts.findById(_id);
    existingPostId = cloudinary_id;
    const { secure_url, public_id } = await uploadCloudinary(
      selectedFile,
      "posts"
    );
    newImg = { secure_url, public_id };
  }

  // check if post selectedFile is an url or base64 string, if it is a base64 string, first grab the existing cloud_id, create a new cloud_img, update post, then delete prev coloud_id + cloud_img

  // update post if id is valid
  //{...post, _id}
  const updatedPost = await Posts.findByIdAndUpdate(
    _id,
    {
      title,
      description,
      country,
      continent,
      commentAccess,
      cloudinary_url: newImg ? newImg.secure_url : selectedFile,
      cloudinary_id: newImg ? newImg.public_id : cloudinary_id,
      _id,
    },
    { new: true }
  );
  // we have the id of the previous image
  if (existingPostId) {
    await deleteCloudinaryImg(existingPostId);
  }

  res.json(updatedPost);
};

// we will update the posts owner avatar AFTER the user updates their own profile picture

// delete post, since we are removing, no need to send data back to the client
export const deletePost = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    // checks if id is valid
    if (!mongoose.Types.ObjectId.isValid(id))
      return res.status(404).send("No post with that ID");
    const existingPost: any = await Posts.findById(id);
    await deleteCloudinaryImg(existingPost.cloudinary_id);
    await Posts.findByIdAndRemove(id);

    res.json({ message: "Post Deleted Successfully" });
  } catch (error) {
    res.status(500).json({ message: "Something went wrong" });
  }
};
// add like

export const likePost = async (req: any, res: Response) => {
  const { id } = req.params; // post id
  const _id = req?.userId;
  // we get access to req.userId from the middleware we are passing (auth)
  if (!req.userId) return res.json({ message: "Unauthenticated" });

  // chacking of id is valid
  if (!mongoose.Types.ObjectId.isValid(id))
    return res.status(404).send("No post with that ID");

  const post = await Posts.findById(id);
  const user = await Users.findById(_id);
  // handling like logic for user
  const index = post.likes.findIndex((id) => id === String(req.userId));
  if (index === -1) {
    // like the post
    post.likes.push(req.userId);
    user.likedPosts.push(id);
  } else {
    // dislike a post
    post.likes = post.likes.filter((id) => id !== String(req.userId));
    user.likedPosts = user.likedPosts.filter((postId) => postId !== String(id));
  }
  const updatedPost = await Posts.findByIdAndUpdate(id, post, {
    new: true,
  });
  await Users.findByIdAndUpdate(_id, user, { new: true });

  res.json(updatedPost);
};

// comments actions

export const createComment = async (req: any, res: Response) => {
  try {
    const userId = req?.userId;
    const { id: _id } = req.params;
    const { formData } = req.body;
    if (!req.userId) return res.json({ message: "Unauthenticated" });
    if (!mongoose.Types.ObjectId.isValid(_id))
      return res.status(404).send("Not A Valid Post Id!");
    // find the post
    const post = await Posts.findById(_id);
    post.comments.push({
      commentOwnerId: req.userId,
      message: formData,
    });
    const updatedPost = await Posts.findByIdAndUpdate(_id, post, { new: true });
    await checkUserComments(_id, userId);
    res.json(updatedPost);
  } catch (error) {
    res.status(500).json({ message: "Something went wrong" });
  }
};

// Delete a comment from the post
export const deleteComment = async (req: any, res: Response) => {
  try {
    const userId = req?.userId;
    const { postId, commentId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(postId))
      return res.status(404).send("Not A Valid Post Id!");
    if (!mongoose.Types.ObjectId.isValid(commentId))
      return res.status(404).send("Not A Valid Comment Id!");
    const post = await Posts.findById(postId);

    post.comments = post.comments.filter(
      (comment) => String(comment._id) !== String(commentId)
    );
    const updatedPost = await Posts.findByIdAndUpdate(postId, post, {
      new: true,
    });
    await checkUserComments(postId, userId);
    res.status(200).json(updatedPost);
  } catch (error) {
    res.status(500).json({ message: "Something went wrong" });
  }
};

export const editComment = async (req: any, res: Response) => {
  try {
    const userId = req?.userId;
    const { postId, commentId } = req.params;
    const { comment } = req.body;
    if (!mongoose.Types.ObjectId.isValid(postId))
      return res.status(404).send("Not A Valid Post Id!");
    if (!mongoose.Types.ObjectId.isValid(commentId))
      return res.status(404).send("Not A Valid Comment Id!");
    const post = await Posts.findById(postId);
    const idx = post.comments.findIndex(
      (comment) => String(comment._id) === String(commentId)
    );
    post.comments[idx].message = comment;
    const updatedPost = await Posts.findByIdAndUpdate(postId, post, {
      new: true,
    });
    await checkUserComments(postId, userId);
    res.status(200).json(updatedPost);
  } catch (error) {
    res.status(500).json({ message: "Something went wrong" });
  }
};

// testing ///
// might be able to use this route for both home page feed AND profile feed
export const getAllPosts = async (req: Request, res: Response) => {
  const { params } = req.params; // this will be the name of the modified URL
  const urlParams = new URLSearchParams(params);
  const filters = Object.fromEntries(urlParams);
  try {
    //const { userId, continentFilter, skip } = req.body;
    // what's happening is that since a userId is detected here, it assumes it is fetching ONLY for followers
    let user;
    if (filters.userId) {
      if (!mongoose.Types.ObjectId.isValid(filters.userId))
        return res.status(404).send("Not A Valid User Id!");
      user = await Users.findById(filters.userId);
    }
    // need to somehow make this dynamic
    const posts = await Posts.find({
      //ownerId:  { $in: user?.following },
      ownerId: filters.userId ? { $in: user?.following } : /.*/,
      continent: filters.continentFilter ? filters.continentFilter : /.*/,
    })
      .sort({ createdAt: -1 })
      .limit(10)
      .skip(filters.skip ? Number(filters.skip) : 0);
    const isMore = posts?.length % 10 === 0;

    res.status(200).json({ posts, isMore });
  } catch (error) {
    res.status(500).json({ message: "Something went wrong" });
  }
};
