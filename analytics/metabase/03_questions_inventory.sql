-- ============================================================================
-- INVENTORY QUESTIONS  (replace 124 with your Inventory model's real ID)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Q5 · INVENTORY BY HUB x ACCESSORY  (the replenishment table)
-- ---------------------------------------------------------------------------
SELECT
    i.city,
    i.hub_name,
    i.accessory,
    i.current_stock,
    i.units_pending_install,
    i.free_stock,
    i.total_units_sold,
    i.stock_health,
    -- burn rate from the LAST 30 DAYS of real demand, both flows included
    COALESCE(d.units_30d, 0)                                        AS units_sold_30d,
    ROUND(COALESCE(d.units_30d, 0) / 30.0, 2)                       AS avg_daily_burn,
    CASE WHEN COALESCE(d.units_30d, 0) = 0 THEN NULL
         ELSE ROUND(i.free_stock / (d.units_30d / 30.0), 0)
    END                                                             AS days_of_cover,
    CASE WHEN COALESCE(d.units_30d,0) = 0 AND i.current_stock > 0 THEN 'Dead stock - no demand'
         WHEN i.free_stock <= 0                                    THEN 'REORDER NOW'
         WHEN i.free_stock / NULLIF(d.units_30d/30.0,0) < 7        THEN 'Reorder this week'
         WHEN i.free_stock / NULLIF(d.units_30d/30.0,0) > 90       THEN 'Overstocked - redistribute'
         ELSE 'OK'
    END                                                             AS action
FROM {{#124-accessory-inventory}} i
LEFT JOIN (
    SELECT hub_name, accessory, SUM(units) AS units_30d
    FROM {{#123-accessory-sales-unified}}
    WHERE sale_date >= CURRENT_DATE - 30
    GROUP BY 1, 2
) d ON d.hub_name = i.hub_name AND d.accessory = i.accessory
WHERE {{city_filter}} AND {{hub_filter}} AND {{accessory_filter}}
ORDER BY days_of_cover NULLS LAST, i.free_stock;
-- Conditional formatting: days_of_cover < 7 red, > 90 amber. stock_health and
-- action as coloured category columns.


-- ---------------------------------------------------------------------------
-- Q6 · INVENTORY BY CITY x ACCESSORY  (network position)
-- ---------------------------------------------------------------------------
SELECT
    city,
    accessory,
    SUM(current_stock)                                              AS city_stock,
    SUM(free_stock)                                                 AS city_free_stock,
    SUM(units_pending_install)                                      AS awaiting_install,
    SUM(total_units_sold)                                           AS total_units_sold,
    COUNT(*) FILTER (WHERE stock_health = 'Stocked Out')            AS hubs_stocked_out,
    COUNT(*) FILTER (WHERE stock_health IN ('Low (<10)','Fully Committed'))
                                                                    AS hubs_at_risk,
    ROUND(100.0 * SUM(total_units_sold)
          / NULLIF(SUM(implied_units_received), 0), 1)              AS sell_through_pct
FROM {{#124-accessory-inventory}} i
WHERE {{city_filter}} AND {{accessory_filter}}
GROUP BY city, accessory
ORDER BY city, accessory;
-- COUNT(*) FILTER (...) is Postgres. MySQL: SUM(stock_health = 'Stocked Out').


-- ---------------------------------------------------------------------------
-- Q7 · INVENTORY BY ACCESSORY (SKU-level buying view)
-- ---------------------------------------------------------------------------
SELECT
    accessory,
    accessory_group,
    SUM(current_stock)                                              AS network_stock,
    SUM(free_stock)                                                 AS network_free_stock,
    SUM(total_units_sold)                                           AS network_sold,
    COUNT(DISTINCT hub_name)                                        AS hubs_stocking,
    MIN(current_stock)                                              AS min_hub_stock,
    MAX(current_stock)                                              AS max_hub_stock,
    -- spread between the fattest and leanest hub = redistribution opportunity
    MAX(current_stock) - MIN(current_stock)                         AS imbalance
FROM {{#124-accessory-inventory}} i
WHERE {{city_filter}}
GROUP BY accessory, accessory_group
ORDER BY network_sold DESC;


-- ---------------------------------------------------------------------------
-- Q8 · PENDING INSTALLATION AGEING  (the SLA / ops-chase question)
-- ---------------------------------------------------------------------------
SELECT
    hc.city,
    o.hub_name,
    o.product_name                                                  AS accessory,
    COUNT(*)                                                        AS pending_orders,
    COUNT(DISTINCT o.rider_phone)                                   AS distinct_riders,
    ROUND(AVG(o.days_pending_since_paid), 1)                        AS avg_days_pending,
    MAX(o.days_pending_since_paid)                                  AS oldest_days_pending,
    COUNT(*) FILTER (WHERE o.days_pending_since_paid >= 3)          AS breaching_3d_sla,
    -- one rider with many identical pending orders is almost always test /
    -- duplicate data, not real demand. Surface it, don't silently include it.
    MAX(per_rider.cnt)                                              AS max_orders_one_rider
FROM accessory_orders o
LEFT JOIN (VALUES
        ('Banaswadi','Bengaluru'), ('Bellandur','Bengaluru'),
        ('Bilekahalli','Bengaluru'), ('Hebbal','Bengaluru'),
        ('Hoodi','Bengaluru'), ('HSR Layout','Bengaluru'),
        ('RR Nagar','Bengaluru'), ('Yeshwanthpur','Bengaluru'),
        ('Sakinaka','Mumbai')
     ) AS hc(hub_name, city) ON hc.hub_name = o.hub_name
LEFT JOIN LATERAL (
    SELECT COUNT(*) AS cnt FROM accessory_orders o2
    WHERE o2.rider_phone = o.rider_phone AND o2.installation_status = 'PENDING'
) per_rider ON TRUE
WHERE o.installation_status = 'PENDING'          -- <<< match your enum
GROUP BY hc.city, o.hub_name, o.product_name
ORDER BY breaching_3d_sla DESC, avg_days_pending DESC;
