ALTER TABLE users ADD COLUMN IF NOT EXISTS login_pin text NOT NULL DEFAULT '2468';
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at timestamp;

CREATE TABLE IF NOT EXISTS auth_sessions (
  id serial PRIMARY KEY,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamp NOT NULL,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS collaborative_tasks (
  id serial PRIMARY KEY,
  title text NOT NULL,
  notes text,
  priority text NOT NULL DEFAULT 'medium',
  category text NOT NULL DEFAULT 'Follow-up',
  completed boolean NOT NULL DEFAULT false,
  created_by_user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  completed_by_user_id integer REFERENCES users(id) ON DELETE SET NULL,
  completed_at timestamp,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS task_assignments (
  task_id integer NOT NULL REFERENCES collaborative_tasks(id) ON DELETE CASCADE,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assignment_source text NOT NULL DEFAULT 'mention',
  created_at timestamp NOT NULL DEFAULT now(),
  PRIMARY KEY (task_id, user_id)
);

CREATE TABLE IF NOT EXISTS poster_posts (
  id serial PRIMARY KEY,
  post_type text NOT NULL DEFAULT 'announcement',
  title text NOT NULL,
  body text NOT NULL,
  include_all_users boolean NOT NULL DEFAULT false,
  created_by_user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS poster_post_targets (
  post_id integer NOT NULL REFERENCES poster_posts(id) ON DELETE CASCADE,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamp NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);
