import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import Broto from './components/Broto.jsx';
import { useSession } from './lib/session.jsx';
import Login from './screens/Login.jsx';
import ResetPassword from './screens/ResetPassword.jsx';
import Terms from './screens/Terms.jsx';
import Feed from './screens/Feed.jsx';
import Explore from './screens/Explore.jsx';
import Register from './screens/Register.jsx';
import Achievement from './screens/Achievement.jsx';
import Goals from './screens/Goals.jsx';
import NewGoal from './screens/NewGoal.jsx';
import GoalDetail from './screens/GoalDetail.jsx';
import Profile from './screens/Profile.jsx';
import EditProfile from './screens/EditProfile.jsx';
import Settings from './screens/Settings.jsx';
import Challenge from './screens/Challenge.jsx';
import Challenges from './screens/Challenges.jsx';
import Notifications from './screens/Notifications.jsx';

function Splash() {
  return (
    <div className="block-brasa" style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center' }} aria-busy="true">
      <div className="nobi-hop"><Broto size={110} title="Carregando" /></div>
    </div>
  );
}

function Private({ children }) {
  const { me } = useSession();
  const loc = useLocation();
  if (me === undefined) return <Splash />;
  if (!me) return <Navigate to="/entrar" replace state={{ from: loc.pathname }} />;
  return children;
}

function PublicOnly({ children }) {
  const { me, next } = useSession();
  const loc = useLocation();
  if (me === undefined) return <Splash />;
  return me ? <Navigate to={next || loc.state?.from || '/'} replace /> : children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/entrar" element={<PublicOnly><Login /></PublicOnly>} />
      <Route path="/redefinir-senha" element={<ResetPassword />} />
      <Route path="/termos" element={<Terms />} />

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
  );
}
