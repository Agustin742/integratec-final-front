import {
  Component,
  lazy,
  Suspense,
  useCallback,
  useState,
  type ReactNode,
} from 'react';
import type { Avatar } from './avatar-options';
import { AvatarPreview } from './avatar-preview';

const AvatarPreview3D = lazy(() =>
  import('./avatar-preview-3d').then((module) => ({
    default: module.AvatarPreview3D,
  })),
);

/** A failed chunk import keeps the 2D preview instead of breaking the form. */
class ChunkBoundary extends Component<
  { readonly fallback: ReactNode; readonly children: ReactNode },
  { readonly failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export interface AvatarPreviewViewProps {
  readonly avatar: Avatar;
}

/**
 * Profile avatar preview: 3D when the device can render it, otherwise the 2D
 * `AvatarPreview`. The 2D preview is also what shows while the 3D code loads.
 * A WebGL failure is remembered for the form's lifetime; a body file failure
 * only for that body, so choosing the other body tries 3D again. Failures never
 * affect the surrounding form.
 */
export function AvatarPreviewView({ avatar }: AvatarPreviewViewProps) {
  const [webglFailed, setWebglFailed] = useState(false);
  const [failedBody, setFailedBody] = useState<Avatar['bodyId'] | null>(null);
  const { bodyId } = avatar;
  const onBodyError = useCallback(() => setFailedBody(bodyId), [bodyId]);
  const onUnavailable = useCallback(() => setWebglFailed(true), []);

  const flat = <AvatarPreview avatar={avatar} />;
  if (webglFailed || failedBody === bodyId) return flat;
  return (
    <ChunkBoundary fallback={flat}>
      <Suspense fallback={flat}>
        <AvatarPreview3D
          avatar={avatar}
          onUnavailable={onUnavailable}
          onBodyError={onBodyError}
        />
      </Suspense>
    </ChunkBoundary>
  );
}
