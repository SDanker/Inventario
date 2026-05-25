import { UserRole } from "@prisma/client";

/**
 * Sesión "ligera" que circula por servicios y route handlers.
 * Coincide con lo que la sesión de Auth.js expone tras los callbacks.
 */
export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  unitId: string | null;
};

/**
 * Acciones controlables. Convención: `recurso.acción`.
 * Mantener cerrado: cualquier acción nueva pasa por aquí.
 */
export type Action =
  | "units.read.any" | "units.read.own" | "units.write" | "units.deactivate"
  | "users.read" | "users.write" | "users.deactivate"
  | "categories.read" | "categories.write"
  | "materials.read" | "materials.write"
  | "assets.read.any" | "assets.read.own" | "assets.write.own" | "assets.decommission"
  | "consumables.read.any" | "consumables.read.own" | "consumables.write.own"
  | "movements.read.any" | "movements.read.own" | "movements.write"
  | "movements.consume"
  | "transfers.read.any" | "transfers.read.own" | "transfers.request"
  | "transfers.approve" | "transfers.receive" | "transfers.reject"
  | "maintenance.read.any" | "maintenance.read.own" | "maintenance.write.own"
  | "documents.read.any" | "documents.read.own" | "documents.write.own" | "documents.delete"
  | "alerts.read.any" | "alerts.read.own" | "alerts.dismiss"
  | "reports.export.any" | "reports.export.own"
  | "audit.read"
  | "dashboard.commandancia" | "dashboard.unit";

const matrix: Record<UserRole, Set<Action>> = {
  COMANDANCIA_ADMIN: new Set<Action>([
    "units.read.any", "units.write", "units.deactivate",
    "users.read", "users.write", "users.deactivate",
    "categories.read", "categories.write",
    "materials.read", "materials.write",
    "assets.read.any", "assets.write.own", "assets.decommission",
    "consumables.read.any", "consumables.write.own",
    "movements.read.any", "movements.write", "movements.consume",
    "transfers.read.any", "transfers.request", "transfers.approve",
    "transfers.receive", "transfers.reject",
    "maintenance.read.any", "maintenance.write.own",
    "documents.read.any", "documents.write.own", "documents.delete",
    "alerts.read.any", "alerts.dismiss",
    "reports.export.any", "reports.export.own",
    "audit.read",
    "dashboard.commandancia", "dashboard.unit",
  ]),
  UNIT_MANAGER: new Set<Action>([
    "units.read.own",
    "categories.read",
    "materials.read",
    "assets.read.own", "assets.write.own", "assets.decommission",
    "consumables.read.own", "consumables.write.own",
    "movements.read.own", "movements.write", "movements.consume",
    "transfers.read.own", "transfers.request", "transfers.receive",
    "maintenance.read.own", "maintenance.write.own",
    "documents.read.own", "documents.write.own",
    "alerts.read.own", "alerts.dismiss",
    "reports.export.own",
    "dashboard.unit",
  ]),
  OPERATIONAL: new Set<Action>([
    "units.read.own",
    "materials.read",
    "assets.read.own", "assets.write.own",
    "consumables.read.own",
    "movements.read.own", "movements.write", "movements.consume",
    "alerts.read.own", "alerts.dismiss",
    "dashboard.unit",
  ]),
};

export function can(user: SessionUser | null | undefined, action: Action): boolean {
  if (!user) return false;
  return matrix[user.role].has(action);
}

export class ForbiddenError extends Error {
  constructor(message = "Acción no autorizada") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export function requirePermission(user: SessionUser | null | undefined, action: Action): asserts user is SessionUser {
  if (!can(user, action)) throw new ForbiddenError();
}
