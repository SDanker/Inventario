"use server";

import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { getSessionUser } from "@/auth";
import { getMaterial, updateMaterial, deactivateMaterial, addMaterialSerialNumber, updateMaterialSerialNumber, removeMaterialSerialNumber, listCategories, assignMaterialToUnit, updateMaterialQuantityInUnit, getMaterialStocks } from "@/lib/services/catalog.service";
import { MaterialType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Label } from "@/components/ui/label";
import { Input, Textarea, Select } from "@/components/ui/input";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { clientIp } from "@/lib/http";

async function updateMaterialAction(formData: FormData) {
  "use server";
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const materialId = formData.get("materialId") as string;
  const name = formData.get("name") as string;
  const brand = formData.get("brand") as string;
  const model = formData.get("model") as string;
  const partNumber = formData.get("partNumber") as string;
  const categoryId = formData.get("categoryId") as string;
  const materialType = formData.get("materialType") as MaterialType;
  const description = formData.get("description") as string;

  await updateMaterial(user, materialId, {
    name: name || undefined,
    brand: brand || undefined,
    model: model || null,
    partNumber: partNumber || null,
    categoryId: categoryId || undefined,
    materialType: materialType || undefined,
    description: description || null,
  }, null);
}

async function deactivateMaterialAction(formData: FormData) {
  "use server";
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const materialId = formData.get("materialId") as string;
  await deactivateMaterial(user, materialId, null);
  redirect("/admin/materiales");
}

async function addSerialNumberAction(formData: FormData) {
  "use server";
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const materialId = formData.get("materialId") as string;
  const serialNumber = formData.get("serialNumber") as string;
  const assignedToUserId = (formData.get("assignedToUserId") as string) || null;
  const assignedToUnitId = (formData.get("assignedToUnitId") as string) || null;
  const notes = (formData.get("notes") as string) || null;

  await addMaterialSerialNumber(user, {
    materialId,
    serialNumber,
    assignedToUserId,
    assignedToUnitId,
    notes,
  }, null);
}

async function deleteSerialNumberAction(formData: FormData) {
  "use server";
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const serialNumberId = formData.get("serialNumberId") as string;
  await removeMaterialSerialNumber(user, serialNumberId, null);
}

async function assignToUnitAction(formData: FormData) {
  "use server";
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const materialId = formData.get("materialId") as string;
  const unitId = formData.get("unitId") as string;
  const quantity = parseInt(formData.get("quantity") as string, 10) || 0;

  if (!unitId || quantity < 0) return;

  await assignMaterialToUnit(user, {
    materialId,
    unitId,
    quantity,
  }, null);
}

async function updateStockAction(formData: FormData) {
  "use server";
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const materialId = formData.get("materialId") as string;
  const unitId = formData.get("unitId") as string;
  const quantity = parseInt(formData.get("quantity") as string, 10) || 0;
  await updateMaterialQuantityInUnit(user, materialId, unitId, { quantity }, null);
}

export default async function EditMaterialPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = (await getSessionUser())!;

  const material = await getMaterial(user, id);
  if (!material) notFound();

  const isAdmin = user.role === "COMANDANCIA_ADMIN";
  const isUnitManager = user.role === "UNIT_MANAGER";
  const isOperational = user.role === "OPERATIONAL";

  const categories = await listCategories(user);
  const images = await prisma.materialImage.findMany({
    where: { materialId: id },
    orderBy: { order: "asc" },
  });

  const serialNumbers = await prisma.materialSerialNumber.findMany({
    where: { materialId: id },
    include: {
      assignedToUser: { select: { id: true, name: true, email: true } },
      assignedToUnit: { select: { id: true, code: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const stocks = await getMaterialStocks(user, id);
  const assignedUnitIds = stocks.map(s => s.unitId);

  // Determinar unidades disponibles para asignación según rol
  let availableUnitsForAssignment = [];
  let userUnitForAssignment = null;

  if (isAdmin) {
    availableUnitsForAssignment = await prisma.unit.findMany({
      where: { active: true, id: { notIn: assignedUnitIds } },
      select: { id: true, name: true, code: true },
      orderBy: { name: "asc" },
    });
  } else if (isUnitManager && user.unitId && !assignedUnitIds.includes(user.unitId)) {
    // Para encargados, mostrar su propia unidad si no está ya asignada
    userUnitForAssignment = await prisma.unit.findUnique({
      where: { id: user.unitId },
      select: { id: true, name: true, code: true },
    });
  }

  const users = await prisma.user.findMany({ where: { active: true }, orderBy: { name: "asc" } });
  const units = await prisma.unit.findMany({ where: { active: true }, orderBy: { name: "asc" } });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">{material.name}</h1>
          <p className="text-sm text-slate-500">Código: {material.code}</p>
        </div>
        <Link href="/admin/materiales">
          <Button variant="secondary">Volver</Button>
        </Link>
      </div>

      {/* Información básica */}
      {isOperational && (
        <div className="bg-yellow-50 border border-yellow-200 rounded p-4 text-yellow-800 text-sm">
          Como operario, solo puedes ver la información del material. Para editar, contacta a tu encargado o administrador.
        </div>
      )}
      <Card>
        <CardHeader>
          <CardTitle>Información Básica {isOperational && "(Solo lectura)"}</CardTitle>
        </CardHeader>
        <CardBody>
          <form action={updateMaterialAction} className="space-y-4" style={isOperational ? { pointerEvents: "none", opacity: 0.6 } : {}}>
            <input type="hidden" name="materialId" value={id} />
            <Field>
              <Label htmlFor="code">Código (Generado automáticamente)</Label>
              <Input id="code" name="code" type="text" defaultValue={material.code} maxLength={30} disabled />
            </Field>

            <Field>
              <Label htmlFor="name">Nombre *</Label>
              <Input id="name" name="name" type="text" defaultValue={material.name} maxLength={200} required />
            </Field>

            <Field>
              <Label htmlFor="brand">Marca *</Label>
              <Input id="brand" name="brand" type="text" defaultValue={material.brand || ""} maxLength={100} required />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field>
                <Label htmlFor="model">Modelo</Label>
                <Input id="model" name="model" type="text" defaultValue={material.model || ""} maxLength={100} />
              </Field>

              <Field>
                <Label htmlFor="partNumber">Número de Parte</Label>
                <Input id="partNumber" name="partNumber" type="text" defaultValue={material.partNumber || ""} maxLength={50} />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field>
                <Label htmlFor="categoryId">Categoría</Label>
                <Select id="categoryId" name="categoryId" defaultValue={material.categoryId} required>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </Select>
              </Field>
              <Field>
                <Label htmlFor="materialType">Tipo</Label>
                <Select id="materialType" name="materialType" defaultValue={material.materialType} required>
                  <option value="MATERIAL_MAYOR">Material Mayor</option>
                  <option value="MATERIAL_MENOR">Material Menor</option>
                  <option value="EPP">EPP</option>
                  <option value="EQUIPO_OPERATIVO">Equipo Operativo</option>
                  <option value="INSUMO">Insumo</option>
                </Select>
              </Field>
            </div>

            <Field>
              <Label htmlFor="description">Descripción</Label>
              <Textarea id="description" name="description" defaultValue={material.description || ""} maxLength={1000} disabled={isOperational} />
            </Field>

            {!isOperational && <Button type="submit">Guardar Cambios</Button>}
          </form>
        </CardBody>
      </Card>

      {/* Imágenes */}
      <Card>
        <CardHeader>
          <CardTitle>Imágenes ({images.length}/6)</CardTitle>
        </CardHeader>
        <CardBody className="space-y-4">
          {/* Galería */}
          {images.length > 0 && (
            <div className="grid grid-cols-3 gap-3 mb-4">
              {images.map((img) => (
                <div key={img.id} className="relative group border rounded overflow-hidden bg-gray-100 aspect-square">
                  <img src={img.fileUrl} alt="Material" className="w-full h-full object-cover" />
                  <form action={async () => {
                    "use server";
                    await fetch(`/api/materials/${id}/images`, {
                      method: "DELETE",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ imageId: img.id }),
                    });
                  }} className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                    <button type="submit" className="text-white text-sm font-semibold bg-red-600 px-3 py-1 rounded hover:bg-red-700">Eliminar</button>
                  </form>
                </div>
              ))}
            </div>
          )}

          {/* Upload form */}
          {images.length < 6 && (
            <ImageUploadForm materialId={id} />
          )}

          {images.length === 6 && (
            <p className="text-sm text-slate-500">Se alcanzó el máximo de 6 imágenes</p>
          )}
        </CardBody>
      </Card>

      {/* Números de Serie */}
      <Card>
        <CardHeader>
          <CardTitle>Números de Serie ({serialNumbers.length}) {isOperational && "(Solo lectura)"}</CardTitle>
        </CardHeader>
        <CardBody className="space-y-4">
          {!isOperational && (
          <form action={addSerialNumberAction} className="space-y-3 border-b pb-4">
            <input type="hidden" name="materialId" value={id} />
            <h3 className="font-semibold text-sm">Agregar Número de Serie</h3>
            <Field>
              <Label htmlFor="serialNumber">Número de Serie *</Label>
              <Input id="serialNumber" name="serialNumber" type="text" maxLength={100} placeholder="SN-001" required />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field>
                <Label htmlFor="assignedToUserId">Asignado a Persona</Label>
                <Select id="assignedToUserId" name="assignedToUserId">
                  <option value="">Sin asignar</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </Select>
              </Field>
              <Field>
                <Label htmlFor="assignedToUnitId">Asignado a Ubicación</Label>
                <Select id="assignedToUnitId" name="assignedToUnitId">
                  <option value="">Sin asignar</option>
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </Select>
              </Field>
            </div>

            <Field>
              <Label htmlFor="notes">Notas</Label>
              <Textarea id="notes" name="notes" maxLength={500} placeholder="Notas adicionales..." />
            </Field>

            <Button type="submit" size="sm">Agregar Número de Serie</Button>
          </form>
          )}

          {serialNumbers.length === 0 ? (
            <p className="text-sm text-slate-500">Sin números de serie aún</p>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Número</TH>
                  <TH>Asignado a</TH>
                  <TH>Tipo</TH>
                  <TH>Notas</TH>
                  {!isOperational && <TH>Acciones</TH>}
                </TR>
              </THead>
              <TBody>
                {serialNumbers.map((sn) => (
                  <TR key={sn.id}>
                    <TD className="font-mono text-sm">{sn.serialNumber}</TD>
                    <TD className="text-sm">
                      {sn.assignedToUser ? sn.assignedToUser.name : sn.assignedToUnit ? sn.assignedToUnit.name : <span className="text-slate-400">Sin asignar</span>}
                    </TD>
                    <TD className="text-sm">
                      {sn.assignedToUser ? <Badge>Persona</Badge> : sn.assignedToUnit ? <Badge>Ubicación</Badge> : <Badge tone="neutral">—</Badge>}
                    </TD>
                    <TD className="text-sm text-slate-600">{sn.notes || "—"}</TD>
                    {!isOperational && (
                    <TD>
                      <form action={deleteSerialNumberAction} style={{ display: "inline" }}>
                        <input type="hidden" name="serialNumberId" value={sn.id} />
                        <button type="submit" className="text-red-600 hover:underline text-sm">Eliminar</button>
                      </form>
                    </TD>
                    )}
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardBody>
      </Card>

      {/* Stock por Unidad */}
      <Card>
        <CardHeader>
          <CardTitle>Stock por Unidad {isOperational && "(Solo lectura)"}</CardTitle>
        </CardHeader>
        <CardBody className="space-y-4">
          {stocks.length > 0 && (
            <Table>
              <THead>
                <TR>
                  <TH>Unidad</TH>
                  <TH className="text-center">Cantidad</TH>
                  <TH className="text-center">Estado</TH>
                  {!isOperational && <TH>Acciones</TH>}
                </TR>
              </THead>
              <TBody>
                {stocks.map((stock) => (
                  <TR key={stock.id}>
                    <TD>{stock.unit.name} ({stock.unit.code})</TD>
                    <TD className="text-center">
                      {isOperational ? (
                        <span className="font-semibold">{stock.quantity}</span>
                      ) : (
                        <form action={updateStockAction} className="inline-flex gap-2">
                          <input type="hidden" name="materialId" value={id} />
                          <input type="hidden" name="unitId" value={stock.unitId} />
                          <Input
                            type="number"
                            name="quantity"
                            defaultValue={stock.quantity}
                            min="0"
                            className="w-20"
                          />
                          <Button type="submit" className="text-xs">Actualizar</Button>
                        </form>
                      )}
                    </TD>
                    <TD className="text-center">
                      <Badge tone={stock.quantity > 0 ? "success" : "neutral"}>
                        {stock.quantity > 0 ? "Activo" : "Inactivo"}
                      </Badge>
                    </TD>
                    {!isOperational && (
                      <TD>
                        <button type="button" className="text-red-600 hover:underline text-sm">Remover</button>
                      </TD>
                    )}
                  </TR>
                ))}
              </TBody>
            </Table>
          )}

          {stocks.length === 0 && (
            <p className="text-sm text-slate-500">Sin asignaciones a unidades aún.</p>
          )}

          {!isOperational && (availableUnitsForAssignment.length > 0 || userUnitForAssignment) && (
            <form action={assignToUnitAction} className="border-t pt-4 mt-4 space-y-3">
              <input type="hidden" name="materialId" value={id} />
              <h4 className="font-semibold text-sm">Asignar a Nueva Unidad</h4>
              <div className="grid grid-cols-2 gap-3">
                <Field>
                  <Label htmlFor="unitId">Unidad</Label>
                  {isAdmin ? (
                    <Select id="unitId" name="unitId" required>
                      <option value="">Selecciona una unidad</option>
                      {availableUnitsForAssignment.map((unit) => (
                        <option key={unit.id} value={unit.id}>{unit.name} ({unit.code})</option>
                      ))}
                    </Select>
                  ) : (
                    <>
                      <Input
                        type="text"
                        defaultValue={userUnitForAssignment?.name || ""}
                        disabled
                      />
                      <input type="hidden" name="unitId" value={userUnitForAssignment?.id || ""} />
                      <p className="text-xs text-slate-500 mt-1">Como encargado, solo puedes asignar a tu unidad</p>
                    </>
                  )}
                </Field>
                <Field>
                  <Label htmlFor="quantity">Cantidad</Label>
                  <Input id="quantity" name="quantity" type="number" min="0" defaultValue="0" required />
                </Field>
              </div>
              <Button type="submit">Asignar</Button>
            </form>
          )}

          {isOperational && stocks.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded p-3 text-blue-800 text-sm">
              Como operario, solo puedes ver las cantidades. Contacta a tu encargado para cambios.
            </div>
          )}
        </CardBody>
      </Card>

      {/* Zona de Baja - Solo para Administradores */}
      {material.active && isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="text-red-600">Zona de Baja</CardTitle>
          </CardHeader>
          <CardBody>
            <p className="text-sm text-slate-600 mb-4">Una vez dado de baja, el material no aparecerá en listados activos.</p>
            <form action={deactivateMaterialAction}>
              <input type="hidden" name="materialId" value={id} />
              <Button type="submit" variant="danger">Dar de Baja Material</Button>
            </form>
          </CardBody>
        </Card>
      )}
    </div>
  );
}

// Componente de carga de imágenes
function ImageUploadForm({ materialId }: { materialId: string }) {
  return (
    <div className="border-2 border-dashed border-gray-300 rounded p-6 text-center">
      <form action={async (formData) => {
        "use server";
        const file = formData.get("file") as File;
        if (!file) return;

        const data = new FormData();
        data.append("file", file);

        const res = await fetch(`/api/materials/${materialId}/images`, {
          method: "POST",
          body: data,
        });

        if (!res.ok) {
          throw new Error(`Upload failed: ${res.statusText}`);
        }
      }}>
        <input
          type="file"
          name="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="w-full"
          required
        />
        <p className="text-xs text-slate-500 mt-2">JPG, PNG, WebP o GIF (máx 5MB)</p>
        <Button type="submit" className="mt-3">Subir Imagen</Button>
      </form>
    </div>
  );
}
