// Menções com @ nos comentários: texto com @usuario em destaque e campo com sugestões ao digitar @.
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Avatar } from './ui.jsx';
import { api } from '../lib/api.js';

const MENTION = /(^|[^a-z0-9_.@])@([a-z0-9_.]{3,24})/gi;

/** Texto do comentário com as menções válidas (as que o servidor confirmou) virando link para o perfil. */
export function MentionText({ text, mentions = [] }) {
  const valid = new Set(mentions.map((m) => m.toLowerCase()));
  const parts = [];
  let last = 0;
  for (const m of text.matchAll(MENTION)) {
    const user = m[2].replace(/\.+$/, '');
    if (!valid.has(user.toLowerCase())) continue;
    const at = m.index + m[1].length;
    if (at > last) parts.push(text.slice(last, at));
    parts.push(<Link key={at} to={`/u/${user.toLowerCase()}`} className="mention">@{user}</Link>);
    last = at + 1 + user.length;
  }
  parts.push(text.slice(last));
  return <>{parts}</>;
}

/** O @palavra que está sendo digitado logo antes do cursor, ou null. */
function tokenAt(value, caret) {
  const m = /(^|\s)@([a-z0-9_.]{0,24})$/i.exec(value.slice(0, caret));
  return m ? { start: caret - m[2].length - 1, q: m[2] } : null;
}

/**
 * Campo de comentário com sugestões de @. `postId` define quem aparece (só quem vê o post).
 * O pai controla o valor; `ref.insertMention(username)` coloca "@usuario " no começo (usado no "Responder").
 */
export const MentionInput = forwardRef(function MentionInput({ postId, value, onChange, id, placeholder, maxLength = 280 }, ref) {
  const input = useRef(null);
  const [token, setToken] = useState(null);
  const [list, setList] = useState([]);
  const [active, setActive] = useState(0);

  useImperativeHandle(ref, () => ({
    insertMention(username) {
      const tag = `@${username} `;
      const next = value.startsWith(tag) ? value : tag + value.replace(/^\s+/, '');
      onChange(next.slice(0, maxLength));
      requestAnimationFrame(() => { input.current?.focus(); input.current?.setSelectionRange(next.length, next.length); });
    },
  }), [value, onChange, maxLength]);

  useEffect(() => {
    if (!token) { setList([]); return undefined; }
    let alive = true;
    const t = setTimeout(() => {
      api(`/posts/${postId}/mentionable?q=${encodeURIComponent(token.q)}`).then((r) => { if (alive) { setList(r); setActive(0); } }).catch(() => {});
    }, 150);
    return () => { alive = false; clearTimeout(t); };
  }, [token?.q, token?.start, postId]); // eslint-disable-line react-hooks/exhaustive-deps

  const sync = (v, caret) => setToken(tokenAt(v, caret));
  function pick(u) {
    const end = token.start + 1 + token.q.length;
    const next = `${value.slice(0, token.start)}@${u.username} ${value.slice(end).replace(/^\s+/, '')}`.slice(0, maxLength);
    const caret = Math.min(token.start + u.username.length + 2, next.length);
    onChange(next);
    setToken(null);
    requestAnimationFrame(() => { input.current?.focus(); input.current?.setSelectionRange(caret, caret); });
  }
  function onKeyDown(e) {
    if (!token || !list.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => (i + 1) % list.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => (i - 1 + list.length) % list.length); }
    else if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); pick(list[active]); }
    else if (e.key === 'Escape') { e.preventDefault(); setToken(null); }
  }

  const open = Boolean(token && list.length);
  return (
    <div className="mention-field grow">
      {open && (
        <ul className="mention-list card flush" role="listbox" id={`${id}-sug`} aria-label="Pessoas para mencionar">
          {list.map((u, i) => (
            <li key={u.id} role="option" aria-selected={i === active}>
              {/* onMouseDown: escolhe antes de o campo perder o foco */}
              <button type="button" className="list-row" onMouseDown={(e) => { e.preventDefault(); pick(u); }}>
                <Avatar user={u} size={28} />
                <span className="grow stack" style={{ gap: 0, minWidth: 0 }}>
                  <span className="t-14 strong ellipsis">{u.name}</span>
                  <span className="t-12 muted ellipsis">@{u.username}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <input ref={input} id={id} className="input" style={{ minHeight: 44, height: 44, width: '100%' }} value={value} maxLength={maxLength}
        placeholder={placeholder} autoComplete="off" role="combobox" aria-expanded={open} aria-controls={`${id}-sug`} aria-autocomplete="list"
        onChange={(e) => { onChange(e.target.value); sync(e.target.value, e.target.selectionStart); }}
        onSelect={(e) => sync(e.currentTarget.value, e.currentTarget.selectionStart)}
        onKeyDown={onKeyDown}
        onBlur={() => setTimeout(() => setToken(null), 120)} />
    </div>
  );
});
