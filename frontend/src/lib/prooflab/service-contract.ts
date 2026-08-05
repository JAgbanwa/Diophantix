/**
 * Public ProofLab API contract version.
 *
 * The route and production smoke test must import this value so deployments
 * cannot advance the API contract while monitoring remains pinned to an older
 * hard-coded version.
 */
export const PROOFLAB_SERVICE_VERSION = "prooflab-api-3" as const;
