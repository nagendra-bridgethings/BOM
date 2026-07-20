// Seeds the per-device BOM tables over the Supabase REST API using the anon key.
// Prereq: run supabase/schema.sql first (creates the bom_<device>_* tables + policies).
// Usage: node scripts/seed-api.mjs
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')

const DEVICES = [
  { key: '4G', table: 'bom_4g_components' },
  { key: 'RS485', table: 'bom_rs485_components' },
  { key: 'LORA', table: 'bom_lora_components' },
]
const SUB_BOARD_ORDER = ['Main Board', 'Mira Top Board', 'Reed Sensor', 'Read Sensor']
const subRank = (name) => {
  const i = SUB_BOARD_ORDER.indexOf(name)
  return i === -1 ? 99 : i
}

// --- read .env (no dotenv dependency) --------------------------------------
function readEnv() {
  const txt = fs.readFileSync(path.join(root, '.env'), 'utf8')
  const env = {}
  for (const line of txt.split(/\r?\n/)) {
    const s = line.trim()
    if (!s || s.startsWith('#')) continue
    const i = s.indexOf('=')
    if (i === -1) continue
    env[s.slice(0, i).trim()] = s.slice(i + 1).trim()
  }
  return env
}

const env = readEnv()
const url = env.VITE_SUPABASE_URL
const key = env.VITE_SUPABASE_ANON_KEY
if (!url || !key) {
  console.error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY in .env')
  process.exit(1)
}

const supabase = createClient(url, key, { auth: { persistSession: false } })
const data = JSON.parse(fs.readFileSync(path.join(root, 'docs', 'bom-data.json'), 'utf8'))

function chunk(arr, n) {
  const out = []
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n))
  return out
}

async function main() {
  console.log(`Seeding ${url}`)
  let grandTotal = 0

  for (const { key: device, table } of DEVICES) {
    const rows = data.components
      .filter((c) => c.device === device)
      .sort((a, b) => subRank(a.board) - subRank(b.board) || (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .map((c, i) => ({
        sub_board: c.board,
        sort_order: i,
        s_no: c.s_no,
        s_no_raw: c.s_no_raw,
        component: c.component,
        value_raw: c.value_raw,
        value: c.value,
        voltage: c.voltage,
        rating: c.rating,
        material: c.material,
        tolerance: c.tolerance,
        label: c.label,
        package: c.package,
        part_number: c.part_number,
        opening_quantity: c.opening_quantity ?? 0,
        quantity_note: c.quantity_note,
      }))

    // clean slate (cascades to that device's transactions)
    const del = await supabase.from(table).delete().not('id', 'is', null)
    if (del.error) throw new Error(`delete ${table}: ${del.error.message}`)

    let inserted = 0
    for (const part of chunk(rows, 100)) {
      const r = await supabase.from(table).insert(part)
      if (r.error) throw new Error(`insert ${table}: ${r.error.message}`)
      inserted += part.length
    }
    grandTotal += inserted
    console.log(`  ${device.padEnd(6)} ${table.padEnd(22)} ${inserted} components`)
  }

  // verify
  console.log('Verify ->')
  for (const { key: device, table } of DEVICES) {
    const v = await supabase.from(table).select('id', { count: 'exact', head: true })
    console.log(`  ${table.padEnd(22)} ${v.count}`)
  }
  console.log(`Total inserted: ${grandTotal}`)
}

main().catch((e) => {
  console.error('\nSEED FAILED:', e.message)
  process.exit(1)
})
