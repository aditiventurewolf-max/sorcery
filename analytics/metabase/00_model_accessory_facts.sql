-- ============================================================================
-- METABASE MODEL #1  ·  "Accessory Sales — Unified (App + Job Card)"
-- ----------------------------------------------------------------------------
-- Save this in Metabase as a MODEL (New > Model > SQL query), not a question.
-- Everything else in this folder builds on it, so hub->city mapping and the
-- job-card backfill logic live in exactly one place.
--
-- >>> BEFORE SAVING, replace these 3 table names with your real ones:
--       accessory_orders   -- source of "pending_installation_raw_list"
--       job_cards          -- source of "mobile_stand_job_cards_and_status"
--       hub_stock          -- source of "hub_wise_stock___fulfillment"
--     Dialect assumed: Postgres. For MySQL see NOTES at bottom.
-- ============================================================================

WITH hub_city AS (
    -- Single source of truth for the city rollup. Add new hubs HERE only.
    SELECT * FROM (VALUES
        ('Banaswadi',    'Bengaluru'),
        ('Bellandur',    'Bengaluru'),
        ('Bilekahalli',  'Bengaluru'),
        ('Hebbal',       'Bengaluru'),
        ('Hoodi',        'Bengaluru'),
        ('HSR Layout',   'Bengaluru'),
        ('RR Nagar',     'Bengaluru'),
        ('Yeshwanthpur', 'Bengaluru'),
        ('Sakinaka',     'Mumbai')
    ) AS t(hub_name, city)
),

-- Canonical accessory names. The job-card flow has no product column at all
-- (every mobile-stand job card IS a Mobile Holder), and stock uses slightly
-- different spellings, so normalise once and never think about it again.
product_map AS (
    SELECT * FROM (VALUES
        ('Mobile Holder',    'Mobile Holder',    'Mobile Stand'),
        ('Mobile Stand',     'Mobile Holder',    'Mobile Stand'),
        ('Bounce Helmet B',  'Bounce Helmet B',  'Helmet'),
        ('Bounce Helmet M',  'Bounce Helmet M',  'Helmet'),
        ('Helmet',           'Bounce Helmet B',  'Helmet')
    ) AS t(raw_product, accessory, accessory_group)
),

-- ---------------------------------------------------------------------------
-- LEG 1: sales made through the accessory app (order-based, current flow)
-- ---------------------------------------------------------------------------
app_sales AS (
    SELECT
        o.hub_name,
        o.product_name                      AS raw_product,
        o.order_placed_at::date             AS sale_date,
        'App Order'                         AS sale_source,
        o.order_id::text                    AS sale_ref,
        1                                   AS units
    FROM accessory_orders o
    WHERE o.order_placed_at IS NOT NULL
      -- a sale is counted at PAYMENT, not at installation; pending-install
      -- orders are already sold units that have left inventory.
      AND o.payment_status IN ('PAID', 'SUCCESS')      -- <<< match your enum
      AND COALESCE(o.is_cancelled, FALSE) = FALSE
),

-- ---------------------------------------------------------------------------
-- LEG 2: the OLD sales — mobile stands fitted via DMS job cards, pre-app.
-- This is the backfill you asked for. "billed = Yes" is the sale event.
-- ---------------------------------------------------------------------------
job_card_sales AS (
    SELECT
        j.hub_name,
        'Mobile Holder'                     AS raw_product,
        j.jc_created_at::date               AS sale_date,
        'Job Card (legacy)'                 AS sale_source,
        'JC-' || j.jc_id::text              AS sale_ref,
        1                                   AS units
    FROM job_cards j
    WHERE j.billed = 'Yes'                  -- <<< or: latest_status = 'Billed'
      AND j.dms_jc_id IS NOT NULL
      -- Cutover guard: stops double-counting if a hub ran both flows for a
      -- few days. Anything on/after go-live is owned by the app leg above.
      AND j.jc_created_at < DATE '2026-08-19'
)

SELECT
    hc.city,
    s.hub_name,
    pm.accessory,
    pm.accessory_group,
    s.sale_source,
    s.sale_date,
    DATE_TRUNC('week',  s.sale_date)::date  AS sale_week,
    DATE_TRUNC('month', s.sale_date)::date  AS sale_month,
    s.sale_ref,
    s.units
FROM (
    SELECT * FROM app_sales
    UNION ALL
    SELECT * FROM job_card_sales
) s
LEFT JOIN hub_city    hc ON hc.hub_name   = s.hub_name
LEFT JOIN product_map pm ON pm.raw_product = s.raw_product

-- NOTES (MySQL): replace `SELECT * FROM (VALUES (..),(..)) AS t(a,b)` with
--   SELECT 'Banaswadi' AS hub_name, 'Bengaluru' AS city UNION ALL SELECT ...
-- replace `::date` with CAST(x AS DATE) and DATE_TRUNC('month', d) with
--   DATE_FORMAT(d, '%Y-%m-01').
