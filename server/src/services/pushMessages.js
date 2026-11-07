// Mensagens das notificações, com a voz do Broto: animadas, variadas e sem culpa (DESIGN.md §8.5 e §8.9).
// Cada mensagem tem uma condição (quando faz sentido) e um peso. Escolhemos entre as que servem,
// evitando as que foram mandadas nos últimos dias.

const first = (name = '') => name.split(' ')[0];
const lower = (s = '') => s.charAt(0).toLowerCase() + s.slice(1);
const list = (names) => (names.length <= 2 ? names.join(' e ') : `${names.slice(0, 2).join(', ')} e mais ${names.length - 2}`);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const nth = (n) => `${n}º`;
const CAT_WORD = { treino: 'treino', leitura: 'leitura', estudo: 'estudo', habito: 'hábito', objetivo: 'objetivo', projeto: 'projeto' };

/**
 * Lembrete do dia. ctx:
 *  pending: [{ title, category, kind, streak, unit, need, todayValue, weekValue, unitLabel }]
 *  total, maxDays, golden, friendsDone: [nomes], challenge: { title, gap, aheadName, position } | null,
 *  hour (local), comeback (zerou recentemente)
 */
export const REMINDERS = [
  {
    id: 'shield-saved', weight: 12,
    when: (c) => c.shieldSaved,
    build: (c) => ({ title: 'Seu escudo segurou a sequência', body: `Ontem ficou protegido. Hoje é dia de seguir: ${c.pending[0].title}.` }),
  },
  {
    id: 'golden-eve', weight: 9,
    when: (c) => c.pending.some((g) => g.unit === 'days' && g.streak === 6),
    build: (c) => {
      const g = c.pending.find((x) => x.unit === 'days' && x.streak === 6);
      return pick([
        { title: 'Falta 1 dia pro Broto ficar dourado', body: `Seu 7º dia seguido de ${CAT_WORD[g.category]} está a um check-in: ${g.title}.` },
        { title: `7º dia de ${g.title}?`, body: 'Faz hoje e o Broto ganha folhas douradas. Ele já está ansioso.' },
      ]);
    },
  },
  {
    id: 'milestone-eve', weight: 8,
    when: (c) => c.pending.some((g) => g.unit === 'days' && [29, 99, 364].includes(g.streak)),
    build: (c) => {
      const g = c.pending.find((x) => x.unit === 'days' && [29, 99, 364].includes(x.streak));
      return { title: `${g.streak + 1} dias seguidos hoje?`, body: `Um check-in em ${g.title} e você fecha ${g.streak + 1} dias. Isso é raro. Bora?` };
    },
  },
  {
    id: 'one-left', weight: 7,
    when: (c) => c.pending.length === 1 && c.total > 1,
    build: (c) => pick([
      { title: 'Só falta um pra fechar o dia', body: `${c.pending[0].title} e pronto: dia completo.` },
      { title: `${c.total - 1} de ${c.total} feitos`, body: `Falta só ${c.pending[0].title}. O Broto já está ensaiando a comemoração.` },
    ]),
  },
  {
    id: 'count-close', weight: 6,
    when: (c) => c.pending.some((g) => g.kind === 'count' && g.need - g.todayValue > 0 && g.need - g.todayValue <= 3 && g.todayValue > 0),
    build: (c) => {
      const g = c.pending.find((x) => x.kind === 'count' && x.need - x.todayValue <= 3 && x.todayValue > 0);
      const left = g.need - g.todayValue;
      return { title: `Faltam ${left} ${g.unitLabel || ''}`.trim(), body: `${g.todayValue} de ${g.need} em ${g.title}. Tá quase.` };
    },
  },
  {
    id: 'weekly-close', weight: 6,
    when: (c) => c.pending.some((g) => g.kind === 'weekly' && g.need - g.weekValue === 1),
    build: (c) => {
      const g = c.pending.find((x) => x.kind === 'weekly' && x.need - x.weekValue === 1);
      return { title: 'Um e a semana fecha', body: `${g.weekValue} de ${g.need} em ${g.title}. Hoje pode ser o que fecha.` };
    },
  },
  {
    id: 'friends-done', weight: 7,
    when: (c) => c.friendsDone.length > 0,
    build: (c) => pick([
      { title: `${list(c.friendsDone)} já ${c.friendsDone.length === 1 ? 'fez' : 'fizeram'} hoje`, body: 'Sua vez? É mais leve quando é junto.' },
      { title: 'A galera está em movimento', body: `${list(c.friendsDone)} já registrou hoje. Bora junto?` },
    ]),
  },
  {
    id: 'challenge-gap', weight: 8,
    when: (c) => c.challenge && c.challenge.aheadName && c.challenge.gap > 0 && c.challenge.gap <= 80,
    build: (c) => pick([
      { title: `${c.challenge.gap} pts pra passar ${c.challenge.aheadName}`, body: `No ${c.challenge.title} dá pra virar hoje. Você está em ${nth(c.challenge.position)}.` },
      { title: `${c.challenge.title}: ${nth(c.challenge.position)} lugar`, body: `${c.challenge.aheadName} está logo ali: ${c.challenge.gap} pts de diferença.` },
    ]),
  },
  {
    id: 'challenge-lead', weight: 6,
    when: (c) => c.challenge && c.challenge.position === 1,
    build: (c) => ({ title: `Você lidera o ${c.challenge.title}`, body: 'Um check-in hoje e a liderança continua sua.' }),
  },
  {
    id: 'golden-keep', weight: 5,
    when: (c) => c.golden && c.maxDays >= 7,
    build: (c) => pick([
      { title: 'Folhas douradas pedem mais um dia', body: `${c.maxDays} dias de brilho. Um check-in mantém o Broto assim.` },
      { title: `${c.maxDays} dias de Broto dourado`, body: 'Ele não para de se olhar no espelho. Bora manter?' },
    ]),
  },
  {
    id: 'streak-alive', weight: 5,
    when: (c) => c.pending.some((g) => g.streak >= 2),
    build: (c) => {
      const g = [...c.pending].sort((a, b) => b.streak - a.streak)[0];
      const u = g.unit === 'weeks' ? 'semanas' : 'dias';
      return pick([
        { title: `${g.streak} ${u} de ${g.title}`, body: 'Sua sequência está esperando o de hoje.' },
        { title: 'Sua chama está acesa', body: `${g.streak} ${u} seguidos em ${g.title}. Hoje é mais um?` },
      ]);
    },
  },
  {
    id: 'early-days', weight: 5,
    when: (c) => c.pending.some((g) => g.streak === 1 && g.unit === 'days'),
    build: (c) => {
      const g = c.pending.find((x) => x.streak === 1 && x.unit === 'days');
      return { title: `Dia 2 de ${g.title}`, body: 'O segundo dia é o que transforma em hábito. O Broto aposta em você.' };
    },
  },
  {
    id: 'comeback', weight: 6,
    when: (c) => c.comeback,
    build: (c) => pick([
      { title: 'Que bom te ver por aqui', body: `Hoje é um ótimo dia pra voltar: ${c.pending[0].title}. O Broto guardou seu lugar.` },
      { title: 'Recomeçar também conta', body: `Um check-in em ${c.pending[0].title} e a chama acende de novo.` },
    ]),
  },
  {
    id: 'late', weight: 6,
    when: (c) => c.hour >= 21,
    build: (c) => ({ title: 'Ainda dá tempo', body: `O dia só acaba à meia-noite. ${c.pending.length === 1 ? `${c.pending[0].title} cabe` : 'Um check-in cabe'} antes de dormir.` }),
  },
  {
    id: 'small-step', weight: 3,
    when: (c) => c.pending.some((g) => g.kind === 'daily'),
    build: (c) => {
      const g = c.pending.find((x) => x.kind === 'daily');
      return pick([
        { title: 'Dois minutos já contam', body: `Um pouquinho de ${lower(g.title)} hoje mantém tudo vivo.` },
        { title: 'Pequeno passo, mesma chama', body: `Não precisa ser perfeito: ${lower(g.title)} hoje já vale.` },
      ]);
    },
  },
  {
    id: 'generic', weight: 1,
    when: () => true,
    build: (c) => pick([
      { title: c.pending.length === 1 ? `Falta ${c.pending[0].title} hoje` : `Faltam ${c.pending.length} hoje`, body: 'Cada objetivo tem a sua sequência. Faz o que der.' },
      { title: 'O Broto passou pra dar um oi', body: c.pending.length === 1 ? `${c.pending[0].title} ainda está em aberto hoje.` : `${c.pending.length} objetivos em aberto hoje. Escolhe um?` },
    ]),
  },
];

/** Escolhe uma mensagem que sirva para o contexto e não tenha sido usada há pouco. */
export function chooseMessage(pool, ctx, recentIds = []) {
  const fits = pool.filter((m) => { try { return m.when(ctx); } catch { return false; } });
  const fresh = fits.filter((m) => !recentIds.includes(m.id));
  const options = fresh.length ? fresh : fits;
  const total = options.reduce((s, m) => s + m.weight, 0);
  let r = Math.random() * total;
  for (const m of options) {
    r -= m.weight;
    if (r <= 0) return { id: m.id, ...m.build(ctx) };
  }
  const m = options[options.length - 1];
  return { id: m.id, ...m.build(ctx) };
}

// Avisos sociais: também variam para não parecer robô
export const social = {
  reaction: (who, count, what) => pick([
    { title: count > 1 ? `${first(who)} e mais ${count - 1} disseram Boa!` : `${first(who)} disse Boa!`, body: what ? `No seu post: ${what}` : 'Pro seu registro de hoje.' },
    { title: count > 1 ? `${count} Boa! no seu post` : `Boa! de ${first(who)}`, body: what || 'Sua evolução está inspirando gente.' },
  ]),
  comment: (who, text) => ({ title: `${first(who)} comentou`, body: text.length > 120 ? `${text.slice(0, 117)}...` : text }),
  followRequest: (who) => ({ title: `${first(who)} quer te seguir`, body: 'Aceite para acompanharem a evolução um do outro.' }),
  invite: (who, goal, mode) => pick([
    { title: `${first(who)} te chamou pro ${goal}`, body: mode === 'versus' ? 'Disputa com ranking semanal. Topa?' : 'Juntos, sem competição. Topa?' },
    { title: 'Convite pra evoluir junto', body: `${first(who)} quer você no ${goal}.` },
  ]),
  inviteJoined: (who) => pick([
    { title: `${first(who)} entrou no Nobi pelo seu convite`, body: 'Agora vocês são amigos. Mandem um Boa! um pro outro.' },
    { title: 'Seu convite funcionou', body: `${first(who)} chegou. Evoluir fica melhor quando é junto.` },
  ]),
  joined: (who, goal) => ({ title: `${first(who)} topou o ${goal}`, body: 'O grupo cresceu. Bora?' }),
  friendMilestone: (who, title) => pick([
    { title: `${first(who)}: ${lower(title)}`, body: 'Manda um Boa! pra comemorar junto.' },
    { title: `${first(who)} chegou num marco`, body: `${title}. Que tal um Boa!?` },
  ]),
  overtaken: (who, goal, gap) => pick([
    { title: `${first(who)} passou você no ${goal}`, body: gap <= 20 ? `Diferença de ${gap} pts. Um check-in e você volta.` : 'A semana ainda não acabou. Bora retomar?' },
    { title: `Movimento no ${goal}`, body: `${first(who)} subiu no ranking e passou você. Ainda dá tempo.` },
  ]),
};
