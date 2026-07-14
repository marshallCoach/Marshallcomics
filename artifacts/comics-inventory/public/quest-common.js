/* Box Quest — shared helpers: sub-nav, localStorage progress, small utils. */
(function () {
  var PAGES = [
    { file: "quest-hub.html",   label: "Snapshot" },
    { file: "quest-guide.html", label: "Step-by-Step Guide" },
    { file: "quest-board.html", label: "Box Board" },
    { file: "box-quest.html",   label: "Consolidation Planner" },
  ];

  // Storage is shared across the three pages so progress stays in sync.
  var STEP_KEY = "brb_quest_steps_v1";   // { stepId: true }  (guide)
  var BOX_KEY  = "brb_quest_boxes_v1";   // { boxNum: 0|1|2 }  (board)

  function read(key) {
    try { return JSON.parse(localStorage.getItem(key) || "{}"); } catch (e) { return {}; }
  }
  function write(key, obj) {
    try { localStorage.setItem(key, JSON.stringify(obj)); } catch (e) {}
  }

  function renderTopbar(currentFile) {
    var d = window.QUEST_DATA || {};
    var links = PAGES.map(function (p) {
      var active = p.file === currentFile ? " active" : "";
      return '<a class="' + (active ? "active" : "") + '" href="' + p.file + '">' + p.label + "</a>";
    }).join("");
    var src = d.source ? ("Data: " + d.source + " · " + (d.totalRows || 0).toLocaleString() + " rows") : "";
    return (
      '<div class="topbar"><div class="inner">' +
        '<div class="brand"><h1>BOX QUEST</h1><span class="src">' + src + "</span></div>" +
        '<nav class="subnav">' + links + "</nav>" +
      "</div></div>"
    );
  }

  window.BQ = {
    PAGES: PAGES,
    readSteps: function () { return read(STEP_KEY); },
    writeSteps: function (o) { write(STEP_KEY, o); },
    readBoxes: function () { return read(BOX_KEY); },
    writeBoxes: function (o) { write(BOX_KEY, o); },
    renderTopbar: renderTopbar,
    // flatten every guide step id, for progress math
    allStepIds: function () {
      var ids = [];
      (window.QUEST_DATA.guide || []).forEach(function (ph) {
        ph.sittings.forEach(function (si) {
          si.steps.forEach(function (s) { ids.push(s.id); });
        });
      });
      return ids;
    },
    phaseStepIds: function (phase) {
      var ids = [];
      phase.sittings.forEach(function (si) { si.steps.forEach(function (s) { ids.push(s.id); }); });
      return ids;
    },
  };
})();
