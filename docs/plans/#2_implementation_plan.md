Read memory [](file:///c%3A/Users/28523971/AppData/Roaming/Code/User/workspaceStorage/324ccedd75e1a0a241da11b675f8680e/GitHub.copilot-chat/memory-tool/memories/repo/implementation-notes.md)

Read memory

Search complete: Explore DB schema and docs

Searched codebase for "database schema votes candidates wards branches voting rules constraints", 18 results

Searched codebase for "Vote structure Ward Branch Candidate relationships constraints", 11 results

Searched for files matching `**/migrations/**`, 2 matches

Searched for files matching `**/seed.sql`, 1 match

Searched for files matching `**/docs/detailed-requirements-guide.md`, 1 match

Searched for files matching `**/docs/Page_Components.md`, 1 match

Searched for regex `Vote|candidate|ward|branch|Branch|Ward|votes`, 603 results

No matches found. Your search pattern might be excluded completely by either the search.exclude settings or .*ignore files.
If you believe that it should have results, you can check into the .*ignore files and the exclude setting (here are some excluded patterns for reference:[**/node_modules,**/bower_components,**/*.code-search]).
Then if you want to include those files you can call the tool again by setting "includeIgnoredFiles" to true.

Searched for files matching `**/seed_data.py`, 1 match

Searched for files matching `**/netlify/functions/admin*.ts`, 1 match

Searched for files matching `**/components/WorkbookViews.tsx`, 1 match

Searched for files matching `**/lib/adminData.ts`, 1 match

Searched for files matching `**/lib/dashboardData.ts`, 1 match

Read [](file:///c%3A/AppDev/ANC_Conf_Nominations/ekurhuleni-nominations-dashboard/supabase/migrations/20260717193000_init_schema.sql)

Read [](file:///c%3A/AppDev/ANC_Conf_Nominations/ekurhuleni-nominations-dashboard/supabase/migrations/20260718000000_add_app_users.sql)

Read [](file:///c%3A/AppDev/ANC_Conf_Nominations/ekurhuleni-nominations-dashboard/supabase/seed.sql)

Search complete: Explore Admin CMS Report tab

Searched codebase for "AdminCmsPortal.tsx Report tab implementation", 6 results

Searched codebase for "adminData.ts Supabase read/write functions file upload form handling", 6 results

Searched codebase for "frontend form handling patterns file upload Excel bulk import Supabase", 21 results

Searched for files matching `**/AdminCmsPortal.tsx`, 1 match

Searched for files matching `**/adminData.ts`, 1 match

Searched for text `AdminCmsPortal`, 3 results

Searched for regex `Report.*tab|report.*view|/report`, 2 results

No matches found. Your search pattern might be excluded completely by either the search.exclude settings or .*ignore files.
If you believe that it should have results, you can check into the .*ignore files and the exclude setting (here are some excluded patterns for reference:[**/node_modules,**/bower_components,**/*.code-search]).
Then if you want to include those files you can call the tool again by setting "includeIgnoredFiles" to true.

Read [](file:///c%3A/AppDev/ANC_Conf_Nominations/ekurhuleni-nominations-dashboard/frontend/src/lib/adminData.ts#1-1), lines 1 to 220

Read [](file:///c%3A/AppDev/ANC_Conf_Nominations/ekurhuleni-nominations-dashboard/frontend/src/lib/adminData.ts#220-220), lines 220 to 360

Read [](file:///c%3A/AppDev/ANC_Conf_Nominations/ekurhuleni-nominations-dashboard/frontend/src/lib/adminData.ts#360-360), lines 360 to 375

Read [](file:///c%3A/AppDev/ANC_Conf_Nominations/ekurhuleni-nominations-dashboard/frontend/src/lib/adminData.ts#375-375), lines 375 to 375

Read [](file:///c%3A/AppDev/ANC_Conf_Nominations/ekurhuleni-nominations-dashboard/frontend/src/lib/adminData.ts#375-375), lines 375 to 375

Read [](file:///c%3A/AppDev/ANC_Conf_Nominations/ekurhuleni-nominations-dashboard/frontend/src/components/AdminCmsPortal.tsx#1-1), lines 1 to 260

Read [](file:///c%3A/AppDev/ANC_Conf_Nominations/ekurhuleni-nominations-dashboard/frontend/src/components/AdminCmsPortal.tsx#260-260), lines 260 to 520

Read [](file:///c%3A/AppDev/ANC_Conf_Nominations/ekurhuleni-nominations-dashboard/frontend/src/components/AdminCmsPortal.tsx#520-520), lines 520 to 820

Read [](file:///c%3A/AppDev/ANC_Conf_Nominations/ekurhuleni-nominations-dashboard/supabase/migrations)

Read [](file:///c%3A/AppDev/ANC_Conf_Nominations/docs/detailed-requirements-guide.md#1-1), lines 1 to 120

Read [](file:///c%3A/AppDev/ANC_Conf_Nominations/ekurhuleni-nominations-dashboard/frontend/package.json)

Analyzing your answers...

Read [](file:///c%3A/AppDev/ANC_Conf_Nominations/docs/admin-cms-portal.md#1-1), lines 1 to 60

Created memory file [](file:///c%3A/Users/28523971/AppData/Roaming/Code/User/workspaceStorage/324ccedd75e1a0a241da11b675f8680e/GitHub.copilot-chat/memory-tool/memories/NGMxNGY3OWMtOGExYi00NmE4LWE0NzMtNGMzNzBjOGI1NzJj/plan.md)

## Plan: Voting Rules Doc + Bulk Excel Upload & Manual Ballot Capture

**TL;DR:** Document the authoritative voting rules in a new `docs/voting-rules.md` (Ward=Branch, 6 votes/branch, max 1 vote/candidate/ward, sum-total-per-candidate metric). Add DB-level guardrails so the rule can't be silently violated (the current seeded `nominations` data already violates it — e.g. ward 10/DOCTOR XHAKAZA has vote_count=3 — which explains the client's "incomplete data" complaint). Then enhance the Admin CMS **Report** tab with a downloadable Excel Table template, a bulk-upload flow, and a "Ward Ballot Capture" manual form.

**Confirmed decisions**
- Template layout: long/tall table — one row per (Ward Number, Candidate Full Name, Vote 0/1).
- Per-ward semantics: **full replace** on resubmission (deletes+reinserts that ward's rows atomically).
- Validation: hard-block only impossible cases (>1 vote/candidate/ward, ward total >6); warn (don't block) if ward total <6.
- Manual capture: "Ward Ballot Capture" — pick a ward, tick up to 6 active candidates, submit as one replace.
- Candidate scope: active candidates only.

**Steps**

*Phase 0 — Documentation*
1. Create docs/voting-rules.md — authoritative rules, validation semantics, and a Data Quality Notice flagging the current seed's rule violations.
2. Cross-reference it from detailed-requirements-guide.md.

*Phase 1 — Database (depends on Phase 0)*
3. New migration `supabase/migrations/20260722000000_voting_rules_constraints.sql`: CHECK `vote_count IN (0,1)`, trigger `enforce_ward_vote_total()` (blocks ward sum >6), RPC `replace_ward_nominations(ward_id, candidate_ids[], batch_id)` for atomic per-ward replace.
4. Fix `supabase/seed.sql` rows with vote_count>1 (cap to 1) so seeding satisfies the new CHECK constraint.

*Phase 2 — Netlify function (depends on Phase 1)*
5. New `frontend/netlify/functions/nominations.ts` (mirrors `admin.ts` service-role pattern): `bulk_upload` action (validate rows, batch-audit via `ingestion_batches`/`workbook_sheet_rows`, group by ward, call RPC per ward) and `manual_capture` action (single ward, call RPC once).

*Phase 3 — Frontend (depends on Phase 2 contracts)*
6. Add `exceljs` dependency (supports native Excel Tables + dropdown validation, unlike plain SheetJS community edition).
7. New `frontend/src/lib/votingData.ts`: `downloadVotingTemplate`, `parseVotingWorkbook`, `submitBulkVotingUpload`, `submitWardBallot`, `fetchActiveCandidatesForVoting`.
8. Update `AdminCmsPortal.tsx` Report tab: template download button, bulk-upload preview/submit flow, Ward Ballot Capture form — reusing existing `handleSave`/nav patterns.

**Relevant files**
- `docs/voting-rules.md` — new
- detailed-requirements-guide.md — cross-reference addition
- `ekurhuleni-nominations-dashboard/supabase/migrations/20260722000000_voting_rules_constraints.sql` — new
- seed.sql — fix vote_count values
- `ekurhuleni-nominations-dashboard/frontend/netlify/functions/nominations.ts` — new
- package.json — add `exceljs`
- `ekurhuleni-nominations-dashboard/frontend/src/lib/votingData.ts` — new
- AdminCmsPortal.tsx — Report tab
- adminData.ts — reuse candidate types/fetch

**Verification**
1. Apply migration; confirm seed re-runs cleanly against new CHECK constraint.
2. `cd ekurhuleni-nominations-dashboard/frontend && npm run build`.
3. Manual bulk-upload tests: duplicate candidate-in-ward (reject), 7 votes in a ward (reject), 5 votes (success+warning), valid 6 votes (success).
4. Manual Ward Ballot Capture test: verify old ward rows replaced in Supabase Studio.
5. Confirm dashboard leaderboard/matrix reflect updated totals immediately.

**Scope boundaries**
- Out of scope: reworking the Python `data-pipeline/seed_data.py` path, other CMS CRUD changes, auth changes, restating historical §4 totals in the requirements guide.

Let me know if you'd like any adjustments — otherwise this is ready for handoff to implementation.