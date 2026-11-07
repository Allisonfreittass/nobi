import mongoose from 'mongoose';

const { Schema } = mongoose;

// Cache derivado dos check-ins. Sempre recalculado no servidor.
const streakSchema = new Schema({
  goalId: { type: Schema.Types.ObjectId, ref: 'Goal', required: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  current: { type: Number, default: 0 },
  best: { type: Number, default: 0 },
  unit: { type: String, enum: ['days', 'weeks'], default: 'days' },
  lastDate: { type: String },
}, { timestamps: true });

streakSchema.index({ goalId: 1, userId: 1 }, { unique: true });

export const Streak = mongoose.model('Streak', streakSchema);
