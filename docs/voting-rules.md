# Authoritative Voting Rules — ANC Ekurhuleni BGM 2026

Version: 1.0  
Date: 2026-07-22  
Status: **Authoritative** — supersedes any conflicting data or prior documentation.

---

## 1. Core Definitions

| Term | Definition |
|------|-----------|
| **Ward** | An administrative ward number (e.g. Ward 10). For nomination purposes a ward is treated as identical to a **Branch**. |
| **Branch** | The local ANC organisational unit at ward level. Each Ward/Branch is an independent voting body. |
| **Candidate** | A uniquely identified individual (canonical full name) who may receive votes. |
| **Nomination / Vote** | A branch's declaration of support for a candidate. A vote value is binary: **1** (supported) or **0** (not supported / absent). |
| **Branch Total** | The sum of all vote values cast by a single branch in a single nomination event. Must not exceed **6**. |
| **Candidate Total** | The sum of a candidate's vote values across **all** branches/wards (`SUM(vote_count) WHERE candidate_id = X`). This is the primary ranking metric. |

---

## 2. The Three Core Rules

### Rule 1 — Six Votes Per Branch
Each Branch (Ward) has a maximum of **6 votes** to allocate across all candidates in a single nomination event.

- `SUM(vote_count) FOR a given ward_id` **≤ 6**
- A ward submitting fewer than 6 votes is valid (partial allocation / abstentions are permitted).
- A ward submitting more than 6 votes is **always rejected** — this is a hard constraint.

### Rule 2 — One Vote Per Candidate Per Branch
A candidate may receive **at most 1 vote** from any single branch.

- `vote_count` for any `(ward_id, candidate_id)` pair is **0 or 1** — never any other value.
- A branch cannot give 2 or more votes to the same candidate.
- The database enforces this with `CHECK (vote_count IN (0, 1))` and a `UNIQUE (ward_id, candidate_id)` constraint.

### Rule 3 — Sum-Total Ranking Across All Branches
The canonical ranking metric is the **candidate's total vote count across all branches**:

```
Candidate Score = SUM(vote_count) across all (ward_id, candidate_id) rows for that candidate
```

A candidate who receives 1 vote from each of 10 branches scores **10**, regardless of which branches they came from. The leaderboard sorts candidates by this sum, descending.

---

## 3. Validation Semantics

| Condition | Classification | System Response |
|-----------|---------------|-----------------|
| `vote_count` value is anything other than 0 or 1 | **Hard error — reject row** | Blocked by DB `CHECK` constraint and server-side pre-validation |
| Duplicate `(ward_id, candidate_id)` in the same submission | **Hard error — reject row** | Blocked by `UNIQUE` constraint and upload validation |
| Branch vote total > 6 | **Hard error — reject ward** | Blocked by DB trigger `enforce_ward_vote_total()` and server-side pre-validation |
| Branch vote total < 6 | **Warning only — proceed** | Accepted; a warning is surfaced to the operator indicating partial allocation |
| Candidate not in `candidates` table (active) | **Hard error — reject row** | Candidate must be pre-registered in the reference table |
| Ward number not in `wards` table | **Hard error — reject row** | Ward must be pre-registered in the reference table |

---

## 4. Per-Ward Replace Semantics

When a branch's (ward's) results are captured or re-submitted — whether via bulk Excel upload or manual ballot capture — the system applies a **full replace** for that ward:

1. All existing `nominations` rows for that `ward_id` are **deleted**.
2. The newly submitted rows are **inserted** (one row per voted-for candidate, `vote_count = 1`).

This is an atomic operation executed via the Supabase RPC `replace_ward_nominations(p_ward_id, p_candidate_ids, p_batch_id)`.

**Reason:** Partial re-submission can leave stale rows from incorrect historical data. A full replace guarantees the database reflects only the most recently authorised results for that branch.

---

## 5. Bulk Upload — Excel Template Format

The official Excel template uses a **long/tall table** layout with the following columns:

| Column | Expected Values | Notes |
|--------|----------------|-------|
| `Ward Number` | Integer (e.g. `10`) | Must match an existing ward in the reference table |
| `Candidate Full Name` | Text (exact canonical name) | Must match an active candidate's `full_name`; dropdown validation provided |
| `Vote (0 or 1)` | `0` or `1` | Dropdown validation provided; only rows with `Vote = 1` are counted |

- The template is generated from the Admin CMS → Report tab → **Download Template**.
- Candidate names in the template are pulled from the live `candidates` table (active only) at the time of download.
- Only one row per `(Ward Number, Candidate Full Name)` combination is allowed per file.

---

## 6. Manual Ballot Capture — Ward Ballot Form

For single-ward entry without uploading a file:

1. Select the **Ward / Branch** from the dropdown.
2. **Tick** each candidate who received a vote from that branch (up to 6 candidates).
3. Submit — the system performs a full replace for that ward.

The form prevents selecting more than 6 candidates and shows a live counter (`x / 6 selected`).

---

## 7. Audit Trail

Every submission — bulk upload or manual capture — creates an `ingestion_batches` row with:
- `source_filename`: the uploaded filename, or `manual-entry` for form submissions.
- `status`: `PENDING` → `SUCCESS` or `FAILED`.
- `processed_at`: timestamp.
- Raw rows are preserved in `workbook_sheet_rows` (linked by `batch_id`) for full auditability.

---

## 8. Data Quality Notice — Existing / Legacy Data

> **Action required before relying on dashboard totals.**

The nomination data that was initially transferred into the database contains rows with `vote_count` values greater than 1 (e.g. `vote_count = 3`, `vote_count = 2`). These values **violate Rule 2** (max 1 vote per candidate per branch) and are therefore incorrect.

**Affected rows in the initial seed / transfer** (non-exhaustive):

| Ward | Candidate | Incorrect `vote_count` | Correct `vote_count` |
|------|-----------|------------------------|----------------------|
| 10 | DOCTOR XHAKAZA | 3 | 1 |
| 10 | Jean Sethato | 1 | 1 |
| 10 | Nomadlozi Nkosi | 1 | 1 |
| 1 | Jean Sethato | 3 | 1 |
| 2 | Nomadlozi Nkosi | 2 | 1 |
| 48 | DOCTOR XHAKAZA | 2 | 1 |
| 59 | Phelisa Nkunjana | 2 | 1 |
| 72 | Jongizwe Dlabathi | 2 | 1 |
| 74 | Dora Mlambo | 2 | 1 |
| 26 | DOCTOR XHAKAZA | 2 | 1 |
| 65 | Jean Sethato | 2 | 1 |

The database migration `20260722000000_voting_rules_constraints.sql` caps these to `1` via the `CHECK (vote_count IN (0, 1))` constraint, and the updated `seed.sql` sets all initial values to `1`. **The client must re-submit actual ward results using the bulk Excel template or manual capture form to obtain accurate totals.**

---

## 9. Database Enforcement Summary

| Mechanism | What it enforces |
|-----------|-----------------|
| `CHECK (vote_count IN (0, 1))` | Rule 2 at the column level |
| `UNIQUE (ward_id, candidate_id)` on `nominations` | One row per branch-candidate pair |
| Trigger `enforce_ward_vote_total()` | Rule 1 — blocks ward sum > 6 on insert/update |
| RPC `replace_ward_nominations()` | Atomic full-replace write path for captures |
| Server-side pre-validation in `nominations.ts` | Row-level and ward-level checks before DB write |
| Client-side pre-validation in `votingData.ts` | Fast feedback in upload preview before server call |

---

## 10. References

- Database schema: `ekurhuleni-nominations-dashboard/supabase/migrations/20260717193000_init_schema.sql`
- Voting rules constraint migration: `ekurhuleni-nominations-dashboard/supabase/migrations/20260722000000_voting_rules_constraints.sql`
- Full system requirements: `docs/detailed-requirements-guide.md`
- Admin CMS portal documentation: `docs/admin-cms-portal.md`
