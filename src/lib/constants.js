// Device tabs + their accent colours (kept as static class strings so Tailwind
// can see them at build time).
export const DEVICES = [
  { key: '4G', label: '4G', blurb: '4G Water-Meter Board' },
  { key: 'RS485', label: 'RS485', blurb: 'RS485 Water-Meter Board' },
  { key: 'LORA', label: 'LORA', blurb: 'LORA Water-Meter Board' },
]

export const deviceMeta = (key) =>
  DEVICES.find((d) => d.key === key) || DEVICES[0]

// Each device has its own pair of tables (separate-tables schema).
export const DEVICE_TABLES = {
  '4G': { components: 'bom_4g_components', transactions: 'bom_4g_transactions' },
  RS485: { components: 'bom_rs485_components', transactions: 'bom_rs485_transactions' },
  LORA: { components: 'bom_lora_components', transactions: 'bom_lora_transactions' },
}

export const tablesFor = (device) => DEVICE_TABLES[device] || DEVICE_TABLES['4G']

// Canonical sub-board ordering (Main Board always first). Sub-boards live as a
// `sub_board` column inside each device's components table.
export const SUB_BOARD_ORDER = ['Main Board', 'Mira Top Board', 'Reed Sensor', 'Read Sensor']

// The sub-boards each device actually has — lets the Add form offer the right
// choices for a device whose rows aren't currently loaded.
export const DEVICE_SUB_BOARDS = {
  '4G': ['Main Board', 'Mira Top Board'],
  RS485: ['Main Board', 'Reed Sensor'],
  LORA: ['Main Board', 'Read Sensor'],
}

export const orderSubBoards = (names) =>
  [...names].sort((a, b) => {
    const ia = SUB_BOARD_ORDER.indexOf(a)
    const ib = SUB_BOARD_ORDER.indexOf(b)
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || a.localeCompare(b)
  })

// Default seed of component types for the dropdown (creatable — users can add more).
export const COMPONENT_TYPES = [
  'Capacitor',
  'Resistor',
  'Inductor',
  'Ferrite Bead',
  'Diode',
  'Mosfet',
  'MOSFET-PCHANNEL',
  'Transistor',
  'IC',
  'Display',
  'Display IC',
  'Micro Controller',
  'Micro Controllers',
  'RTC',
  'FRAM',
  'Crystal',
  'CRYSTAL',
  'Modem',
  'Analog switch',
  'Isolator',
  'Regulator',
  'Sim Slot',
  'Ambient Sensor',
  'Ambient Light Sensor',
  'Hall Sensor',
  'Hall Switch',
  'Rak Module',
  'Antenna',
  'Calibration Switch',
  'Switch',
  'JST Connector',
  'Connector',
  'Connectors',
  'Screw Terminal',
  'Burg Pins',
  'Header',
  'Male burg pins',
  'UFL_conn',
  'Tantalum Capacitors',
  'Sample Board',
  'Bare PCBs',
  'Enclousers',
  'Screws',
]

// How a part is supplied. Blank is valid and common — it doesn't apply to bare
// PCBs, enclosures or screws.
export const SUPPLY_FORMS = ['Cut Tape', 'Reel']

// Which of the parsed value sub-fields are relevant per component type.
// Anything not listed here is treated as non-parametric -> a single "Value" field.
export const VALUE_FIELDS_BY_COMPONENT = {
  Capacitor: ['value', 'voltage', 'material', 'tolerance'],
  'Tantalum Capacitors': ['value', 'voltage', 'tolerance'],
  Resistor: ['value', 'voltage', 'rating', 'material', 'tolerance'],
  Inductor: ['value', 'rating', 'tolerance'],
}

export const FIELD_META = {
  value: { label: 'Value', placeholder: 'e.g. 100nF' },
  voltage: { label: 'Voltage', placeholder: 'e.g. 50V' },
  rating: { label: 'Power / Current', placeholder: 'e.g. 125mW' },
  material: { label: 'Material / Temp-Coeff', placeholder: 'e.g. X7R' },
  tolerance: { label: 'Tolerance', placeholder: 'e.g. 10%' },
}

// The value sub-fields shown for a given component type.
// Lookup is case/whitespace-insensitive so 'capacitor ' still resolves.
const VALUE_FIELDS_LOOKUP = Object.fromEntries(
  Object.entries(VALUE_FIELDS_BY_COMPONENT).map(([k, v]) => [k.trim().toLowerCase(), v]),
)
export function valueFieldsFor(component) {
  return VALUE_FIELDS_LOOKUP[(component || '').trim().toLowerCase()] || ['value']
}

export const LOW_STOCK_THRESHOLD = 200

// Ceiling for every quantity the app accepts. Generous for real component stock
// (whole reels run to tens of thousands) yet far below Number.MAX_SAFE_INTEGER,
// so nothing that clears it can reach the numeric column already rounded.
// Number.isFinite alone isn't enough — a pasted 1e30 is finite and would corrupt
// the running balance permanently.
export const MAX_QTY = 10000000

export const TXN_META = {
  inward: {
    label: 'Inward',
    verb: 'Received',
    tone: 'text-teal bg-teal/10 ring-teal/20',
    sign: '+',
  },
  outward: {
    label: 'Outward',
    verb: 'Issued',
    tone: 'text-coral bg-coral/10 ring-coral/20',
    sign: '−',
  },
  return: {
    label: 'Return',
    verb: 'Returned',
    tone: 'text-mute bg-surface2 ring-line',
    sign: '+',
  },
}
