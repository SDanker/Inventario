import { prisma } from "@/lib/db";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD, EmptyState } from "@/components/ui/table";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AuditPage() {
  const logs = await prisma.auditLog.findMany({
    take: 200,
    orderBy: { createdAt: "desc" },
    include: { user: { select: { name: true, email: true } } },
  });
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Auditoría</h1>
      <Card>
        <CardHeader><CardTitle>Últimas {logs.length} acciones</CardTitle></CardHeader>
        <CardBody>
          {logs.length === 0 ? (
            <EmptyState>Sin registros aún.</EmptyState>
          ) : (
            <Table>
              <THead><TR><TH>Fecha</TH><TH>Usuario</TH><TH>Acción</TH><TH>Tabla</TH><TH>Registro</TH></TR></THead>
              <TBody>
                {logs.map((l) => (
                  <TR key={l.id}>
                    <TD>{formatDateTime(l.createdAt)}</TD>
                    <TD>{l.user?.name ?? "—"}</TD>
                    <TD className="font-mono text-xs">{l.action}</TD>
                    <TD>{l.tableName}</TD>
                    <TD className="font-mono text-xs">{l.recordId.slice(0, 8)}…</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
