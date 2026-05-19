import { getSessionUser } from "@/auth";
import { listCategories } from "@/lib/services/catalog.service";
import { Card, CardBody } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD, EmptyState } from "@/components/ui/table";

export default async function CategoriesPage() {
  const user = (await getSessionUser())!;
  const cats = await listCategories(user);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Categorías</h1>
      <p className="text-sm text-slate-500">
        {/* TODO: form de crear siguiendo patrón de Unidades */}
        Crear/editar pendiente.
      </p>
      <Card>
        <CardBody>
          {cats.length === 0 ? (
            <EmptyState>Sin categorías.</EmptyState>
          ) : (
            <Table>
              <THead><TR><TH>Nombre</TH><TH>Descripción</TH><TH>Activa</TH></TR></THead>
              <TBody>
                {cats.map((c) => (
                  <TR key={c.id}>
                    <TD className="font-medium">{c.name}</TD>
                    <TD>{c.description ?? "—"}</TD>
                    <TD>{c.active ? "Sí" : "No"}</TD>
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
