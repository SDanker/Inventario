import Link from "next/link";
import { getSessionUser } from "@/auth";
import { listCategories } from "@/lib/services/catalog.service";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD, EmptyState } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default async function CategoriesPage() {
  const user = (await getSessionUser())!;
  const cats = await listCategories(user);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Categorías</h1>
        <Link href="/admin/categorias/nuevo">
          <Button>Nueva categoría</Button>
        </Link>
      </div>

      <Card>
        <CardHeader><CardTitle>{cats.length} categorías registradas</CardTitle></CardHeader>
        <CardBody>
          {cats.length === 0 ? (
            <EmptyState>No hay categorías. Crea la primera.</EmptyState>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Nombre</TH>
                  <TH>Descripción</TH>
                  <TH>Estado</TH>
                  <TH></TH>
                </TR>
              </THead>
              <TBody>
                {cats.map((c) => (
                  <TR key={c.id}>
                    <TD className="font-medium">{c.name}</TD>
                    <TD className="text-sm text-slate-600">{c.description ?? "—"}</TD>
                    <TD>
                      {c.active ? <Badge tone="success">Activa</Badge> : <Badge tone="neutral">Inactiva</Badge>}
                    </TD>
                    <TD className="text-right">
                      <Link href={`/admin/categorias/${c.id}`} className="text-sm text-brand-600 hover:underline">
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
