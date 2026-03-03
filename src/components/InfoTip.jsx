import { useState, useRef, useEffect } from "react";

export default function InfoTip({ data }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const tipRef = useRef(null);
  const [pos, setPos] = useState({ top: true, left: 0 });

  useEffect(function () {
    if (!open || !ref.current || !tipRef.current) return;
    var r = ref.current.getBoundingClientRect();
    var t = tipRef.current.getBoundingClientRect();
    var top = r.top > t.height + 16;
    var left = 0;
    if (r.left + t.width / 2 > window.innerWidth - 16)
      left = window.innerWidth - 16 - r.left - t.width;
    if (r.left - t.width / 2 < 16) left = 16 - r.left + t.width / 2;
    setPos({ top: top, left: left });
  }, [open]);

  useEffect(function () {
    if (!open) return;
    function close(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", close);
    return function () { document.removeEventListener("mousedown", close); };
  }, [open]);

  if (!data) return null;

  return (
    <span
      ref={ref}
      style={{ position: "relative", display: "inline-flex", alignItems: "center", marginLeft: 5, cursor: "help" }}
      onMouseEnter={function () { setOpen(true); }}
      onMouseLeave={function () { setOpen(false); }}
      onClick={function (e) { e.stopPropagation(); setOpen(!open); }}
    >
      <span
        style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          width: 18, height: 18, borderRadius: "50%",
          background: "#E0E7FF", color: "#4F46E5",
          fontSize: 11, fontWeight: 800, lineHeight: 1,
          border: "1px solid #C7D2FE",
          transition: "all 0.15s ease",
          ...(open ? { background: "#4F46E5", color: "#FFF", borderColor: "#4F46E5" } : {})
        }}
      >
        i
      </span>
      {open && (
        <div
          ref={tipRef}
          style={{
            position: "absolute",
            [pos.top ? "bottom" : "top"]: "calc(100% + 8px)",
            left: "50%",
            transform: "translateX(-50%)",
            marginLeft: pos.left,
            width: 320,
            background: "#FFF",
            border: "1px solid #E5E7EB",
            borderRadius: 14,
            padding: "16px 18px",
            boxShadow: "0 12px 40px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)",
            zIndex: 1000,
            animation: "fadeInTip 0.18s ease-out",
            fontSize: 13,
            lineHeight: 1.55,
            color: "#374151",
            fontWeight: 400,
            textTransform: "none",
            letterSpacing: 0,
            textAlign: "left",
            cursor: "default"
          }}
          onClick={function (e) { e.stopPropagation(); }}
        >
          {data.title && (
            <div style={{ fontSize: 14, fontWeight: 800, color: "#111827", marginBottom: 8 }}>
              {data.title}
            </div>
          )}
          {data.description && (
            <div style={{ marginBottom: 10, color: "#4B5563" }}>
              {data.description}
            </div>
          )}
          {data.formula && (
            <div style={{
              background: "#F3F4F6", borderRadius: 8, padding: "8px 12px",
              fontFamily: "'JetBrains Mono', monospace", fontSize: 12,
              color: "#4F46E5", marginBottom: 10, fontWeight: 600
            }}>
              {data.formula}
            </div>
          )}
          {data.why && (
            <div style={{ marginBottom: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: 0.5 }}>
                Por qu&eacute; importa
              </span>
              <div style={{ marginTop: 3, color: "#374151" }}>{data.why}</div>
            </div>
          )}
          {data.source && (
            <div style={{
              fontSize: 11, color: "#9CA3AF", marginTop: 8,
              paddingTop: 8, borderTop: "1px solid #F3F4F6"
            }}>
              Fuente: {data.source}
            </div>
          )}
        </div>
      )}
    </span>
  );
}
