# Election Nomination Management System - Detailed Requirements Guide

Version: 1.0  
Date: 2026-07-17  
Status: Draft for implementation

## 1. Purpose

This document enhances the existing requirements from the architecture blueprint by adding:
- explicit functional and non-functional requirements
- data quality and canonicalization rules derived from the nomination workbook
- implementation-ready schema, API, UI, and test acceptance criteria
- direct mapping to the current repository structure

## 2. Source Inputs Reviewed

Primary source documents:
- `System Architecture Blueprint & Database Schema Setup V2.docx`
- `NOM2026 PR and Councillor Nominations.xlsx`

Repository context reviewed:
- `ekurhuleni-nominations-dashboard/frontend/src/App.tsx`
- `ekurhuleni-nominations-dashboard/frontend/src/components/Leaderboard.tsx`
- `ekurhuleni-nominations-dashboard/frontend/src/lib/supabaseClient.ts`
- `ekurhuleni-nominations-dashboard/data-pipeline/seed_data.py`
- `ekurhuleni-nominations-dashboard/supabase/config.toml`
- `ekurhuleni-nominations-dashboard/supabase/seed.sql`

## 3. Product Scope

Build a nomination analytics platform for ANC Ekurhuleni BGM 2026 that:
- ingests nomination data by ward and zone
- normalizes candidate identities and data quality anomalies
- stores normalized records in PostgreSQL (Supabase/Neon compatible)
- exposes read and optional write flows via serverless-friendly patterns
- serves a fast dashboard on Netlify/Vite React

Out of scope (v1):
- advanced campaign workflow management
- full election result adjudication
- external public publishing with anonymous writes

## 4. Current Data Reality (Workbook-Derived)

Workbook sheets identified:
- BRANCH NOMI (raw nomination entries by ward)
- TOTAL IN ZONES (aggregated candidate totals by zonal columns)
- PIE PER ZONE (chart support sheet)
- OVERAL PIE (chart support sheet)
- OVERAL GRAPH (summary marker)

Observed data characteristics:
- Mixed casing and spelling variants in candidate names
- Typo variants exist (for example, XHAKAZA/XHAKZA)
- Some ward headings contain malformed or partial metadata strings
- Empty cells are common and must not be treated as zero votes unless explicitly modeled

Top totals observed in `TOTAL IN ZONES` (as captured in workbook):
- DOCTOR XHAKAZA: 41
- Jean Sethato: 36
- Nomadlozi Nkosi: 36
- Jongizwe Dlabathi: 31
- Phelisa Nkunjana: 23
- Dora Mlambo: 19

## 5. Architectural Decision

Default architecture for v1:
- Frontend: React + TypeScript + Vite (already scaffolded)
- Data store: Supabase Postgres (primary), Neon-compatible schema
- API pattern: Supabase Data API for reads, serverless function boundary for privileged writes
- Hosting: Netlify static deployment

Deployment modes:
- Mode A (recommended): live DB-backed dashboard (Supabase/Neon)
- Mode B (fallback): static JSON bundle generated at build time for read-only operation

## 6. Domain Model

Core entities:
- Zone: logical grouping of wards with zonal coordinator label
- Ward: numbered administrative unit, mapped to a zone (each Ward = one Branch)
- Candidate: unique person identity (canonical full name)
- Candidate profile: editable administrative record for candidate metadata used by the CMS portal
- Nomination: vote tally for candidate in a ward for a nomination event
- Ingestion batch: uploaded or processed dataset run metadata
- Name alias: raw source variant mapped to canonical candidate

**Authoritative voting rules** (Ward/Branch = 6 votes max, max 1 vote per candidate per ward, candidate score = SUM across all wards) are documented in full in [`docs/voting-rules.md`](voting-rules.md). That document also describes the full-replace-per-ward write semantics, validation strictness levels, the bulk-upload Excel template format, the manual ballot capture form, and a data quality notice regarding the initial transfer data.

## 7. Database Requirements

### 7.1 Mandatory Tables

1. `zones`
2. `wards`
3. `candidates`
4. `candidate_profiles`
5. `candidate_aliases`
6. `nominations`
7. `ingestion_batches`

### 7.1.1 Administrative Tables and Semantics

- `candidate_profiles`: editable CMS-facing record for candidate biography, image, contact metadata, ward/zone attribution, and status flags.
- `zones`: reference table for dropdowns and zonal grouping.
- `wards`: reference table for dropdowns and ward selection.
- `candidates`: canonical candidate identity table used by nominations and profiles.
- `candidate_aliases`: workbook/source-name normalization table.
- `nominations`: fact table containing the vote counts.
- `ingestion_batches`: audit table for workbook imports and transfer runs.

Recommended candidate profile fields for v1:
- `candidate_id` (FK to `candidates`)
- `display_name`
- `photo_url`
- `short_bio`
- `contact_phone`
- `contact_email`
- `zone_id` (optional FK to `zones`)
- `ward_id` (optional FK to `wards`)
- `status` (`draft`, `active`, `archived`)
- `notes`

### 7.2 SQL Baseline (Implementation-Ready)

```sql
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
  status VARCHAR(40) NOT NULL CHECK (status IN ('PENDING','SUCCESS','FAILED')),
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
```

### 7.3 Canonicalization Rules

- Trim leading/trailing whitespace.
- Convert consecutive internal spaces to a single space.
- Compare alias matching case-insensitively.
- Preserve title prefixes if part of canonical identity (for example, DOCTOR).
- Maintain a reviewed alias map for known variants (for example, DOCTOR XHAKZA -> DOCTOR XHAKAZA).

## 8. Functional Requirements

### 8.1 Data Ingestion

- FR-ING-01: System shall ingest raw workbook data from configured file path.
- FR-ING-02: System shall parse ward, zone, candidate, and tally rows from BRANCH NOMI and TOTAL IN ZONES.
- FR-ING-03: System shall normalize candidate names using alias rules before DB insert.
- FR-ING-04: System shall reject malformed rows into an error report without stopping valid row ingestion.
- FR-ING-05: System shall persist ingestion run metadata in `ingestion_batches`.

Acceptance criteria:
- Given a workbook with known aliases, canonical candidate counts are merged correctly.
- Failed rows are logged with row identifier and reason.
- Successful run has status SUCCESS and non-null processed timestamp.

### 8.2 Dashboard and Analytics

- FR-DASH-01: Frontend builds as static assets for Netlify deployment.
- FR-DASH-02: Dashboard supports global filters for Zone and Ward Number.
- FR-DASH-03: Leaderboard displays candidate vote totals sorted descending.
- FR-DASH-04: Charts update within 300 ms for filter changes on typical dataset sizes.
- FR-DASH-05: System displays empty-state messaging if no records match filters.

Acceptance criteria:
- Filter interactions redraw all dependent charts.
- Leaderboard values equal DB aggregate query results for same filters.

### 8.3 Data Management (Optional Write Mode)

- FR-CRUD-01: Authorized users can create/update nomination records through secure endpoint.
- FR-CRUD-02: Write operations require authenticated context and server-side validation.
- FR-CRUD-03: All writes are auditable by timestamp and actor metadata.

Acceptance criteria:
- Unauthorized write requests are denied.
- Duplicate ward-candidate combinations are blocked by constraint and surfaced clearly.

### 8.4 Exports and Reporting

- FR-REP-01: Users can export filtered leaderboard data to CSV.
- FR-REP-02: Export files include zone, ward, candidate, and vote_count columns.
- FR-REP-03: Exported totals must match visible dashboard totals.

### 8.5 Admin CMS Portal

- FR-ADM-01: Authorized users can create, edit, and archive candidate profiles from a web-based CMS portal.
- FR-ADM-02: Authorized users can create, edit, and deactivate reference-table rows for zones and wards used by dropdowns.
- FR-ADM-03: Authorized users can maintain candidate canonical records and alias mappings from the CMS portal.
- FR-ADM-04: The CMS portal shall validate unique reference keys before saving, including zone name, ward number, candidate full name, and alias text.
- FR-ADM-05: The CMS portal shall surface import status, seed status, and latest ingestion batch metadata.
- FR-ADM-06: The CMS portal shall support creating draft candidate profiles without exposing service-role credentials to the browser.

Acceptance criteria:
- Candidate profile CRUD works for authorized users only.
- Reference-table edits are reflected immediately in dropdowns after refresh.
- Duplicate zone, ward, candidate, or alias entries are blocked with a clear validation message.
- CMS users can see a transfer/report panel showing imported counts and last successful batch.

## 9. Non-Functional Requirements

- NFR-PERF-01: P95 dashboard filter response <= 300 ms for <= 10k nomination rows.
- NFR-PERF-02: Initial dashboard load <= 2.5 s on broadband from cached edge region.
- NFR-SEC-01: Service-role keys are never shipped to browser bundles.
- NFR-SEC-02: Environment secrets stored only in Netlify/Supabase secure vars.
- NFR-REL-01: Ingestion pipeline is idempotent per batch checksum.
- NFR-REL-02: DB constraints prevent negative votes and duplicate ward-candidate rows.
- NFR-OBS-01: Errors from ingestion and query failures are logged with correlation id.

## 10. API and Query Requirements

Read endpoints (or equivalent Supabase RPC/views):
- GET `/api/leaderboard?zone={z}&ward={w}`
- GET `/api/zones`
- GET `/api/wards?zone={z}`
- GET `/api/summary`

Write endpoints (optional mode):
- POST `/api/nominations`
- PUT `/api/nominations/{id}`
- POST `/api/admin/candidate-profiles`
- PUT `/api/admin/candidate-profiles/{id}`
- POST `/api/admin/reference-rows`
- PUT `/api/admin/reference-rows/{id}`

Query requirements:
- Aggregate by candidate and order by vote_count desc.
- Support optional zone and ward filters.
- Use indexed join path: nominations -> wards -> zones and nominations -> candidates.
- Provide CMS read queries for candidate profiles, alias mappings, zones, wards, and batch status.

## 11. Frontend Requirements

Pages/components expected:
- Dashboard shell with global filter bar
- Candidate leaderboard chart
- Zone distribution chart
- Overall summary card set
- Error and loading state components
- Admin CMS portal with candidate profile editor, reference-table editor, and transfer report panel

Implementation notes for current codebase:
- Replace template content in `frontend/src/App.tsx` with dashboard shell.
- Integrate `frontend/src/components/Leaderboard.tsx` into App and add typed DTO mapping.
- Add robust env validation in `frontend/src/lib/supabaseClient.ts`.
- Add an authenticated admin route or tab that reuses the shared Supabase client for read-only previews and a secured write path for CMS changes.

## 12. Security and Access Control

- Use Supabase RLS for nomination tables in production.
- Restrict write operations to authenticated role(s).
- Keep anon key in browser, keep service role key only in trusted serverless contexts.
- Sanitize all filter/query parameters to allow-list values where possible.

## 13. Testing Requirements

Minimum test suite:
- Unit: canonicalization and alias mapping utilities
- Unit: aggregation helpers for chart data
- Integration: ingestion script to DB write path with fixture workbook
- Integration: filtered leaderboard query correctness
- E2E: zone/ward filters update visible charts and totals

Data quality tests:
- Alias variants collapse to canonical candidate.
- Missing or malformed ward labels produce warnings, not silent failures.
- Total vote sums per filtered view match query output exactly.

## 14. Delivery Plan

Phase 1: Foundation
- Implement schema in `supabase/seed.sql` (or migrations)
- Implement robust ingestion in `data-pipeline/seed_data.py`
- Seed and validate canonical candidate map

Phase 2: Dashboard
- Build filter state and chart modules in frontend
- Connect Supabase read queries and loading/error states
- Add CSV export capability

Phase 2b: Admin CMS Portal
- Build candidate profile editor and reference-table maintenance screens
- Add validation for candidate, zone, ward, and alias uniqueness
- Show transfer status and import summary to administrators

Phase 3: Hardening
- Add optional secured write path via serverless function
- Add tests and CI checks
- Configure Netlify environment variables and deployment pipeline

## 15. Open Items and Assumptions

Open items:
- Confirm authoritative canonical spellings for all candidate aliases.
- Confirm whether nomination_date must be captured for every ward entry.
- Confirm whether write mode is required in v1 or deferred.

Assumptions:
- Workbook remains primary source for initial data migration.
- Supabase is preferred over static-only mode unless cost or policy constraints require fallback.
- Dashboard users are internal and authenticated for non-public operations.

## 16. Definition of Done (v1)

v1 is complete when:
- schema and ingestion pipeline are implemented and validated on real workbook data
- dashboard renders leaderboard and filterable analytics from live DB
- alias normalization resolves known typos consistently
- core performance/security requirements pass verification
- deployment to Netlify with environment-secure configuration is successful

## 17. Data Transfer Report

Status: hosted Supabase project initialized and reachable from the app.

Completed on hosted Supabase (`zilabbyqoaivtgqdeijd`):
- schema applied successfully from the implementation SQL baseline
- live API access confirmed for `public.nominations`
- seed data loaded for the workbook-derived reference set

Current transferred dataset snapshot:
- zones: 5
- wards: 11
- candidates: 6
- candidate_aliases: 3
- nominations: 14

Workbook-derived canonicalization rules used in the transfer:
- `DOCTOR XHAKZA` -> `DOCTOR XHAKAZA`
- `Jean sethato` -> `Jean Sethato`
- `Nomadlozi nkosi` -> `Nomadlozi Nkosi`
- `jongizizwe Dlabathi` -> `Jongizwe Dlabathi`

Open follow-up for the admin CMS sprint:
- capture candidate profile metadata beyond vote totals
- extend the transfer pipeline to replay the full workbook extraction flow into hosted Supabase
- add a privileged write path for profile/reference-table updates
