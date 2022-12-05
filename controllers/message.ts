import mongoose from "mongoose";
//import Users from "../models/users";
import Messages from "../models/messages";
import Users from "../models/users";
import { Request, Response } from "express";
import { updateMessageSocket } from "../socket";
// fetch all open messages from users message db
export const fetchAllContacts = async (req: any, res: Response) => {
  const _id = req.userId;
  const contactList: any[] = [];

  interface userObj {
    _id: String;
    messageRoom: String;
    profile_cloudinary: String;
    firstName: String;
    lastName: String;
  }

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

        const { profile_cloudinary, firstName, lastName } =
          await Users.findById(targetUser);
        let tempObj: userObj = {
          _id: targetUser[0],
          messageRoom: room,
          profile_cloudinary: profile_cloudinary,
          firstName: firstName,
          lastName: lastName,
        };
        contactList.push(tempObj);
      }
    }
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
      $and: [{ users: { $in: [userId] } }, { users: { $in: [_id] } }],
    });

    if (messageCollection.length < 1) {
      return res.json({ message: "No messages" });
    } else {
      res.json(messageCollection[0]);
    }
  } catch (error) {
    res.status(500).json({ message: "Something went wrong" });
  }
};
// this will post a new message to the thread
export const postMessage = async (req: any, res: Response) => {
  const { id: _id } = req.params; // message raceiver user id
  const userId = req.userId; // authenticated user ID
  const data = req.body;
  let existingMessageCollection,
    updatedUserMessageRoom,
    updatedTargetUserMessageRoom;
  let updateUser = false; // this flag will determine if we need to update user info on client side
  // check if an instance of a message collection already exists, if not then need to create one
  let updateTargetUserMsgRoom = false; //this flag will do the same as above BUT for the target user
  let contactList: any[] = []; // optional variable if we need to update the recipients messageRoomList

  interface userObj {
    _id: String;
    messageRoom: String;
    profile_cloudinary: String;
    firstName: String;
    lastName: String;
  }

  existingMessageCollection = await Messages.find({
    $and: [{ users: { $in: [userId] } }, { users: { $in: [_id] } }],
  });

  if (existingMessageCollection.length < 1) {
    updateUser = true;
    // create a new instance
    await Messages.create({
      users: [userId, _id],
    });

    // Once a message room has been created, immeditaltey update the variable
    existingMessageCollection = await Messages.find({
      $and: [{ users: { $in: [userId] } }, { users: { $in: [_id] } }],
    });
    // add to both users messageArray tracker
    await Users.findByIdAndUpdate(userId, {
      $push: { messageRooms: existingMessageCollection[0]._id },
    });

    await Users.findByIdAndUpdate(_id, {
      $push: { messageRooms: existingMessageCollection[0]._id },
    });
  }

  // fetch record for active user
  let user = await Users.findById(userId);
  // fetch record for the target (recipient) user
  let targetUser = await Users.findById(_id);
  // IF a Message collection exists for these 2 users BUT the active user DOES NOT contain it in their User collection (this will occur if active user had previously deleted Message Thred)
  if (
    existingMessageCollection &&
    !user.messageRooms.includes(existingMessageCollection[0]._id)
  ) {
    updateUser = true;
    updatedUserMessageRoom = await Users.findByIdAndUpdate(
      userId,
      {
        $push: { messageRooms: existingMessageCollection[0]._id },
      },
      { new: true }
    );
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

  //let { messageNotifications }: any = await Users.findById(_id);
  // if no messageNotifcation instance exists, create a new one
  if (!user.messageNotifications) {
    user.messageNotifications = {};
    user.messageNotifications[userId] = 1;
  } else {
    if (user.messageNotifications[userId]) {
      user.messageNotifications[userId]++;
    } else {
      user.messageNotifications[userId] = 1;
    }
  }
  // update database
  // CLIENT - we want to ONLY show latest message per user on the notification menu with a snippet of the latest message
  // CLIENT - on message, scroll to bottom of messages
  // this will be the updated DB data for the receiver

  let updatedTargetUser;
  // same check as above BUT for the target user
  // update target user messageRoom if necessary
  if (
    existingMessageCollection &&
    !targetUser.messageRooms.includes(existingMessageCollection[0]._id)
  ) {
    updateTargetUserMsgRoom = true;
    updatedTargetUser = await Users.findByIdAndUpdate(
      _id,
      {
        $push: { messageRooms: existingMessageCollection[0]._id },
        messageNotifications: user.messageNotifications,
      },
      { new: true }
    );
    // only update the target user's notification
  } else {
    updatedTargetUser = await Users.findByIdAndUpdate(
      _id,
      { messageNotifications: user.messageNotifications },
      { new: true }
    );
  }

  // If we had to update the recipients messageRoom, update that info on their end
  if (updateTargetUserMsgRoom) {
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

        const { profile_cloudinary, firstName, lastName } =
          await Users.findById(targetUser);
        let tempObj: userObj = {
          _id: targetUser[0],
          messageRoom: room,
          profile_cloudinary: profile_cloudinary,
          firstName: firstName,
          lastName: lastName,
        };
        contactList.push(tempObj);
      }
    }
  }

  // here we want to use socket to update message reciever
  const socketMessage = {
    users: updatedMessages.users,
    messages: updatedMessages.messages,
    _id: updatedMessages._id,
  };
  const socketNotif = updatedTargetUser.messageNotifications;

  if (updateTargetUserMsgRoom) {
    updateMessageSocket(_id, {
      socketMessage,
      socketNotif,
      updatedTargetUser,
      contactList,
    });
  } else {
    updateMessageSocket(_id, { socketMessage, socketNotif, updatedTargetUser });
  }

  // this will return the updated Message room AND IF the user room sleection has been upated, it will update that too.
  return res.status(200).json({ updatedMessages, user: updateUser });
};
// this will delete the entire message thread
export const deleteMessages = async (req: any, res: Response) => {
  try {
    const { id: _id } = req.params; // id of messageRoom to remove from messageList
    const userId = req.userId; // active client id

    const user = await Users.findById(userId);
    let { messageRooms } = user;
    messageRooms = messageRooms.filter((room) => room !== _id);

    const updatedUser = await Users.findByIdAndUpdate(
      { _id: userId },
      { messageRooms: messageRooms },
      { new: true }
    );

    res.status(200).json(updatedUser);
  } catch (error) {
    res.status(500).json({ message: "Something went wrong" });
  }
};

// Clear Notifications
export const clearMessageNotifications = async (
  req: Request,
  res: Response
) => {
  try {
    const { id: _id } = req.params;
    const user = await Users.findByIdAndUpdate(
      _id,
      { messageNotifications: [] },
      { new: true }
    );
    return res.send(200).json(user);
  } catch (error) {
    res.status(500).json({ message: "Something went wrong." });
  }
};
