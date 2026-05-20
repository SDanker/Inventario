import { prisma } from "@/lib/db";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";

interface AssetReviewStatusProps {
  assetId: string;
}

export async function AssetReviewStatus({ assetId }: AssetReviewStatusProps) {
  const asset = await prisma.asset.findUnique({
    where: { id: assetId },
    select: {
      nextReviewDate: true,
      reviewIntervalValue: true,
      reviewIntervalUnit: true,
      reviews: {
        take: 1,
        orderBy: { reviewDate: "desc" },
        select: {
          reviewDate: true,
          status: true,
        },
      },
    },
  });

  if (!asset || !asset.nextReviewDate) {
    return null;
  }

  const now = new Date();
  const daysUntilReview = Math.ceil((asset.nextReviewDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const isOverdue = daysUntilReview < 0;
  const isUrgent = daysUntilReview <= 7 && daysUntilReview >= 0;

  let tone: "success" | "warning" | "danger" | "info" = "info";
  let label = "";

  if (isOverdue) {
    tone = "danger";
    label = `Vencida hace ${Math.abs(daysUntilReview)} días`;
  } else if (isUrgent) {
    tone = "warning";
    label = `Vence en ${daysUntilReview} días`;
  } else {
    tone = "success";
    label = `Vence en ${daysUntilReview} días`;
  }

  const lastReview = asset.reviews[0];

  return (
    <div className="space-y-2">
      <div>
        <p className="text-sm text-slate-600 mb-1">Estado de revisión</p>
        <div className="flex items-center gap-2">
          <Badge tone={tone}>{label}</Badge>
          <Link href={`/admin/activos/${assetId}/revisar`} className="text-sm text-brand-600 hover:underline">
            Revisar ahora →
          </Link>
        </div>
      </div>

      {asset.reviewIntervalValue && (
        <div className="text-sm text-slate-600">
          <p>Intervalo: Cada {asset.reviewIntervalValue} {
            asset.reviewIntervalUnit === "days" ? "días" :
            asset.reviewIntervalUnit === "weeks" ? "semanas" :
            asset.reviewIntervalUnit === "months" ? "meses" :
            "años"
          }</p>
        </div>
      )}

      {lastReview && (
        <div className="text-sm text-slate-600">
          <p>Última revisión: {new Date(lastReview.reviewDate).toLocaleDateString("es-CL")} - {
            lastReview.status === "OK" ? "✓ OK" :
            lastReview.status === "CON_OBSERVACIONES" ? "⚠ Con observaciones" :
            "✗ Inoperativa"
          }</p>
        </div>
      )}
    </div>
  );
}
