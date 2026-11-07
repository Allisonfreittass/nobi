import mongoose from 'mongoose';

const seasonSchema = new mongoose.Schema({
  name: { type: String, required: true },
  startsAt: { type: String, required: true }, // 'YYYY-MM-DD' (segunda-feira)
  endsAt: { type: String, required: true },
}, { timestamps: true });

seasonSchema.index({ startsAt: 1 }, { unique: true });

export const Season = mongoose.model('Season', seasonSchema);
