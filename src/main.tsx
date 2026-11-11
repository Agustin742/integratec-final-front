import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ApiQueryProvider } from './api/query-client';
import { App } from './app/App';
import { getPublicConfig } from './config/public-config';
import { createSession } from './session/controller';
import { SessionProvider } from './session/provider';
import './styles/index.css';

getPublicConfig();
const session = createSession();

const root = document.getElementById('root');
if (!root) {
  throw new Error('Application root element is missing.');
}

createRoot(root).render(
  <StrictMode>
    <ApiQueryProvider>
      <SessionProvider service={session}>
        <App />
      </SessionProvider>
    </ApiQueryProvider>
  </StrictMode>,
);
