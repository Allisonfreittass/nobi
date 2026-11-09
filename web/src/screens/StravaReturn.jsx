// Volta do Strava depois de autorizar: troca o código pela conexão e já sincroniza.
import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Skeleton } from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { invalidateLoad } from '../lib/useLoad.js';
import { useToast } from '../lib/toast.jsx';

export default function StravaReturn() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const ran = useRef(false);
  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    (async () => {
      if (params.get('error')) { toast('Conexão com o Strava cancelada.'); navigate('/configuracoes', { replace: true }); return; }
      try {
        await api('/strava/exchange', { method: 'POST', body: { code: params.get('code'), state: params.get('state'), scope: params.get('scope') } });
        invalidateLoad('/strava');
        const r = await api('/strava/sync', { method: 'POST' }).catch(() => null);
        invalidateLoad('/goals', '/home');
        toast(r?.imported ? `Strava conectado. ${r.imported} ${r.imported === 1 ? 'treino importado' : 'treinos importados'}.` : 'Strava conectado.');
      } catch (e) { toast(e.message); }
      navigate('/configuracoes', { replace: true });
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return <div className="screen"><Skeleton height={160} /><p className="t-14 secondary center">Conectando ao Strava…</p></div>;
}
