# NOM2026 – Data Reconciliation & Observations Report

**To:** ANC Ekurhuleni (Nominations Working Group)
**From:** AdaptivConcept – ANC_Nominations project team
**Date:** 2026-08-14
**Version:** 1.0
**Status:** Information / decision required

---

## 1. Executive summary

The NOM2026 nominations dashboard is working correctly: it displays **exactly what is stored in the
Supabase database**. The discrepancies you are seeing between the app and the source workbook are
**not caused by the application** — no hard-coded limits exist, and no query truncates the data.

The root cause of every observed discrepancy is a **misalignment between the two source sheets in the
workbook**:

- The **BRANCH NOMI** sheet is **incomplete** — it lists 111 ward headers but only ~53 have nomination
  data beneath them. This sheet is what was loaded into the database, which is why the app shows
  ~56 wards.
- The **TOTAL IN ZONES** sheet is the **authoritative, complete** tally, but it is **zone‑level only**
  (no per‑ward break‑down), and its grand-total cell is itself inconsistent with its own column/candidate
  sums.

The good news: once the correct source is compared against the database, the zone and candidate totals
**reconcile to within 1 vote** (a single candidate "Mpho"). The remaining work is data-authority and
sheet-structure decisions, not bug-fixing.

---

## 2. What the app displays and why

| App element | Source in database | Currently shows |
|---|---|---|
| Ward dropdown / ward list | `wards` table (56 rows) | 56 wards |
| "Active Wards" stat card | distinct ward numbers present in `nominations` | 52 wards |
| "Candidates" stat card | distinct candidates present in `nominations` | 40 candidates |
| BRANCH NOMINATIONS matrix | `nominations` rows joined to wards/zones | votes per ward & candidate |
| Leaderboard | aggregated `nominations` | totals per candidate |

No code constant of "56", "40", "52" was found. The only numeric matches for "56" in the codebase are
CSS pixel sizes (e.g. a 56px icon). The app genuinely reflects the database, which was seeded from the
**BRANCH NOMI** sheet.

---

## 3. Observations

### 3.1 "BRANCH NOMI" is incomplete; "TOTAL IN ZONES" is the true tally

- **BRANCH NOMI**: 111 unique ward headers are present across the zone columns, but only **53 wards**
  actually have candidate names listed beneath them. The other **58 ward headers are empty blocks**
  (e.g. wards 1, 2, 7, 12, 13, 16, 18, 20–23, 25, 27, 28, 30–32, 35–43, 46, 48, 50–57, 61–63,
  68–71, 82–85, 88, 91–94, 97, 98, 105, 106, 108, 112).
- **TOTAL IN ZONES** is the complete and consistent summary (per candidate, per zone), but it is
  **zone-level only** — it cannot answer "which ward voted for whom".

### 3.2 Ward count: 56 shown vs ~111 expected

- The workbook (BRANCH NOMI) lists 111 distinct ward numbers.
- The database was populated only with wards that had data in BRANCH NOMI: **53 wards parsed from the
  sheet + 3 explicitly seeded (wards 1, 2, 48) = 56 wards** in the `wards` table.
- Consequently the app's ward dropdown / "Active Wards" can never exceed 56 until the `wards` table
  is completed with the 55 missing ward records.

### 3.3 Candidate count: 41 in the workbook vs 40 visible in the app

- The **TOTAL IN ZONES** sheet lists **41 distinct candidates** (confirmed by manual count and by
  parsing the sheet).
- The database also holds **41 candidate records** — but one of them, **Mpho**, has **zero votes**
  (no rows in `nominations`). The dashboard's "Candidates" stat counts candidates *with vote rows*,
  so it shows **40**.
- Root cause: Mpho's single vote exists in **TOTAL IN ZONES** (OSKA MABIKA zone) but was never
  captured into the database via the BRANCH NOMI ingest.

### 3.4 Name spelling variants (same people, different spellings)

| Workbook (TOTAL IN ZONES) | Database (canonical) | Notes |
|---|---|---|
| Cassuis Mabasa | Cassius Mabasa | spelling variant |
| Clerrence | Clerence | spelling variant |
| Emilly Mohlala | Emily Mohlala | spelling variant |
| Mpho | Mpho | registered but 0 votes in DB |

These are data-quality items, not application defects. A candidate-aliasing mechanism already exists in
the system (`candidate_aliases`) and should be extended to cover the above.

### 3.5 The workbook's own grand total is internally inconsistent

- TOTAL IN ZONES: the **grand-total cell (row 51) = 248**, but:
  - the zone column sums add to **258**, and
  - the candidate total column (col L) adds to **258**.
- The 10-vote difference indicates the grand-total cell was not updated after the zone/candidate rows
  were amended. The workbook should be corrected to state **258**.

### 3.6 Matrix stats are zone-based, not ward-specific — by sheet design

- Because BRANCH NOMI (the only ward-level sheet) is incomplete, the matrix you see in the app can only
  be as accurate as that sheet.
- TOTAL IN ZONES provides **zone-level** authority but deliberately has **no ward column**, so ward-level
  totals in the workbook are simply not defined there.
- Observed app behaviour is consistent: every ward that *does* have data shows ≥1 nomination, and every
  candidate with data has ≥1 vote, but the "zone views" aggregate across wards.

---

## 4. Reconciliation after re-analysis

Comparing the **TOTAL IN ZONES** sheet (authoritative) with the database:

| Metric | Workbook (TOTAL IN ZONES) | Database | Diff |
|---|---|---|---|
| Total votes | 258 (corrected from 248) | 257 | −1 (Mpho) |
| Candidates | 41 | 41 registered / 40 with votes | spelling variants only |
| Zones | 10 | 10 | match (names differ slightly: BAVUMILE V/VILAKAZI, FLATHELA/FLATELA) |
| Wards | 111 in sheet / 53 with data | 56 | 55 ward records missing from DB |

Zone-by-zone totals match exactly for 9 of 10 zones; the only delta is **OSKA MABIKA** (workbook 31 vs
DB 30) which is precisely Mpho's missing vote.

---

## 5. Recommended actions

**Decision needed from the client** on the authoritative ward-level source. Concretely:

1. **Decide the master data authority.**
   - Option A — **TOTAL IN ZONES is official**: treat zone/candidate totals as canonical. Accept that
     ward-level detail is unavailable for the 58 empty BRANCH NOMI blocks and keep the dashboard in
     zone/reporting mode.
   - Option B — **BRANCH NOMI must be completed**: the working group completes the 58 empty ward blocks
     with the true ward-level votes; we then re-seed the database and ward-level reporting becomes fully
     accurate.

2. **Fix the workbook.**
   - Correct the TOTAL IN ZONES grand-total cell from 248 → **258**.
   - Standardise candidate spellings (Cassuis→Cassius, Clerrence→Clerence, Emilly→Emily) using one
     canonical name per person.

3. **Complete the reference table.** Add the **55 missing ward numbers** to the `wards` table (with the
   correct `zone_id`) so the app's ward list matches the full 111-ward register. Wards without votes will
   then show as 0 rather than being absent.

4. **Re-ingest the authoritative data.**
   - Extend `candidate_aliases` for the spelling variants above.
   - Re-run the seed pipeline against the corrected workbook. Current blockers: `data-pipeline/.env`
     points to a file that does not exist at the configured path, and the seed currently parses only the
     incomplete BRANCH NOMI sheet.

5. **Optionally add an Mpho correction**: capture Mpho's single OSKA MABIKA vote if Option A/B confirms it.

---

## 6. Open questions for the working group

1. Which sheet is the **official** record for ward-level results: BRANCH NOMI (complete it) or another
   deliverable?
2. Does ward 102 / 104 (registered, currently 0 votes) genuinely have no submissions, or is that data
   missing?
3. Confirm Mpho's vote (OSKA MABIKA, 1) — should it be included in the official tally?
4. Provide the corrected workbook (or approve proof-reading the current one) so we can re-seed and sign-off.

---

*Prepared by the project team from a direct comparison of `docs/NOM2026 PR and Councillor Nominations.xlsx`
and the live Supabase database (`zilabbyqoaivtgqdeijd`). No application code was changed for this
report; recommendations require decisions before implementation.*