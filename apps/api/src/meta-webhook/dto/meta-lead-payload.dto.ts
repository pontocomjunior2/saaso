export interface MetaLeadChangeValue {
  form_id: string;
  leadgen_id: string;
  campaign_id?: string;
  page_id?: string;
  ad_id?: string;
  adgroup_id?: string;
  created_time?: number;
}

export interface MetaLeadChange {
  field: string;
  value: MetaLeadChangeValue;
}

export interface MetaLeadEntry {
  id?: string;
  changes: MetaLeadChange[];
}

export interface MetaLeadPayload {
  object?: string;
  entry: MetaLeadEntry[];
}
