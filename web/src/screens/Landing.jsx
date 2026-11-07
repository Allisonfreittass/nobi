import { Link } from 'react-router-dom';
import Broto from '../components/Broto.jsx';
import Icon from '../components/Icon.jsx';
import { Logo } from '../components/Logo.jsx';
import { RingProgress, StreakPill, WeekDots, ProgressBar } from '../components/ui.jsx';
import { APP_NAME, MASCOT_NAME } from '../config.js';

// Landing: interface sóbria em volta do Broto (DESIGN.md §2 e §6).
// O Broto aparece sempre de corpo inteiro; sobre coral ou tinta fica num disco/cartão claro.

const ORBITA = 'var(--nobi-orbita)';
const BRASA = 'var(--nobi-brasa)';

const STAGES = [
  { stage: 'broto', name: 'Broto', levels: '1–9' },
  { stage: 'muda', name: 'Muda', levels: '10–24' },
  { stage: 'botao', name: 'Botão', levels: '25–49' },
  { stage: 'flor', name: 'Flor', levels: '50+' },
];

const MOODS = [
  { expression: 'comemorando', label: 'Comemora suas conquistas' },
  { expression: 'foco', label: 'Foca com você nos desafios' },
  { expression: 'descanso', label: 'Descansa nos dias de folga' },
  { expression: 'saudade', label: 'Sente saudade, sem cobrar' },
];

const STREAKS = [
  { title: 'Ler 20 min', color: ORBITA, value: 21, unit: 'dias' },
  { title: 'Beber 2 L de água', color: 'var(--nobi-cat-habito)', value: 12, unit: 'dias' },
  { title: 'Treinar 4x', color: BRASA, value: 6, unit: 'sem.' },
];

const RANKING = [
  { pos: 1, name: 'Júlia', pts: 325 },
  { pos: 2, name: 'Você', pts: 270, me: true },
  { pos: 3, name: 'Caio', pts: 255 },
];

const PRINCIPLES = [
  ['Sem culpa', 'Perdeu a sequência? Nada de aviso vermelho. Seu nível e suas conquistas ficam.'],
  ['Privado por padrão', 'Um objetivo que você nunca postou é só seu. Você escolhe quem vê seu perfil.'],
  ['Lembretes com respeito', 'No máximo um por dia, no horário que você escolher, e só se faltar algo.'],
];

const Dot = () => <span className="lp-accent">.</span>;

// Prévia ilustrativa da tela de Metas, montada com os componentes reais do app
const days = (states) => states.map((state, i) => ({ date: `d${i}`, state, today: i === 6 }));

function PreviewGoal({ icon, color, title, sub, streak, week, value, aside }) {
  return (
    <div className="card stack gap-10 lp-preview-card">
      <div className="row gap-10">
        <span className="lp-goal-icon" style={{ background: color }}><Icon name={icon} size={16} stroke={2.2} /></span>
        <span className="stack grow" style={{ gap: 0 }}><span className="strong t-14">{title}</span><span className="t-12 muted">{sub}</span></span>
        {streak}
      </div>
      <ProgressBar value={value} color={color} height={6} />
      <div className="row between">
        <WeekDots days={days(week)} color={color} />
        {aside}
      </div>
    </div>
  );
}

function PhonePreview() {
  return (
    <div className="lp-phone" aria-hidden="true">
      <div className="lp-phone-screen">
        <div className="stack gap-12 lp-phone-body">
          <div className="stack" style={{ gap: 2 }}>
            <span className="t-12 secondary">Sexta, 6 de novembro</span>
            <span className="title lp-phone-title">Meus objetivos</span>
          </div>
          <div className="card row gap-12 lp-preview-card">
            <RingProgress value={0.75} size={54} thickness={7}><span className="num t-14">3/4</span></RingProgress>
            <div className="stack" style={{ gap: 2 }}>
              <span className="title t-16">Falta 1 hoje</span>
              <span className="t-12 muted">Cada objetivo tem a sua sequência.</span>
            </div>
          </div>
          <PreviewGoal
            icon="book" color={ORBITA} title="Ler 20 min" sub="Hábito diário" value={1}
            streak={<StreakPill value={7} unit="dias" active />}
            week={['done', 'done', 'done', 'done', 'done', 'done', 'done']}
            aside={<span className="lp-done"><Icon name="check" size={13} stroke={2.6} /> Feito</span>}
          />
          <PreviewGoal
            icon="dumbbell" color={BRASA} title="Treinar 4x" sub="Com Caio e Júlia" value={0.75}
            streak={<StreakPill value={6} unit="sem." />}
            week={['done', 'miss', 'done', 'miss', 'done', 'miss', 'today']}
            aside={<span className="t-12 strong">3 de 4</span>}
          />
        </div>
      </div>
    </div>
  );
}

function Feature({ n, title, text, children }) {
  return (
    <article className="lp-feature">
      <div className="stack gap-12">
        <span className="lp-index">{n}</span>
        <h3 className="lp-h3">{title}</h3>
        <p className="lp-p">{text}</p>
      </div>
      <div className="lp-vignette" aria-hidden="true">{children}</div>
    </article>
  );
}

function Hero() {
  return (
    <section className="lp-hero">
      <div className="lp-wrap lp-hero-grid">
        <div className="stack gap-24 lp-hero-copy">
          <span className="lp-eyebrow"><span className="lp-dot" />{APP_NAME}: evolua junto</span>
          <h1 className="lp-title">Evoluir fica melhor quando é junto<Dot /></h1>
          <p className="lp-lead">Objetivos com sequência própria, registros em um toque e amigos para celebrar cada passo. Sem culpa, sem pressão.</p>
          <div className="row gap-12 wrap">
            <Link to="/entrar?modo=criar" className="btn btn-primary lp-cta-main">Criar conta grátis</Link>
            <Link to="/entrar" className="btn btn-ghost lp-cta-ghost">Já tenho conta <Icon name="chevron" size={18} /></Link>
          </div>
          <span className="t-13 muted">No navegador do celular e do computador.</span>
        </div>
        <div className="lp-hero-visual">
          <div className="lp-hero-backdrop" />
          <PhonePreview />
          <div className="lp-mascot nobi-hop">
            <span className="broto-plate round">
              <Broto size={140} golden expression="comemorando" shadow={false} title={`${MASCOT_NAME} dourado comemorando 7 dias seguidos`} priority />
            </span>
          </div>
          <div className="lp-toast" aria-hidden="true">
            <span className="lp-toast-icon"><Icon name="flame" size={16} stroke={2.2} /></span>
            <span className="stack" style={{ gap: 0 }}><span className="t-12 lp-soft">Nova conquista</span><span className="strong t-14">7 dias seguidos</span></span>
          </div>
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  return (
    <section id="como" className="lp-section">
      <div className="lp-wrap">
        <div className="lp-section-head">
          <span className="lp-kicker">Como funciona</span>
          <h2 className="lp-h2">Pequenos passos, todo dia, do seu jeito.</h2>
        </div>
        <div className="lp-features">
          <Feature n="01" title="Cada objetivo com a sua sequência" text="Treino, leitura, estudo, hábitos ou projetos. Dias de descanso não quebram nada, e pular um objetivo não derruba os outros.">
            <div className="card stack gap-14 lp-vignette-card">
              {STREAKS.map((s) => (
                <div key={s.title} className="row between gap-12">
                  <span className="row gap-10"><span className="lp-swatch" style={{ background: s.color }} /><span className="strong t-15">{s.title}</span></span>
                  <StreakPill value={s.value} unit={s.unit} active />
                </div>
              ))}
            </div>
          </Feature>
          <Feature n="02" title="Você decide o que posta" text="Registrar leva um toque. Compartilhar é sempre uma escolha do momento, para amigos ou para todos. Nada vai pro feed sozinho.">
            <div className="card stack gap-12 lp-vignette-card">
              <div className="row between gap-12">
                <span className="stack" style={{ gap: 0 }}><span className="strong t-15">Publicar no feed</span><span className="t-13 muted">você decide agora</span></span>
                <span className="switch lp-inert"><input type="checkbox" role="switch" tabIndex={-1} readOnly checked={false} /></span>
              </div>
              <p className="t-13 secondary">Não vai pro feed. Conta normalmente nas suas sequências e estatísticas.</p>
            </div>
          </Feature>
          <Feature n="03" title="Desafios com amigos" text="No modo Juntos o grupo mantém uma sequência só, e ninguém é punido por uma pessoa. Na Disputa, um ranking semanal que zera todo domingo.">
            <div className="card stack gap-6 lp-ranking">
              {RANKING.map((r) => (
                <div key={r.name} className={`row gap-12 lp-rank-row ${r.me ? 'me' : ''}`}>
                  <span className={`lp-rank-pos ${r.pos === 1 ? 'first' : ''}`}>{r.pos}</span>
                  <span className="grow strong t-15">{r.name}</span>
                  <span className="num t-16">{r.pts}</span>
                </div>
              ))}
            </div>
          </Feature>
        </div>
      </div>
    </section>
  );
}

function MeetBroto() {
  return (
    <section id="broto" className="lp-band">
      <div className="lp-wrap stack lp-band-stack">
        <div className="lp-band-grid">
          <div className="stack gap-16">
            <span className="lp-kicker on-dark">O {MASCOT_NAME}</span>
            <h2 className="lp-h2 on-dark">Ele cresce com você. E nunca regride.</h2>
            <p className="lp-p on-dark">A forma mostra o seu nível. As folhas ficam douradas enquanto você mantém 7 dias seguidos. Se a sequência zerar, ele só diz “que bom te ver”.</p>
          </div>
          <ol className="lp-stages" aria-label="Formas do Broto por nível">
            {STAGES.map(({ stage, name, levels }, i) => (
              <li key={stage} className="stack gap-10">
                <span className="lp-stage-tile">
                  <Broto size={96} stage={stage} golden={i === STAGES.length - 1} shadow={false} title={`${MASCOT_NAME} na forma ${name}${i === STAGES.length - 1 ? ', dourado' : ''}`} />
                </span>
                <span className="stack" style={{ gap: 0 }}><span className="strong t-15 on-dark">{name}</span><span className="t-13 lp-band-muted">nível {levels}</span></span>
              </li>
            ))}
          </ol>
        </div>
        <ul className="lp-moods" aria-label="Expressões do Broto">
          {MOODS.map(({ expression, label }) => (
            <li key={expression} className="lp-mood">
              <span className="lp-mood-art"><Broto size={72} expression={expression} shadow={false} /></span>
              <span className="t-14 strong on-dark">{label}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Principles() {
  return (
    <section id="principios" className="lp-section">
      <div className="lp-wrap">
        <div className="lp-section-head">
          <span className="lp-kicker">Princípios</span>
          <h2 className="lp-h2">Feito para você continuar.</h2>
        </div>
        <ul className="lp-principles">
          {PRINCIPLES.map(([t, d]) => (
            <li key={t} className="stack gap-8">
              <h3 className="title t-20">{t}</h3>
              <p className="lp-p lp-p-sm">{d}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="lp-cta">
      <div className="lp-wrap stack center gap-24">
        <Broto size={128} expression="padrao" />
        <h2 className="lp-title lp-cta-title">Comece hoje<Dot /></h2>
        <p className="lp-lead lp-center">Seu primeiro objetivo leva menos de um minuto.</p>
        <Link to="/entrar?modo=criar" className="btn btn-dark lp-cta-main">Criar conta grátis</Link>
      </div>
    </section>
  );
}

export default function Landing() {
  return (
    <div className="lp">
      <header className="lp-nav">
        <div className="lp-wrap row between">
          <Link to="/" aria-label={`${APP_NAME}, início`}><Logo size={32} /></Link>
          <nav className="lp-links" aria-label="Seções">
            <a href="#como">Como funciona</a>
            <a href="#broto">O {MASCOT_NAME}</a>
            <a href="#principios">Princípios</a>
          </nav>
          <div className="row gap-6">
            <Link to="/entrar" className="btn btn-ghost sm">Entrar</Link>
            <Link to="/entrar?modo=criar" className="btn btn-dark sm lp-nav-cta">Criar conta</Link>
          </div>
        </div>
      </header>

      <main>
        <Hero />
        <HowItWorks />
        <MeetBroto />
        <Principles />
        <FinalCta />
      </main>

      <footer className="lp-footer">
        <div className="lp-wrap row between wrap gap-16">
          <span className="row gap-12"><Logo size={24} /><span className="t-13 muted">© {new Date().getFullYear()} {APP_NAME}</span></span>
          <nav className="row gap-4 wrap" aria-label="Rodapé">
            <Link to="/termos" className="btn btn-ghost sm">Termos de uso</Link>
            <Link to="/privacidade" className="btn btn-ghost sm">Privacidade</Link>
            <Link to="/entrar" className="btn btn-ghost sm">Entrar</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
