import { z } from "zod";
import { AlertStatus, AlertType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { requirePermission, type SessionUser, ForbiddenError } from "@/lib/auth/permissions";

export const assetReviewCreateSchema = z.object({
  assetId: z.string().cuid(),
  status: z.enum(["OK", "CON_OBSERVACIONES", "INOPERATIVA"]),
  comments: z.string().trim().max(1000).optional().nullable(),
});

export async function getAssetWithReviews(user: SessionUser, assetId: string) {
  const asset = await prisma.asset.findUnique({
    where: { id: assetId },
    include: {
      material: true,
      unit: true,
      reviews: {
        orderBy: { reviewDate: "desc" },
        include: { reviewedByUser: { select: { id: true, name: true } } },
      },
    },
  });

  if (!asset) return null;

  // Check permission based on user role and unit
  if (user.role !== "COMANDANCIA_ADMIN" && user.unitId !== asset.unitId) {
    throw new ForbiddenError("No tienes permiso para ver este activo");
  }

  return asset;
}

export async function listAssetsNeedingReview(user: SessionUser) {
  if (user.role !== "COMANDANCIA_ADMIN") requirePermission(user, "assets.read.own");

  const now = new Date();
  const unitFilter =
    user.role === "COMANDANCIA_ADMIN"
      ? {}
      : { unitId: user.unitId! };

  return prisma.asset.findMany({
    where: {
      ...unitFilter,
      nextReviewDate: { lte: now },
      NOT: { nextReviewDate: null },
    },
    include: {
      material: true,
      unit: true,
      reviews: {
        take: 1,
        orderBy: { reviewDate: "desc" },
      },
    },
    orderBy: { nextReviewDate: "asc" },
  });
}

export async function submitAssetReview(user: SessionUser, input: z.infer<typeof assetReviewCreateSchema>, ip?: string | null) {
  requirePermission(user, "assets.write.own");

  const data = assetReviewCreateSchema.parse(input);

  const asset = await prisma.asset.findUnique({
    where: { id: data.assetId },
  });

  if (!asset) throw new Error("Activo no encontrado");

  // Check permission based on user role and unit
  if (user.role !== "COMANDANCIA_ADMIN" && user.unitId !== asset.unitId) {
    throw new ForbiddenError("No tienes permiso para revisar este activo");
  }

  return prisma.$transaction(async (tx) => {
    // Create review record
    const review = await tx.assetReview.create({
      data: {
        assetId: data.assetId,
        status: data.status,
        comments: data.comments ?? null,
        reviewedBy: user.id,
      },
    });

    // Calculate next review date if interval is set
    if (asset.reviewIntervalValue && asset.reviewIntervalUnit) {
      const nextDate = new Date();
      const unit = asset.reviewIntervalUnit;
      const value = asset.reviewIntervalValue;

      if (unit === "days") {
        nextDate.setDate(nextDate.getDate() + value);
      } else if (unit === "weeks") {
        nextDate.setDate(nextDate.getDate() + value * 7);
      } else if (unit === "months") {
        nextDate.setMonth(nextDate.getMonth() + value);
      } else if (unit === "years") {
        nextDate.setFullYear(nextDate.getFullYear() + value);
      }

      // Update next review date
      await tx.asset.update({
        where: { id: data.assetId },
        data: { nextReviewDate: nextDate },
      });
    }

    await tx.alert.updateMany({
      where: {
        assetId: data.assetId,
        status: AlertStatus.ABIERTA,
        alertType: { in: [AlertType.REVISION_VENCIDA, AlertType.REVISION_PROXIMA] },
      },
      data: {
        status: AlertStatus.RESUELTA,
        description: "Resuelta automáticamente al registrar la revisión del activo.",
      },
    });

    await recordAudit(tx, {
      userId: user.id,
      action: "review",
      tableName: "assets",
      recordId: data.assetId,
      newValue: { reviewStatus: data.status, comments: data.comments },
      ipAddress: ip,
    });

    return review;
  });
}

export async function setAssetReviewSchedule(
  user: SessionUser,
  assetId: string,
  intervalValue: number,
  intervalUnit: "days" | "weeks" | "months" | "years",
  nextReviewDateOverride?: Date | null,
  ip?: string | null
) {
  requirePermission(user, "assets.write.own");

  const asset = await prisma.asset.findUnique({
    where: { id: assetId },
  });

  if (!asset) throw new Error("Activo no encontrado");

  // Check permission
  if (user.role !== "COMANDANCIA_ADMIN" && user.unitId !== asset.unitId) {
    throw new ForbiddenError("No tienes permiso para actualizar este activo");
  }

  let nextDate: Date;
  if (nextReviewDateOverride) {
    nextDate = nextReviewDateOverride;
  } else {
    nextDate = new Date();
    if (intervalUnit === "days") {
      nextDate.setDate(nextDate.getDate() + intervalValue);
    } else if (intervalUnit === "weeks") {
      nextDate.setDate(nextDate.getDate() + intervalValue * 7);
    } else if (intervalUnit === "months") {
      nextDate.setMonth(nextDate.getMonth() + intervalValue);
    } else if (intervalUnit === "years") {
      nextDate.setFullYear(nextDate.getFullYear() + intervalValue);
    }
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.asset.update({
      where: { id: assetId },
      data: {
        reviewIntervalValue: intervalValue,
        reviewIntervalUnit: intervalUnit,
        nextReviewDate: nextDate,
      },
    });

    await recordAudit(tx, {
      userId: user.id,
      action: "set_review_schedule",
      tableName: "assets",
      recordId: assetId,
      oldValue: {
        intervalValue: asset.reviewIntervalValue,
        intervalUnit: asset.reviewIntervalUnit,
        nextReviewDate: asset.nextReviewDate,
      },
      newValue: { intervalValue, intervalUnit, nextReviewDate: nextDate },
      ipAddress: ip,
    });

    return updated;
  });
}
