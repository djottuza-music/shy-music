import { Component, type ReactNode } from 'react'

export class PageBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    if (!this.state.failed) return this.props.children
    return <section className="state state-card" role="alert"><h2>This page could not open</h2><p>Reload the page to try again. Your saved music is safe.</p><button className="button primary" onClick={() => window.location.reload()}>Reload page</button></section>
  }
}
