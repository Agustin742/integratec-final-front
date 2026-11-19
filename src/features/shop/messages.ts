/**
 * Centralized Spanish (`es-AR`) copy for the classroom shop catalog, purchase
 * confirmation, idempotent retry/reconciliation, and purchase history.
 * Never expose internal story IDs, backend stack traces, or raw error codes.
 */
export const shopMessages = {
  panel: {
    heading: 'Tienda del aula',
    description:
      'Canjeá tus puntos individuales del aula por accesorios para tu avatar, mejoras de escritorio o elementos compartidos del aula.',
    studentOnlyTitle: 'Tienda disponible solo para estudiantes',
    studentOnlyDescription:
      'Solo estudiantes inscriptos en el aula pueden consultar el catálogo y realizar compras con su saldo individual de puntos.',
    balanceLabel: 'Tu saldo disponible',
    balanceLoading: 'Consultando saldo…',
    balanceUnavailable: 'Saldo no disponible en este momento',
    balanceRetry: 'Reintentar saldo',
    tabCatalog: 'Catálogo',
    tabPurchases: 'Mis compras',
    liveShopUpdated: 'Catálogo y saldo actualizados.',
  },
  filters: {
    kindLabel: 'Categoría',
    kindAll: 'Todas las categorías',
    sortLabel: 'Ordenar por',
    sortCreatedAsc: 'Destacados (orden del aula)',
    sortPriceAsc: 'Menor precio primero',
    sortPriceDesc: 'Mayor precio primero',
    sortNameAsc: 'Nombre (A–Z)',
    sortNameDesc: 'Nombre (Z–A)',
  },
  kinds: {
    AVATAR_ACCESSORY: 'Accesorio de avatar',
    DESK_UPGRADE: 'Mejora de escritorio',
    CLASSROOM_ITEM: 'Elemento del aula',
    PET_ACCESSORY: 'Accesorio de mascota',
  },
  catalog: {
    loading: 'Cargando catálogo de la tienda…',
    emptyTitle: 'Todavía no hay artículos disponibles',
    emptyDescription:
      'Esta aula todavía no tiene artículos habilitados en la tienda.',
    filteredEmptyTitle: 'No hay artículos en esta categoría',
    filteredEmptyDescription:
      'Probá elegir otra categoría para ver el resto del catálogo disponible.',
    outOfRangeTitle: 'No hay artículos en esta página',
    outOfRangeDescription:
      'El catálogo cambió y esta página quedó fuera de rango. Volvé a la primera página para continuar.',
    backToFirstPage: 'Volver a la primera página',
    clearFilters: 'Ver todas las categorías',
    staleTitle: 'Mostrando el último catálogo conocido',
    staleDescription:
      'No pudimos actualizar la tienda. Podés reintentar sin perder tu ubicación.',
    forbiddenTitle: 'Sin permiso para acceder a la tienda',
    forbiddenDescription:
      'Tu rol actual en esta aula no habilita compras en la tienda.',
    notFoundTitle: 'No encontramos la tienda de esta aula',
    notFoundDescription:
      'El aula ya no está disponible para tu cuenta o perdiste el acceso.',
    loadErrorTitle: 'No pudimos cargar el catálogo',
    loadErrorDescription:
      'Ocurrió un problema al consultar los artículos de la tienda. Intentá nuevamente.',
    resultsSummary: (shown: number, total: number) =>
      total === 1
        ? '1 artículo en la tienda'
        : `Mostrando ${shown} de ${total} artículos`,
    buyAction: 'Comprar',
    retrySameAttemptAction: 'Reintentar verificación',
    statusOwnedStudent: 'Ya lo tenés',
    statusOwnedClassroom: 'Desbloqueado en el aula',
    statusUpcoming: 'Próximamente',
    statusUnavailable: 'No disponible',
    insufficientBalanceHint: 'Saldo insuficiente según tu último saldo',
    classroomScopeHint: 'Se desbloquea para toda el aula',
  },
  purchases: {
    loading: 'Cargando historial de compras…',
    emptyTitle: 'Todavía no realizaste compras en esta aula',
    emptyDescription:
      'Cuando canjees tus puntos por un artículo del catálogo, tu historial confirmado aparecerá acá.',
    outOfRangeTitle: 'No hay compras en esta página',
    outOfRangeDescription:
      'Tu historial cambió y esta página quedó fuera de rango. Volvé a la primera página.',
    backToFirstPage: 'Volver a la primera página',
    staleTitle: 'Mostrando el último historial conocido',
    staleDescription:
      'No pudimos actualizar tu historial de compras. Podés reintentar.',
    loadErrorTitle: 'No pudimos cargar tu historial de compras',
    loadErrorDescription:
      'Ocurrió un problema al consultar tus compras confirmadas. Intentá nuevamente.',
    summary: (shown: number, total: number) =>
      total === 1
        ? '1 compra confirmada'
        : `Mostrando ${shown} de ${total} compras`,
    purchasedAtPrefix: 'Comprado:',
    paidLabel: (formattedPoints: string) => `Pagado: ${formattedPoints}`,
  },
  confirm: {
    title: 'Confirmar compra',
    description:
      'Revisá el precio confirmado por el servidor antes de canjear tus puntos individuales.',
    itemLabel: 'Artículo',
    categoryLabel: 'Categoría',
    priceLabel: 'Precio',
    currentBalanceLabel: 'Tu saldo actual',
    insufficientWarningTitle: 'Tu saldo actual parece insuficiente',
    insufficientWarningBody:
      'Según tu último saldo conocido no alcanzás el precio de este artículo. Si recibiste puntos recién, el servidor validará tu saldo real al confirmar.',
    pendingNotice:
      'Confirmando compra con el servidor… No cierres esta ventana hasta recibir respuesta.',
    cancelAction: 'Cancelar',
    confirmAction: 'Confirmar compra',
    confirmingAction: 'Comprando…',
    retryUncertainAction: 'Reintentar con la misma solicitud',
    uncertainTitle: 'No pudimos confirmar el resultado de la compra',
    uncertainBody:
      'Se interrumpió la conexión o el servidor tardó demasiado. Verificamos tu saldo y tus compras para evitar cobros duplicados. Si todavía no aparece acreditada, podés reintentar con la misma clave de idempotencia.',
    uncertainReconciledSuccess: (itemName: string, balanceText: string) =>
      `El servidor confirmó tu compra de «${itemName}». Saldo actualizado: ${balanceText}.`,
    confirmedToast: (itemName: string, balanceText: string) =>
      `Compra confirmada: «${itemName}». Saldo actual: ${balanceText}.`,
    replayedToast: (itemName: string, balanceText: string) =>
      `Esta compra de «${itemName}» ya estaba confirmada (sin doble cobro). Saldo actual: ${balanceText}.`,
  },
  errors: {
    validation:
      'No pudimos procesar la solicitud de compra. Cerrá el diálogo y volvé a intentarlo.',
    sessionExpired:
      'Tu sesión venció. Iniciá sesión nuevamente para comprar en la tienda.',
    forbidden: 'Solo estudiantes activos del aula pueden comprar en la tienda.',
    notFound:
      'El artículo ya no está disponible en la tienda o perdiste acceso al aula. Actualizamos el catálogo.',
    conflictInsufficientBalance:
      'No tenés puntos suficientes para comprar este artículo. Tu saldo no fue modificado.',
    conflictAlreadyOwnedStudent:
      'Ya tenés este artículo en tu inventario de esta aula. Tu saldo no fue modificado.',
    conflictAlreadyOwnedClassroom:
      'Este elemento ya está desbloqueado en el aula. Tu saldo no fue modificado.',
    conflictUnimplemented:
      'Este artículo todavía no está habilitado para la compra. Tu saldo no fue modificado.',
    conflictGeneric:
      'No se pudo completar la compra porque tu saldo o la disponibilidad del artículo cambió en el servidor. Actualizamos el catálogo y tu saldo.',
    rateLimited:
      'Realizaste demasiados intentos de compra en poco tiempo. Esperá unos instantes antes de volver a intentar.',
    uncertain:
      'No pudimos confirmar si la compra se procesó en el servidor. Estamos verificando tu saldo y tus compras antes de reintentar.',
    invalidResponse:
      'Recibimos una respuesta inesperada del servidor al consultar la tienda.',
  },
} as const;
