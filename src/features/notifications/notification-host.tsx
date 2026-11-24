import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { NotificationCenter } from './notification-center';

interface NotificationHost {
  readonly claimed: boolean;
  readonly claim: () => () => void;
}

const HostContext = createContext<NotificationHost | null>(null);

/**
 * Lets exactly one `NotificationCenter` exist at a time. The app shell owns it
 * by default; a surface that covers the shell header (the floating 3D
 * classroom bar) claims it, the shell instance unmounts, and the claimant
 * renders the only one. Two live instances would double the polling, the live
 * announcements and the tray sheet.
 */
export function NotificationHostProvider({
  children,
}: {
  readonly children: ReactNode;
}) {
  const [claims, setClaims] = useState(0);
  const value = useMemo<NotificationHost>(
    () => ({
      claimed: claims > 0,
      claim: () => {
        setClaims((count) => count + 1);
        return () => setClaims((count) => count - 1);
      },
    }),
    [claims],
  );
  return <HostContext.Provider value={value}>{children}</HostContext.Provider>;
}

/** The shell header's bell: yields to a claimant while one is mounted. */
export function ShellNotificationCenter() {
  const host = useContext(HostContext);
  return host?.claimed ? null : <NotificationCenter />;
}

/**
 * Renders the bell in a covering surface. It only mounts after the claim
 * took effect, so the shell instance is gone first. Without a host it just
 * renders, since nothing else can own it.
 */
export function ClaimedNotificationCenter() {
  const host = useContext(HostContext);
  const claim = host?.claim;
  useEffect(() => claim?.(), [claim]);
  if (host && !host.claimed) return null;
  return <NotificationCenter />;
}
