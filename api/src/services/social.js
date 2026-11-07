import mongoose from 'mongoose';
import { Follow, User } from '../models/index.js';

const oid = (v) => new mongoose.Types.ObjectId(String(v));

/** Pessoas que eu sigo (aceito). */
export async function followingIds(userId) {
  const rows = await Follow.find({ followerId: userId, status: 'accepted' }, { followeeId: 1 }).lean();
  return rows.map((r) => r.followeeId);
}

/** Amigos = seguem um ao outro. */
export async function friendIds(userId) {
  const [out, inc] = await Promise.all([
    Follow.find({ followerId: userId, status: 'accepted' }, { followeeId: 1 }).lean(),
    Follow.find({ followeeId: userId, status: 'accepted' }, { followerId: 1 }).lean(),
  ]);
  const back = new Set(inc.map((r) => String(r.followerId)));
  return out.map((r) => r.followeeId).filter((id) => back.has(String(id)));
}

export async function relation(meId, otherId) {
  if (String(meId) === String(otherId)) return { self: true, following: 'accepted', followsMe: true, friends: true };
  const [a, b] = await Promise.all([
    Follow.findOne({ followerId: meId, followeeId: otherId }).lean(),
    Follow.findOne({ followerId: otherId, followeeId: meId }).lean(),
  ]);
  const following = a ? a.status : 'none';
  const followsMe = b?.status === 'accepted';
  return { self: false, following, followsMe, friends: following === 'accepted' && followsMe };
}

/** Pode ver algo marcado como 'friends' | 'public' de outra pessoa? */
export function allowed(rel, audience) {
  if (rel.self) return true;
  if (audience === 'public') return true;
  return rel.friends;
}

/** IDs bloqueados nos dois sentidos. */
export async function blockedIds(userId) {
  const me = await User.findById(userId, { blocked: 1 }).lean();
  const blockedMe = await User.find({ blocked: oid(userId) }, { _id: 1 }).lean();
  return [...(me?.blocked || []), ...blockedMe.map((u) => u._id)].map(String);
}

export function publicUser(u) {
  if (!u) return null;
  return {
    id: String(u._id),
    name: u.name,
    username: u.username,
    avatarUrl: u.avatarUrl || '',
    avatarColor: u.avatarColor || '#FFD8C7',
    level: u.level || 1,
  };
}
