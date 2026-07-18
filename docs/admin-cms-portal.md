# Admin CMS Portal Plan

Version: 0.1
Date: 2026-07-18
Status: Draft for implementation

## 1. Purpose

Provide an internal web-based CMS for maintaining:
- candidate profiles
- canonical candidate records
- alias mappings for workbook/source-name normalization
- reference tables used by dropdowns, especially zones and wards
- import/transfer status for the nomination dataset

## 2. Primary User Flows

### 2.1 Candidate Profile Capture

Administrators can:
- create a candidate profile linked to a canonical candidate
- edit display name, bio, photo, contact fields, and status
- associate a profile with a zone and optionally a ward
- archive profiles without deleting the underlying nomination history

### 2.2 Reference Table Maintenance

Administrators can:
- add or rename zones
- add or rename wards and reassign them to zones
- maintain canonical candidate records
- maintain alias mappings that collapse workbook spelling/casing variants

### 2.3 Transfer Report Panel

Administrators can view:
- latest ingestion batch status
- counts of zones, wards, candidates, aliases, and nominations
- import checksum/source filename
- warnings or failed rows from workbook processing

## 3. Proposed UI Structure

- Admin dashboard shell with tabs or left navigation
- Candidate Profiles
- Reference Data
- Import / Transfer Report
- Optional preview panel for live dashboard impact

## 4. Data Model Notes

Recommended support table for the CMS:
- `candidate_profiles`

Suggested fields:
- `id`
- `candidate_id`
- `display_name`
- `photo_url`
- `short_bio`
- `contact_phone`
- `contact_email`
- `zone_id`
- `ward_id`
- `status`
- `notes`
- `created_at`
- `updated_at`

Existing reference tables to manage through the CMS:
- `zones`
- `wards`
- `candidates`
- `candidate_aliases`

## 5. Security Model

- Browser only uses the anon key for read-only views.
- Write actions should go through a secured serverless boundary or authenticated admin session.
- Service-role credentials must never be exposed in the frontend bundle.

## 6. Workbook Transfer Summary

The workbook-derived seed logic already canonicalizes these known variants:
- `DOCTOR XHAKZA` -> `DOCTOR XHAKAZA`
- `Jean sethato` -> `Jean Sethato`
- `Nomadlozi nkosi` -> `Nomadlozi Nkosi`
- `jongizizwe Dlabathi` -> `Jongizwe Dlabathi`

The hosted Supabase project has been initialized and seeded with the current canonical reference set.

## 7. Implementation Next Steps

1. Add `candidate_profiles` support to the database schema.
2. Build the admin portal screens in the React app.
3. Add secure mutation actions for profiles and reference data.
4. Extend the ingestion pipeline to replay the workbook import into hosted Supabase.
5. Add a transfer report view that reflects the latest ingestion batch.