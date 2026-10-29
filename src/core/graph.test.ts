import { describe, expect, it } from "vitest";
import { checkLink, parseBBox, relTypesFor } from "./graph";

describe("identity graph links", () => {
  it("rejects linking an item to itself", () => {
    expect(checkLink("object", "a", "related_to", "object", "a").ok).toBe(false);
  });
  it("allows a photo to depict an object but not an object to depict a photo", () => {
    expect(checkLink("asset", "a", "depicts", "object", "b").ok).toBe(true);
    expect(checkLink("object", "b", "depicts", "asset", "a").ok).toBe(false);
  });
  it("offers only valid relationship types between two kinds", () => {
    expect(relTypesFor("asset", "observation")).toEqual(["depicts", "evidence_for", "related_to"]);
    expect(relTypesFor("dataset", "object")).toEqual(["related_to"]);
  });
});

describe("bounding box", () => {
  it("parses GeoJSON order and rejects bad boxes", () => {
    expect(parseBBox("77.5,12.9,77.7,13.1")).toEqual({ minLng: 77.5, minLat: 12.9, maxLng: 77.7, maxLat: 13.1 });
    expect(parseBBox("10,10,5,20")).toBeNull();
    expect(parseBBox("0,95,1,96")).toBeNull();
    expect(parseBBox("1,2,3")).toBeNull();
  });
});
