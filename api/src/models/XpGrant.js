import mongoose from 'mongoose';

const { Schema } = mongoose;

// Garante XP uma vez por objetivo/dia, mesmo que o check-in seja desfeito e refeito.
// Por isso o nível nunca regride e não dá para "farmar" XP.
const xpGrantSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  key: { type: String, required: true }, // ex.: 'checkin:<goalId>:<date>'
  amount: { type: Number, required: true },
}, { timestamps: true });

xpGrantSchema.index({ userId: 1, key: 1 }, { unique: true });

export const XpGrant = mongoose.model('XpGrant', xpGrantSchema);
