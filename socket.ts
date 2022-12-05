let io, socket;

export let onlineUsers: any = [];

export const addNewUser = (userId, socketId) => {
  if (!onlineUsers.some((user: any) => user.userId === userId)) {
    onlineUsers.push({ userId, socketId });
    console.log(`${userId} has been added to session!`);
  }
};

// on diconnect - remove the user
export const removeUser = (socketId) => {
  onlineUsers = onlineUsers.filter((user) => user.socketId !== socketId);
};

export const getUser = (userId) => {
  return onlineUsers.find((user) => user.userId === userId);
};

export const setSession = (setIo, setSocket) => {
  io = setIo;
  socket = setSocket;
};

// Functions that should ONLY EMIT to other users, do not use these to update the activer user's UI

export const updateNotification = (mongoId, notifications) => {
  const target = getUser(mongoId);
  io.to(target.socketId).emit("notification", notifications);
};

export const typingNotification = (data) => {
  const { sender, receiver } = data;
  const target = getUser(receiver);
  if (target) {
    io.to(target.socketId).emit("composing", sender);
  }
};

// this method is being used to update the message list AND notifications in real time
export const updateMessageSocket = (mongoId, data) => {
  // 10/16/2022 - becuase there is not active online user, no need to emitt a socket signal
  const target = getUser(mongoId);
  if (target) {
    // 11/14/22 -> issue with msg notification badge, this is being sent to the cient containining ONLY user id, but we need chatroom id in order to append msgNotification to client
    io.to(target.socketId).emit("newMessage", data);
  } else {
    console.error("user not found!");
  }
};
