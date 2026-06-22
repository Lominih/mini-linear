import { describe, it, expect } from "vitest";
import { compressResponse } from "@/lib/compression";

describe("compression", () => {
  it("returns null for small body", () => {
    const small = "Hello, World!";
    expect(compressResponse(small)).toBeNull();
  });

  it("returns null for body at exactly 1024 bytes", () => {
    const exact = "x".repeat(1024);
    expect(compressResponse(exact)).toBeNull();
  });

  it("returns gzip for large body", () => {
    const large = "a".repeat(2048);
    const result = compressResponse(large);
    expect(result).not.toBeNull();
    expect(result!.body).toBeInstanceOf(Buffer);
    expect(result!.encoding).toBe("gzip");
  });

  it("handles Buffer input", () => {
    const buf = Buffer.from("a".repeat(2048));
    const result = compressResponse(buf);
    expect(result).not.toBeNull();
    expect(result!.encoding).toBe("gzip");
  });

  it("returns correct encoding", () => {
    const large = "x".repeat(4096);
    const result = compressResponse(large);
    expect(result!.encoding).toBe("gzip");
    // Verify it is valid gzip (magic bytes: 0x1f 0x8b)
    expect(result!.body[0]).toBe(0x1f);
    expect(result!.body[1]).toBe(0x8b);
  });
});
