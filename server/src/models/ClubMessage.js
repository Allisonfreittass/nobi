import mongoose from 'mongoose';

const { Schema } = mongoose;

// Mensagem da conversa do clube. Apagada pela moderação ou pelo autor: some para todos (fica o registro).
const clubMessageSchema = new Schema({
  clubId: { type: Schema.Types.ObjectId, ref: 'Club', required: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  text: { type: String, required: true, maxlength: 500 },
  deletedAt: { type: Date, default: null },
  deletedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

clubMessageSchema.index({ clubId: 1, createdAt: -1 });
clubMessageSchema.index({ userId: 1, createdAt: -1 });

export const ClubMessage = mongoose.model('ClubMessage', clubMessageSchema);
