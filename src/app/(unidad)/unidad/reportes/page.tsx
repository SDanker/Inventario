import Link from "next/link";
import { getSessionUser } from "@/auth";
import { redirect } from "next/navigation";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function UnitReportsPage() {
  const user = (await getSessionUser())!;
  if (!user.unitId) redirect("/forbidden");
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Reportes de la unidad</h1>
      <Card>
        <CardBody className="flex items-center justify-between">
          <div>
            <div className="font-semibold">Inventario de la unidad</div>
            <div className="text-xs text-slate-500">Activos asociados a tu unidad.</div>
          </div>
          <Link href={`/api/reports/inventory.xlsx?scope=unit&unitId=${user.unitId}`}>
            <Button>Descargar Excel</Button>
          </Link>
        </CardBody>
      </Card>
      <p className="text-sm text-slate-500">
        {/* TODO: replicar para mantenciones, insumos, movimientos, stock bajo, vencidos */}
        Más reportes pendientes (insumos, mantenciones, movimientos, stock bajo).
      </p>
    </div>
  );
}
