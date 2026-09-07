import { describe, expect, it } from "vitest";
import {
  ALLOWED_FORMATS_LABEL,
  ALLOWED_MEDIA_TYPES,
  MAX_IMAGES,
  resolveApiKey,
  resolveModel,
  validateGenerateRequest,
} from "./aiConfig";

const image = (mediaType = "image/png") => ({ imageBase64: "abc", mediaType });

describe("resolveModel", () => {
  it("returns an allowed model unchanged", () => {
    expect(resolveModel("claude-sonnet-5")).toBe("claude-sonnet-5");
  });

  // The endpoint is public, so a caller must not be able to name an arbitrary
  // model and bill it to whichever key ends up paying.
  it("falls back to the default for a model outside the allowlist", () => {
    expect(resolveModel("claude-opus-4-20250514")).toBe("claude-opus-5");
    expect(resolveModel("../../etc/passwd")).toBe("claude-opus-5");
    expect(resolveModel(undefined)).toBe("claude-opus-5");
  });
});

/**
 * The shared-key fallback is a local convenience. In production it converts an
 * unauthenticated endpoint into a paid one anyone can drive, so it must not
 * apply there without an explicit opt-in.
 */
describe("resolveApiKey", () => {
  it("always prefers the caller's own key", () => {
    const env = { ANTHROPIC_API_KEY: "server-key", NODE_ENV: "production" };
    expect(resolveApiKey("user-key", env)).toBe("user-key");
  });

  it("uses the server key outside production", () => {
    expect(resolveApiKey(undefined, { ANTHROPIC_API_KEY: "server-key" })).toBe(
      "server-key",
    );
  });

  it("withholds the server key in production", () => {
    expect(
      resolveApiKey(undefined, {
        ANTHROPIC_API_KEY: "server-key",
        NODE_ENV: "production",
      }),
    ).toBeUndefined();
    expect(
      resolveApiKey(undefined, {
        ANTHROPIC_API_KEY: "server-key",
        VERCEL_ENV: "production",
      }),
    ).toBeUndefined();
  });

  it("honours an explicit production opt-in", () => {
    expect(
      resolveApiKey(undefined, {
        ANTHROPIC_API_KEY: "server-key",
        VERCEL_ENV: "production",
        ALLOW_SHARED_API_KEY: "true",
      }),
    ).toBe("server-key");
  });

  it("treats any value other than the literal \"true\" as opted out", () => {
    expect(
      resolveApiKey(undefined, {
        ANTHROPIC_API_KEY: "server-key",
        VERCEL_ENV: "production",
        ALLOW_SHARED_API_KEY: "1",
      }),
    ).toBeUndefined();
  });
});

/**
 * Both proxies read `body.images.length` immediately after validating, so a
 * body that slips through here throws a TypeError and surfaces as a 500.
 */
describe("validateGenerateRequest", () => {
  it("accepts a well-formed body", () => {
    expect(validateGenerateRequest({ images: [image()] })).toBeNull();
  });

  it("accepts every supported media type", () => {
    for (const type of ["image/png", "image/jpeg", "image/webp", "image/gif"]) {
      expect(validateGenerateRequest({ images: [image(type)] })).toBeNull();
    }
  });

  it("rejects a body that is not an object", () => {
    expect(validateGenerateRequest(null)).toMatch(/must be an object/);
    expect(validateGenerateRequest("images")).toMatch(/must be an object/);
  });

  it("rejects a missing or empty images array", () => {
    expect(validateGenerateRequest({})).toMatch(/non-empty `images` array/);
    expect(validateGenerateRequest({ images: [] })).toMatch(/non-empty/);
    expect(validateGenerateRequest({ images: "one" })).toMatch(/non-empty/);
  });

  it("rejects more images than the cap", () => {
    const images = Array.from({ length: MAX_IMAGES + 1 }, () => image());
    expect(validateGenerateRequest({ images })).toMatch(/Too many images: 6/);
  });

  it("accepts exactly the cap", () => {
    const images = Array.from({ length: MAX_IMAGES }, () => image());
    expect(validateGenerateRequest({ images })).toBeNull();
  });

  it("rejects an image without usable base64 data", () => {
    expect(validateGenerateRequest({ images: [{ mediaType: "image/png" }] })).toMatch(
      /non-empty `imageBase64`/,
    );
    expect(
      validateGenerateRequest({ images: [{ imageBase64: "", mediaType: "image/png" }] }),
    ).toMatch(/non-empty `imageBase64`/);
  });

  it("rejects an unsupported media type", () => {
    expect(validateGenerateRequest({ images: [image("application/pdf")] })).toMatch(
      /Unsupported mediaType/,
    );
    expect(validateGenerateRequest({ images: [image("text/html")] })).toMatch(
      /Unsupported mediaType/,
    );
  });

  it("rejects a non-object entry in the images array", () => {
    expect(validateGenerateRequest({ images: ["not-an-object"] })).toMatch(
      /must be an object with/,
    );
  });
});

/**
 * The upload UI derives its `accept` list, its hint text, and its runtime check
 * from these, so a drift here is a drift in what users are told.
 */
describe("ALLOWED_FORMATS_LABEL", () => {
  it("names every accepted media type", () => {
    expect(ALLOWED_FORMATS_LABEL).toBe("PNG, JPEG, WEBP, GIF");
  });

  it("stays derived from the media type list", () => {
    for (const type of ALLOWED_MEDIA_TYPES) {
      expect(ALLOWED_FORMATS_LABEL).toContain(
        type.replace("image/", "").toUpperCase(),
      );
    }
  });

  // HEIC is the iPhone default and is not supported, so it must not slip
  // through as an `image/*` type the way it did before.
  it("does not claim support for HEIC", () => {
    expect(validateGenerateRequest({
      images: [{ imageBase64: "abc", mediaType: "image/heic" }],
    })).toMatch(/Unsupported mediaType/);
  });
});
