import { Component, type ReactNode } from "react";

type Props = { children: ReactNode; fallback?: ReactNode; onError?: (e: unknown) => void };
type State = { hasError: boolean };

/**
 * Lightweight local ErrorBoundary so a single widget crash (e.g. notif banner)
 * does not bring down the entire dashboard layout.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    if (this.props.onError) this.props.onError(error);
    // eslint-disable-next-line no-console
    console.warn("[ErrorBoundary] swallowed:", error);
  }

  render() {
    if (this.state.hasError) return this.props.fallback ?? null;
    return this.props.children;
  }
}