import { Router } from 'express';
import { bad } from '../lib/http.js';
import { decodeDataUrl, saveImage } from '../services/storage.js';

export const uploads = Router();

// O app reduz a foto no aparelho antes de enviar (perfil 256 px, post até 1440 px)
uploads.post('/', async (req, res) => {
  const purpose = req.body?.purpose;
  if (!['avatar', 'post'].includes(purpose)) throw bad('Tipo de foto inválido.');
  const url = await saveImage(decodeDataUrl(req.body?.data), purpose === 'avatar' ? 'avatars' : 'posts', req.user._id);
  res.status(201).json({ url });
});
