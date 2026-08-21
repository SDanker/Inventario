import { prisma } from "@/lib/db";

type SerialNumberUsageOptions = {
  excludeMaterialSerialNumberId?: string | null;
  excludeAssetId?: string | null;
};

export async function assertSerialNumberAvailable(
  serialNumber: string | null | undefined,
  options: SerialNumberUsageOptions = {},
) {
  const cleanSerialNumber = serialNumber?.trim();
  if (!cleanSerialNumber) return;

  const materialSerialNumber = await prisma.materialSerialNumber.findFirst({
    where: {
      serialNumber: { equals: cleanSerialNumber, mode: "insensitive" },
      ...(options.excludeMaterialSerialNumberId ? { id: { not: options.excludeMaterialSerialNumberId } } : {}),
    },
    include: {
      material: { select: { code: true, name: true } },
      assignedToUser: { select: { name: true } },
      assignedToUnit: { select: { code: true, name: true } },
    },
  });

  if (materialSerialNumber) {
    const assignment = materialSerialNumber.assignedToUser
      ? `asignado a ${materialSerialNumber.assignedToUser.name}`
      : materialSerialNumber.assignedToUnit
        ? `asignado a ${materialSerialNumber.assignedToUnit.code} - ${materialSerialNumber.assignedToUnit.name}`
        : "sin asignación";

    throw new Error(
      `El número de serie "${cleanSerialNumber}" ya existe en el material ${materialSerialNumber.material.code} - ${materialSerialNumber.material.name}, ${assignment}.`,
    );
  }

  const asset = await prisma.asset.findFirst({
    where: {
      serialNumber: { equals: cleanSerialNumber, mode: "insensitive" },
      ...(options.excludeAssetId ? { id: { not: options.excludeAssetId } } : {}),
    },
    include: {
      material: { select: { code: true, name: true } },
      unit: { select: { code: true, name: true } },
    },
  });

  if (asset) {
    throw new Error(
      `El número de serie "${cleanSerialNumber}" ya existe en el activo ${asset.internalCode}, material ${asset.material.code} - ${asset.material.name}, unidad ${asset.unit.code} - ${asset.unit.name}.`,
    );
  }
}
