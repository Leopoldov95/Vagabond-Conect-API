import express from "express";
import auth from "../middleware/auth";
import {
  fetchUserMessage,
  fetchAllContacts,
  postMessage,
  deleteMessages,
} from "../controllers/message";
const router = express.Router();

router.get("/get/all", auth, fetchAllContacts);
router.get("/get/:id", auth, fetchUserMessage);
router.post("/post/:id", auth, postMessage);
router.delete("/delete/:id", auth, deleteMessages);

export default router;
