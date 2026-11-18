/**
 * Centralized Spanish (Argentina, es-AR, voseo) messages for the student
 * points wallet (#45, HU-GAM-001). Every user-facing string of the wallet
 * indicator and panel lives here, mirroring `features/classrooms/messages.ts`.
 */
const indicatorAction = 'Ver movimientos de puntos';

export const pointsMessages = {
  wallet: {
    indicator: {
      pending: 'Cargando tu saldo…',
      unavailable: 'Saldo no disponible',
      ready: (balance: number) => `${balance} puntos`,
      action: indicatorAction,
      accessibleName: (status: string) => `${status} · ${indicatorAction}`,
    },
    panel: {
      title: 'Tu billetera de puntos',
      description:
        'Consultá el saldo que calcula el servidor y el historial de tus movimientos. Cerralo para volver al espacio de trabajo.',
      balanceLabel: 'Saldo actual',
      balanceValue: (balance: number) => `${balance} puntos`,
      loading: 'Cargando tu billetera de puntos…',
      errorTitle: 'No pudimos cargar tu billetera',
      errorDescription: 'Revisá tu conexión e intentá de nuevo.',
      retryAction: 'Reintentar',
      staleTitle: 'Billetera pendiente de sincronización',
      staleDescription:
        'Mostrando el último saldo confirmado. Falló la actualización en segundo plano.',
      emptyTitle: 'Todavía no tenés movimientos',
      emptyDescription:
        'Los puntos aparecen cuando un docente califica una actividad o cuando comprás en la tienda. El saldo siempre lo calcula el servidor.',
      emptyPageTitle: 'No hay movimientos en esta página',
      emptyPageDescription:
        'Volvé a una página anterior para ver el resto de tus movimientos.',
      listLabel: 'Historial de movimientos de puntos',
      dateColumn: 'Fecha',
      reasonColumn: 'Motivo',
      movementColumn: 'Movimiento',
    },
  },
  error: {
    unexpected:
      'No pudimos interpretar los datos de tu billetera. Intentá de nuevo.',
  },
} as const;
