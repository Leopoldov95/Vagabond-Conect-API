import mongoose from "mongoose";
//import Users from "../models/users";
import Messages from "../models/messages";
import Users from "../models/users";
import { Request, Response } from "express";

// fetch all open messages from users message db
export const fetchAllContacts = async (req: any, res: Response) => {
  const _id = req.userId;
  const contactList = [];

  try {
    // get the users message db
    const { messageRooms } = await Users.findById(_id);

    // the user does not have a message db
    // will need to test this later for empty/no messages
    if (messageRooms.length < 1) {
      return res.json({ message: "You do not have any messages" });
    } else {
      // the user is part of messaging rooms
      for (let room of messageRooms) {
        const existingRoom: any = await Messages.findById(room);
        const targetUser = existingRoom.users.filter((user) => user !== _id); // exclude current user from result
        let tempObj = {};
        const { profile_cloudinary, firstName, lastName } =
          await Users.findById(targetUser);
        tempObj["_id"] = targetUser;
        tempObj["profile_cloudinary"] = profile_cloudinary;
        tempObj["firstName"] = firstName;
        tempObj["lastName"] = lastName;
        contactList.push(tempObj);
      }
    }

    // const data = userMessages;

    // for (let user in data) {
    //   let tempObj = {};
    //   const { profile_cloudinary, firstName, lastName } = await Users.findById(
    //     user
    //   );
    //   tempObj["_id"] = user;
    //   tempObj["profile_cloudinary"] = profile_cloudinary;
    //   tempObj["firstName"] = firstName;
    //   tempObj["lastName"] = lastName;
    //   contactList.push(tempObj);
    // }
    return res.status(200).json(contactList);
    // make sure on the frontend that the first index user is automatically selected and that message thread called and applied
  } catch (error) {
    res.status(500).json({ message: "Something went wrong" });
  }
};

// this will feth the messaging thread for the slected user
export const fetchUserMessage = async (req: any, res: Response) => {
  const { id: _id } = req.params; // targeted user id
  const userId = req.userId; // authenticated user ID
  try {
    // for now, since we had to go through multiple authenitcaed barriers to get here, we can keep security minimal
    // ensure that validated user is logged in
    if (!userId) return res.json({ message: "Unauthenticated" });
    // ensrue that we have a valid id
    if (!mongoose.Types.ObjectId.isValid(_id)) {
      return res.status(404).send("No User with that ID");
    }

    const messageCollection = await Messages.find({
      users: { $in: [userId, _id] },
    });

    if (messageCollection.length < 1) {
      return res.json({ message: "No messages" });
    } else {
      res.json(messageCollection[0]);
    }
    // const userMessages: any = await Messages.find({ ownerId: userId });
    // const targetDb: any = await Messages.find({ ownerId: _id });
    // const targetId = targetDb[0]._id;
    // const { allMessages } = userMessages[0];
    // if (allMessages) {
    //   if (allMessages[_id]) {
    //     // don't need extra conditional for targetId as the existance of the message thread will mean the existing of the targetId
    //     return res.json([allMessages[_id], targetId]);
    //   } else {
    //     return res.json({ message: "No messages with this user" });
    //   }
    // }
    // return res.json({ message: "no messages" });
  } catch (error) {
    res.status(500).json({ message: "Something went wrong" });
  }
};
// this will post a new message to the thread
export const postMessage = async (req: any, res: Response) => {
  const { id: _id } = req.params;
  const userId = req.userId; // authenticated user ID
  const data = req.body;
  let existingMessageCollection;
  // check if an instance of a message collection already exists, if not then need to create one
  existingMessageCollection = await Messages.find({
    users: { $in: [userId, _id] },
  });

  if (existingMessageCollection.length < 1) {
    // create a new instance
    await Messages.create({
      users: [userId, _id],
    });

    // Once a message room has been created, immeditaltey update the variable
    existingMessageCollection = await Messages.find({
      users: { $in: [userId, _id] },
    });
    // add to both users messageArray tracker
    await Users.findByIdAndUpdate(userId, {
      $push: { messageRooms: existingMessageCollection[0]._id },
    });

    await Users.findByIdAndUpdate(_id, {
      $push: { messageRooms: existingMessageCollection[0]._id },
    });
  }
  const newMessage = {
    createdAt: new Date(),
    createdBy: userId,
    message: data.message,
  };

  const updatedMessages = await Messages.findByIdAndUpdate(
    existingMessageCollection[0]._id,
    {
      $push: { messages: newMessage },
    },
    { new: true }
  );
  return res.json(updatedMessages[0]);
  // otherwise we can simply push to collection

  // let userMessageThread = await Messages.find({ ownerId: userId });
  // let targetMessageThread = await Messages.find({ ownerId: targetId });
  // if (!userId) return res.json({ message: "Unauthenticated" });
  // if (!mongoose.Types.ObjectId.isValid(targetId)) {
  //   return res.status(404).send("No User with that ID");
  // }
  // // check if  a message thread already exists, if not create a new one
  // // initiate a message threead for first ime use
  // if (userMessageThread.length < 1) {
  //   await Messages.create({
  //     ownerId: userId,
  //   });
  //   // will have to reassign value after new thread is created
  //   userMessageThread = await Messages.find({ ownerId: userId });
  // }
  // if (targetMessageThread.length < 1) {
  //   await Messages.create({
  //     ownerId: targetId,
  //   });
  //   targetMessageThread = await Messages.find({ ownerId: targetId });
  // }

  // let userProp = userMessageThread[0].allMessages[`${targetId}`];
  // let targetProp = targetMessageThread[0].allMessages[`${userId}`];
  // // push message to user message thread
  // if (!userProp) {
  //   userProp = [];
  // }
  // if (!targetProp) {
  //   targetProp = [];
  // }

  // userProp.push({
  //   createdAt: new Date(),
  //   messageOwner: userId,
  //   message: data.message,
  // });
  // targetProp.push({
  //   createdAt: new Date(),
  //   messageOwner: userId,
  //   message: data.message,
  // });
  // let userToUpdate = {};
  // userToUpdate[`allMessages.${targetId}`] = userProp;
  // let targetToUpdate = {};
  // targetToUpdate[`allMessages.${userId}`] = targetProp;
  // const result = await Messages.findOneAndUpdate(
  //   { ownerId: userId },
  //   { $set: { ...userToUpdate } },
  //   { new: true }
  // );
  // await Messages.findOneAndUpdate(
  //   { ownerId: targetId },
  //   { $set: { ...targetToUpdate } },
  //   { new: true }
  // );
  // // push message thread to target thread

  // // return USER thread to client
  // res.json(result.allMessages[targetId]);
};
// this will delete the entire message thread
export const deleteMessages = async (req: any, res: Response) => {
  const { id: _id } = req.params;
  const userId = req.userId;
};
