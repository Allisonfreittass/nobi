import mongoose from 'mongoose';

const { Schema } = mongoose;

// Exercício planejado de uma divisão. "reps" é texto para aceitar faixas ("8-12") e tempo ("30 s").
const plannedExerciseSchema = new Schema({
  key: { type: String, required: true },
  name: { type: String, required: true, trim: true, maxlength: 60 },
  sets: { type: Number, default: 3, min: 1, max: 20 },
  reps: { type: String, default: '10', maxlength: 12 },
  load: { type: Number, default: 0, min: 0, max: 2000 }, // kg planejados
  notes: { type: String, default: '', maxlength: 120 },
}, { _id: false });

// Divisão do programa (Treino A, B, C…). As sessões seguem as divisões em rodízio.
const workoutDaySchema = new Schema({
  key: { type: String, required: true },
  name: { type: String, required: true, trim: true, maxlength: 40 },
  exercises: { type: [plannedExerciseSchema], default: [] },
}, { _id: false });

/**
 * Programa de treino da biblioteca. Dura um número de treinos (não de dias no calendário):
 * faltar um dia não "queima" o programa. Cada sessão concluída avança o progresso.
 * Arquivado = vai para o Histórico e alimenta os resumos e comparações.
 */
const workoutPlanSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true, trim: true, maxlength: 60 },
  totalSessions: { type: Number, required: true, min: 1, max: 365 },
  dueAt: { type: String, default: null }, // 'YYYY-MM-DD' opcional, só referência
  goalId: { type: Schema.Types.ObjectId, ref: 'Goal', default: null }, // objetivo de treino que ganha o check-in
  days: { type: [workoutDaySchema], default: [] },
  startedAt: { type: String }, // 'YYYY-MM-DD'
  completedAt: { type: String, default: null }, // dia em que bateu o total de treinos
  archivedAt: { type: Date, default: null },
}, { timestamps: true });

workoutPlanSchema.index({ userId: 1, archivedAt: 1 });

export const WorkoutPlan = mongoose.model('WorkoutPlan', workoutPlanSchema);
