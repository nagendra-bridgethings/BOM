import { IconDatabase } from './ui/icons'

function Step({ n, title, children }) {
  return (
    <div className="flex gap-4">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-teal text-sm font-semibold text-canvas">
        {n}
      </div>
      <div className="min-w-0 flex-1 pb-2">
        <p className="font-medium text-ink">{title}</p>
        <div className="mt-1 text-sm text-mute">{children}</div>
      </div>
    </div>
  )
}

const code = 'rounded bg-surface2 px-1.5 py-0.5 font-mono text-[13px] text-ink ring-1 ring-line2'

export default function SetupScreen() {
  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-6 py-16">
      <div className="rounded-2xl bg-surface p-8 shadow-lg shadow-black/10 ring-1 ring-line">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-surface2 text-mute ring-1 ring-line">
            <IconDatabase width={22} height={22} />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-ink">Connect your Supabase project</h1>
            <p className="text-sm text-mute">One-time setup to power the BOM inventory.</p>
          </div>
        </div>

        <div className="space-y-5">
          <Step n={1} title="Add your API keys">
            Open <span className={code}>.env</span> in the project root and paste your values from
            Supabase → <span className="italic">Project Settings → API</span>:
            <pre className="mt-2 overflow-x-auto rounded-lg bg-canvas p-3 text-xs text-ink ring-1 ring-line">
{`VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...`}</pre>
          </Step>
          <Step n={2} title="Create the tables">
            In Supabase → <span className="italic">SQL Editor</span>, paste and run
            <span className={code}>supabase/schema.sql</span>.
          </Step>
          <Step n={3} title="Load the component data">
            Then run <span className={code}>supabase/seed.sql</span> the same way — it loads all
            191 components across the 4G, RS485 and LORA boards.
          </Step>
          <Step n={4} title="Restart the dev server">
            Stop and re-run <span className={code}>npm run dev</span> so the new keys are picked up.
          </Step>
        </div>

        <div className="mt-6 rounded-lg bg-sun/12 px-4 py-3 text-sm text-sun ring-1 ring-sun/25">
          This screen shows because valid Supabase credentials weren’t found in <span className="font-mono">.env</span>.
        </div>
      </div>
    </div>
  )
}
