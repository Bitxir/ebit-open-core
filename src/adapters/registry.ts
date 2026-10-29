import type { Adapter, AdapterInput } from "./types";
import { imageAdapter } from "./image";
import { documentAdapter } from "./document";
import { csvAdapter } from "./csv";
import { geojsonAdapter } from "./geojson";
import { jsonAdapter } from "./json";
import { darwinCoreAdapter } from "./darwin-core";
import { sensorTimeseriesAdapter } from "./sensor-timeseries";

/**
 * Adapter registry. Adding a format = add one adapter module and register it here.
 * Order matters: the first adapter whose detect() matches handles the input,
 * so more specific adapters (GeoJSON) come before general ones (JSON).
 * Docs pages for adapters are generated from these descriptors.
 */
const adapters: Adapter[] = [];

export function registerAdapter(adapter: Adapter): void {
  if (adapters.some((a) => a.descriptor.id === adapter.descriptor.id)) {
    throw new Error(`Adapter "${adapter.descriptor.id}" is already registered`);
  }
  adapters.push(adapter);
}

export function listAdapters(): readonly Adapter[] {
  return adapters;
}

export function findAdapter(input: AdapterInput): Adapter | undefined {
  return adapters.find((a) => a.detect(input));
}

/** File types accepted by at least one adapter, for upload pickers and server checks. */
export function acceptedExtensions(): string[] {
  return [...new Set(adapters.flatMap((a) => a.descriptor.formats.flatMap((f) => f.extensions)))];
}

[imageAdapter, documentAdapter, darwinCoreAdapter, sensorTimeseriesAdapter, csvAdapter, geojsonAdapter, jsonAdapter].forEach(registerAdapter);
