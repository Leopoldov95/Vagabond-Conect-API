import express from "express";
import {
  signup,
  signin,
  editProfileImg,
  editUserDetails,
  fetchSingleUser,
  fetchAllUsers,
  searchUsers,
  followUser,
  fetchUserCommentInfo,
  editUserCountryList,
  deleteUser,
  fetchAllFollowers,
  fetchAllFollowing,
  clearNotifications,
  updateMessageNotification,
} from "../controllers/users";
import { auth } from "../middleware/auth";
const router = express.Router();

router.post("/", auth, editUserDetails);
router.post("/delete/:id", auth, deleteUser);
router.get("/:params?", fetchAllUsers);
router.get("/get/following", auth, fetchAllFollowing);
router.get("/get/followers", auth, fetchAllFollowers);
router.get("/search/:query", searchUsers);
router.post("/follow/:id", auth, followUser);
router.post("/single", fetchSingleUser);
router.post("/signup", signup);
router.post("/signin", signin);
router.get("/comment/:id", fetchUserCommentInfo);
router.patch("/:id/profileImg", auth, editProfileImg);
router.patch("/list/:name", auth, editUserCountryList);
router.patch("/patch/clearNotification/:id", auth, clearNotifications);
router.patch(
  "/patch/updateMessageNotification/:id",
  auth,
  updateMessageNotification
);

export default router;
