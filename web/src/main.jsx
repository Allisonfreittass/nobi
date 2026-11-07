import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import './lib/install.js'; // captura o convite de instalação do Chrome o quanto antes
import { registerServiceWorker } from './lib/push.js';

registerServiceWorker();
import { SessionProvider } from './lib/session.jsx';
import { ToastProvider } from './lib/toast.jsx';
import { ShareProvider } from './lib/share.jsx';
import { CelebrateProvider } from './lib/celebrate.jsx';
import './styles/tokens.css';
import './styles/app.css';
import { APP_NAME } from './config.js';

document.title = APP_NAME;

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <SessionProvider>
        <ToastProvider>
          <ShareProvider>
            <CelebrateProvider>
              <App />
            </CelebrateProvider>
          </ShareProvider>
        </ToastProvider>
      </SessionProvider>
    </BrowserRouter>
  </StrictMode>,
);
