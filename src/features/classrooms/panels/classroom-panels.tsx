import {
  createContext,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';

export type PanelDescriptor = {
  key: string;
  title: string;
  component: ComponentType;
};
export type PanelAvailability =
  { confirmed: false } | { confirmed: true; keys: readonly string[] };
export type ClassroomPanelsProps = {
  userId: string;
  classroomId: string;
  routeOwner?: string;
  registry: readonly PanelDescriptor[];
  availability?: PanelAvailability;
  description: string;
  fallbackFocus: () => HTMLElement | null;
  /**
   * True while a 3D scene fills the screen behind the panels: the dialog
   * overlay then only dims and blurs lightly so the world stays visible.
   */
  immersive?: boolean;
  children: ReactNode;
};
export type ClassroomPanelsController = {
  canOpenPanel: (key: string) => boolean;
  openPanel: (
    key: string,
    invoker?: HTMLElement,
    onClose?: () => void,
    routeOwner?: string,
  ) => boolean;
  hasActivePanel: boolean;
};
const PanelsContext = createContext<ClassroomPanelsController | null>(null);

export function useClassroomPanels(): ClassroomPanelsController {
  const controller = useContext(PanelsContext);
  if (!controller) throw new Error('ClassroomPanelsProvider is required');
  return controller;
}

export function useOptionalClassroomPanels(): ClassroomPanelsController | null {
  return useContext(PanelsContext);
}

export function ClassroomPanelsProvider(props: ClassroomPanelsProps) {
  return (
    <ScopedPanels
      key={JSON.stringify([props.userId, props.classroomId])}
      {...props}
    />
  );
}

function findPanel(props: ClassroomPanelsProps, key: string) {
  if (
    !props.availability?.confirmed ||
    !props.availability.keys.includes(key)
  ) {
    return undefined;
  }
  // Ambiguous registration is not a usable destination.
  const matches = props.registry.filter((panel) => panel.key === key);
  return matches.length === 1 ? matches[0] : undefined;
}

function focusIfUsable(element: HTMLElement | null | undefined): boolean {
  if (
    !element?.isConnected ||
    element.closest('[hidden], [inert], [aria-hidden="true"]') ||
    element.matches(':disabled, [aria-disabled="true"]')
  ) {
    return false;
  }
  for (
    let ancestor: HTMLElement | null = element;
    ancestor;
    ancestor = ancestor.parentElement
  ) {
    const style = getComputedStyle(ancestor);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
  }
  element.focus();
  return document.activeElement === element;
}

function ScopedPanels(props: ClassroomPanelsProps) {
  const [active, setActive] = useState<{
    key: string;
    invoker?: HTMLElement;
    onClose?: () => void;
    routeOwner?: string;
  } | null>(null);
  const current = useRef<ClassroomPanelsProps | null>(null);
  useLayoutEffect(() => {
    current.current = props;
    return () => {
      current.current = null;
    };
  });
  const descriptor = active ? findPanel(props, active.key) : undefined;
  // Reset during render: no protected subtree or retained draft gets a frame
  // after revocation, and restoring availability cannot resurrect this intent.
  if (
    active &&
    (!descriptor ||
      (active.routeOwner !== undefined &&
        active.routeOwner !== props.routeOwner))
  )
    setActive(null);

  function openPanel(
    key: string,
    invoker?: HTMLElement,
    onClose?: () => void,
    routeOwner?: string,
  ): boolean {
    if (!current.current || !findPanel(current.current, key)) return false;
    setActive({ key, invoker, onClose, routeOwner });
    return true;
  }
  const Panel = descriptor?.component;
  const hasActivePanel = Boolean(active && descriptor && Panel);
  return (
    <PanelsContext.Provider
      value={{
        openPanel,
        canOpenPanel: (key) => Boolean(findPanel(props, key)),
        hasActivePanel,
      }}
    >
      {props.children}
      {active && descriptor && Panel && (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) setActive(null);
          }}
        >
          <DialogContent
            key={descriptor.key}
            className="max-h-[calc(100%-2rem)] [overflow-wrap:anywhere]"
            overlayClassName={
              props.immersive ? 'bg-foreground/15 backdrop-blur-xs' : undefined
            }
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              if (!focusIfUsable(active.invoker))
                focusIfUsable(props.fallbackFocus());
              active.onClose?.();
            }}
          >
            <DialogTitle>{descriptor.title}</DialogTitle>
            <DialogDescription>{props.description}</DialogDescription>
            <Panel />
          </DialogContent>
        </Dialog>
      )}
    </PanelsContext.Provider>
  );
}
