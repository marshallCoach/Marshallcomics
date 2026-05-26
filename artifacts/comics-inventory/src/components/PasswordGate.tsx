import { useState, useEffect } from "react";
import { DATA3 } from "@/data/data3";

const KEY = "mc_auth";
const PWD = "BlackReadBrown!";

const TARGET_BOXES  = 76;
const _comics       = DATA3.comics;
const _boxes        = DATA3.boxes.length;
const _keys         = _comics.filter(c => (c.Key    || "").toUpperCase() === "YES").length;
const _signed       = _comics.filter(c => (c.Signed || "").toUpperCase() === "YES").length;
const _boxPct       = Math.round((_boxes / TARGET_BOXES) * 100);
const _remaining    = TARGET_BOXES - _boxes;

interface Props {
  children: React.ReactNode;
}

export default function PasswordGate({ children }: Props) {
  const [unlocked, setUnlocked] = useState(() => sessionStorage.getItem(KEY) === "1");
  const [input, setInput]       = useState("");
  const [shake, setShake]       = useState(false);
  const [show, setShow]         = useState(false);

  useEffect(() => {
    if (unlocked) sessionStorage.setItem(KEY, "1");
  }, [unlocked]);

  if (unlocked) return <>{children}</>;

  function attempt() {
    if (input === PWD) {
      setUnlocked(true);
    } else {
      setShake(true);
      setInput("");
      setTimeout(() => setShake(false), 600);
    }
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "#111",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
    }}>
      <img
        src="/logo.png"
        alt="Marshall Comics"
        style={{ width: 72, height: 72, borderRadius: 10, marginBottom: 24, objectFit: "cover" }}
      />
      <div style={{
        fontFamily: "'Bebas Neue', sans-serif",
        fontSize: "2rem",
        letterSpacing: "6px",
        color: "#c8102e",
        marginBottom: 4,
      }}>
        Marshall Comics
      </div>
      <div style={{
        fontFamily: "'Bebas Neue', sans-serif",
        fontSize: "0.65rem",
        letterSpacing: "3px",
        color: "rgba(255,255,255,0.35)",
        marginBottom: 28,
        textTransform: "uppercase",
      }}>
        Private Collection Database
      </div>

      {/* Collection progress bar — fully dynamic from data3.ts */}
      <div style={{ width: "100%", maxWidth: 340, marginBottom: 28 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
          <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "0.58rem", letterSpacing: "2.5px", color: "rgba(255,255,255,0.25)", textTransform: "uppercase" }}>
            Box Collection Progress
          </span>
          <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "0.65rem", letterSpacing: "1px", color: "#c8102e" }}>
            {_boxes} / {TARGET_BOXES} Boxes
          </span>
        </div>
        <div style={{ height: 6, background: "rgba(255,255,255,0.08)", borderRadius: 3, overflow: "hidden" }}>
          <div style={{
            width: `${_boxPct}%`, height: "100%",
            background: "linear-gradient(90deg,#c8102e,#f4a107)",
            borderRadius: 3,
            transition: "width 0.6s ease",
          }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
          <span style={{ fontSize: "0.56rem", color: "rgba(255,255,255,0.18)", fontFamily: "'Bebas Neue', sans-serif", letterSpacing: "1px" }}>
            {_comics.length.toLocaleString()} Comics · {_keys.toLocaleString()} Keys · {_signed} Signed
          </span>
          <span style={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.25)", fontFamily: "'Bebas Neue', sans-serif", letterSpacing: "1px" }}>
            {_remaining > 0 ? `${_remaining} to go · ` : "✓ "}{_boxPct}%
          </span>
        </div>
      </div>

      <div style={{
        background: "#1c1c1c",
        border: "1.5px solid #333",
        borderRadius: 10,
        padding: "32px 36px",
        width: "100%",
        maxWidth: 340,
        display: "flex",
        flexDirection: "column",
        gap: 16,
        animation: shake ? "shake 0.5s ease" : "none",
      }}>
        <div style={{
          fontFamily: "'Bebas Neue', sans-serif",
          fontSize: "0.7rem",
          letterSpacing: "2px",
          color: "rgba(255,255,255,0.4)",
          textAlign: "center",
          marginBottom: 4,
        }}>
          Enter Password
        </div>

        <form onSubmit={e => { e.preventDefault(); attempt(); }} style={{ display: "contents" }}>
          <div style={{ position: "relative" }}>
            <input
              type={show ? "text" : "password"}
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="••••••••••••••"
              autoFocus
              style={{
                width: "100%",
                padding: "12px 40px 12px 14px",
                background: "#111",
                border: "1.5px solid #333",
                borderRadius: 6,
                color: "#fff",
                fontFamily: "'Crimson Pro', Georgia, serif",
                fontSize: "1rem",
                outline: "none",
                letterSpacing: "2px",
                transition: "border-color 0.15s",
              }}
              onFocus={e => (e.target.style.borderColor = "#c8102e")}
              onBlur={e => (e.target.style.borderColor = "#333")}
            />
            <button
              type="button"
              onClick={() => setShow(s => !s)}
              style={{
                position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                background: "none", border: "none", cursor: "pointer",
                color: "rgba(255,255,255,0.35)", fontSize: "0.8rem", padding: 4,
              }}
            >
              {show ? "HIDE" : "SHOW"}
            </button>
          </div>

          <button
            type="submit"
            style={{
              background: "#c8102e",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              padding: "12px",
              fontFamily: "'Bebas Neue', sans-serif",
              fontSize: "0.95rem",
              letterSpacing: "2.5px",
              cursor: "pointer",
              transition: "background 0.15s",
            }}
            onMouseOver={e => (e.currentTarget.style.background = "#9a0c22")}
            onMouseOut={e => (e.currentTarget.style.background = "#c8102e")}
          >
            Enter
          </button>
        </form>
      </div>

      {/* Can't log in? */}
      <div style={{ marginTop: 28, textAlign: "center" }}>
        <div style={{
          fontFamily: "'Bebas Neue', sans-serif",
          fontSize: "0.6rem",
          letterSpacing: "2.5px",
          color: "rgba(255,255,255,0.25)",
          marginBottom: 12,
          textTransform: "uppercase",
        }}>
          Can't log in? Go here:
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          <a href="https://www.instagram.com/blackreadbrown" target="_blank" rel="noopener noreferrer"
            style={{ display:"flex", alignItems:"center", gap:5, color:"#e1306c", textDecoration:"none",
              fontSize:"0.72rem", fontFamily:"'Bebas Neue',sans-serif", letterSpacing:"1px",
              padding:"5px 12px", border:"1px solid #e1306c40", borderRadius:4, background:"#e1306c0f" }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
            </svg>
            @blackreadbrown
          </a>
          <a href="https://www.whatnot.com/user/blackreadbrown" target="_blank" rel="noopener noreferrer"
            style={{ display:"flex", alignItems:"center", gap:5, color:"#7c3aed", textDecoration:"none",
              fontSize:"0.72rem", fontFamily:"'Bebas Neue',sans-serif", letterSpacing:"1px",
              padding:"5px 12px", border:"1px solid #7c3aed40", borderRadius:4, background:"#7c3aed0f" }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.5 8.5l-7 9-3.5-4.5 1.5-1.167L10.5 14l5.5-7L17.5 8.5z"/>
            </svg>
            Whatnot
          </a>
          <a href="https://www.ebay.com/usr/blackreadbrown" target="_blank" rel="noopener noreferrer"
            style={{ display:"flex", alignItems:"center", gap:5, color:"#e43137", textDecoration:"none",
              fontSize:"0.72rem", fontFamily:"'Bebas Neue',sans-serif", letterSpacing:"1px",
              padding:"5px 12px", border:"1px solid #e4313740", borderRadius:4, background:"#e431370f" }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
              <path d="M0 16.8v-1.6C0 9 5.4 5.6 10.8 5.6c2.4 0 4.8.8 6.4 2.4L16 9.2c-1.2-1.2-3.2-2-5.2-2C6.8 7.2 1.6 10 1.6 15.2v1.6c0 5.2 5.2 8 9.2 8 2 0 4-.8 5.2-2l1.2 1.2c-1.6 1.6-4 2.4-6.4 2.4C5.4 26.4 0 23 0 16.8zm13.6-3.2h8.8c-.4-3.2-2.8-5.6-6-5.6-2.8 0-5.2 2-6 5.6h3.2z"/>
            </svg>
            eBay
          </a>
        </div>
      </div>

      <style>{`
        @keyframes shake {
          0%,100% { transform: translateX(0); }
          20%      { transform: translateX(-8px); }
          40%      { transform: translateX(8px); }
          60%      { transform: translateX(-6px); }
          80%      { transform: translateX(6px); }
        }
      `}</style>
    </div>
  );
}
