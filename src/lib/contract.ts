// Shared contract from mousavitax-platform (packages/shared-contracts/orchestrator.schema.json).
export type OrchestrateStatus = "SUCCESS" | "INSUFFICIENT_DATA" | "CLARIFICATION_REQUIRED" | "ERROR";

export type Citation = {
  source_type: "memory" | "circular";
  source_id: string;
  title: string;
  url: string;
};

export type OrchestrateResponse = {
  status: OrchestrateStatus;
  answer: string;
  citations: Citation[];
  actions: { type: string; label: string }[];
  trace_id: string;
};
