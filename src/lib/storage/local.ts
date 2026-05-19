import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type { FileStorage, SavedFile } from "./index";

export class LocalFileStorage implements FileStorage {
  constructor(private readonly root: string) {}

  async save({ buffer, originalName }: { buffer: Buffer; originalName: string; mimeType: string }): Promise<SavedFile> {
    const now = new Date();
    const subdir = path.join(String(now.getFullYear()), String(now.getMonth() + 1).padStart(2, "0"));
    const ext = path.extname(originalName).toLowerCase() || ".pdf";
    const id = crypto.randomUUID();
    const relative = path.join(subdir, `${id}${ext}`);
    const absolute = path.join(this.root, relative);

    await fs.mkdir(path.dirname(absolute), { recursive: true });
    await fs.writeFile(absolute, buffer);

    return { path: relative.replaceAll("\\", "/"), size: buffer.byteLength };
  }

  async read(relativePath: string): Promise<Buffer> {
    const safe = this.resolveSafe(relativePath);
    return fs.readFile(safe);
  }

  async delete(relativePath: string): Promise<void> {
    const safe = this.resolveSafe(relativePath);
    await fs.unlink(safe).catch(() => undefined);
  }

  /** Bloquea path traversal (../) y rutas absolutas. */
  private resolveSafe(relativePath: string): string {
    const absolute = path.resolve(this.root, relativePath);
    const root = path.resolve(this.root);
    if (!absolute.startsWith(root + path.sep) && absolute !== root) {
      throw new Error("Ruta de archivo fuera del storage");
    }
    return absolute;
  }
}
