# BOM — Water Meter Board Inventory

A single-page inventory manager for the **4G**, **RS485** and **LORA** water-meter
boards (plus their sub-boards). Track every component, its split value spec, package,
part number and **live quantity in hand**, with a full **inward / outward / return**
transaction trail backed by Supabase.

Built with **React + Vite + Tailwind CSS v4** and **Supabase** (Postgres).

---

## Features

- **Three device tabs** — 4G, RS485, LORA — each with its sub-boards
  (Main Board, Reed/Read Sensor, Mira Top Board).
- **Rich component rows** — Component · Value (split into Value / Voltage /
  Power·Current / Material / Tolerance) · Label (designators) · Package · Part No.
  · Req/board · **live In-Hand quantity**.
- **Creatable dropdowns** — every field is a dropdown fed by existing values; type
  a new one to add it on the fly.
- **Add / edit / delete** components.
- **Inward** — receive stock (adds to in-hand).
- **Outward** — issue stock with *how much needed* + *how much sending*. Because
  whole reels can’t be cut, *sending* is what leaves stock.
- **Return** — book the unused part of a reel back into stock, optionally linked to
  the outward it came from.
- **History** — per-component ledger with running balance; delete a transaction to
  recalculate.
- **Search, filter by component type, low-stock filter**, and summary tiles.
- Dates + reasons stored for every inward / outward / return.

---

## One-time setup

### 1. Add your Supabase keys
Copy `.env.example` to `.env` (a `.env` already exists as a placeholder) and fill in
your values from **Supabase → Project Settings → API**:

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...
```

### 2. Create the tables
In **Supabase → SQL Editor**, paste and run [`supabase/schema.sql`](supabase/schema.sql).

### 3. Load the component data
Run [`supabase/seed.sql`](supabase/seed.sql) the same way. It loads **191 components**
across the 6 boards (from the three source PDFs).

> ⚠️ Re-running `seed.sql` resets the component list **and all transactions**.

---

## Run

```bash
npm install     # already done
npm run dev     # opens http://localhost:5173
```

Build for production:

```bash
npm run build
npm run preview
```

---

## How quantity works

```
in hand = opening_quantity
        + Σ inward.qty
        − Σ outward.qty_sent
        + Σ return.qty
```

`opening_quantity` is the “Quantity in Hand” printed in each PDF (the starting stock).
Everything after that is driven by the transaction log, so the number is always an
auditable running balance.

---

## Data notes (kept as-is from the PDFs)

The source data is imported faithfully, including its quirks — so a few things are
intentional, not bugs:

- **`NC`** quantities → shown as a neutral `NC` badge (not counted / not connected).
- Blank part numbers (red cells in the PDFs) → left empty (part not finalised).
- A few **alternate parts** are kept in the value text, e.g.
  `A03415 (or) DMP2035`, `MB85RC04V (or) FM24CL04B-GTR`.
- LORA row 13 is a `0E` part labelled `R14` on package `R0402` exactly as printed.
- Placeholder rows (`Sample Board`, `Bare PCBs`, `Enclosures`, `Screws`) are included.

---

## Project layout

Each device has its **own pair of tables** — `bom_4g_components` / `bom_4g_transactions`,
`bom_rs485_*`, `bom_lora_*` — so a device can be browsed on its own in the SQL editor.
The sub-board (Main Board / Mira Top Board / Reed / Read Sensor) is a `sub_board`
column inside each device's components table.

```
supabase/
  schema.sql        per-device tables, live-stock views, RLS policies
  seed.sql          generated component data (191 rows, split by device)
docs/source/        faithful text copies of the 3 PDFs (extraction input)
docs/bom-data.json  canonical extracted data (source for the seed)
scripts/
  generate-seed.mjs regenerates seed.sql from docs/bom-data.json
  seed-api.mjs      loads the data over the REST API (node scripts/seed-api.mjs)
src/
  App.jsx           tabs, filters, stats, wiring
  lib/              supabase client, db calls, constants, formatters
  hooks/            useInventory (load + group + compute)
  components/       table, modals, toolbar, setup screen, UI primitives
```
