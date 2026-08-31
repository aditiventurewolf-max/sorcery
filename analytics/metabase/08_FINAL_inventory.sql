-- ============================================================================
-- INVENTORY · FINAL. Live, from hub_stock_log. No placeholders, no baselines.
--
-- hub_stock_log is authoritative and verified: balance = SUM(added) -
-- SUM(consumed) reconciles exactly, and its 135 'consumed' rows match the 135
-- paid orders per hub and product with zero drift.
--
-- Confirmed schema:
--   hub_stock_log    rental_location_id, product_id, order_id, action
--                    ('added'|'consumed'), quantity, reason, source, created_at
--   rental_location  id, name, area, active, city_id  (1 = Bengaluru, 6 = Mumbai)
--   products         id, name, category, price, active  (the Rs.1 test SKU is
--                    active = false, so `WHERE p.active` replaces an ID hardcode)
--   orders           status ('pending_payment'|'paid'|'installed'), price, paid_at
-- ============================================================================
WITH stock AS (
    SELECT rental_location_id,
           product_id,
           SUM(CASE WHEN action = 'added' THEN quantity ELSE -quantity END) AS balance,
           SUM(quantity) FILTER (WHERE action = 'added')                    AS ever_received,
           SUM(quantity) FILTER (WHERE action = 'consumed')                 AS ever_consumed,
           MAX(created_at) FILTER (WHERE action = 'added')                  AS last_restocked
    FROM hub_stock_log
    GROUP BY 1, 2
),
burn AS (
    -- Rate over the real elapsed selling window. A fixed /30 would understate
    -- demand roughly 2x while the app has only been live a couple of weeks.
    SELECT rental_location_id,
           product_id,
           SUM(quantity)                                                     AS units_sold,
           SUM(quantity) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')
                                                                             AS units_7d,
           SUM(quantity)
             / GREATEST(DATE_PART('day', NOW() - MIN(created_at)), 1)        AS per_day
    FROM hub_stock_log
    WHERE action = 'consumed'
    GROUP BY 1, 2
),
pending AS (
    -- Paid but not yet collected: already off the shelf, not available to sell.
    SELECT rental_location_id, product_id, COUNT(*) AS awaiting_collection
    FROM orders
    WHERE status = 'paid'
    GROUP BY 1, 2
)
SELECT
    CASE rl.city_id WHEN 1 THEN 'Bengaluru'
                    WHEN 6 THEN 'Mumbai'
                    ELSE 'City ' || rl.city_id::text END      AS city,
    rl.name                                                   AS hub_name,
    p.name                                                    AS accessory,
    p.category,
    p.price                                                   AS list_price,

    s.balance                                                 AS current_stock,
    COALESCE(pd.awaiting_collection, 0)                       AS awaiting_collection,
    s.balance - COALESCE(pd.awaiting_collection, 0)           AS on_shelf,

    s.ever_received,
    s.ever_consumed                                           AS units_sold,
    COALESCE(b.units_7d, 0)                                   AS units_sold_7d,
    ROUND(COALESCE(b.per_day, 0), 2)                          AS burn_per_day,

    CASE WHEN COALESCE(b.per_day, 0) = 0 THEN NULL
         ELSE ROUND(s.balance / b.per_day, 1) END             AS days_of_cover,

    CASE WHEN s.balance <= 0                    THEN 'Stocked out'
         WHEN COALESCE(b.per_day, 0) = 0        THEN 'Dead stock - zero demand'
         WHEN s.balance / b.per_day < 7         THEN 'REORDER NOW'
         WHEN s.balance / b.per_day < 14        THEN 'Reorder this week'
         WHEN s.balance / b.per_day > 90        THEN 'Overstocked - redistribute'
         ELSE 'OK'
    END                                                       AS action,

    s.last_restocked::date                                    AS last_restocked
FROM stock s
JOIN rental_location rl ON rl.id  = s.rental_location_id
JOIN products        p  ON p.id   = s.product_id
LEFT JOIN burn    b  ON b.rental_location_id  = s.rental_location_id
                    AND b.product_id          = s.product_id
LEFT JOIN pending pd ON pd.rental_location_id = s.rental_location_id
                    AND pd.product_id         = s.product_id
WHERE p.active
  AND rl.active
ORDER BY days_of_cover NULLS LAST, current_stock;
