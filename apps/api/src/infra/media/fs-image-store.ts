import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { ImageStore } from '../../app/ports/image-store.js';

/**
 * Writes covers to the local media directory (docs/02) — the same dir nginx serves
 * at `/covers/` and the backup role syncs to S3. Failures are swallowed to null so a
 * flaky cover fetch never fails an otherwise-good import.
 */
export class FsImageStore implements ImageStore {
  constructor(private readonly mediaDir: string) {}

  async saveFromUrl(sourceUrl: string, key: string): Promise<string | null> {
    try {
      const res = await fetch(sourceUrl);
      if (!res.ok) return null;
      const bytes = Buffer.from(await res.arrayBuffer());
      if (bytes.length === 0) return null;
      const relativePath = `${key}.jpg`;
      await mkdir(this.mediaDir, { recursive: true });
      await writeFile(path.join(this.mediaDir, relativePath), bytes);
      return relativePath;
    } catch {
      // Cover is best-effort — import continues coverless (docs/02).
      return null;
    }
  }
}
