/**
 * Centralized Spanish (`es-AR`) copy for the inventory panel and profile section.
 * No inline JSX string literals — all user-visible text via this object.
 */
export const inventoryMessages = {
  panel: {
    heading: 'Mi inventario',
    description:
      'Equipá los artículos que compraste en la tienda para personalizar tu avatar y tu escritorio.',
    studentOnlyTitle: 'Inventario disponible solo para estudiantes',
    studentOnlyDescription:
      'Solo estudiantes inscriptos en el aula pueden acceder al inventario y equipar artículos.',
    loading: 'Cargando inventario…',
    equipLoading: 'Aplicando cambio…',
    retry: 'Reintentar',
    staleTitle: 'Mostrando el último estado conocido',
    staleDescription:
      'No pudimos actualizar tu equipamiento. Podés reintentar sin perder tu selección.',
  },
  slots: {
    head: 'Cabeza',
    face: 'Cara',
    back: 'Espalda',
    desk_decor: 'Decoración del escritorio',
  } as Record<string, string>,
  actions: {
    equip: 'Equipar',
    unequip: 'Desequipar',
    equipped: 'Equipado',
    noItem: 'Ranura vacía',
    selectItem: 'Elegí un artículo para equipar',
    selectPlaceholder: '— Sin equipar —',
  },
  states: {
    pending: 'Guardando…',
    confirmed: 'Guardado',
    rejected: 'No se pudo guardar',
  },
  errors: {
    loadError:
      'No pudimos cargar tu inventario. Revisá tu conexión e intentá de nuevo.',
    loadForbidden:
      'Tu rol actual en esta aula no te permite consultar el inventario.',
    notOwned:
      'No tenés ese artículo en tu inventario. El estado de equipamiento no fue modificado.',
    notFound: 'El artículo o la ranura indicada no existe en esta aula.',
    conflict: 'Este artículo no es compatible con la ranura seleccionada.',
    forbidden: 'Tu rol actual en esta aula no te permite equipar artículos.',
    rateLimited:
      'Realizaste demasiados cambios en poco tiempo. Esperá unos segundos antes de volver a intentar.',
    sessionExpired: 'Tu sesión expiró. Volvé a iniciar sesión.',
    validation: 'Los datos enviados no son válidos.',
    uncertain:
      'No pudimos confirmar si el cambio se aplicó en el servidor. Verificá el estado antes de volver a intentar.',
    invalidResponse:
      'El servidor devolvió una respuesta inválida. Intentá de nuevo en unos instantes.',
  },
  empty: {
    title: 'Todavía no tenés artículos comprados',
    description:
      'Cuando compres artículos en la tienda, vas a poder equiparlos acá para personalizar tu avatar y tu escritorio.',
    noEquipableTitle: 'Todavía no tenés artículos equipables',
    noEquipableDescription:
      'Comprá accesorios para tu avatar o mejoras de escritorio en la tienda para poder equiparlos en estas ranuras.',
  },
  purchases: {
    heading: 'Artículos disponibles',
  },
  profile: {
    heading: 'Inventario por aula',
    description:
      'Elegí una de tus aulas para ver y equipar los artículos que compraste en su tienda.',
    classroomLabel: 'Aula',
    loading: 'Cargando tus aulas…',
    errorTitle: 'No pudimos cargar tus aulas',
    errorDescription:
      'Intentá nuevamente para acceder a tu inventario por aula.',
    emptyTitle: 'No tenés aulas como estudiante',
    emptyDescription:
      'Cuando te inscribas como estudiante en un aula, vas a poder gestionar tu inventario desde acá.',
  },
} as const;
