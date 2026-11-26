import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ClassroomEmotes } from './classroom-emotes';

const wheel = () => screen.queryByRole('dialog', { name: 'Gestos' });
const choice = (name: string) => screen.getByRole('button', { name });
/** `false` when the press was consumed (`preventDefault`). */
const pressSpace = (target: Element = document.body) =>
  fireEvent.keyDown(target, { code: 'Space', key: ' ' });

function setup(available = true) {
  const onSelect = vi.fn(() => true);
  const view = render(
    <>
      <input aria-label="texto" />
      <textarea aria-label="largo" />
      <div contentEditable suppressContentEditableWarning data-testid="edit">
        x
      </div>
      <button type="button">otro</button>
      <ClassroomEmotes available={available} onSelect={onSelect} />
    </>,
  );
  return { onSelect, view };
}

describe('ClassroomEmotes (#154)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('opens with Space, without scrolling the page, listing the five gestures', () => {
    setup();
    expect(pressSpace()).toBe(false);
    expect(wheel()).toBeInTheDocument();
    for (const name of [
      'Saludar',
      'Festejar',
      'Aplaudir',
      'Bailar',
      'Levantar la mano',
    ]) {
      expect(choice(name)).toBeInTheDocument();
    }
    expect(choice('Saludar')).toHaveFocus();
  });

  it('ignores Space in text fields and on controls Space activates', () => {
    setup();
    for (const target of [
      screen.getByLabelText('texto'),
      screen.getByLabelText('largo'),
      screen.getByTestId('edit'),
      screen.getByRole('button', { name: 'otro' }),
    ]) {
      expect(pressSpace(target)).toBe(true);
    }
    expect(wheel()).not.toBeInTheDocument();
  });

  it('ignores Space while another dialog is open', () => {
    setup();
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    document.body.append(dialog);
    pressSpace();
    expect(wheel()).not.toBeInTheDocument();
    dialog.remove();
  });

  it('renders no button, only the wheel once Space opens it', () => {
    setup();
    expect(screen.getAllByRole('button')).toHaveLength(1);
    pressSpace();
    expect(screen.getAllByRole('button')).toHaveLength(6);
  });

  it('ignores Space while unavailable', () => {
    setup(false);
    expect(pressSpace()).toBe(true);
    expect(wheel()).not.toBeInTheDocument();
  });

  it('moves with arrows and Tab, closes with Escape and returns focus', () => {
    setup();
    pressSpace();
    fireEvent.keyDown(choice('Saludar'), { key: 'ArrowRight' });
    expect(choice('Festejar')).toHaveFocus();
    fireEvent.keyDown(choice('Festejar'), { key: 'ArrowLeft' });
    fireEvent.keyDown(choice('Saludar'), { key: 'ArrowLeft' });
    expect(choice('Levantar la mano')).toHaveFocus();
    fireEvent.keyDown(choice('Levantar la mano'), { key: 'Tab' });
    expect(choice('Saludar')).toHaveFocus();
    fireEvent.keyDown(choice('Saludar'), { key: 'Escape' });
    expect(wheel()).not.toBeInTheDocument();
    expect(document.body).toHaveFocus();
  });

  it('sends the pick and disables the choices during the cooldown', () => {
    vi.useFakeTimers();
    const { onSelect } = setup();
    pressSpace();
    fireEvent.click(choice('Bailar'));
    expect(onSelect).toHaveBeenCalledExactlyOnceWith('Dance');
    expect(wheel()).not.toBeInTheDocument();

    pressSpace();
    expect(choice('Saludar')).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(choice('Saludar'));
    expect(onSelect).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(choice('Saludar')).toHaveAttribute('aria-disabled', 'false');
  });

  it('keeps focus when an empty area of the wheel is pressed', () => {
    setup();
    pressSpace();
    expect(wheel()).toHaveClass('pointer-events-auto');
    expect(fireEvent.mouseDown(wheel()!)).toBe(false);
    expect(fireEvent.mouseDown(choice('Saludar'))).toBe(true);
  });

  it('announces the cooldown through a live region mounted beforehand', () => {
    setup();
    const status = screen.getByRole('status');
    expect(status).toBeEmptyDOMElement();
    pressSpace();
    fireEvent.click(choice('Bailar'));
    pressSpace();
    expect(screen.getByRole('status')).toBe(status);
    expect(status).toHaveTextContent(
      'Esperá unos segundos para repetir un gesto.',
    );
  });

  it('reports a failed send for a short time', () => {
    vi.useFakeTimers();
    const { onSelect } = setup();
    onSelect.mockReturnValue(false);
    const status = screen.getByRole('status');
    pressSpace();
    fireEvent.click(choice('Bailar'));
    expect(wheel()).not.toBeInTheDocument();
    expect(status).toHaveTextContent('No pudimos enviar el gesto.');

    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(status).toBeEmptyDOMElement();
  });
});
