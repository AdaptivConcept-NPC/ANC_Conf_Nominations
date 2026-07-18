CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS zones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL UNIQUE,
  coordinator_name VARCHAR(150),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS wards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ward_number INTEGER NOT NULL UNIQUE,
  zone_id UUID REFERENCES zones(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS candidates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name VARCHAR(200) NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS candidate_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  candidate_id UUID NOT NULL UNIQUE REFERENCES candidates(id) ON DELETE CASCADE,
  display_name VARCHAR(200) NOT NULL,
  photo_url TEXT,
  short_bio TEXT,
  contact_phone VARCHAR(40),
  contact_email VARCHAR(200),
  zone_id UUID REFERENCES zones(id) ON DELETE SET NULL,
  ward_id UUID REFERENCES wards(id) ON DELETE SET NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS candidate_aliases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  alias_name VARCHAR(200) NOT NULL UNIQUE,
  source_note VARCHAR(200),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ingestion_batches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_filename VARCHAR(255) NOT NULL,
  source_checksum VARCHAR(128),
  processed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status VARCHAR(40) NOT NULL CHECK (status IN ('PENDING', 'SUCCESS', 'FAILED')),
  error_summary TEXT
);

CREATE TABLE IF NOT EXISTS workbook_sheet_rows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  batch_id UUID NOT NULL REFERENCES ingestion_batches(id) ON DELETE CASCADE,
  sheet_name VARCHAR(120) NOT NULL,
  row_index INTEGER NOT NULL CHECK (row_index >= 1),
  row_data JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_batch_sheet_row UNIQUE (batch_id, sheet_name, row_index)
);

CREATE TABLE IF NOT EXISTS nominations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ward_id UUID NOT NULL REFERENCES wards(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  vote_count INTEGER NOT NULL DEFAULT 0 CHECK (vote_count >= 0),
  nomination_date DATE,
  batch_id UUID REFERENCES ingestion_batches(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_ward_candidate_nomination UNIQUE (ward_id, candidate_id)
);

CREATE INDEX IF NOT EXISTS idx_nominations_ward_id ON nominations(ward_id);
CREATE INDEX IF NOT EXISTS idx_nominations_candidate_id ON nominations(candidate_id);
CREATE INDEX IF NOT EXISTS idx_wards_zone_id ON wards(zone_id);
CREATE INDEX IF NOT EXISTS idx_candidate_profiles_zone_id ON candidate_profiles(zone_id);
CREATE INDEX IF NOT EXISTS idx_candidate_profiles_ward_id ON candidate_profiles(ward_id);
CREATE INDEX IF NOT EXISTS idx_workbook_sheet_rows_batch_sheet ON workbook_sheet_rows(batch_id, sheet_name);

ALTER TABLE zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE wards ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidate_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidate_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE nominations ENABLE ROW LEVEL SECURITY;
ALTER TABLE workbook_sheet_rows ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY zones_select_all ON zones FOR SELECT TO anon, authenticated USING (true);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY wards_select_all ON wards FOR SELECT TO anon, authenticated USING (true);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY candidates_select_all ON candidates FOR SELECT TO anon, authenticated USING (true);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY candidate_profiles_select_all ON candidate_profiles FOR SELECT TO anon, authenticated USING (true);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY candidate_aliases_select_all ON candidate_aliases FOR SELECT TO anon, authenticated USING (true);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY nominations_select_all ON nominations FOR SELECT TO anon, authenticated USING (true);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY workbook_sheet_rows_select_all ON workbook_sheet_rows FOR SELECT TO anon, authenticated USING (true);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

GRANT USAGE ON SCHEMA public TO anon, authenticated;

GRANT SELECT ON TABLE zones TO anon, authenticated;
GRANT SELECT ON TABLE wards TO anon, authenticated;
GRANT SELECT ON TABLE candidates TO anon, authenticated;
GRANT SELECT ON TABLE candidate_profiles TO anon, authenticated;
GRANT SELECT ON TABLE candidate_aliases TO anon, authenticated;
GRANT SELECT ON TABLE nominations TO anon, authenticated;
GRANT SELECT ON TABLE workbook_sheet_rows TO anon, authenticated;
