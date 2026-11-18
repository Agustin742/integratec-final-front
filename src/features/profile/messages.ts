import type { Avatar } from './avatar-options';

type BodyId = Avatar['bodyId'];
type HairId = Avatar['hairId'];
type TopId = Avatar['topId'];
type HairColor = Avatar['hairColor'];
type ClothingColor = Avatar['clothingColor'];

/**
 * Centralized es-AR copy for the profile and base avatar form (HU-AUT-003).
 * The `Record` types make a contract change (a body, hairstyle, top or color
 * the backend adds or removes) a compile error instead of a missing label.
 */
export const profileMessages = {
  page: {
    title: 'Mi perfil',
    subtitle:
      'Cambiá tu nombre y la apariencia base de tu avatar. Lo que guardes se mantiene en todos tus dispositivos.',
    emailLabel: 'Correo de la cuenta',
    emailNote: 'El correo no se puede editar desde acá.',
  },
  loading: 'Cargando tu perfil...',
  loadError: {
    title: 'No pudimos cargar tu perfil',
    description:
      'No pudimos obtener tu perfil guardado. No es que no tengas uno: reintentá en unos segundos.',
  },
  stale: {
    title: 'Estás viendo datos que pueden estar desactualizados',
    description:
      'No pudimos actualizar tu perfil desde el servidor. Lo que ves es lo último que confirmamos.',
  },
  status: {
    saved: 'Guardado',
    unsaved: 'Cambios sin guardar',
    saving: 'Guardando...',
    failed: 'No se guardó',
  },
  displayName: {
    heading: 'Nombre para mostrar',
    description: 'Es el nombre que ven las demás personas de tus aulas.',
    label: 'Nombre para mostrar',
    hint: 'Entre 1 y 100 caracteres.',
    submit: 'Guardar nombre',
    submitting: 'Guardando nombre...',
    confirmed: 'Guardamos tu nombre.',
    rootTitle: 'No pudimos guardar tu nombre',
    validation: {
      required: 'Ingresá un nombre para mostrar.',
      tooLong: 'El nombre no puede superar los 100 caracteres.',
      invalidCharacters:
        'El nombre no puede contener saltos de línea ni caracteres de control.',
      notVisible: 'El nombre debe incluir al menos un carácter visible.',
    },
  },
  avatar: {
    heading: 'Avatar base',
    description:
      'Elegí cómo te ven en el aula. Los cambios son un borrador hasta que los guardes.',
    previewHeading: 'Vista previa',
    previewNote:
      'Vista previa 2D de tu selección. El modelo 3D llega en una entrega posterior.',
    previewDraft: 'Borrador sin guardar',
    previewSaved: 'Avatar guardado',
    previewAlt: 'Vista previa del avatar:',
    submit: 'Guardar avatar',
    submitting: 'Guardando avatar...',
    discard: 'Descartar cambios',
    confirmed: 'Guardamos tu avatar.',
    rootTitle: 'No pudimos guardar tu avatar',
    adjusted:
      'Ajustamos peinado y prenda: algunas opciones no están disponibles para el cuerpo elegido.',
    groups: {
      bodyId: 'Cuerpo',
      hairId: 'Peinado',
      topId: 'Prenda superior',
      hairColor: 'Color de pelo',
      clothingColor: 'Color de la prenda',
    },
    validation: {
      incompatibleHair:
        'Ese peinado no está disponible para el cuerpo elegido.',
      incompatibleTop: 'Esa prenda no está disponible para el cuerpo elegido.',
    },
  },
  errors: {
    invalidResponse:
      'El servidor respondió algo que no pudimos interpretar. Recargá la página para ver tu perfil guardado.',
    networkUncertain:
      'No pudimos confirmar si el cambio se guardó. Verificamos tu perfil guardado antes de repetirlo: revisá lo que ves y volvé a guardar si hace falta.',
    forbidden:
      'El servidor no permitió usar alguna de las opciones elegidas. Tu avatar guardado no cambió; elegí otras opciones.',
    validation:
      'El servidor rechazó los datos. Revisá los campos marcados; tu borrador se conservó.',
    unexpected:
      'No pudimos guardar el cambio. Tu borrador se conservó: intentá de nuevo en unos segundos.',
  },
  leaveConfirm:
    'Tenés cambios sin guardar en tu perfil. ¿Seguro que querés salir sin guardar?',
  options: {
    bodyId: {
      male: 'Masculino',
      female: 'Femenino',
    } satisfies Record<BodyId, string>,
    hairId: {
      afro: 'Afro',
      dreads: 'Rastas',
      original: 'Clásico',
    } satisfies Record<HairId, string>,
    topId: {
      hoodie: 'Buzo con capucha',
      tank: 'Musculosa',
      tshirt: 'Remera',
    } satisfies Record<TopId, string>,
    hairColor: {
      '#6C4D48': 'Castaño',
      '#AF6D63': 'Cobrizo',
      '#E5AD58': 'Rubio',
      '#353849': 'Azul noche',
      '#C77DAA': 'Rosa',
    } satisfies Record<HairColor, string>,
    clothingColor: {
      '#5B4F96': 'Violeta',
      '#75B7DA': 'Celeste',
      '#F2C85C': 'Amarillo',
      '#EFA5AE': 'Rosa',
      '#7EBA8B': 'Verde',
      '#F4E6D2': 'Crema',
    } satisfies Record<ClothingColor, string>,
  },
} as const;
