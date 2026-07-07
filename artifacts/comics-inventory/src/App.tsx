import { useState, useEffect, useCallback } from "react";
import { DATA } from "@/data/data";
import GlobalSearch from "@/components/GlobalSearch";
import OriginalCollection from "@/pages/OriginalCollection";
import BoxKeys from "@/pages/BoxKeys";
import Calendar from "@/pages/Calendar";
import ShowPlanner from "@/pages/ShowPlanner";
import CGCStrategy from "@/pages/CGCStrategy";
import PrivateSignings from "@/pages/PrivateSignings";
import Summary from "@/pages/Summary";
import Everything from "@/pages/Everything";
import ActionPlan from "@/pages/ActionPlan";
import CollectionStats from "@/pages/CollectionStats";
import BoxTimeline from "@/pages/BoxTimeline";
import BoxVisual from "@/pages/BoxVisual";
import Runs from "@/pages/Runs";
import Volumes from "@/pages/Volumes";
import DataView from "@/pages/DataView";
import BoxHunt from "@/pages/BoxHunt";
import CapFalconChecklist from "@/pages/CapFalconChecklist";
import SiteMap from "@/pages/SiteMap";
import PullList from "@/pages/PullList";
import SellerDashboard from "@/pages/SellerDashboard";
import Duplicates from "@/pages/Duplicates";
import DupCheckList from "@/pages/DupCheckList";
import ComicHistory from "@/pages/ComicHistory";
import OrganizationPath from "@/pages/OrganizationPath";
import BoxLabels from "@/pages/BoxLabels";
import KeyCatalog from "@/pages/KeyCatalog";
import CoverCatalog from "@/pages/CoverCatalog";
import BoxQuest from "@/pages/BoxQuest";
import BoxMap from "@/pages/BoxMap";
import EbayPipeline from "@/pages/EbayPipeline";
import OpsReference from "@/pages/OpsReference";
import EbayListingGuide from "@/pages/EbayListingGuide";
import PasswordGate from "@/components/PasswordGate";

type TabId =
  | "summary" | "everything" | "collection" | "boxkeys" | "stats" | "runs" | "dataview"
  | "calendar" | "showplanner" | "cgc" | "signings" | "actionplan" | "timeline" | "boxvisual"
  | "hunting" | "capfalcon" | "sitemap" | "pulllist" | "sellerdash" | "duplicates" | "dupchecklist" | "history"
  | "orgpath" | "volumes" | "boxlabels" | "keycatalog" | "covercatalog" | "boxquest" | "boxmap"
  | "ebaypipeline" | "opsreference" | "ebaylistingguide";

export type NavParams = {
  box?: string;
  signed?: string;
  query?: string;
  publisher?: string;
  keysOnly?: string;
};

const NAV = [
  {
    id: "inventory",
    label: "Inventory",
    tabs: [
      { id: "summary",     label: "Home" },
      { id: "everything",  label: "Every Book" },
      { id: "runs",        label: "Runs" },
      { id: "volumes",     label: "Volumes" },
      { id: "collection",  label: "Sales" },
      { id: "history",     label: "History" },
      { id: "stats",       label: "Stats" },
      { id: "dataview",    label: "Data View" },
      { id: "capfalcon",   label: "Cap & Falcon" },
    ],
  },
  {
    id: "organisation",
    label: "Organisation",
    tabs: [
      { id: "orgpath",     label: "Org Path" },
      { id: "boxvisual",   label: "Box View" },
      { id: "boxkeys",     label: "Box Keys" },
      { id: "boxlabels",   label: "Box Labels" },
      { id: "duplicates",     label: "Duplicates" },
      { id: "dupchecklist",  label: "Dup Hunt" },
      { id: "hunting",       label: "Box Hunt" },
      { id: "boxquest",      label: "Box Quest" },
      { id: "boxmap",        label: "Box Map" },
      { id: "timeline",    label: "Timeline" },
      { id: "ebaypipeline",     label: "eBay Pipeline" },
      { id: "opsreference",     label: "Ops Reference" },
      { id: "ebaylistingguide", label: "Phase 1 Listing Guide" },
    ],
  },
  {
    id: "catalog",
    label: "Catalog",
    tabs: [
      { id: "keycatalog",   label: "Key Issues" },
      { id: "covercatalog", label: "Cover Art" },
    ],
  },
  {
    id: "business",
    label: "Business",
    tabs: [
      { id: "pulllist",    label: "Pull List" },
      { id: "sellerdash",  label: "Seller Dashboard" },
      { id: "calendar",    label: "Calendar" },
      { id: "showplanner", label: "Whatnot Shows" },
      { id: "cgc",         label: "CGC" },
      { id: "signings",    label: "Signings" },
      { id: "actionplan",  label: "Action Plan" },
    ],
  },
] as const;

type SectionId = (typeof NAV)[number]["id"];

const comics = DATA.comics;
const total  = comics.length;
const signed = comics.filter(c => (c.Signed || "").toUpperCase() === "YES").length;
const keys   = comics.filter(c => (c.Key    || "").toUpperCase() === "YES").length;
const boxes  = DATA.boxes.length;

const TERRIFICON_DATE = new Date(2026, 7, 7, 9, 0, 0);

function useCountdown(target: Date) {
  const [diff, setDiff] = useState(() => target.getTime() - Date.now());
  useEffect(() => {
    const t = setInterval(() => setDiff(target.getTime() - Date.now()), 1000);
    return () => clearInterval(t);
  }, [target]);
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, past: true };
  const secs = Math.floor(diff / 1000);
  return {
    days:    Math.floor(secs / 86400),
    hours:   Math.floor((secs % 86400) / 3600),
    minutes: Math.floor((secs % 3600) / 60),
    seconds: secs % 60,
    past:    false,
  };
}

export default function App() {
  const [activeSection, setActiveSection] = useState<SectionId>("inventory");
  const [activeTab,     setActiveTab]     = useState<TabId>("summary");
  const [navParams,     setNavParams]     = useState<NavParams>({});
  const [showSearch,    setShowSearch]    = useState(false);
  const cd = useCountdown(TERRIFICON_DATE);

  const currentSection = NAV.find(n => n.id === activeSection)!;

  const openSearch  = useCallback(() => setShowSearch(true),  []);
  const closeSearch = useCallback(() => setShowSearch(false), []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); openSearch(); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openSearch]);

  function navigateTo(tab: string, params?: NavParams) {
    const t = tab as TabId;
    const targetSection = NAV.find(s => s.tabs.some(tb => tb.id === t));
    if (targetSection && targetSection.id !== activeSection) {
      setActiveSection(targetSection.id as SectionId);
    }
    setNavParams(params || {});
    setActiveTab(t);
  }

  function handleSection(sid: SectionId) {
    setActiveSection(sid);
    const sec = NAV.find(n => n.id === sid)!;
    setActiveTab(sec.tabs[0].id as TabId);
  }

  return (
    <PasswordGate>
    <div style={{ minHeight:"100vh" }}>
      {showSearch && <GlobalSearch onNavigate={navigateTo} onClose={closeSearch} />}

      {/* TERRIFICON BANNER */}
      {!cd.past && (
        <button className="terrificon-banner" onClick={() => navigateTo("cgc")}>
          <span className="tf-label">TERRIFICON · AUG 7–9</span>
          <span className="tf-divider">·</span>
          <span className="tf-time">{cd.days}d {cd.hours}h {String(cd.minutes).padStart(2,"0")}m {String(cd.seconds).padStart(2,"0")}s</span>
        </button>
      )}

      {/* HEADER */}
      <header className="app-header">
        <div className="logo-area">
          <button onClick={() => navigateTo("summary")} className="logo-btn">
            <img src="/logo.png" alt="BlackReadBrown" className="site-logo" />
          </button>
          <div className="app-title">Marshall Comics</div>
        </div>

        <div className="header-stats">
          <div className="stat"><span className="stat-val">{total.toLocaleString()}</span><span className="stat-lbl">Comics</span></div>
          <div className="stat"><span className="stat-val">{boxes}</span><span className="stat-lbl">Boxes</span></div>
          <div className="stat"><span className="stat-val">{keys.toLocaleString()}</span><span className="stat-lbl">Keys</span></div>
          <div className="stat"><span className="stat-val">{signed}</span><span className="stat-lbl">Signed</span></div>
        </div>

        <div className="header-actions">
          <div className="header-social">
            <a href="https://www.instagram.com/blackreadbrown" target="_blank" rel="noopener noreferrer" className="social-link ig" aria-label="Instagram">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
            </a>
            <a href="https://github.com/marshallCoach/Marshallcomics" target="_blank" rel="noopener noreferrer" className="social-link gh" aria-label="GitHub">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
            </a>
            <a href="https://www.whatnot.com/user/blackreadbrown" target="_blank" rel="noopener noreferrer" className="social-link wn" aria-label="Whatnot">WN</a>
            <a href="https://www.ebay.com/usr/blackreadbrown" target="_blank" rel="noopener noreferrer" className="social-link eb" aria-label="eBay">EB</a>
          </div>
          <button className="search-btn" onClick={openSearch} title="Search (⌘K)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <span className="search-btn-label">Search</span>
            <kbd className="search-kbd">⌘K</kbd>
          </button>
        </div>
      </header>

      {/* MAIN NAV */}
      <div className="main-nav">
        {NAV.map(section => (
          <button
            key={section.id}
            className={`main-nav-btn${activeSection === section.id ? " active" : ""}`}
            onClick={() => handleSection(section.id as SectionId)}
          >{section.label}</button>
        ))}
      </div>

      {/* SUB NAV */}
      <nav className="tab-nav">
        {currentSection.tabs.map(tab => (
          <button
            key={tab.id}
            className={`tab-btn${activeTab === tab.id ? " active" : ""}`}
            onClick={() => setActiveTab(tab.id as TabId)}
          >{tab.label}</button>
        ))}
      </nav>

      {/* PAGES */}
      <div className="page-content">
        {activeTab === "summary"     && <Summary     onNavigate={navigateTo} />}
        {activeTab === "everything"  && (
          <Everything
            initBox={navParams.box}
            initQuery={navParams.query}
            initPublisher={navParams.publisher}
            initKeysOnly={navParams.keysOnly === "true"}
            initSignedOnly={navParams.signed === "YES"}
            onNavigate={navigateTo}
          />
        )}
        {activeTab === "runs"        && <Runs />}
        {activeTab === "volumes"     && <Volumes onNavigate={navigateTo} />}
        {activeTab === "collection"  && <OriginalCollection initSigned={navParams.signed} />}
        {activeTab === "boxkeys"     && <BoxKeys />}
        {activeTab === "calendar"    && <Calendar />}
        {activeTab === "showplanner" && <ShowPlanner />}
        {activeTab === "timeline"    && <BoxTimeline />}
        {activeTab === "boxvisual"   && <BoxVisual initBox={navParams.box} />}
        {activeTab === "orgpath"     && <OrganizationPath />}
        {activeTab === "boxlabels"   && <BoxLabels />}
        {activeTab === "hunting"     && <BoxHunt />}
        {activeTab === "sellerdash"  && <SellerDashboard />}
        {activeTab === "capfalcon"   && <CapFalconChecklist />}
        {activeTab === "cgc"         && <CGCStrategy />}
        {activeTab === "signings"    && <PrivateSignings />}
        {activeTab === "actionplan"  && <ActionPlan />}
        {activeTab === "stats"       && <CollectionStats onNavigate={navigateTo} />}
        {activeTab === "dataview"    && <DataView />}
        {activeTab === "sitemap"     && <SiteMap onNavigate={navigateTo} />}
        {activeTab === "pulllist"    && <PullList />}
        {activeTab === "duplicates"    && <Duplicates onNavigate={navigateTo} />}
        {activeTab === "dupchecklist"  && <DupCheckList />}
        {activeTab === "history"     && <ComicHistory />}
        {activeTab === "keycatalog"  && <KeyCatalog />}
        {activeTab === "covercatalog" && <CoverCatalog />}
        {activeTab === "boxquest"     && <BoxQuest />}
        {activeTab === "boxmap"       && <BoxMap />}
        {activeTab === "ebaypipeline" && <EbayPipeline />}
        {activeTab === "opsreference" && <OpsReference />}
        {activeTab === "ebaylistingguide" && <EbayListingGuide />}
      </div>
    </div>
    </PasswordGate>
  );
}
