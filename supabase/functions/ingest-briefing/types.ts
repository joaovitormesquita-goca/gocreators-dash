export type IngestBriefingPayload = {
  brand_id: number;
  source_doc_id?: string | null;
  briefings: IncomingBriefing[];
};

export type IncomingBriefing = {
  briefing_number: number;
  semana?: number | null;
  mes?: number | null;
  ano?: number | null;
  ref_url?: string | null;
  take_inicial?: string | null;
  fala_inicial?: string | null;
  conceito?: string | null;
  produtos?: string[] | null;
};

export type IngestError = {
  briefing_number: number | null;
  reason: string;
};

export type IngestResponse = {
  received: number;
  inserted: number;
  updated: number;
  errors: IngestError[];
};
