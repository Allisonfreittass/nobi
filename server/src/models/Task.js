import mongoose from 'mongoose';

const { Schema } = mongoose;

// Tarefa (DESIGN.md 8.1 e 8.2): etapa de projeto (parentId null), subetapa (parentId = etapa)
// ou item avulso ligado a um objetivo. Máximo 2 níveis. Marco de projeto = isMilestone.
const taskSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  goalId: { type: Schema.Types.ObjectId, ref: 'Goal', required: true, index: true },
  parentId: { type: Schema.Types.ObjectId, ref: 'Task', default: null },
  title: { type: String, required: true, trim: true, maxlength: 120 },
  dueDate: { type: String, default: null }, // 'YYYY-MM-DD'
  isMilestone: { type: Boolean, default: false },
  priorityDate: { type: String, default: null }, // escolhida como prioridade nesse dia (máx. 3 por dia)
  order: { type: Number, default: 0 },
  doneAt: { type: Date, default: null },
  doneDate: { type: String, default: null }, // dia local em que foi concluída (para as visões)
}, { timestamps: true });

taskSchema.index({ userId: 1, dueDate: 1 });
taskSchema.index({ userId: 1, priorityDate: 1 });
taskSchema.index({ userId: 1, doneDate: 1 });

export const Task = mongoose.model('Task', taskSchema);
