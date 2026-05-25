import Link from "next/link";
import { getSessionUser } from "@/auth";
import { listAssetsNeedingReview } from "@/lib/services/asset-reviews.service";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD, EmptyState } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default async function UnitReviewsPage() {
  const user = (await getSessionUser())!;
  const assets = await listAssetsNeedingReview(user);

  const getDaysOverdue = (nextReviewDate: Date) => {
    const now = new Date();
    const diff = now.getTime() - nextReviewDate.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Revisiones Pendientes</h1>
        <span className="text-sm text-slate-600">
          {assets.length} activos pendientes
        </span>
      </div>

      <Card>
        <CardHeader><CardTitle>Activos que requieren revisión</CardTitle></CardHeader>
        <CardBody>
          {assets.length === 0 ? (
            <EmptyState>No hay activos pendientes de revisión.</EmptyState>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Código</TH>
                  <TH>Material</TH>
                  <TH>Última revisión</TH>
                  <TH>Vencimiento</TH>
                  <TH>Estado</TH>
                  <TH></TH>
                </TR>
              </THead>
              <TBody>
                {assets.map((asset) => {
                  const daysOverdue = getDaysOverdue(asset.nextReviewDate!);
                  const lastReview = asset.reviews[0];
                  let tone: "success" | "warning" | "danger" | "info" = "info";
                  if (daysOverdue > 7) tone = "danger";
                  else if (daysOverdue > 0) tone = "warning";

                  return (
                    <TR key={asset.id}>
                      <TD className="font-mono font-medium">{asset.internalCode}</TD>
                      <TD>{asset.material.name}</TD>
                      <TD className="text-sm">
                        {lastReview
                          ? new Date(lastReview.reviewDate).toLocaleDateString("es-CL")
                          : "Nunca"}
                      </TD>
                      <TD className="text-sm">
                        {asset.nextReviewDate?.toLocaleDateString("es-CL")}
                      </TD>
                      <TD>
                        <Badge tone={tone}>
                          {daysOverdue > 0 ? `${daysOverdue}d vencido` : "Próximo"}
                        </Badge>
                      </TD>
                      <TD className="text-right">
                        <Link
                          href={`/unidad/activos/${asset.id}/revisar`}
                          className="text-sm text-brand-600 hover:underline"
                        >
                          Revisar
                        </Link>
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
