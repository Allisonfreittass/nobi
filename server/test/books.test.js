import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';

process.env.MONGODB_URI = '';
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'teste';

const realFetch = globalThis.fetch;
globalThis.fetch = async (url, opts) => (String(url).startsWith('https://openlibrary.org/search.json')
  ? new Response(JSON.stringify({ docs: [{ key: '/works/OL1W', title: 'Dom Casmurro', author_name: ['Machado de Assis'], number_of_pages_median: 256, cover_i: 123 }] }), { status: 200 })
  : realFetch(url, opts));

const { connectDb, disconnectDb } = await import('../src/db.js');
const { createApp } = await import('../src/app.js');

let server; let base;
before(async () => { await connectDb({ ephemeral: true }); server = createApp().listen(0); base = `http://127.0.0.1:${server.address().port}/api`; });
after(async () => { server.close(); await disconnectDb(); });
const call = (method, p, body, token) => fetch(base + p, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined })
  .then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }));
const signup = async (n) => (await call('POST', '/auth/signup', { name: n, email: `${n}${Date.now()}${Math.random().toString(36).slice(2, 5)}@t.dev`, password: 'senha1234' })).body;

test('estante: busca, registro de leitura soma páginas, termina e conta na meta do ano', async () => {
  const ana = await signup('Ana');
  const found = (await call('GET', '/books/search?q=dom casmurro', null, ana.token)).body;
  assert.deepEqual(found[0], { title: 'Dom Casmurro', author: 'Machado de Assis', pages: 256, cover: 'https://covers.openlibrary.org/b/id/123-M.jpg', olKey: '/works/OL1W' });
  const book = (await call('POST', '/books', { ...found[0], pages: 100 }, ana.token)).body;
  assert.equal(book.status, 'reading');
  assert.equal((await call('POST', '/books', { title: 'X', cover: 'https://evil.example/x.jpg' }, ana.token)).body.cover, '', 'capa só do Open Library');
  await call('PUT', '/books/goal', { books: 12 }, ana.token);

  const g = (await call('POST', '/goals', { title: 'Ler', category: 'leitura', kind: 'daily', target: { amount: 1, unit: '' } }, ana.token)).body;
  let r = (await call('POST', `/goals/${g.id}/checkins`, { value: 1, pages: 60, bookId: book.id }, ana.token)).body;
  assert.equal(r.book.pagesRead, 60);
  assert.equal(r.book.finished, false);
  const p = (await call('PATCH', `/books/${book.id}`, { addPages: 50 }, ana.token)).body;
  assert.equal(p.finished, true, 'passou do total: terminou');
  assert.equal(p.book.pagesRead, 100);
  const shelf = (await call('GET', '/books', null, ana.token)).body;
  assert.deepEqual(shelf.goal, { books: 12, done: 1 });
  assert.equal(shelf.done[0].title, 'Dom Casmurro');
  r = (await call('POST', `/goals/${g.id}/checkins`, { value: 1, pages: 5, bookId: book.id }, ana.token)).body;
  assert.equal(r.book, null, 'livro lido não recebe mais páginas');
});

test('leitura em dupla: só amigos, convite vira cópia e cada um vê o progresso do outro', async () => {
  const [ana, beto, caio] = await Promise.all([signup('Ana'), signup('Beto'), signup('Caio')]);
  await call('POST', `/users/${ana.me.username}/invite`, {}, beto.token);
  const book = (await call('POST', '/books', { title: 'Torto Arado', pages: 200 }, ana.token)).body;
  assert.equal((await call('POST', `/books/${book.id}/buddy`, { userId: caio.me.id }, ana.token)).status, 400);
  assert.equal((await call('POST', `/books/${book.id}/buddy`, { userId: beto.me.id }, ana.token)).status, 201);
  const inv = (await call('GET', '/home/notifications', null, beto.token)).body.items.find((i) => i.type === 'book-invite');
  assert.equal(inv.book.title, 'Torto Arado');
  await call('POST', `/books/${inv.book.id}/accept`, null, beto.token);
  await call('PATCH', `/books/${inv.book.id}`, { pagesRead: 50 }, beto.token);
  const mine = (await call('GET', '/books', null, ana.token)).body.reading[0];
  assert.equal(mine.buddy.user.name, 'Beto');
  assert.equal(mine.buddy.pct, 0.25);
});
