/**
 * Abstracción de almacenamiento de archivos.
 * MVP usa filesystem local; para migrar a S3 implementar la misma interfaz.
 */
export interface FileStorage {
  save(input: { buffer: Buffer; originalName: string; mimeType: string }): Promise<SavedFile>;
  read(relativePath: string): Promise<Buffer>;
  delete(relativePath: string): Promise<void>;
}

export type SavedFile = {
  /** Ruta relativa al root del storage. Se guarda en BD. */
  path: string;
  /** Tamaño en bytes. */
  size: number;
};

export { LocalFileStorage } from "./local";

import { LocalFileStorage } from "./local";

let _storage: FileStorage | null = null;

export function getStorage(): FileStorage {
  if (_storage) return _storage;
  const root = process.env.STORAGE_LOCAL_PATH ?? "./storage/uploads";
  _storage = new LocalFileStorage(root);
  return _storage;
}

/**
 * Valida que el buffer corresponda realmente a un PDF, comparando los
 * primeros 4 bytes con la firma "%PDF" (0x25 0x50 0x44 0x46).
 * Evita que un cliente engañe el header Content-Type.
 */
export function isPdfBuffer(buf: Buffer): boolean {
  if (buf.length < 4) return false;
  return buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46;
}
