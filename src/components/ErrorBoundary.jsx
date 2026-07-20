import { Component } from 'react'
import { Button } from './ui/controls'

// Class component because getDerivedStateFromError / componentDidCatch have no hook equivalent.
export default class ErrorBoundary extends Component {
  // hasError is tracked separately from the error value: a render is allowed to
  // `throw null`, and gating the fallback on the value's truthiness would send the
  // children straight back into the same crash until React unmounts the root.
  state = { hasError: false, error: null, info: null }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    // The app's only console call: a render crash leaves no other trace, and the
    // stack is what makes a user's bug report actionable.
    console.error('Render error caught by ErrorBoundary:', error, info?.componentStack)
    this.setState({ info })
  }

  // A transient render error (bad row, stale prop) usually clears on a re-render,
  // so offer that before making the user reload the whole app.
  handleRetry = () => this.setState({ hasError: false, error: null, info: null })

  render() {
    const { hasError, error, info } = this.state
    if (!hasError) return this.props.children

    // Thrown values are not guaranteed to be Errors — a bare string still reads
    // fine, but null/undefined would print as "null" and tell the user nothing.
    const message = error?.message || String(error ?? '') || 'No error message was reported.'

    // Nested boundaries sit inside a page that still has its own chrome and
    // padding, so they drop the page-level frame.
    const nested = this.props.nested

    return (
      <div className={nested ? 'w-full max-w-lg' : 'mx-auto w-full max-w-lg px-6 py-16'}>
        <div className={`rounded-xl border border-line bg-surface ${nested ? 'p-6' : 'p-8'}`}>
          <div className="mb-3 inline-flex items-center gap-2 text-xs font-medium text-coral">
            <span className="h-1.5 w-1.5 rounded-full bg-coral" />
            Error
          </div>

          <p className="text-base font-semibold text-ink">Something broke while drawing this screen</p>
          <p className="mt-2 text-sm text-mute">
            Your inventory is safe — components and transactions live in the database, so nothing is
            lost by reloading. Try again first; if it comes straight back, reload the page.
          </p>

          <p className="mt-4 rounded-lg bg-surface2 px-3 py-2 font-mono text-xs break-words text-ink ring-1 ring-line2">
            {message}
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            <Button onClick={this.handleRetry}>Try again</Button>
            <Button variant="outline" onClick={() => window.location.reload()}>
              Reload
            </Button>
          </div>

          <details className="mt-6 border-t border-line2 pt-4">
            <summary className="cursor-pointer text-xs font-medium text-faint hover:text-mute">
              Technical details
            </summary>
            <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-surface2 p-3 font-mono text-xs whitespace-pre-wrap text-mute ring-1 ring-line2">
              {`${message}\n${info?.componentStack || ''}`.trim()}
            </pre>
          </details>
        </div>
      </div>
    )
  }
}
