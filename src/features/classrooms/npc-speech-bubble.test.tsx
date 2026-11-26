import { render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, test } from 'vitest';
import { NpcSpeechBubble } from './npc-speech-bubble';

describe('NpcSpeechBubble', () => {
  test('announces the phrase politely and hides when there is none', () => {
    const ref = createRef<HTMLDivElement>();
    const view = render(<NpcSpeechBubble anchorRef={ref} speech={undefined} />);
    const status = screen.getByTestId('npc-speech-status');
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(status).toHaveTextContent('');
    expect(ref.current).toHaveAttribute('hidden');

    view.rerender(
      <NpcSpeechBubble
        anchorRef={ref}
        speech={{ npcId: 'tutorBot', text: 'El sol es una estrella', seq: 1 }}
      />,
    );
    expect(ref.current).not.toHaveAttribute('hidden');
    expect(screen.getByTestId('npc-speech-bubble')).toHaveTextContent(
      'El sol es una estrella',
    );
    expect(status).toHaveTextContent('El sol es una estrella');
  });

  test('is click-through so it never blocks the 3D world', () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <NpcSpeechBubble
        anchorRef={ref}
        speech={{ npcId: 'tutorBot', text: 'Hola', seq: 1 }}
      />,
    );
    expect(ref.current?.className).toContain('pointer-events-none');
  });
});
