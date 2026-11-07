import { BackButton } from '../components/ui.jsx';
import { APP_NAME } from '../config.js';

export default function Terms() {
  return (
    <div className="screen no-nav">
      <div className="screen-head"><BackButton /><span /></div>
      <h1 className="title t-28">Termos e privacidade</h1>
      <div className="card stack gap-12 t-15" style={{ lineHeight: 1.6 }}>
        <p><strong>Você decide o que posta.</strong> No {APP_NAME}, nada vai para o feed sozinho. Cada post é uma escolha sua, com público Amigos ou Público.</p>
        <p><strong>Seus registros são seus.</strong> Objetivos e registros que você nunca compartilhou ficam visíveis só para você. Em objetivos com amigos, quem participa vê quem já marcou no dia.</p>
        <p><strong>Exportar e excluir.</strong> Em Configurações você baixa todos os seus dados e pode excluir a conta a qualquer momento. A exclusão apaga perfil, registros, posts e comentários.</p>
        <p><strong>Respeito.</strong> Não publique conteúdo ofensivo ou de outras pessoas sem permissão. Você pode bloquear qualquer conta.</p>
        <p className="muted t-13">Texto provisório até a versão jurídica final.</p>
      </div>
    </div>
  );
}
