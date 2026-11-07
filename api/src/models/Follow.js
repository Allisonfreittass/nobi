import mongoose from 'mongoose';

const { Schema } = mongoose;

const followSchema = new Schema({
  followerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  followeeId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['pending', 'accepted'], default: 'accepted' },
}, { timestamps: true });

followSchema.index({ followerId: 1, followeeId: 1 }, { unique: true });
followSchema.index({ followeeId: 1, status: 1 });

export const Follow = mongoose.model('Follow', followSchema);
