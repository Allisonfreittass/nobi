import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import Broto from './components/Broto.jsx';
import { useSession } from './lib/session.jsx';
import Login from './screens/Login.jsx';
import Landing from './screens/Landing.jsx';
import { useEffect } from 'react';

// Telas menos usadas baixam sob demanda; depois que o app abre, baixam em segundo plano
const loadResetPassword = () => import('./screens/ResetPassword.jsx');
const loadTerms = () => import('./screens/Terms.jsx');
const loadExplore = () => import('./screens/Explore.jsx');
const loadAchievement = () => import('./screens/Achievement.jsx');
const loadNewGoal = () => import('./screens/NewGoal.jsx');
const loadGoalDetail = () => import('./screens/GoalDetail.jsx');
const loadProfile = () => import('./screens/Profile.jsx');
const loadEditProfile = () => import('./screens/EditProfile.jsx');
const loadSettings = () => import('./screens/Settings.jsx');
const loadChallenge = () => import('./screens/Challenge.jsx');
const loadChallenges = () => import('./screens/Challenges.jsx');
const loadNotifications = () => import('./screens/Notifications.jsx');
const loadInvite = () => import('./screens/Invite.jsx');
const ResetPassword = lazy(loadResetPassword);
const Terms = lazy(loadTerms);
const Explore = lazy(loadExplore);
const Achievement = lazy(loadAchievement);
const NewGoal = lazy(loadNewGoal);
const GoalDetail = lazy(loadGoalDetail);
const Profile = lazy(loadProfile);
const EditProfile = lazy(loadEditProfile);
const Settings = lazy(loadSettings);
const Challenge = lazy(loadChallenge);
const Challenges = lazy(loadChallenges);
const Notifications = lazy(loadNotifications);
const Invite = lazy(loadInvite);
const LAZY = [loadResetPassword, loadTerms, loadExplore, loadAchievement, loadNewGoal, loadGoalDetail, loadProfile, loadEditProfile, loadSettings, loadChallenge, loadChallenges, loadNotifications, loadInvite];
function usePrefetch() {
  useEffect(() => {
    const go = () => LAZY.forEach((l) => l().catch(() => {}));
    const id = 'requestIdleCallback' in window ? window.requestIdleCallback(go, { timeout: 4000 }) : setTimeout(go, 2500);
    return () => ('cancelIdleCallback' in window ? window.cancelIdleCallback(id) : clearTimeout(id));
  }, []);
}
import { acceptPendingInvite } from './lib/invite.js';
import { isStandalone } from './lib/install.js';
import { useToast } from './lib/toast.jsx';
import Feed from './screens/Feed.jsx';
import Register from './screens/Register.jsx';
import Goals from './screens/Goals.jsx';

function Splash() {
  const { bootError, refresh } = useSession();
  return (
    <div className="block-brasa stack center gap-16" style={{ minHeight: '100dvh', justifyContent: 'center', padding: 24 }} aria-busy={!bootError}>
      <div className={bootError ? '' : 'nobi-hop'}><Broto size={110} expression={bootError ? 'saudade' : 'padrao'} title={bootError ? 'Sem conexão' : 'Carregando'} /></div>
      {bootError && (
        <>
          <p className="title t-20" style={{ textAlign: 'center' }}>Não deu para conectar.</p>
          <button type="button" className="btn btn-dark" style={{ background: 'var(--nobi-tinta)', color: '#FFFFFF' }} onClick={refresh}>Tentar de novo</button>
        </>
      )}
    </div>
  );
}

function Private({ children }) {
  const { me } = useSession();
  const loc = useLocation();
  if (me === undefined) return <Splash />;
  // Na raiz, visitante vê a landing. Aberto como app instalado, vai direto para o login.
  if (!me) return loc.pathname === '/' && !isStandalone() ? <Landing /> : <Navigate to="/entrar" replace state={{ from: loc.pathname }} />;
  return children;
}

function PublicOnly({ children }) {
  const { me, next } = useSession();
  const loc = useLocation();
  if (me === undefined) return <Splash />;
  return me ? <Navigate to={next || loc.state?.from || '/'} replace /> : children;
}

/** Aceita um convite guardado assim que a pessoa entra (por login, cadastro ou Google). */
function PendingInvite() {
  const { me } = useSession();
  const toast = useToast();
  useEffect(() => {
    if (!me) return;
    acceptPendingInvite().then((inviter) => inviter && toast(`Agora você e ${inviter.name.split(' ')[0]} são amigos.`));
  }, [me?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

export default function App() {
  usePrefetch();
  return (
    <>
    <PendingInvite />
    <Suspense fallback={<div style={{ minHeight: '100dvh', background: 'var(--nobi-bg)' }} aria-busy="true" />}>
    <Routes>
      <Route path="/entrar" element={<PublicOnly><Login /></PublicOnly>} />
      <Route path="/redefinir-senha" element={<ResetPassword />} />
      <Route path="/termos" element={<Terms />} />
      <Route path="/privacidade" element={<Terms />} />
      <Route path="/convite/:username" element={<Invite />} />

      {/* Telas cheias, sem menu */}
      <Route path="/registrar" element={<Private><Register /></Private>} />
      <Route path="/conquista" element={<Private><Achievement /></Private>} />

      {/* Com menu lateral no PC e barra inferior no celular */}
      <Route element={<Private><Layout /></Private>}>
        <Route index element={<Feed />} />
        <Route path="/explorar" element={<Explore />} />
        <Route path="/metas" element={<Goals />} />
        <Route path="/perfil" element={<Profile />} />
        <Route path="/u/:username" element={<Profile />} />
        <Route path="/desafios" element={<Challenges />} />
        <Route path="/desafios/:id" element={<Challenge />} />
        <Route path="/notificacoes" element={<Notifications />} />
      </Route>
      <Route element={<Private><Layout nav={false} /></Private>}>
        <Route path="/metas/novo" element={<NewGoal />} />
        <Route path="/metas/:id" element={<GoalDetail />} />
        <Route path="/perfil/editar" element={<EditProfile />} />
        <Route path="/configuracoes" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </Suspense>
    </>
  );
}
