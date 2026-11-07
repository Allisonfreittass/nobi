import mongoose from 'mongoose';

const { Schema } = mongoose;

const membershipSchema = new Schema({
  clubId: { type: Schema.Types.ObjectId, ref: 'Club', required: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  role: { type: String, enum: ['member', 'moderator', 'admin'], default: 'member' },
  status: { type: String, enum: ['active', 'banned'], default: 'active' },
  joinedAt: { type: Date, default: Date.now },
  lastSeenAt: { type: Date, default: Date.now }, // para "N posts novos"
});

membershipSchema.index({ clubId: 1, userId: 1 }, { unique: true });
membershipSchema.index({ userId: 1, status: 1 });

export const Membership = mongoose.model('Membership', membershipSchema);
