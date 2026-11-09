// Estante: livros (busca no Open Library), páginas lidas, meta de livros no ano e leitura em dupla.
import { Router } from 'express';
import mongoose from 'mongoose';
import { Book, User } from '../models/index.js';
import { bad, notFound } from '../lib/http.js';
import { friendIds, publicUser } from '../services/social.js';
import { notify } from '../services/push.js';
import { social } from '../services/pushMessages.js';

export const books = Router();
const COVER = /^https:\/\/covers\.openlibrary\.org\/b\/id\/\d+-[SML]\.jpg$/;
const clean = (b) => ({
  title: String(b.title || '').trim().replace(/\s+/g, ' ').slice(0, 160),
  author: String(b.author || '').trim().slice(0, 120),
  pages: Math.max(0, Math.min(20000, Math.round(Number(b.pages) || 0))),
  cover: COVER.test(b.cover || '') ? b.cover : '',
  olKey: /^\/works\/OL\d+W$/.test(b.olKey || '') ? b.olKey : '',
});

/** Busca no Open Library (sem chave). Só o termo vai para lá, nada da conta. */
books.get('/search', async (req, res) => {
  const q = String(req.query.q || '').trim().slice(0, 80);
  if (q.length < 2) return res.json([]);
  try {
    const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=8&fields=key,title,author_name,number_of_pages_median,cover_i`;
    const r = await fetch(url, { headers: { 'User-Agent': 'Nobi (app de habitos)' }, signal: AbortSignal.timeout(5000) });
    if (!r.ok) return res.json([]);
    const data = await r.json();
    res.json((data.docs || []).map((d) => ({
      title: d.title, author: (d.author_name || []).slice(0, 2).join(', '), pages: d.number_of_pages_median || 0,
      cover: d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-M.jpg` : '', olKey: d.key || '',
    })));
  } catch {
    res.json([]); // sem internet ou Open Library fora: a pessoa digita o livro à mão
  }
});

async function views(list) {
  const buddyIds = list.map((b) => b.buddyBookId).filter(Boolean);
  const buddies = new Map((await Book.find({ _id: { $in: buddyIds } }).lean()).map((b) => [String(b._id), b]));
  const people = new Map((await User.find({ _id: { $in: [...[...buddies.values()].map((b) => b.userId), ...list.map((b) => b.invitedBy).filter(Boolean)] } }).lean()).map((u) => [String(u._id), u]));
  return list.map((b) => {
    const buddy = b.buddyBookId && buddies.get(String(b.buddyBookId));
    return {
      id: String(b._id), title: b.title, author: b.author, pages: b.pages, cover: b.cover, status: b.status,
      pagesRead: b.pagesRead, pct: b.pages ? Math.min(1, b.pagesRead / b.pages) : null, startedAt: b.startedAt, finishedAt: b.finishedAt,
      buddy: buddy && people.get(String(buddy.userId)) ? { user: publicUser(people.get(String(buddy.userId))), pct: buddy.pages ? Math.min(1, buddy.pagesRead / buddy.pages) : null, status: buddy.status } : null,
      invitedBy: b.invitedBy && people.get(String(b.invitedBy)) ? publicUser(people.get(String(b.invitedBy))) : null,
    };
  });
}

books.get('/', async (req, res) => {
  const year = Number(req.today.slice(0, 4));
  const list = await Book.find({ userId: req.user._id }).sort({ updatedAt: -1 }).lean();
  const v = await views(list);
  const doneThisYear = v.filter((b) => b.status === 'done' && b.finishedAt?.startsWith(String(year)));
  const goal = req.user.readingGoal?.year === year ? req.user.readingGoal.books : null;
  res.json({
    year,
    goal: goal ? { books: goal, done: doneThisYear.length } : null,
    reading: v.filter((b) => b.status === 'reading'),
    want: v.filter((b) => b.status === 'want'),
    done: v.filter((b) => b.status === 'done').slice(0, 30),
    invites: v.filter((b) => b.status === 'invited'),
    doneThisYear: doneThisYear.length,
  });
});

books.put('/goal', async (req, res) => {
  const n = Math.round(Number(req.body?.books) || 0);
  req.user.readingGoal = n > 0 ? { year: Number(req.today.slice(0, 4)), books: Math.min(n, 500) } : null;
  await req.user.save();
  res.json({ goal: req.user.readingGoal });
});

books.post('/', async (req, res) => {
  const f = clean(req.body || {});
  if (f.title.length < 1) throw bad('Qual é o livro?');
  const status = ['want', 'reading', 'done'].includes(req.body?.status) ? req.body.status : 'reading';
  if (await Book.countDocuments({ userId: req.user._id }) >= 1000) throw bad('Estante cheia.');
  const b = await Book.create({ ...f, userId: req.user._id, status, startedAt: status !== 'want' ? req.today : null, finishedAt: status === 'done' ? req.today : null, pagesRead: status === 'done' ? f.pages : 0 });
  res.status(201).json((await views([b.toObject()]))[0]);
});

async function mine(id, userId) {
  if (!mongoose.isValidObjectId(id)) throw notFound();
  const b = await Book.findOne({ _id: id, userId });
  if (!b) throw notFound('Livro não encontrado.');
  return b;
}

/** Atualiza páginas/estado; chegar ao fim marca como lido. Retorna se terminou agora. */
export async function setProgress(b, { pagesRead, addPages, status, pages }, today) {
  const was = b.status;
  if (pages !== undefined) b.pages = Math.max(0, Math.min(20000, Math.round(Number(pages) || 0)));
  if (addPages) b.pagesRead += Math.max(0, Math.round(Number(addPages) || 0));
  if (pagesRead !== undefined) b.pagesRead = Math.max(0, Math.round(Number(pagesRead) || 0));
  if (b.pages) b.pagesRead = Math.min(b.pagesRead, b.pages);
  if (status && ['want', 'reading', 'done'].includes(status)) b.status = status;
  if (b.status === 'want' && b.pagesRead > 0) b.status = 'reading';
  if (b.pages && b.pagesRead >= b.pages && b.status === 'reading') b.status = 'done';
  if (b.status !== 'want' && !b.startedAt) b.startedAt = today;
  if (b.status === 'done' && was !== 'done') { b.finishedAt = today; if (b.pages) b.pagesRead = b.pages; }
  if (b.status !== 'done') b.finishedAt = null;
  await b.save();
  return b.status === 'done' && was !== 'done';
}

books.patch('/:id', async (req, res) => {
  const b = await mine(req.params.id, req.user._id);
  if (b.status === 'invited') throw bad('Aceite o convite primeiro.');
  const finished = await setProgress(b, req.body || {}, req.today);
  res.json({ book: (await views([b.toObject()]))[0], finished });
});

books.delete('/:id', async (req, res) => {
  const b = await mine(req.params.id, req.user._id);
  await Book.updateMany({ buddyBookId: b._id }, { $set: { buddyBookId: null } });
  await b.deleteOne();
  res.json({ ok: true });
});

// Leitura em dupla: convida um amigo para ler o mesmo livro (ele recebe uma cópia "convidado")
books.post('/:id/buddy', async (req, res) => {
  const b = await mine(req.params.id, req.user._id);
  const to = String(req.body?.userId || '');
  if (!(await friendIds(req.user._id)).map(String).includes(to)) throw bad('Leitura em dupla é com amigos.');
  if (b.buddyBookId) throw bad('Esse livro já tem dupla.');
  if (await Book.exists({ userId: to, invitedBy: req.user._id, buddyBookId: b._id })) throw bad('Convite já enviado.');
  const copy = await Book.create({ userId: to, title: b.title, author: b.author, pages: b.pages, cover: b.cover, olKey: b.olKey, status: 'invited', invitedBy: req.user._id, buddyBookId: b._id });
  await notify(to, { ...social.bookInvite(req.user.name, b.title), url: '/estante' }, { type: 'social', dedupeKey: `book:inv:${copy._id}` });
  res.status(201).json({ ok: true });
});

books.post('/:id/accept', async (req, res) => {
  const b = await mine(req.params.id, req.user._id);
  if (b.status !== 'invited') throw bad('Esse convite já foi respondido.');
  const theirs = await Book.findById(b.buddyBookId);
  b.status = 'reading';
  b.startedAt = req.today;
  await b.save();
  if (theirs && !theirs.buddyBookId) { theirs.buddyBookId = b._id; await theirs.save(); }
  res.json((await views([b.toObject()]))[0]);
});
