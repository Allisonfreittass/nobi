import mongoose from 'mongoose';

const { Schema } = mongoose;

// Denúncia de post, pessoa ou comentário (moderação desde o dia 1)
const reportSchema = new Schema({
  reporterId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  targetType: { type: String, enum: ['post', 'user', 'comment', 'club'], required: true },
  targetId: { type: Schema.Types.ObjectId, required: true },
  clubId: { type: Schema.Types.ObjectId, ref: 'Club', default: null },
  reason: { type: String, enum: ['spam', 'assedio', 'improprio', 'falso', 'outro'], required: true },
  details: { type: String, default: '', maxlength: 500 },
  status: { type: String, enum: ['open', 'done'], default: 'open' },
  resolution: { type: String, default: '' },
}, { timestamps: true });

reportSchema.index({ clubId: 1, status: 1 });
reportSchema.index({ reporterId: 1, targetType: 1, targetId: 1 }, { unique: true });

export const Report = mongoose.model('Report', reportSchema);
