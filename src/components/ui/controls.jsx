// Small shared form controls for consistent styling.

export function Field({ label, hint, required, children, className = '' }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-xs font-medium text-mute">
        {label}
        {required && <span className="text-coral"> *</span>}
      </span>
      {children}
      {hint && <span className="mt-1 block text-xs text-faint">{hint}</span>}
    </label>
  )
}

const inputCls =
  'w-full rounded-lg border border-line bg-surface2 px-3 py-2 text-sm text-ink outline-none transition placeholder:text-faint focus:border-primary focus:ring-2 focus:ring-primary/25 disabled:cursor-not-allowed disabled:opacity-50'

export function TextInput(props) {
  return <input type="text" {...props} className={`${inputCls} ${props.className || ''}`} />
}

export function NumberInput(props) {
  return <input type="number" {...props} className={`${inputCls} ${props.className || ''}`} />
}

export function DateInput(props) {
  return <input type="date" {...props} className={`${inputCls} ${props.className || ''}`} />
}

export function TextArea(props) {
  return <textarea {...props} className={`${inputCls} min-h-[70px] resize-y ${props.className || ''}`} />
}

const variants = {
  primary: 'bg-primary text-white hover:bg-primary-600 disabled:opacity-40',
  navy: 'bg-primary text-white hover:bg-primary-600 disabled:opacity-40',
  soft: 'bg-raise text-mute hover:bg-line hover:text-ink',
  ghost: 'text-mute hover:bg-raise hover:text-ink',
  danger: 'bg-coral text-white hover:brightness-105 disabled:opacity-40',
  emerald: 'bg-teal text-white hover:brightness-105 disabled:opacity-40',
  outline: 'border border-line bg-surface text-mute hover:bg-surface2 hover:text-ink',
}

export function Button({ variant = 'primary', className = '', children, ...rest }) {
  return (
    <button
      {...rest}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold transition disabled:cursor-not-allowed ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  )
}
