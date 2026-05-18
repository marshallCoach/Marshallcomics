import { useState } from "react";
import { DATA3 } from "@/data/data3";
import OriginalCollection from "@/pages/OriginalCollection";
import AllBoxes from "@/pages/AllBoxes";
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
      { id: "boxes",      label: "🗃️ All Boxes" },
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
const boxes   = DATA3.box_summary.length;

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
      {activeTab === "boxes"       && <AllBoxes />}
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
