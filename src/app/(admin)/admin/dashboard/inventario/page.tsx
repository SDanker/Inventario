"use server";

import Link from "next/link";
import { getSessionUser } from "@/auth";
import { getInventorySummary, listCategories } from "@/lib/services/catalog.service";
import { prisma } from "@/lib/db";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD, EmptyState } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default async function InventoryDashboardPage() {
  const user = (await getSessionUser())!;
  const isAdmin = user.role === "COMANDANCIA_ADMIN";

  const inventory = await getInventorySummary(user);
  const categories = await listCategories(user);
  const units = await prisma.unit.findMany({
    where: { active: true },
    select: { id: true, name: true, code: true },
    orderBy: { name: "asc" },
  });

  // Calcular estadísticas
  const totalMaterials = new Set(inventory.map(item => item.materialId)).size;
  const activeMaterials = new Set(
    inventory.filter(item => item.quantity > 0).map(item => item.materialId)
  ).size;
  const inactiveMaterials = totalMaterials - activeMaterials;

  const unitSummary = Array.from(
    new Map(
      inventory.map(item => [
        item.unitId,
        {
          id: item.unitId,
          name: item.unit.name,
          code: item.unit.code,
          count: (new Map().get(item.unitId) || 0) + 1,
        },
      ])
    ).values()
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Dashboard de Inventario</h1>
        <p className="text-sm text-slate-500">
          Vista consolidada de stock de materiales {!isAdmin && `de tu unidad`}
        </p>
      </div>

      {/* Tarjetas de estadísticas */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardBody>
            <div className="text-3xl font-bold text-blue-600">{totalMaterials}</div>
            <p className="text-sm text-slate-600">Materiales Totales</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <div className="text-3xl font-bold text-green-600">{activeMaterials}</div>
            <p className="text-sm text-slate-600">Materiales Activos</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <div className="text-3xl font-bold text-red-600">{inactiveMaterials}</div>
            <p className="text-sm text-slate-600">Materiales Inactivos</p>
          </CardBody>
        </Card>
      </div>

      {/* Tabla de inventario */}
      <Card>
        <CardHeader>
          <CardTitle>Stock Consolidado</CardTitle>
        </CardHeader>
        <CardBody>
          {inventory.length === 0 ? (
            <EmptyState>Sin materiales asignados a unidades.</EmptyState>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Material</TH>
                  <TH>Categoría</TH>
                  <TH>Unidad</TH>
                  <TH className="text-center">Cantidad</TH>
                  <TH className="text-center">Estado</TH>
                  <TH>Acciones</TH>
                </TR>
              </THead>
              <TBody>
                {inventory.map((item) => (
                  <TR key={item.id}>
                    <TD className="font-medium">{item.material.name}</TD>
                    <TD>{item.material.category.name}</TD>
                    <TD>{item.unit.name} ({item.unit.code})</TD>
                    <TD className="text-center font-semibold">{item.quantity}</TD>
                    <TD className="text-center">
                      <Badge tone={item.quantity > 0 ? "success" : "neutral"}>
                        {item.quantity > 0 ? "Activo" : "Inactivo"}
                      </Badge>
                    </TD>
                    <TD>
                      <Link
                        href={`/admin/materiales/${item.materialId}`}
                        className="text-blue-600 hover:underline text-sm"
                      >
                        Ver
                      </Link>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardBody>
      </Card>

      {/* Resumen por unidad */}
      {isAdmin && unitSummary.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Resumen por Unidad</CardTitle>
          </CardHeader>
          <CardBody>
            <div className="grid grid-cols-2 gap-3">
              {unitSummary.map((unitSum) => (
                <div
                  key={unitSum.id}
                  className="border rounded p-3 flex justify-between items-center hover:bg-slate-50"
                >
                  <div>
                    <p className="font-semibold">{unitSum.name}</p>
                    <p className="text-xs text-slate-500">({unitSum.code})</p>
                  </div>
                  <Badge>{unitSum.count} materiales</Badge>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
