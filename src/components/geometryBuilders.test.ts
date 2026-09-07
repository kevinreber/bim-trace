import { describe, expect, it } from "vitest";
import type { BimElement } from "@/types";
import { computeWallOpenings } from "./geometryBuilders";

/**
 * `computeWallOpenings` decides which doors and windows cut a hole in a wall.
 * Both of its guards were tuned against the eval corpus and both have a failure
 * mode that is invisible in the viewport: too strict and a real door renders
 * embedded in solid wall, too loose and ExtrudeGeometry receives a hole lying
 * outside the wall outline.
 */

const wall = (
  id: string,
  start: { x: number; z: number },
  end: { x: number; z: number },
  thickness = 0.2,
): BimElement => ({
  id,
  type: "wall",
  name: id,
  start,
  end,
  params: { height: 3, thickness },
  level: 0,
});

const door = (
  id: string,
  at: { x: number; z: number },
  hostWallId: string,
  width = 0.9,
): BimElement => ({
  id,
  type: "door",
  name: id,
  start: at,
  end: at,
  params: { width, height: 2.1 },
  level: 0,
  hostWallId,
});

// A 6m wall running east along z = 0.
const HOST = wall("w1", { x: 0, z: 0 }, { x: 6, z: 0 });

describe("computeWallOpenings", () => {
  it("places a door at the centre of its host wall", () => {
    const openings = computeWallOpenings(HOST, [
      HOST,
      door("d1", { x: 3, z: 0 }, "w1"),
    ]);
    expect(openings).toHaveLength(1);
    expect(openings[0].centerAlongWall).toBeCloseTo(3);
    expect(openings[0].width).toBeCloseTo(0.9);
  });

  it("ignores openings hosted on a different wall", () => {
    const openings = computeWallOpenings(HOST, [
      HOST,
      door("d1", { x: 3, z: 0 }, "other-wall"),
    ]);
    expect(openings).toHaveLength(0);
  });

  // The bug this guards: openings were matched by hostWallId alone, so a door
  // sitting metres away still cut a hole in the wall it happened to name.
  it("discards an opening that names the wall but sits off its centerline", () => {
    const openings = computeWallOpenings(HOST, [
      HOST,
      door("d1", { x: 3, z: 4 }, "w1"),
    ]);
    expect(openings).toHaveLength(0);
  });

  it("keeps an opening within the wall thickness of the centerline", () => {
    const openings = computeWallOpenings(HOST, [
      HOST,
      door("d1", { x: 3, z: 0.15 }, "w1"),
    ]);
    expect(openings).toHaveLength(1);
  });

  // The regression this guards: a door hard against a corner overhangs the
  // centerline by a few centimetres. Rejecting it left the door mesh drawn
  // against a wall with no hole in it.
  it("clamps a door that overhangs the wall start by a few centimetres", () => {
    // Centre at 0.37 with width 0.9 spans -0.08..0.82 — an 8cm overhang.
    const openings = computeWallOpenings(HOST, [
      HOST,
      door("d1", { x: 0.37, z: 0 }, "w1"),
    ]);
    expect(openings).toHaveLength(1);
    expect(openings[0].centerAlongWall).toBeCloseTo(0.45);
  });

  it("clamps a door that overhangs the wall end by a few centimetres", () => {
    const openings = computeWallOpenings(HOST, [
      HOST,
      door("d1", { x: 5.7, z: 0 }, "w1"),
    ]);
    expect(openings).toHaveLength(1);
    expect(openings[0].centerAlongWall).toBeCloseTo(5.55);
  });

  it("discards an opening that misses the wall along its axis", () => {
    const openings = computeWallOpenings(HOST, [
      HOST,
      door("d1", { x: 9, z: 0 }, "w1"),
    ]);
    expect(openings).toHaveLength(0);
  });

  it("discards an opening wider than the wall it is hosted on", () => {
    const stub = wall("w2", { x: 0, z: 0 }, { x: 0.5, z: 0 });
    const openings = computeWallOpenings(stub, [
      stub,
      door("d1", { x: 0.25, z: 0 }, "w2", 0.9),
    ]);
    expect(openings).toHaveLength(0);
  });

  it("returns nothing for a degenerate wall", () => {
    const degenerate = wall("w3", { x: 1, z: 1 }, { x: 1, z: 1 });
    const openings = computeWallOpenings(degenerate, [
      degenerate,
      door("d1", { x: 1, z: 1 }, "w3"),
    ]);
    expect(openings).toHaveLength(0);
  });

  it("gives a window its sill height as the bottom offset", () => {
    const win: BimElement = {
      id: "win1",
      type: "window",
      name: "win1",
      start: { x: 3, z: 0 },
      end: { x: 3, z: 0 },
      params: { width: 1.2, height: 1.4, sillHeight: 0.9 },
      level: 0,
      hostWallId: "w1",
    };
    const openings = computeWallOpenings(HOST, [HOST, win]);
    expect(openings).toHaveLength(1);
    expect(openings[0].bottomOffset).toBeCloseTo(0.9);
  });

  it("gives a door a zero bottom offset", () => {
    const openings = computeWallOpenings(HOST, [
      HOST,
      door("d1", { x: 3, z: 0 }, "w1"),
    ]);
    expect(openings[0].bottomOffset).toBe(0);
  });
});
