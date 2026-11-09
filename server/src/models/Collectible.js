import mongoose from 'mongoose';

const { Schema } = mongoose;

// Acessório do Broto ganho numa temporada (os que vêm de conquista são calculados a partir delas)
const collectibleSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  item: { type: String, required: true },
  seasonId: { type: Schema.Types.ObjectId, ref: 'Season' },
  earnedAt: { type: Date, default: Date.now },
});

collectibleSchema.index({ userId: 1, item: 1 }, { unique: true });

export const Collectible = mongoose.model('Collectible', collectibleSchema);
