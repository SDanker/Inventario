import { UserRole } from "@prisma/client";
import type { SessionUser } from "./permissions";
import { ForbiddenError } from "./permissions";

/**
 * Devuelve el filtro `unit_id` que debe aplicarse a queries multi-unidad.
 * - COMANDANCIA_ADMIN puede ver todas, salvo que pida una unidad específica.
 * - Otros roles SIEMPRE quedan amarrados a su `unitId`.
 *
 * Uso típico:
 *   const where = { ...scopeByUnit(user, requestedUnitId) };
 *   prisma.asset.findMany({ where });
 */
export function scopeByUnit(user: SessionUser, requestedUnitId?: string | null) {
  if (user.role === UserRole.COMANDANCIA_ADMIN) {
    return requestedUnitId ? { unitId: requestedUnitId } : {};
  }
  if (!user.unitId) {
    throw new ForbiddenError("Usuario sin unidad asignada");
  }
  if (requestedUnitId && requestedUnitId !== user.unitId) {
    throw new ForbiddenError("No puede consultar inventario de otra unidad");
  }
  return { unitId: user.unitId };
}

/** Versión que devuelve el unitId resuelto, útil para inserts. */
export function resolveTargetUnitId(user: SessionUser, requestedUnitId?: string | null): string {
  if (user.role === UserRole.COMANDANCIA_ADMIN) {
    if (!requestedUnitId) throw new Error("Comandancia debe especificar la unidad destino");
    return requestedUnitId;
  }
  if (!user.unitId) throw new ForbiddenError("Usuario sin unidad asignada");
  if (requestedUnitId && requestedUnitId !== user.unitId) {
    throw new ForbiddenError("No puede operar sobre otra unidad");
  }
  return user.unitId;
}
