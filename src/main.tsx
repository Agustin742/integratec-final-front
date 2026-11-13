import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ApiQueryProvider } from './api/query-client';
import { RouterProvider } from 'react-router/dom';
import { createAppRouter } from './app/router/routes';
import { getPublicConfig } from './config/public-config';
import { createSession } from './session/controller';
import { SessionProvider } from './session/provider';
import './styles/index.css';

getPublicConfig();
const session = createSession();
const router = createAppRouter();

const root = document.getElementById('root');
if (!root) {
  throw new Error('Application root element is missing.');
}

createRoot(root).render(
  <StrictMode>
    <ApiQueryProvider>
      <SessionProvider service={session}>
        <RouterProvider router={router} />
      </SessionProvider>
    </ApiQueryProvider>
  </StrictMode>,
);
