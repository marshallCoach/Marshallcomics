import { useState, useEffect } from "react";
import { DATA } from "@/data/data";

const KEY           = "mc_auth";
const PWD           = "BlackReadBrown!";
const PASSKEY_KEY   = "brbPasskeyId";   // stored as JSON: { credId: string; rpId: string }
const PROGRESS_KEY  = "mc_progress_dismissed";

const TARGET_BOXES = DATA.boxes.length;
const _comics      = DATA.comics;
const _boxes       = DATA.boxes.length;
const _keys        = _comics.filter(c => (c.Key    || "").toUpperCase() === "YES").length;
const _signed      = _comics.filter(c => (c.Signed || "").toUpperCase() === "YES").length;
const _boxPct      = Math.round((_boxes / TARGET_BOXES) * 100);
const _remaining   = TARGET_BOXES - _boxes;

// ── WebAuthn helpers ────────────────────────────────────────────────────────

function b64encode(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}
function b64decode(s: string): Uint8Array {
  const bin = atob(s);
  const buf = new ArrayBuffer(bin.length);
  const arr = new Uint8Array(buf);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

interface StoredPasskey { credId: string; rpId: string; }

function loadPasskey(): StoredPasskey | null {
  try {
    const raw = localStorage.getItem(PASSKEY_KEY);
    if (!raw) return null;
    // Support legacy format (plain string) from old builds
    if (!raw.startsWith("{")) return null;
    const parsed = JSON.parse(raw) as StoredPasskey;
    // If registered on a different domain, treat as invalid for this origin
    if (parsed.rpId !== window.location.hostname) return null;
    return parsed;
  } catch { return null; }
}

function savePasskey(credId: string) {
  localStorage.setItem(PASSKEY_KEY, JSON.stringify({ credId, rpId: window.location.hostname }));
}

async function checkBiometricAvailable(): Promise<boolean> {
  if (!window.PublicKeyCredential) return false;
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch { return false; }
}

async function registerPasskey(): Promise<string | null> {
  if (!window.PublicKeyCredential) return null;
  try {
    const cred = await navigator.credentials.create({
      publicKey: {
        challenge:          crypto.getRandomValues(new Uint8Array(32)),
        rp:                 { name: "Marshall Comics", id: window.location.hostname },
        user:               { id: crypto.getRandomValues(new Uint8Array(16)), name: "roberto", displayName: "Roberto Marshall" },
        pubKeyCredParams:   [{ alg: -7, type: "public-key" }, { alg: -257, type: "public-key" }],
        authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required", residentKey: "preferred" },
        timeout: 60000,
      },
    }) as PublicKeyCredential | null;
    if (!cred) return null;
    return b64encode(cred.rawId);
  } catch {
    return null;
  }
}

async function authenticatePasskey(storedId: string): Promise<boolean> {
  if (!window.PublicKeyCredential) return false;
  try {
    const result = await navigator.credentials.get({
      publicKey: {
        challenge:          crypto.getRandomValues(new Uint8Array(32)),
        rpId:               window.location.hostname,
        allowCredentials:   [{ type: "public-key", id: b64decode(storedId).buffer as ArrayBuffer }],
        userVerification:   "required",
        timeout:            60000,
      },
    });
    return !!result;
  } catch {
    return false;
  }
}

// ── Platform detection ───────────────────────────────────────────────────────

function getBiometricLabel(): { name: string; verb: string; icon: "face" | "fingerprint" | "shield" } {
  const ua = navigator.userAgent;
  if (/iPhone|iPad/.test(ua))   return { name: "Face ID",       verb: "face",        icon: "face"        };
  if (/Mac/.test(ua))           return { name: "Touch ID",      verb: "fingerprint", icon: "fingerprint" };
  if (/Windows/.test(ua))       return { name: "Windows Hello", verb: "biometric",   icon: "shield"      };
  return                               { name: "Biometric",     verb: "biometric",   icon: "fingerprint" };
}

// ── Component ───────────────────────────────────────────────────────────────

interface Props { children: React.ReactNode; }

type Stage = "lock" | "offer-faceid" | "registering" | "authing";

export default function PasswordGate({ children }: Props) {
  const bio = getBiometricLabel();
  const [unlocked,      setUnlocked]      = useState(() => sessionStorage.getItem(KEY) === "1");
  const [input,         setInput]         = useState("");
  const [shake,         setShake]         = useState(false);
  const [show,          setShow]          = useState(false);
  const [stage,         setStage]         = useState<Stage>("lock");
  const [biometricErr,    setBiometricErr]    = useState("");
  const [passkey,         setPasskey]         = useState<StoredPasskey | null>(() => loadPasskey());
  const [biometricAvail,  setBiometricAvail]  = useState(false);
  const [progressHidden,  setProgressHidden]  = useState(() => sessionStorage.getItem(PROGRESS_KEY) === "1");

  useEffect(() => {
    if (unlocked) sessionStorage.setItem(KEY, "1");
  }, [unlocked]);

  // Async biometric detection — runs once on mount
  useEffect(() => {
    checkBiometricAvailable().then(setBiometricAvail);
  }, []);

  if (unlocked) return <>{children}</>;

  // ── Helpers ──

  function wrongPassword() {
    setShake(true);
    setInput("");
    setTimeout(() => setShake(false), 600);
  }

  function attempt() {
    if (input === PWD) {
      if (biometricAvail && !passkey) {
        setStage("offer-faceid");
      } else {
        setUnlocked(true);
      }
    } else {
      wrongPassword();
    }
  }

  async function setupBiometric() {
    setStage("registering");
    setBiometricErr("");
    const credId = await registerPasskey();
    if (credId) {
      savePasskey(credId);
      setPasskey({ credId, rpId: window.location.hostname });
    } else {
      setBiometricErr(`${bio.name} setup was cancelled or isn't available on this device.`);
    }
    setUnlocked(true);
  }

  async function useBiometric() {
    if (!passkey) return;
    setStage("authing");
    setBiometricErr("");
    const ok = await authenticatePasskey(passkey.credId);
    if (ok) {
      setUnlocked(true);
    } else {
      setBiometricErr(`${bio.name} didn't match. Use your password instead.`);
      setStage("lock");
    }
  }

  function removeBiometric() {
    localStorage.removeItem(PASSKEY_KEY);
    setPasskey(null);
    setStage("lock");
    setBiometricErr("");
  }

  // ── Loading overlay ──

  if (stage === "registering" || stage === "authing") {
    return (
      <div style={{ minHeight:"100vh", background:"#111", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:20 }}>
        <div style={{ width:56, height:56, borderRadius:"50%", border:"3px solid #c8102e", borderTopColor:"transparent", animation:"spin 0.8s linear infinite" }} />
        <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.8rem", letterSpacing:"3px", color:"rgba(255,255,255,0.5)" }}>
          {stage === "registering" ? `SETTING UP ${bio.name.toUpperCase()}…` : `CHECKING ${bio.name.toUpperCase()}…`}
        </div>
        <style>{`@keyframes spin { to { transform:rotate(360deg); } }`}</style>
      </div>
    );
  }

  // ── Offer biometric setup (after successful password) ──

  if (stage === "offer-faceid") {
    return (
      <div style={{ minHeight:"100vh", background:"#111", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:24 }}>
        <img src="/logo.png" alt="Marshall Comics" style={{ width:64, height:64, borderRadius:10, marginBottom:24, objectFit:"cover" }} />
        <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"1.6rem", letterSpacing:"5px", color:"#c8102e", marginBottom:8 }}>Use {bio.name}?</div>
        <div style={{ fontFamily:"'Crimson Pro',serif", fontSize:"1rem", color:"rgba(255,255,255,0.55)", textAlign:"center", maxWidth:300, lineHeight:1.6, marginBottom:32 }}>
          Skip the password next time — just use your {bio.verb} to unlock on this device.
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:12, width:"100%", maxWidth:300 }}>
          <button
            onClick={setupBiometric}
            style={{ background:"#c8102e", color:"#fff", border:"none", borderRadius:8, padding:"14px", fontFamily:"'Bebas Neue',sans-serif", fontSize:"1rem", letterSpacing:"2.5px", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:10 }}>
            <BiometricIcon type={bio.icon} size={22} color="#fff" />
            SET UP {bio.name.toUpperCase()}
          </button>
          <button
            onClick={() => setUnlocked(true)}
            style={{ background:"transparent", color:"rgba(255,255,255,0.35)", border:"1.5px solid #333", borderRadius:8, padding:"12px", fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.8rem", letterSpacing:"2px", cursor:"pointer" }}>
            SKIP — USE PASSWORD
          </button>
        </div>
        {biometricErr && (
          <div style={{ marginTop:20, color:"#f4a107", fontSize:"0.8rem", fontFamily:"'Crimson Pro',serif", textAlign:"center", maxWidth:300 }}>{biometricErr}</div>
        )}
      </div>
    );
  }

  // ── Main lock screen ──

  return (
    <div style={{ minHeight:"100vh", background:"#111", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:24 }}>
      <img src="/logo.png" alt="Marshall Comics" style={{ width:72, height:72, borderRadius:10, marginBottom:24, objectFit:"cover" }} />
      <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"2rem", letterSpacing:"6px", color:"#c8102e", marginBottom:4 }}>
        Marshall Comics
      </div>
      <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.65rem", letterSpacing:"3px", color:"rgba(255,255,255,0.35)", marginBottom:28, textTransform:"uppercase" }}>
        Private Collection Database
      </div>

      {/* Collection progress bar */}
      {!progressHidden && (
        <div style={{ width:"100%", maxWidth:340, marginBottom:28, position:"relative" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:6 }}>
            <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.58rem", letterSpacing:"2.5px", color:"rgba(255,255,255,0.25)", textTransform:"uppercase" }}>Box Collection Progress</span>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.65rem", letterSpacing:"1px", color:"#c8102e" }}>{_boxes} / {TARGET_BOXES} Boxes</span>
              <button
                onClick={() => { sessionStorage.setItem(PROGRESS_KEY, "1"); setProgressHidden(true); }}
                style={{ background:"none", border:"none", cursor:"pointer", color:"rgba(255,255,255,0.2)", fontSize:"0.75rem", padding:"0 2px", lineHeight:1, fontFamily:"sans-serif" }}
                title="Dismiss"
              >✕</button>
            </div>
          </div>
          <div style={{ height:6, background:"rgba(255,255,255,0.08)", borderRadius:3, overflow:"hidden" }}>
            <div style={{ width:`${_boxPct}%`, height:"100%", background:"linear-gradient(90deg,#c8102e,#f4a107)", borderRadius:3, transition:"width 0.6s ease" }} />
          </div>
          <div style={{ display:"flex", justifyContent:"space-between", marginTop:6 }}>
            <span style={{ fontSize:"0.56rem", color:"rgba(255,255,255,0.18)", fontFamily:"'Bebas Neue',sans-serif", letterSpacing:"1px" }}>
              {_comics.length.toLocaleString()} Comics · {_keys.toLocaleString()} Keys · {_signed} Signed
            </span>
            <span style={{ fontSize:"0.6rem", color:"rgba(255,255,255,0.25)", fontFamily:"'Bebas Neue',sans-serif", letterSpacing:"1px" }}>
              {_remaining > 0 ? `${_remaining} to go · ` : "✓ "}{_boxPct}%
            </span>
          </div>
        </div>
      )}

      {/* Biometric button — prominent if registered */}
      {passkey && (
        <div style={{ width:"100%", maxWidth:340, marginBottom:16, display:"flex", flexDirection:"column", gap:8 }}>
          <button
            onClick={useBiometric}
            style={{ background:"#1c1c1c", border:"1.5px solid #444", borderRadius:10, padding:"18px 24px", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:12, transition:"border-color 0.15s, background 0.15s" }}
            onMouseOver={e => { e.currentTarget.style.background="#242424"; e.currentTarget.style.borderColor="#c8102e"; }}
            onMouseOut={e => { e.currentTarget.style.background="#1c1c1c"; e.currentTarget.style.borderColor="#444"; }}
          >
            <BiometricIcon type={bio.icon} size={32} color="#c8102e" />
            <div style={{ textAlign:"left" }}>
              <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.95rem", letterSpacing:"2px", color:"#fff" }}>UNLOCK WITH {bio.name.toUpperCase()}</div>
              <div style={{ fontFamily:"'Crimson Pro',serif", fontSize:"0.78rem", color:"rgba(255,255,255,0.4)", marginTop:2 }}>Touch to authenticate</div>
            </div>
          </button>
          {biometricErr && (
            <div style={{ color:"#f4a107", fontSize:"0.78rem", fontFamily:"'Crimson Pro',serif", textAlign:"center", padding:"6px 0" }}>{biometricErr}</div>
          )}
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ flex:1, height:1, background:"rgba(255,255,255,0.08)" }} />
            <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.58rem", letterSpacing:"2px", color:"rgba(255,255,255,0.2)" }}>OR</span>
            <div style={{ flex:1, height:1, background:"rgba(255,255,255,0.08)" }} />
          </div>
        </div>
      )}

      {/* Password form */}
      <div style={{ background:"#1c1c1c", border:"1.5px solid #333", borderRadius:10, padding:"32px 36px", width:"100%", maxWidth:340, display:"flex", flexDirection:"column", gap:16, animation: shake ? "shake 0.5s ease" : "none" }}>
        <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.7rem", letterSpacing:"2px", color:"rgba(255,255,255,0.4)", textAlign:"center", marginBottom:4 }}>
          Enter Password
        </div>
        <form onSubmit={e => { e.preventDefault(); attempt(); }} style={{ display:"contents" }}>
          <div style={{ position:"relative" }}>
            <input
              type={show ? "text" : "password"}
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="••••••••••••••"
              autoFocus={!passkey}
              style={{ width:"100%", padding:"12px 40px 12px 14px", background:"#111", border:"1.5px solid #333", borderRadius:6, color:"#fff", fontFamily:"'Crimson Pro',Georgia,serif", fontSize:"1rem", outline:"none", letterSpacing:"2px", transition:"border-color 0.15s" }}
              onFocus={e => (e.target.style.borderColor = "#c8102e")}
              onBlur={e => (e.target.style.borderColor = "#333")}
            />
            <button type="button" onClick={() => setShow(s => !s)}
              style={{ position:"absolute", right:10, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", color:"rgba(255,255,255,0.35)", fontSize:"0.8rem", padding:4 }}>
              {show ? "HIDE" : "SHOW"}
            </button>
          </div>
          <button type="submit"
            style={{ background:"#c8102e", color:"#fff", border:"none", borderRadius:6, padding:"12px", fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.95rem", letterSpacing:"2.5px", cursor:"pointer", transition:"background 0.15s" }}
            onMouseOver={e => (e.currentTarget.style.background = "#9a0c22")}
            onMouseOut={e => (e.currentTarget.style.background = "#c8102e")}>
            Enter
          </button>
        </form>
      </div>

      {/* Remove biometric link (shown when registered) */}
      {passkey && (
        <button onClick={removeBiometric}
          style={{ marginTop:14, background:"none", border:"none", cursor:"pointer", fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.55rem", letterSpacing:"2px", color:"rgba(255,255,255,0.15)", textDecoration:"underline" }}>
          REMOVE {bio.name.toUpperCase()} FROM THIS DEVICE
        </button>
      )}

      {/* Can't log in? */}
      <div style={{ marginTop:28, textAlign:"center" }}>
        <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.6rem", letterSpacing:"2.5px", color:"rgba(255,255,255,0.25)", marginBottom:12, textTransform:"uppercase" }}>
          Can't log in? Go here:
        </div>
        <div style={{ display:"flex", gap:10, justifyContent:"center", flexWrap:"wrap" }}>
          <a href="https://www.instagram.com/blackreadbrown" target="_blank" rel="noopener noreferrer"
            style={{ display:"flex", alignItems:"center", gap:5, color:"#e1306c", textDecoration:"none", fontSize:"0.72rem", fontFamily:"'Bebas Neue',sans-serif", letterSpacing:"1px", padding:"5px 12px", border:"1px solid #e1306c40", borderRadius:4, background:"#e1306c0f" }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
            </svg>
            @blackreadbrown
          </a>
          <a href="https://www.whatnot.com/user/blackreadbrown" target="_blank" rel="noopener noreferrer"
            style={{ display:"flex", alignItems:"center", gap:5, color:"#7c3aed", textDecoration:"none", fontSize:"0.72rem", fontFamily:"'Bebas Neue',sans-serif", letterSpacing:"1px", padding:"5px 12px", border:"1px solid #7c3aed40", borderRadius:4, background:"#7c3aed0f" }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.5 8.5l-7 9-3.5-4.5 1.5-1.167L10.5 14l5.5-7L17.5 8.5z"/>
            </svg>
            Whatnot
          </a>
          <a href="https://www.ebay.com/usr/blackreadbrown" target="_blank" rel="noopener noreferrer"
            style={{ display:"flex", alignItems:"center", gap:5, color:"#e43137", textDecoration:"none", fontSize:"0.72rem", fontFamily:"'Bebas Neue',sans-serif", letterSpacing:"1px", padding:"5px 12px", border:"1px solid #e4313740", borderRadius:4, background:"#e431370f" }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
              <path d="M0 16.8v-1.6C0 9 5.4 5.6 10.8 5.6c2.4 0 4.8.8 6.4 2.4L16 9.2c-1.2-1.2-3.2-2-5.2-2C6.8 7.2 1.6 10 1.6 15.2v1.6c0 5.2 5.2 8 9.2 8 2 0 4-.8 5.2-2l1.2 1.2c-1.6 1.6-4 2.4-6.4 2.4C5.4 26.4 0 23 0 16.8zm13.6-3.2h8.8c-.4-3.2-2.8-5.6-6-5.6-2.8 0-5.2 2-6 5.6h3.2z"/>
            </svg>
            eBay
          </a>
        </div>
      </div>

      <style>{`
        @keyframes shake {
          0%,100% { transform:translateX(0); }
          20%      { transform:translateX(-8px); }
          40%      { transform:translateX(8px); }
          60%      { transform:translateX(-6px); }
          80%      { transform:translateX(6px); }
        }
      `}</style>
    </div>
  );
}

// ── Biometric icon — fingerprint, face, or shield based on platform ──────────
function BiometricIcon({ type, size = 24, color = "currentColor" }: { type: "face" | "fingerprint" | "shield"; size?: number; color?: string }) {
  if (type === "fingerprint") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 1C7.2 1 3.3 4.2 2.2 8.5" />
        <path d="M21.8 8.5C20.7 4.2 16.8 1 12 1" />
        <path d="M2 12c0-.4 0-.7.1-1" />
        <path d="M21.9 11c.1.3.1.7.1 1" />
        <path d="M7 12a5 5 0 0 1 10 0c0 3.5-1.6 6.6-4 8.5" />
        <path d="M12 7a5 5 0 0 1 5 5c0 2-.5 3.8-1.4 5.3" />
        <path d="M12 7a5 5 0 0 0-4.5 7.2" />
        <path d="M12 12v4" />
      </svg>
    );
  }
  if (type === "shield") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.25C17.25 22.15 21 17.25 21 12V7L12 2z" />
        <path d="M9 12l2 2 4-4" />
      </svg>
    );
  }
  // Face ID (iOS)
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 7V4a2 2 0 0 1 2-2h3" />
      <path d="M17 2h3a2 2 0 0 1 2 2v3" />
      <path d="M22 17v3a2 2 0 0 1-2 2h-3" />
      <path d="M7 22H4a2 2 0 0 1-2-2v-3" />
      <path d="M9 10h.01" strokeWidth="2" />
      <path d="M15 10h.01" strokeWidth="2" />
      <path d="M12 13v1" />
      <path d="M9 16c.6.7 1.8 1 3 1s2.4-.3 3-1" />
    </svg>
  );
}
