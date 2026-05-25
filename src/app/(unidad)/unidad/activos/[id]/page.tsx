import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getSessionUser } from "@/auth";
import { getAssetWithHistory, decommissionAsset } from "@/lib/services/assets.service";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/input";
import { formatDate } from "@/lib/utils";

export default async function UnitAssetDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = (await getSessionUser())!;
  const asset = await getAssetWithHistory(user, id);
  if (!asset) notFound();

  async function decommissionAction(formData: FormData) {
    "use server";
    const u = (await getSessionUser())!;
    const reason = (formData.get("reason") as string) || "Dado de baja";
    await decommissionAsset(u, id, reason);
    redirect("/unidad/activos");
  }

  const tone =
    asset.status === "OPERATIVO"
      ? "success"
      : asset.status === "DADO_DE_BAJA" || asset.status === "FUERA_DE_SERVICIO"
        ? "danger"
        : "warning";

  return (
    <div className="max-w-4xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Activo {asset.internalCode}</h1>
        <div className="flex items-center gap-2">
          <Badge tone={tone}>{asset.status}</Badge>
          <Link href="/unidad/activos" className="text-sm text-slate-600 hover:underline">
            Volver
          </Link>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>Información del activo</CardTitle></CardHeader>
        <CardBody>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-slate-600">Material</p>
              <p className="font-medium">{asset.material.name}</p>
            </div>
            <div>
              <p className="text-sm text-slate-600">Categoría</p>
              <p className="font-medium">{asset.material.category?.name ?? "—"}</p>
            </div>
            <div>
              <p className="text-sm text-slate-600">Número de serie</p>
              <p className="font-mono">{asset.serialNumber || "—"}</p>
            </div>
            <div>
              <p className="text-sm text-slate-600">Marca / Modelo</p>
              <p className="font-medium">
                {[asset.brand, asset.model].filter(Boolean).join(" / ") || "—"}
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-600">Patente</p>
              <p className="font-medium">{asset.licensePlate || "—"}</p>
            </div>
            <div>
              <p className="text-sm text-slate-600">Año</p>
              <p className="font-medium">{asset.year ?? "—"}</p>
            </div>
            <div>
              <p className="text-sm text-slate-600">Ubicación específica</p>
              <p className="font-medium">{asset.specificLocation || "—"}</p>
            </div>
            <div>
              <p className="text-sm text-slate-600">Responsable</p>
              <p className="font-medium">{asset.responsibleName || "—"}</p>
            </div>
            <div>
              <p className="text-sm text-slate-600">Fecha de ingreso</p>
              <p className="font-medium">{formatDate(asset.entryDate)}</p>
            </div>
            <div>
              <p className="text-sm text-slate-600">Fecha de vencimiento</p>
              <p className="font-medium">{formatDate(asset.expirationDate)}</p>
            </div>
            {asset.observations && (
              <div className="col-span-2">
                <p className="text-sm text-slate-600">Observaciones</p>
                <p className="font-medium">{asset.observations}</p>
              </div>
            )}
          </div>
        </CardBody>
      </Card>

      {asset.status !== "DADO_DE_BAJA" && (
        <Card>
          <CardHeader><CardTitle>Dar de baja</CardTitle></CardHeader>
          <CardBody>
            <form action={decommissionAction} className="space-y-4">
              <p className="text-sm text-slate-600">
                Al dar de baja el activo, su estado pasa a "DADO_DE_BAJA" y se
                registra un movimiento de baja en el inventario.
              </p>
              <Field>
                <Label htmlFor="reason">Motivo *</Label>
                <Textarea
                  id="reason"
                  name="reason"
                  required
                  maxLength={500}
                  rows={3}
                  placeholder="Ej: Equipo dañado irreparable, fin de vida útil, etc."
                />
              </Field>
              <div className="flex justify-end">
                <Button type="submit" variant="danger">
                  Confirmar baja
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
