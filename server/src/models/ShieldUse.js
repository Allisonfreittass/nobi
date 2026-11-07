import mongoose from 'mongoose';

const { Schema } = mongoose;

// Dia em que um escudo protegeu as sequências da pessoa
const shieldUseSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: String, required: true }, // 'YYYY-MM-DD' protegido
  seen: { type: Boolean, default: false },
}, { timestamps: true });

shieldUseSchema.index({ userId: 1, date: 1 }, { unique: true });

export const ShieldUse = mongoose.model('ShieldUse', shieldUseSchema);
