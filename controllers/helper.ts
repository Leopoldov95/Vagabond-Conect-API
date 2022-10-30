import Posts from "../models/posts";
import Users from "../models/users";
// will want to usethis method to update post details related to user settings updates
export const updateUsersPosts = async (id: String, props: any) => {
  try {
    await Posts.updateMany(
      { ownerId: id },
      {
        $set: {
          ...props,
        },
      }
    );
  } catch (error) {
    console.log(error);
  }
};

export const checkUserComments = async (postId, userId) => {
  try {
    const user: any = await Users.findById(userId);
    const post: any = await Posts.findById(postId);
    if (post.comments.length > 0) {
      for (let comments of post.comments) {
        if (comments.commentOwnerId === String(userId)) {
          if (user.commentedPosts.indexOf(String(postId)) === -1) {
            user.commentedPosts.push(String(postId));
          }
        } else {
          user.commentedPosts = user.commentedPosts.filter(
            (id) => id !== String(postId)
          );
        }
      }
      // post has no comments and we can safely remove postID from array
    } else {
      user.commentedPosts = user.commentedPosts.filter(
        (id) => id !== String(postId)
      );
    }

    await Users.findByIdAndUpdate(userId, user, { new: true });
  } catch (error) {
    console.log(error);
  }
};
// helper function to initializae message thread
