CREATE TABLE IF NOT EXISTS customer_flags (
  customer_id integer NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamp NOT NULL DEFAULT now(),
  PRIMARY KEY (customer_id, user_id)
);

CREATE TABLE IF NOT EXISTS ekgx_leads (
  id serial PRIMARY KEY,
  business_name text NOT NULL,
  contact_name text NOT NULL,
  email text,
  phone text,
  submitted_at timestamp NOT NULL,
  status text NOT NULL DEFAULT 'not_contacted' CHECK (status IN ('contacted', 'not_contacted')),
  source text NOT NULL DEFAULT 'Facebook',
  notes text NOT NULL DEFAULT '',
  last_contact_at timestamp,
  last_contact_summary text,
  flagged boolean NOT NULL DEFAULT false,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ekgx_leads_identity_unique
  ON ekgx_leads (business_name, contact_name, submitted_at);

CREATE TABLE IF NOT EXISTS workspace_action_points (
  id serial PRIMARY KEY,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  customer_id integer NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  title text NOT NULL,
  details text NOT NULL DEFAULT '',
  due_date text,
  completed boolean NOT NULL DEFAULT false,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

INSERT INTO ekgx_leads (
  business_name,
  contact_name,
  email,
  phone,
  submitted_at,
  status,
  source,
  notes,
  last_contact_at,
  last_contact_summary,
  flagged
)
SELECT
  demo.business_name,
  demo.contact_name,
  demo.email,
  demo.phone,
  demo.submitted_at::timestamp,
  demo.status,
  'Facebook',
  demo.notes,
  demo.last_contact_at::timestamp,
  demo.last_contact_summary,
  demo.flagged
FROM (
  VALUES
    ('Harbor Fitness Studio', 'Janelle Price', 'janelle@harborfit.co', '(404) 555-0192', '2026-06-09T09:15:00-04:00', 'not_contacted', 'Interested in onboarding options for a growing studio footprint.', NULL, NULL, false),
    ('Northside Wellness', 'Marcus Hill', 'marcus@northsidewellness.com', '(678) 555-0114', '2026-06-09T10:40:00-04:00', 'contacted', 'Requested pricing details and a short implementation overview.', '2026-06-09T13:05:00-04:00', 'Called and confirmed interest in a 15-minute intro later this week.', true),
    ('Peak Recovery Lab', 'Sofia Bennett', 'sofia@peakrecoverylab.com', NULL, '2026-06-08T15:05:00-04:00', 'not_contacted', 'No phone listed. Best path is email outreach first.', NULL, NULL, false),
    ('Elevate Athletics', 'Chris Dalton', NULL, '(770) 555-0188', '2026-06-08T12:20:00-04:00', 'contacted', 'Looking for a fast rollout timeline before summer training programs begin.', '2026-06-08T16:30:00-04:00', 'Left a voicemail and sent a follow-up text.', false),
    ('Core Motion Performance', 'Avery Brooks', 'avery@coremotion.io', '(470) 555-0121', '2026-06-07T17:45:00-04:00', 'not_contacted', 'Mentioned comparing multiple vendors and wants a simple next-step plan.', NULL, NULL, true)
) AS demo(
  business_name,
  contact_name,
  email,
  phone,
  submitted_at,
  status,
  notes,
  last_contact_at,
  last_contact_summary,
  flagged
)
WHERE NOT EXISTS (
  SELECT 1
  FROM ekgx_leads existing
  WHERE existing.business_name = demo.business_name
    AND existing.contact_name = demo.contact_name
    AND existing.submitted_at = demo.submitted_at::timestamp
);
