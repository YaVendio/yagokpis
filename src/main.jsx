import { StrictMode, Component } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import Dashboard from './App.jsx'

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error: error };
  }
  componentDidCatch(error, info) {
    console.error("[ErrorBoundary]", error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Source Sans 3', sans-serif", background: "#FAFBFC" }}>
          <div style={{ background: "#FFF", border: "1px solid #E5E7EB", borderRadius: 14, padding: 40, boxShadow: "0 1px 3px #0000000a", width: 400, textAlign: "center" }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>{"⚠️"}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#111827", marginBottom: 8 }}>Algo salió mal</div>
            <div style={{ fontSize: 13, color: "#6B7280", marginBottom: 20 }}>
              {this.state.error && this.state.error.message ? this.state.error.message : "Error inesperado"}
            </div>
            <button
              onClick={function () { window.location.reload(); }}
              style={{ padding: "12px 32px", fontSize: 15, fontWeight: 700, color: "#fff", background: "#2563EB", border: "none", borderRadius: 8, cursor: "pointer", fontFamily: "'Source Sans 3', sans-serif" }}
            >
              Recargar
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <Dashboard />
    </ErrorBoundary>
  </StrictMode>,
)
