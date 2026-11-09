import mongoose from 'mongoose';

const { Schema } = mongoose;

const userSchema = new Schema({
  name: { type: String, required: true, trim: true, maxlength: 60 },
  username: { type: String, required: true, unique: true, lowercase: true, trim: true, match: /^[a-z0-9_.]{3,24}$/ },
  email: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
  passwordHash: { type: String },
  emailVerified: { type: Boolean, default: false }, // provado por Google ou por link de e-mail
  sessionsValidAfter: { type: Date }, // tokens emitidos antes disso deixam de valer
  googleId: { type: String, unique: true, sparse: true },
  appleId: { type: String, unique: true, sparse: true }, // 'sub' do Sign in with Apple
  brotoAccessory: { type: String, default: null },
  onboardingDismissedAt: { type: Date, default: null },
  readingGoal: { type: new Schema({ year: Number, books: Number }, { _id: false }), default: null }, // meta de livros no ano // fechou o cartão "Primeiros passos" // acessório que o Broto está vestindo (ver services/collectibles.js)
  bio: { type: String, default: '', maxlength: 120 },
  avatarUrl: { type: String, default: '' }, // '' = inicial, 'broto' = avatar do Broto, data:/https: = foto
  avatarColor: { type: String, default: '#FFD8C7' },
  interests: { type: [String], default: [] },
  city: { type: String, default: '', maxlength: 60 }, // para "Perto de você" na Comunidade
  xp: { type: Number, default: 0 },
  level: { type: Number, default: 1 },
  privacy: {
    profile: { type: String, enum: ['friends', 'public'], default: 'friends' },
    approveFollowers: { type: Boolean, default: false },
    stats: { type: String, enum: ['friends', 'public'], default: 'friends' },
  },
  prefs: {
    theme: { type: String, enum: ['light', 'dark', 'system'], default: 'system' },
    weekStart: { type: String, enum: ['mon', 'sun'], default: 'mon' },
    mascotMotion: { type: Boolean, default: true },
    reminderTime: { type: String, default: '20:00', match: /^\d{2}:\d{2}$/ },
    notify: {
      checkin: { type: Boolean, default: true },
      social: { type: Boolean, default: true },
      challenges: { type: Boolean, default: true },
    },
  },
  comebackSeenFor: { type: String, default: '' }, // data do último registro cuja tela de volta já foi vista
  shieldsEarnedSeen: { type: Number, default: 0 }, // quantos escudos ganhos a pessoa já viu (para o aviso)
  timeZone: { type: String, default: 'America/Sao_Paulo' }, // para o lembrete sair no horário de quem usa
  staff: { type: Boolean, default: false }, // Equipe Nobi: modera denúncias e clubes (ou e-mail em STAFF_EMAILS)
  suspendedAt: { type: Date, default: null, index: true }, // conta suspensa pela moderação: não entra e some da descoberta
  suspendedReason: { type: String, default: '' },
  demo: { type: Boolean, default: false, index: true }, // conta do seed: nunca aparece em descoberta
  blocked: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  notificationsSeenAt: { type: Date, default: () => new Date(0) },
  resetToken: { type: String },
  resetTokenExpiresAt: { type: Date },
}, { timestamps: true });

export const User = mongoose.model('User', userSchema);
