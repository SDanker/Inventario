import Link from "next/link";
import { redirect } from "next/navigation";
import { MaterialType } from "@prisma/client";
import { getSessionUser } from "@/auth";
import { prisma } from "@/lib/db";
import { createMaterial, assignMaterialToUnit } from "@/lib/services/catalog.service";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Label } from "@/components/ui/label";
import { Input, Textarea } from "@/components/ui/input";

type ImportRow = {
  line: number;
  name: string;
  brand: string;
  model: string | null;
  partNumber: string | null;
  categoryId: string;
  materialType: MaterialType;
  description: string | null;
  unitId: string | null;
  quantity: number | null;
};

const materialTypeLabels: Record<MaterialType, string> = {
  MATERIAL_MAYOR: "Material mayor",
  MATERIAL_MENOR: "Material menor",
  EPP: "EPP",
  EQUIPO_OPERATIVO: "Equipo operativo",
  INSUMO: "Insumo",
};

function normalize(value: string) {
  return value
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function csvValue(value: string | undefined) {
  return (value ?? "").trim();
}

function splitCsvLine(line: string, separator: string) {
  const values: string[] = [];
  let current = "";
  let quoted = false;

  for (let i = 0; i < line.length; i++) {
    const char = line.charAt(i);
    const next = line.charAt(i + 1);

    if (char === '"' && quoted && next === '"') {
      current += '"';
      i++;
      continue;
    }

    if (char === '"') {
      quoted = !quoted;
      continue;
    }

    if (char === separator && !quoted) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
}

function detectSeparator(header: string) {
  const candidates = [",", ";", "\t"];
  return candidates
    .map((separator) => ({ separator, count: splitCsvLine(header, separator).length }))
    .sort((a, b) => b.count - a.count)[0]?.separator ?? ",";
}

function parseCsv(text: string) {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);

  if (lines.length < 2) {
    throw new Error("El archivo debe incluir encabezados y al menos una fila de material.");
  }

  const headerLine = lines[0];
  if (!headerLine) throw new Error("El archivo no tiene encabezados.");

  const separator = detectSeparator(headerLine);
  const headers = splitCsvLine(headerLine, separator).map(normalize);
  const rows = lines.slice(1).map((line, index) => {
    const values = splitCsvLine(line, separator);
    const row = new Map<string, string>();
    headers.forEach((header, headerIndex) => row.set(header, csvValue(values[headerIndex])));
    return { line: index + 2, row };
  });

  return rows;
}

function valueFrom(row: Map<string, string>, keys: string[]) {
  for (const key of keys) {
    const value = row.get(key);
    if (value) return value;
  }
  return "";
}

function parseMaterialType(value: string): MaterialType | null {
  const normalized = normalize(value);
  const aliases: Record<string, MaterialType> = {
    MATERIAL_MAYOR: MaterialType.MATERIAL_MAYOR,
    MAYOR: MaterialType.MATERIAL_MAYOR,
    MATERIAL_MENOR: MaterialType.MATERIAL_MENOR,
    MENOR: MaterialType.MATERIAL_MENOR,
    EPP: MaterialType.EPP,
    EQUIPO_OPERATIVO: MaterialType.EQUIPO_OPERATIVO,
    EQUIPO: MaterialType.EQUIPO_OPERATIVO,
    OPERATIVO: MaterialType.EQUIPO_OPERATIVO,
    INSUMO: MaterialType.INSUMO,
    INSUMOS: MaterialType.INSUMO,
  };
  return aliases[normalized] ?? null;
}

function redirectWithImportError(message: string) {
  redirect(`/admin/materiales/importar?error=${encodeURIComponent(message.slice(0, 300))}`);
}

async function importMaterialsAction(formData: FormData) {
  "use server";
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const file = formData.get("file") as File | null;
  const pastedCsv = formData.get("csv") as string | null;
  const fileText = file && file.size > 0 ? await file.text() : "";
  const csvText = fileText || pastedCsv || "";

  if (!csvText.trim()) {
    redirectWithImportError("Sube un archivo CSV o pega filas en el cuadro de texto.");
  }

  const categories = await prisma.category.findMany({ select: { id: true, name: true } });
  const units = await prisma.unit.findMany({ where: { active: true }, select: { id: true, code: true, name: true } });
  const categoryByName = new Map(categories.map((category) => [normalize(category.name), category.id]));
  const unitByCodeOrName = new Map<string, string>(
    units.flatMap((unit) => [
      [normalize(unit.code), unit.id] as const,
      [normalize(unit.name), unit.id] as const,
    ]),
  );

  let parsedRows: ReturnType<typeof parseCsv> = [];
  try {
    parsedRows = parseCsv(csvText);
  } catch (error) {
    redirectWithImportError(error instanceof Error ? error.message : "No se pudo leer el CSV.");
  }

  const importRows: ImportRow[] = [];
  const errors: string[] = [];

  for (const { line, row } of parsedRows) {
    const name = valueFrom(row, ["NOMBRE", "MATERIAL"]);
    const brand = valueFrom(row, ["MARCA", "BRAND"]);
    const categoryName = valueFrom(row, ["CATEGORIA", "CATEGORY"]);
    const materialTypeText = valueFrom(row, ["TIPO", "TIPO_MATERIAL", "MATERIAL_TYPE"]);
    const unitText = valueFrom(row, ["UNIDAD", "CODIGO_UNIDAD", "UNIT"]);
    const quantityText = valueFrom(row, ["CANTIDAD", "STOCK", "QUANTITY"]);

    if (!name) errors.push(`Línea ${line}: falta nombre`);
    if (!brand) errors.push(`Línea ${line}: falta marca`);
    if (!categoryName) errors.push(`Línea ${line}: falta categoría`);
    if (!materialTypeText) errors.push(`Línea ${line}: falta tipo`);

    const categoryId = categoryByName.get(normalize(categoryName));
    if (categoryName && !categoryId) errors.push(`Línea ${line}: categoría no existe (${categoryName})`);

    const materialType = parseMaterialType(materialTypeText);
    if (materialTypeText && !materialType) errors.push(`Línea ${line}: tipo no válido (${materialTypeText})`);

    const parsedQuantity = quantityText ? Number.parseInt(quantityText, 10) : null;
    const quantity = parsedQuantity !== null && Number.isInteger(parsedQuantity) ? parsedQuantity : null;
    if (quantityText && (quantity === null || quantity < 0)) {
      errors.push(`Línea ${line}: cantidad debe ser un número entero mayor o igual a 0`);
    }

    const unitId = unitText ? unitByCodeOrName.get(normalize(unitText)) : null;
    if (unitText && !unitId) errors.push(`Línea ${line}: unidad no existe (${unitText})`);
    if (quantity && quantity > 0 && !unitId) errors.push(`Línea ${line}: indica unidad para asignar cantidad inicial`);

    if (name && brand && categoryId && materialType) {
      importRows.push({
        line,
        name,
        brand,
        model: valueFrom(row, ["MODELO", "MODEL"]) || null,
        partNumber: valueFrom(row, ["NUMERO_PARTE", "N_PARTE", "PARTE", "PART_NUMBER"]) || null,
        categoryId,
        materialType,
        description: valueFrom(row, ["DESCRIPCION", "DESCRIPTION"]) || null,
        unitId: unitId ?? null,
        quantity,
      });
    }
  }

  if (errors.length > 0) {
    redirectWithImportError(errors.slice(0, 6).join(" | "));
  }

  for (const row of importRows) {
    const created = await createMaterial(user, {
      name: row.name,
      brand: row.brand,
      model: row.model,
      partNumber: row.partNumber,
      categoryId: row.categoryId,
      materialType: row.materialType,
      description: row.description,
    });

    if (row.unitId && row.quantity && row.quantity > 0) {
      await assignMaterialToUnit(user, {
        materialId: created.id,
        unitId: row.unitId,
        quantity: row.quantity,
      });
    }
  }

  redirect(`/admin/materiales?imported=${importRows.length}`);
}

export default async function ImportMaterialsPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const error = params?.error;

  return (
    <div className="space-y-4 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold">Importar materiales</h1>
        <p className="text-sm text-slate-500">Carga materiales en bloque. El código se genera automáticamente para cada fila.</p>
      </div>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Formato CSV</CardTitle>
        </CardHeader>
        <CardBody className="space-y-3 text-sm text-slate-700">
          <p>Encabezados requeridos: nombre, marca, categoria, tipo.</p>
          <p>Encabezados opcionales: modelo, numero_parte, descripcion, unidad, cantidad.</p>
          <p>Tipos aceptados: {Object.values(materialTypeLabels).join(", ")}.</p>
          <pre className="overflow-x-auto rounded-md bg-slate-950 p-3 text-xs text-slate-100">
{`nombre;marca;modelo;numero_parte;categoria;tipo;descripcion;unidad;cantidad
Manguera 2.5 pulgadas;Rubber-Fab;Standard;RF-MAN25;Material menor;Material menor;Manguera de ataque;BO01;10
Casco estructural;Scott;AV-2100;SCT-AV2100;EPP;EPP;Casco para combate interior;BO01;5`}
          </pre>
        </CardBody>
      </Card>

      <form action={importMaterialsAction} encType="multipart/form-data" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Archivo o datos</CardTitle>
          </CardHeader>
          <CardBody className="space-y-4">
            <Field>
              <Label htmlFor="file">Archivo CSV</Label>
              <Input id="file" name="file" type="file" accept=".csv,text/csv" />
            </Field>

            <Field>
              <Label htmlFor="csv">Pegar CSV</Label>
              <Textarea
                id="csv"
                name="csv"
                rows={10}
                placeholder="Pega aquí el contenido CSV si no vas a subir un archivo."
              />
            </Field>
          </CardBody>
        </Card>

        <div className="flex gap-2">
          <Link href="/admin/materiales">
            <Button type="button" variant="secondary">Cancelar</Button>
          </Link>
          <Button type="submit">Importar materiales</Button>
        </div>
      </form>
    </div>
  );
}
