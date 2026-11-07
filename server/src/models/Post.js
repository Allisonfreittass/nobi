import mongoose from 'mongoose';

const { Schema } = mongoose;

// Só existe se o usuário escolheu postar (DESIGN.md §8.1 e §8.2).
const postSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  goalId: { type: Schema.Types.ObjectId, ref: 'Goal' },
  checkinId: { type: Schema.Types.ObjectId, ref: 'Checkin' },
  audience: { type: String, enum: ['friends', 'public'], required: true },
  kind: { type: String, enum: ['checkin', 'milestone', 'record', 'start', 'weekly'], default: 'checkin' },
  category: { type: String },
  title: { type: String, default: '' }, // ex.: "7 dias seguidos de leitura"
  metrics: {
    minutes: Number, pages: Number, km: Number, deltaVsLastMonth: Number, streak: Number, streakUnit: String,
  },
  text: { type: String, default: '', maxlength: 500 },
  photo: { type: new Schema({ url: String, w: Number, h: Number }, { _id: false }), default: null },
  date: { type: String }, // 'YYYY-MM-DD' local de quem postou (anel "postou hoje")
  reactions: [{ userId: { type: Schema.Types.ObjectId, ref: 'User' }, type: { type: String, default: 'boa' }, at: { type: Date, default: Date.now }, _id: false }],
  commentsCount: { type: Number, default: 0 },
}, { timestamps: true });

postSchema.index({ createdAt: -1 });
postSchema.index({ userId: 1, date: 1 });

export const Post = mongoose.model('Post', postSchema);
