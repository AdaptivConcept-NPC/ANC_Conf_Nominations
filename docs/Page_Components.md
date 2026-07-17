# Page Components and Visualization Contract

## 0. Data Contract (used by all pages)

- Core measure:
- `votes`: numeric count of nominations/votes (`SUM(vote_count)`).

- Core dimensions:
- `region`: zone/region label (for example `AMON NGULELE`, `ZONE 10`).
- `ward`: ward number.
- `candidate`: candidate full name (canonicalized).

- Derived measures:
- `vote_share_pct`: `votes / total_votes_in_scope * 100`.
- `rank`: order by `votes DESC` within selected scope.
- `cumulative_share_pct`: running percentage across sorted candidates.

- Default filters (global unless stated otherwise):
- Region (all/one/multi)
- Ward (all/one/multi)
- Candidate search

## 1. BRANCH NOMINATIONS page

- Purpose:
- Ward-level and branch-level detail with direct candidate comparison.

- Visual 1: Branch Matrix (primary)
- Chart type: heat-matrix table.
- Rows (dimension): `ward`.
- Columns (dimension): `candidate`.
- Cell measure: `votes`.
- Series items: each candidate column is a series item.
- Aggregation: `SUM(votes)` by `(ward, candidate)`.

- Visual 2: Candidate mix by ward
- Chart type: stacked horizontal bar chart.
- Category axis: `ward`.
- Value axis: `votes`.
- Series items: `candidate`.
- Aggregation: `SUM(votes)` by `(ward, candidate)`.

- Visual 3: Ward drilldown panel
- Component type: ranked list/table for selected ward.
- Dimensions: `candidate`.
- Measures: `votes`, `vote_share_pct`, `rank`.

- Why this works:
- This page is granular and dense; matrix + stacked bars + drilldown avoids losing detail while preserving comparability.

## 2. TOTAL IN ZONES page

- Purpose:
- Consolidated regional totals with candidate comparison across regions.

- Visual 1: Votes per Region
- Chart type: bar chart.
- X-axis: `region`.
- Y-axis: `votes`.
- Series items: single series (`total votes`).
- Aggregation: `SUM(votes)` by `region`.

- Visual 2: Votes per Candidate
- Chart type: sorted horizontal bar chart.
- X-axis: `votes`.
- Y-axis: `candidate`.
- Series items: single series (`total votes`).
- Aggregation: `SUM(votes)` by `candidate`.

- Visual 3 (required below the two charts): all Regions/Wards per Candidate
- Chart type: stacked bar (candidate-centric; orientation can be horizontal or vertical by UX toggle).
- If vertical mapping is selected (as requested):
- X-axis: `candidate`.
- Y-axis: `votes`.
- Series items (stack): `region` or `ward` (toggle between region stack and ward stack).
- If horizontal mapping is selected:
- Y-axis: `candidate`.
- X-axis: `votes`.
- Series items (stack): `region` or `ward`.
- Aggregation: `SUM(votes)` by `(candidate, region)` or `(candidate, ward)`.

- Visual 4: ranked totals table
- Dimensions: `region`, `candidate`.
- Measures: `votes`, `vote_share_pct`, `rank`.

- Why this works:
- You get both distribution views (`per region`, `per candidate`) and the full composition view (`all regions/wards stacked per candidate`) on one page.

## 3. PIE PER ZONE page

- Purpose:
- Candidate distribution within one selected region.

- Visual 1: Region-specific donut
- Chart type: donut chart.
- Scope filter: one selected `region`.
- Slice dimension: `candidate`.
- Slice measure: `votes`.
- Slice label: `vote_share_pct`.
- Series items: candidates in selected region.

- Visual 2: companion leaderboard
- Dimensions: `candidate`.
- Measures: `votes`, `vote_share_pct`, `rank`.
- Sort: `votes DESC`.

- Visual 3: zone navigator
- Component type: region selector with previous/next controls.
- Behavior: updates donut + leaderboard together.

- Why this works:
- Composition per single region is clear and defensible when both absolute counts and percentages are shown together.

## 4. OVERAL PIE page

- Purpose:
- Executive summary of overall candidate share across all included data.

- Visual 1: overall donut
- Slice dimension: `candidate`.
- Slice measure: `votes`.
- Slice label: `vote_share_pct`.
- Aggregation: `SUM(votes)` by `candidate` over active global filters.

- Visual 2: KPI strip
- `total_votes`: `SUM(votes)`.
- `total_candidates`: `COUNT(DISTINCT candidate)`.
- `top_candidate`: candidate with max votes.
- `top_candidate_share_pct`: top candidate share.

- Why this works:
- A clean executive view with immediately interpretable totals and dominant-share context.

## 5. OVERAL GRAPH page

- Purpose:
- Absolute ranking and concentration analysis across candidates.

- Visual 1: overall candidate totals
- Chart type: sorted horizontal bar chart.
- Y-axis: `candidate`.
- X-axis: `votes`.
- Series items: single series (`total votes`).

- Visual 2: Pareto concentration overlay (optional but recommended)
- Base bars: `votes` by `candidate` sorted DESC.
- Overlay line measure: `cumulative_share_pct`.
- Secondary axis: percentage (0-100).

- Visual 3: top-5 concentration card
- Measures:
- `top_5_votes`.
- `top_5_share_pct`.
- `others_votes`.
- `others_share_pct`.

- Why this works:
- This page answers who leads and how concentrated the vote landscape is.

## 6. Cross-page behavior

- Shared controls:
- Region filter, ward filter, candidate search.
- Time/snapshot selector (if multiple import batches are supported).

- Shared interactions:
- Click any series item to cross-filter page visuals.
- Hover tooltips must always show both `votes` and `vote_share_pct` when relevant.

- Exports:
- CSV export for current filtered dataset.
- PNG export per chart card.

- Routing:
- URL tab routes for each page for direct linking and stakeholder review.

## 7. Naming and labeling standards

- Use "Region" consistently for zonal grouping label.
- Use "Votes" as the primary measure label everywhere.
- Use "Share (%)" for percentages and never display percentage without the corresponding count in tooltip/table context.