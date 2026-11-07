import { Link } from 'react-router-dom';
import { BackButton } from './ui.jsx';
import { Logo } from './Logo.jsx';
import { LEGAL_UPDATED } from '../config.js';

/** Layout das páginas legais: título, sumário e seções numeradas, fácil de ler no celular. */
export default function Legal({ title, intro, sections, other }) {
  return (
    <div className="screen no-nav" style={{ maxWidth: 720 }}>
      <div className="screen-head"><BackButton /><Link to="/" aria-label="Início"><Logo size={28} /></Link></div>
      <header className="stack gap-8">
        <h1 className="title t-30" style={{ fontWeight: 800 }}>{title}</h1>
        <span className="t-13 muted">Última atualização: {LEGAL_UPDATED}</span>
        {intro && <p className="t-16 secondary" style={{ lineHeight: 1.6 }}>{intro}</p>}
      </header>
      <nav className="card stack gap-4" aria-label="Sumário" style={{ padding: '14px 16px' }}>
        <span className="label-caps t-12 muted">Sumário</span>
        <ol style={{ margin: 0, paddingLeft: 20 }} className="t-14">
          {sections.map((s, i) => <li key={i} style={{ padding: '3px 0' }}><a href={`#s${i + 1}`} style={{ textDecoration: 'underline', textUnderlineOffset: 3 }}>{s.title}</a></li>)}
        </ol>
      </nav>
      <article className="stack gap-24 legal-text">
        {sections.map((s, i) => (
          <section key={i} id={`s${i + 1}`} className="stack gap-10" style={{ scrollMarginTop: 20 }}>
            <h2 className="title t-20">{i + 1}. {s.title}</h2>
            {s.body}
          </section>
        ))}
      </article>
      {other && <p className="t-14 secondary">Veja também: <Link to={other.to} style={{ textDecoration: 'underline' }}>{other.label}</Link>.</p>}
    </div>
  );
}
