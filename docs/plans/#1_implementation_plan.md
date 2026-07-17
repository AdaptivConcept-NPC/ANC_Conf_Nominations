I’ll create an execution plan to move this project from scaffold to a functional nominations app, then persist it in session memory so it can be handed off for implementation cleanly. I’m first checking the current memory state and then I’ll write a step-by-step plan with phases, dependencies, verification, and scope boundaries.

Read memory

Search complete: Assess implementation gaps

Searched codebase for "ANC Conf Nominations dashboard frontend UI data access schema ingestion deployment", no results

Searched codebase for "frontend src files list supabase schema seed data pipeline deployment scripts gaps", no results

Searched for files matching `**/frontend/**`, 24 matches

Searched for files matching `**/supabase/**`, 3 matches

Searched for files matching `**/data-pipeline/**`, 2 matches

Searched for files matching `**/deployment/**`, no matches

No matches found. Your search pattern might be excluded completely by either the search.exclude settings or .*ignore files.
If you believe that it should have results, you can check into the .*ignore files and the exclude setting (here are some excluded patterns for reference:[**/node_modules,**/bower_components,**/*.code-search]).
Then if you want to include those files you can call the tool again by setting "includeIgnoredFiles" to true.

Searched for regex `nominations|nominations.*dashboard|conf.*nominations`, 20 results

Searched for text `nominations` (`**/ekurhuleni-nominations-dashboard/**`), 9 results

Searched for files matching `**/ekurhuleni-nominations-dashboard/**/api/**`, no matches

Searched for files matching `**/ekurhuleni-nominations-dashboard/**/*supabase*`, 1 match

Searched for files matching `**/ekurhuleni-nominations-dashboard/**`, 30 matches

I’ve mapped the gaps: frontend is still template-level, database schema/seed is empty, and ingestion is a stub, so the plan will focus on turning those into an end-to-end data-to-dashboard flow first. Before I finalize the plan, I want to lock two scope choices that change execution order.

Analyzing your answers...

I have your scope decisions: read-only analytics first and local Supabase-first delivery. I’m now drafting and saving a detailed execution plan with phased dependencies, verification gates, and explicit file touchpoints.

Created memory file [](file:///c%3A/Users/28523971/AppData/Roaming/Code/User/workspaceStorage/324ccedd75e1a0a241da11b675f8680e/GitHub.copilot-chat/memory-tool/memories/MGQ5NjdiYzMtMGFkMC00NjUzLTkxMWItM2Q1MmQ5MmZkYTVj/plan.md)

## Plan: Functional Nominations App Execution

Deliver a functional, read-only nominations analytics app by completing the missing end-to-end path: workbook ingestion, normalized Supabase schema, stable read queries, and a filterable dashboard UI.  
This plan follows your selected scope: read-only first, local Supabase first.

**Steps**
1. Phase 1: Baseline and Contracts
2. Define and lock v1 data contracts for leaderboard, zone totals, ward filters, and summary payloads.
3. Map each requirement in detailed-requirements-guide.md to concrete implementation tasks and acceptance checks.
4. Phase 2: Database Foundation (depends on Phase 1)
5. Implement schema, constraints, and indexes in seed.sql for zones, wards, candidates, candidate_aliases, nominations, and ingestion_batches.
6. Add idempotent upsert behavior and uniqueness guarantees for ward-candidate and alias data.
7. Create read-focused query layer (views or RPC) optimized for dashboard filters.
8. Phase 3: Ingestion Pipeline (depends on Phase 2)
9. Implement parser logic in seed_data.py for BRANCH NOMI and TOTAL IN ZONES.
10. Add canonicalization + alias resolution and persist alias mappings.
11. Add ingestion batch lifecycle logging, checksum tracking, and row-level error reporting.
12. Add validation checks that compare imported totals to known workbook totals.
13. Phase 4: Frontend Buildout (parallel with late Phase 3 once contracts are stable)
14. Replace scaffold UI in App.tsx with dashboard shell and global zone/ward filters.
15. Refactor Leaderboard.tsx for typed data, loading/error/empty states, and correct aggregation rendering.
16. Add a small frontend data-access layer and transform utilities; strengthen env validation in supabaseClient.ts.
17. Add core visual analytics blocks: leaderboard, zone distribution, and summary metrics.
18. Phase 5: Run Workflow and Delivery Hardening (depends on Phases 2-4)
19. Standardize env setup for pipeline + frontend using .env.
20. Update start_dev.bat workflow to ensure schema/data readiness before app launch.
21. Prepare Netlify + Supabase deployment checklist and smoke-test sequence.
22. Phase 6: Verification and Release Readiness (depends on all prior phases)
23. Add unit tests for canonicalization and query transforms.
24. Add integration tests for ingestion-to-DB consistency and dashboard query correctness.
25. Run manual E2E checks for load, filters, chart parity, and empty-state behavior.
26. Publish release runbook and troubleshooting notes.

**Relevant files**
- detailed-requirements-guide.md - requirements source and acceptance criteria
- seed.sql - schema and indexes
- config.toml - local Supabase behavior
- seed_data.py - ingestion and canonicalization
- App.tsx - dashboard composition
- Leaderboard.tsx - leaderboard chart behavior
- supabaseClient.ts - typed client/env validation
- start_dev.bat - startup flow

**Verification**
1. Reset/start Supabase and verify schema objects exist and are queryable.
2. Run ingestion against NOM2026 workbook and validate totals parity for key candidates and zones.
3. Run frontend locally and verify filters update visualizations correctly.
4. Confirm target performance for filter interactions.
5. Execute deployment smoke checks with production-like environment variables.

**Decisions**
- Included: read-only analytics v1, strong ingestion reliability, normalized DB-backed dashboard.
- Excluded (v1): authenticated create/update nomination workflows.
- Delivery strategy: local-first stabilization, then Netlify hardening.

Plan saved to /memories/session/plan.md.