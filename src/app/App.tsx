import { useState } from 'react';
import { AvatarEntry } from '../features/avatar/AvatarEntry';
import type { AvatarConfiguration } from '../features/avatar/AvatarCustomizer';
import type { AppearanceCatalogue } from '../features/avatar/avatar-appearance';
import { ReceptionPreview } from '../features/world/ReceptionPreview';

interface ConfirmedEntry {
  configuration: AvatarConfiguration;
  catalogue: AppearanceCatalogue;
  warning?: string;
}

/** The wardrobe is the entry menu; confirming it enters reception with that avatar. */
export function App() {
  const [confirmed, setConfirmed] = useState<ConfirmedEntry>();
  return (
    <main className="app-shell">
      {confirmed ? <>
        {confirmed.warning && <p role="alert" className="reception-warning">{confirmed.warning}</p>}
        <button type="button" className="reception-wardrobe-button" onClick={() => setConfirmed(undefined)}>Vestidor</button>
        <ReceptionPreview configuration={confirmed.configuration} catalogue={confirmed.catalogue} />
      </> : <AvatarEntry onConfirm={(configuration, catalogue, warning) => setConfirmed({ configuration, catalogue, warning })} />}
    </main>
  );
}
