import type { SubmissionStatus } from './submission-schema';

export const submissionMessages = {
  validation: {
    count: 'Elegí entre 1 y 5 archivos para tu entrega.',
    type: 'Uno de los archivos no es un PDF, PNG, JPEG o DOCX válido.',
    size: 'Cada archivo puede pesar hasta 10 MB.',
    idempotencyKey:
      'No se pudo identificar el envío. Reintentá en unos segundos.',
  },
  serverErrors: {
    forbidden: 'La entrega está disponible únicamente para alumnos del aula.',
    windowClosed:
      'La fecha límite de entrega ya pasó y la actividad no admite entregas tardías.',
    windowNotOpen:
      'La actividad todavía no abrió. Podés entregar desde la fecha de apertura.',
    notFileActivity: 'Esta actividad no se resuelve con archivos.',
    duplicate:
      'Tu entrega ya está registrada con otro envío. Estás viendo la confirmación.',
    network:
      'No pudimos confirmar tu entrega. Estamos verificando el resultado con el servidor.',
    unexpected:
      'No pudimos leer la respuesta del servidor. Reintentá en unos segundos.',
  },
  panel: {
    heading: 'Tu entrega',
    loadingLabel: 'Consultando tu entrega',
    errorTitle: 'No pudimos cargar tu entrega',
    notSubmittedDescription:
      'Todavía no enviaste tu entrega. Elegí tus archivos y confirmá el envío; después vas a ver acá la confirmación del servidor.',
    statusLabels: {
      submitted: 'Entregado',
      graded: 'Calificada',
    } satisfies Record<SubmissionStatus, string>,
    lateBadge: 'Entrega tardía',
    submittedAtTerm: 'Fecha de entrega',
    filesLabel: 'Archivos de tu entrega',
    downloadLabel: 'Descargar',
    form: {
      fileInputLabel: 'Elegir archivos',
      fileInputHint:
        'Podés subir entre 1 y 5 archivos PDF, PNG, JPEG o DOCX de hasta 10 MB cada uno.',
      selectedFilesLabel: 'Archivos seleccionados',
      removeFileLabel: (name: string) => `Quitar ${name}`,
      submitLabel: 'Enviar entrega',
    },
    window: {
      dueAtLabel: 'Fecha límite',
      latePolicyTerm: 'Entrega tardía',
      notOpenReason:
        'La actividad todavía no abrió. Vas a poder entregar desde la fecha de apertura.',
      closedReason:
        'La fecha límite ya pasó y la actividad no admite entregas tardías.',
    },
    uploadingLabel: 'Enviando tu entrega…',
    progress: {
      label: 'Progreso del envío',
      valueText: (percent: number) => `Enviando tu entrega: ${percent}%`,
    },
    cancelAction: 'Cancelar envío',
    cancelNotice:
      'Cancelaste el envío. Tus archivos siguen seleccionados por si querés volver a intentarlo.',
    uncertainTitle: 'No pudimos confirmar tu entrega',
    uncertainChecking:
      'Estamos verificando con el servidor si tu entrega quedó registrada.',
    uncertainNothingStored:
      'Verificamos con el servidor y tu entrega no quedó guardada. Podés volver a enviar los mismos archivos.',
    uncertainUnverified:
      'No pudimos verificar el resultado con el servidor. Volvé a intentar la verificación en unos segundos.',
    uncertainReconciledNotice:
      'Verificamos con el servidor: tu entrega quedó registrada.',
    retryAction: 'Reintentar el envío',
    verifyAgainAction: 'Volver a verificar',
  },
} as const;
