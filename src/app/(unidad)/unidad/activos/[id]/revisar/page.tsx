import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/auth";
import {
  getAssetWithReviews,
  submitAssetReview,
  setAssetReviewSchedule,
} from "@/lib/services/asset-reviews.service";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Label, Field } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

const statusConfig = {
  OK: { tone: "success", label: "OK" },
  CON_OBSERVACIONES: { tone: "warning", label: "Con observaciones" },
  INOPERATIVA: { tone: "danger", label: "Inoperativa" },
};

export default async function UnitAssetReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = (await getSessionUser())!;

  const asset = await getAssetWithReviews(user, id);
  if (!asset) notFound();

  async function submitReviewAction(formData: FormData) {
    "use server";
    const u = (await getSessionUser())!;
    await submitAssetReview(u, {
      assetId: id,
      status: formData.get("status") as "OK" | "CON_OBSERVACIONES" | "INOPERATIVA",
      comments: (formData.get("comments") as string) || null,
    });
    redirect(`/unidad/activos/${id}/revisar`);
  }

  async function setScheduleAction(formData: FormData) {
    "use server";
    const u = (await getSessionUser())!;
    const intervalValue = parseInt(formData.get("intervalValue") as string);
    const intervalUnit = formData.get("intervalUnit") as
      | "days"
      | "weeks"
      | "months"
      | "years";
    const nextDateRaw = (formData.get("nextReviewDate") as string | null)?.trim() || null;
    const nextDate = nextDateRaw ? new Date(nextDateRaw) : null;
    await setAssetReviewSchedule(
      u,
      id,
      intervalValue,
      intervalUnit,
      nextDate && !Number.isNaN(nextDate.getTime()) ? nextDate : null,
    );
    redirect(`/unidad/activos/${id}/revisar`);
  }

  return (
    <div className="max-w-4xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Revisar Activo</h1>
        <a href="/unidad/revisiones" className="text-sm text-slate-600 hover:underline">
          Volver
        </a>
      </div>

      <Card>
        <CardHeader><CardTitle>Información del activo</CardTitle></CardHeader>
        <CardBody>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-slate-600">Código interno</p>
              <p className="font-mono font-medium">{asset.internalCode}</p>
            </div>
            <div>
              <p className="text-sm text-slate-600">Material</p>
              <p className="font-medium">{asset.material.name}</p>
            </div>
            <div>
              <p className="text-sm text-slate-600">Unidad</p>
              <p className="font-medium">{asset.unit.code} - {asset.unit.name}</p>
            </div>
            <div>
              <p className="text-sm text-slate-600">Número de serie</p>
              <p className="font-mono">{asset.serialNumber || "—"}</p>
            </div>
            {asset.reviewIntervalValue && (
              <div>
                <p className="text-sm text-slate-600">Intervalo de revisión</p>
                <p className="font-medium">
                  Cada {asset.reviewIntervalValue}{" "}
                  {asset.reviewIntervalUnit === "days"
                    ? "días"
                    : asset.reviewIntervalUnit === "weeks"
                      ? "semanas"
                      : asset.reviewIntervalUnit === "months"
                        ? "meses"
                        : "años"}
                </p>
              </div>
            )}
            {asset.nextReviewDate && (
              <div>
                <p className="text-sm text-slate-600">Próxima revisión</p>
                <p className="font-medium">
                  {new Date(asset.nextReviewDate).toLocaleDateString("es-CL")}
                </p>
              </div>
            )}
          </div>
        </CardBody>
      </Card>

      {asset.reviews.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Bitácora de revisiones</CardTitle></CardHeader>
          <CardBody>
            <Table>
              <THead>
                <TR>
                  <TH>Fecha</TH>
                  <TH>Estado</TH>
                  <TH>Revisado por</TH>
                  <TH>Comentarios</TH>
                </TR>
              </THead>
              <TBody>
                {asset.reviews.map((review) => {
                  const config = statusConfig[review.status as keyof typeof statusConfig];
                  return (
                    <TR key={review.id}>
                      <TD>
                        {new Date(review.reviewDate).toLocaleDateString("es-CL", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </TD>
                      <TD>
                        <Badge tone={config.tone as any}>{config.label}</Badge>
                      </TD>
                      <TD>{review.reviewedByUser.name}</TD>
                      <TD className="text-sm">{review.comments || "—"}</TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Nueva revisión</CardTitle></CardHeader>
        <CardBody>
          <form action={submitReviewAction} className="space-y-4">
            <Field>
              <Label htmlFor="status">Estado del activo *</Label>
              <Select id="status" name="status" required>
                <option value="">Selecciona un estado</option>
                <option value="OK">OK - Funcional</option>
                <option value="CON_OBSERVACIONES">Con observaciones</option>
                <option value="INOPERATIVA">Inoperativa</option>
              </Select>
            </Field>

            <Field>
              <Label htmlFor="comments">Comentarios (requerido si no está OK)</Label>
              <Textarea
                id="comments"
                name="comments"
                placeholder="Describe el estado del activo..."
                maxLength={1000}
              />
            </Field>

            <div className="flex gap-2 justify-end">
              <a
                href="/unidad/revisiones"
                className="text-sm self-center text-slate-600 hover:underline"
              >
                Cancelar
              </a>
              <Button type="submit">Registrar revisión</Button>
            </div>
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            {asset.reviewIntervalValue ? "Editar programación de revisión" : "Configurar intervalo de revisión"}
          </CardTitle>
        </CardHeader>
        <CardBody>
          <form action={setScheduleAction} className="space-y-4">
            <p className="text-sm text-slate-600">
              {asset.reviewIntervalValue
                ? "Modifica el intervalo o establece manualmente la próxima fecha de revisión."
                : "Define cada cuánto tiempo se debe revisar este activo. Si lo dejas sin fecha manual, se calculará desde hoy."}
            </p>

            <div className="grid grid-cols-2 gap-4">
              <Field>
                <Label htmlFor="intervalValue">Cantidad *</Label>
                <Input
                  id="intervalValue"
                  name="intervalValue"
                  type="number"
                  min="1"
                  defaultValue={asset.reviewIntervalValue ?? 1}
                  required
                />
              </Field>

              <Field>
                <Label htmlFor="intervalUnit">Unidad de tiempo *</Label>
                <Select
                  id="intervalUnit"
                  name="intervalUnit"
                  defaultValue={asset.reviewIntervalUnit ?? "months"}
                  required
                >
                  <option value="days">Días</option>
                  <option value="weeks">Semanas</option>
                  <option value="months">Meses</option>
                  <option value="years">Años</option>
                </Select>
              </Field>
            </div>

            <Field>
              <Label htmlFor="nextReviewDate">Próxima fecha de revisión (opcional)</Label>
              <Input
                id="nextReviewDate"
                name="nextReviewDate"
                type="date"
                defaultValue={
                  asset.nextReviewDate
                    ? new Date(asset.nextReviewDate).toISOString().slice(0, 10)
                    : ""
                }
              />
              <p className="text-xs text-slate-500">
                Si la dejas vacía, se calcula como hoy + intervalo. Si la indicas, se usa esa fecha exacta.
              </p>
            </Field>

            <div className="flex gap-2 justify-end">
              <Button type="submit" variant="secondary">
                {asset.reviewIntervalValue ? "Actualizar programación" : "Configurar intervalo"}
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
