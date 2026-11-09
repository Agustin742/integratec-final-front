import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { ApiError } from '@/api/errors';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { expectAccessible } from '@/test/accessibility';
import { render } from '@/test/render';
import {
  FormField,
  FormRootError,
  useProtectedSubmit,
  useUnsavedChangesGuard,
  useZodForm,
} from './form-primitives';

const sampleSchema = z.object({
  displayName: z.string().min(3, 'El nombre debe tener al menos 3 caracteres.'),
  email: z.string().email('Ingresá un correo electrónico válido.'),
});

type SampleFormValues = z.infer<typeof sampleSchema>;

function SampleForm({
  onSubmit,
  defaultValues = { displayName: '', email: '' },
}: {
  onSubmit: (values: SampleFormValues) => Promise<void> | void;
  defaultValues?: SampleFormValues;
}) {
  const form = useZodForm({
    schema: sampleSchema,
    defaultValues,
  });

  const { handleSubmit, isSubmitting } = useProtectedSubmit(form, onSubmit);
  const { isDirty, confirmNavigation } = useUnsavedChangesGuard(
    form.formState.isDirty,
    {
      message: 'Tenés cambios sin guardar. ¿Querés salir igualmente?',
    },
  );

  return (
    <form onSubmit={handleSubmit} noValidate aria-label="Formulario de perfil">
      <FormRootError form={form} />
      <FormField
        control={form.control}
        name="displayName"
        label="Nombre visible"
        description="Se mostrará en el aula."
      >
        {(fieldProps) => <Input {...fieldProps} required />}
      </FormField>
      <FormField control={form.control} name="email" label="Correo electrónico">
        {(fieldProps) => <Input {...fieldProps} type="email" required />}
      </FormField>
      <div className="flex gap-2">
        <Button type="submit" busy={isSubmitting}>
          {isSubmitting ? 'Guardando...' : 'Guardar cambios'}
        </Button>
        <button
          type="button"
          onClick={() => {
            confirmNavigation();
          }}
        >
          {isDirty ? 'Salir con cambios' : 'Salir limpio'}
        </button>
      </div>
    </form>
  );
}

describe('form primitives (React Hook Form + Zod)', () => {
  it('validates client input with Zod and associates field errors accessibly', async () => {
    const onSubmit = vi.fn();
    const { container } = render(<SampleForm onSubmit={onSubmit} />);

    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    const nameError = await screen.findByText(
      'El nombre debe tener al menos 3 caracteres.',
    );
    expect(nameError).toHaveAttribute('role', 'alert');

    const nameInput = screen.getByRole('textbox', { name: 'Nombre visible' });
    expect(nameInput).toHaveAttribute('aria-invalid', 'true');
    expect(nameInput).toHaveAccessibleDescription(
      'Se mostrará en el aula. El nombre debe tener al menos 3 caracteres.',
    );
    expect(onSubmit).not.toHaveBeenCalled();

    await expectAccessible(container);
  });

  it('maps backend validation errors next to the field, announces them, preserves input, and routes unknown errors to FormRootError', async () => {
    const onSubmit = vi.fn().mockRejectedValueOnce(
      new ApiError({
        kind: 'validation',
        status: 400,
        code: 'VALIDATION_FAILED',
        userMessage: 'Revisá los campos marcados e intentá de nuevo.',
        details: [
          {
            field: 'email',
            messages: ['Este correo ya está registrado en la escuela.'],
          },
          {
            field: 'organization.Quota',
            messages: ['Se alcanzó el límite de cuentas de la escuela.'],
          },
        ],
        fieldErrors: {
          email: ['Este correo ya está registrado en la escuela.'],
          'organization.Quota': [
            'Se alcanzó el límite de cuentas de la escuela.',
          ],
        },
      }),
    );

    const { container } = render(
      <SampleForm
        onSubmit={onSubmit}
        defaultValues={{
          displayName: 'Prof. Ana García',
          email: 'ana@colegio.edu.ar',
        }}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    const fieldAlert = await screen.findByText(
      'Este correo ya está registrado en la escuela.',
    );
    expect(fieldAlert).toHaveAttribute('role', 'alert');

    const emailInput = screen.getByRole('textbox', {
      name: 'Correo electrónico',
    });
    expect(emailInput).toHaveAttribute('aria-invalid', 'true');
    expect(emailInput).toHaveAccessibleDescription(
      'Este correo ya está registrado en la escuela.',
    );
    expect(emailInput).toHaveValue('ana@colegio.edu.ar');

    const rootAlert = screen.getByText(
      /Se alcanzó el límite de cuentas de la escuela\./,
    );
    expect(rootAlert.closest('[role="alert"]')).toBeInTheDocument();

    await expectAccessible(container);
  });

  it('prevents duplicate submissions when submitting twice quickly', async () => {
    let resolveSubmission!: () => void;
    const onSubmit = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveSubmission = resolve;
        }),
    );

    render(
      <SampleForm
        onSubmit={onSubmit}
        defaultValues={{
          displayName: 'Prof. Ana García',
          email: 'ana@colegio.edu.ar',
        }}
      />,
    );

    const formElement = screen.getByRole('form', {
      name: 'Formulario de perfil',
    });

    // Rapidly trigger two form submissions before the first promise settles
    fireEvent.submit(formElement);
    fireEvent.submit(formElement);

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });

    const busyButton = screen.getByRole('button', { name: 'Guardando...' });
    expect(busyButton).toHaveAttribute('aria-busy', 'true');
    fireEvent.click(busyButton);
    expect(onSubmit).toHaveBeenCalledTimes(1);

    resolveSubmission();

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Guardar cambios' }),
      ).toBeVisible();
    });
  });

  it('guards against accidental loss of unsaved changes via beforeunload and confirmNavigation', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<SampleForm onSubmit={vi.fn()} />);

    const cleanEvent = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(cleanEvent);
    expect(cleanEvent.defaultPrevented).toBe(false);

    const nameInput = screen.getByRole('textbox', { name: 'Nombre visible' });
    fireEvent.change(nameInput, { target: { value: 'Nuevo nombre' } });

    const dirtyEvent = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(dirtyEvent);
    expect(dirtyEvent.defaultPrevented).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Salir con cambios' }));
    expect(confirmSpy).toHaveBeenCalledWith(
      'Tenés cambios sin guardar. ¿Querés salir igualmente?',
    );

    confirmSpy.mockRestore();
  });
});
