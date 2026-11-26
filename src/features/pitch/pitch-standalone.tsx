import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router';
import '@/styles/index.css';
import { PITCH_LIVE_DEPLOY_URL } from './pitch-config';
import { PitchDeckPage } from './pitch-deck-page';

function LoginHandoffRedirect() {
  useEffect(() => {
    const target = /^https?:\/\//i.test(PITCH_LIVE_DEPLOY_URL)
      ? PITCH_LIVE_DEPLOY_URL
      : window.location.protocol === 'file:'
        ? `http://localhost:5173${PITCH_LIVE_DEPLOY_URL}`
        : PITCH_LIVE_DEPLOY_URL;
    window.location.assign(target);
  }, []);
  return null;
}

const root = document.getElementById('root');
if (!root) {
  throw new Error('Presentation root element is missing.');
}

createRoot(root).render(
  <StrictMode>
    <MemoryRouter initialEntries={['/pitch']}>
      <Routes>
        <Route path="/login" element={<LoginHandoffRedirect />} />
        <Route path="*" element={<PitchDeckPage />} />
      </Routes>
    </MemoryRouter>
  </StrictMode>,
);
