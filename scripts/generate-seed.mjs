// Generates supabase/seed.sql from docs/bom-data.json (the canonical extracted
// component data). Emits per-device inserts for the separate-tables schema:
//   bom_4g_components / bom_rs485_components / bom_lora_components
// Usage: node scripts/generate-seed.mjs
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')

// device key -> table suffix
const DEVICES = [
  { key: '4G', table: 'bom_4g_components' },
  { key: 'RS485', table: 'bom_rs485_components' },
  { key: 'LORA', table: 'bom_lora_components' },
]
// Main Board always first, then the device's secondary sub-board.
const SUB_BOARD_ORDER = ['Main Board', 'Mira Top Board', 'Reed Sensor', 'Read Sensor']
const subRank = (name) => {
  const i = SUB_BOARD_ORDER.indexOf(name)
  return i === -1 ? 99 : i
}

const data = JSON.parse(fs.readFileSync(path.join(root, 'docs', 'bom-data.json'), 'utf8'))

// ---- SQL helpers -----------------------------------------------------------
const q = (v) => (v === null || v === undefined ? 'null' : `'${String(v).replace(/'/g, "''")}'`)
const n = (v) => (v === null || v === undefined || v === '' ? 'null' : String(v))

const cols =
  'sub_board, sort_order, s_no, s_no_raw, component, value_raw, value, voltage, rating, material, tolerance, label, package, part_number, opening_quantity, quantity_note'

// ---- emit ------------------------------------------------------------------
let out = ''
out += '-- ============================================================================\n'
out += '-- BOM seed data  (generated from docs/bom-data.json — the 3 component PDFs)\n'
out += '-- Separate tables per device: bom_4g_* / bom_rs485_* / bom_lora_*\n'
out += '-- Run AFTER schema.sql.  WARNING: re-running RESETS the component list and\n'
out += '-- ALL transactions (inward/outward/return history) for every device.\n'
out += '-- ============================================================================\n\n'
out += 'begin;\n\n'

let grandTotal = 0
const perDevice = []
for (const { key, table } of DEVICES) {
  // rows for this device, ordered: sub-board rank, then original sort_order
  const rows = data.components
    .filter((c) => c.device === key)
    .sort((a, b) => subRank(a.board) - subRank(b.board) || (a.sort_order ?? 0) - (b.sort_order ?? 0))

  out += `-- ---- ${key} (${rows.length} components) ----------------------------------------\n`
  out += `delete from public.${table};\n`
  out += `insert into public.${table} (${cols}) values\n`
  out += rows
    .map((r, i) =>
      `  (${q(r.board)}, ${i}, ${n(r.s_no)}, ${q(r.s_no_raw)}, ` +
      `${q(r.component)}, ${q(r.value_raw)}, ${q(r.value)}, ${q(r.voltage)}, ` +
      `${q(r.rating)}, ${q(r.material)}, ${q(r.tolerance)}, ${q(r.label)}, ` +
      `${q(r.package)}, ${q(r.part_number)}, ` +
      `${r.opening_quantity ?? 0}, ${q(r.quantity_note)})`,
    )
    .join(',\n')
  out += ';\n\n'

  grandTotal += rows.length
  perDevice.push({ key, count: rows.length })
}

out += 'commit;\n'

const outPath = path.join(root, 'supabase', 'seed.sql')
fs.writeFileSync(outPath, out, 'utf8')

console.log(`Wrote ${outPath}`)
console.log(`Total components: ${grandTotal}`)
for (const d of perDevice) console.log(`  ${d.key}: ${d.count}`)
