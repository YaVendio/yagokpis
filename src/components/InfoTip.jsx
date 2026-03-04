import { useState, useRef, useEffect } from "react";

export default function InfoTip({ data, dark }) {
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

  var bg = dark ? "#1A1D27" : "#FFF";
  var border = dark ? "#2D3140" : "#E5E7EB";
  var text = dark ? "#E5E7EB" : "#374151";
  var title = dark ? "#E5E7EB" : "#111827";
  var desc = dark ? "#B0B5C3" : "#4B5563";
  var muted = dark ? "#808696" : "#6B7280";
  var source = dark ? "#606676" : "#9CA3AF";
  var codeBg = dark ? "#252836" : "#F3F4F6";
  var codeBorder = dark ? "#2D3140" : "#F3F4F6";
  var iBg = dark ? "#2A2D50" : "#E0E7FF";
  var iColor = dark ? "#818CF8" : "#4F46E5";
  var iBorder = dark ? "#3730A3" : "#C7D2FE";

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
          background: iBg, color: iColor,
          fontSize: 11, fontWeight: 800, lineHeight: 1,
          border: "1px solid " + iBorder,
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
            background: bg,
            border: "1px solid " + border,
            borderRadius: 14,
            padding: "16px 18px",
            boxShadow: dark ? "0 20px 60px rgba(0,0,0,0.45), 0 4px 16px rgba(0,0,0,0.30)" : "0 20px 60px rgba(0,0,0,0.18), 0 4px 16px rgba(0,0,0,0.10)",
            zIndex: 1000,
            animation: "fadeInTip 0.18s ease-out",
            fontSize: 13,
            lineHeight: 1.55,
            color: text,
            fontWeight: 400,
            textTransform: "none",
            letterSpacing: 0,
            textAlign: "left",
            cursor: "default"
          }}
          onClick={function (e) { e.stopPropagation(); }}
        >
          {data.title && (
            <div style={{ fontSize: 14, fontWeight: 800, color: title, marginBottom: 8 }}>
              {data.title}
            </div>
          )}
          {data.description && (
            <div style={{ marginBottom: 10, color: desc }}>
              {data.description}
            </div>
          )}
          {data.formula && (
            <div style={{
              background: codeBg, borderRadius: 8, padding: "8px 12px",
              fontFamily: "'JetBrains Mono', monospace", fontSize: 12,
              color: iColor, marginBottom: 10, fontWeight: 600
            }}>
              {data.formula}
            </div>
          )}
          {data.why && (
            <div style={{ marginBottom: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: muted, textTransform: "uppercase", letterSpacing: 0.5 }}>
                Por qu&eacute; importa
              </span>
              <div style={{ marginTop: 3, color: text }}>{data.why}</div>
            </div>
          )}
          {data.source && (
            <div style={{
              fontSize: 11, color: source, marginTop: 8,
              paddingTop: 8, borderTop: "1px solid " + codeBorder
            }}>
              Fuente: {data.source}
            </div>
          )}
        </div>
      )}
    </span>
  );
}
