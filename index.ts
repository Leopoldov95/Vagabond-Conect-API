import express from "express";
import mongoose, { ConnectOptions } from "mongoose";
import cors from "cors";
import http from "http";
import dotenv from "dotenv";
import userRoutes from "./routes/users";
import postsRoutes from "./routes/posts";
import messageRoutes from "./routes/message";
import {
  setSession,
  addNewUser,
  removeUser,
  typingNotification,
} from "./socket";

//const originURL = "https://vagabondconnect.netlify.app/";
const socket = require("socket.io");
const app = express();
const server = http.createServer(app);
dotenv.config();
const corsOptions = {
  origin: "*",
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));
app.use(express.urlencoded({ extended: true }));
app.use(express.json({ limit: "30mb" }));

const PORT = process.env.PORT || 5000;
const { MongoClient } = require("mongodb");
const client = new MongoClient(process.env.CONNECTION_URL);

app.get("/", (req, res) => {
  res.send("Hello To Vaggabond Connect API");
});
app.use("/users", userRoutes);
app.use("/posts", postsRoutes);
app.use("/message", messageRoutes);

mongoose
  .connect(process.env.CONNECTION_URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  } as ConnectOptions)
  .then(() => {
    console.log("DB Connetion Successfull");
  })
  .catch((err) => {
    console.log(err.message);
  });

// // so socket.io is INDEPENDANT of Mongodb and operates without it, it only tracks changes from the data it recieves DIRECTLY from the frontend and not from any mongodb databse...
const io = socket(server, {
  cors: {
    origin: "*",
    methods: ["PUT", "GET", "PATCH", "POST", "DELETE", "OPTIONS"],
    credentials: false,
  },
  transports: ["websocket", "polling"],
});
//   , {
//   pingTimeout: 60000,
//   cors: {
//     origin: "*", // where we want socket io to listen to
//     // credentials: true,
//     methods: ["GET", "POST", "PATCH", "PUT", "DELETE"],
//     // allowedHeaders: ["vagabond-header"],
//   },
//   transports: ["websocket", "polling"],
//   allowEIO3: true,
// });

// "connection" is the listener to use when anyone visites our website
io.on("connection", (socket) => {
  setSession(io, socket); // defines the session in another file wo we can use socket events externally
  console.log("connected to socket.io");
  // during the socket setup process, we want to grab both usersId

  socket.on("newUser", (userId) => {
    addNewUser(userId, socket.id); // we are getting the Socket object as a result of the on socket connection
  });

  socket.on("typing", (data) => {
    typingNotification(data);
  });

  socket.on("disconnect", () => {
    removeUser(socket.id);
    console.log(`${socket.id} has left the session`);
  });
});

server.listen(PORT, () => {
  console.log(`Listening on port ${PORT}`);
});

// DEPRECATE - keep as a reference

/* 
// should we always connect the two or only one once a user is online?
  socket.on("setup", (userId) => {
    socket.join(userId); // apparently this is an arbitrary value, might need need target message db id
    console.log(userId);
    socket.emit("connected");
  });
  // joins the chat
  socket.on("join room", (roomId) => {
    console.log(`User has joined room:  ${roomId}`);
  });
  // listends to new messages
  socket.on("new message", (newMessageRecieved) => {
    let chat = newMessageRecieved;
    // may want to add a checker if there are valid users
    chat.users.forEach((userId) => {
      // If I sent the message, no need to emit on my end
      if (userId === newMessageRecieved.createdBy) return;
      socket.in(userId).emit("message Recieved", newMessageRecieved);
    });
  });

*/
