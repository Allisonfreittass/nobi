import mongoose from 'mongoose';

const { Schema } = mongoose;

const setSchema = new Schema({
  reps: { type: Number, default: 0, min: 0, max: 1000 },
  load: { type: Number, default: 0, min: 0, max: 2000 }, // kg
  done: { type: Boolean, default: true },
}, { _id: false });

// O nome fica copiado na sessão: editar o programa depois não reescreve o histórico.
const loggedExerciseSchema = new Schema({
  key: { type: String, default: '' },
  name: { type: String, required: true, trim: true, maxlength: 60 },
  sets: { type: [setSchema], default: [] },
}, { _id: false });

/** Treino feito num dia: uma sessão por programa por dia. Salvar de novo no mesmo dia atualiza. */
const workoutSessionSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  planId: { type: Schema.Types.ObjectId, ref: 'WorkoutPlan', required: true },
  date: { type: String, required: true }, // 'YYYY-MM-DD' local
  dayKey: { type: String, default: '' },
  dayName: { type: String, default: '', maxlength: 40 },
  exercises: { type: [loggedExerciseSchema], default: [] },
  minutes: { type: Number, default: 0, min: 0, max: 600 },
  note: { type: String, default: '', maxlength: 280 },
}, { timestamps: true });

workoutSessionSchema.index({ planId: 1, date: 1 }, { unique: true });
workoutSessionSchema.index({ userId: 1, date: 1 });

export const WorkoutSession = mongoose.model('WorkoutSession', workoutSessionSchema);
