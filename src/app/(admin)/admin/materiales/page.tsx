import Link from "next/link";
import { getSessionUser } from "@/auth";
import { prisma } from "@/lib/db";
import { Card, CardBody } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD, EmptyState } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default async function MaterialsPage({
  searchParams,
}: {
  searchParams?: Promise<{ imported?: string }>;
}) {
  const user = (await getSessionUser())!;
  const params = await searchParams;
  const imported = params?.imported ? Number.parseInt(params.imported, 10) : 0;

  // Get all materials (active and inactive) with serial number count
  const materials = await prisma.material.findMany({
    include: {
      category: { select: { id: true, name: true } },
      _count: { select: { serialNumbers: true } },
    },
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Materiales</h1>
          <p className="text-sm text-slate-500">Catálogo maestro de materiales ({materials.length} total)</p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/materiales/importar">
            <Button variant="secondary">Importar masivo</Button>
          </Link>
          <Link href="/admin/materiales/nuevo">
            <Button>Nuevo material</Button>
          </Link>
        </div>
      </div>
      {imported > 0 ? (
        <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          Se importaron {imported} materiales correctamente.
        </div>
      ) : null}
      <Card>
        <CardBody>
          {materials.length === 0 ? (
            <EmptyState>Sin materiales aún.</EmptyState>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Código</TH>
                  <TH>Nombre</TH>
                  <TH>Marca</TH>
                  <TH>Modelo</TH>
                  <TH>Parte</TH>
                  <TH>Categoría</TH>
                  <TH>Tipo</TH>
                  <TH>NS</TH>
                  <TH>Estado</TH>
                  <TH>Acciones</TH>
                </TR>
              </THead>
              <TBody>
                {materials.map((m) => (
                  <TR key={m.id}>
                    <TD className="font-mono text-sm">{m.code}</TD>
                    <TD className="font-medium">{m.name}</TD>
                    <TD className="text-sm">{m.brand}</TD>
                    <TD className="text-sm text-slate-600">{m.model || "—"}</TD>
                    <TD className="text-sm text-slate-600 font-mono">{m.partNumber || "—"}</TD>
                    <TD>{m.category.name}</TD>
                    <TD><Badge tone="info">{m.materialType.replace(/_/g, " ")}</Badge></TD>
                    <TD className="text-sm text-center">{m._count.serialNumbers}</TD>
                    <TD>
                      <Badge tone={m.active ? "success" : "neutral"}>
                        {m.active ? "Activo" : "Inactivo"}
                      </Badge>
                    </TD>
                    <TD>
                      <Link href={`/admin/materiales/${m.id}`} className="text-blue-600 hover:underline text-sm">
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
