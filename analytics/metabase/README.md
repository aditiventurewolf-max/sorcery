# Accessory Analytics in Metabase — hub / city / accessory, sales vs inventory

## What's here

| File | What to do with it |
|---|---|
| `00_model_accessory_facts.sql` | Save as **Model**: "Accessory Sales — Unified (App + Job Card)" |
| `01_model_inventory.sql` | Save as **Model**: "Accessory Inventory — Hub x Accessory" |
| `02_questions_sales.sql` | 4 saved questions (hub, city, accessory, trend) |
| `03_questions_inventory.sql` | 4 saved questions (hub, city, accessory, pending-install ageing) |

Two models, eight questions, two dashboards. The hub→city map and the
accessory-name map exist in exactly one place each, so adding a hub is a
one-line edit rather than an eight-question hunt.

## Order of operations

1. Open `00_model_accessory_facts.sql`, swap in your three real table names
   and column names (marked `<<<`), run it, **Save as Model**.
2. Same for `01_model_inventory.sql`.
3. Note both model IDs from their URLs (`/model/123-...`). In the question
   files, replace `{{#123-accessory-sales-unified}}` and
   `{{#124-accessory-inventory}}` with the real IDs.
4. Save each question block, adding the field-filter variables listed under Q1.
5. Build two dashboards and wire the filters (below).

## The two dashboards

**Dashboard A — Accessory Sales**
Q2 (city × accessory) as the top table, Q1 (hub × accessory) below it,
Q3 (accessory) as a bar chart on the right, Q4 as the trend line at the bottom.

**Dashboard B — Accessory Inventory**
Q5 (hub × accessory) as the hero table sorted by days-of-cover ascending,
Q6 (city) above it as scalar cards, Q7 (accessory) beside it, Q8
(pending-install ageing) at the bottom.

On **both** dashboards add three dashboard filters — City, Hub, Accessory —
and connect each to the matching field-filter variable on every card. That is
what gives you "per hub view / per city view / per accessory view" without
maintaining nine separate questions: one dashboard, three dropdowns.

Set the Hub filter to be **linked** to the City filter (filter settings →
"Filter values → linked filter") so picking Bengaluru narrows the hub list.

## The job-card backfill (the part you specifically asked for)

Old mobile-stand sales never went through the accessory app — they were DMS
job cards, and the sale event is `billed = 'Yes'`. `job_card_sales` in Model
#1 turns each billed job card into one unit of **Mobile Holder**, tagged
`sale_source = 'Job Card (legacy)'`, and unions it into the same fact table as
app orders. So `total_sales` is genuinely total, while `app_sales` and
`legacy_jc_sales` stay separately visible — you can see the migration instead
of losing it in an aggregate.

A cutover guard (`jc_created_at < 2026-08-19`) prevents double-counting if any
hub briefly ran both flows. Move that date if your real go-live differs.

From the CSVs you sent, this backfill roughly doubles reported Mobile Holder
sales — 84 app units becomes 226:

| Hub | App | Job card | **Total** |
|---|---:|---:|---:|
| Yeshwanthpur | 20 | 46 | **66** |
| RR Nagar | 6 | 28 | **34** |
| Bellandur | 6 | 25 | **31** |
| Banaswadi | 16 | 11 | **27** |
| Hebbal | 9 | 16 | **25** |
| HSR Layout | 6 | 11 | **17** |
| Sakinaka | 15 | 0 | **15** |
| Bilekahalli | 5 | 5 | **10** |
| Hoodi | 1 | 0 | **1** |
| **Total** | **84** | **142** | **226** |

It also reorders the leaderboard: on app data alone Yeshwanthpur and Banaswadi
look comparable; with history included Yeshwanthpur is 2.4x Banaswadi, and
RR Nagar / Bellandur move from mid-table to 2nd and 3rd.

## Three things the data will show you on day one

- **Yeshwanthpur is about to stock out of Mobile Holders.** 6 units left
  against 20 app sales — the highest sell-through in the network. Q5 flags it
  "Reorder this week"; it is the only hub where free stock is single digits.
- **The Bounce Helmet B pending queue is not real demand.** 53 of 78 pending
  installations trace to one rider phone (`9263855340`), plus 3 more to
  `9876500001` and one to `9000000001`. That is test/seed data inflating
  Banaswadi (44 pending) and Hoodi (12). Q8 surfaces it as
  `max_orders_one_rider` rather than hiding it — exclude those phones in the
  `WHERE` clause once you confirm they're test accounts, otherwise every
  helmet metric is wrong.
- **Helmets aren't selling anywhere except Banaswadi, Hoodi and Sakinaka.**
  Bilekahalli, Hebbal, HSR Layout and Yeshwanthpur each hold 48 helmets and
  have sold zero. Q5 marks these "Dead stock - no demand" — roughly 190 units
  of capital sitting idle, and the first redistribution candidate.

## If you'd rather ask Metabase's AI instead of running SQL

Metabase's native-query assistant works far better with schema context than
without, so lead with the shape of the data:

> I have three tables: `accessory_orders` (order_id, rider_phone,
> product_name, hub_name, order_placed_at, payment_status,
> installation_status, days_pending_since_paid), `job_cards` (hub_name,
> vehicle_no, jc_id, jc_created_at, dms_jc_id, latest_status, billed) and
> `hub_stock` (hub, product, current_stock, units_sold,
> units_pending_installation).
>
> Build one sales fact table that UNIONs paid accessory_orders with job_cards
> where billed = 'Yes' — each billed job card counts as one unit of 'Mobile
> Holder' and should be tagged sale_source = 'Job Card (legacy)' so legacy and
> app sales stay separable inside a combined total. Map hubs to cities
> (Sakinaka = Mumbai, everything else = Bengaluru). Then group by hub,
> by city and by accessory, and give me total_sales, app_sales and
> legacy_jc_sales in each. Add optional field filters on city, hub, accessory
> and sale date.

Then a second, separate prompt for inventory — asking for sales and inventory
in one prompt is what produces the fan-out double-counting that makes stock
numbers look inflated:

> Using `hub_stock`, give me current_stock, units_pending_installation and
> free_stock (current_stock minus pending) per hub per product, joined to a
> 30-day burn rate from the sales fact table above, and compute days_of_cover.
> Flag anything under 7 days as REORDER NOW and anything with stock but zero
> 30-day demand as dead stock.

The hand-written SQL in this folder is still the better artifact — the AI
won't know your `payment_status` enum values or the cutover date — but these
prompts get you a working first draft to edit.
