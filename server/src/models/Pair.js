import mongoose from 'mongoose';

const { Schema } = mongoose;

// Sequência a dois: um amigo convida, o outro aceita. O dia conta quando os dois registram algo.
const pairSchema = new Schema({
  users: { type: [{ type: Schema.Types.ObjectId, ref: 'User' }], validate: (v) => v.length === 2 }, // ordenados
  key: { type: String, required: true, unique: true }, // "idMenor:idMaior": uma por dupla
  status: { type: String, enum: ['pending', 'active'], default: 'pending' },
  invitedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  startedAt: { type: String, default: null }, // 'YYYY-MM-DD' em que o outro aceitou
}, { timestamps: true });

pairSchema.index({ users: 1, status: 1 });

export const Pair = mongoose.model('Pair', pairSchema);
