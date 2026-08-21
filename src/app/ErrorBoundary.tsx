import { Component, type ErrorInfo, type ReactNode } from "react";

type ErrorBoundaryState = { error: Error | null };

export class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("LiteEdit render failure", error, info.componentStack);
  }

  private downloadDiagnostic = () => {
    const error = this.state.error;
    const blob = new Blob(
      [
        JSON.stringify(
          {
            version: "1.0.0",
            generatedAt: new Date().toISOString(),
            error: error ? { name: error.name, message: error.message, stack: error.stack } : null,
            userAgent: navigator.userAgent,
          },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "liteedit-error-diagnostic.json";
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="fatal-error" role="alert">
        <p className="eyebrow">LOCAL ERROR</p>
        <h1>LiteEdit could not continue.</h1>
        <p>{this.state.error.message}</p>
        <button type="button" onClick={() => window.location.reload()}>
          RELOAD EDITOR
        </button>
        <button type="button" onClick={this.downloadDiagnostic}>
          EXPORT DIAGNOSTIC
        </button>
      </main>
    );
  }
}
