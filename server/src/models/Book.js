import mongoose from 'mongoose';

const { Schema } = mongoose;

// Livro na estante da pessoa. Páginas lidas sobem com o registro de leitura (ou à mão).
// Leitura em dupla: cada um tem a própria cópia, ligadas por buddyBookId.
const bookSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, required: true, maxlength: 160 },
  author: { type: String, default: '', maxlength: 120 },
  pages: { type: Number, default: 0, min: 0, max: 20000 },
  cover: { type: String, default: '' }, // só covers.openlibrary.org
  olKey: { type: String, default: '' }, // id da obra no Open Library, para achar o mesmo livro
  status: { type: String, enum: ['invited', 'want', 'reading', 'done'], default: 'reading' },
  pagesRead: { type: Number, default: 0, min: 0 },
  startedAt: { type: String, default: null },
  finishedAt: { type: String, default: null }, // 'YYYY-MM-DD'
  buddyBookId: { type: Schema.Types.ObjectId, ref: 'Book', default: null },
  invitedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

bookSchema.index({ userId: 1, status: 1 });

export const Book = mongoose.model('Book', bookSchema);
