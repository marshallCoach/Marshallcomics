import { useState } from "react";
import { DATA3 } from "@/data/data3";
import OriginalCollection from "@/pages/OriginalCollection";
import BoxKeys from "@/pages/BoxKeys";
import Calendar from "@/pages/Calendar";
import ShowPlanner from "@/pages/ShowPlanner";
import CGCStrategy from "@/pages/CGCStrategy";
import PrivateSignings from "@/pages/PrivateSignings";
import Summary from "@/pages/Summary";
import Everything from "@/pages/Everything";
import PasswordGate from "@/components/PasswordGate";

const NAV = [
  {
    id: "inventory",
    label: "Inventory",
    tabs: [
      { id: "summary",    label: "📊 Summary" },
      { id: "everything", label: "🔍 Everything" },
      { id: "collection", label: "📦 Sales Inventory" },
      { id: "boxkeys",    label: "🔑 Box Keys" },
    ],
  },
  {
    id: "business",
    label: "Business Docs",
    tabs: [
      { id: "calendar",    label: "📅 Calendar" },
      { id: "showplanner", label: "🎙️ Show Planner" },
      { id: "cgc",         label: "🏆 CGC Strategy" },
      { id: "signings",    label: "✍️ Signings" },
    ],
  },
] as const;

type SectionId = (typeof NAV)[number]["id"];
type TabId =
  | "summary" | "everything" | "boxes" | "collection" | "boxkeys"
  | "calendar" | "showplanner" | "cgc" | "signings";

const comics  = DATA3.comics;
const total   = comics.length;
const signed  = comics.filter(c => (c.Signed || "").toUpperCase() === "YES").length;
const keys    = comics.filter(c => (c.Key || "").toUpperCase() === "YES").length;
const boxes   = DATA3.boxes.length;

export default function App() {
  const [activeSection, setActiveSection] = useState<SectionId>("inventory");
  const [activeTab, setActiveTab]         = useState<TabId>("summary");

  const currentSection = NAV.find(n => n.id === activeSection)!;

  function handleSection(sid: SectionId) {
    setActiveSection(sid);
    const sec = NAV.find(n => n.id === sid)!;
    setActiveTab(sec.tabs[0].id as TabId);
  }

  return (
    <PasswordGate>
    <div style={{ minHeight: "100vh" }}>

      {/* HEADER */}
      <header className="app-header">
        <div className="logo-area">
          <img src="/logo.png" alt="BlackReadBrown" className="site-logo" />
          <div>
            <div className="app-title">Marshall Comics</div>
            <div className="app-subtitle">Private Collection Database</div>
          </div>
        </div>
        <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:10 }}>
          <div className="header-stats">
            <div className="stat">
              <span className="stat-val">{total.toLocaleString()}</span>
              <span className="stat-lbl">Comics</span>
            </div>
            <div className="stat">
              <span className="stat-val">{boxes}</span>
              <span className="stat-lbl">Boxes</span>
            </div>
            <div className="stat">
              <span className="stat-val">{keys}</span>
              <span className="stat-lbl">Keys</span>
            </div>
            <div className="stat">
              <span className="stat-val">{signed}</span>
              <span className="stat-lbl">Signed</span>
            </div>
          </div>

          {/* Social links */}
          <div style={{ display:"flex", gap:10, alignItems:"center" }}>
            <a href="https://www.instagram.com/blackreadbrown" target="_blank" rel="noopener noreferrer"
              style={{ display:"flex", alignItems:"center", gap:5, color:"#e1306c", textDecoration:"none",
                fontSize:"0.72rem", fontFamily:"'Bebas Neue',sans-serif", letterSpacing:"1px",
                padding:"4px 10px", border:"1px solid #e1306c40", borderRadius:4, background:"#e1306c10" }}>
              {/* Instagram SVG */}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
              </svg>
              @blackreadbrown
            </a>

            <a href="https://www.whatnot.com/user/blackreadbrown" target="_blank" rel="noopener noreferrer"
              style={{ display:"flex", alignItems:"center", gap:5, color:"#7c3aed", textDecoration:"none",
                fontSize:"0.72rem", fontFamily:"'Bebas Neue',sans-serif", letterSpacing:"1px",
                padding:"4px 10px", border:"1px solid #7c3aed40", borderRadius:4, background:"#7c3aed10" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.5 8.5l-7 9-3.5-4.5 1.5-1.167L10.5 14l5.5-7L17.5 8.5z"/>
              </svg>
              Whatnot
            </a>

            <a href="https://www.ebay.com/usr/blackreadbrown" target="_blank" rel="noopener noreferrer"
              style={{ display:"flex", alignItems:"center", gap:5, color:"#e43137", textDecoration:"none",
                fontSize:"0.72rem", fontFamily:"'Bebas Neue',sans-serif", letterSpacing:"1px",
                padding:"4px 10px", border:"1px solid #e4313740", borderRadius:4, background:"#e4313710" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M0 16.8v-1.6C0 9 5.4 5.6 10.8 5.6c2.4 0 4.8.8 6.4 2.4L16 9.2c-1.2-1.2-3.2-2-5.2-2C6.8 7.2 1.6 10 1.6 15.2v1.6c0 5.2 5.2 8 9.2 8 2 0 4-.8 5.2-2l1.2 1.2c-1.6 1.6-4 2.4-6.4 2.4C5.4 26.4 0 23 0 16.8zm13.6-3.2h8.8c-.4-3.2-2.8-5.6-6-5.6-2.8 0-5.2 2-6 5.6h3.2z"/>
              </svg>
              eBay
            </a>
          </div>
        </div>
      </header>

      {/* MAIN NAV */}
      <div className="main-nav">
        {NAV.map(section => (
          <button
            key={section.id}
            className={`main-nav-btn${activeSection === section.id ? " active" : ""}`}
            onClick={() => handleSection(section.id as SectionId)}
          >
            {section.label}
          </button>
        ))}
      </div>

      {/* SUB NAV */}
      <nav className="tab-nav">
        {currentSection.tabs.map(tab => (
          <button
            key={tab.id}
            className={`tab-btn${activeTab === tab.id ? " active" : ""}`}
            onClick={() => setActiveTab(tab.id as TabId)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {/* PAGES */}
      {activeTab === "summary"     && <Summary />}
      {activeTab === "everything"  && <Everything />}
      {activeTab === "collection"  && <OriginalCollection />}
      {activeTab === "boxkeys"     && <BoxKeys />}
      {activeTab === "calendar"    && <Calendar />}
      {activeTab === "showplanner" && <ShowPlanner />}
      {activeTab === "cgc"         && <CGCStrategy />}
      {activeTab === "signings"    && <PrivateSignings />}
    </div>
    </PasswordGate>
  );
}
