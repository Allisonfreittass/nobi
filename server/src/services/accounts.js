// Ligar uma conta Google a uma conta existente, sem abrir brecha para quem cadastrou o e-mail de outra pessoa.

/** Momento atual arredondado para baixo ao segundo (o "iat" do JWT é em segundos). */
export const nowSecond = () => new Date(Math.floor(Date.now() / 1000) * 1000);

/**
 * Aplica o login Google numa conta já existente (mesmo e-mail, sem googleId).
 * Se o e-mail da conta nunca foi confirmado, quem criou a senha pode não ser o dono do e-mail:
 * a senha é apagada e as sessões abertas caem. O dono pode criar outra senha em "Esqueci a senha".
 * Retorna true se removeu a senha.
 */
export function linkGoogle(user, googleSub) {
  let removedPassword = false;
  if (!user.emailVerified) {
    if (user.passwordHash) {
      user.passwordHash = undefined;
      removedPassword = true;
    }
    user.sessionsValidAfter = nowSecond();
  }
  user.googleId = googleSub;
  user.emailVerified = true;
  return removedPassword;
}
