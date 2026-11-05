import { createRef, StrictMode, useState } from 'react';
import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { expectAccessible } from '../../test/accessibility';
import { render } from '../../test/render';
import { Button } from './button';
import { Field } from './field';
import { Input } from './input';
import { Label } from './label';

const copy = {
  save: 'Guardar',
  saving: 'Guardando…',
  name: 'Nombre',
  description: 'Ingresá el nombre del aula.',
  error: 'Revisá el nombre.',
  extra: 'Sin datos personales.',
  value: 'Aula de prueba',
};

describe('Button', () => {
  test('defaults to a non-submit button and exposes native events and ref', () => {
    const submit = vi.fn((event: React.SubmitEvent<HTMLFormElement>) =>
      event.preventDefault(),
    );
    const click = vi.fn();
    const ref = createRef<HTMLButtonElement>();
    render(
      <form onSubmit={submit}>
        <Button ref={ref} onClick={click}>
          {copy.save}
        </Button>
      </form>,
    );
    const button = screen.getByRole('button', { name: copy.save });
    fireEvent.click(button);
    expect(button).toHaveAttribute('type', 'button');
    expect(click).toHaveBeenCalledOnce();
    expect(submit).not.toHaveBeenCalled();
    expect(ref.current).toBe(button);
  });

  test('allows explicit form submission', () => {
    const submit = vi.fn((event: React.SubmitEvent<HTMLFormElement>) =>
      event.preventDefault(),
    );
    render(
      <form onSubmit={submit}>
        <Button type="submit">{copy.save}</Button>
      </form>,
    );
    fireEvent.click(screen.getByRole('button', { name: copy.save }));
    expect(submit).toHaveBeenCalledOnce();
  });

  test.each(['disabled', 'busy'] as const)(
    'prevents clicks while %s',
    (state) => {
      const click = vi.fn();
      render(
        <Button {...{ [state]: true }} onClick={click}>
          {copy.saving}
        </Button>,
      );
      const button = screen.getByRole('button', { name: copy.saving });
      expect(button).toBeDisabled();
      if (state === 'busy') expect(button).toHaveAttribute('aria-busy', 'true');
      fireEvent.click(button);
      expect(click).not.toHaveBeenCalled();
    },
  );

  test('returns to an operable state when pending work finishes', () => {
    const click = vi.fn();
    const { rerender } = render(<Button busy>{copy.saving}</Button>);
    rerender(
      <StrictMode>
        <Button busy={false} onClick={click}>
          {copy.save}
        </Button>
      </StrictMode>,
    );
    const button = screen.getByRole('button', { name: copy.save });
    expect(button).toBeEnabled();
    expect(button).not.toHaveAttribute('aria-busy', 'true');
    fireEvent.click(button);
    expect(click).toHaveBeenCalledOnce();
  });
});

describe('Input, Label and Field', () => {
  test('supports a standalone native label, editing, required and disabled states', () => {
    const ref = createRef<HTMLInputElement>();
    function Example() {
      const [value, setValue] = useState('');
      return (
        <>
          <Label htmlFor="standalone">{copy.name}</Label>
          <Input
            id="standalone"
            ref={ref}
            required
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
        </>
      );
    }
    const { rerender } = render(<Example />);
    const input = screen.getByRole('textbox', { name: copy.name });
    expect(input).toBeRequired();
    fireEvent.change(input, { target: { value: copy.value } });
    expect(input).toHaveValue(copy.value);
    expect(ref.current).toBe(input);
    input.focus();
    expect(input).toHaveFocus();
    rerender(
      <StrictMode>
        <Input aria-label={copy.name} disabled defaultValue={copy.value} />
      </StrictMode>,
    );
    expect(screen.getByRole('textbox', { name: copy.name })).toBeDisabled();
  });

  test('associates generated IDs, help and errors, preserving values on validation', async () => {
    const { rerender, container } = render(
      <Field label={copy.name} description={copy.description}>
        {(controlProps) => (
          <Input {...controlProps} defaultValue={copy.value} />
        )}
      </Field>,
    );
    const input = screen.getByRole('textbox', { name: copy.name });
    const id = input.id;
    expect(id).not.toBe('');
    expect(input).toHaveAccessibleDescription(copy.description);
    expect(input).not.toHaveAttribute('aria-invalid', 'true');
    rerender(
      <StrictMode>
        <Field
          label={copy.name}
          description={copy.description}
          error={copy.error}
        >
          {(controlProps) => (
            <Input {...controlProps} defaultValue={copy.value} />
          )}
        </Field>
      </StrictMode>,
    );
    expect(input.id).toBe(id);
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription(
      `${copy.description} ${copy.error}`,
    );
    expect(input).toHaveValue(copy.value);
    await expectAccessible(container);
    rerender(
      <StrictMode>
        <Field label={copy.name}>
          {(controlProps) => <Input {...controlProps} />}
        </Field>
      </StrictMode>,
    );
    expect(input).not.toHaveAttribute('aria-invalid', 'true');
    expect(input).not.toHaveAttribute('aria-describedby');
  });

  test('uses caller IDs, includes external help, and isolates multiple fields', () => {
    render(
      <>
        <p id="external-help">{copy.extra}</p>
        <Field
          id="room-name"
          label={copy.name}
          describedBy="external-help"
          error={copy.error}
        >
          {(controlProps) => <Input {...controlProps} />}
        </Field>
        <Field label={copy.value} description={copy.description}>
          {(controlProps) => <Input {...controlProps} />}
        </Field>
      </>,
    );
    const first = screen.getByRole('textbox', { name: copy.name });
    const second = screen.getByRole('textbox', { name: copy.value });
    expect(first).toHaveAttribute('id', 'room-name');
    expect(first).toHaveAccessibleDescription(`${copy.extra} ${copy.error}`);
    expect(second.id).not.toBe(first.id);
    expect(second).toHaveAccessibleDescription(copy.description);
    expect(second).not.toHaveAttribute('aria-invalid', 'true');
  });
});
