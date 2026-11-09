// Login com Apple (web): confere o id_token que o "Sign in with Apple JS" devolve.
// Assinatura RS256 com as chaves públicas da Apple (JWKS), emissor, público (Services ID) e validade.
import crypto from 'node:crypto';

const ISSUER = 'https://appleid.apple.com';
const KEYS_URL = 'https://appleid.apple.com/auth/keys';
const CACHE_MS = 60 * 60 * 1000;
let cache = { at: 0, keys: [] };

async function appleKeys(force = false) {
  if (!force && cache.keys.length && Date.now() - cache.at < CACHE_MS) return cache.keys;
  const r = await fetch(KEYS_URL, { signal: AbortSignal.timeout(5000) });
  if (!r.ok) throw new Error(`Apple JWKS ${r.status}`);
  cache = { at: Date.now(), keys: (await r.json()).keys || [] };
  return cache.keys;
}

const b64json = (part) => JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));

/**
 * Valida o id_token. Retorna { sub, email, emailVerified } ou null se não for válido.
 * `nonce`: o mesmo valor passado ao AppleID.auth.init no navegador (a Apple devolve o hash SHA-256 dele).
 */
export async function verifyAppleIdToken(idToken, { clientId, nonce } = {}) {
  try {
    const [h, p, sig] = String(idToken || '').split('.');
    if (!h || !p || !sig) return null;
    const header = b64json(h);
    if (header.alg !== 'RS256' || !header.kid) return null;
    let jwk = (await appleKeys()).find((k) => k.kid === header.kid);
    if (!jwk) jwk = (await appleKeys(true)).find((k) => k.kid === header.kid); // a Apple troca as chaves às vezes
    if (!jwk) return null;
    const ok = crypto.verify('RSA-SHA256', Buffer.from(`${h}.${p}`), crypto.createPublicKey({ key: jwk, format: 'jwk' }), Buffer.from(sig, 'base64url'));
    if (!ok) return null;
    const claims = b64json(p);
    const now = Math.floor(Date.now() / 1000);
    if (claims.iss !== ISSUER || claims.aud !== clientId || !(claims.exp > now) || !claims.sub) return null;
    if (nonce && claims.nonce !== crypto.createHash('sha256').update(String(nonce)).digest('hex')) return null;
    return {
      sub: claims.sub,
      email: claims.email ? String(claims.email).toLowerCase() : null,
      // A Apple manda true ou "true"; e-mail de retransmissão privada (privaterelay.appleid.com) também é verificado
      emailVerified: claims.email_verified === true || claims.email_verified === 'true',
    };
  } catch {
    return null;
  }
}

/** Só para testes: limpa o cache das chaves. */
export const _resetAppleKeys = () => { cache = { at: 0, keys: [] }; };
