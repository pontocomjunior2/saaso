export interface MetaLeadChange {
  field: string;
  value: {
    form_id: string;
    leadgen_id: string;
    page_id?: string;
    created_time?: number;
  };
}

export interface MetaLeadEntry {
  id?: string;
  changes: MetaLeadChange[];
}

export interface MetaLeadPayload {
  object?: string;
  entry: MetaLeadEntry[];
}
