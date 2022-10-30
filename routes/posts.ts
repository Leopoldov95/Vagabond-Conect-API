import express from "express";
import {
  createPost,
  getAllPosts,
  getUsersPosts,
  updatePost,
  deletePost,
  likePost,
  createComment,
  deleteComment,
  editComment,
} from "../controllers/posts";
import auth from "../middleware/auth";
const router = express.Router();

router.get("/:params?", getAllPosts); // retrieves all posts with optional filters
router.get("/user/:id", getUsersPosts); // used for profile page
router.post("/create", auth, createPost); // create post
router.patch("/:id", auth, updatePost); // update a post
router.delete("/:id", auth, deletePost); // delete a posy
router.patch("/likepost/:id", auth, likePost); // like a post
// comment routes
router.patch("/comment/create/:id", auth, createComment); // create a new comment for a post
router.patch("/comment/delete/:postId/:commentId", auth, deleteComment); // delete a comment from a post
router.patch("/comment/edit/:postId/:commentId", auth, editComment); // edit a comment from a post

export default router;
