import mongoose from 'mongoose';

const { Schema } = mongoose;

// Cutucada: "falta você hoje" de quem divide um objetivo/desafio. Uma por pessoa, objetivo e dia.
const nudgeSchema = new Schema({
  fromId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  toId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  goalId: { type: Schema.Types.ObjectId, ref: 'Goal', required: true },
  date: { type: String, required: true }, // dia local de quem cutucou
}, { timestamps: true });

nudgeSchema.index({ fromId: 1, toId: 1, goalId: 1, date: 1 }, { unique: true });

export const Nudge = mongoose.model('Nudge', nudgeSchema);
