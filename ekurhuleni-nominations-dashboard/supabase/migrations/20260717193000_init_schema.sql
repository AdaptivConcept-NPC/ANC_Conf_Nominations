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

GRANT USAGE ON SCHEMA public TO anon, authenticated;

GRANT SELECT ON TABLE zones TO anon, authenticated;
GRANT SELECT ON TABLE wards TO anon, authenticated;
GRANT SELECT ON TABLE candidates TO anon, authenticated;
GRANT SELECT ON TABLE candidate_aliases TO anon, authenticated;
GRANT SELECT ON TABLE nominations TO anon, authenticated;
