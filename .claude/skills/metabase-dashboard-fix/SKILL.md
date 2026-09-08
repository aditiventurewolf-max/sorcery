---
name: metabase-dashboard-fix
description: Use when building or fixing Metabase native-SQL dashboard cards against this org's Postgres/CS-Analytics databases — especially when adding a working dashboard-level date filter, fixing a slow/timing-out card, designing a rate metric (numerator/denominator), or moving/organizing cards into a collection via the metabase MCP tools.
---

# Metabase dashboard fix

Lessons learned building and repairing the "RRR- Final Boss" dashboard (collection "RRR", id 331) via the `mcp__metabase__*` tools. Apply these before writing/editing any card.

## 1. Making a dashboard-level date filter actually work

- A relative-date dropdown ("past 7 days" / "since forever" / custom) on a dashboard only works if the underlying card's `{{tag}}` is declared as a **dimension** (Field Filter) tag, not a plain `date` tag:
  ```json
  {"name": "date_filter", "type": "dimension", "dimensionFieldId": <id>, "displayName": "Date Filter", "widgetType": "date/all-options"}
  ```
  Get `dimensionFieldId` from `list_table_fields` for the exact table/column the filter should bind to (e.g. `booking.booking_ended_at`, or `job_card_status_log.created_at` for a card sourced from a different table — using the wrong table's field id silently breaks the filter).
- Pass `templateTags` explicitly on `create_question`/`update_question` whenever the SQL contains `{{...}}`. Without it, Metabase leaves the literal `{{tag}}` text in the query and Postgres throws a syntax error.
- **Field Filters hardcode the literal, unaliased table name** in the generated SQL (e.g. `"booking"."booking_ended_at" >= ? AND < ?`). The target table must appear unaliased (`FROM booking`, not `FROM booking b`) at the point `{{tag}}` is substituted, or the filter silently fails to bind / breaks the query.
- Wire the tag to a dashboard-level filter with `add_dashboard_filter`, passing `mapTo: [{cardId, tagName}, ...]` for every card that should respond to it.
- `add_dashboard_filter` has **no update/merge** — calling it again with the same `name` creates a second, separate duplicate filter pill instead of updating the first. If you need to add one more card's mapping, don't call it again with a partial list — call it once with the **full set of cards** the filter should cover, then tell the user to manually delete the old duplicate pill in the dashboard UI (no tool can delete/merge dashboard filters).
- Test a tag before trusting it, via `run_question` with:
  ```json
  {"parameters": [{"type": "date/relative", "value": "past7days", "target": ["dimension", ["template-tag", "date_filter"]]}]}
  ```

## 2. The MATERIALIZED fix for CTE timeouts

If a CTE with correlated `EXISTS` subqueries is consumed via a `LEFT JOIN ... WHERE x IS NULL` anti-join pattern, this Postgres version **inlines and re-evaluates the CTE per outer row** by default, causing 60s+ timeouts on queries that should run in under a second. Fix: `WITH cte_name AS MATERIALIZED (...)`. This forces single computation. Apply this to every CTE feeding an anti-join or otherwise reused more than once downstream — it's cheap insurance even when not strictly required.

Also prefer an id-based semi-join (`WHERE booking_id IN (SELECT id FROM date_filtered_ids)`) over a value-based one (`WHERE booking_ended_at IN (SELECT booking_ended_at FROM booking WHERE ...)`) — the latter is fragile and slow.

## 3. Nested card references don't propagate template tags

`{{#cardId}}` referencing another saved question does **not** pass the wrapping card's own `templateTags`/parameters into the referenced card — even if the outer card declares a tag with the same name, Metabase won't detect it as "used" and the filter never reaches the inner query. Don't build a DRY shared-base-card architecture for dashboard cards that need dashboard filters. Make each filterable card fully standalone, with its own duplicated logic and its own `{{date_filter}}` reference.

## 4. Designing a rate metric: always define — and refresh — the denominator

A "%" card is meaningless without stating what's in the denominator, and stale/historical denominators quietly rot. Prefer a **live** denominator recomputed on every query run (e.g. `bike.current_odo` / `vehicle_status = 'active'`) over a static historical snapshot table, unless you have access to (and actually need) the true historical value for the selected date range. Document the tradeoff directly in the card (a comment or description saying "live snapshot, not historically accurate for past ranges") rather than letting it look more precise than it is.

## 5. Tool limitations to plan around (verify these still hold before relying on them)

- `update_question` has no `collectionId` param — it cannot move a card between collections, and neither can `move_dashboard_card` (that tool only repositions row/col/size/tab *within* a dashboard it's already on).
- **Workaround to move a card into a different collection**: `create_question` a fresh copy with `collectionId` set to the target collection (same SQL/templateTags/display), `add_question_to_dashboard` it at the old card's row/col/size, then `archive_question` the original. Archiving a card **automatically removes it from any dashboard it was on** — verify this by re-fetching the dashboard afterward and confirming no orphaned/duplicate tile remains.
- `create_question`/`update_question` accept a `display` param (`table`/`bar`/`row`/`line`/`pie`/`scalar`/`area`/`combo`) — this works fine on both create and update; don't assume it needs a special/new tool.
- Large `get_dashboard`/tool outputs get saved to a file when they exceed the token limit — use `grep`/`Bash` on that file (e.g. for `"card_id"`, `"display"`, `"collection_id"` lines) instead of trying to read it all.

## 6. Before building new cards

- Check what similar dashboards in the org already do well — grid layout (24-column), chart-type choices per data shape, per-card axis-title settings — by fetching a couple of reference dashboards with `get_dashboard`.
- Check the team's canonical metric-definition source (a shared sheet, a hypothesis register, a prior canonical card) before inventing a new formula — mismatched category vs. billing-category groupings, or wrong join semantics, produce numbers that look plausible but are wrong (e.g. grouping by a billing category instead of physical part name).
