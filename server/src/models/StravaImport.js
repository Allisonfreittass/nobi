import mongoose from 'mongoose';

const { Schema } = mongoose;

// Atividade do Strava já importada (nunca importa duas vezes).
const stravaImportSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  activityId: { type: String, required: true },
  goalId: { type: Schema.Types.ObjectId, ref: 'Goal' },
  date: { type: String },
}, { timestamps: true });

stravaImportSchema.index({ userId: 1, activityId: 1 }, { unique: true });

export const StravaImport = mongoose.model('StravaImport', stravaImportSchema);
