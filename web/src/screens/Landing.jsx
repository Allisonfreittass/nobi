import { Link } from 'react-router-dom';
import Broto from '../components/Broto.jsx';
import Icon from '../components/Icon.jsx';
import { Logo } from '../components/Logo.jsx';
import { RingProgress, StreakPill, WeekDots, ProgressBar } from '../components/ui.jsx';
import { APP_NAME, MASCOT_NAME } from '../config.js';

// Prévia ilustrativa da tela de Metas, montada com os componentes reais do app
const days = (states) => states.map((state, i) => ({ date: `d${i}`, state, today: i === 6 }));

function PhonePreview() {
  return (
    <div className="lp-phone" aria-hidden="true">
      <div className="lp-phone-screen">
        <div className="stack gap-12" style={{ padding: '34px 16px 16px' }}>
          <div className="stack" style={{ gap: 2 }}>
            <span className="t-12 secondary">Sexta, 6 de novembro</span>
            <span className="title" style={{ fontSize: '1.5rem', fontWeight: 800 }}>Meus objetivos</span>
          </div>
          <div className="card row gap-12" style={{ padding: 12, borderRadius: 20 }}>
            <RingProgress value={0.75} size={54} thickness={7}><span className="num t-14">3/4</span></RingProgress>
            <div className="stack" style={{ gap: 2 }}>
              <span className="title t-16">Falta 1 hoje</span>
              <span className="t-12 muted">Cada objetivo tem a sua sequência.</span>
            </div>
          </div>
          <div className="card stack gap-10" style={{ padding: 12, borderRadius: 20 }}>
            <div className="row gap-10">
              <span className="lp-goal-icon" style={{ background: '#6C4DFF' }}><Icon name="book" size={16} stroke={2.2} /></span>
              <span className="stack grow" style={{ gap: 0 }}><span className="strong t-14">Ler 20 min</span><span className="t-12 muted">Hábito diário</span></span>
              <StreakPill value={7} unit="dias" active />
            </div>
            <ProgressBar value={1} color="#6C4DFF" height={6} />
            <div className="row between">
              <WeekDots days={days(['done', 'done', 'done', 'done', 'done', 'done', 'done'])} color="#6C4DFF" />
              <span className="lp-done"><Icon name="check" size={13} stroke={2.6} /> Feito</span>
            </div>
          </div>
          <div className="card stack gap-10" style={{ padding: 12, borderRadius: 20 }}>
            <div className="row gap-10">
              <span className="lp-goal-icon" style={{ background: '#FF5B2E' }}><Icon name="dumbbell" size={16} stroke={2.2} /></span>
              <span className="stack grow" style={{ gap: 0 }}><span className="strong t-14">Treinar 4x</span><span className="t-12 muted">Com Caio e Júlia</span></span>
              <StreakPill value={6} unit="sem." />
            </div>
            <ProgressBar value={0.75} color="#FF5B2E" height={6} />
            <div className="row between">
              <WeekDots days={days(['done', 'miss', 'done', 'miss', 'done', 'miss', 'today'])} color="#FF5B2E" />
              <span className="t-12 strong">3 de 4</span>
            </div>
          </div>
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

const STAGES = [
  ['broto', 'Broto', '1–9'],
  ['muda', 'Muda', '10–24'],
  ['botao', 'Botão', '25–49'],
  ['flor', 'Flor', '50+'],
];

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
            <Link to="/entrar?modo=criar" className="btn btn-dark sm" style={{ borderRadius: 22, padding: '0 18px' }}>Criar conta</Link>
          </div>
        </div>
      </header>

      <main>
        <section className="lp-hero">
          <div className="lp-wrap lp-hero-grid">
            <div className="stack gap-24 lp-hero-copy">
              <span className="lp-eyebrow"><span className="lp-dot" />{APP_NAME}: evolua junto</span>
              <h1 className="lp-title">
                Evoluir fica melhor quando é junto<span style={{ color: 'var(--nobi-brasa)' }}>.</span>
              </h1>
              <p className="lp-lead">Objetivos com sequência própria, registros em um toque e amigos para celebrar cada passo. Sem culpa, sem pressão.</p>
              <div className="row gap-12 wrap">
                <Link to="/entrar?modo=criar" className="btn btn-primary" style={{ padding: '0 28px' }}>Criar conta grátis</Link>
                <Link to="/entrar" className="btn btn-ghost" style={{ height: 56 }}>Já tenho conta <Icon name="chevron" size={18} /></Link>
              </div>
              <span className="t-13 muted">No navegador do celular e do computador.</span>
            </div>
            <div className="lp-hero-visual">
              <div className="lp-hero-backdrop" />
              <PhonePreview />
              <div className="lp-mascot nobi-hop" style={{ animationDuration: '2.6s' }}>
                <Broto size={150} golden expression="comemorando" shadow={false} title={`${MASCOT_NAME} comemorando`} />
              </div>
              <div className="lp-toast" aria-hidden="true">
                <span className="lp-toast-icon"><Icon name="flame" size={16} stroke={2.2} /></span>
                <span className="stack" style={{ gap: 0 }}><span className="t-12" style={{ opacity: 0.7 }}>Nova conquista</span><span className="strong t-14">7 dias seguidos</span></span>
              </div>
            </div>
          </div>
        </section>

        <section id="como" className="lp-section">
          <div className="lp-wrap">
            <div className="lp-section-head">
              <span className="lp-kicker">Como funciona</span>
              <h2 className="lp-h2">Pequenos passos, todo dia, do seu jeito.</h2>
            </div>
            <div className="lp-features">
              <Feature n="01" title="Cada objetivo com a sua sequência" text="Treino, leitura, estudo, hábitos ou projetos. Dias de descanso não quebram nada, e pular um objetivo não derruba os outros.">
                <div className="card stack gap-14" style={{ padding: 20 }}>
                  {[['Ler 20 min', '#6C4DFF', 21, 'dias'], ['Beber 2 L de água', '#3B82C4', 12, 'dias'], ['Treinar 4x', '#FF5B2E', 6, 'sem.']].map(([t, c, v, u]) => (
                    <div key={t} className="row between gap-12">
                      <span className="row gap-10"><span style={{ width: 10, height: 10, borderRadius: 4, background: c }} /><span className="strong t-15">{t}</span></span>
                      <StreakPill value={v} unit={u} active />
                    </div>
                  ))}
                </div>
              </Feature>
              <Feature n="02" title="Você decide o que posta" text="Registrar leva um toque. Compartilhar é sempre uma escolha do momento, para amigos ou para todos. Nada vai pro feed sozinho.">
                <div className="card stack gap-12" style={{ padding: 20 }}>
                  <div className="row between gap-12">
                    <span className="stack" style={{ gap: 0 }}><span className="strong t-15">Publicar no feed</span><span className="t-13 muted">você decide agora</span></span>
                    <span className="switch" aria-hidden="true" style={{ pointerEvents: 'none' }}><input type="checkbox" role="switch" tabIndex={-1} readOnly checked={false} /></span>
                  </div>
                  <p className="t-13 secondary">Não vai pro feed. Conta normalmente nas suas sequências e estatísticas.</p>
                </div>
              </Feature>
              <Feature n="03" title="Desafios com amigos" text="No modo Juntos o grupo mantém uma sequência só, e ninguém é punido por uma pessoa. Na Disputa, um ranking semanal que zera todo domingo.">
                <div className="card stack gap-6" style={{ padding: 12 }}>
                  {[[1, 'Júlia', 325], [2, 'Você', 270], [3, 'Caio', 255]].map(([pos, name, pts]) => (
                    <div key={name} className="row gap-12" style={{ height: 46, padding: '0 10px', borderRadius: 14, background: name === 'Você' ? 'var(--nobi-tinta)' : 'transparent', color: name === 'Você' ? '#FFFFFF' : undefined }}>
                      <span className="t-13" style={{ width: 24, height: 24, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, background: pos === 1 ? 'var(--nobi-orbita)' : name === 'Você' ? 'var(--nobi-brasa)' : 'var(--nobi-border)', color: pos === 1 ? '#FFFFFF' : 'var(--nobi-tinta)' }}>{pos}</span>
                      <span className="grow strong t-15">{name}</span>
                      <span className="num t-16">{pts}</span>
                    </div>
                  ))}
                </div>
              </Feature>
            </div>
          </div>
        </section>

        <section id="broto" className="lp-band">
          <div className="lp-wrap lp-band-grid">
            <div className="stack gap-16">
              <span className="lp-kicker" style={{ color: 'rgba(255,255,255,0.6)' }}>O {MASCOT_NAME}</span>
              <h2 className="lp-h2" style={{ color: '#FFFFFF' }}>Ele cresce com você. E nunca regride.</h2>
              <p className="lp-p" style={{ color: 'rgba(255,255,255,0.72)' }}>A forma mostra o seu nível. As folhas ficam douradas enquanto você mantém 7 dias seguidos. Se a sequência zerar, ele só diz “que bom te ver”.</p>
            </div>
            <ol className="lp-stages">
              {STAGES.map(([stage, name, lv], i) => (
                <li key={stage} className="stack gap-10">
                  <span className="lp-stage-tile"><Broto size={84} stage={stage} golden={i === STAGES.length - 1} shadow={false} title={`${MASCOT_NAME}: ${name}`} /></span>
                  <span className="stack" style={{ gap: 0 }}><span className="strong t-15" style={{ color: '#FFFFFF' }}>{name}</span><span className="t-13" style={{ color: 'rgba(255,255,255,0.6)' }}>nível {lv}</span></span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="principios" className="lp-section">
          <div className="lp-wrap">
            <div className="lp-section-head">
              <span className="lp-kicker">Princípios</span>
              <h2 className="lp-h2">Feito para você continuar.</h2>
            </div>
            <ul className="lp-principles">
              {[
                ['Sem culpa', 'Perdeu a sequência? Nada de aviso vermelho. Seu nível e suas conquistas ficam.'],
                ['Privado por padrão', 'Um objetivo que você nunca postou é só seu. Você escolhe quem vê seu perfil.'],
                ['Lembretes com respeito', 'No máximo um por dia, no horário que você escolher, e só se faltar algo.'],
              ].map(([t, d]) => (
                <li key={t} className="stack gap-8">
                  <h3 className="title t-20">{t}</h3>
                  <p className="lp-p" style={{ fontSize: 'var(--nobi-text-md)' }}>{d}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="lp-cta">
          <div className="lp-wrap stack center gap-24">
            <h2 className="lp-title" style={{ fontSize: 'clamp(2.5rem, 6vw, 4.5rem)', textAlign: 'center' }}>Comece hoje<span style={{ color: 'var(--nobi-brasa)' }}>.</span></h2>
            <p className="lp-lead" style={{ textAlign: 'center' }}>Seu primeiro objetivo leva menos de um minuto.</p>
            <Link to="/entrar?modo=criar" className="btn btn-dark" style={{ padding: '0 32px' }}>Criar conta grátis</Link>
          </div>
        </section>
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
