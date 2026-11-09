import { Link } from 'react-router-dom';
import Legal from '../components/Legal.jsx';
import { APP_NAME, CONTACT_EMAIL, LEGAL_ENTITY, MIN_AGE } from '../config.js';

const who = LEGAL_ENTITY || `o responsável pelo ${APP_NAME}`;
const mail = <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>;

function Table({ head, rows }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="legal-table">
        <thead><tr>{head.map((h) => <th key={h} scope="col">{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

const sections = [
  {
    title: 'Quem cuida dos seus dados',
    body: (
      <>
        <p>O controlador dos seus dados pessoais é <strong>{who}</strong>, que oferece o {APP_NAME}. Esta política explica, conforme a Lei Geral de Proteção de Dados (Lei 13.709/2018, LGPD), quais dados usamos, para quê, com quem compartilhamos e como você exerce seus direitos.</p>
        <p>Canal para assuntos de privacidade: {mail}.</p>
      </>
    ),
  },
  {
    title: 'Quais dados usamos',
    body: (
      <>
        <Table
          head={['Tipo', 'O que é']}
          rows={[
            ['Conta', 'Nome, e-mail, @usuário e senha. A senha é guardada de forma irreversível (hash), e ninguém consegue lê-la. Se você entrar com o Google ou com a Apple, recebemos deles seu nome, e-mail e um identificador da conta.'],
            ['Perfil', 'Foto de perfil (ou avatar do Broto), bio, interesses e, se você quiser, sua cidade (digitada por você, usada só para sugerir clubes perto).'],
            ['Uso do app', 'Objetivos, registros (data, tempo, páginas, distância, quantidade e notas), marcos de projetos, sequências, nível, XP e conquistas.'],
            ['Social', 'Quem você segue e quem segue você, bloqueios, convites, publicações, fotos dos posts, comentários, reações "Boa!", clubes em que você entrou (e seu papel neles) e denúncias que você fizer.'],
            ['Preferências', 'Tema, início da semana, horário do lembrete, notificações, animações do Broto e escolhas de privacidade.'],
            ['Notificações', 'Se você ativar as notificações no celular, guardamos o endereço técnico que o seu navegador gera para receber avisos e o fuso horário do aparelho (para o lembrete chegar na sua hora). Ao desativar, apagamos esse endereço.'],
            ['Técnicos', 'Data e hora do seu aparelho (para saber qual é o seu "hoje"), e registros técnicos de acesso, como endereço IP, data, hora e navegador, gerados pela nossa hospedagem.'],
          ]}
        />
        <p><strong>Não coletamos</strong> sua localização pelo GPS ou pela rede, seus contatos, dados de pagamento nem informações para anúncios. Não usamos cookies de rastreamento.</p>
        <p>Registros de treino ou de hábitos podem dizer algo sobre a sua rotina. Usamos essas informações só para mostrar a sua evolução a você e a quem você escolher. Evite colocar informações de saúde detalhadas nas notas.</p>
      </>
    ),
  },
  {
    title: 'Para que usamos e com qual base legal',
    body: (
      <Table
        head={['Finalidade', 'Base legal (LGPD)']}
        rows={[
          ['Criar e manter sua conta, calcular sequências, nível e conquistas, e guardar seus registros', 'Execução do contrato (art. 7º, V)'],
          ['Mostrar seu perfil, publicações e participação em desafios para o público que você escolheu', 'Execução do contrato (art. 7º, V)'],
          ['Avisos dentro do app e notificações no celular, se você ativar: lembrete de check-in, reações, comentários, convites (cada tipo pode ser desligado)', 'Execução do contrato (art. 7º, V)'],
          ['Segurança: proteger contas, impedir fraude e abuso, ligar com segurança o login do Google a uma conta existente', 'Legítimo interesse (art. 7º, IX)'],
          ['Atender pedidos de autoridades e cumprir a lei', 'Obrigação legal (art. 7º, II)'],
        ]}
      />
    ),
  },
  {
    title: 'O que fica visível para outras pessoas',
    body: (
      <ul>
        <li><strong>Objetivos e registros</strong> são só seus até você publicar algo. Ao publicar, você escolhe Amigos ou Público.</li>
        <li><strong>Nome, @usuário, foto e nível</strong> aparecem na busca, em convites, em desafios e em publicações.</li>
        <li><strong>Bio, interesses, estatísticas e conquistas</strong> seguem a privacidade que você escolher em Configurações.</li>
        <li><strong>Em objetivos com amigos e desafios</strong>, os participantes veem quem já marcou o dia e a pontuação da semana.</li>
        <li><strong>Seu link de convite</strong> mostra seu nome e foto para quem o abrir.</li>
        <li><strong>Nos clubes</strong>, os membros veem que você faz parte e seus posts Públicos da categoria do clube. Posts para Amigos nunca aparecem em clube. Sua cidade não aparece no perfil.</li>
        <li><strong>Denúncias</strong> vão para a moderação do clube ou do Nobi. A pessoa denunciada não sabe quem denunciou.</li>
      </ul>
    ),
  },
  {
    title: 'Com quem compartilhamos',
    body: (
      <>
        <p><strong>Não vendemos seus dados</strong> e não exibimos anúncios. Usamos alguns fornecedores para o {APP_NAME} funcionar. Eles tratam dados só em nosso nome e para essa finalidade:</p>
        <Table
          head={['Fornecedor', 'Para quê', 'Onde']}
          rows={[
            ['Vercel Inc.', 'Hospedagem do site e do servidor, e armazenamento das fotos', 'Servidor em São Paulo; empresa nos EUA'],
            ['MongoDB Inc. (Atlas)', 'Banco de dados onde ficam conta, registros e publicações', 'São Paulo (Brasil)'],
            ['Google LLC', 'Login com Google (só se você usar) e entrega das fontes do site (o navegador baixa as fontes dos servidores do Google, que recebem seu endereço IP)', 'EUA e outros países'],
            ['Apple Inc.', 'Login com Apple (só se você usar): recebemos seu nome, um e-mail (pode ser o e-mail oculto da Apple) e um identificador da conta', 'EUA e outros países'],
            ['Resend Inc.', 'Envio de e-mails da conta, como o link para redefinir a senha (recebe seu nome e e-mail)', 'EUA'],
            ['Serviço de notificações do seu navegador (Google, Apple ou Mozilla)', 'Entregar as notificações ao seu aparelho, se você ativar. O conteúdo vai criptografado', 'Varia conforme o navegador'],
          ]}
        />
        <p>Também podemos compartilhar dados quando a lei exigir ou por ordem judicial.</p>
      </>
    ),
  },
  {
    title: 'Transferência para fora do Brasil',
    body: (
      <p>Alguns fornecedores são empresas de fora do Brasil, então parte dos dados pode ser tratada em outros países, principalmente nos EUA. Isso acontece com fornecedores que adotam garantias contratuais e de segurança compatíveis com a LGPD (art. 33).</p>
    ),
  },
  {
    title: 'O que fica guardado no seu aparelho',
    body: (
      <>
        <p>O {APP_NAME} não usa cookies. No armazenamento local do navegador, guardamos só o necessário:</p>
        <ul>
          <li>sua sessão (para você não precisar entrar toda vez);</li>
          <li>quantas vezes você abriu o app e se você dispensou os convites para instalar na tela de início ou para ativar o lembrete;</li>
          <li>um convite que você abriu antes de criar a conta, até ele ser aceito.</li>
        </ul>
        <p>Ao sair da conta, a sessão é apagada do aparelho.</p>
      </>
    ),
  },
  {
    title: 'Por quanto tempo guardamos',
    body: (
      <ul>
        <li><strong>Enquanto sua conta existir</strong>, guardamos seus dados para o app funcionar.</li>
        <li><strong>Ao excluir a conta</strong>, apagamos na hora seu perfil, objetivos, registros, publicações, comentários, reações, seguidores e fotos. Em desafios com outras pessoas, sua participação é removida.</li>
        <li><strong>Ao apagar uma publicação</strong>, a foto dela também é apagada. Ao trocar a foto de perfil, a anterior é apagada.</li>
        <li>Cópias de segurança automáticas do banco, quando existirem, são substituídas no ciclo normal dos nossos fornecedores.</li>
        <li>Links de "esqueci a senha" valem por 1 hora.</li>
        <li>Registros técnicos de acesso ficam com os fornecedores de hospedagem pelo prazo das políticas deles e da lei.</li>
      </ul>
    ),
  },
  {
    title: 'Seus direitos',
    body: (
      <>
        <p>Pela LGPD (art. 18), você pode:</p>
        <ul>
          <li>confirmar se tratamos seus dados e ter acesso a eles;</li>
          <li>corrigir dados incompletos ou desatualizados;</li>
          <li>pedir a eliminação, a anonimização ou o bloqueio de dados desnecessários;</li>
          <li>levar seus dados para outro serviço (portabilidade);</li>
          <li>saber com quem compartilhamos;</li>
          <li>revogar consentimentos e se opor a tratamentos com os quais não concorde.</li>
        </ul>
        <p>A maior parte você faz direto no app:</p>
        <ul>
          <li><strong>Baixar todos os seus dados:</strong> Configurações → Exportar meus dados.</li>
          <li><strong>Corrigir:</strong> Editar perfil e Configurações.</li>
          <li><strong>Excluir tudo:</strong> Configurações → Excluir conta.</li>
          <li><strong>Controlar quem vê:</strong> Configurações → Privacidade, e o público de cada publicação.</li>
          <li><strong>Bloquear alguém:</strong> no perfil da pessoa.</li>
        </ul>
        <p>Para o resto, escreva para {mail}. Respondemos em até 15 dias. Você também pode reclamar à Autoridade Nacional de Proteção de Dados (ANPD).</p>
      </>
    ),
  },
  {
    title: 'Segurança',
    body: (
      <p>Toda a comunicação usa conexão segura (HTTPS). Senhas são guardadas com hash. As sessões expiram e são encerradas automaticamente em situações de risco, como ao redefinir a senha. Conferimos cada foto enviada antes de guardar, e o acesso aos sistemas é restrito. Nenhum sistema é 100% seguro: se acontecer um incidente que possa trazer risco a você, avisaremos você e a ANPD, como manda a LGPD.</p>
    ),
  },
  {
    title: 'Crianças e adolescentes',
    body: (
      <p>O {APP_NAME} é para pessoas a partir de {MIN_AGE} anos. Adolescentes devem usar com o conhecimento dos responsáveis. Se soubermos que uma conta pertence a alguém com menos de {MIN_AGE} anos, ela será excluída.</p>
    ),
  },
  {
    title: 'Mudanças nesta política',
    body: (
      <p>Se mudarmos esta política de forma importante, avisaremos no app ou por e-mail antes de a mudança valer. A data no topo mostra a versão em vigor. Veja também os <Link to="/termos">Termos de Uso</Link>.</p>
    ),
  },
];

export default function Privacy() {
  return (
    <Legal
      title="Política de Privacidade"
      intro={`Como o ${APP_NAME} cuida dos seus dados. Resumo: você decide o que publica, não vendemos nada e você pode baixar ou apagar tudo quando quiser.`}
      sections={sections}
      other={{ to: '/termos', label: 'Termos de Uso' }}
    />
  );
}
