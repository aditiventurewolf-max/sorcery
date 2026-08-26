-- ============================================================================
-- QUERY A · SALES — hub x city x accessory, with legacy job-card sales folded
-- into total_sales. Paste straight into Metabase > New > SQL query.
--
-- Swap 3 table names:  accessory_orders / job_cards / (none needed here)
-- Dialect: Postgres.
-- ============================================================================
WITH hub_city AS (
    SELECT * FROM (VALUES
        ('Banaswadi','Bengaluru'), ('Bellandur','Bengaluru'),
        ('Bilekahalli','Bengaluru'), ('Hebbal','Bengaluru'),
        ('Hoodi','Bengaluru'), ('HSR Layout','Bengaluru'),
        ('RR Nagar','Bengaluru'), ('Yeshwanthpur','Bengaluru'),
        ('Sakinaka','Mumbai')
    ) AS t(hub_name, city)
),
sales AS (
    -- current flow: accessory app orders
    SELECT o.hub_name,
           CASE WHEN o.product_name IN ('Helmet','Bounce Helmet B') THEN 'Bounce Helmet B'
                WHEN o.product_name = 'Mobile Stand' THEN 'Mobile Holder'
                ELSE o.product_name END      AS accessory,
           o.order_placed_at::date           AS sale_date,
           'App Order'                       AS sale_source
    FROM accessory_orders o
    WHERE o.payment_status IN ('PAID','SUCCESS')      -- <<< your enum
      AND COALESCE(o.is_cancelled, FALSE) = FALSE

    UNION ALL

    -- legacy flow: DMS mobile-stand job cards. billed='Yes' IS the sale.
    SELECT j.hub_name,
           'Mobile Holder'                   AS accessory,
           j.jc_created_at::date             AS sale_date,
           'Job Card (legacy)'               AS sale_source
    FROM job_cards j
    WHERE j.billed = 'Yes'
      AND j.dms_jc_id IS NOT NULL
      AND j.jc_created_at < DATE '2026-08-19'        -- cutover, stops double-count
)
SELECT
    hc.city,
    s.hub_name,
    s.accessory,
    COUNT(*)                                                          AS total_sales,
    COUNT(*) FILTER (WHERE s.sale_source = 'App Order')               AS app_sales,
    COUNT(*) FILTER (WHERE s.sale_source = 'Job Card (legacy)')       AS legacy_jc_sales,
    COUNT(*) FILTER (WHERE s.sale_date >= CURRENT_DATE - 7)           AS sales_last_7d,
    COUNT(*) FILTER (WHERE s.sale_date >= CURRENT_DATE - 30)          AS sales_last_30d,
    MAX(s.sale_date)                                                  AS last_sale_on
FROM sales s
LEFT JOIN hub_city hc ON hc.hub_name = s.hub_name
WHERE {{city_filter}} AND {{hub_filter}} AND {{accessory_filter}} AND {{sale_date_filter}}
GROUP BY ROLLUP (hc.city, s.hub_name, s.accessory)
ORDER BY hc.city, total_sales DESC;
-- ROLLUP gives you the per-hub rows AND the city subtotals AND the grand total
-- in one result set. Drop it to `GROUP BY hc.city, s.hub_name, s.accessory`
-- if you want a flat table for charting.


-- ============================================================================
-- QUERY B · INVENTORY — hub x city x accessory, with days of cover
-- ============================================================================
WITH hub_city AS (
    SELECT * FROM (VALUES
        ('Banaswadi','Bengaluru'), ('Bellandur','Bengaluru'),
        ('Bilekahalli','Bengaluru'), ('Hebbal','Bengaluru'),
        ('Hoodi','Bengaluru'), ('HSR Layout','Bengaluru'),
        ('RR Nagar','Bengaluru'), ('Yeshwanthpur','Bengaluru'),
        ('Sakinaka','Mumbai')
    ) AS t(hub_name, city)
),
legacy AS (   -- legacy units consumed stock too; without this, stock looks fat
    SELECT hub_name, COUNT(*) AS units
    FROM job_cards
    WHERE billed = 'Yes' AND jc_created_at < DATE '2026-08-19'
    GROUP BY 1
),
burn AS (     -- 30-day demand, app orders only (legacy flow is switched off)
    SELECT hub_name, product_name AS accessory, COUNT(*) AS units_30d
    FROM accessory_orders
    WHERE payment_status IN ('PAID','SUCCESS')
      AND order_placed_at >= CURRENT_DATE - 30
    GROUP BY 1, 2
)
SELECT
    hc.city,
    st.hub                                                 AS hub_name,
    st.product                                             AS accessory,
    st.current_stock,
    st.units_pending_installation                          AS awaiting_install,
    st.current_stock - st.units_pending_installation       AS free_stock,
    st.units_sold                                          AS app_units_sold,
    CASE WHEN st.product = 'Mobile Holder' THEN COALESCE(lg.units, 0) ELSE 0 END
                                                           AS legacy_units_sold,
    st.units_sold
      + CASE WHEN st.product = 'Mobile Holder' THEN COALESCE(lg.units, 0) ELSE 0 END
                                                           AS total_units_sold,
    ROUND(COALESCE(b.units_30d, 0) / 30.0, 2)              AS avg_daily_burn,
    CASE WHEN COALESCE(b.units_30d, 0) = 0 THEN NULL
         ELSE ROUND((st.current_stock - st.units_pending_installation)
                    / (b.units_30d / 30.0), 0)
    END                                                    AS days_of_cover,
    CASE WHEN st.current_stock = 0                              THEN 'Stocked out'
         WHEN COALESCE(b.units_30d,0) = 0 AND st.current_stock>0 THEN 'Dead stock - no demand'
         WHEN st.current_stock - st.units_pending_installation <= 0 THEN 'REORDER NOW'
         WHEN (st.current_stock - st.units_pending_installation)
              / NULLIF(b.units_30d/30.0, 0) < 7                 THEN 'Reorder this week'
         WHEN (st.current_stock - st.units_pending_installation)
              / NULLIF(b.units_30d/30.0, 0) > 90                THEN 'Overstocked - redistribute'
         ELSE 'OK'
    END                                                    AS action
FROM hub_stock st
LEFT JOIN hub_city hc ON hc.hub_name = st.hub
LEFT JOIN legacy   lg ON lg.hub_name = st.hub
LEFT JOIN burn     b  ON b.hub_name  = st.hub AND b.accessory = st.product
WHERE {{city_filter}} AND {{hub_filter}} AND {{accessory_filter}}
ORDER BY days_of_cover NULLS LAST, free_stock;
