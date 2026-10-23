// Reglas de negocio de los pedidos (sin base de datos).

export const ESTADOS = ['sin_asignar', 'asignado', 'en_camino', 'entregado', 'cancelado'];

/** Estados finales: un pedido entregado o cancelado ya no cambia. */
const FINALES = ['entregado', 'cancelado'];

/**
 * Transiciones permitidas por rol. El repartidor puede marcar "entregado"
 * desde "asignado" porque confirma la entrega desde la ruta sin haber
 * presionado antes "Iniciar entrega".
 */
const TRANSICIONES = {
  driver: {
    asignado: ['en_camino', 'entregado'],
    en_camino: ['entregado'],
  },
  customer: {
    sin_asignar: ['cancelado'],
  },
  admin: {
    sin_asignar: ['cancelado'],
    asignado: ['sin_asignar', 'en_camino', 'entregado', 'cancelado'],
    en_camino: ['asignado', 'entregado', 'cancelado'],
  },
};

const NOMBRE = {
  sin_asignar: 'sin asignar',
  asignado: 'asignado',
  en_camino: 'en camino',
  entregado: 'entregado',
  cancelado: 'cancelado',
};

/**
 * Valida un cambio de estado.
 * Devuelve { ok: true, sinCambios } o { ok: false, status, error }.
 * `sinCambios` = el pedido ya estaba en ese estado (p. ej. un reintento):
 * se responde ok sin repetir notificaciones, calificación ni alertas.
 */
export function validarTransicion(rol, actual, nuevo, { tieneRepartidor = true } = {}) {
  if (!ESTADOS.includes(nuevo)) {
    return { ok: false, status: 400, error: 'Estado inválido.' };
  }
  if (actual === nuevo) return { ok: true, sinCambios: true };

  if (rol === 'customer') {
    if (actual !== 'sin_asignar' || nuevo !== 'cancelado') {
      return { ok: false, status: 400, error: 'Solo puedes cancelar pedidos sin asignar.' };
    }
    return { ok: true, sinCambios: false };
  }
  if (rol === 'driver' && !['en_camino', 'entregado'].includes(nuevo)) {
    return { ok: false, status: 403, error: 'El repartidor solo puede marcar en_camino o entregado.' };
  }
  if (FINALES.includes(actual)) {
    return { ok: false, status: 409, error: `El pedido ya está ${NOMBRE[actual]} y no puede cambiar de estado.` };
  }
  const permitidos = TRANSICIONES[rol]?.[actual] ?? [];
  if (!permitidos.includes(nuevo)) {
    return {
      ok: false,
      status: 409,
      error: `No se puede pasar un pedido de ${NOMBRE[actual]} a ${NOMBRE[nuevo]}.`,
    };
  }
  if (['asignado', 'en_camino'].includes(nuevo) && !tieneRepartidor) {
    return { ok: false, status: 400, error: 'Asigna un repartidor antes de cambiar el estado.' };
  }
  return { ok: true, sinCambios: false };
}
