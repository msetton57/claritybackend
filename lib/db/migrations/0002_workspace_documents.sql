CREATE TABLE IF NOT EXISTS workspace_folders (
  id serial PRIMARY KEY,
  name text NOT NULL,
  parent_id integer,
  created_by text NOT NULL,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workspace_documents (
  id serial PRIMARY KEY,
  folder_id integer REFERENCES workspace_folders(id) ON DELETE SET NULL,
  title text NOT NULL,
  category text NOT NULL DEFAULT 'General',
  description text,
  file_name text NOT NULL,
  mime_type text NOT NULL,
  size_bytes integer NOT NULL,
  checksum text NOT NULL,
  content_base64 text NOT NULL,
  uploaded_by text NOT NULL,
  created_at timestamp NOT NULL DEFAULT now()
);
