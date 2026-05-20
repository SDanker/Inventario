import Link from "next/link";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const reports = [
  { href: "/api/reports/inventory.xlsx?scope=global", title: "Inventario consolidado", desc: "Todos los activos del Departamento." },
  { href: "/api/reports/low-stock.xlsx", title: "Stock bajo", desc: "Insumos con stock bajo o agotado." },
  { href: "/api/reports/expired.xlsx", title: "Material vencido", desc: "Insumos con fecha de vencimiento expirada." },
  { href: "/api/reports/maintenance.xlsx", title: "Mantenciones", desc: "Historial completo de mantenciones registradas." },
  { href: "/api/reports/transfers.xlsx", title: "Traslados", desc: "Todos los traslados entre unidades." },
  { href: "/api/reports/audit.xlsx", title: "Auditoría", desc: "Registro de auditoría (últimos 10,000 eventos)." },
];

export default function ReportsHubPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Reportes Excel</h1>
      <div className="grid md:grid-cols-2 gap-3">
        {reports.map((r) => (
          <Card key={r.title}>
            <CardBody>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold text-slate-900">{r.title}</div>
                  <div className="text-xs text-slate-500 mt-1">{r.desc}</div>
                </div>
                {r.href === "#" ? (
                  <Button variant="secondary" disabled>Pendiente</Button>
                ) : (
                  <Link href={r.href}><Button>Descargar</Button></Link>
                )}
              </div>
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
}
