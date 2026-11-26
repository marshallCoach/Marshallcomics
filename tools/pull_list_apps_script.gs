/**
 * Pull List live link - paste into the "Magnus comics pull list Ongoing" sheet:
 *   Extensions -> Apps Script -> replace everything with this file -> Save.
 *   Project Settings (gear) -> Script properties -> Add: TOKEN = <a passphrase you choose>
 *   Deploy -> New deployment -> type: Web app -> Execute as: Me -> Who has access: Anyone
 *   -> Deploy -> Authorize -> copy the Web app URL (ends in /exec).
 * Then on the site: Pull List -> "Connect live sheet" -> paste the URL + the passphrase.
 *
 * Reads only the "Magnus comics list" tab. The only cell it ever writes is column F
 * ("new or existing") of the row you change, and only to New / Existing / Z - Finished / Z - Dropped.
 * Every call needs the passphrase. The row number AND the title must match, so a re-sorted
 * sheet can never mark the wrong book.
 */
const SHEET = 'Magnus comics list';
const COL_STATUS = 6;   // F

function _out(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
function _ok(token) {
  const t = PropertiesService.getScriptProperties().getProperty('TOKEN');
  return !!t && token === t;
}
function _sheet() {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET);
}

function doGet(e) {
  if (!_ok(e.parameter.token)) return _out({ error: 'wrong passphrase' });
  const v = _sheet().getDataRange().getDisplayValues();
  const rows = [];
  for (let i = 1; i < v.length; i++) {
    const r = v[i];
    if (!String(r[3]).trim()) continue;
    rows.push({ row: i + 1, publisher: r[2], title: String(r[3]).trim(), type: r[4],
                status: r[5], grade: r[10], mood: r[11] });
  }
  return _out({ rows: rows, updated: new Date().toISOString() });
}

function doPost(e) {
  const b = JSON.parse((e.postData && e.postData.contents) || '{}');
  if (!_ok(b.token)) return _out({ error: 'wrong passphrase' });
  const row = Number(b.row);
  if (!(row >= 2)) return _out({ error: 'bad row' });
  const sh = _sheet();
  const title = String(sh.getRange(row, 4).getDisplayValue()).trim();
  if (title !== String(b.title || '').trim()) return _out({ error: 'the sheet changed - reload the page' });
  const ALLOWED = ['New', 'Existing', 'Z - Finished', 'Z - Dropped'];
  if (ALLOWED.indexOf(b.status) < 0) return _out({ error: 'bad status' });
  const status = b.status;
  sh.getRange(row, COL_STATUS).setValue(status);
  return _out({ ok: true, row: row, title: title, status: status });
}
