import type { Prisma, PrismaClient } from "@prisma/client";

type Tx = PrismaClient | Prisma.TransactionClient;

export type AuditParams = {
  userId: string | null;
  action: string;
  tableName: string;
  recordId: string;
  oldValue?: unknown;
  newValue?: unknown;
  ipAddress?: string | null;
};

/**
 * Escribe un registro en audit_logs.
 * Acepta `Prisma.TransactionClient` para garantizar atomicidad con la mutación.
 */
export async function recordAudit(tx: Tx, params: AuditParams): Promise<void> {
  await tx.auditLog.create({
    data: {
      userId: params.userId ?? null,
      action: params.action,
      tableName: params.tableName,
      recordId: params.recordId,
      oldValue: params.oldValue === undefined ? undefined : (params.oldValue as Prisma.InputJsonValue),
      newValue: params.newValue === undefined ? undefined : (params.newValue as Prisma.InputJsonValue),
      ipAddress: params.ipAddress ?? null,
    },
  });
}
