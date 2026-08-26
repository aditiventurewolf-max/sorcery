-- ============================================================================
-- METABASE MODEL #2  ·  "Accessory Inventory — Hub x Accessory"
-- Save as a MODEL. Keeps inventory strictly separate from sales, but reuses
-- the same hub->city and accessory naming so the two can be joined 1:1 later.
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
product_map AS (
    SELECT * FROM (VALUES
        ('Mobile Holder','Mobile Holder','Mobile Stand'),
        ('Mobile Stand','Mobile Holder','Mobile Stand'),
        ('Bounce Helmet B','Bounce Helmet B','Helmet'),
        ('Bounce Helmet M','Bounce Helmet M','Helmet'),
        ('Helmet','Bounce Helmet B','Helmet')
    ) AS t(raw_product, accessory, accessory_group)
),

stock AS (
    SELECT
        s.hub                       AS hub_name,
        s.product                   AS raw_product,
        SUM(s.current_stock)        AS current_stock,
        SUM(s.units_sold)           AS units_sold_app,
        SUM(s.units_pending_installation) AS units_pending_install
    FROM hub_stock s
    GROUP BY 1, 2
),

-- Legacy job-card units consumed stock too. Without this, every Bengaluru hub
-- looks like it has more physical stock than it really does.
legacy_consumed AS (
    SELECT j.hub_name, 'Mobile Holder' AS raw_product, COUNT(*) AS units_sold_legacy
    FROM job_cards j
    WHERE j.billed = 'Yes'
      AND j.jc_created_at < DATE '2026-08-19'
    GROUP BY 1, 2
)

SELECT
    hc.city,
    st.hub_name,
    pm.accessory,
    pm.accessory_group,

    st.current_stock,
    st.units_pending_install,
    -- stock that is physically on the rack and NOT already promised to a rider
    st.current_stock - st.units_pending_install        AS free_stock,

    st.units_sold_app,
    COALESCE(lg.units_sold_legacy, 0)                  AS units_sold_legacy,
    st.units_sold_app + COALESCE(lg.units_sold_legacy, 0) AS total_units_sold,

    -- lifetime units that ever entered this hub (useful for GRN reconciliation)
    st.current_stock + st.units_sold_app + COALESCE(lg.units_sold_legacy, 0)
                                                       AS implied_units_received,

    CASE WHEN st.current_stock = 0 THEN 'Stocked Out'
         WHEN st.current_stock - st.units_pending_install <= 0 THEN 'Fully Committed'
         WHEN st.current_stock < 10 THEN 'Low (<10)'
         ELSE 'Healthy'
    END                                                AS stock_health
FROM stock st
LEFT JOIN hub_city    hc ON hc.hub_name    = st.hub_name
LEFT JOIN product_map pm ON pm.raw_product = st.raw_product
