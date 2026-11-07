import mongoose from 'mongoose';

const { Schema } = mongoose;

// Um aparelho/navegador que aceitou receber notificações
const pushSubscriptionSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  endpoint: { type: String, required: true, unique: true },
  keys: { p256dh: { type: String, required: true }, auth: { type: String, required: true } },
  userAgent: { type: String, default: '' },
  lastSuccessAt: { type: Date },
}, { timestamps: true });

export const PushSubscription = mongoose.model('PushSubscription', pushSubscriptionSchema);
