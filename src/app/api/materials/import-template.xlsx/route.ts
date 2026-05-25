import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { MaterialType } from "@prisma/client";
import { getSessionUser } from "@/auth";
import { prisma } from "@/lib/db";

const materialTypeLabels: Record<MaterialType, string> = {
  MATERIAL_MENOR: "Material menor",
  EPP: "EPP",
  EQUIPO_OPERATIVO: "Equipo operativo",
  INSUMO: "Insumo",
};

const columns = [
  { header: "nombre", key: "name", width: 30 },
  { header: "marca", key: "brand", width: 20 },
  { header: "modelo", key: "model", width: 20 },
  { header: "numero_parte", key: "partNumber", width: 20 },
  { header: "categoria", key: "category", width: 24 },
  { header: "tipo", key: "materialType", width: 22 },
  { header: "descripcion", key: "description", width: 45 },
  { header: "unidad", key: "unit", width: 18 },
  { header: "cantidad", key: "quantity", width: 12 },
];

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const [categories, units] = await Promise.all([
    prisma.category.findMany({ orderBy: { name: "asc" }, select: { name: true } }),
    prisma.unit.findMany({ where: { active: true }, orderBy: { code: "asc" }, select: { code: true, name: true } }),
  ]);

  const wb = new ExcelJS.Workbook();
  wb.creator = "SIIB";
  wb.created = new Date();

  const ws = wb.addWorksheet("Materiales", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  ws.columns = columns;
  ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
  ws.getRow(1).alignment = { vertical: "middle" };

  for (let row = 2; row <= 201; row++) {
    ws.getCell(`E${row}`).dataValidation = {
      type: "list",
      allowBlank: false,
      formulae: categories.length > 0 ? [`Referencias!$B$2:$B$${categories.length + 1}`] : ['""'],
      showErrorMessage: true,
      errorTitle: "Categoria no valida",
      error: "Selecciona una categoria de la hoja Referencias.",
    };
    ws.getCell(`F${row}`).dataValidation = {
      type: "list",
      allowBlank: false,
      formulae: [`Referencias!$A$2:$A$${Object.keys(materialTypeLabels).length + 1}`],
      showErrorMessage: true,
      errorTitle: "Tipo no valido",
      error: "Selecciona un tipo de la hoja Referencias.",
    };
    ws.getCell(`H${row}`).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: units.length > 0 ? [`Referencias!$C$2:$C$${units.length + 1}`] : ['""'],
      showErrorMessage: true,
      errorTitle: "Unidad no valida",
      error: "Usa un codigo de unidad de la hoja Referencias.",
    };
    ws.getCell(`I${row}`).dataValidation = {
      type: "whole",
      operator: "greaterThanOrEqual",
      allowBlank: true,
      formulae: [0],
      showErrorMessage: true,
      errorTitle: "Cantidad no valida",
      error: "La cantidad debe ser un numero entero mayor o igual a 0.",
    };
  }

  const refs = wb.addWorksheet("Referencias");
  refs.columns = [
    { header: "tipos", key: "types", width: 24 },
    { header: "categorias", key: "categories", width: 32 },
    { header: "codigos_unidad", key: "unitCodes", width: 18 },
    { header: "unidades", key: "unitNames", width: 34 },
  ];
  refs.getRow(1).font = { bold: true };

  const types = Object.values(materialTypeLabels);
  const maxRows = Math.max(types.length, categories.length, units.length);
  for (let index = 0; index < maxRows; index++) {
    refs.addRow({
      types: types[index] ?? "",
      categories: categories[index]?.name ?? "",
      unitCodes: units[index]?.code ?? "",
      unitNames: units[index]?.name ?? "",
    });
  }

  refs.getColumn(1).eachCell((cell) => {
    cell.alignment = { vertical: "middle" };
  });

  const buffer = Buffer.from(await wb.xlsx.writeBuffer());
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="plantilla_importacion_materiales.xlsx"',
      "Cache-Control": "private, no-store",
    },
  });
}
