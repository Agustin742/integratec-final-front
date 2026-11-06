import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ApiQueryProvider } from './api/query-client';
import { App } from './app/App';
import { getPublicConfig } from './config/public-config';
import './styles/index.css';

getPublicConfig();

const root = document.getElementById('root');
if (!root) {
  throw new Error('Application root element is missing.');
}

createRoot(root).render(
  <StrictMode>
    <ApiQueryProvider>
      <App />
    </ApiQueryProvider>
  </StrictMode>,
);
