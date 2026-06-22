import { gzipSync } from "zlib";

const MIN_SIZE = 1024; // 1KB

export function compressResponse(
  body: string | Buffer,
): { body: Buffer; encoding: string } | null {
  const buf = typeof body === "string" ? Buffer.from(body) : body;
  if (buf.length <= MIN_SIZE) return null;
  const compressed = gzipSync(buf);
  return { body: compressed, encoding: "gzip" };
}