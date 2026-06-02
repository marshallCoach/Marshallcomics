import { loadAllFlags } from "@/lib/comicFlags";

export function downloadClaudeNotes(filename?: string): void {
  const flags = loadAllFlags();
  const entries = Object.entries(flags);

  if (entries.length === 0) {
    alert("No notes or flags yet — flag some books in Every Book first.");
    return;
  }

  const date = new Date().toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
  const heavy = "══════════════════════════════════════════════════";
  const thin  = "──────────────────────────────────────────────────";

  const lines: string[] = [
    "BRB INVENTORY NOTES FOR CLAUDE",
    heavy,
    `Exported: ${date}`,
    `Total flagged entries: ${entries.length}`,
    heavy,
    "",
  ];

  const withNotes  = entries.filter(([, v]) => v.notes?.trim());
  const fieldsOnly = entries.filter(([, v]) => !v.notes?.trim() && v.fields?.length);

  if (withNotes.length) {
    lines.push(`ENTRIES WITH NOTES (${withNotes.length})`, thin, "");
    for (const [key, entry] of withNotes) {
      const [title, issue, box] = key.split("|||");
      lines.push(`BOOK:  ${title} #${issue}${box ? `  [Box ${box}]` : ""}`);
      if (entry.fields?.length) lines.push(`FLAGS: ${entry.fields.join(", ")}`);
      lines.push(`NOTES: ${entry.notes.trim()}`);
      lines.push("");
    }
  }

  if (fieldsOnly.length) {
    lines.push(`FIELD FLAGS — no notes yet (${fieldsOnly.length})`, thin, "");
    for (const [key, entry] of fieldsOnly) {
      const [title, issue, box] = key.split("|||");
      lines.push(`BOOK:  ${title} #${issue}${box ? `  [Box ${box}]` : ""}`);
      lines.push(`FLAGS: ${entry.fields.join(", ")}`);
      lines.push("");
    }
  }

  lines.push(heavy, "END OF NOTES");

  const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = filename ?? `brb-notes-${new Date().toISOString().slice(0, 10)}.txt`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
