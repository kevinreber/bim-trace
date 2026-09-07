import { describe, expect, it } from "vitest";
import type { BimElement } from "@/types";
import {
  readServerPayload,
  salvageTruncatedElements,
  snapWallEndpoints,
} from "./aiFloorPlanService";

const wall = (
  id: string,
  start: { x: number; z: number },
  end: { x: number; z: number },
  level = 0,
): BimElement => ({
  id,
  type: "wall",
  name: id,
  start,
  end,
  params: { height: 3, thickness: 0.2 },
  level,
});

/**
 * Models place wall corners within centimetres of each other but almost never
 * emit identical floats, which leaves rooms unenclosed. Snapping is the repair.
 */
describe("snapWallEndpoints", () => {
  it("snaps two near-coincident corners onto a shared point", () => {
    const a = wall("a", { x: 0, z: 0 }, { x: 5, z: 0 });
    const b = wall("b", { x: 5.03, z: 0.02 }, { x: 5, z: 4 });
    const moved = snapWallEndpoints([a, b]);

    expect(moved).toBeGreaterThan(0);
    expect(a.end.x).toBeCloseTo(b.start.x);
    expect(a.end.z).toBeCloseTo(b.start.z);
  });

  it("leaves corners that are already identical untouched", () => {
    const a = wall("a", { x: 0, z: 0 }, { x: 5, z: 0 });
    const b = wall("b", { x: 5, z: 0 }, { x: 5, z: 4 });
    expect(snapWallEndpoints([a, b])).toBe(0);
    expect(a.end).toEqual({ x: 5, z: 0 });
  });

  it("does not pull together endpoints further apart than the tolerance", () => {
    const a = wall("a", { x: 0, z: 0 }, { x: 5, z: 0 });
    const b = wall("b", { x: 5.4, z: 0 }, { x: 5.4, z: 4 });
    snapWallEndpoints([a, b]);
    expect(a.end.x).toBe(5);
    expect(b.start.x).toBe(5.4);
  });

  // Storeys are stacked in the same X/Z footprint, so a ground-floor corner sits
  // directly below the corner above it. Snapping across levels would weld them.
  it("does not snap endpoints that sit on different levels", () => {
    const ground = wall("g", { x: 0, z: 0 }, { x: 5, z: 0 }, 0);
    const upper = wall("u", { x: 5.02, z: 0 }, { x: 5, z: 4 }, 3);
    expect(snapWallEndpoints([ground, upper])).toBe(0);
    expect(upper.start.x).toBe(5.02);
  });

  it("collapses a cluster of three corners onto one point", () => {
    const a = wall("a", { x: 0, z: 0 }, { x: 5, z: 0 });
    const b = wall("b", { x: 5.02, z: 0 }, { x: 5, z: 4 });
    const c = wall("c", { x: 4.98, z: 0.01 }, { x: 9, z: 0 });
    snapWallEndpoints([a, b, c]);
    expect(a.end).toEqual(b.start);
    expect(b.start).toEqual(c.start);
  });
});

/**
 * A single runaway number can truncate an otherwise good building. Without
 * salvage the whole response is discarded and the user is told the AI returned
 * invalid JSON, losing dozens of correct elements.
 */
describe("salvageTruncatedElements", () => {
  const element = (id: string) =>
    `{"id":"${id}","type":"wall","start":{"x":0,"z":0},"end":{"x":5,"z":0}}`;

  it("recovers the complete leading elements from a response cut mid-element", () => {
    const text = `{"elements":[${element("w1")},${element("w2")},{"id":"w3","type":"wa`;
    const recovered = salvageTruncatedElements(text);
    expect(recovered).toHaveLength(2);
    expect((recovered?.[0] as { id: string }).id).toBe("w1");
    expect((recovered?.[1] as { id: string }).id).toBe("w2");
  });

  it("recovers every element when the array closed but the outer object did not", () => {
    const text = `{"elements":[${element("w1")},${element("w2")}]`;
    expect(salvageTruncatedElements(text)).toHaveLength(2);
  });

  it("recovers from a bare array rather than an object wrapper", () => {
    const text = `[${element("w1")},{"id":"w2","typ`;
    expect(salvageTruncatedElements(text)).toHaveLength(1);
  });

  // A brace inside a string must not move the nesting depth, or the walker
  // closes the element early and salvages malformed JSON.
  it("ignores braces and brackets inside string values", () => {
    const text = `{"elements":[{"id":"w1","name":"Kitchen } wall ]","type":"wall"},{"id":"w2`;
    const recovered = salvageTruncatedElements(text);
    expect(recovered).toHaveLength(1);
    expect((recovered?.[0] as { name: string }).name).toBe("Kitchen } wall ]");
  });

  it("handles an escaped quote inside a string value", () => {
    const text = `{"elements":[{"id":"w1","name":"the \\"big\\" wall","type":"wall"},{"id":"w2`;
    const recovered = salvageTruncatedElements(text);
    expect(recovered).toHaveLength(1);
    expect((recovered?.[0] as { name: string }).name).toBe('the "big" wall');
  });

  it("returns null when no element completed", () => {
    expect(salvageTruncatedElements(`{"elements":[{"id":"w1","ty`)).toBeNull();
  });

  it("returns null when there is no array at all", () => {
    expect(salvageTruncatedElements("I cannot help with that.")).toBeNull();
  });
});

/**
 * The endpoint opens its body with keep-alive whitespace and may report failure
 * under a 200, because the status is committed before the outcome is known.
 */
describe("readServerPayload", () => {
  it("reads a normal payload", () => {
    const payload = readServerPayload(
      '{"text":"[]","stopReason":"end_turn"}',
      200,
    );
    expect(payload.text).toBe("[]");
    expect(payload.stopReason).toBe("end_turn");
  });

  it("tolerates the leading heartbeat whitespace", () => {
    const payload = readServerPayload('   \n  {"text":"[]"}', 200);
    expect(payload.text).toBe("[]");
  });

  it("throws the server's message when the body reports an error under a 200", () => {
    expect(() =>
      readServerPayload('  {"error":"API key is invalid."}', 200),
    ).toThrow("API key is invalid.");
  });

  it("throws the server's message on an error status", () => {
    expect(() =>
      readServerPayload(
        '{"error":"Too many images: 6. The maximum is 5."}',
        400,
      ),
    ).toThrow("Too many images: 6");
  });

  // The regression that sent a user chasing "Unexpected token 'A'": a gateway
  // timeout page is not JSON, and reporting it as a syntax error hides the cause.
  it("explains a non-JSON body instead of surfacing a parse error", () => {
    expect(() =>
      readServerPayload("An error occurred with this application.", 500),
    ).toThrow(/did not return a valid response \(HTTP 500\)/);
    expect(() =>
      readServerPayload("An error occurred with this application.", 500),
    ).toThrow(/timed out/);
  });

  it("reports an empty body rather than an empty preview", () => {
    expect(() => readServerPayload("", 504)).toThrow(/\(empty response\)/);
  });

  it("rejects a success payload carrying no text", () => {
    expect(() => readServerPayload('{"stopReason":"end_turn"}', 200)).toThrow(
      /no generated text/,
    );
  });
});
