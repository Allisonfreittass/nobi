// Envio de e-mail pela API HTTP do Resend (sem dependência nova).
// Sem RESEND_API_KEY: em desenvolvimento o conteúdo sai no terminal; em produção é avisado no log.
import { config } from '../config.js';

const APP_NAME = config.appName;

const escape = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Envia um e-mail. Retorna true se o provedor aceitou; nunca lança (quem chama não deve vazar se a conta existe). */
export async function sendEmail({ to, subject, html, text }) {
  if (!config.resendApiKey) {
    if (!config.isProd) console.log(`[email] (sem RESEND_API_KEY) Para ${to}: ${subject}\n${text}`);
    else console.error('[email] RESEND_API_KEY não configurada: e-mail não enviado.');
    return false;
  }
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.resendApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: config.emailFrom, to: [to], subject, html, text }),
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) console.error('[email] Resend respondeu', r.status, (await r.text()).slice(0, 300));
    return r.ok;
  } catch (e) {
    console.error('[email]', e.message);
    return false;
  }
}

/** Moldura simples e segura em clientes de e-mail: tabela, estilos inline, um botão. */
function layout({ preheader, title, body, button, footer }) {
  return `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#F6F1EA;font-family:Arial,Helvetica,sans-serif;color:#141218">
<span style="display:none;max-height:0;overflow:hidden">${escape(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#FFFFFF;border-radius:24px;padding:32px 28px">
<tr><td style="font-size:26px;font-weight:800;padding-bottom:20px">${escape(APP_NAME)}<span style="color:#FF5B2E">.</span></td></tr>
<tr><td style="font-size:22px;font-weight:700;padding-bottom:12px">${escape(title)}</td></tr>
<tr><td style="font-size:16px;line-height:1.5;color:#3D3A44;padding-bottom:24px">${body}</td></tr>
<tr><td style="padding-bottom:24px"><a href="${escape(button.url)}" style="display:inline-block;background:#FF5B2E;color:#FFFFFF;text-decoration:none;font-weight:700;font-size:16px;padding:14px 24px;border-radius:16px">${escape(button.label)}</a></td></tr>
<tr><td style="font-size:13px;line-height:1.5;color:#6B6773">${footer}</td></tr>
</table></td></tr></table></body></html>`;
}

export function resetPasswordEmail({ name, url, googleOnly }) {
  const first = String(name || '').split(' ')[0] || 'oi';
  const extra = googleOnly ? 'Sua conta foi criada com o Google, e você continua podendo entrar por ele. Se criar uma senha, passa a poder entrar também com e-mail e senha.' : '';
  const subject = `Redefinir sua senha do ${APP_NAME}`;
  const text = `Oi, ${first}!\n\nRecebemos um pedido para redefinir a senha da sua conta no ${APP_NAME}. Para criar uma senha nova, abra o link abaixo (vale por 1 hora):\n\n${url}\n\n${extra ? `${extra}\n\n` : ''}Se não foi você, é só ignorar este e-mail: sua senha continua a mesma.`;
  const html = layout({
    preheader: 'O link vale por 1 hora.',
    title: `Oi, ${first}!`,
    body: `Recebemos um pedido para redefinir a senha da sua conta. Toque no botão para criar uma senha nova. O link vale por <strong>1 hora</strong>.${extra ? `<br><br>${escape(extra)}` : ''}`,
    button: { label: 'Criar senha nova', url },
    footer: `Se não foi você, é só ignorar este e-mail: sua senha continua a mesma.<br><br>Se o botão não abrir, copie este endereço:<br><span style="word-break:break-all">${escape(url)}</span>`,
  });
  return { subject, html, text };
}
