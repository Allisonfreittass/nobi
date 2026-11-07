import mongoose from 'mongoose';

const { Schema } = mongoose;

// Um registro por usuário/objetivo/dia (e por tarefa, em desafios com checklist).
// Registrar de novo no mesmo dia soma ao registro existente.
const checkinSchema = new Schema({
  goalId: { type: Schema.Types.ObjectId, ref: 'Goal', required: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: String, required: true }, // 'YYYY-MM-DD' local
  taskKey: { type: String, default: '' },
  value: { type: Number, default: 1, min: 0 },
  minutes: { type: Number, default: 0, min: 0 },
  pages: { type: Number, default: 0, min: 0 },
  km: { type: Number, default: 0, min: 0 },
  note: { type: String, default: '', maxlength: 280 },
}, { timestamps: true });

checkinSchema.index({ goalId: 1, userId: 1, date: 1, taskKey: 1 }, { unique: true });
checkinSchema.index({ userId: 1, date: 1 });
checkinSchema.index({ goalId: 1, date: 1 });

export const Checkin = mongoose.model('Checkin', checkinSchema);
