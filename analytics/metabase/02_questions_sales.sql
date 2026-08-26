-- ============================================================================
-- SALES QUESTIONS  (each block = one saved Metabase question)
-- All of them read the model, so use Metabase's {{#123-accessory-sales-unified}}
-- card reference — replace 123 with the real model ID after you save Model #1.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Q1 · SALES BY HUB x ACCESSORY  (the main operator table)
-- ---------------------------------------------------------------------------
SELECT
    city,
    hub_name,
    accessory,
    SUM(units)                                                       AS total_sales,
    SUM(CASE WHEN sale_source = 'App Order'         THEN units END)  AS app_sales,
    SUM(CASE WHEN sale_source = 'Job Card (legacy)' THEN units END)  AS legacy_jc_sales,
    SUM(CASE WHEN sale_date >= CURRENT_DATE - 7  THEN units END)     AS sales_last_7d,
    SUM(CASE WHEN sale_date >= CURRENT_DATE - 30 THEN units END)     AS sales_last_30d,
    ROUND(SUM(units) / 4.0, 1)                                       AS avg_units_per_week,
    MAX(sale_date)                                                   AS last_sale_on
FROM {{#123-accessory-sales-unified}} s
WHERE {{city_filter}}
  AND {{hub_filter}}
  AND {{accessory_filter}}
  AND {{sale_date_filter}}
GROUP BY city, hub_name, accessory
ORDER BY total_sales DESC;

-- Filter widgets to add (Variables sidebar -> Field Filter):
--   city_filter      -> Field Filter -> city          (optional, dropdown)
--   hub_filter       -> Field Filter -> hub_name      (optional, dropdown)
--   accessory_filter -> Field Filter -> accessory     (optional, dropdown)
--   sale_date_filter -> Field Filter -> sale_date     (optional, date range)
-- Mark ALL FOUR as NOT required; Metabase turns an empty field filter into
-- TRUE, so one question serves the all-India view and every drilldown.


-- ---------------------------------------------------------------------------
-- Q2 · SALES BY CITY x ACCESSORY  (the leadership rollup)
-- ---------------------------------------------------------------------------
SELECT
    city,
    accessory,
    COUNT(DISTINCT hub_name)                                        AS active_hubs,
    SUM(units)                                                      AS total_sales,
    SUM(CASE WHEN sale_source = 'App Order'         THEN units END) AS app_sales,
    SUM(CASE WHEN sale_source = 'Job Card (legacy)' THEN units END) AS legacy_jc_sales,
    ROUND(SUM(units)::numeric / NULLIF(COUNT(DISTINCT hub_name), 0), 1)
                                                                    AS sales_per_hub,
    ROUND(100.0 * SUM(units) / NULLIF(SUM(SUM(units)) OVER (PARTITION BY city), 0), 1)
                                                                    AS pct_of_city_mix
FROM {{#123-accessory-sales-unified}} s
WHERE {{city_filter}} AND {{accessory_filter}} AND {{sale_date_filter}}
GROUP BY city, accessory
ORDER BY city, total_sales DESC;


-- ---------------------------------------------------------------------------
-- Q3 · SALES BY ACCESSORY (product view, city/hub agnostic)
-- ---------------------------------------------------------------------------
SELECT
    accessory,
    accessory_group,
    SUM(units)                                                      AS total_sales,
    SUM(CASE WHEN sale_source = 'Job Card (legacy)' THEN units END) AS legacy_jc_sales,
    COUNT(DISTINCT hub_name)                                        AS hubs_selling,
    MIN(sale_date)                                                  AS first_sale,
    MAX(sale_date)                                                  AS last_sale
FROM {{#123-accessory-sales-unified}} s
WHERE {{city_filter}} AND {{hub_filter}} AND {{sale_date_filter}}
GROUP BY accessory, accessory_group
ORDER BY total_sales DESC;


-- ---------------------------------------------------------------------------
-- Q4 · SALES TREND (line chart: week on X, one line per accessory)
-- ---------------------------------------------------------------------------
SELECT
    sale_week,
    accessory,
    sale_source,
    SUM(units) AS units
FROM {{#123-accessory-sales-unified}} s
WHERE {{city_filter}} AND {{hub_filter}} AND {{accessory_filter}}
GROUP BY sale_week, accessory, sale_source
ORDER BY sale_week;
-- Visualisation: Line/Bar, X = sale_week, Y = units, Series break-out =
-- sale_source. The legacy bar collapsing and the app bar rising IS the
-- migration story in one picture.
