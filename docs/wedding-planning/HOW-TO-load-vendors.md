# How to load the curated vendor shortlist

This loads Andrew's curated wedding vendor shortlist into the admin Vendors tool
in one paste. It does not touch the database until you click the import button.

## Steps

1. Log into the admin area at **`/admin/vendors`**.
2. Open the **bulk-add** form (the "Add all" / bulk paste box).
3. Open `vendor-bulkadd-payload.json` (sibling file), select all, and copy it.
4. Paste the JSON into the bulk-add textarea.
5. Click **Add all**.

Validation runs per-row; partial successes are kept. If any row fails, the form
lists the row index and the reason so you can fix just that row and re-paste.

## What's in the payload

10 vendors, all with `status: "considering"`:

| Vendor | Category |
|---|---|
| AMS Entertainment | dj_music |
| Maty's Linens & Decor | rentals |
| Kiku Floral | florist |
| Sweet Dreams Floral | florist |
| Frosted Cakery | cake |
| Hooper Photo & Film | photographer |
| Franklin and Brianne | photographer |
| Ironfire Studio | videographer |
| Arpeggio Strings | live_music |
| Dr. Loenheim ensemble (Fresno State) | live_music |

## Notes

- `priceTotal` (if you add prices later) is in **dollars**, not cents.
- Valid `category` slugs come from `src/lib/vendor-categories.ts`. All slugs used
  here are valid as-is — no substitutions were needed.
- Each row supports the same fields as a single add: `name`, `category`, `status`,
  `priceTotal`, `priceUnit` (flat/per_head/per_hour), `includes`, `contactName`,
  `phone`, `email`, `website`, `location`, `notes`, `rating`, `pros`, `cons`.
