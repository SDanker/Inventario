"use client";

import { useState, useRef } from "react";
import { Unit, Material, Asset, UserRole } from "@prisma/client";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { Label, Field } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";

interface AssetWithMaterial extends Asset {
  material: Material;
}

interface TransferItem {
  assetId?: string | null;
  materialId?: string | null;
  quantity: number;
  notes?: string | null;
}

interface NewTransferFormProps {
  action: (formData: FormData) => Promise<void>;
  units: Unit[];
  materials: Material[];
  assets: AssetWithMaterial[];
  userRole: UserRole;
  userUnitId: string | null;
  cancelHref: string;
}

export function NewTransferForm({
  action,
  units,
  materials,
  assets,
  userRole,
  userUnitId,
  cancelHref,
}: NewTransferFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [items, setItems] = useState<TransferItem[]>([]);
  const [itemType, setItemType] = useState<"asset" | "material">("material");
  const [selectedAsset, setSelectedAsset] = useState("");
  const [selectedMaterial, setSelectedMaterial] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [notes, setNotes] = useState("");

  function addItem() {
    if (itemType === "asset" && !selectedAsset) {
      alert("Selecciona un activo");
      return;
    }
    if (itemType === "material" && !selectedMaterial) {
      alert("Selecciona un material");
      return;
    }
    if (!quantity || Number(quantity) <= 0) {
      alert("La cantidad debe ser mayor a 0");
      return;
    }

    const newItem: TransferItem = {
      quantity: Number(quantity),
      notes: notes || null,
      ...(itemType === "asset"
        ? { assetId: selectedAsset }
        : { materialId: selectedMaterial }),
    };

    setItems([...items, newItem]);
    setSelectedAsset("");
    setSelectedMaterial("");
    setQuantity("1");
    setNotes("");
  }

  function removeItem(index: number) {
    setItems(items.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (items.length === 0) {
      alert("Agrega al menos un item");
      return;
    }

    const formData = new FormData(e.currentTarget);
    formData.set("items_json", JSON.stringify(items));

    await action(formData);
  }

  const destinationUnits = units.filter((u) => {
    if (userRole === "COMANDANCIA_ADMIN") return true;
    return u.id !== userUnitId;
  });

  const getAssetLabel = (asset: AssetWithMaterial) =>
    `${asset.internalCode} - ${asset.material.name}`;

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Información del traslado</CardTitle></CardHeader>
        <CardBody className="space-y-4">
          <Field>
            <Label htmlFor="destinationUnitId">Unidad destino *</Label>
            <Select id="destinationUnitId" name="destinationUnitId" required>
              <option value="">Selecciona una unidad</option>
              {destinationUnits.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.code} - {u.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field>
            <Label htmlFor="reason">Razón del traslado (opcional)</Label>
            <Input
              id="reason"
              name="reason"
              maxLength={500}
              placeholder="Mantenimiento, reorganización, etc."
            />
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader><CardTitle>Agregar items</CardTitle></CardHeader>
        <CardBody className="space-y-4">
          <div className="flex gap-4 items-end">
            <Field className="flex-1">
              <Label htmlFor="itemType">Tipo de item</Label>
              <Select
                id="itemType"
                value={itemType}
                onChange={(e) => {
                  setItemType(e.target.value as "asset" | "material");
                  setSelectedAsset("");
                  setSelectedMaterial("");
                }}
              >
                <option value="material">Material/Insumo</option>
                <option value="asset">Activo</option>
              </Select>
            </Field>

            {itemType === "material" ? (
              <Field className="flex-1">
                <Label htmlFor="selectedMaterial">Material</Label>
                <Select
                  id="selectedMaterial"
                  value={selectedMaterial}
                  onChange={(e) => setSelectedMaterial(e.target.value)}
                >
                  <option value="">Selecciona un material</option>
                  {materials.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.code} - {m.name}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : (
              <Field className="flex-1">
                <Label htmlFor="selectedAsset">Activo</Label>
                <Select
                  id="selectedAsset"
                  value={selectedAsset}
                  onChange={(e) => setSelectedAsset(e.target.value)}
                >
                  <option value="">Selecciona un activo</option>
                  {assets.map((a) => (
                    <option key={a.id} value={a.id}>
                      {getAssetLabel(a)}
                    </option>
                  ))}
                </Select>
              </Field>
            )}

            <Field>
              <Label htmlFor="quantity">Cantidad</Label>
              <Input
                id="quantity"
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                min="1"
                step={itemType === "asset" ? "1" : "0.01"}
              />
            </Field>

            <Button type="button" onClick={addItem} variant="secondary">
              Agregar
            </Button>
          </div>

          <Field>
            <Label htmlFor="notes">Notas (opcional)</Label>
            <Input
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={500}
              placeholder="Observaciones sobre el item"
            />
          </Field>
        </CardBody>
      </Card>

      {items.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Items a trasladar ({items.length})</CardTitle></CardHeader>
          <CardBody>
            <Table>
              <THead>
                <TR>
                  <TH>Tipo</TH>
                  <TH>Código/Material</TH>
                  <TH>Cantidad</TH>
                  <TH>Notas</TH>
                  <TH></TH>
                </TR>
              </THead>
              <TBody>
                {items.map((item, idx) => {
                  const isAsset = !!item.assetId;
                  const asset = isAsset
                    ? assets.find((a) => a.id === item.assetId)
                    : null;
                  const material = !isAsset
                    ? materials.find((m) => m.id === item.materialId)
                    : null;

                  return (
                    <TR key={idx}>
                      <TD>{isAsset ? "Activo" : "Material"}</TD>
                      <TD className="font-mono">
                        {isAsset ? getAssetLabel(asset!) : material?.code}
                      </TD>
                      <TD>{item.quantity}</TD>
                      <TD className="text-sm">{item.notes || "—"}</TD>
                      <TD className="text-right">
                        <button
                          type="button"
                          onClick={() => removeItem(idx)}
                          className="text-sm text-red-600 hover:underline"
                        >
                          Eliminar
                        </button>
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          </CardBody>
        </Card>
      )}

      <div className="flex gap-2 justify-end">
        <a
          href={cancelHref}
          className="text-sm self-center text-slate-600 hover:underline"
        >
          Cancelar
        </a>
        <Button type="submit" disabled={items.length === 0}>
          Crear traslado
        </Button>
      </div>
    </form>
  );
}
