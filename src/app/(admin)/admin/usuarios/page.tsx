import Link from "next/link";
import { getSessionUser } from "@/auth";
import { listUsers } from "@/lib/services/users.service";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD, EmptyState } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default async function UsersListPage() {
  const user = (await getSessionUser())!;
  const users = await listUsers(user);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Usuarios</h1>
          <p className="text-sm text-slate-500">Gestión de usuarios del sistema ({users.length} total)</p>
        </div>
        <Link href="/admin/usuarios/nuevo">
          <Button>Nuevo usuario</Button>
        </Link>
      </div>

      <Card>
        <CardBody>
          {users.length === 0 ? (
            <EmptyState>No hay usuarios.</EmptyState>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Nombre</TH><TH>Correo</TH><TH>Rol</TH><TH>Unidad</TH><TH>Estado</TH><TH>Acciones</TH>
                </TR>
              </THead>
              <TBody>
                {users.map((u) => (
                  <TR key={u.id}>
                    <TD className="font-medium">{u.name}</TD>
                    <TD>{u.email}</TD>
                    <TD><Badge>{u.role}</Badge></TD>
                    <TD>{u.unit?.code ?? "—"}</TD>
                    <TD>{u.active ? <Badge tone="success">Activo</Badge> : <Badge>Inactivo</Badge>}</TD>
                    <TD>
                      <Link href={`/admin/usuarios/${u.id}`} className="text-blue-600 hover:underline text-sm">
                        Editar
                      </Link>
                    </TD>
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
