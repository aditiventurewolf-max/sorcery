-- ============================================================================
-- FINAL QUERIES · written against the ACTUAL shop_orders schema
-- ----------------------------------------------------------------------------
-- Supersedes 04_standalone_paste_ready.sql, which guessed at column names.
-- Confirmed from the query result export (320 rows, 26 Aug 2026):
--
--   status         enum: 'pending_payment' | 'paid' | 'installed'
--                  A SALE IS status IN ('paid','installed'). Nothing else.
--                  'pending_payment' = abandoned cart, money never captured.
--   paid_at        set for every paid/installed row, null otherwise -> sale ts
--   picked_up_at   set iff status='installed' -> installation ts
--   price          per-order rupee value, so revenue is available (199/399/499)
--   product_id     2 = Mobile Holder @199, 4 = Bounce Helmet M @399,
--                  3 = Bounce Helmet B @499, 1 = @1 TEST ORDER (exclude)
--   rental_location_id  -> hub. Join your locations table; confirmed
--                  28 = Yeshwanthpur, 62 = Sakinaka.
--   installed_by   staff id, only populated on installed rows
-- ============================================================================


-- ---------------------------------------------------------------------------
-- QUERY A · SALES  — city x hub x accessory, legacy job cards folded in
-- ---------------------------------------------------------------------------
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
    -- LEG 1: app orders. Money actually captured.
    SELECT
        rl.name                     AS hub_name,
        p.name                      AS accessory,
        o.paid_at::date             AS sale_date,
        'App Order'                 AS sale_source,
        o.price                     AS revenue,
        o.status = 'installed'      AS is_installed
    FROM shop_orders o                                   -- <<< your table
    JOIN rental_locations rl ON rl.id = o.rental_location_id
    JOIN products         p  ON p.id  = o.product_id
    WHERE o.status IN ('paid','installed')
      AND o.product_id <> 1          -- drop the ₹1 test SKU

    UNION ALL

    -- LEG 2: legacy DMS mobile-stand job cards. billed='Yes' is the sale.
    -- No price on job cards, so value them at the current Mobile Holder rate.
    SELECT
        j.hub_name,
        'Mobile Holder'             AS accessory,
        j.jc_created_at::date       AS sale_date,
        'Job Card (legacy)'         AS sale_source,
        199                         AS revenue,
        TRUE                        AS is_installed
    FROM job_cards j                                     -- <<< your table
    WHERE j.billed = 'Yes'
      AND j.dms_jc_id IS NOT NULL
      AND j.jc_created_at < DATE '2026-08-19'   -- cutover, prevents double-count
)
SELECT
    hc.city,
    s.hub_name,
    s.accessory,
    COUNT(*)                                                     AS total_sales,
    COUNT(*) FILTER (WHERE s.sale_source = 'App Order')          AS app_sales,
    COUNT(*) FILTER (WHERE s.sale_source = 'Job Card (legacy)')  AS legacy_jc_sales,
    SUM(s.revenue)                                               AS total_revenue,
    SUM(s.revenue) FILTER (WHERE s.sale_source = 'App Order')    AS app_revenue,
    COUNT(*) FILTER (WHERE NOT s.is_installed)                   AS awaiting_install,
    COUNT(*) FILTER (WHERE s.sale_date >= CURRENT_DATE - 7)      AS sales_last_7d,
    COUNT(*) FILTER (WHERE s.sale_date >= CURRENT_DATE - 30)     AS sales_last_30d,
    MAX(s.sale_date)                                             AS last_sale_on
FROM sales s
LEFT JOIN hub_city hc ON hc.hub_name = s.hub_name
WHERE {{city_filter}} AND {{hub_filter}} AND {{accessory_filter}} AND {{sale_date_filter}}
GROUP BY ROLLUP (hc.city, s.hub_name, s.accessory)
ORDER BY hc.city, total_sales DESC;


-- ---------------------------------------------------------------------------
-- QUERY B · INVENTORY — city x hub x accessory, days of cover
-- Recomputes units_sold from paid orders instead of trusting hub_stock,
-- because hub_stock.units_sold counts abandoned carts (see notes at bottom).
-- ---------------------------------------------------------------------------
WITH hub_city AS (
    SELECT * FROM (VALUES
        ('Banaswadi','Bengaluru'), ('Bellandur','Bengaluru'),
        ('Bilekahalli','Bengaluru'), ('Hebbal','Bengaluru'),
        ('Hoodi','Bengaluru'), ('HSR Layout','Bengaluru'),
        ('RR Nagar','Bengaluru'), ('Yeshwanthpur','Bengaluru'),
        ('Sakinaka','Mumbai')
    ) AS t(hub_name, city)
),
real_sales AS (
    SELECT rl.name AS hub_name, p.name AS accessory,
           COUNT(*)                                                AS units_sold,
           COUNT(*) FILTER (WHERE o.status = 'paid')               AS awaiting_install,
           COUNT(*) FILTER (WHERE o.paid_at >= CURRENT_DATE - 30)  AS units_30d
    FROM shop_orders o
    JOIN rental_locations rl ON rl.id = o.rental_location_id
    JOIN products         p  ON p.id  = o.product_id
    WHERE o.status IN ('paid','installed') AND o.product_id <> 1
    GROUP BY 1, 2
),
legacy AS (
    SELECT hub_name, COUNT(*) AS units
    FROM job_cards
    WHERE billed = 'Yes' AND jc_created_at < DATE '2026-08-19'
    GROUP BY 1
)
SELECT
    hc.city,
    st.hub                                                  AS hub_name,
    st.product                                              AS accessory,
    st.current_stock,
    COALESCE(rs.awaiting_install, 0)                        AS awaiting_install,
    st.current_stock - COALESCE(rs.awaiting_install, 0)     AS free_stock,
    COALESCE(rs.units_sold, 0)                              AS app_units_sold,
    CASE WHEN st.product = 'Mobile Holder' THEN COALESCE(lg.units, 0) ELSE 0 END
                                                            AS legacy_units_sold,
    COALESCE(rs.units_sold, 0)
      + CASE WHEN st.product = 'Mobile Holder' THEN COALESCE(lg.units,0) ELSE 0 END
                                                            AS total_units_sold,
    st.units_sold                                           AS units_sold_per_stock_table,
    st.units_sold - COALESCE(rs.units_sold, 0)              AS unpaid_carts_overstated_by,
    ROUND(COALESCE(rs.units_30d, 0) / 30.0, 2)              AS avg_daily_burn,
    CASE WHEN COALESCE(rs.units_30d, 0) = 0 THEN NULL
         ELSE ROUND((st.current_stock - COALESCE(rs.awaiting_install,0))
                    / (rs.units_30d / 30.0), 0)
    END                                                     AS days_of_cover,
    CASE WHEN st.current_stock = 0                                 THEN 'Stocked out'
         WHEN COALESCE(rs.units_30d,0) = 0 AND st.current_stock>0   THEN 'Dead stock - no demand'
         WHEN st.current_stock - COALESCE(rs.awaiting_install,0)<=0 THEN 'REORDER NOW'
         WHEN (st.current_stock - COALESCE(rs.awaiting_install,0))
              / NULLIF(rs.units_30d/30.0, 0) < 7                    THEN 'Reorder this week'
         WHEN (st.current_stock - COALESCE(rs.awaiting_install,0))
              / NULLIF(rs.units_30d/30.0, 0) > 90                   THEN 'Overstocked - redistribute'
         ELSE 'OK'
    END                                                     AS action
FROM hub_stock st
LEFT JOIN hub_city   hc ON hc.hub_name = st.hub
LEFT JOIN real_sales rs ON rs.hub_name = st.hub AND rs.accessory = st.product
LEFT JOIN legacy     lg ON lg.hub_name = st.hub
WHERE {{city_filter}} AND {{hub_filter}} AND {{accessory_filter}}
ORDER BY days_of_cover NULLS LAST, free_stock;


-- ---------------------------------------------------------------------------
-- QUERY C · CHECKOUT DROP-OFF — the biggest number in this dataset
-- 227 of 320 orders never captured payment. That is the funnel, per hub.
-- ---------------------------------------------------------------------------
SELECT
    hc.city,
    rl.name                                                      AS hub_name,
    p.name                                                       AS accessory,
    COUNT(*)                                                     AS orders_started,
    COUNT(*) FILTER (WHERE o.status IN ('paid','installed'))      AS orders_paid,
    COUNT(*) FILTER (WHERE o.status = 'pending_payment')          AS abandoned,
    ROUND(100.0 * COUNT(*) FILTER (WHERE o.status IN ('paid','installed'))
          / NULLIF(COUNT(*), 0), 1)                              AS payment_conversion_pct,
    SUM(o.price) FILTER (WHERE o.status = 'pending_payment')      AS revenue_lost,
    ROUND(AVG(EXTRACT(EPOCH FROM (o.picked_up_at - o.paid_at))/3600.0)
          ) FILTER (WHERE o.status = 'installed')                AS avg_hours_pay_to_install
FROM shop_orders o
JOIN rental_locations rl ON rl.id = o.rental_location_id
JOIN products         p  ON p.id  = o.product_id
LEFT JOIN hub_city    hc ON hc.hub_name = rl.name
WHERE o.product_id <> 1
  AND {{city_filter}} AND {{hub_filter}} AND {{accessory_filter}}
GROUP BY hc.city, rl.name, p.name
ORDER BY abandoned DESC;
