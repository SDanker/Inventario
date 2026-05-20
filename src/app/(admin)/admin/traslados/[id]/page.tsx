import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/auth";
import { prisma } from "@/lib/db";
import { approveTransfer, rejectTransfer, cancelTransfer, prepareTransfer, dispatchTransfer, receiveTransfer } from "@/lib/services/transfers.service";
import { TransferStatus } from "@prisma/client";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const statusConfig = {
  SOLICITADO: { tone: "warning", label: "Solicitado" },
  APROBADO: { tone: "info", label: "Aprobado" },
  PREPARADO: { tone: "info", label: "Preparado" },
  EN_TRANSITO: { tone: "warning", label: "En tránsito" },
  RECIBIDO: { tone: "success", label: "Recibido" },
  RECHAZADO: { tone: "danger", label: "Rechazado" },
  CANCELADO: { tone: "neutral", label: "Cancelado" },
};

export default async function TransferDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = (await getSessionUser())!;

  const transfer = await prisma.transfer.findUnique({
    where: { id },
    include: {
      originUnit: true,
      destinationUnit: true,
      requestedBy: true,
      approvedBy: true,
      receivedBy: true,
      items: {
        include: {
          asset: { include: { material: true } },
          material: true,
        },
      },
    },
  });

  if (!transfer) notFound();

  const canApprove = user.role === "COMANDANCIA_ADMIN" && transfer.status === TransferStatus.SOLICITADO;
  const canReject = user.role === "COMANDANCIA_ADMIN" && [TransferStatus.SOLICITADO, TransferStatus.APROBADO].includes(transfer.status);
  const canCancel = user.unitId === transfer.originUnitId && [TransferStatus.SOLICITADO, TransferStatus.APROBADO, TransferStatus.PREPARADO].includes(transfer.status);
  const canPrepare = user.unitId === transfer.originUnitId && transfer.status === TransferStatus.APROBADO;
  const canDispatch = user.unitId === transfer.originUnitId && transfer.status === TransferStatus.PREPARADO;
  const canReceive = user.unitId === transfer.destinationUnitId && [TransferStatus.APROBADO, TransferStatus.PREPARADO, TransferStatus.EN_TRANSITO].includes(transfer.status);

  async function handleApprove() {
    "use server";
    const u = (await getSessionUser())!;
    await approveTransfer(u, id);
    redirect(`/admin/traslados/${id}`);
  }

  async function handleReject() {
    "use server";
    const u = (await getSessionUser())!;
    await rejectTransfer(u, id, "Rechazado por Comandancia");
    redirect(`/admin/traslados/${id}`);
  }

  async function handleCancel() {
    "use server";
    const u = (await getSessionUser())!;
    await cancelTransfer(u, id);
    redirect(`/admin/traslados/${id}`);
  }

  async function handlePrepare() {
    "use server";
    const u = (await getSessionUser())!;
    await prepareTransfer(u, id);
    redirect(`/admin/traslados/${id}`);
  }

  async function handleDispatch() {
    "use server";
    const u = (await getSessionUser())!;
    await dispatchTransfer(u, id);
    redirect(`/admin/traslados/${id}`);
  }

  async function handleReceive() {
    "use server";
    const u = (await getSessionUser())!;
    await receiveTransfer(u, id);
    redirect(`/admin/traslados/${id}`);
  }

  const config = statusConfig[transfer.status as keyof typeof statusConfig];

  return (
    <div className="max-w-4xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Traslado {transfer.code}</h1>
        <Badge tone={config.tone as any}>{config.label}</Badge>
      </div>

      <Card>
        <CardHeader><CardTitle>Información del traslado</CardTitle></CardHeader>
        <CardBody>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-slate-600">Unidad origen</p>
              <p className="font-medium">{transfer.originUnit.code} - {transfer.originUnit.name}</p>
            </div>
            <div>
              <p className="text-sm text-slate-600">Unidad destino</p>
              <p className="font-medium">{transfer.destinationUnit.code} - {transfer.destinationUnit.name}</p>
            </div>
            <div>
              <p className="text-sm text-slate-600">Solicitado por</p>
              <p className="font-medium">{transfer.requestedBy.name}</p>
            </div>
            <div>
              <p className="text-sm text-slate-600">Fecha solicitud</p>
              <p className="font-medium">{new Date(transfer.createdAt).toLocaleDateString("es-CL", {
                year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit"
              })}</p>
            </div>
            {transfer.approvedBy && (
              <>
                <div>
                  <p className="text-sm text-slate-600">Aprobado por</p>
                  <p className="font-medium">{transfer.approvedBy.name}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-600">Fecha aprobación</p>
                  <p className="font-medium">{transfer.approvedAt ? new Date(transfer.approvedAt).toLocaleDateString("es-CL") : "—"}</p>
                </div>
              </>
            )}
            {transfer.receivedBy && (
              <>
                <div>
                  <p className="text-sm text-slate-600">Recibido por</p>
                  <p className="font-medium">{transfer.receivedBy.name}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-600">Fecha recepción</p>
                  <p className="font-medium">{transfer.receivedAt ? new Date(transfer.receivedAt).toLocaleDateString("es-CL") : "—"}</p>
                </div>
              </>
            )}
            {transfer.rejectionReason && (
              <div className="col-span-2">
                <p className="text-sm text-slate-600">Motivo del rechazo</p>
                <p className="font-medium text-red-600">{transfer.rejectionReason}</p>
              </div>
            )}
            {transfer.reason && (
              <div className="col-span-2">
                <p className="text-sm text-slate-600">Razón del traslado</p>
                <p className="font-medium">{transfer.reason}</p>
              </div>
            )}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader><CardTitle>Items a trasladar ({transfer.items.length})</CardTitle></CardHeader>
        <CardBody>
          <Table>
            <THead>
              <TR>
                <TH>Tipo</TH>
                <TH>Código/Material</TH>
                <TH>Cantidad</TH>
                <TH>Notas</TH>
              </TR>
            </THead>
            <TBody>
              {transfer.items.map((item) => (
                <TR key={item.id}>
                  <TD>{item.assetId ? "Activo" : "Material"}</TD>
                  <TD className="font-mono">
                    {item.asset ? `${item.asset.internalCode} - ${item.asset.material.name}` : item.material?.name}
                  </TD>
                  <TD>{Number(item.quantity)}</TD>
                  <TD>{item.notes || "—"}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </CardBody>
      </Card>

      {(canApprove || canReject || canCancel || canPrepare || canDispatch || canReceive) && (
        <Card>
          <CardHeader><CardTitle>Acciones</CardTitle></CardHeader>
          <CardBody>
            <div className="flex flex-wrap gap-2">
              {canApprove && (
                <form action={handleApprove} className="inline">
                  <Button type="submit" variant="success">Aprobar traslado</Button>
                </form>
              )}
              {canReject && (
                <form action={handleReject} className="inline">
                  <Button type="submit" variant="danger">Rechazar traslado</Button>
                </form>
              )}
              {canCancel && (
                <form action={handleCancel} className="inline">
                  <Button type="submit" variant="neutral">Cancelar traslado</Button>
                </form>
              )}
              {canPrepare && (
                <form action={handlePrepare} className="inline">
                  <Button type="submit" variant="info">Marcar como preparado</Button>
                </form>
              )}
              {canDispatch && (
                <form action={handleDispatch} className="inline">
                  <Button type="submit" variant="warning">Despachar</Button>
                </form>
              )}
              {canReceive && (
                <form action={handleReceive} className="inline">
                  <Button type="submit" variant="success">Marcar como recibido</Button>
                </form>
              )}
            </div>
          </CardBody>
        </Card>
      )}

      <a href="/admin/traslados" className="text-sm text-slate-600 hover:underline">← Volver al listado</a>
    </div>
  );
}
