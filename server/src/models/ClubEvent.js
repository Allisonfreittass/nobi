import mongoose from 'mongoose';

const { Schema } = mongoose;

// Evento do clube: "corrida sábado 7h". Data e hora locais do clube; quem vai marca "Vou".
const clubEventSchema = new Schema({
  clubId: { type: Schema.Types.ObjectId, ref: 'Club', required: true },
  title: { type: String, required: true, maxlength: 80 },
  date: { type: String, required: true }, // 'YYYY-MM-DD'
  time: { type: String, required: true, match: /^\d{2}:\d{2}$/ },
  place: { type: String, default: '', maxlength: 120 }, // "Praça da Liberdade" ou "Online"
  description: { type: String, default: '', maxlength: 500 },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  going: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  canceledAt: { type: Date, default: null },
}, { timestamps: true });

clubEventSchema.index({ clubId: 1, date: 1 });
clubEventSchema.index({ going: 1, date: 1 });

export const ClubEvent = mongoose.model('ClubEvent', clubEventSchema);
