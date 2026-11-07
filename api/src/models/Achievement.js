import mongoose from 'mongoose';

const { Schema } = mongoose;

const achievementSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  code: { type: String, required: true },
  seasonId: { type: Schema.Types.ObjectId, ref: 'Season' },
  earnedAt: { type: Date, default: Date.now },
});

achievementSchema.index({ userId: 1, code: 1 }, { unique: true });

export const Achievement = mongoose.model('Achievement', achievementSchema);
