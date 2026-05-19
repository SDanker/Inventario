import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { ForbiddenError } from "./auth/permissions";

/**
 * Convierte errores conocidos en respuestas JSON consistentes.
 * Cualquier route handler puede envolver su lógica con `withErrorHandling`.
 */
export function errorResponse(err: unknown): NextResponse {
  if (err instanceof ForbiddenError) {
    return NextResponse.json({ error: "forbidden", message: err.message }, { status: 403 });
  }
  if (err instanceof ZodError) {
    return NextResponse.json({ error: "validation", issues: err.flatten() }, { status: 400 });
  }
  if (err instanceof Error) {
    return NextResponse.json({ error: "bad_request", message: err.message }, { status: 400 });
  }
  return NextResponse.json({ error: "internal" }, { status: 500 });
}

export async function withErrorHandling<T>(fn: () => Promise<T>): Promise<NextResponse> {
  try {
    const data = await fn();
    return NextResponse.json(data ?? { ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}

export function clientIp(req: Request): string | null {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
}
