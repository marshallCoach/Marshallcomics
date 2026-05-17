import { useState, useEffect } from "react";

const KEY = "mc_auth";
const PWD = "BlackReadBrown!";

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
        marginBottom: 40,
        textTransform: "uppercase",
      }}>
        Private Collection Database
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
