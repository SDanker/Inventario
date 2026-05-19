import { NextResponse } from "next/server";
import { getSessionUser } from "@/auth";
import { getDocumentForDownload } from "@/lib/services/documents.service";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const { id } = await params;
  try {
    const result = await getDocumentForDownload(user, id);
    if (!result) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return new NextResponse(new Uint8Array(result.buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(result.doc.fileName)}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    const status = (err as Error).name === "ForbiddenError" ? 403 : 500;
    return NextResponse.json({ error: (err as Error).message }, { status });
  }
}
