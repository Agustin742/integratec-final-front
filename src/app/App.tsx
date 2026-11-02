import { useEffect, useState, type MouseEvent } from 'react';
import { AvatarEntry } from '../features/avatar/AvatarEntry';
import { ReceptionPreview } from '../features/world/ReceptionPreview';

export function App() {
  const [path, setPath] = useState(() => window.location.pathname);
  const [persistenceWarning, setPersistenceWarning] = useState<string>();
  useEffect(() => {
    const update = () => setPath(window.location.pathname);
    window.addEventListener('popstate', update);
    return () => window.removeEventListener('popstate', update);
  }, []);
  const receptionPath = import.meta.env.BASE_URL;
  const wardrobePath = `${receptionPath}wardrobe`;
  const navigate = (next: string) => {
    window.history.pushState(null, '', next);
    setPath(next);
  };
  const follow = (event: MouseEvent<HTMLAnchorElement>, next: string) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    navigate(next);
  };
  const wardrobe = path === wardrobePath || path === `${wardrobePath}/`;
  return (
    <main className="app-shell" style={{ display: 'flex', flexDirection: 'column', height: '100dvh' }}>
      <nav aria-label="Navegación principal" style={{ flexShrink: 0 }}>
        {wardrobe
          ? <a href={receptionPath} onClick={event => follow(event, receptionPath)}>Volver a recepción</a>
          : <a href={wardrobePath} onClick={event => follow(event, wardrobePath)}>Vestidor</a>}
      </nav>
      {!wardrobe && persistenceWarning && <p role="alert" style={{ flexShrink: 0, margin: '8px 16px' }}>{persistenceWarning}</p>}
      {wardrobe ? <div className="avatar-wardrobe-page" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        <p role="note" style={{ flexShrink: 0, margin: '8px 16px' }}>Este vestidor guarda un borrador solo en este navegador. Volver a recepción no cambia tu apariencia en el mundo ni en el servidor.</p>
        <AvatarEntry onConfirm={(_configuration, _catalogue, warning) => {
          setPersistenceWarning(warning);
          navigate(receptionPath);
        }} />
      </div> : <div style={{ flex: 1, minHeight: 0 }}><ReceptionPreview /></div>}
    </main>
  );
}
