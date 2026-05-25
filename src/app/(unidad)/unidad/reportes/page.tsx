import Link from "next/link";
import { getSessionUser } from "@/auth";
import { redirect } from "next/navigation";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function UnitReportsPage() {
  const user = (await getSessionUser())!;
  if (!user.unitId) redirect("/forbidden");

  const reports = [
    {
      href: `/api/reports/inventory.xlsx?scope=unit&unitId=${user.unitId}`,
      title: "Inventario de la unidad",
      desc: "Activos asociados a tu unidad.",
    },
    {
      href: `/api/reports/low-stock.xlsx?unitId=${user.unitId}`,
      title: "Stock bajo",
      desc: "Insumos con stock bajo o agotado.",
    },
    {
      href: `/api/reports/expired.xlsx?unitId=${user.unitId}`,
      title: "Material vencido",
      desc: "Insumos con fecha de vencimiento expirada.",
    },
    {
      href: `/api/reports/maintenance.xlsx?unitId=${user.unitId}`,
      title: "Mantenciones",
      desc: "Historial de mantenciones de tus activos.",
    },
    {
      href: `/api/reports/transfers.xlsx?unitId=${user.unitId}`,
      title: "Traslados",
      desc: "Traslados que involucran tu unidad.",
    },
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Reportes de la unidad</h1>
      <div className="grid md:grid-cols-2 gap-3">
        {reports.map((r) => (
          <Card key={r.title}>
            <CardBody>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold text-slate-900">{r.title}</div>
                  <div className="text-xs text-slate-500 mt-1">{r.desc}</div>
                </div>
                <Link href={r.href}>
                  <Button>Descargar Excel</Button>
                </Link>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
}
