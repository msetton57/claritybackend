CREATE TABLE IF NOT EXISTS ekgx_lead_activities (
  id serial PRIMARY KEY,
  lead_id integer NOT NULL REFERENCES ekgx_leads(id) ON DELETE CASCADE,
  contact_method text NOT NULL,
  result text NOT NULL,
  summary text NOT NULL,
  created_by text NOT NULL DEFAULT 'Sales Team',
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ekgx_lead_activities_lead_id_created_at_idx
  ON ekgx_lead_activities (lead_id, created_at DESC);
