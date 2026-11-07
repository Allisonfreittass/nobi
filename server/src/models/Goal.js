import mongoose from 'mongoose';

const { Schema } = mongoose;

export const CATEGORIES = ['treino', 'leitura', 'estudo', 'habito', 'objetivo', 'projeto'];
export const KINDS = ['daily', 'weekly', 'count', 'project'];

// Objetivo pessoal OU compartilhado/desafio: é o mesmo modelo (DESIGN.md §8.6).
const goalSchema = new Schema({
  ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, required: true, trim: true, maxlength: 80 },
  category: { type: String, enum: CATEGORIES, required: true },
  kind: { type: String, enum: KINDS, required: true },
  target: {
    amount: { type: Number, default: 1, min: 1 },
    unit: { type: String, default: '' }, // 'min', 'copos', 'treinos', 'lições'...
  },
  activeDays: { type: [Number], default: [0, 1, 2, 3, 4, 5, 6] }, // 0 = domingo
  color: { type: String, default: '#2E9C6A' },
  shared: {
    type: new Schema({
      mode: { type: String, enum: ['together', 'versus'], required: true },
      participants: [{ type: Schema.Types.ObjectId, ref: 'User' }],
      invited: [{ type: Schema.Types.ObjectId, ref: 'User' }],
      startsAt: { type: String }, // 'YYYY-MM-DD'
      endsAt: { type: String },   // com endsAt = desafio
      seasonId: { type: Schema.Types.ObjectId, ref: 'Season' },
      tasks: [{ key: String, label: String, pts: Number }], // checklist opcional do desafio
    }, { _id: false }),
    default: null,
  },
  milestones: [{ title: { type: String, maxlength: 80 }, done: { type: Boolean, default: false }, doneAt: String }],
  deadline: { type: String }, // legado: use dueAt
  startsAt: { type: String }, // 'YYYY-MM-DD': início, para o ritmo
  dueAt: { type: String }, // 'YYYY-MM-DD': prazo (projetos e objetivos com data)
  scheduleTime: { type: String, default: null, match: /^\d{2}:\d{2}$/ }, // hábito com horário → Rotina
  tasksMigrated: { type: Boolean, default: false },
  archivedAt: { type: Date },
}, { timestamps: true });

goalSchema.index({ 'shared.participants': 1 });
goalSchema.index({ 'shared.invited': 1 });

export const Goal = mongoose.model('Goal', goalSchema);
