import { Link } from 'react-router-dom';
import Legal from '../components/Legal.jsx';
import { APP_NAME, CONTACT_EMAIL, LEGAL_ENTITY, MIN_AGE, SITE_URL } from '../config.js';

const who = LEGAL_ENTITY || `o responsável pelo ${APP_NAME}`;
const mail = <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>;

const sections = [
  {
    title: 'Sobre estes termos',
    body: (
      <>
        <p>Estes Termos de Uso regem o uso do {APP_NAME}, disponível em <a href={SITE_URL}>{SITE_URL.replace('https://', '')}</a>, oferecido por <strong>{who}</strong>. Ao criar uma conta ou usar o {APP_NAME}, você concorda com estes termos e com a <Link to="/privacidade">Política de Privacidade</Link>.</p>
        <p>Se não concordar, não use o serviço. Dúvidas podem ser enviadas para {mail}.</p>
      </>
    ),
  },
  {
    title: 'O que é o Nobi',
    body: (
      <>
        <p>O {APP_NAME} é uma rede social de evolução pessoal. Nele você cria objetivos (treino, leitura, estudo, hábitos, projetos), registra o que fez, acompanha suas sequências, participa de desafios e, se quiser, compartilha a sua evolução com amigos.</p>
        <p>O {APP_NAME} é gratuito. Podemos adicionar, mudar ou remover funcionalidades com o tempo. Se algum dia houver recursos pagos, eles serão opcionais e apresentados antes de qualquer cobrança.</p>
      </>
    ),
  },
  {
    title: 'Sua conta',
    body: (
      <ul>
        <li>Você precisa ter pelo menos <strong>{MIN_AGE} anos</strong> para usar o {APP_NAME}. Se tiver menos de 18, use com o conhecimento dos seus pais ou responsáveis.</li>
        <li>Você pode entrar com e-mail e senha ou com sua conta Google. Use informações verdadeiras e mantenha seu e-mail atualizado.</li>
        <li>Você é responsável pelo que acontece na sua conta. Não compartilhe sua senha. Se suspeitar de uso indevido, troque a senha e fale com a gente.</li>
        <li>Cada pessoa pode ter uma conta. Não crie contas em nome de outras pessoas nem se passe por alguém.</li>
      </ul>
    ),
  },
  {
    title: 'Você decide o que é publicado',
    body: (
      <>
        <p>No {APP_NAME}, nada vai para o feed sozinho. Seus objetivos e registros ficam visíveis só para você até que você escolha publicar algo. A cada publicação, você escolhe o público: <strong>Amigos</strong> (pessoas que seguem você e que você segue) ou <strong>Público</strong> (qualquer pessoa no {APP_NAME}).</p>
        <p>Algumas coisas são vistas por outras pessoas por natureza:</p>
        <ul>
          <li>Seu nome, @usuário, foto de perfil e nível aparecem para quem encontra você na busca, nos convites e nos desafios.</li>
          <li>Em objetivos com amigos e desafios, os participantes veem quem já marcou o dia e, na Disputa, a pontuação semanal.</li>
          <li>Seu link de convite mostra seu nome e sua foto para quem o abrir.</li>
          <li>Bio, interesses, estatísticas e conquistas seguem a privacidade que você escolher em Configurações (Amigos ou Público).</li>
        </ul>
      </>
    ),
  },
  {
    title: 'Seu conteúdo',
    body: (
      <>
        <p>O que você publica (textos, fotos, comentários) continua sendo seu. Para o {APP_NAME} funcionar, você nos dá uma licença gratuita, não exclusiva e mundial para guardar, processar, reduzir o tamanho e exibir esse conteúdo <strong>apenas para o público que você escolheu</strong>, enquanto ele estiver publicado. Essa licença termina quando você apaga o conteúdo ou a conta.</p>
        <p>Só publique o que você tem direito de publicar. Não use fotos de outras pessoas sem permissão.</p>
      </>
    ),
  },
  {
    title: 'Regras de convivência',
    body: (
      <>
        <p>O {APP_NAME} existe para as pessoas se apoiarem. Não é permitido:</p>
        <ul>
          <li>assediar, ameaçar, humilhar ou discriminar qualquer pessoa;</li>
          <li>publicar conteúdo ilegal, sexual explícito, violento ou que incentive automutilação, transtornos alimentares ou uso de drogas;</li>
          <li>publicar dados pessoais de terceiros sem autorização;</li>
          <li>enviar spam, propaganda não solicitada ou golpes;</li>
          <li>tentar invadir, sobrecarregar, copiar em massa ou burlar a segurança do serviço;</li>
          <li>criar contas falsas ou automatizadas.</li>
        </ul>
        <p>Você pode bloquear qualquer pessoa a qualquer momento. Se a regra for quebrada, podemos remover o conteúdo e suspender ou encerrar a conta, de forma proporcional à gravidade.</p>
      </>
    ),
  },
  {
    title: 'Saúde e bem-estar',
    body: (
      <p>O {APP_NAME} ajuda a acompanhar hábitos, mas <strong>não é orientação médica, nutricional, psicológica nem de educação física</strong>. Antes de começar treinos, dietas ou mudanças grandes de rotina, procure um profissional. Respeite seus limites: dias de descanso fazem parte e não quebram a sua sequência.</p>
    ),
  },
  {
    title: 'Encerrar a conta',
    body: (
      <>
        <p>Você pode excluir sua conta quando quiser, em <strong>Configurações → Excluir conta</strong>. Isso apaga seu perfil, objetivos, registros, publicações, comentários e fotos, como explicado na <Link to="/privacidade">Política de Privacidade</Link>. Antes, se quiser, baixe uma cópia em <strong>Configurações → Exportar meus dados</strong>.</p>
        <p>Também podemos encerrar contas que violem estes termos ou fiquem sem uso por muito tempo, avisando antes por e-mail quando possível.</p>
      </>
    ),
  },
  {
    title: 'Disponibilidade e responsabilidade',
    body: (
      <>
        <p>Trabalhamos para o {APP_NAME} funcionar bem e com segurança, mas ele é oferecido como está: pode ter falhas, ficar fora do ar ou perder informações em situações extremas. Recomendamos exportar seus dados de vez em quando.</p>
        <p>Na medida permitida pela lei, não respondemos por danos indiretos decorrentes do uso do serviço, nem pelo conteúdo publicado por outras pessoas. Nada nestes termos limita direitos que você tenha como consumidor pela legislação brasileira.</p>
      </>
    ),
  },
  {
    title: 'Mudanças nestes termos',
    body: (
      <p>Podemos atualizar estes termos. Quando a mudança for importante, avisaremos no app ou por e-mail antes de ela valer. A data no topo desta página mostra a versão em vigor. Continuar usando o {APP_NAME} depois da mudança significa que você concorda com a nova versão.</p>
    ),
  },
  {
    title: 'Lei aplicável e contato',
    body: (
      <>
        <p>Estes termos seguem as leis da República Federativa do Brasil, incluindo o Código de Defesa do Consumidor, o Marco Civil da Internet e a Lei Geral de Proteção de Dados (LGPD). Fica eleito o foro do seu domicílio para resolver qualquer questão.</p>
        <p>Fale com a gente: {mail}.</p>
      </>
    ),
  },
];

export default function Terms() {
  return (
    <Legal
      title="Termos de Uso"
      intro={`As regras para usar o ${APP_NAME}, em linguagem simples.`}
      sections={sections}
      other={{ to: '/privacidade', label: 'Política de Privacidade' }}
    />
  );
}
