# Wedding — Session Handoff (2026-06-23)

> **READ FIRST if you're picking up the wedding project.** A whole session of admin
> data work was written to the **WRONG Convex deployment** and must be re-applied to
> production. Ready-to-import payloads are in `prod-reapply/`.

## 🔴 The core problem: data went to DEV, not PROD

- The env var `CONVEX_DEPLOY_KEY_WEDDING` is a **`dev:` key** for the dev deployment
  **`rosy-perch-73`**. Everything below was imported there with
  `npx convex import ... ` and **does NOT appear on the live site.**
- The live site (**andrewandjewel.com**) reads from a **production** Convex deployment.
  The prod client bundle references **`happy-otter-123.convex.cloud`** and
  **`notable-pigeon-459.convex.cloud`** — confirm which is the real prod via the Vercel
  dashboard → project **wedding** → Settings → Environment Variables →
  `NEXT_PUBLIC_CONVEX_URL` (production). That is the authoritative prod URL.
- **What's needed to fix:** a **PROD** Convex deploy key (prefix `prod:`), not the
  current dev key. Either Andrew generates one (Convex dashboard → prod deployment →
  Deploy Keys), or sets `CONVEX_DEPLOY_KEY_WEDDING` to the prod key. The Vercel
  `CONVEX_DEPLOY_KEY` env value pulls back **blank** via API/CLI (encrypted secret), so
  it can't be read programmatically — Andrew must supply it.

## ✅ How to re-apply to PROD once you have the prod key

From `/home/user/wedding`, with `CONVEX_DEPLOY_KEY` set to the **prod** key:

```bash
# 0. SANITY: confirm you're pointed at prod, not dev
CONVEX_DEPLOY_KEY="$PROD_KEY" npx convex data vendors   # should show the LIVE site's data

# 1. Budget -> $30k (settings is key/value; --replace rewrites the whole table,
#    payload preserves all 5 keys). Verify prod settings match first!
CONVEX_DEPLOY_KEY="$PROD_KEY" npx convex import --replace --table settings \
  --format jsonLines docs/wedding-planning/prod-reapply/settings.jsonl --yes

# 2. Vendors: 15 shortlist + Wolf Lakes venue (chosen). --replace ONLY if prod vendors
#    are test data; otherwise hand-pick. CHECK prod first.
CONVEX_DEPLOY_KEY="$PROD_KEY" npx convex import --replace --table vendors \
  --format jsonLines docs/wedding-planning/prod-reapply/vendors.jsonl --yes

# 3. Groom-side guests: 19 rows. Use --append (do NOT replace — prod has real guests).
#    De-dupe against existing prod guests first.
CONVEX_DEPLOY_KEY="$PROD_KEY" npx convex import --append --table guests \
  --format jsonLines docs/wedding-planning/prod-reapply/groom-guests.jsonl --yes
```

⚠️ **Always `convex data <table>` against prod BEFORE importing.** The dev DB had test
rows that prod may not (or prod may have different real rows). `--replace` wipes the
whole table. The payloads here were built against dev state.

## 📦 What the payloads contain (all done, but on DEV only)

### Budget (`settings.jsonl`)
- `weddingBudget` = **30000** (was 45000). Other 4 keys preserved (all null).

### Vendors (`vendors.jsonl`, 16 rows)
- **Wolf Lakes Park** — `venue`, **chosen**, `priceTotal: 16094` flat
  (125 guests × $103 × **1.25 plated/hand-served service fee**), deposit $1,000 paid,
  contract details in notes. *(Was $15,193 at 18% buffet — Andrew confirmed PLATED.)*
- **Florists (5, considering)** for cross-compare, enriched with pros/cons/rating:
  Kiku Floral (4.9, ~$3k, top), Sweet Dreams Floral (4.8, drapery specialist),
  Sweet Memories Flowers (4.5, romantic/garden, ~$5k+), A Secret Garden (5.0
  WeddingWire, best-documented), Awesome Blossom (smaller, one professionalism complaint).
- **Photo booths (2, considering)**: Fresno Photo Booth Company ($575/3hr, top pick),
  Smiley Photo Booths ($495/3hr, value). Both fit budget.
- Other considering: AMS Entertainment (DJ, on-list), Maty's Linens & Decor (rentals),
  Frosted Cakery (cake), Hooper Photo & Film + Franklin and Brianne (photo),
  Ironfire Studio (video), Arpeggio Strings + Dr. Loenheim ensemble (live music).

### Guests (`groom-guests.jsonl`, 19 rows, all side=groom)
Households (invitationId): maddox-montoya (Sean Maddox, Monette Montoya — addr 1495
Seabright Ave, Grover Beach 93433); brouwers-stephen (Stephen, Sarah, Josephine*,
Alexandra*); brouwers-kevin (Kevin, +1 allowed); waller (Rhanda, Aaron, **Rup**⚠️);
farrell (Kari, Raign*, Lillian*); sweeten (Cassandra, Mike, Riley*, **Boy 2**⚠️,
**Boy 3**⚠️); diviccaro (Adrian⚠️). `*` = flagged isChild.

## ⚠️ Open questions to confirm with Andrew (also in each row's adminNotes)
1. **"Rup"** — appeared between the Wallers and Kari Farrell in mom's text, no last
   name. Guessed into the Waller household. Who is this?
2. **Sweeten's 2 unnamed boys** — only Riley was named; "Boy 2"/"Boy 3" are placeholders.
3. **Kids' ages** — Josephine, Alexandra, Raign, Lillian, Riley assumed children.
   Wolf Lakes comps only kids **6 & under** (first 10 free) → ages affect the bill.
4. **Adrian Diviccaro** — address still pending.
5. **Test-data cleanup (NOT done):** the prod guest list likely still has old QA/seed
   rows (Dan & Myrna Willson, Robin Quinn, Jordan & Alex Carter, an "Adversarial 🎉👰"
   junk row). Andrew approved cleaning these — do it on PROD when fixing the above.

## ✅ Already shipped to prod this session (NOT affected by the dev/prod issue)
- **iOS delete fix** — PR #21 merged to `main`, deployed (Vercel `READY`). The admin
  delete actions (guests/vendors/registry/appointments/messages) no longer rely on
  `window.confirm()` (suppressed on iOS); they use an in-app dialog (`useConfirm`).

## Key facts
- Wedding: **Fri Apr 9, 2027, Wolf Lakes Park, Sanger/Clovis CA**, Ceremony & Reception,
  Lakeside English Garden, 5:30–11:30pm. **Plated dinner.** Budget **$30k**, ~125 guests.
- Venue is nearly all-inclusive (catering, linens, china, chairs/covers, cake cutting,
  security, event manager). Alcohol + sales tax extra. DJ must be from venue's list.
- Budget outlook at 125 guests: $30,000 − $16,094 venue = **~$13,906** for everything else.
