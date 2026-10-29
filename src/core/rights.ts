/**
 * Rights states for any asset, observation or dataset.
 * Public availability never implies permission: the default is "unknown".
 */
export const RIGHTS_STATES = [
  "unknown",
  "under_review",
  "permitted_processing",
  "permitted_redistribution",
  "restricted",
] as const;
export type RightsState = (typeof RIGHTS_STATES)[number];

const TRANSITIONS: Record<RightsState, readonly RightsState[]> = {
  unknown: ["under_review", "restricted"],
  under_review: ["permitted_processing", "permitted_redistribution", "restricted", "unknown"],
  permitted_processing: ["permitted_redistribution", "under_review", "restricted"],
  permitted_redistribution: ["under_review", "restricted"],
  restricted: ["under_review"],
};

export function canTransition(from: RightsState, to: RightsState): boolean {
  return TRANSITIONS[from].includes(to);
}

/** Only redistribution permission allows publishing or exporting outside the organisation. */
export function canPublish(state: RightsState): boolean {
  return state === "permitted_redistribution";
}

/** Processing (including AI) needs explicit permission. */
export function canProcess(state: RightsState): boolean {
  return state === "permitted_processing" || state === "permitted_redistribution";
}

export const RIGHTS_LABELS: Record<RightsState, string> = {
  unknown: "Unknown",
  under_review: "Under review",
  permitted_processing: "Permitted for processing",
  permitted_redistribution: "Permitted for redistribution",
  restricted: "Restricted",
};
