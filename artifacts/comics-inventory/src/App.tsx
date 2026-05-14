import { useState } from "react";
import OriginalCollection from "@/pages/OriginalCollection";
import AllBoxes from "@/pages/AllBoxes";
import BoxKeys from "@/pages/BoxKeys";
import Calendar from "@/pages/Calendar";
import ShowPlanner from "@/pages/ShowPlanner";
import CGCStrategy from "@/pages/CGCStrategy";
import PrivateSignings from "@/pages/PrivateSignings";

const TABS = [
  { id: "collection", label: "Original Collection", sub: "308 books" },
  { id: "boxes", label: "All Boxes", sub: "1,467 books" },
  { id: "boxkeys", label: "Box Keys", sub: "141 keys" },
  { id: "calendar", label: "Calendar", sub: "Shows & Deadlines" },
  { id: "showplanner", label: "Show Planner", sub: "19 concepts" },
  { id: "cgc", label: "CGC Strategy", sub: "10 priorities" },
  { id: "signings", label: "Signings", sub: "2026 Signings" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>("collection");

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#0a0a0a", color: "#d4a574", fontFamily: "Georgia, serif" }}>
      {/* Header */}
      <header style={{ background: "#111", borderBottom: "3px solid #8b1a1a", padding: "12px 24px", display: "flex", alignItems: "center", gap: 16 }}>
        <div>
          <h1 style={{ color: "#c8102e", fontSize: "1.3rem", letterSpacing: 3, textTransform: "uppercase", margin: 0 }}>
            Marshall Comics
          </h1>
          <p style={{ color: "#666", fontSize: "0.7rem", letterSpacing: 2, textTransform: "uppercase", margin: 0 }}>
            BlackReadBrown Inventory Hub
          </p>
        </div>
      </header>

      {/* Tab Bar */}
      <div style={{ background: "#111", borderBottom: "1px solid #2a2a2a", overflowX: "auto", flexShrink: 0 }}>
        <div style={{ display: "flex", minWidth: "max-content" }}>
          {TABS.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  padding: "10px 20px",
                  background: active ? "#8b1a1a" : "transparent",
                  color: active ? "#fff" : "#888",
                  border: "none",
                  borderBottom: active ? "2px solid #c8102e" : "2px solid transparent",
                  cursor: "pointer",
                  fontSize: "0.78rem",
                  letterSpacing: 1,
                  textTransform: "uppercase",
                  transition: "all 0.15s",
                  whiteSpace: "nowrap",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 2,
                }}
              >
                <span>{tab.label}</span>
                <span style={{ fontSize: "0.6rem", color: active ? "rgba(255,255,255,0.6)" : "#555" }}>{tab.sub}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Page Content */}
      <div style={{ flex: 1, overflow: "auto" }}>
        {activeTab === "collection" && <OriginalCollection />}
        {activeTab === "boxes" && <AllBoxes />}
        {activeTab === "boxkeys" && <BoxKeys />}
        {activeTab === "calendar" && <Calendar />}
        {activeTab === "showplanner" && <ShowPlanner />}
        {activeTab === "cgc" && <CGCStrategy />}
        {activeTab === "signings" && <PrivateSignings />}
      </div>
    </div>
  );
}
