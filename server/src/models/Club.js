import mongoose from 'mongoose';

const { Schema } = mongoose;

// Clube (DESIGN.md §7): oficial (curado pela Equipe Nobi), aberto (criado por alguém, que vira admin)
// ou grupo privado de amigos.
// Só posts Públicos e da categoria do clube aparecem nele.
const clubSchema = new Schema({
  name: { type: String, required: true, trim: true, maxlength: 60 },
  slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
  category: { type: String, required: true }, // categoria de objetivo usada para filtrar posts
  interest: { type: String, default: '' }, // rótulo do interesse (Corrida, Idiomas, Fé e devocional...)
  city: { type: String, default: '' }, // "Varginha, MG" ou "Online"
  region: { type: String, default: '' }, // "Sul de Minas"
  kind: { type: String, enum: ['official', 'open', 'private'], default: 'official' },
  description: { type: String, default: '', maxlength: 300 },
  rules: { type: String, default: '', maxlength: 1500 },
  pinned: { type: String, default: '', maxlength: 280 }, // aviso fixado
  pinnedPostId: { type: Schema.Types.ObjectId, ref: 'Post', default: null },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

clubSchema.index({ city: 1, category: 1 });
clubSchema.index({ region: 1 });

export const Club = mongoose.model('Club', clubSchema);
