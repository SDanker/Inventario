import Link from "next/link";
import { getSessionUser } from "@/auth";
import { listAssetsNeedingReview } from "@/lib/services/asset-reviews.service";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD, EmptyState } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default async function ReviewsPage() {
  const user = (await getSessionUser())!;
  const assets = await listAssetsNeedingReview(user);

  const getDaysOverdue = (nextReviewDate: Date) => {
    const now = new Date();
    const diff = now.getTime() - nextReviewDate.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    return days;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Revisiones Pendientes</h1>
        <span className="text-sm text-slate-600">{assets.length} activos pendientes</span>
      </div>

      <Card>
        <CardHeader><CardTitle>Activos que requieren revisión</CardTitle></CardHeader>
        <CardBody>
          {assets.length === 0 ? (
            <EmptyState>No hay activos pendientes de revisión. ¡Todo al día!</EmptyState>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Código</TH>
                  <TH>Material</TH>
                  <TH>Unidad</TH>
                  <TH>Última revisión</TH>
                  <TH>Vencimiento</TH>
                  <TH>Días vencido</TH>
                  <TH></TH>
                </TR>
              </THead>
              <TBody>
                {assets.map((asset) => {
                  const daysOverdue = getDaysOverdue(asset.nextReviewDate!);
                  const lastReview = asset.reviews[0];

                  return (
                    <TR key={asset.id}>
                      <TD className="font-mono font-medium">{asset.internalCode}</TD>
                      <TD>{asset.material.name}</TD>
                      <TD>{asset.unit.code}</TD>
                      <TD className="text-sm">
                        {lastReview
                          ? new Date(lastReview.reviewDate).toLocaleDateString("es-CL")
                          : "Nunca revisado"}
                      </TD>
                      <TD className="text-sm">
                        {asset.nextReviewDate?.toLocaleDateString("es-CL")}
                      </TD>
                      <TD>
                        <Badge tone={daysOverdue > 7 ? "danger" : daysOverdue > 0 ? "warning" : "info"}>
                          {daysOverdue > 0 ? `+${daysOverdue}d` : "Hoy"}
                        </Badge>
                      </TD>
                      <TD className="text-right">
                        <Link href={`/admin/activos/${asset.id}/revisar`} className="text-sm text-brand-600 hover:underline">
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
