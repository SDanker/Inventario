import Link from "next/link";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const reports = [
  { href: "/api/reports/inventory.xlsx?scope=global", title: "Inventario consolidado", desc: "Todos los activos del Departamento." },
  // TODO: implementar los siguientes endpoints siguiendo el patrón de inventory.xlsx:
  { href: "#", title: "Inventario por unidad (TODO)", desc: "/api/reports/inventory.xlsx?scope=unit&unitId=…" },
  { href: "#", title: "Stock bajo (TODO)", desc: "/api/reports/low-stock.xlsx" },
  { href: "#", title: "Material vencido (TODO)", desc: "/api/reports/expired.xlsx" },
  { href: "#", title: "Mantenciones (TODO)", desc: "/api/reports/maintenance.xlsx" },
  { href: "#", title: "Traslados (TODO)", desc: "/api/reports/transfers.xlsx" },
  { href: "#", title: "Auditoría (TODO)", desc: "/api/reports/audit.xlsx" },
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
