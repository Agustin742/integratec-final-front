/**
 * Centralized Spanish (Argentina, es-AR, voseo) messages for the daily review
 * (#55, HU-BOT-003). Every user-facing string of the dialog lives here,
 * mirroring `features/points/messages.ts`.
 */
export const dailyReviewMessages = {
  errors: {
    unexpected:
      'No pudimos interpretar tu repaso diario. Intentá de nuevo más tarde.',
    network: 'No pudimos conectar para traer tu repaso diario.',
  },
} as const;
