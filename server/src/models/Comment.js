import mongoose from 'mongoose';

const { Schema } = mongoose;

const commentSchema = new Schema({
  postId: { type: Schema.Types.ObjectId, ref: 'Post', required: true, index: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  text: { type: String, required: true, trim: true, maxlength: 280 },
  mentions: [{ type: Schema.Types.ObjectId, ref: 'User' }], // @username citados que podem ver o post
}, { timestamps: true });

commentSchema.index({ mentions: 1, createdAt: -1 });

export const Comment = mongoose.model('Comment', commentSchema);
