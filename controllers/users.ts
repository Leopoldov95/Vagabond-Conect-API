import Users from "../models/users";
import Posts from "../models/posts";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { Request, Response } from "express";
import { updateNotification } from "../socket";
import { uploadCloudinary, deleteCloudinaryImg } from "./cloudinaryHelper";
import { updateUsersPosts } from "./helper";

const ignore = {
  country: 0,
  email: 0,
  password: 0,
  privacy: 0,
  profile_cloudinary_id: 0,
  followers: 0,
  following: 0,
  messages: 0,
  notifications: 0,
  favoriteCountries: 0,
  visitedCountries: 0,
};

// Sign into an existing account
export const signin = async (req, res) => {
  // need two things from the fronted - email and password
  const { email, password } = req.body;
  const formattedEmail = email.toLowerCase();
  try {
    // check to see if user exists
    const existingUser = await Users.findOne({ email: formattedEmail }); // look for an existing user by using the email
    if (!existingUser)
      return res.status(404).json({ message: "User does not exist." });

    const isPasswordCorrect = await bcrypt.compare(
      password,
      existingUser.password
    );

    if (!isPasswordCorrect) {
      return res.status(400).json({ message: "Invalid credentials." });
    }
    // if user does exist by passing the above checks, then the user can proceed to logging in
    // send a json web token to the frontend
    // the 'test' string here is the secret key for the token
    const token = jwt.sign(
      { email: existingUser.email, id: existingUser._id },
      "vagabondtoken",
      { expiresIn: "3h" }
    );
    res.status(200).json({ result: existingUser, token });
  } catch (error) {
    res.status(500).json({ message: "Something went wrong." });
  }
};

// Create a new account
export const signup = async (req: Request, res: Response) => {
  const {
    email,
    password,
    confirmPassword,
    firstName,
    lastName,
    selectedFile,
    country,
  } = req.body;
  const formattedEmail = email.toLowerCase();
  try {
    const existingUser = await Users.findOne({ email: formattedEmail });
    if (existingUser)
      return res.status(404).json({ message: "User already exists" });

    if (password !== confirmPassword)
      return res.status(404).json({ message: "Passwords don't match!" });
    let cloudinaryImg;
    const hashedPassword = await bcrypt.hash(password, 12);
    if (selectedFile) {
      cloudinaryImg = await uploadCloudinary(selectedFile, "profile");
    }
    const result = await Users.create({
      firstName,
      lastName,
      country,
      email: formattedEmail,
      profile_cloudinary: cloudinaryImg ? cloudinaryImg?.secure_url : "",
      profile_cloudinary_id: cloudinaryImg ? cloudinaryImg?.public_id : "",
      password: hashedPassword,
    });

    // generate a jwt toke so that the user will be logged in immediatley after registering
    const token = jwt.sign(
      { email: result.email, id: result._id },
      "vagabondtoken",
      {
        expiresIn: "3h",
      }
    );
    res.status(200).json({ result: result, token });
    //res.status(200).json({ message: "User Created!" });
  } catch (error) {
    res.status(500).json({ message: "Something went wrong." });
  }
};

// edits the profile image (can be profile picture or background) and deletes old image from Cloudinary
export const editProfileImg = async (req: any, res: Response) => {
  try {
    const { id: _id } = req.params;
    const { profile, uploadedImg, user } = req.body;
    if (!mongoose.Types.ObjectId.isValid(_id))
      return res.status(404).json({ message: "No Valid User" });
    // check if user has a current background profile pic, if they do, must delete img from cloudinary, or perhaps store it here and delete later
    // store existing id to variable in order to delete later, we only want to delete AFTER sucessfully updating existing image
    const existingCloudinaryId = user[profile] ? user[`${profile}_id`] : null;
    const cloudinaryImg = await uploadCloudinary(
      uploadedImg,
      profile.split("_")[0]
    );

    // create a temporary object to store new/existing properties in using the profile
    let propsToChange = {};
    propsToChange[profile] = cloudinaryImg?.secure_url;
    propsToChange[`${profile}_id`] = cloudinaryImg?.public_id;
    const result = await Users.findByIdAndUpdate(
      _id,
      { $set: { ...propsToChange } },
      { new: true }
    );

    // this updates the owners avatar on ALL posts
    if (profile === "profile_cloudinary") {
      await updateUsersPosts(req?.userId, {
        ownerAvatar: cloudinaryImg?.secure_url,
      });
    }

    // now that we made changes, delete previous image from db
    if (existingCloudinaryId) {
      await deleteCloudinaryImg(existingCloudinaryId);
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({ message: "Something went wrong." });
  }
};

// make changes to users db info, must also update all user posts
// This function needs to be used in multiple scenarios
export const editUserDetails = async (req: any, res: Response) => {
  const data = req.body;
  const { email } = data;
  const _id = req?.userId;
  try {
    const existingUser = await Users.findOne({ email }); // look for an existing user by using the email
    // this is to check that when upating the user email, it doesn't match an existing email
    if (existingUser && existingUser._id.toString() !== _id)
      return res
        .status(409)
        .json({ message: "User with that Email already exists." });

    const result = await Users.findByIdAndUpdate(
      _id,
      { $set: { ...data } },
      { new: true }
    );

    // only update the users post's if the first name or last name keys were updated, NOTE that image updates are handeled in a different function
    if (data.firstName || data.lastName) {
      await updateUsersPosts(_id, {
        ownerName: `${data.firstName} ${data.lastName}`,
      });
    }
    // need to update the state and store new info to client
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: "Something went wrong." });
  }
};

// note that it doesnt matter if we are fetcing followers or follwoing, they will share duplicate users. when fetching all/extra users, only filter out people who I am following
//mondodb has a .sort() method
// This method will be used to fetch user for the following compontnets - AvatarGroup, FreindsNav, ProfileFriendsNav
export const fetchAllUsers = async (req: any, res: Response) => {
  try {
    const { params } = req.params; // this will be the name of the modified URL
    const urlParams = new URLSearchParams(params);
    const filters = Object.fromEntries(urlParams);

    let user;
    let fetchedUsers;
    // no user is logged in, send all users
    // may want to post a number to represent what to skip (example number of users.length from client)
    if (filters.userId) {
      if (!mongoose.Types.ObjectId.isValid(filters.userId))
        return res.status(404).send("Not A Valid User Id!");
      user = await Users.findById(filters.userId);
    }
    if (!filters.userId) {
      fetchedUsers = await Users.find(
        {},
        {
          ...ignore,
        }
      );
    } else {
      // we have an authenticad user
      fetchedUsers = await Users.find(
        {
          _id:
            filters.selected !== "find"
              ? { $in: user[filters.selected] }
              : { $nin: user["following"] },
        },
        {
          ...ignore,
        }
      );
    }
    res.status(200).json(fetchedUsers);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Something went wrong." });
  }
};

// fetch all following users
export const fetchAllFollowing = async (req: any, res: Response) => {
  try {
    const _id = req?.userId;
    if (!mongoose.Types.ObjectId.isValid(_id))
      return res.status(404).send("Not A Valid User Id!");
    const user = await Users.findById(_id);
    if (!user) return res.status(404).send("User not validated!");
    const allFollowing = await Users.find(
      {
        _id: { $in: user["following"] },
      },
      { ...ignore }
    );
    res.status(200).json(allFollowing);
  } catch (error) {
    res.status(500).json({ message: "Something went wrong." });
  }
};

// fetch all followers
export const fetchAllFollowers = async (req: any, res: Response) => {
  try {
    const _id = req?.userId;
    if (!mongoose.Types.ObjectId.isValid(_id))
      return res.status(404).send("Not A Valid User Id!");
    const user = await Users.findById(_id);
    if (!user) return res.status(404).send("User not validated!");
    const allFollowers = await Users.find(
      {
        _id: { $in: user["followers"] },
      },
      { ...ignore }
    );
    res.status(200).json(allFollowers);
  } catch (error) {
    res.status(500).json({ message: "Something went wrong." });
  }
};

// fecthes a single user, used for the profile page
export const fetchSingleUser = async (req: Request, res: Response) => {
  const ignore = {
    email: 0,
    password: 0,
    profile_cloudinary_id: 0,
    background_cloudinary_id: 0,
    messages: 0,
    notifications: 0,
  };
  try {
    const { id } = req.body;
    if (!mongoose.Types.ObjectId.isValid(id))
      return res.status(404).json({ message: "No Valid User" });
    const result = await Users.find(
      { _id: id },
      {
        ...ignore,
      }
    );

    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: "Something went wrong." });
  }
};

// can use this to follow and unfollow, may want same logic to like and unlike
export const followUser = async (req: any, res: Response) => {
  try {
    const { id: _id } = req.params;
    if (!req.userId) return res.json({ message: "Unauthenticated" });

    // chacking of id is valid
    if (!mongoose.Types.ObjectId.isValid(_id))
      return res.status(404).send("No post with that ID");
    const targetUser = await Users.findById(_id);
    const currentUser = await Users.findById(req?.userId);
    // checkicking if already following
    const index = targetUser.followers.findIndex(
      (id) => id === String(req.userId)
    );
    if (index === -1) {
      // follow a user
      targetUser.followers.push(req.userId);
      currentUser.following.push(_id);
    } else {
      // unfollow a user
      targetUser.followers = targetUser.followers.filter(
        (id) => id !== String(req.userId)
      );
      currentUser.following = currentUser.following.filter(
        (id) => id !== String(_id)
      );
    }
    // update targetted User db
    await Users.findByIdAndUpdate(_id, targetUser, { new: true });

    // update current User db
    const updatedUser = await Users.findByIdAndUpdate(
      req?.userId,
      currentUser,
      { new: true }
    );

    res.json(updatedUser);
  } catch (error) {
    res.status(500).json({ message: "Something went wrong." });
  }
};

// gets specific user info so that it may appear in the comments section
export const fetchUserCommentInfo = async (req: Request, res: Response) => {
  try {
    const { id: _id } = req.params;
    // chacking of id is valid
    if (!mongoose.Types.ObjectId.isValid(_id))
      return res.status(404).send("No post with that ID");
    const { profile_cloudinary, firstName, lastName } = await Users.findById(
      _id
    );
    // keep in mind that not all users will have a profile picture

    res.json({ profile_cloudinary, firstName, lastName });
  } catch (error) {
    res.status(500).json({ message: "Something went wrong." });
  }
};

// edits users country lists
export const editUserCountryList = async (req: any, res: Response) => {
  try {
    const _id = req.userId;
    const { name } = req.params;
    const newList = req.body;
    if (!mongoose.Types.ObjectId.isValid(_id))
      return res.status(404).send("No post with that ID");
    const user = await Users.findById(_id);
    if (!user) return res.status(404).send("No user with that ID");
    let propsToChange = {};
    propsToChange[`${name}Countries`] = newList;
    const result = await Users.findByIdAndUpdate(
      _id,
      { $set: { ...propsToChange } },
      { new: true }
    );
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: "Something went wrong." });
  }
};

// DELETE USER

// deleting user must achieve the following, handle following and followers, delete all posts, delete all post comments, delete all post like, remove user from db
export const deleteUser = async (req: Request, res: Response) => {
  try {
    const { id: _id } = req.params;
    const { password } = req.body;
    const userToDelete = await Users.findById(_id);
    if (!mongoose.Types.ObjectId.isValid(_id))
      return res.status(404).send("Not A Valid User Id!");
    const existingUser: any = await Users.findById(_id);
    if (!existingUser)
      return res.status(404).json({ message: "User does not exist." });
    const isPasswordCorrect = await bcrypt.compare(
      password,
      existingUser.password
    );
    if (!isPasswordCorrect)
      return res.status(400).json({ message: "Invalid credentials." });
    // At this point the userId and password have been authenticated
    // handle users following and followers
    if (existingUser?.following?.length > 0 && existingUser?.following) {
      // update following list
      for (let user of existingUser.following) {
        await Users.findByIdAndUpdate(user, {
          $pull: { followers: _id },
        });
      }
    }
    if (existingUser?.followers?.length > 0 && existingUser?.followers) {
      // update followers list
      for (let user of existingUser.followers) {
        await Users.findByIdAndUpdate(user, {
          $pull: { following: _id },
        });
      }
    }
    const usersPosts: any = await Posts.find({ ownerId: _id });

    if (usersPosts.length > 0) {
      for (let post of usersPosts) {
        await deleteCloudinaryImg(post.cloudinary_id);
      }
    }
    // delete all users posts
    await Posts.deleteMany({
      ownerId: _id,
    });

    // remove likes from liked posts
    if (userToDelete.likedPosts.length > 0) {
      for (let postId of userToDelete.likedPosts) {
        const post = await Posts.findById(postId);
        post.likes = post.likes.filter((id) => id !== String(_id));
        await Posts.findByIdAndUpdate(postId, post, {
          new: true,
        });
      }
    }
    // remove all comments from commented post
    if (userToDelete.commentedPosts.length > 0) {
      for (let postId of userToDelete.commentedPosts) {
        const post = await Posts.findById(postId);
        if (post.comments.length > 0) {
          post.comments = post.comments.filter(
            (comment) => comment.commentOwnerId !== String(_id)
          );
        }
        await Posts.findByIdAndUpdate(postId, post, {
          new: true,
        });
      }
    }

    // remove user from db
    await Users.findByIdAndDelete(_id);
    res.json({ message: "Account Deleted Successfully" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Something went wrong." });
  }
};

export const searchUsers = async (req: Request, res: Response) => {
  const ignore = {
    country: 0,
    email: 0,
    password: 0,
    privacy: 0,
    profile_cloudinary_id: 0,
    followers: 0,
    following: 0,
    messages: 0,
    notifications: 0,
    favoriteCountries: 0,
    visitedCountries: 0,
  };
  try {
    const { query } = req.params;
    const result = await Users.find(
      {
        firstName: { $regex: query, $options: "i" },
      },
      { ...ignore }
    );
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: "Something went wrong." });
  }
};

// Clear Notifications
export const clearNotifications = async (req: Request, res: Response) => {
  try {
    const { id: _id } = req.params;
    const user = await Users.findByIdAndUpdate(
      _id,
      { notifications: [] },
      { new: true }
    );
    res.send(200).json(user);
  } catch (error) {
    res.status(500).json({ message: "Something went wrong." });
  }
};

// update message notification array from user db
// since this is ONLY concerning one user, don't need sockets
export const updateMessageNotification = async (req: any, res: Response) => {
  try {
    const { id: _id } = req.params; // user _id of the person whom we want to remove the notification from our message notification array
    const userId = req?.userId; // user_id of person who we want to update the DB

    // validate that userId is a valid String type
    if (!mongoose.Types.ObjectId.isValid(userId))
      return res.status(404).send("Not A Valid User Id!");

    const user = await Users.findById(userId);
    if (!user) return res.status(404).send("No user with that ID");

    const { messageNotifications } = user;
    delete messageNotifications[_id];

    const updatedUser = await Users.findByIdAndUpdate(
      userId,
      {
        messageNotifications: messageNotifications,
      },
      { new: true }
    );

    res.status(200).json(updatedUser);
  } catch (error) {
    res.status(500).json({ message: "Something went wrong." });
  }
};
