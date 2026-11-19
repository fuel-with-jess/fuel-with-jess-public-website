/**
 * Fuel with Jess - Daily Journal app
 *
 * Lives inside a client's journal Google Sheet (Extensions -> Apps Script).
 * The app screen itself lives on the website at fuelwithjess.com/journal/
 * and talks to this script in the background (doPost below), so Google's
 * sign-in never gets involved. The screen has up to four tabs:
 *   Check-in  -> writes to "Daily Check In" (the row whose Date matches)
 *   Overview  -> read-only review of the last 10 days + weekly averages
 *   Macros    -> read-only list of the weekly macro blocks on the "Macros"
 *                (or "Overview") tab. Only shown if the journal has them.
 *   Photos    -> writes to "Progress Pictures" (next empty Front/Back/Side
 *                block) + full-size copies in a Drive folder next to the sheet
 *
 * The check-in form is built from the column headers in each journal, so
 * journals with different columns (Energy, WHOOP numbers, "Water Intake"...)
 * all work with this same code. Dropdowns match the sheet's own dropdowns.
 * It never overwrites a formula.
 *
 * This file is plain ASCII on purpose so copy/paste can't garble it.
 */

const CHECKIN_SHEET = 'Daily Check In';
// The tab holding macro targets: the first of these names that exists.
const TARGET_SHEETS = ['Macros', 'Macro Overview', 'Overview'];
const PHOTO_SHEET = 'Progress Pictures';

// Known kinds of columns, matched by the start of the header text.
// Anything else still shows up in the app as a plain text box.
const ROLES = [
  ['weight', /^weight/i],
  ['steps', /^step/i],
  ['exercise', /^(exercise|movement|workout|activity)/i],
  ['nutrition', /^nutrition/i],
  ['sleep', /^sleep/i],
  ['energy', /^energy/i],
  ['stress', /^stress/i],
  ['water', /water/i],
  ['notes', /^notes?\b/i],
  ['recovery', /^recovery/i],
  ['hrv', /^hrv/i],
  ['rhr', /^resting\s*h/i],
  ['strain', /strain/i],
];
const NUMERIC = { weight: 1, steps: 1, sleep: 1, energy: 1, stress: 1, recovery: 1, hrv: 1, rhr: 1, strain: 1 };
const WEARABLE = { recovery: 1, hrv: 1, rhr: 1, strain: 1 };

/* =====================================================================
   Data connection for the app on fuelwithjess.com/journal/
   The website sends {action, args} and gets back {ok, data} or {ok, error}.
   ===================================================================== */

const ACTIONS = {
  getJournal: function (a) { return getJournal(a[0]); },
  saveCheckIn: function (a) { return saveCheckIn(a[0], a[1] || {}); },
  getOverview: function (a) { return getOverview(a[0]); },
  getMacros: function () { return getMacros(); },
  getPhotos: function () { return getPhotos(); },
  savePhotos: function (a) { return savePhotos(a[0], a[1] || {}); },
};

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function run_(action, args) {
  try {
    if (!ACTIONS.hasOwnProperty(action)) throw new Error('Unknown request.');
    const needsDate = { getJournal: 1, saveCheckIn: 1, getOverview: 1, savePhotos: 1 };
    if (needsDate[action] && !/^\d{4}-\d{2}-\d{2}$/.test(String(args[0] || ''))) throw new Error('Missing date.');
    return json_({ ok: true, data: ACTIONS[action](args) });
  } catch (e) {
    return json_({ ok: false, error: (e && e.message) || String(e) });
  }
}

function doPost(e) {
  let body = {};
  try { body = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (err) { return json_({ ok: false, error: 'Bad request.' }); }
  return run_(String(body.action || ''), Array.isArray(body.args) ? body.args : []);
}

/** Opening the script's own address: data requests (?action=...) or, for
    older links, the in-sheet version of the screen if an Index file exists. */
function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.action) return run_(String(p.action), p.args ? JSON.parse(p.args) : []);
  try {
    return HtmlService.createHtmlOutputFromFile('Index')
      .setTitle('My Daily Journal')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover');
  } catch (err) {
    return HtmlService.createHtmlOutput('<p style="font-family:sans-serif;padding:24px">Open your journal from the link Jess sent you (fuelwithjess.com/journal/...).</p>');
  }
}

/* =====================================================================
   Helpers
   ===================================================================== */

function ss_() { return SpreadsheetApp.getActive(); }
function tz_() { return ss_().getSpreadsheetTimeZone(); }
function dayKey_(d) { return Utilities.formatDate(d, tz_(), 'yyyy-MM-dd'); }
function keyToDate_(k) { const p = k.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
/** Adds n days to a 'yyyy-MM-dd' key (done in UTC so time zones can't shift it). */
function addDays_(k, n) {
  const d = new Date(k + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return Utilities.formatDate(d, 'UTC', 'yyyy-MM-dd');
}
function weekday_(k) { return new Date(k + 'T00:00:00Z').getUTCDay(); } // 0 = Sunday
function sheet_(name) {
  const s = ss_().getSheetByName(name);
  if (!s) throw new Error('Could not find a tab named "' + name + '".');
  return s;
}
function toCellValue_(v) {
  if (v === undefined || v === null) return '';
  if (typeof v !== 'string') return v;
  v = v.trim();
  const asNum = v.replace(/,/g, '');
  return asNum !== '' && !isNaN(asNum) ? Number(asNum) : v;
}
function withLock_(fn) {
  const lock = LockService.getDocumentLock();
  lock.waitLock(20000);
  try { return fn(); } finally { lock.releaseLock(); }
}

/* =====================================================================
   Daily check-in: reading the layout
   ===================================================================== */

/** "Notes (Cheat Meal, Digestion)" -> label "Notes", hint "Cheat Meal, Digestion".
    Short brackets like "(Lbs)" or "(1-10)" stay in the label. */
function splitLabel_(h) {
  const m = h.match(/^(.*?)\s*\(([^)]*)\)\s*$/);
  if (m && m[2].length > 8) return { label: m[1].trim(), hint: m[2].trim() };
  return { label: h, hint: '' };
}

/**
 * Finds the "Date" header row and every column to its right up to the
 * first blank header. Hidden columns are skipped. A header that is a link
 * (e.g. "Weekly Client Check In Form") becomes a button in the app instead
 * of a field. Returns {sheet, headerRow, fields, links, above}.
 * "above" is the text in the rows above the header (where targets are noted).
 */
function checkinLayout_() {
  const sheet = sheet_(CHECKIN_SHEET);
  const lastCol = sheet.getLastColumn();
  const top = sheet.getRange(1, 1, 10, lastCol).getDisplayValues();
  for (let r = 0; r < top.length; r++) {
    if (String(top[r][0]).trim().toLowerCase() !== 'date') continue;
    const fields = [], used = {}, links = [];
    let rich = [];
    try { rich = sheet.getRange(r + 1, 1, 1, lastCol).getRichTextValues()[0]; } catch (e) { /* no links */ }
    for (let c = 2; c <= lastCol; c++) {
      const h = String(top[r][c - 1]).replace(/\s+/g, ' ').trim();
      if (!h) break;
      if (sheet.isColumnHiddenByUser(c)) continue;
      const url = rich[c - 1] && rich[c - 1].getLinkUrl();
      if (url && /^https?:\/\//i.test(url)) { links.push({ label: h, url: url }); continue; }
      let role = '';
      for (let i = 0; i < ROLES.length; i++) if (ROLES[i][1].test(h) && !used[ROLES[i][0]]) { role = ROLES[i][0]; break; }
      // "(1-10)" columns are 1-10 scores. A "Recovery (1-10)" score is not a WHOOP recovery %.
      const scale = /\(\s*1\s*-\s*10\s*\)/.test(h) || role === 'energy' || role === 'stress';
      if (scale && WEARABLE[role]) role = '';
      if (role) used[role] = true;
      const sl = splitLabel_(h);
      fields.push({
        key: role || ('c' + c), col: c, role: role, label: sl.label, hint: sl.hint,
        wearable: !!WEARABLE[role], scale: scale,
        type: role === 'notes' ? 'long' : (NUMERIC[role] || scale) ? 'number' : 'text',
        options: [],
      });
    }
    const above = top.slice(0, r).map(function (row) { return row.join(' '); }).join(' ');
    return { sheet: sheet, headerRow: r + 1, fields: fields, links: links, above: above };
  }
  throw new Error('Could not find the "Date" header in "' + CHECKIN_SHEET + '".');
}

/** Every dated row below the header: [{row, key, values: {fieldKey: value}}]. */
function readEntries_(layout) {
  const sheet = layout.sheet;
  const first = layout.headerRow + 1;
  const n = sheet.getLastRow() - layout.headerRow;
  if (n < 1) return [];
  const data = sheet.getRange(first, 1, n, sheet.getLastColumn()).getValues();
  const out = [];
  data.forEach(function (rowVals, i) {
    const d = rowVals[0];
    if (!(d instanceof Date)) return; // skips the weekly-average rows
    const values = {};
    layout.fields.forEach(function (f) {
      const v = rowVals[f.col - 1];
      values[f.key] = v instanceof Date ? dayKey_(v) : v;
    });
    out.push({ row: first + i, key: dayKey_(d), values: values });
  });
  return out;
}

/** Marks columns that have a dropdown in the sheet and lists its choices.
    Plain text columns get the client's past answers as tap-to-fill suggestions. */
function addDropdowns_(layout, entries) {
  layout.fields.forEach(function (f) {
    if (f.type === 'text') {
      const seen = [];
      entries.forEach(function (e) {
        const v = String(e.values[f.key] || '').trim();
        if (v && v.length <= 30 && seen.indexOf(v) < 0) seen.push(v);
      });
      if (seen.length && seen.length <= 8) f.suggestions = seen;
    }
    let options = null;
    try {
      const rule = layout.sheet.getRange(layout.headerRow + 1, f.col).getDataValidation();
      if (rule) {
        const type = rule.getCriteriaType();
        const args = rule.getCriteriaValues();
        if (type === SpreadsheetApp.DataValidationCriteria.VALUE_IN_LIST) {
          options = args[0];
        } else if (type === SpreadsheetApp.DataValidationCriteria.VALUE_IN_RANGE) {
          options = args[0].getDisplayValues().reduce(function (a, r) { return a.concat(r); }, []);
        }
      }
    } catch (e) { /* no dropdown */ }
    if (!options) return;
    delete f.suggestions;
    options = options.map(String).filter(function (v) { return v.trim() !== ''; });
    entries.forEach(function (e) {
      const v = String(e.values[f.key] || '').trim();
      if (v && options.indexOf(v) < 0) options.push(v);
    });
    f.type = 'select';
    f.options = options;
  });
  return layout.fields;
}

function targetSheet_() {
  for (let i = 0; i < TARGET_SHEETS.length; i++) {
    const s = ss_().getSheetByName(TARGET_SHEETS[i]);
    if (s) return s;
  }
  return null;
}

/* ---------- Weekly macro blocks ----------
   Each block on the Macros tab looks like:
     DAILY TARGETS: Nov 16 - 22, 2026
     Week 1 | 1,880 Calories
     Macro          | Macros | Calories      <- header row
     Carbohydrates  | 180g   | 720
     ...
     SUGGESTED DAILY MACRO DISTRIBUTION
     Meal           | Carbs (g) | Fat (g) | Protein (g)   <- header row
     Breakfast (~25%) | 45 | 15 | 40
     ...
     TOTAL          | 180 | 60 | 155
*/

const MONTHS = 'janfebmaraprmayjunjulaugsepoctnovdec';

/** "Nov 30 - Dec 6, 2026" -> {start: '2026-11-30', end: '2026-12-06'} */
function parseRange_(s) {
  // A single date ("11/2/2026") means "from this day on".
  const one = s.match(/^\s*(\d{1,2})\/(\d{1,2})\/(\d{2,4})\s*$/);
  if (one) {
    const y = one[3].length === 2 ? '20' + one[3] : one[3];
    return { start: y + '-' + ('0' + one[1]).slice(-2) + '-' + ('0' + one[2]).slice(-2), end: '' };
  }
  const m = s.match(/([A-Za-z]{3})[a-z]*\.?\s+(\d{1,2})\s*[^\w\s,]+\s*(?:([A-Za-z]{3})[a-z]*\.?\s+)?(\d{1,2}),?\s*(\d{4})/);
  if (!m) return null;
  const sm = MONTHS.indexOf(m[1].toLowerCase()) / 3, em = MONTHS.indexOf((m[3] || m[1]).toLowerCase()) / 3;
  if (sm < 0 || em < 0 || sm % 1 || em % 1) return null;
  const year = +m[5], sy = sm > em ? year - 1 : year;
  const pad = function (n) { return (n < 10 ? '0' : '') + n; };
  return { start: sy + '-' + pad(sm + 1) + '-' + pad(+m[2]), end: year + '-' + pad(em + 1) + '-' + pad(+m[4]) };
}

function headerCols_(row, labelCol) {
  const cols = [];
  for (let c = labelCol + 1; c < row.length; c++) if (String(row[c]).trim()) cols.push(c);
  return cols;
}

function readWeeks_() {
  const sheet = targetSheet_();
  if (!sheet || sheet.getLastRow() < 1) return [];
  const vals = sheet.getRange(1, 1, sheet.getLastRow(), Math.min(Math.max(sheet.getLastColumn(), 1), 12)).getDisplayValues();
  const weeks = [];
  let cur = null, mode = '', cols = [];
  vals.forEach(function (row) {
    let li = -1;
    for (let c = 0; c < row.length; c++) if (String(row[c]).trim()) { li = c; break; }
    if (li < 0) return;
    const label = String(row[li]).trim();
    if (/^daily\s+(?:nutrition\s+|macro\s+)?targets/i.test(label)) {
      const title = label.replace(/^daily\s+(?:nutrition\s+|macro\s+)?targets\s*:?\s*/i, '').replace(/^date\b\s*:?\s*/i, '');
      const r = parseRange_(title);
      cur = { title: title, start: r ? r.start : '', end: r ? r.end : '', week: '', calories: '',
        macroHeaders: [], macros: [], mealHeaders: [], meals: [], total: null };
      weeks.push(cur); mode = 'head'; return;
    }
    if (!cur) return;
    if (mode === 'head' && /calories/i.test(label)) { // "Week 1 | 1,880 Calories"
      const parts = label.split('|');
      cur.week = parts.length > 1 ? parts[0].trim() : '';
      const m = label.match(/([\d,]*\d)\s*cal/i);
      cur.calories = m ? m[1] : '';
      return;
    }
    if (/^macros?$/i.test(label)) { mode = 'macros'; cols = headerCols_(row, li); cur.macroHeaders = cols.map(function (c) { return String(row[c]).trim(); }); return; }
    if (/^suggested/i.test(label)) { mode = ''; return; }
    if (/^meals?$/i.test(label)) { mode = 'meals'; cols = headerCols_(row, li); cur.mealHeaders = cols.map(function (c) { return String(row[c]).trim(); }); return; }
    const line = { label: label, values: cols.map(function (c) { return String(row[c]).trim(); }) };
    if (mode === 'macros') cur.macros.push(line);
    else if (mode === 'meals') { if (/^total/i.test(label)) { cur.total = line; mode = ''; } else cur.meals.push(line); }
  });
  // Keep only real macro blocks: they need a Macro table or a meal table.
  // (Drops empty templates like "DAILY NUTRITION TARGETS: DATE", and dated
  // Calories/Carbs/Fat/Protein tables, which readTargetTables_ handles.)
  return weeks.filter(function (w) { return (w.start || w.calories) && (w.macros.length || w.meals.length); });
}

/** The week block covering this date, else the latest one that has started. */
function weekFor_(weeks, k) {
  const dated = weeks.filter(function (w) { return w.start; });
  return dated.filter(function (w) { return w.start <= k && k <= w.end; })[0]
    || dated.filter(function (w) { return w.start <= k; }).pop() || null;
}

function getMacros() {
  return { journalName: ss_().getName(), weeks: readWeeks_() };
}

/**
 * Macro targets for a date. In order of preference:
 *  1. a "Day Type" table on the Macros/Overview tab,
 *  2. the weekly block on the Macros/Overview tab covering that date,
 *  3. the note above the check-in headers, e.g.
 * "Calories 1,860, Carbs 200g, Fat 60g, Protein 130g" or
 * "High Day: Calories 2,050, Carbs 223g, Fat 62g, Protein 150g  Low Day: ...".
 */
function readTargets_(layout, dateKey, weeks) {
  const out = [];
  const sheet = targetSheet_();
  if (sheet && sheet.getLastRow() > 0) {
    const vals = sheet.getRange(1, 1, Math.min(sheet.getLastRow(), 30), 6).getDisplayValues();
    let inTable = false;
    vals.forEach(function (r) {
      const label = String(r[0]).trim();
      if (/^day type$/i.test(label)) { inTable = true; return; }
      if (!inTable || !label) return;
      if (/^weekly/i.test(label)) { inTable = false; return; }
      out.push({ label: label.replace(/\s+\d+x$/i, ''), calories: r[2], carbs: r[3], fat: r[4], protein: r[5] });
    });
  }
  if (out.length) return out;
  const w = weekFor_(weeks || [], dateKey);
  if (w) {
    // the grams column is the one headed "Grams" or "Macros" (else the first)
    let gi = w.macroHeaders.findIndex(function (h) { return /gram|macro/i.test(h); });
    if (gi < 0) gi = 0;
    const grams = function (re) {
      const row = w.macros.filter(function (m) { return re.test(m.label); })[0];
      const v = row ? String(row.values[gi] || '') : '';
      return /^\d+(\.\d+)?$/.test(v) ? v + 'g' : v;
    };
    return [{ label: w.week || (weeks.length === 1 ? 'Daily' : 'This week'), calories: w.calories, carbs: grams(/carb/i), fat: grams(/fat/i), protein: grams(/protein/i) }];
  }
  const tables = readTargetTables_(sheet);
  if (tables.length) {
    const dated = tables.filter(function (t) { return t.date && t.date <= dateKey; }).pop();
    return (dated || tables[0]).rows;
  }
  const re = /(?:([A-Za-z][A-Za-z ]{0,20}?)\s*:\s*)?Calories\s*:?\s*([\d,]*\d)\s*,?\s*Carbs\s*:?\s*(\d+)\s*g\s*,?\s*Fat\s*:?\s*(\d+)\s*g\s*,?\s*Protein\s*:?\s*(\d+)\s*g/gi;
  let m;
  while ((m = re.exec(layout.above)) !== null) {
    out.push({ label: (m[1] || 'Daily').trim(), calories: m[2], carbs: m[3] + 'g', fat: m[4] + 'g', protein: m[5] + 'g' });
  }
  if (out.length) return out;
  // Last try, any order: "Calories: 2,405 Protein: 175 Fat: 65 Carbs: 280"
  const one = function (re) { const x = layout.above.match(re); return x ? x[1] : ''; };
  const cal = one(/calories\s*:?\s*([\d,]*\d)/i), carb = one(/carb\w*\s*:?\s*(\d+)/i),
    fat = one(/fats?\s*:?\s*(\d+)/i), pro = one(/protein\s*:?\s*(\d+)/i);
  if (cal && carb && fat && pro) out.push({ label: 'Daily', calories: cal, carbs: carb + 'g', fat: fat + 'g', protein: pro + 'g' });
  return out;
}

/**
 * Target tables anywhere on the Macros/Overview tab: a header row with
 * Calories, Carbs, Fat and Protein cells, then one row per target until a
 * blank row. A date in the title above (e.g. "DAILY MACRO TARGETS 10/30/2026")
 * says when that table starts; the app uses the latest one that has started.
 */
function readTargetTables_(sheet) {
  if (!sheet || sheet.getLastRow() < 1) return [];
  const vals = sheet.getRange(1, 1, sheet.getLastRow(), Math.min(Math.max(sheet.getLastColumn(), 1), 12)).getDisplayValues();
  const tables = [];
  let lastDate = '';
  for (let r = 0; r < vals.length; r++) {
    const row = vals[r].map(function (v) { return String(v).trim(); });
    const text = row.join(' ');
    const d = text.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
    const find = function (re) { for (let c = 0; c < row.length; c++) if (re.test(row[c])) return c; return -1; };
    const cc = find(/^calories$/i), ca = find(/^carb/i), cf = find(/^fats?$/i), cp = find(/^protein$/i);
    if (cc < 0 || ca < 0 || cf < 0 || cp < 0) {
      if (d) {
        const y = d[3].length === 2 ? '20' + d[3] : d[3];
        lastDate = y + '-' + ('0' + d[1]).slice(-2) + '-' + ('0' + d[2]).slice(-2);
      }
      continue;
    }
    const rows = [];
    for (let k = r + 1; k < vals.length; k++) {
      const v = vals[k].map(function (x) { return String(x).trim(); });
      let label = '';
      for (let c = 0; c < Math.min(cc, ca, cf, cp); c++) if (v[c]) { label = v[c]; break; }
      if (!v[cc] && !v[ca] && !v[cf] && !v[cp]) break;
      rows.push({ label: (label || 'Daily').replace(/\s+\d+x$/i, ''), calories: v[cc], carbs: v[ca], fat: v[cf], protein: v[cp] });
      r = k;
    }
    if (rows.length) tables.push({ date: lastDate, rows: rows });
  }
  return tables;
}

/** Average weight per week (weeks start Monday), newest last. */
function weeklyAverages_(entries) {
  const weeks = {};
  entries.forEach(function (e) {
    const w = Number(e.values.weight);
    if (!w) return;
    const k = addDays_(e.key, -((weekday_(e.key) + 6) % 7)); // Monday of that week
    (weeks[k] = weeks[k] || []).push(w);
  });
  return Object.keys(weeks).sort().slice(-8).map(function (k) {
    const list = weeks[k];
    const avg = list.reduce(function (a, b) { return a + b; }, 0) / list.length;
    return { weekOf: k, avg: Math.round(avg * 10) / 10, days: list.length };
  });
}

/* =====================================================================
   Daily check-in: called from the app
   ===================================================================== */

function getJournal(dateKey) {
  const layout = checkinLayout_();
  const entries = readEntries_(layout);
  const match = entries.filter(function (e) { return e.key === dateKey; })[0];
  const weeks = readWeeks_();
  return {
    journalName: ss_().getName(),
    targets: readTargets_(layout, dateKey, weeks),
    hasMacros: weeks.length > 0,
    links: layout.links,
    fields: addDropdowns_(layout, entries),
    entry: match ? match.values : null,
    dateInSheet: !!match,
  };
}

function saveCheckIn(dateKey, values) {
  return withLock_(function () {
    const layout = checkinLayout_();
    const match = readEntries_(layout).filter(function (e) { return e.key === dateKey; })[0];
    if (!match) {
      throw new Error('This date isn\'t in your journal yet. Let Jess know so she can add more weeks.');
    }
    const sheet = layout.sheet;
    const formulas = sheet.getRange(match.row, 1, 1, sheet.getLastColumn()).getFormulas()[0];
    layout.fields.forEach(function (f) {
      if (!(f.key in values)) return;
      if (formulas[f.col - 1]) return; // never overwrite a formula
      sheet.getRange(match.row, f.col).setValue(toCellValue_(values[f.key]));
    });
    SpreadsheetApp.flush();
    return getJournal(dateKey);
  });
}

/* =====================================================================
   Overview: the last 10 days (ending on the client's today), oldest first.
   ===================================================================== */

function getOverview(todayKey) {
  const layout = checkinLayout_();
  const entries = readEntries_(layout);
  const byKey = {};
  entries.forEach(function (e) { byKey[e.key] = e.values; });
  const days = [];
  for (let i = 9; i >= 0; i--) {
    const k = addDays_(todayKey, -i);
    days.push({ date: k, values: byKey[k] || null });
  }
  return {
    journalName: ss_().getName(),
    fields: addDropdowns_(layout, entries),
    links: layout.links,
    days: days,
    weekly: weeklyAverages_(entries),
  };
}

/* =====================================================================
   Progress photos
   Layout: repeating blocks. Each block = a header row (Front | Back | Side,
   in columns C, E, G) followed by ~10 rows where the photos sit, with the
   date/label in column B on the first of those rows.
   ===================================================================== */

const ANGLES = { front: 3, back: 5, side: 7 }; // column where each photo goes

function photoBlocks_(sheet) {
  const lastRow = sheet.getLastRow();
  const vals = sheet.getRange(1, 1, lastRow, 8).getValues();
  const headers = [];
  for (let r = 1; r <= lastRow; r++) if (/^front$/i.test(String(vals[r - 1][2]).trim())) headers.push(r);
  if (!headers.length) throw new Error('Could not find the "Front / Back / Side" headers in "' + PHOTO_SHEET + '".');
  const images = sheet.getImages();
  return headers.map(function (h, i) {
    const end = i + 1 < headers.length ? headers[i + 1] - 1 : Math.max(lastRow, h + 10);
    const label = h < vals.length ? vals[h][1] : ''; // column B, row after the header
    const inBlock = images.filter(function (img) {
      const a = img.getAnchorCell().getRow();
      return a > h && a <= end;
    });
    // photos placed *inside* cells (Insert -> Image -> In cell) aren't in getImages()
    const inCells = vals.slice(h, end).some(function (row) {
      return row.slice(2, 8).some(function (v) { return v !== '' && v !== null; });
    });
    return {
      header: h, first: h + 1, last: end,
      labelKey: label instanceof Date ? dayKey_(label) : String(label || '').trim(),
      images: inBlock,
      used: inBlock.length > 0 || inCells,
    };
  });
}

function photoFolder_() {
  const name = 'Progress Photos \u2014 ' + ss_().getName();
  const parents = DriveApp.getFileById(ss_().getId()).getParents();
  const parent = parents.hasNext() ? parents.next() : DriveApp.getRootFolder();
  const found = parent.getFoldersByName(name);
  return found.hasNext() ? found.next() : parent.createFolder(name);
}

function getPhotos() {
  const sheet = sheet_(PHOTO_SHEET);
  const blocks = photoBlocks_(sheet).filter(function (b) { return b.used; });
  return {
    recent: blocks.slice(-5).reverse().map(function (b) { return { label: b.labelKey }; }),
  };
}

/**
 * photos: {front|back|side: {sheet: base64 jpeg (small, for the sheet),
 *                            full: base64 jpeg (bigger, for Drive)}}
 */
function savePhotos(dateKey, photos) {
  return withLock_(function () {
    const sheet = sheet_(PHOTO_SHEET);
    let blocks = photoBlocks_(sheet);

    // Same date again -> reuse that block. Otherwise the first block with no photos.
    let block = blocks.filter(function (b) { return b.labelKey === dateKey; })[0]
      || blocks.filter(function (b) { return !b.used; })[0];

    if (!block) { // all blocks used: copy the last block below it
      const lastB = blocks[blocks.length - 1];
      const height = lastB.last - lastB.header + 1;
      const start = lastB.last + 1;
      if (sheet.getMaxRows() < start + height) sheet.insertRowsAfter(sheet.getMaxRows(), start + height - sheet.getMaxRows());
      sheet.getRange(lastB.header, 1, height, 8).copyTo(sheet.getRange(start, 1, height, 8));
      for (let i = 0; i < height; i++) sheet.setRowHeight(start + i, sheet.getRowHeight(lastB.header + i));
      sheet.getRange(start + 1, 2).clearContent();
      blocks = photoBlocks_(sheet);
      block = blocks.filter(function (b) { return b.header === start; })[0];
    }

    sheet.getRange(block.first, 2).setValue(keyToDate_(dateKey)).setNumberFormat('m/d/yy');

    // Box each photo fits into: 2 columns wide, the block's photo rows tall.
    let boxH = 0;
    for (let r = block.first; r <= block.last; r++) boxH += sheet.getRowHeight(r);
    const folder = photoFolder_();
    const saved = [];

    Object.keys(ANGLES).forEach(function (angle) {
      const p = photos[angle];
      if (!p) return;
      const col = ANGLES[angle];
      // replace an older photo of the same angle in this block
      block.images.forEach(function (img) { if (img.getAnchorCell().getColumn() === col) img.remove(); });

      const name = dateKey + ' ' + angle.charAt(0).toUpperCase() + angle.slice(1) + '.jpg';
      folder.createFile(Utilities.newBlob(Utilities.base64Decode(p.full), 'image/jpeg', name));

      const img = sheet.insertImage(Utilities.newBlob(Utilities.base64Decode(p.sheet), 'image/jpeg', name), col, block.first);
      const boxW = sheet.getColumnWidth(col) + sheet.getColumnWidth(col + 1);
      const scale = Math.min(boxW / img.getWidth(), boxH / img.getHeight(), 1);
      const w = Math.round(img.getWidth() * scale), h = Math.round(img.getHeight() * scale);
      img.setWidth(w).setHeight(h).setAnchorCellXOffset(Math.max(0, Math.round((boxW - w) / 2)));
      saved.push(angle);
    });
    SpreadsheetApp.flush();
    return { saved: saved, recent: getPhotos().recent };
  });
}
