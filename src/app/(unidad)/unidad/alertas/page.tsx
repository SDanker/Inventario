import { getSessionUser } from "@/auth";
import { prisma } from "@/lib/db";
import { acknowledgeAlert } from "@/lib/services/alerts.service";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD, EmptyState } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/input";
import { Label, Field } from "@/components/ui/label";
import { SubmitButton } from "@/components/forms/submit-button";
import { formatDateTime } from "@/lib/utils";
import { redirect } from "next/navigation";

async function acknowledgeAlertAction(formData: FormData) {
  "use server";
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const alertId = formData.get("alertId") as string;
  const description = (formData.get("description") as string) || "";
  await acknowledgeAlert(user, alertId, description);
  redirect("/unidad/alertas");
}

export default async function UnitAlertsPage() {
  const user = (await getSessionUser())!;
  if (!user.unitId) redirect("/forbidden");
  const alerts = await prisma.alert.findMany({
    where: { unitId: user.unitId, status: "ABIERTA" },
    include: {
      asset: true,
      consumable: { include: { material: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Alertas abiertas</h1>
      <Card>
        <CardHeader><CardTitle>{alerts.length} alertas</CardTitle></CardHeader>
        <CardBody>
          {alerts.length === 0 ? (
            <EmptyState>Sin alertas.</EmptyState>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Tipo</TH>
                  <TH>Detalle</TH>
                  <TH>Referencia</TH>
                  <TH>Creada</TH>
                  <TH>Acción</TH>
                </TR>
              </THead>
              <TBody>
                {alerts.map((a) => (
                  <TR key={a.id}>
                    <TD><Badge tone="warning">{a.alertType}</Badge></TD>
                    <TD>{a.title}</TD>
                    <TD className="text-sm">
                      {a.asset
                        ? `Activo ${a.asset.internalCode}`
                        : a.consumable
                          ? `Insumo ${a.consumable.material.name}`
                          : "—"}
                    </TD>
                    <TD>{formatDateTime(a.createdAt)}</TD>
                    <TD>
                      <details>
                        <summary className="cursor-pointer text-sm text-brand-600 hover:underline">
                          Marcar como revisada
                        </summary>
                        <form action={acknowledgeAlertAction} className="mt-2 space-y-2 w-72">
                          <input type="hidden" name="alertId" value={a.id} />
                          <Field>
                            <Label htmlFor={`desc-${a.id}`}>Descripción *</Label>
                            <Textarea
                              id={`desc-${a.id}`}
                              name="description"
                              rows={3}
                              required
                              maxLength={1000}
                              placeholder="¿Qué se hizo o constató al revisar?"
                            />
                          </Field>
                          <div className="flex justify-end">
                            <SubmitButton pendingLabel="Guardando...">Confirmar</SubmitButton>
                          </div>
                        </form>
                      </details>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
