CREATE TABLE IF NOT EXISTS users (
  id serial PRIMARY KEY,
  sales_rep_id integer UNIQUE REFERENCES sales_reps(id) ON DELETE SET NULL,
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  phone text,
  title text NOT NULL DEFAULT 'Sales Representative',
  role text NOT NULL DEFAULT 'sales_rep' CHECK (role IN ('admin', 'sales_rep')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  last_active_at timestamp,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

INSERT INTO users (name, email, phone, title, role, status, last_active_at)
VALUES (
  'Morris Setton',
  'morris.setton@clarity.local',
  '(212) 555-0100',
  'Main Administrator',
  'admin',
  'active',
  now()
)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  title = EXCLUDED.title,
  role = EXCLUDED.role,
  status = EXCLUDED.status,
  updated_at = now();

INSERT INTO sales_reps (name, email)
SELECT demo.name, demo.email
FROM (
  VALUES
    ('Ava Rodriguez', 'ava.rodriguez@clarity.local'),
    ('Daniel Kim', 'daniel.kim@clarity.local'),
    ('Sofia Patel', 'sofia.patel@clarity.local'),
    ('Marcus Johnson', 'marcus.johnson@clarity.local')
) AS demo(name, email)
WHERE NOT EXISTS (
  SELECT 1 FROM sales_reps WHERE lower(sales_reps.email) = lower(demo.email)
);

INSERT INTO users (sales_rep_id, name, email, phone, title, role, status, last_active_at)
SELECT
  sales_reps.id,
  sales_reps.name,
  sales_reps.email,
  CASE sales_reps.email
    WHEN 'ava.rodriguez@clarity.local' THEN '(646) 555-0112'
    WHEN 'daniel.kim@clarity.local' THEN '(917) 555-0138'
    WHEN 'sofia.patel@clarity.local' THEN '(718) 555-0164'
    WHEN 'marcus.johnson@clarity.local' THEN '(347) 555-0191'
    ELSE NULL
  END,
  'Sales Representative',
  'sales_rep',
  'active',
  CASE
    WHEN sales_reps.email LIKE '%@clarity.local' THEN now() - ((sales_reps.id % 5) || ' hours')::interval
    ELSE NULL
  END
FROM sales_reps
WHERE sales_reps.email IS NOT NULL
ON CONFLICT (email) DO UPDATE SET
  sales_rep_id = EXCLUDED.sales_rep_id,
  name = EXCLUDED.name,
  updated_at = now();
