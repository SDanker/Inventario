"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Label, Field } from "@/components/ui/label";
import { computeNextMaintenance, formatDate } from "@/lib/utils";

type Props = {
  materialId: string;
  action: (formData: FormData) => Promise<void>;
  canEdit: boolean;
  initialStartDate: string | null;
  initialIntervalValue: number | null;
  initialIntervalUnit: string | null;
  formKey: string;
};

export function MaintenanceScheduleForm({
  materialId,
  action,
  canEdit,
  initialStartDate,
  initialIntervalValue,
  initialIntervalUnit,
  formKey,
}: Props) {
  const [startDate, setStartDate] = useState(initialStartDate ?? "");
  const [intervalValue, setIntervalValue] = useState<string>(
    initialIntervalValue ? String(initialIntervalValue) : "",
  );
  const [intervalUnit, setIntervalUnit] = useState<string>(initialIntervalUnit ?? "");

  const nextDate = useMemo(() => {
    const n = Number(intervalValue);
    if (!startDate || !intervalUnit || !n || n <= 0) return null;
    return computeNextMaintenance(startDate, n, intervalUnit);
  }, [startDate, intervalValue, intervalUnit]);

  return (
    <form
      key={formKey}
      action={action}
      className="space-y-3"
      style={!canEdit ? { pointerEvents: "none", opacity: 0.6 } : {}}
    >
      <input type="hidden" name="materialId" value={materialId} />
      <div className="grid grid-cols-3 gap-3">
        <Field>
          <Label htmlFor="maintenanceStartDate">Fecha de inicio</Label>
          <Input
            id="maintenanceStartDate"
            name="maintenanceStartDate"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </Field>
        <Field>
          <Label htmlFor="maintenanceIntervalValue">Cada</Label>
          <Input
            id="maintenanceIntervalValue"
            name="maintenanceIntervalValue"
            type="number"
            min="1"
            max="9999"
            value={intervalValue}
            onChange={(e) => setIntervalValue(e.target.value)}
            placeholder="1"
          />
        </Field>
        <Field>
          <Label htmlFor="maintenanceIntervalUnit">Periodo</Label>
          <Select
            id="maintenanceIntervalUnit"
            name="maintenanceIntervalUnit"
            value={intervalUnit}
            onChange={(e) => setIntervalUnit(e.target.value)}
          >
            <option value="">Sin periodicidad</option>
            <option value="days">Día(s)</option>
            <option value="weeks">Semana(s)</option>
            <option value="months">Mes(es)</option>
            <option value="quarters">Trimestre(s)</option>
            <option value="years">Año(s)</option>
          </Select>
        </Field>
      </div>
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-600">
          Próxima mantención:{" "}
          <span className="font-semibold">{nextDate ? formatDate(nextDate) : "—"}</span>
          {nextDate && startDate && (
            <span className="ml-2 text-xs text-slate-500">
              (primera fue {formatDate(new Date(startDate))})
            </span>
          )}
        </p>
        {canEdit && <Button type="submit">Guardar calendario</Button>}
      </div>
    </form>
  );
}
