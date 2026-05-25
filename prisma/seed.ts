import { PrismaClient, UnitType, UserRole, MaterialType } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("→ Seed iniciado");

  // ── 1. Categorías ────────────────────────────────────────────
  const categoryNames = [
    "Material mayor",
    "Material menor",
    "EPP",
    "Rescate",
    "Agua",
    "Médico",
    "Comunicaciones",
    "Herramientas",
    "Entrenamiento",
    "Logística",
    "Aseo",
    "Repuestos",
    "Alimentación",
    "Bodega",
  ];
  for (const name of categoryNames) {
    await prisma.category.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }
  console.log(`  ✓ ${categoryNames.length} categorías`);

  // ── 2. Unidades (26 + Comandancia virtual) ───────────────────
  const units: { code: string; name: string; unitType: UnitType }[] = [];
  for (let i = 1; i <= 22; i++) {
    units.push({
      code: `CU${String(i).padStart(2, "0")}`,
      name: `Cuartel ${i}`,
      unitType: UnitType.CUARTEL,
    });
  }
  units.push({ code: "CE01", name: "Campo de Entrenamiento", unitType: UnitType.CAMPO_ENTRENAMIENTO });
  units.push({ code: "BO01", name: "Bodega 1", unitType: UnitType.BODEGA });
  units.push({ code: "BO02", name: "Bodega 2", unitType: UnitType.BODEGA });
  units.push({ code: "BO03", name: "Bodega 3", unitType: UnitType.BODEGA });
  units.push({ code: "CMD", name: "Comandancia", unitType: UnitType.COMANDANCIA });

  for (const u of units) {
    await prisma.unit.upsert({
      where: { code: u.code },
      update: {},
      create: u,
    });
  }
  console.log(`  ✓ ${units.length} unidades`);

  // ── 3. Usuarios demo ─────────────────────────────────────────
  const cuartel1 = await prisma.unit.findUnique({ where: { code: "CU01" } });
  if (!cuartel1) throw new Error("Cuartel 1 no encontrado");

  const demos: { name: string; email: string; password: string; role: UserRole; unitId: string | null }[] = [
    { name: "Administrador Comandancia", email: "admin@bomberos.local", password: "Admin1234!", role: UserRole.COMANDANCIA_ADMIN, unitId: null },
    { name: "Encargado Cuartel 1", email: "encargado1@bomberos.local", password: "Encargado1!", role: UserRole.UNIT_MANAGER, unitId: cuartel1.id },
    { name: "Operativo Cuartel 1", email: "operativo1@bomberos.local", password: "Operativo1!", role: UserRole.OPERATIONAL, unitId: cuartel1.id },
  ];

  for (const u of demos) {
    const passwordHash = await bcrypt.hash(u.password, 12);
    await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name, role: u.role, unitId: u.unitId, active: true },
      create: {
        name: u.name,
        email: u.email,
        passwordHash,
        role: u.role,
        unitId: u.unitId,
      },
    });
  }
  console.log(`  ✓ ${demos.length} usuarios demo`);

  // ── 4. Materiales base (catálogo) ────────────────────────────
  const catMayor = await prisma.category.findUnique({ where: { name: "Material mayor" } });
  const catMenor = await prisma.category.findUnique({ where: { name: "Material menor" } });
  const catEpp = await prisma.category.findUnique({ where: { name: "EPP" } });
  const catMedico = await prisma.category.findUnique({ where: { name: "Médico" } });
  const catComs = await prisma.category.findUnique({ where: { name: "Comunicaciones" } });
  if (!catMayor || !catMenor || !catEpp || !catMedico || !catComs) {
    throw new Error("Categorías base no encontradas");
  }

  const materials = [
    { code: "MAT-001", name: "Carro bomba", brand: "Rosenbauer", model: "AT TL 3000 S", partNumber: "ROS-AT3000", categoryId: catMayor.id, materialType: MaterialType.EQUIPO_OPERATIVO },
    { code: "MAT-002", name: "Carro aljibe", brand: "Pierce", model: "Impel", partNumber: "PRC-IMPEL", categoryId: catMayor.id, materialType: MaterialType.EQUIPO_OPERATIVO },
    { code: "MAT-003", name: "Ambulancia", brand: "Mercedes", model: "Sprinter", partNumber: "MB-SPR220", categoryId: catMayor.id, materialType: MaterialType.EQUIPO_OPERATIVO },
    { code: "MAT-010", name: "Manguera 1½\"", brand: "Rubber-Fab", model: "Standard", partNumber: "RF-MAN15", categoryId: catMenor.id, materialType: MaterialType.MATERIAL_MENOR },
    { code: "MAT-011", name: "Pitón regulable", brand: "Akron", model: "Turbo Fog", partNumber: "AKR-TF200", categoryId: catMenor.id, materialType: MaterialType.MATERIAL_MENOR },
    { code: "MAT-020", name: "Casco estructural", brand: "Scott", model: "AV-2100", partNumber: "SCT-AV2100", categoryId: catEpp.id, materialType: MaterialType.EPP },
    { code: "MAT-021", name: "Chaqueta estructural", brand: "Gear", model: "Titan", partNumber: "GER-TITAN", categoryId: catEpp.id, materialType: MaterialType.EPP },
    { code: "MAT-030", name: "Equipo de respiración autónoma", brand: "Draeger", model: "PSS 100", partNumber: "DRG-PSS100", categoryId: catEpp.id, materialType: MaterialType.EQUIPO_OPERATIVO },
    { code: "MAT-031", name: "Cilindro de aire 6L", brand: "Luxfer", model: "AL6061-6", partNumber: "LXF-AL6061", categoryId: catEpp.id, materialType: MaterialType.EQUIPO_OPERATIVO },
    { code: "MAT-040", name: "Radio portátil VHF", brand: "Motorola", model: "MotoTRBO", partNumber: "MOT-TRBP", categoryId: catComs.id, materialType: MaterialType.EQUIPO_OPERATIVO },
    { code: "MAT-050", name: "Guantes de nitrilo (caja 100u)", brand: "Ansell", model: "TouchNTuff", partNumber: "ANS-TNT", categoryId: catMedico.id, materialType: MaterialType.INSUMO },
    { code: "MAT-051", name: "Apósitos estériles", brand: "Johnson", model: "Tegaderm", partNumber: "JNS-TEG", categoryId: catMedico.id, materialType: MaterialType.INSUMO },
  ];
  for (const m of materials) {
    await prisma.material.upsert({
      where: { code: m.code },
      update: {},
      create: m,
    });
  }
  console.log(`  ✓ ${materials.length} materiales base`);

  console.log("✓ Seed completado");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
