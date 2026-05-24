import type { NavParams } from "../App";

type NavFn = (page: string, params?: NavParams) => void;

interface PageEntry {
  id: string;
  label: string;
  icon: string;
  desc: string;
  features: string[];
  accent?: string;
}

const INVENTORY_PAGES: PageEntry[] = [
  {
    id: "summary",
    label: "Home",
    icon: "⌂",
    desc: "Your command center. Box progress, stat counters, upcoming events, and publisher breakdown — all animated on load.",
    features: ["Box catalogue progress bar", "Collection stats counters", "Upcoming shows & signings", "Quick search widget", "Next actions tracker", "Publisher split chart"],
  },
  {
    id: "everything",
    label: "Every Book",
    icon: "📚",
    desc: "All 7,232 comics in one searchable, filterable view. List table or card grid, sorted any way you want.",
    features: ["Live search across all fields", "Publisher / box / writer filters", "Key issues & signed filters", "NM value column", "Card view with detail expand", "Character family pills"],
  },
  {
    id: "runs",
    label: "Runs",
    icon: "▦",
    desc: "Titles where you own 75%+ of a run. See exactly which issues you're missing and jump to Comic Vine to find them.",
    features: ["Run completion percentage", "Missing issue gaps", "Comic Vine search links", "Sort by completion / count"],
  },
  {
    id: "collection",
    label: "Sales",
    icon: "$",
    desc: "Sales-focused inventory view. Filter and sort books you're moving on eBay, Whatnot, or at shows.",
    features: ["Platform filters (Whatnot / eBay / Terrificon)", "NM & VF value columns", "Signed books filter", "Start bid display", "Card & list view"],
    accent: "#1a7a1a",
  },
  {
    id: "boxkeys",
    label: "Box Keys",
    icon: "★",
    desc: "Every key issue in the collection, organized by box. Your most important research and pricing page.",
    features: ["Filter by box, publisher, platform", "Key reason + 1st appearance", "NM value & start bid", "CGC candidate flag", "Card & list view"],
    accent: "#8a6000",
  },
  {
    id: "boxvisual",
    label: "Box View",
    icon: "▬",
    desc: "See inside any box as a visual spine display — each book is a colored stripe, keys are taller, signed books have a green edge.",
    features: ["Select any of 51 boxes", "Color-coded by title", "Key / signed visual markers", "Sorted or box-order toggle", "Title detail panel", "By Run accordion view"],
  },
  {
    id: "stats",
    label: "Stats",
    icon: "◉",
    desc: "Charts and analytics across the full collection — publisher spread, era distribution, key issue rate, and more.",
    features: ["Publisher pie chart", "Era breakdown", "Key issue rate", "Whatnot / eBay split", "Recharts visualizations"],
  },
  {
    id: "dataview",
    label: "Data View",
    icon: "≡",
    desc: "Field population stats across all 31 data fields. See which columns are fully filled vs. need attention, ranked most-to-least.",
    features: ["31 field coverage audit", "Bar visualization per field", "Most-to-least populated sort", "Data quality overview"],
    accent: "#5b4fc8",
  },
  {
    id: "capfalcon",
    label: "Cap & Falcon",
    icon: "🛡",
    desc: "Dedicated checklist for the Captain America & Falcon collection — tracking run completion for this key title.",
    features: ["Issue-by-issue checklist", "Owned / missing status", "Run completion tracking"],
    accent: "#c8102e",
  },
];

const BUSINESS_PAGES: PageEntry[] = [
  {
    id: "hunting",
    label: "Box Hunt",
    icon: "🎯",
    desc: "Search and filter across all boxes to find specific books. Built for hunting through the physical collection fast.",
    features: ["Multi-box search", "Publisher & key filters", "NM value display", "Box badge on every result"],
  },
  {
    id: "calendar",
    label: "Calendar",
    icon: "📅",
    desc: "All upcoming shows, signings, and deadlines in one place. Sort ascending or descending, list or card view.",
    features: ["Date sort toggle (asc / desc)", "List & card view", "Category color coding", "Days-to-go countdown"],
  },
  {
    id: "showplanner",
    label: "Whatnot Shows",
    icon: "🎙",
    desc: "12 themed show concepts with curated book selections from the collection. Your stream prep starts here.",
    features: ["12 show themes", "Book selections per show", "Theme descriptions", "Platform-tagged inventory"],
    accent: "#e85d04",
  },
  {
    id: "timeline",
    label: "Timeline",
    icon: "⟶",
    desc: "Visual chronological record of every box catalogue session. See when each box was documented and what was in it.",
    features: ["Grouped by session date", "Box count per session", "Comic & key counts", "Date-ordered timeline"],
  },
  {
    id: "cgc",
    label: "CGC",
    icon: "◈",
    desc: "CGC grading strategy, signing priority list, and census targets. Your roadmap to the books worth submitting.",
    features: ["CGC candidate list", "Signing priority", "Census-aware targeting", "Grade-up strategy"],
    accent: "#1a6cb0",
  },
  {
    id: "signings",
    label: "Signings",
    icon: "✍",
    desc: "Private signings tracker — which books are signed, by whom, at what event, and any personalization notes.",
    features: ["53 signed books tracked", "Signer & event detail", "Personalization notes", "Filterable list"],
    accent: "#7a5c3a",
  },
  {
    id: "actionplan",
    label: "Action Plan",
    icon: "✓",
    desc: "Prioritized task list for the collection and business. Mark items done, track progress across every category.",
    features: ["Priority-ordered steps", "Status tracking (done / in progress)", "Category tags", "Progress counter"],
  },
];

export default function SiteMap({ onNavigate }: { onNavigate: NavFn }) {
  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "20px 16px 80px" }}>

      <div style={{ marginBottom: 28 }}>
        <div style={{
          fontFamily: "'Bebas Neue', sans-serif", fontSize: "2rem",
          letterSpacing: "4px", color: "var(--red)", lineHeight: 1,
        }}>SITE MAP</div>
        <div style={{ fontSize: "0.85rem", color: "var(--muted2)", marginTop: 4 }}>
          Every page in the Marshall Comics Inventory Hub — click any card to navigate there.
        </div>
      </div>

      <Section
        label="Inventory"
        sublabel="Collection management, research, and data"
        pages={INVENTORY_PAGES}
        onNavigate={onNavigate}
      />

      <Section
        label="Business"
        sublabel="Show prep, events, strategy, and planning"
        pages={BUSINESS_PAGES}
        onNavigate={onNavigate}
      />

      <div style={{
        marginTop: 32, padding: "16px 20px",
        background: "var(--surface)", border: "1.5px solid var(--border)",
        borderRadius: 8, fontSize: "0.78rem", color: "var(--muted2)", lineHeight: 1.7,
      }}>
        <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "0.7rem",
          letterSpacing: "2px", color: "var(--red)", marginRight: 10 }}>DATA</span>
        7,232 comics · 51 boxes · 1,013 key issues · 53 signed books · 31 tracked fields per comic
        <span style={{ margin: "0 10px", color: "var(--border)" }}>·</span>
        Auto-generated from xlsx · No database · Static TypeScript
      </div>
    </div>
  );
}

function Section({
  label, sublabel, pages, onNavigate,
}: {
  label: string;
  sublabel: string;
  pages: PageEntry[];
  onNavigate: NavFn;
}) {
  return (
    <div style={{ marginBottom: 36 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 14, marginBottom: 14,
        borderBottom: "2px solid var(--red)", paddingBottom: 8 }}>
        <span style={{
          fontFamily: "'Bebas Neue', sans-serif", fontSize: "1.1rem",
          letterSpacing: "3px", color: "var(--red)",
        }}>{label}</span>
        <span style={{ fontSize: "0.78rem", color: "var(--muted2)" }}>{sublabel}</span>
      </div>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
        gap: 12,
      }}>
        {pages.map(page => (
          <PageCard key={page.id} page={page} onNavigate={onNavigate} />
        ))}
      </div>
    </div>
  );
}

function PageCard({ page, onNavigate }: { page: PageEntry; onNavigate: NavFn }) {
  const accent = page.accent || "var(--red)";

  return (
    <div
      onClick={() => onNavigate(page.id)}
      style={{
        background: "#fff",
        border: "1.5px solid var(--border)",
        borderTop: `3px solid ${accent}`,
        borderRadius: 8,
        padding: "14px 16px 16px",
        cursor: "pointer",
        transition: "box-shadow 0.15s, transform 0.15s, border-color 0.15s",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.boxShadow = "0 4px 18px rgba(0,0,0,0.10)";
        el.style.transform = "translateY(-2px)";
        el.style.borderColor = accent === "var(--red)" ? "var(--red)" : accent;
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.boxShadow = "none";
        el.style.transform = "translateY(0)";
        el.style.borderColor = "var(--border)";
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <div style={{
          fontFamily: "'Bebas Neue', sans-serif",
          fontSize: "1.3rem", lineHeight: 1,
          color: accent, flexShrink: 0, minWidth: 24, textAlign: "center",
        }}>{page.icon}</div>
        <div style={{ flex: 1 }}>
          <div style={{
            fontFamily: "'Bebas Neue', sans-serif", fontSize: "1rem",
            letterSpacing: "2px", color: "var(--text)", lineHeight: 1, marginBottom: 4,
          }}>{page.label}</div>
          <div style={{ fontSize: "0.78rem", color: "var(--muted2)", lineHeight: 1.5 }}>
            {page.desc}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 2 }}>
        {page.features.map(f => (
          <span key={f} style={{
            fontSize: "0.6rem",
            fontFamily: "'Bebas Neue', sans-serif",
            letterSpacing: "0.8px",
            background: "var(--surface2)",
            color: "var(--muted)",
            border: "1px solid var(--border)",
            borderRadius: 3,
            padding: "2px 7px",
          }}>{f}</span>
        ))}
      </div>

      <div style={{
        marginTop: "auto", paddingTop: 8,
        borderTop: "1px solid var(--border)",
        display: "flex", justifyContent: "flex-end",
      }}>
        <span style={{
          fontFamily: "'Bebas Neue', sans-serif", fontSize: "0.62rem",
          letterSpacing: "1.5px", color: accent, opacity: 0.8,
        }}>OPEN →</span>
      </div>
    </div>
  );
}
