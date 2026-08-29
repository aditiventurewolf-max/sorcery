-- ============================================================================
-- PASTE-READY. No placeholders. Nothing to fill in.
--
-- The locations table is not needed: rental_location_id -> hub is hardcoded
-- below, recovered by joining order IDs between the orders export and the
-- pending-installation list. Verified: no conflicts across all 9 hubs.
--
-- product_id is likewise mapped inline:  2=Mobile Holder @199,
-- 4=Bounce Helmet M @399, 3=Bounce Helmet B @499, 1=@1 test SKU (excluded).
--
-- A SALE = status IN ('paid','installed'). 'pending_payment' is an abandoned
-- cart - it is NOT a sale, and counting it is what inflates hub_stock.units_sold.
-- ============================================================================


-- ###########################################################################
-- QUERY 1 · SALES — per hub x city x accessory, legacy job cards included
-- ###########################################################################
WITH hub_map AS (
    SELECT * FROM (VALUES
        (1,  'Banaswadi',    'Bengaluru'),
        (2,  'RR Nagar',     'Bengaluru'),
        (8,  'Hoodi',        'Bengaluru'),
        (10, 'HSR Layout',   'Bengaluru'),
        (28, 'Yeshwanthpur', 'Bengaluru'),
        (29, 'Bilekahalli',  'Bengaluru'),
        (37, 'Bellandur',    'Bengaluru'),
        (45, 'Hebbal',       'Bengaluru'),
        (62, 'Sakinaka',     'Mumbai')
    ) AS t(loc_id, hub_name, city)
),
prod_map AS (
    SELECT * FROM (VALUES
        (2, 'Mobile Holder'),
        (3, 'Bounce Helmet B'),
        (4, 'Bounce Helmet M')
    ) AS t(pid, accessory)
),
sales AS (
    SELECT hm.city, hm.hub_name, pm.accessory,
           o.paid_at::date        AS sale_date,
           'App Order'            AS sale_source,
           o.price                AS revenue,
           (o.status = 'installed') AS is_installed
    FROM shop_orders o
    JOIN hub_map  hm ON hm.loc_id = o.rental_location_id
    JOIN prod_map pm ON pm.pid    = o.product_id
    WHERE o.status IN ('paid','installed')

    UNION ALL

    SELECT CASE WHEN j.hub_name = 'Sakinaka' THEN 'Mumbai' ELSE 'Bengaluru' END,
           j.hub_name,
           'Mobile Holder',
           j.jc_created_at::date,
           'Job Card (legacy)',
           199,
           TRUE
    FROM job_cards j
    WHERE j.billed = 'Yes'
      AND j.dms_jc_id IS NOT NULL
      AND j.jc_created_at < DATE '2026-08-19'   -- cutover; prevents double-count
)
SELECT
    city,
    hub_name,
    accessory,
    COUNT(*)                                                   AS total_sales,
    COUNT(*) FILTER (WHERE sale_source = 'App Order')          AS app_sales,
    COUNT(*) FILTER (WHERE sale_source = 'Job Card (legacy)')  AS legacy_jc_sales,
    SUM(revenue)                                               AS total_revenue,
    COUNT(*) FILTER (WHERE NOT is_installed)                   AS awaiting_install,
    COUNT(*) FILTER (WHERE sale_date >= CURRENT_DATE - 7)      AS sales_last_7d,
    MAX(sale_date)                                             AS last_sale_on
FROM sales
GROUP BY ROLLUP (city, hub_name, accessory)
ORDER BY city, total_sales DESC;


-- ###########################################################################
-- QUERY 2 · INVENTORY — stock, burn rate, days of cover, reorder action
-- Burn is measured over the ACTUAL app window (first paid order -> today),
-- not a fixed 30 days. With only ~8 days of app history a /30 divisor
-- understates daily demand roughly 4x and hides real stockouts.
-- ###########################################################################
WITH hub_map AS (
    SELECT * FROM (VALUES
        (1,'Banaswadi','Bengaluru'), (2,'RR Nagar','Bengaluru'),
        (8,'Hoodi','Bengaluru'), (10,'HSR Layout','Bengaluru'),
        (28,'Yeshwanthpur','Bengaluru'), (29,'Bilekahalli','Bengaluru'),
        (37,'Bellandur','Bengaluru'), (45,'Hebbal','Bengaluru'),
        (62,'Sakinaka','Mumbai')
    ) AS t(loc_id, hub_name, city)
),
prod_map AS (
    SELECT * FROM (VALUES
        (2,'Mobile Holder'), (3,'Bounce Helmet B'), (4,'Bounce Helmet M')
    ) AS t(pid, accessory)
),
window_days AS (
    SELECT GREATEST(DATE_PART('day', NOW() - MIN(paid_at)), 1) AS days
    FROM shop_orders WHERE status IN ('paid','installed')
),
real_sales AS (
    SELECT hm.hub_name, pm.accessory,
           COUNT(*)                                    AS units_sold,
           COUNT(*) FILTER (WHERE o.status = 'paid')   AS awaiting_install
    FROM shop_orders o
    JOIN hub_map  hm ON hm.loc_id = o.rental_location_id
    JOIN prod_map pm ON pm.pid    = o.product_id
    WHERE o.status IN ('paid','installed')
    GROUP BY 1, 2
),
legacy AS (
    SELECT hub_name, COUNT(*) AS units FROM job_cards
    WHERE billed = 'Yes' AND jc_created_at < DATE '2026-08-19'
    GROUP BY 1
)
SELECT
    hm.city,
    st.hub                                              AS hub_name,
    st.product                                          AS accessory,
    st.current_stock,
    COALESCE(rs.awaiting_install, 0)                    AS awaiting_install,
    st.current_stock - COALESCE(rs.awaiting_install,0)  AS free_stock,
    COALESCE(rs.units_sold, 0)                          AS app_units_sold,
    CASE WHEN st.product = 'Mobile Holder' THEN COALESCE(lg.units,0) ELSE 0 END
                                                        AS legacy_units_sold,
    COALESCE(rs.units_sold,0)
      + CASE WHEN st.product='Mobile Holder' THEN COALESCE(lg.units,0) ELSE 0 END
                                                        AS total_units_sold,
    st.units_sold - COALESCE(rs.units_sold, 0)          AS unpaid_carts_inflating_stock_table,
    ROUND(COALESCE(rs.units_sold,0) / w.days, 2)        AS burn_per_day,
    CASE WHEN COALESCE(rs.units_sold,0) = 0 THEN NULL
         ELSE ROUND((st.current_stock - COALESCE(rs.awaiting_install,0))
                    / (rs.units_sold / w.days), 1)
    END                                                 AS days_of_cover,
    CASE WHEN st.current_stock = 0                          THEN 'Stocked out'
         WHEN COALESCE(rs.units_sold,0) = 0                 THEN 'Dead stock - zero paid demand'
         WHEN (st.current_stock - COALESCE(rs.awaiting_install,0))
              / (rs.units_sold / w.days) < 7                THEN 'REORDER NOW'
         WHEN (st.current_stock - COALESCE(rs.awaiting_install,0))
              / (rs.units_sold / w.days) < 14               THEN 'Reorder this week'
         WHEN (st.current_stock - COALESCE(rs.awaiting_install,0))
              / (rs.units_sold / w.days) > 90               THEN 'Overstocked - redistribute'
         ELSE 'OK'
    END                                                 AS action
FROM hub_stock st
CROSS JOIN window_days w
LEFT JOIN hub_map    hm ON hm.hub_name = st.hub
LEFT JOIN real_sales rs ON rs.hub_name = st.hub AND rs.accessory = st.product
LEFT JOIN legacy     lg ON lg.hub_name = st.hub
ORDER BY days_of_cover NULLS LAST, free_stock;


-- ###########################################################################
-- QUERY 3 · CHECKOUT CONVERSION — why Helmet B isn't selling
-- ###########################################################################
WITH hub_map AS (
    SELECT * FROM (VALUES
        (1,'Banaswadi','Bengaluru'), (2,'RR Nagar','Bengaluru'),
        (8,'Hoodi','Bengaluru'), (10,'HSR Layout','Bengaluru'),
        (28,'Yeshwanthpur','Bengaluru'), (29,'Bilekahalli','Bengaluru'),
        (37,'Bellandur','Bengaluru'), (45,'Hebbal','Bengaluru'),
        (62,'Sakinaka','Mumbai')
    ) AS t(loc_id, hub_name, city)
),
prod_map AS (
    SELECT * FROM (VALUES
        (2,'Mobile Holder',199), (3,'Bounce Helmet B',499), (4,'Bounce Helmet M',399)
    ) AS t(pid, accessory, price)
)
SELECT
    hm.city,
    hm.hub_name,
    pm.accessory,
    pm.price,
    COUNT(*)                                                  AS checkouts_started,
    COUNT(*) FILTER (WHERE o.status IN ('paid','installed'))   AS paid,
    COUNT(*) FILTER (WHERE o.status = 'pending_payment')       AS abandoned,
    ROUND(100.0 * COUNT(*) FILTER (WHERE o.status IN ('paid','installed'))
          / NULLIF(COUNT(*),0), 1)                            AS conversion_pct,
    SUM(o.price) FILTER (WHERE o.status = 'pending_payment')   AS revenue_lost,
    ROUND(AVG(EXTRACT(EPOCH FROM (o.picked_up_at - o.paid_at))/3600.0)
          ) FILTER (WHERE o.status='installed')               AS avg_hrs_pay_to_install
FROM shop_orders o
JOIN hub_map  hm ON hm.loc_id = o.rental_location_id
JOIN prod_map pm ON pm.pid    = o.product_id
GROUP BY hm.city, hm.hub_name, pm.accessory, pm.price
ORDER BY abandoned DESC;
