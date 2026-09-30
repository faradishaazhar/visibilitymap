/**
 * @OnlyCurrentDoc
 * (The line above limits this script to the one spreadsheet it is attached to.)
 */

/**
 * ============================================================================
 *  VISIBILITY MAP — Google Apps Script backend
 * ============================================================================
 *
 *  What this does
 *  --------------
 *  Your website sends each submitted assessment here as JSON. This script
 *  checks it, then writes it into three tabs of THIS Google Sheet:
 *
 *    Responses          one row per assessment (raw answers)
 *    Results            one row per assessment (scores and strategy)
 *    Visibility Matrix  one row per identity area per assessment
 *
 *  If someone submits again with the same assessment ID (for example after
 *  changing answers), their old rows are replaced, so each assessment appears
 *  only once.
 *
 *  Privacy and security
 *  --------------------
 *  - The script runs as YOU, so it can write to your sheet. Visitors never get
 *    access to the sheet itself; they can only send data to this endpoint.
 *  - There are no passwords or keys in here and none are needed.
 *  - Text that starts with = + - or @ is stored as plain text, so nobody can
 *    inject spreadsheet formulas through a free-text answer.
 *
 *  You do not need to edit anything in this file.
 *  Follow the setup guide: paste this in, run "setup" once, then deploy.
 * ============================================================================
 */

// Column layout for each tab. You can reorder or delete columns in the sheet
// itself: the script matches data to columns by the header name in row 1.
const SHEETS = {
  responses: {
    name: 'Responses',
    headers: [
      'assessment_id', 'timestamp', 'selected_contexts', 'name', 'email',
      'raw_answers', 'privacy_preferences', 'documentation_preferences',
      'identity_categories', 'custom_categories', 'future_identity',
      'identity_today', 'current_role', 'target_role', 'notes',
      'submission_number', 'received_at'
    ]
  },
  results: {
    name: 'Results',
    headers: [
      'assessment_id', 'timestamp', 'privacy_score', 'strategic_visibility_score',
      'professional_visibility_score', 'social_visibility_score', 'documentation_score',
      'audience_control_score', 'future_building_score', 'primary_strategy',
      'secondary_strategy', 'brand_pillars', 'recommendations',
      'show', 'selectively_share', 'document_privately', 'keep_private'
    ]
  },
  matrix: {
    name: 'Visibility Matrix',
    headers: [
      'assessment_id', 'category', 'irl_visibility', 'social_visibility',
      'career_visibility', 'portfolio_visibility', 'friends_visibility',
      'private_status', 'recommendation', 'reveal_later',
      'visible_now', 'visible_goal', 'change', 'timestamp'
    ]
  }
};

const ID_PATTERN = /^PB-\d{8}-[A-Z0-9]{6}$/;
const MAX_BODY_CHARS = 300000;   // a real submission is ~10–40k characters
const MAX_CELL_CHARS = 45000;    // Google Sheets allows 50,000 per cell


/* ----------------------------------------------------------------------------
 *  ENTRY POINTS
 * ------------------------------------------------------------------------- */

/** Receives a submission from the website. */
function doPost(e) {
  try {
    if (!e || !e.postData || typeof e.postData.contents !== 'string') {
      return reply_({ ok: false, error: 'empty_request' });
    }
    const body = e.postData.contents;
    if (body.length > MAX_BODY_CHARS) return reply_({ ok: false, error: 'too_large' });

    let payload;
    try {
      payload = JSON.parse(body);
    } catch (err) {
      return reply_({ ok: false, error: 'invalid_json' });
    }

    const problem = validate_(payload);
    if (problem) return reply_({ ok: false, error: problem });

    // Spam trap: the website has a hidden field that people never fill in.
    // If it has a value, a bot sent this. Say "ok" but store nothing.
    if (payload.website) return reply_({ ok: true, assessment_id: payload.assessment_id });

    const lock = LockService.getScriptLock();
    lock.waitLock(20000); // wait up to 20 s if another submission is being written
    try {
      save_(payload);
    } finally {
      lock.releaseLock();
    }
    return reply_({ ok: true, assessment_id: payload.assessment_id });
  } catch (err) {
    console.error(err);
    return reply_({ ok: false, error: 'server_error' });
  }
}

/** Lets you check the endpoint in a browser. Shows a short status message. */
function doGet() {
  return reply_({
    ok: true,
    service: 'Visibility Map endpoint',
    message: 'The endpoint is running. The website sends submissions here automatically.'
  });
}


/* ----------------------------------------------------------------------------
 *  RUN THESE BY HAND FROM THE APPS SCRIPT EDITOR
 * ------------------------------------------------------------------------- */

/** Run once: creates the three tabs with their header rows. */
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(SHEETS).forEach(function (key) { getSheet_(ss, SHEETS[key]); });
  console.log('Setup complete. Tabs ready: ' + Object.keys(SHEETS).map(function (k) { return SHEETS[k].name; }).join(', '));
}

/** Optional: writes one fake assessment so you can see the layout. Delete its rows afterwards. */
function testSubmission() {
  const sample = {
    schema_version: 1,
    app: 'Visibility Map',
    assessment_id: 'PB-20260101-TEST01',
    timestamp: new Date().toISOString(),
    submission_number: 1,
    respondent: { name: 'Test submission', email: null },
    raw: {
      contexts: [{ id: 'career', label: 'Career' }],
      identity_categories: [{ id: 'career', label: 'Career', custom: false }],
      custom_categories: [],
      privacy_boundaries: { never_share_publicly: ['Home'], other: '' },
      documentation_preferences: [{ item: 'Career progress', choice: 'Document privately' }],
      future_self: { identity_in_1_to_3_years: 'Test identity' }
    },
    calculated: {
      scores: { privacy_preference: 50, strategic_visibility: 50, professional_visibility: 50, social_visibility: 50, documentation_need: 50, audience_control: 50, future_building: 50 },
      primary_strategy: 'controlled visibility',
      secondary_strategy: null,
      brand_pillars: [{ name: 'Test pillar' }],
      visibility_matrix: [{ category: 'Career', irl: 'Public', social: 'Strategic', career: 'Public', portfolio: 'Public', friends: 'Public', private: 'Document', recommendation: 'Show', reveal_later: false }],
      recommendations: { show: [{ category: 'Career' }], selectively_share: [], document_privately: [], keep_private: [] }
    }
  };
  const result = doPost({ postData: { contents: JSON.stringify(sample) } });
  console.log(result.getContent());
}


/* ----------------------------------------------------------------------------
 *  INTERNALS
 * ------------------------------------------------------------------------- */

function validate_(p) {
  if (!p || typeof p !== 'object') return 'not_an_object';
  if (p.schema_version !== 1) return 'unsupported_schema';
  if (typeof p.assessment_id !== 'string' || !ID_PATTERN.test(p.assessment_id)) return 'invalid_assessment_id';
  if (!p.raw || typeof p.raw !== 'object') return 'missing_raw';
  if (!p.calculated || typeof p.calculated !== 'object') return 'missing_calculated';
  return null;
}

function save_(p) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const raw = p.raw || {};
  const calc = p.calculated || {};
  const scores = calc.scores || {};
  const recs = calc.recommendations || {};
  const respondent = p.respondent || {};
  const when = toDate_(p.timestamp);

  const responseRow = {
    assessment_id: p.assessment_id,
    timestamp: when,
    selected_contexts: labels_(raw.contexts),
    name: respondent.name || '',
    email: respondent.email || '',
    raw_answers: JSON.stringify(raw),
    privacy_preferences: privacyText_(raw, recs),
    documentation_preferences: (raw.documentation_preferences || []).map(function (d) { return d.item + ': ' + d.choice; }).join('\n'),
    identity_categories: labels_(raw.identity_categories),
    custom_categories: labels_(raw.custom_categories),
    future_identity: (raw.future_self && raw.future_self.identity_in_1_to_3_years) || '',
    identity_today: (raw.now_vs_goal && raw.now_vs_goal.identity_today) || '',
    current_role: (raw.now_vs_goal && raw.now_vs_goal.career_current_role) || '',
    target_role: (raw.now_vs_goal && raw.now_vs_goal.career_target_role) || '',
    notes: Object.keys(raw.notes || {}).map(function (k) { return k + ': ' + raw.notes[k]; }).join('\n\n'),
    submission_number: p.submission_number || 1,
    received_at: new Date()
  };

  const resultRow = {
    assessment_id: p.assessment_id,
    timestamp: when,
    privacy_score: num_(scores.privacy_preference),
    strategic_visibility_score: num_(scores.strategic_visibility),
    professional_visibility_score: num_(scores.professional_visibility),
    social_visibility_score: num_(scores.social_visibility),
    documentation_score: num_(scores.documentation_need),
    audience_control_score: num_(scores.audience_control),
    future_building_score: num_(scores.future_building),
    primary_strategy: calc.primary_strategy || '',
    secondary_strategy: calc.secondary_strategy || '',
    brand_pillars: (calc.brand_pillars || []).map(function (b) { return b.name; }).join(' | '),
    recommendations: [
      'Show: ' + recLabels_(recs.show),
      'Selectively share: ' + recLabels_(recs.selectively_share),
      'Document privately: ' + recLabels_(recs.document_privately),
      'Keep private: ' + recLabels_(recs.keep_private)
    ].join('\n'),
    show: recLabels_(recs.show),
    selectively_share: recLabels_(recs.selectively_share),
    document_privately: recLabels_(recs.document_privately),
    keep_private: recLabels_(recs.keep_private)
  };

  const matrixRows = (calc.visibility_matrix || []).map(function (m) {
    return {
      assessment_id: p.assessment_id,
      category: m.category,
      irl_visibility: m.irl,
      social_visibility: m.social,
      career_visibility: m.career,
      portfolio_visibility: m.portfolio,
      friends_visibility: m.friends,
      private_status: m.private,
      recommendation: m.recommendation || '',
      reveal_later: m.reveal_later ? 'yes' : 'no',
      visible_now: m.visible_now || '',
      visible_goal: m.visible_goal || '',
      change: m.change || '',
      timestamp: when
    };
  });

  upsert_(getSheet_(ss, SHEETS.responses), p.assessment_id, [responseRow]);
  upsert_(getSheet_(ss, SHEETS.results), p.assessment_id, [resultRow]);
  upsert_(getSheet_(ss, SHEETS.matrix), p.assessment_id, matrixRows);
}

/** Finds a tab by name, creating it (with bold, frozen headers) if needed. */
function getSheet_(ss, def) {
  let sheet = ss.getSheetByName(def.name);
  if (!sheet) sheet = ss.insertSheet(def.name);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, def.headers.length).setValues([def.headers]).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

/** Removes any earlier rows for this assessment ID, then adds the new rows. */
function upsert_(sheet, id, rowObjects) {
  const lastCol = sheet.getLastColumn();
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) { return String(h).trim(); });
  const idCol = headers.indexOf('assessment_id');

  if (idCol > -1 && sheet.getLastRow() > 1) {
    const ids = sheet.getRange(2, idCol + 1, sheet.getLastRow() - 1, 1).getValues();
    for (let i = ids.length - 1; i >= 0; i--) {
      if (String(ids[i][0]) === id) sheet.deleteRow(i + 2);
    }
  }
  if (!rowObjects.length) return;

  const values = rowObjects.map(function (obj) {
    return headers.map(function (h) { return h in obj ? safe_(obj[h]) : ''; });
  });
  sheet.getRange(sheet.getLastRow() + 1, 1, values.length, headers.length).setValues(values);
}

/** Makes a value safe to put in a cell. */
function safe_(v) {
  if (v === null || v === undefined) return '';
  if (v instanceof Date || typeof v === 'number' || typeof v === 'boolean') return v;
  let s = typeof v === 'string' ? v : JSON.stringify(v);
  if (s.length > MAX_CELL_CHARS) s = s.slice(0, MAX_CELL_CHARS) + ' …[truncated]';
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // stop formula injection
  return s;
}

function privacyText_(raw, recs) {
  const b = raw.privacy_boundaries || {};
  const lines = [];
  if (b.never_share_publicly && b.never_share_publicly.length) lines.push('Never share publicly: ' + b.never_share_publicly.join(', '));
  if (b.other) lines.push('Other boundaries: ' + b.other);
  if (recs.keep_private && recs.keep_private.length) lines.push('Areas to keep private: ' + recLabels_(recs.keep_private));
  const irl = raw.public_irl || {};
  if (irl.mystery !== undefined && irl.mystery !== null) lines.push('Preferred privacy in real life (1–5): ' + irl.mystery);
  return lines.join('\n');
}

function labels_(arr) { return (arr || []).map(function (x) { return x && x.label ? x.label : String(x); }).join(', '); }
function recLabels_(arr) { return (arr || []).map(function (r) { return r.category; }).join(', '); }
function num_(v) { return typeof v === 'number' ? v : ''; }
function toDate_(iso) { const d = new Date(iso); return isNaN(d.getTime()) ? new Date() : d; }

function reply_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
