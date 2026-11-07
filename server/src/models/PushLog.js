import mongoose from 'mongoose';

const { Schema } = mongoose;

// Memória curta das notificações: evita repetir mensagem, mandar duas vezes o lembrete do dia
// ou disparar uma por reação. Some sozinha depois de 14 dias.
const pushLogSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  key: { type: String, required: true }, // ex.: 'reminder:2026-11-07', 'msg:reminder.friends', 'social:<postId>'
  createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 14 },
});

pushLogSchema.index({ userId: 1, key: 1 }, { unique: true });

export const PushLog = mongoose.model('PushLog', pushLogSchema);
