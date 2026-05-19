import ExcelJS from "exceljs";
import { prisma } from "@/lib/db";
import { requirePermission, type SessionUser, ForbiddenError } from "@/lib/auth/permissions";

/**
 * Genera el workbook de "Inventario consolidado" (Comandancia) o
 * "Inventario de unidad" (Encargado).
 * Devuelve un Buffer listo para enviar como respuesta HTTP.
 */
export async function buildInventoryWorkbook(user: SessionUser, opts: { scope: "global" | "unit"; unitId?: string }) {
  // Permisos
  if (opts.scope === "global") {
    requirePermission(user, "reports.export.any");
  } else {
    if (user.role !== "COMANDANCIA_ADMIN" && user.unitId !== opts.unitId) {
      throw new ForbiddenError("No puede exportar otra unidad");
    }
    requirePermission(user, "reports.export.own");
  }

  const where = opts.scope === "unit" && opts.unitId ? { unitId: opts.unitId } : {};

  const [assets, consumables, units] = await Promise.all([
    prisma.asset.findMany({
      where,
      include: { material: { include: { category: true } }, unit: true },
      orderBy: [{ unit: { code: "asc" } }, { internalCode: "asc" }],
    }),
    prisma.consumableInventory.findMany({
      where,
      include: { material: { include: { category: true } }, unit: true },
      orderBy: [{ unit: { code: "asc" } }, { material: { name: "asc" } }],
    }),
    prisma.unit.findMany({ where: opts.scope === "unit" && opts.unitId ? { id: opts.unitId } : {}, orderBy: { code: "asc" } }),
  ]);

  const wb = new ExcelJS.Workbook();
  wb.creator = "SIIB";
  wb.created = new Date();

  // Hoja 1: Resumen
  const resumen = wb.addWorksheet("Resumen");
  resumen.addRow([opts.scope === "global" ? "Inventario consolidado" : "Inventario de unidad"]);
  resumen.getCell("A1").font = { size: 14, bold: true };
  resumen.addRow([]);
  resumen.addRow(["Generado por", user.name]);
  resumen.addRow(["Fecha", new Date().toLocaleString("es-CL")]);
  resumen.addRow(["Unidades en alcance", units.length]);
  resumen.addRow(["Activos", assets.length]);
  resumen.addRow(["Insumos (registros)", consumables.length]);
  resumen.getColumn(1).width = 26;
  resumen.getColumn(2).width = 40;

  // Hoja 2: Activos
  const ws = wb.addWorksheet("Activos");
  ws.columns = [
    { header: "Unidad", key: "unit", width: 14 },
    { header: "Código interno", key: "code", width: 18 },
    { header: "Material", key: "material", width: 32 },
    { header: "Categoría", key: "category", width: 18 },
    { header: "Tipo", key: "type", width: 18 },
    { header: "N° Serie", key: "serial", width: 22 },
    { header: "Marca", key: "brand", width: 16 },
    { header: "Modelo", key: "model", width: 16 },
    { header: "Patente", key: "plate", width: 12 },
    { header: "Año", key: "year", width: 8 },
    { header: "Ingreso", key: "entry", width: 12 },
    { header: "Vence", key: "exp", width: 12 },
    { header: "Estado", key: "status", width: 18 },
    { header: "Responsable", key: "resp", width: 22 },
    { header: "Ubicación", key: "loc", width: 24 },
  ];
  ws.getRow(1).font = { bold: true };
  for (const a of assets) {
    ws.addRow({
      unit: a.unit.code, code: a.internalCode, material: a.material.name,
      category: a.material.category.name, type: a.material.materialType,
      serial: a.serialNumber ?? "", brand: a.brand ?? "", model: a.model ?? "",
      plate: a.licensePlate ?? "", year: a.year ?? "",
      entry: a.entryDate.toISOString().slice(0, 10),
      exp: a.expirationDate ? a.expirationDate.toISOString().slice(0, 10) : "",
      status: a.status, resp: a.responsibleName ?? "", loc: a.specificLocation ?? "",
    });
  }

  // Hoja 3: Insumos
  const wc = wb.addWorksheet("Insumos");
  wc.columns = [
    { header: "Unidad", key: "unit", width: 14 },
    { header: "Material", key: "material", width: 32 },
    { header: "Categoría", key: "category", width: 18 },
    { header: "Stock", key: "stock", width: 12 },
    { header: "Mínimo", key: "min", width: 10 },
    { header: "U. medida", key: "uom", width: 10 },
    { header: "Lote", key: "batch", width: 16 },
    { header: "Vence", key: "exp", width: 12 },
    { header: "Estado", key: "status", width: 16 },
    { header: "Ubicación", key: "loc", width: 24 },
  ];
  wc.getRow(1).font = { bold: true };
  for (const c of consumables) {
    wc.addRow({
      unit: c.unit.code, material: c.material.name, category: c.material.category.name,
      stock: Number(c.currentStock), min: Number(c.minimumStock), uom: c.unitOfMeasure,
      batch: c.batchNumber ?? "",
      exp: c.expirationDate ? c.expirationDate.toISOString().slice(0, 10) : "",
      status: c.status, loc: c.location ?? "",
    });
  }

  return Buffer.from(await wb.xlsx.writeBuffer());
}
