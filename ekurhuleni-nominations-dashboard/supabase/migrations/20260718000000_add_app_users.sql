CREATE TABLE IF NOT EXISTS app_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) NOT NULL UNIQUE,
  full_name VARCHAR(200) NOT NULL,
  contact_number VARCHAR(40),
  role VARCHAR(50) NOT NULL CHECK (role IN ('SuperAdmin', 'Admin', 'Viewer')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_login TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY app_users_select_all ON app_users FOR SELECT TO anon, authenticated USING (true);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

GRANT SELECT ON TABLE app_users TO anon, authenticated;
