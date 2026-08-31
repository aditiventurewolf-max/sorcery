-- ============================================================================
-- INVENTORY + DAYS OF COVER, using the hub sheet as the stock baseline.
--
-- Why a baseline instead of a live stock table: hub_stock_log is an event log,
-- and the sheet's inventory column is a reconciled point-in-time count
-- (Expected + Pilot - Legacy Sold = Inventory, which checks out for every hub).
-- Current stock is therefore: sheet inventory, minus app units sold since.
--
-- Swap this whole CTE for hub_stock_log once you have its columns.
-- ============================================================================
WITH baseline AS (
    -- Mobile Stand figures are reconciled and trustworthy.
    -- Helmet figures are the EXPECTED allocation - the sheet's "Received"
    -- column is blank for every Bengaluru hub, so treat these as provisional.
    SELECT * FROM (VALUES
        ('Yeshwanthpur','Mobile Holder',   26, 'confirmed'),
        ('RR Nagar',    'Mobile Holder',   69, 'confirmed'),
        ('Hebbal',      'Mobile Holder',   59, 'confirmed'),
        ('Bilekahalli', 'Mobile Holder',  120, 'confirmed'),
        ('Banaswadi',   'Mobile Holder',  136, 'confirmed'),
        ('HSR Layout',  'Mobile Holder',  138, 'confirmed'),
        ('Bellandur',   'Mobile Holder',  150, 'confirmed'),
        ('Hoodi',       'Mobile Holder',  150, 'confirmed'),
        ('Sakinaka',    'Mobile Holder',   50, 'expected only'),
        ('Yeshwanthpur','Bounce Helmet B', 48, 'expected only'),
        ('RR Nagar',    'Bounce Helmet B', 48, 'expected only'),
        ('Hebbal',      'Bounce Helmet B', 48, 'expected only'),
        ('Bilekahalli', 'Bounce Helmet B', 48, 'expected only'),
        ('Banaswadi',   'Bounce Helmet B', 48, 'expected only'),
        ('HSR Layout',  'Bounce Helmet B', 48, 'expected only'),
        ('Bellandur',   'Bounce Helmet B', 72, 'expected only'),
        ('Hoodi',       'Bounce Helmet B', 72, 'expected only'),
        ('Sakinaka',    'Bounce Helmet M', 60, 'expected only')
    ) AS t(hub_name, accessory, baseline_stock, baseline_confidence)
),
canon AS (
    SELECT
        CASE
            WHEN LOWER(rl.location_name) LIKE '%yeshwanthpur%' THEN 'Yeshwanthpur'
            WHEN LOWER(rl.location_name) LIKE '%rr nagar%'     THEN 'RR Nagar'
            WHEN LOWER(rl.location_name) LIKE '%bellandur%'    THEN 'Bellandur'
            WHEN LOWER(rl.location_name) LIKE '%hebbal%'       THEN 'Hebbal'
            WHEN LOWER(rl.location_name) LIKE '%banaswadi%'    THEN 'Banaswadi'
            WHEN LOWER(rl.location_name) LIKE '%hsr%'          THEN 'HSR Layout'
            WHEN LOWER(rl.location_name) LIKE '%bilekahalli%'  THEN 'Bilekahalli'
            WHEN LOWER(rl.location_name) LIKE '%hoodi%'        THEN 'Hoodi'
            WHEN LOWER(rl.location_name) LIKE '%sakinaka%'     THEN 'Sakinaka'
            ELSE rl.location_name
        END              AS hub_name,
        p.name           AS accessory,
        o.status,
        o.paid_at
    FROM orders o
    JOIN rental_location rl ON rl.id = o.rental_location_id
    JOIN products        p  ON p.id  = o.product_id
    WHERE o.status IN ('paid','installed')
      AND o.product_id <> 1
      AND LOWER(rl.location_name) NOT LIKE '%test%'
),
app_sold AS (
    SELECT hub_name, accessory,
           COUNT(*)                                  AS units_sold,
           COUNT(*) FILTER (WHERE status = 'paid')   AS awaiting_install
    FROM canon GROUP BY 1, 2
),
window_days AS (
    -- real elapsed app-selling window; a fixed /30 understates burn badly
    -- while the app has only been live a couple of weeks
    SELECT GREATEST(DATE_PART('day', NOW() - MIN(paid_at)), 1) AS days FROM canon
)
SELECT
    CASE WHEN b.hub_name = 'Sakinaka' THEN 'Mumbai' ELSE 'Bengaluru' END AS city,
    b.hub_name,
    b.accessory,
    b.baseline_stock,
    COALESCE(a.units_sold, 0)                              AS sold_since_baseline,
    b.baseline_stock - COALESCE(a.units_sold, 0)           AS current_stock,
    COALESCE(a.awaiting_install, 0)                        AS awaiting_install,
    b.baseline_stock - COALESCE(a.units_sold,0)
      - COALESCE(a.awaiting_install,0)                     AS free_stock,
    ROUND(COALESCE(a.units_sold,0) / w.days, 2)            AS burn_per_day,
    CASE WHEN COALESCE(a.units_sold,0) = 0 THEN NULL
         ELSE ROUND((b.baseline_stock - COALESCE(a.units_sold,0)
                     - COALESCE(a.awaiting_install,0))
                    / (a.units_sold / w.days), 1)
    END                                                    AS days_of_cover,
    CASE
        WHEN b.baseline_stock - COALESCE(a.units_sold,0) <= 0 THEN 'Stocked out'
        WHEN COALESCE(a.units_sold,0) = 0                     THEN 'Dead stock - zero paid demand'
        WHEN (b.baseline_stock - COALESCE(a.units_sold,0) - COALESCE(a.awaiting_install,0))
             / (a.units_sold / w.days) < 7                    THEN 'REORDER NOW'
        WHEN (b.baseline_stock - COALESCE(a.units_sold,0) - COALESCE(a.awaiting_install,0))
             / (a.units_sold / w.days) < 14                   THEN 'Reorder this week'
        WHEN (b.baseline_stock - COALESCE(a.units_sold,0) - COALESCE(a.awaiting_install,0))
             / (a.units_sold / w.days) > 90                   THEN 'Overstocked - redistribute'
        ELSE 'OK'
    END                                                    AS action,
    b.baseline_confidence
FROM baseline b
CROSS JOIN window_days w
LEFT JOIN app_sold a ON a.hub_name = b.hub_name AND a.accessory = b.accessory
ORDER BY days_of_cover NULLS LAST, free_stock;
