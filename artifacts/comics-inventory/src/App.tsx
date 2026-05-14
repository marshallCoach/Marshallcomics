import { useState } from "react";
import { DATA1 } from "@/data/data1";
import { DATA2 } from "@/data/data2";
import OriginalCollection from "@/pages/OriginalCollection";
import AllBoxes from "@/pages/AllBoxes";
import BoxKeys from "@/pages/BoxKeys";
import Calendar from "@/pages/Calendar";
import ShowPlanner from "@/pages/ShowPlanner";
import CGCStrategy from "@/pages/CGCStrategy";
import PrivateSignings from "@/pages/PrivateSignings";

const TABS = [
  { id: "collection", label: "📦 Original Collection" },
  { id: "boxes",      label: "🗃️ All Boxes" },
  { id: "boxkeys",    label: "🔑 Box Keys" },
  { id: "calendar",   label: "📅 Calendar" },
  { id: "showplanner",label: "🎙️ Show Planner" },
  { id: "cgc",        label: "🏆 CGC Strategy" },
  { id: "signings",   label: "✍️ Signings" },
] as const;

type TabId = (typeof TABS)[number]["id"];

const orig   = DATA1.orig_inventory;
const boxes  = DATA2.boxes_inventory;
const signed = orig.filter(c => (c.Signed || "").toUpperCase() === "YES").length;
const origKeys  = orig.filter(c => (c.Key || "").toUpperCase() === "YES").length;
const boxKeys   = DATA2.boxes_keys.length;

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>("collection");

  return (
    <div style={{ minHeight: "100vh" }}>
      {/* Header */}
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
            <span className="stat-val">{orig.length}</span>
            <span className="stat-lbl">Orig</span>
          </div>
          <div className="stat">
            <span className="stat-val">{boxes.length}</span>
            <span className="stat-lbl">Boxes</span>
          </div>
          <div className="stat">
            <span className="stat-val">{signed}</span>
            <span className="stat-lbl">Signed</span>
          </div>
          <div className="stat">
            <span className="stat-val">{origKeys + boxKeys}</span>
            <span className="stat-lbl">Keys</span>
          </div>
          <div className="stat">
            <span className="stat-val">31</span>
            <span className="stat-lbl">Shows</span>
          </div>
        </div>
      </header>

      {/* Tab Bar */}
      <nav className="tab-nav">
        {TABS.map(tab => (
          <button
            key={tab.id}
            className={`tab-btn${activeTab === tab.id ? " active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Pages */}
      {activeTab === "collection"  && <OriginalCollection />}
      {activeTab === "boxes"       && <AllBoxes />}
      {activeTab === "boxkeys"     && <BoxKeys />}
      {activeTab === "calendar"    && <Calendar />}
      {activeTab === "showplanner" && <ShowPlanner />}
      {activeTab === "cgc"         && <CGCStrategy />}
      {activeTab === "signings"    && <PrivateSignings />}
    </div>
  );
}
