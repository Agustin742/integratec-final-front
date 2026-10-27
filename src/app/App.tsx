import { useState } from 'react';
import { AvatarPreview } from '../features/avatar/AvatarPreview';
import { ReceptionPreview } from '../features/world/ReceptionPreview';

export function App() {
  const [view, setView] = useState<'reception' | 'calibration'>('reception');
  return <main>
    <h1>{view === 'reception' ? 'Reception — local navigation study' : 'Avatar calibration preview'}</h1>
    <nav aria-label="Local study views">
      <button type="button" aria-pressed={view === 'reception'} onClick={() => setView('reception')}>Reception navigation</button>
      <button type="button" aria-pressed={view === 'calibration'} onClick={() => setView('calibration')}>Avatar calibration</button>
    </nav>
    {view === 'reception' ? <ReceptionPreview /> : <AvatarPreview />}
    <p>Single-player local experiment. Objects are not interactable yet. No authentication, multiplayer,
      tasks, chat, business actions or persistence. Other rooms await teammates’ feedback.</p>
  </main>;
}
