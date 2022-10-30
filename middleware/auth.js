// middleware goes here
// middleware always gets used in the routes
const jwt = require("jsonwebtoken");

// wants to like a post
// clicks the like button => auth middleware (next) => like controller....
// so what next() does, if a user clicks the like button for a post, we need to see if they are logged in or not. If they are logged in, they can proceed with the like, othewise, that action cannot be completed

const auth = async (req, res, next) => {
  try {
    // check if user is who they're claming to be
    /////////////// var names here MUST BE IN LOWERCASE!!!!!!!!!//////////////////
    // due to how headers are handled
    const token = req.headers.authorization.split(" ")[1];
    const isCustomAuth = token.length < 500; // checking to see if toke is OUR own token, if it's more than 500 characters, then it the Google Auth's token from the google signin

    let decodedData;

    if (token && isCustomAuth) {
      decodedData = jwt.verify(token, "vagabondtoken"); // 'test' is the secret keyword from the other file, THEY MUST MATCH

      req.userId = decodedData?.id;
    } else {
      // so the user is not using our web token, but google's web token
      decodedData = jwt.decode(token);

      req.userId = decodedData?.sub; // .sub is a google func that diferentiates between users
    }
    next();
  } catch (error) {
    console.log(error);
  }
};

module.exports = auth;
