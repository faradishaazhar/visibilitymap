/* ==========================================================================
   Visibility Map — application script
   Plain JavaScript, no build step, no network requests.
   All answers live in this browser's localStorage under one key.
   ========================================================================== */
// ==========================================================================
// GOOGLE SHEETS CONFIGURATION
// ==========================================================================
// This is the ONLY setting you need to change to connect Google Sheets.
//
// WHAT TO REPLACE:
//   After you deploy your Google Apps Script as a Web App, Google shows you a
//   "Web app URL". It looks like this:
//
//     https://script.google.com/macros/s/AKfycbx...a-long-code.../exec
//
//   Copy that whole URL and paste it between the quotation marks below,
//   replacing the words YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL.
//   - Keep the quotation marks.
//   - The URL must end in /exec (not /dev).
//
// WHILE THE PLACEHOLDER IS STILL HERE:
//   The website works exactly as before. Results are generated on the page,
//   answers are saved in the visitor's browser, and nothing is sent anywhere.
//
// IS IT SAFE TO PUBLISH THIS URL?
//   Yes. It is a public entry point (like a letterbox), not a password.
//   Your Google Sheet stays private. Never put passwords, API keys or your
//   spreadsheet's ID in this file.
// ==========================================================================

const GOOGLE_SCRIPT_URL = "YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL";

// How long to wait for Google before giving up, in milliseconds (15000 = 15 seconds).
// You do not need to change this.
const SUBMIT_TIMEOUT_MS = 15000;

// ==========================================================================
// END OF CONFIGURATION — you do not need to edit anything below this line.
// ==========================================================================

(function () {
  'use strict';

  var APP_VERSION = '1.1.0';
  var PRIVACY_NOTICE = 'Your assessment results are generated on this website. If you choose to submit your assessment, your responses may be stored privately for analysis and research.';

  var STORE_KEY = 'visibility-map:v1';
  var FRAMED = (function () { try { return window.self !== window.top; } catch (e) { return true; } })();

  /* ------------------------------------------------------------------------
     1. CONTENT
     ------------------------------------------------------------------------ */

  var CONTEXTS = [
    { id: 'irl', label: 'Public / IRL', desc: 'How you present yourself in everyday real-life environments.' },
    { id: 'social', label: 'Social media', desc: 'What strangers, followers, acquaintances and online audiences get to know.' },
    { id: 'career', label: 'Career', desc: 'What recruiters, employers, clients, collaborators and professional contacts should know.' },
    { id: 'portfolio', label: 'Portfolio', desc: 'What evidence of your capabilities and work is publicly visible.' },
    { id: 'networking', label: 'Networking', desc: 'What new professional or social connections should understand about you.' },
    { id: 'friends', label: 'Friends / social circle', desc: 'What you are comfortable sharing with people you actually know.' },
    { id: 'private', label: 'Private', desc: 'What stays personal regardless of public branding.' },
    { id: 'future', label: 'Future persona', desc: 'What you may reveal later, once you reach a different stage of life or career.' }
  ];

  // tags: pro = professionally relevant, prove = can be evidenced in a portfolio,
  // create, mind, taste, values, personal, future, venture
  var CATEGORIES = [
    { id: 'career', label: 'Career', tags: 'pro prove' },
    { id: 'education', label: 'Education', tags: 'pro prove mind' },
    { id: 'skills', label: 'Skills', tags: 'pro prove' },
    { id: 'creative', label: 'Creative work', tags: 'prove create' },
    { id: 'hobbies', label: 'Hobbies', tags: 'taste' },
    { id: 'fashion', label: 'Fashion / Style', tags: 'taste create' },
    { id: 'music', label: 'Music', tags: 'taste' },
    { id: 'film', label: 'Film / Pop culture', tags: 'taste' },
    { id: 'fitness', label: 'Fitness / Wellness', tags: 'taste' },
    { id: 'travel', label: 'Travel', tags: 'taste' },
    { id: 'food', label: 'Food', tags: 'taste' },
    { id: 'friendships', label: 'Friendships', tags: 'personal' },
    { id: 'family', label: 'Family', tags: 'personal' },
    { id: 'relationships', label: 'Relationships', tags: 'personal' },
    { id: 'growth', label: 'Personal growth', tags: 'mind' },
    { id: 'financial', label: 'Financial progress', tags: 'personal' },
    { id: 'lifestyle', label: 'Lifestyle', tags: 'taste' },
    { id: 'ambitions', label: 'Ambitions', tags: 'future' },
    { id: 'failures', label: 'Failures', tags: 'personal' },
    { id: 'challenges', label: 'Challenges', tags: 'personal' },
    { id: 'opinions', label: 'Opinions', tags: 'values' },
    { id: 'values', label: 'Values', tags: 'values' },
    { id: 'beliefs', label: 'Beliefs', tags: 'values' },
    { id: 'achievements', label: 'Achievements', tags: 'pro prove' },
    { id: 'projects', label: 'Projects', tags: 'pro prove' },
    { id: 'sidehustles', label: 'Side hustles', tags: 'pro prove venture' },
    { id: 'entrepreneurship', label: 'Entrepreneurship', tags: 'pro prove venture' },
    { id: 'content', label: 'Content creation', tags: 'prove create' },
    { id: 'artistic', label: 'Artistic identity', tags: 'create' },
    { id: 'intellectual', label: 'Intellectual interests', tags: 'mind' },
    { id: 'history', label: 'Personal history', tags: 'personal' },
    { id: 'futuregoals', label: 'Future goals', tags: 'future' }
  ];

  var ACCESS = [
    ['everyone', 'Everyone'], ['followers', 'Followers'], ['professional', 'Professional contacts'],
    ['recruiters', 'Recruiters'], ['clients', 'Clients'], ['friends', 'Friends'],
    ['closefriends', 'Close friends'], ['family', 'Family'], ['specific', 'Specific people'], ['nobody', 'Nobody']
  ];

  var MATRIX_QS = [
    { key: 'comfort', q: 'How comfortable are you with other people knowing about this?', labels: ['Keep private', 'Mostly private', 'Selectively share', 'Comfortable sharing', 'Very public'] },
    { key: 'useful', q: 'How strategically useful is this to your goals?', labels: ['Not useful', 'Slightly useful', 'Moderately useful', 'Very useful', 'Extremely useful'] },
    { key: 'control', q: 'How much control do you have over how this is perceived?', labels: ['Very little', 'Limited', 'Moderate', 'High', 'Very high'] },
    { key: 'future', q: 'Would you still be comfortable with this being visible two years from now?', labels: ['Definitely no', 'Probably no', 'Unsure', 'Probably yes', 'Definitely yes'], noNs: true },
    { key: 'value', q: 'How much is this worth keeping a record of, just for yourself?', labels: ['Not at all', 'A little', 'Somewhat', 'Quite a lot', 'A great deal'] }
  ];

  var IRL_QS = [
    { key: 'ambitions', q: 'How much do you want people you meet casually to know about your ambitions?', labels: ['Nothing', 'A hint', 'The broad direction', 'Most of it', 'All of it'] },
    { key: 'career', q: 'How much do you want to talk about your career when you meet people?', labels: ['Avoid it', 'Only if asked', 'The short version', 'Comfortably', 'In depth'] },
    { key: 'finance', q: 'How much of your financial or lifestyle situation do you want people to see?', labels: ['Nothing', 'Very little', 'The general picture', 'A fair amount', 'All of it'] },
    { key: 'gradual', q: 'How do you want people to learn about your achievements?', labels: ['Tell them upfront', 'Mention them early', 'Depends on the room', 'Mostly over time', 'Let them find out'] },
    { key: 'association', q: 'How closely should people connect who you are now with where you are heading?', labels: ['Keep them separate', 'Loosely', 'Somewhat', 'Closely', 'Completely'] },
    { key: 'mystery', q: 'How much privacy do you want to keep when you meet people?', labels: ['Open book', 'Mostly open', 'Balanced', 'Reserved', 'Very private'] }
  ];
  var IRL_INTRO = [
    ['short', 'Give the short version'], ['detail', 'Explain my role in detail'],
    ['building', 'Talk about what I am building toward'], ['redirect', 'Turn the question back to them']
  ];

  var SOCIAL_GROUPS = [
    { title: 'Identity signals', items: [['face', 'Face'], ['name', 'Full name'], ['location', 'Location'], ['workplace', 'Workplace'], ['education', 'Education']] },
    { title: 'Everyday life', items: [['lifestyle', 'Lifestyle'], ['hobbies', 'Hobbies'], ['routine', 'Daily routine'], ['relationships', 'Relationships'], ['friendships', 'Friendships']] },
    { title: 'Work and progress', items: [['achievements', 'Achievements'], ['careerprog', 'Career progress'], ['creativeproj', 'Creative projects'], ['financial', 'Financial progress'], ['futureplans', 'Future plans'], ['successes', 'Successes'], ['bts', 'Behind-the-scenes']] },
    { title: 'Inner life', items: [['opinions', 'Opinions on your field'], ['personalopinions', 'Personal opinions'], ['struggles', 'Personal struggles'], ['vulnerability', 'Vulnerability'], ['failures', 'Failures']] }
  ];
  var SOCIAL_LEVELS = [
    ['private', 'Private', 'private'], ['close', 'Close friends', 'private'], ['selective', 'Selective', 'selective'],
    ['followers', 'Followers', 'public'], ['public', 'Public', 'public'], ['strategic', 'Strategic / controlled', 'strategic']
  ];
  var SOCIAL_REASONS = [
    ['expression', 'Self-expression'], ['networking', 'Networking'], ['career', 'Career opportunities'], ['audience', 'Audience building'],
    ['documentation', 'Personal documentation'], ['community', 'Community'], ['credibility', 'Credibility'], ['monetization', 'Monetization'],
    ['creative', 'Creative identity'], ['validation', 'Validation'], ['habit', 'Habit'], ['other', 'Other']
  ];
  // Social item -> identity category (so explicit social choices shape the map)
  var SOCIAL_TO_CAT = {
    education: 'education', lifestyle: 'lifestyle', hobbies: 'hobbies', relationships: 'relationships',
    friendships: 'friendships', achievements: 'achievements', careerprog: 'career', creativeproj: 'creative',
    financial: 'financial', futureplans: 'futuregoals', opinions: 'opinions', failures: 'failures', struggles: 'challenges'
  };

  var ATTRIBUTES = [
    ['strategic', 'Strategic'], ['creative', 'Creative'], ['analytical', 'Analytical'], ['reliable', 'Reliable'], ['ambitious', 'Ambitious'],
    ['innovative', 'Innovative'], ['experienced', 'Experienced'], ['adaptable', 'Adaptable'], ['leadership', 'Leadership-oriented'],
    ['entrepreneurial', 'Entrepreneurial'], ['specialist', 'Specialist'], ['generalist', 'Generalist'], ['expert', 'Industry expert'],
    ['problem', 'Problem solver'], ['communicator', 'Communicator'], ['organizer', 'Organizer'], ['builder', 'Builder'], ['creator', 'Creator']
  ];
  var EVIDENCE = [
    ['experience', 'Work experience'], ['campaigns', 'Campaign results'], ['projects', 'Projects'], ['certifications', 'Certifications'],
    ['education', 'Education'], ['portfolio', 'Portfolio'], ['testimonials', 'Testimonials'], ['awards', 'Awards'], ['metrics', 'Metrics'],
    ['content', 'Content'], ['cases', 'Case studies'], ['personal', 'Personal projects']
  ];
  var NETWORK_LEAD = [
    ['role', 'Current role'], ['building', 'What I am building'], ['expertise', 'My expertise'],
    ['interests', 'Interests outside work'], ['values', 'Values'], ['direction', 'Where I am headed']
  ];

  var PORTFOLIO_AREAS = [
    ['campaigns', 'Campaigns'], ['projects', 'Projects'], ['results', 'Results'], ['leadership', 'Leadership'], ['strategy', 'Strategy'],
    ['creative', 'Creative work'], ['operations', 'Operations'], ['client', 'Client work'], ['creatormgmt', 'Creator management'],
    ['content', 'Content'], ['analytics', 'Analytics'], ['problem', 'Problem solving']
  ];
  var PORTFOLIO_QS = [
    ['evidence', 'Do you have evidence?'], ['organized', 'Is it organized?'], ['shareable', 'Is it publicly shareable?'],
    ['confidential', 'Is it confidential?'], ['measurable', 'Does it show a measurable result?'], ['wantMore', 'Is this work you want more of?']
  ];
  var TRI = [['yes', 'Yes'], ['partly', 'Partly'], ['no', 'No']];

  var DOC_ITEMS = [
    ['careerprog', 'Career progress'], ['money', 'Money progress'], ['fitness', 'Fitness progress'], ['creativedev', 'Creative development'],
    ['skilldev', 'Skill development'], ['milestones', 'Personal milestones'], ['failed', 'Failed attempts'], ['lessons', 'Lessons learned'],
    ['projects', 'Projects'], ['ideas', 'Ideas'], ['beforeafter', 'Before / after transformations'], ['photos', 'Photos'],
    ['videos', 'Videos'], ['journaling', 'Journaling']
  ];
  var DOC_CHOICES = [
    ['private', 'Document privately', 'document'], ['selective', 'Share selectively', 'selective'],
    ['public', 'Publish publicly', 'public'], ['later', 'Decide later', 'na']
  ];

  var BOUNDARIES = [
    ['location', 'Exact location'], ['home', 'Home'], ['workplace', 'Workplace details'], ['financial', 'Financial details'],
    ['family', 'Family information'], ['relationships', 'Relationships'], ['conversations', 'Private conversations'],
    ['conflicts', 'Personal conflicts'], ['mental', 'Mental or emotional struggles'], ['routine', 'Daily routine'],
    ['futureplans', 'Future plans'], ['security', 'Password / security information'], ['legal', 'Legal information'],
    ['documents', 'Personal documents'], ['photos', 'Private photos']
  ];
  var BOUNDARY_TO_CATS = {
    financial: ['financial'], family: ['family'], relationships: ['relationships'], mental: ['challenges'],
    conflicts: ['challenges'], futureplans: ['futuregoals'], routine: ['lifestyle']
  };
  var BOUNDARY_TO_SOCIAL = {
    location: ['location'], workplace: ['workplace'], financial: ['financial'], relationships: ['relationships'],
    mental: ['struggles', 'vulnerability'], routine: ['routine'], futureplans: ['futureplans']
  };

  var FUTURE_ROLES = [
    ['supports', 'Supports it', 'strategic'], ['later', 'Reveal later', 'selective'],
    ['irrelevant', 'Irrelevant', 'na'], ['private', 'Keep private', 'private']
  ];

  var LEVELS = {
    public: { label: 'Public', tag: 'public' },
    strategic: { label: 'Strategic', tag: 'strategic' },
    selective: { label: 'Selective', tag: 'selective' },
    private: { label: 'Private', tag: 'private' },
    document: { label: 'Document only', short: 'Document', tag: 'document' },
    na: { label: 'Not needed', tag: 'na' }
  };

  var DASH_STATUS = [
    ['document', 'To document', 'Still collecting the evidence.', 'document'],
    ['review', 'To review', 'Not categorized yet.', 'selective'],
    ['publish', 'Ready to publish', 'Visibility decided. Safe to show.', 'public'],
    ['private', 'Private archive', 'Kept for you on purpose.', 'private']
  ];

  var PROOF_FOR = {
    experience: 'A one-page role summary: scope, team size, what changed because you were there.',
    campaigns: 'Before/after numbers for two or three campaigns, with your specific role named.',
    projects: 'Short project write-ups: problem, what you did, result.',
    certifications: 'Certificates or course completions, saved as PDFs with dates.',
    education: 'Transcripts, thesis or capstone summaries, relevant coursework.',
    portfolio: 'A curated set of 5–8 pieces, each with a one-line context note.',
    testimonials: 'Written feedback from managers, clients or collaborators (ask while it is fresh).',
    awards: 'Award notices or screenshots with dates and issuing body.',
    metrics: 'A running log of numbers you moved, with dates and baselines.',
    content: 'Links or exports of your best content, with reach or response data.',
    cases: 'One full case study: context, constraint, decision, outcome.',
    personal: 'Personal project pages with screenshots and what you learned.',
    campaigns_area: 'Campaign briefs, timelines and outcome reports (anonymise client data).',
    projects_area: 'Project summaries with your contribution clearly separated from the team’s.',
    results_area: 'Metrics with baselines: what it was, what it became, over what period.',
    leadership_area: 'Examples of people you onboarded, coached or coordinated, and what came of it.',
    strategy_area: 'A strategy memo or plan you wrote, with the reasoning shown.',
    creative_area: 'Selected works with process notes or drafts.',
    operations_area: 'Process docs, trackers or systems you built, with time or error saved.',
    client_area: 'Client outcomes and testimonials (with permission, or anonymised).',
    creatormgmt_area: 'Creator roster growth, retention and performance snapshots (anonymised).',
    content_area: 'Content samples with performance context.',
    analytics_area: 'Dashboards or reports you built, with the decision they informed.',
    problem_area: 'Short problem-solution notes: what broke, what you tried, what worked.'
  };

  var PROOF_SHORT = {
    campaigns: 'Campaign outcome reports', projects: 'Project write-ups', results: 'Metrics with baselines', leadership: 'Examples of people you led',
    strategy: 'A strategy memo you wrote', creative: 'Selected works with process notes', operations: 'Systems and trackers you built',
    client: 'Client outcomes and testimonials', creatormgmt: 'Creator roster and performance snapshots', content: 'Content samples with results',
    analytics: 'Dashboards and the decisions they informed', problem: 'Problem–solution notes'
  };
  function lowerFirst(t) { return t ? t.charAt(0).toLowerCase() + t.slice(1) : t; }

  /* ------------------------------------------------------------------------
     2. STATE + STORAGE
     ------------------------------------------------------------------------ */

  // Assessment ID, e.g. PB-20260930-K7Q2MX (date the assessment started + 6 random characters).
  var ID_PATTERN = /^PB-\d{8}-[A-Z0-9]{6}$/;
  function makeAssessmentId(date) {
    var d = date || new Date();
    var ymd = d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
    var alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O or 1/I, so it is easy to read aloud
    var bytes = new Uint8Array(6);
    try { window.crypto.getRandomValues(bytes); } catch (e) { for (var j = 0; j < 6; j++) bytes[j] = Math.floor(Math.random() * 256); }
    var out = '';
    for (var i = 0; i < 6; i++) out += alphabet[bytes[i] % alphabet.length];
    return 'PB-' + ymd + '-' + out;
  }

  function defaults() {
    return {
      version: 1,
      assessmentId: makeAssessmentId(),
      respondent: { name: '', email: '' },
      submission: { status: 'none', submittedAt: null, lastAttemptAt: null, attempts: 0, hash: null },
      exportIncludePrivate: false,
      createdAt: null,
      updatedAt: null,
      step: 'landing',
      lastStep: null,
      matrixIndex: 0,
      visited: {},
      skipped: {},
      contexts: [],
      contextsNow: {},
      categories: [],
      knownFor: [],
      custom: [],
      matrix: {},
      irl: {},
      social: { items: {}, lowFrequency: false, postNow: '', postGoal: '', platforms: [] },
      career: { attributes: [], otherAttribute: '', evidence: [], underDocumented: [], networkingLead: [], networkingLine: '', currentRole: '', targetRole: '', nowKnownFor: [], nowIntro: '' },
      portfolio: { areas: [], answers: {}, hiredForNote: '', currentWork: '' },
      documentation: {},
      documentationNow: {},
      boundaries: { never: [], other: '', exposedNow: [] },
      future: { identity: '', currentIdentity: '', roles: {}, evidenceNeeded: '', startDocumenting: [], documentingNote: '' },
      notes: {},
      dashboard: { entries: [] }
    };
  }

  function merge(def, src) {
    if (Array.isArray(def)) return Array.isArray(src) ? src.slice() : def;
    if (def && typeof def === 'object') {
      var out = {};
      Object.keys(def).forEach(function (k) { out[k] = def[k]; });
      if (src && typeof src === 'object' && !Array.isArray(src)) {
        Object.keys(src).forEach(function (k) {
          out[k] = (k in def) ? merge(def[k], src[k]) : src[k];
        });
      }
      return out;
    }
    if (src === undefined) return def;
    if (def === null) return src;
    return typeof src === typeof def ? src : def;
  }

  function normalize(raw) {
    var s = merge(defaults(), raw || {});
    var ctxIds = CONTEXTS.map(function (c) { return c.id; });
    s.contexts = s.contexts.filter(function (c) { return ctxIds.indexOf(c) > -1; });
    s.custom = (s.custom || []).filter(function (c) { return c && typeof c.id === 'string' && typeof c.label === 'string'; })
      .map(function (c) { return { id: c.id, label: c.label.slice(0, 80), work: !!c.work }; });
    var catIds = CATEGORIES.map(function (c) { return c.id; }).concat(s.custom.map(function (c) { return c.id; }));
    s.categories = s.categories.filter(function (c, i, a) { return catIds.indexOf(c) > -1 && a.indexOf(c) === i; });
    s.dashboard.entries = (s.dashboard.entries || []).filter(function (e) { return e && typeof e === 'object'; }).map(function (e) {
      return {
        id: String(e.id || uid()), project: str(e.project), evidence: str(e.evidence), date: str(e.date), result: str(e.result),
        screenshot: typeof e.screenshot === 'string' && e.screenshot.indexOf('data:image/') === 0 ? e.screenshot : '',
        link: str(e.link), notes: str(e.notes), status: ['document', 'review', 'publish', 'private'].indexOf(e.status) > -1 ? e.status : 'review'
      };
    });
    if (typeof s.matrixIndex !== 'number' || s.matrixIndex < 0) s.matrixIndex = 0;
    if (typeof s.assessmentId !== 'string' || !ID_PATTERN.test(s.assessmentId)) s.assessmentId = makeAssessmentId();
    if (['none', 'sent', 'failed', 'not-configured'].indexOf(s.submission.status) === -1) s.submission.status = 'none';
    s.respondent.name = str(s.respondent.name).slice(0, 120);
    s.respondent.email = str(s.respondent.email).slice(0, 200);
    return s;
  }
  function str(v) { return typeof v === 'string' ? v : ''; }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  var storageOK = true;
  function load() {
    try {
      var raw = window.localStorage.getItem(STORE_KEY);
      return raw ? normalize(JSON.parse(raw)) : defaults();
    } catch (e) {
      storageOK = false;
      return defaults();
    }
  }
  function persist() {
    state.updatedAt = new Date().toISOString();
    if (!state.createdAt) state.createdAt = state.updatedAt;
    try {
      window.localStorage.setItem(STORE_KEY, JSON.stringify(state));
      storageOK = true;
      return true;
    } catch (e) {
      storageOK = false;
      return false;
    }
  }
  var saveTimer = null;
  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      if (!persist()) toast('This browser refused to save. Export your answers to keep them.');
    }, 250);
  }
  function hasAnswers() {
    return state.contexts.length || state.categories.length || Object.keys(state.matrix).length ||
      state.future.identity || state.boundaries.never.length || state.dashboard.entries.length;
  }

  var state = load();

  /* ------------------------------------------------------------------------
     3. HELPERS
     ------------------------------------------------------------------------ */

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function has(ctx) { return state.contexts.indexOf(ctx) > -1; }
  function labelOf(list, id) { for (var i = 0; i < list.length; i++) if (list[i][0] === id) return list[i][1]; return id; }
  function allCategories() {
    return CATEGORIES.concat(state.custom.map(function (c) { return { id: c.id, label: c.label, tags: c.work ? 'pro prove custom' : 'custom' }; }));
  }
  function catById(id) { var all = allCategories(); for (var i = 0; i < all.length; i++) if (all[i].id === id) return all[i]; return null; }
  function selectedCats() { return state.categories.map(catById).filter(Boolean); }
  function hasTag(cat, t) { return (' ' + cat.tags + ' ').indexOf(' ' + t + ' ') > -1; }
  function getPath(path) {
    var parts = path.split('.'), o = state;
    for (var i = 0; i < parts.length; i++) { if (o == null) return undefined; o = o[parts[i]]; }
    return o;
  }
  function setPath(path, value) {
    var parts = path.split('.'), o = state;
    for (var i = 0; i < parts.length - 1; i++) {
      if (o[parts[i]] == null || typeof o[parts[i]] !== 'object') o[parts[i]] = {};
      o = o[parts[i]];
    }
    if (value === undefined) delete o[parts[parts.length - 1]];
    else o[parts[parts.length - 1]] = value;
  }
  function list(items, fallback) {
    items = items.filter(Boolean);
    if (!items.length) return fallback || '';
    if (items.length === 1) return items[0];
    return items.slice(0, -1).join(', ') + ' and ' + items[items.length - 1];
  }
  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
  function fmtDate(iso) {
    if (!iso) return '';
    try { return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }); } catch (e) { return iso; }
  }
  function fmtTime(iso) {
    try { return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; }
  }

  var ICON = {
    landing: '<path d="M2.5 7 8 2.5 13.5 7v6.5h-11z"/>',
    contexts: '<circle cx="8" cy="8" r="6"/><path d="M10.5 5.5 9 9l-3.5 1.5L7 7z"/>',
    identity: '<circle cx="8" cy="5.5" r="2.5"/><path d="M3 14c.6-3 2.6-4.5 5-4.5s4.4 1.5 5 4.5"/>',
    matrix: '<rect x="2.5" y="2.5" width="4.5" height="4.5" rx="1"/><rect x="9" y="2.5" width="4.5" height="4.5" rx="1"/><rect x="2.5" y="9" width="4.5" height="4.5" rx="1"/><rect x="9" y="9" width="4.5" height="4.5" rx="1"/>',
    irl: '<path d="M8 14s4.5-4.2 4.5-7.5a4.5 4.5 0 0 0-9 0C3.5 9.8 8 14 8 14z"/><circle cx="8" cy="6.5" r="1.6"/>',
    social: '<circle cx="8" cy="8" r="2.5"/><path d="M10.5 8v1a2 2 0 0 0 4 0V8a6.5 6.5 0 1 0-2.6 5.2"/>',
    career: '<rect x="2" y="5" width="12" height="8.5" rx="1.5"/><path d="M6 5V3.5h4V5M2 9h12"/>',
    portfolio: '<path d="M4 2h5.5L12.5 5v9H4z"/><path d="M9.5 2v3h3"/>',
    document: '<path d="M2.5 3.5c2-1 4-1 5.5.5 1.5-1.5 3.5-1.5 5.5-.5v9.5c-2-1-4-1-5.5.5-1.5-1.5-3.5-1.5-5.5-.5z"/><path d="M8 4v9.5"/>',
    boundaries: '<rect x="3.5" y="7" width="9" height="7" rx="1.5"/><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2"/>',
    future: '<path d="M2.5 8h10M9 4.5 12.5 8 9 11.5"/>',
    results: '<path d="M2 4l4-1.5 4 1.5 4-1.5v9.5L10 13.5 6 12 2 13.5z"/><path d="M6 2.5V12M10 4v9.5"/>',
    dashboard: '<rect x="2" y="3" width="12" height="3" rx="1"/><path d="M3 6v7h10V6M6.5 9h3"/>',
    data: '<ellipse cx="8" cy="4" rx="5" ry="2"/><path d="M3 4v8c0 1.1 2.2 2 5 2s5-.9 5-2V4M3 8c0 1.1 2.2 2 5 2s5-.9 5-2"/>',
    lock: '<rect x="3.5" y="7" width="9" height="7" rx="1.5"/><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2"/>'
  };
  function icon(name) { return '<svg viewBox="0 0 16 16" aria-hidden="true">' + (ICON[name] || '') + '</svg>'; }

  var FOLDER_SVG =
    '<svg viewBox="0 0 120 94" aria-hidden="true" focusable="false"><g filter="url(#paper)">' +
    '<path class="f-tab" d="M2 14a9 9 0 0 1 9-9h28a9 9 0 0 1 6.4 2.6L51 13h58a9 9 0 0 1 9 9v10H2z"/>' +
    '<rect class="f-body" x="2" y="19" width="116" height="73" rx="9"/>' +
    '<rect class="f-shine" x="2" y="19" width="116" height="5" rx="2.5"/>' +
    '</g></svg>';
  var CHEV_L = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M12.5 4 6.5 10l6 6"/></svg>';
  var CHEV_R = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M7.5 4l6 6-6 6"/></svg>';
  var ARROW_R = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10h11M11 5.5 15.5 10 11 14.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  function tag(level, extra) { return '<i class="tag tag-' + level + (extra ? ' ' + extra : '') + '" aria-hidden="true"></i>'; }
  function lvl(level, later) {
    var L = LEVELS[level] || LEVELS.na;
    return '<span class="lvl lvl-' + level + '">' + (level === 'na' ? '' : tag(L.tag)) + (level === 'na' ? '—<span class="sr">Not needed</span>' : esc(L.short || L.label)) +
      (later ? '<span class="later">later</span>' : '') + '</span>';
  }

  /* ------------------------------------------------------------------------
     4. COMPONENTS
     ------------------------------------------------------------------------ */

  function fid(path) { return 'f-' + path.replace(/[^a-zA-Z0-9]+/g, '-'); }

  function scaleQ(num, path, question, labels, opts) {
    opts = opts || {};
    var value = getPath(path);
    var id = fid(path);
    var html = '<fieldset class="q" aria-describedby="' + id + '-cap"><legend>' + (num ? '<span class="q-num">' + num + '</span>' : '') + esc(question) + '</legend>' +
      '<div class="scale' + (opts.noNs ? ' no-ns' : '') + '">';
    labels.forEach(function (l, i) {
      var v = i + 1;
      html += '<label class="scale-opt"><input type="radio" name="' + id + '" value="' + v + '" data-bind="' + path + '"' + (value === v ? ' checked' : '') + '>' +
        '<span class="scale-face"><span class="scale-num">' + v + '</span><span class="scale-lab">' + esc(l) + '</span></span></label>';
    });
    if (!opts.noNs) {
      html += '<label class="scale-opt scale-ns"><input type="radio" name="' + id + '" value="ns" data-bind="' + path + '"' + (value === 'ns' ? ' checked' : '') + '>' +
        '<span class="scale-face"><span class="scale-num">?</span><span class="scale-lab">Not sure</span></span></label>';
    }
    html += '</div><p class="q-caption" id="' + id + '-cap" data-caption-for="' + path + '" data-labels="' + esc(JSON.stringify(labels)) + '">' + captionText(value, labels) + '</p></fieldset>';
    return html;
  }
  function captionText(value, labels) {
    if (value === 'ns') return 'Not sure — scored as neutral and flagged as provisional.';
    if (typeof value === 'number') return value + ' — ' + esc(labels[value - 1]);
    return 'No answer yet.';
  }

  function chip(path, value, label, checked, cls) {
    return '<label class="chip' + (cls ? ' ' + cls : '') + '"><input class="sr" type="checkbox" data-bind-array="' + path + '" value="' + esc(value) + '"' + (checked ? ' checked' : '') + '><span>' + esc(label) + '</span></label>';
  }
  function chips(path, items, cls) {
    var cur = getPath(path) || [];
    return '<div class="chips">' + items.map(function (it) { return chip(path, it[0], it[1], cur.indexOf(it[0]) > -1, cls); }).join('') + '</div>';
  }

  function seg(path, options, extraCls) {
    var value = getPath(path);
    var name = fid(path);
    return '<div class="seg' + (extraCls ? ' ' + extraCls : '') + '">' + options.map(function (o) {
      return '<label><input type="radio" name="' + name + '" value="' + o[0] + '" data-bind="' + path + '"' + (value === o[0] ? ' checked' : '') + '>' +
        '<span>' + (o[2] ? tag(o[2]) : '') + esc(o[1]) + '</span></label>';
    }).join('') + '</div>';
  }

  function folderToggle(path, value, label, desc, checked, pink, extra) {
    return '<label class="folder' + (pink ? ' pink' : '') + '">' +
      '<input class="sr" type="checkbox" data-bind-array="' + path + '" value="' + esc(value) + '"' + (checked ? ' checked' : '') + '>' +
      '<span class="folder-art">' + FOLDER_SVG + '<span class="folder-check" aria-hidden="true">✓</span></span>' +
      '<span class="folder-name"><i class="tag" aria-hidden="true"></i>' + esc(label) + '</span>' +
      (desc ? '<span class="folder-desc">' + esc(desc) + '</span>' : '') + (extra || '') + '</label>';
  }

  function sectionHead(title, desc, eyebrow) {
    return '<div class="section-head">' + (eyebrow ? '<span class="eyebrow">' + esc(eyebrow) + '</span>' : '') +
      '<h2>' + title + '</h2>' + (desc ? '<p>' + desc + '</p>' : '') + '</div>';
  }

  /* ------------------------------------------------------------------------
     5. STEPS + NAVIGATION
     ------------------------------------------------------------------------ */

  var STEP_DEFS = [
    { id: 'contexts', group: 'Identity', short: 'Contexts', title: 'Where do you want to think about your <em>visibility?</em>' },
    { id: 'identity', group: 'Identity', short: 'Identity', title: 'What makes you, <em>you?</em>' },
    { id: 'matrix', group: 'Visibility', short: 'Visibility matrix', title: 'The visibility <em>matrix</em>' },
    { id: 'irl', group: 'Context', short: 'Public / IRL', title: 'How do you show up <em>in real life?</em>', when: function () { return has('irl'); } },
    { id: 'social', group: 'Context', short: 'Social media', title: 'What should the <em>internet</em> know about you?', when: function () { return has('social'); } },
    { id: 'career', group: 'Context', short: 'Career', title: 'What should your professional identity <em>communicate?</em>', when: function () { return has('career') || has('networking'); } },
    { id: 'portfolio', group: 'Context', short: 'Portfolio', title: 'What can you <em>prove?</em>', when: function () { return has('portfolio') || has('career'); } },
    { id: 'document', group: 'Boundaries', short: 'Documentation', title: 'Document <em>without publishing.</em>' },
    { id: 'boundaries', group: 'Boundaries', short: 'Boundaries', title: 'Where is <em>the line?</em>' },
    { id: 'future', group: 'Strategy', short: 'Future self', title: 'What are you <em>building toward?</em>' }
  ];
  var GROUPS = ['Identity', 'Visibility', 'Context', 'Boundaries', 'Strategy', 'Results'];
  var PAGES = {
    landing: { title: 'your visibility map, <em>on your terms…</em>', short: 'Start' },
    results: { title: 'Your visibility <em>strategy</em>', short: 'Results', group: 'Results' },
    dashboard: { title: 'Documentation <em>dashboard</em>', short: 'Dashboard' }
  };

  function activeSteps() { return STEP_DEFS.filter(function (s) { return !s.when || s.when(); }); }
  function stepDef(id) { for (var i = 0; i < STEP_DEFS.length; i++) if (STEP_DEFS[i].id === id) return STEP_DEFS[i]; return null; }
  function isStep(id) { return !!stepDef(id); }

  function go(id, opts) {
    opts = opts || {};
    if (!isStep(id) && !PAGES[id]) id = 'landing';
    if (isStep(id) && !opts.keepMatrix && id === 'matrix' && typeof opts.matrixIndex === 'number') state.matrixIndex = opts.matrixIndex;
    if (id !== 'results') lastNotice = null;
    state.step = id;
    if (isStep(id)) state.lastStep = id;
    render({ focus: opts.focus !== false, animate: true });
    window.scrollTo({ top: 0, behavior: 'auto' });
    scheduleSave();
  }

  function stepIndex() {
    var steps = activeSteps();
    for (var i = 0; i < steps.length; i++) if (steps[i].id === state.step) return i;
    // Current step no longer active (contexts changed): find the next one by order
    var order = STEP_DEFS.map(function (s) { return s.id; }).indexOf(state.step);
    for (var j = 0; j < steps.length; j++) if (STEP_DEFS.indexOf(steps[j]) > order) return j - 0.5;
    return steps.length - 0.5;
  }

  function next(skip) {
    if (state.step === 'landing') return go(state.lastStep && isStep(state.lastStep) ? state.lastStep : 'contexts');
    if (state.step === 'results') return go('dashboard');
    if (!isStep(state.step)) return;
    if (skip) state.skipped[state.step] = true; else { state.visited[state.step] = true; delete state.skipped[state.step]; }
    if (state.step === 'matrix') {
      var cats = selectedCats();
      if (state.matrixIndex < cats.length - 1) {
        state.matrixIndex++;
        render({ focus: true, animate: true });
        window.scrollTo({ top: 0 });
        scheduleSave();
        return;
      }
    }
    var steps = activeSteps();
    var idx = Math.floor(stepIndex());
    if (idx + 1 >= steps.length) return go('results');
    var target = steps[idx + 1].id;
    go(target, target === 'matrix' ? { matrixIndex: 0 } : {});
  }

  function back() {
    if (state.step === 'dashboard') return go('results');
    if (state.step === 'results') { var st = activeSteps(); return go(st[st.length - 1].id, st[st.length - 1].id === 'matrix' ? { matrixIndex: Math.max(0, selectedCats().length - 1) } : {}); }
    if (!isStep(state.step)) return;
    if (state.step === 'matrix' && state.matrixIndex > 0) {
      state.matrixIndex--;
      render({ focus: true, animate: true });
      window.scrollTo({ top: 0 });
      scheduleSave();
      return;
    }
    var steps = activeSteps();
    var idx = Math.ceil(stepIndex());
    if (idx <= 0) return go('landing');
    var target = steps[idx - 1].id;
    go(target, target === 'matrix' ? { matrixIndex: Math.max(0, selectedCats().length - 1) } : {});
  }

  function stepStatus(id) {
    if (state.skipped[id]) return 'skipped';
    if (state.visited[id]) return 'done';
    return '';
  }

  /* ------------------------------------------------------------------------
     6. CHROME (sidebar, toolbar, step nav, footer)
     ------------------------------------------------------------------------ */

  function sideNav(inSheet) {
    var steps = activeSteps();
    var cur = state.step;
    var h = '<div class="side-group"><div class="side-label">Assessment</div>';
    h += '<button type="button" class="side-item" data-action="go" data-to="landing"' + (cur === 'landing' ? ' aria-current="page"' : '') + '>' + icon('landing') + 'Start</button>';
    steps.forEach(function (s, i) {
      var st = stepStatus(s.id);
      var extra = s.id === 'matrix' && selectedCats().length ? '<span class="count">' + ratedCount() + '/' + selectedCats().length + '</span>' :
        (st ? '<span class="side-state">' + tag(st === 'done' ? 'done' : 'skipped') + '<span class="sr">' + (st === 'done' ? 'completed' : 'skipped') + '</span></span>' : '');
      h += '<button type="button" class="side-item" data-action="go" data-to="' + s.id + '"' + (cur === s.id ? ' aria-current="step"' : '') + '>' +
        icon(s.id) + '<span>' + esc(s.short) + '</span>' + extra + '</button>';
    });
    h += '</div>';
    h += '<div class="side-group"><div class="side-label">Strategy</div>' +
      '<button type="button" class="side-item" data-action="go" data-to="results"' + (cur === 'results' ? ' aria-current="page"' : '') + '>' + icon('results') + 'Results</button>' +
      '<button type="button" class="side-item" data-action="go" data-to="dashboard"' + (cur === 'dashboard' ? ' aria-current="page"' : '') + '>' + icon('dashboard') + 'Dashboard' +
      (state.dashboard.entries.length ? '<span class="count">' + state.dashboard.entries.length + '</span>' : '') + '</button>' +
      '<button type="button" class="side-item" data-action="open-data">' + icon('data') + 'Your data</button></div>';
    h += '<div class="side-group side-legend" aria-label="Visibility tags"><div class="side-label">Tags</div>' +
      ['public', 'strategic', 'selective', 'private', 'document'].map(function (k) {
        return '<div class="side-item">' + tag(LEVELS[k].tag) + esc(LEVELS[k].label) + '</div>';
      }).join('') + '</div>';
    if (!inSheet) {
      h += '<div class="side-bubble"><span class="bubble tail-left">' + (storageOK ? 'Saved in this browser. Sent only if you submit.' : 'Storage is off here. Export to keep your answers.') + '</span></div>';
    }
    return h;
  }

  function renderSidebar() {
    $('#sidebar').innerHTML = '<div class="lights" aria-hidden="true"><i></i><i></i><i></i></div>' + sideNav(false);
  }

  function ratedCount() {
    return selectedCats().filter(function (c) { var a = state.matrix[c.id] || {}; return a.comfort != null || a.useful != null; }).length;
  }

  function renderToolbar() {
    var cur = state.step;
    var def = stepDef(cur);
    var title = def ? def.title : PAGES[cur].title;
    var steps = activeSteps();
    var idx = def ? Math.floor(stepIndex()) : -1;
    var group = def ? def.group : (PAGES[cur].group || '');
    var pct = 0, count = '';
    if (def) {
      var sub = 0;
      if (cur === 'matrix' && selectedCats().length) sub = state.matrixIndex / selectedCats().length;
      pct = Math.round(((idx + sub) / steps.length) * 100);
      count = 'Step ' + (idx + 1) + ' of ' + steps.length;
    } else if (cur === 'results' || cur === 'dashboard') { pct = 100; count = cur === 'results' ? 'Complete' : 'Dashboard'; }

    var backDisabled = cur === 'landing';
    var h = '<div class="tb-mobile"><div class="lights" aria-hidden="true"><i></i><i></i><i></i></div>' +
      '<button type="button" class="btn btn-sm" data-action="open-menu" aria-haspopup="dialog">Sections</button></div>' +
      '<div class="tb-row"><div class="chevs">' +
      '<button type="button" class="chev" data-action="back" aria-label="Back"' + (backDisabled ? ' disabled' : '') + '>' + CHEV_L + '</button>' +
      '<button type="button" class="chev" data-action="next" aria-label="' + (cur === 'results' ? 'Open dashboard' : 'Continue') + '"' + (cur === 'dashboard' ? ' disabled' : '') + '>' + CHEV_R + '</button></div>' +
      '<h1 class="tb-title" id="view-title" tabindex="-1">' + title + '</h1></div>';
    if (cur !== 'landing') {
      var gi = GROUPS.indexOf(group);
      h += '<div class="tb-meta"><ol class="crumbs" aria-label="Sections">' + GROUPS.map(function (g, i) {
        return '<li class="' + (i === gi ? 'on' : (i < gi ? 'past' : '')) + '"' + (i === gi ? ' aria-current="step"' : '') + '>' + g + '</li>';
      }).join('') + '</ol>' +
        '<div class="progress"><span class="step-count">' + count + '</span>' +
        '<div class="bar" role="progressbar" aria-label="Progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + pct + '"><span style="width:' + pct + '%"></span></div></div></div>';
    }
    $('#toolbar').innerHTML = h;
  }

  function renderStepnav() {
    var cur = state.step;
    var nav = $('#stepnav');
    if (cur === 'landing') { nav.innerHTML = ''; return; }
    if (cur === 'results' || cur === 'dashboard') {
      nav.innerHTML = '<button type="button" class="btn nav-back btn-upper" data-action="back">Back</button><span class="spacer"></span>' +
        '<div class="nav-secondary"><button type="button" class="btn btn-quiet btn-sm btn-upper" data-action="save">Save progress</button>' +
        '<button type="button" class="btn btn-quiet btn-sm btn-upper" data-action="open-data">Your data</button></div>' +
        (cur === 'results' ? '<button type="button" class="btn btn-primary nav-next btn-upper" data-action="go" data-to="dashboard">Open dashboard</button>' :
          '<button type="button" class="btn btn-primary nav-next btn-upper" data-action="go" data-to="results">View results</button>');
      return;
    }
    var steps = activeSteps();
    var idx = Math.floor(stepIndex());
    var last = idx >= steps.length - 1 && !(cur === 'matrix' && state.matrixIndex < selectedCats().length - 1);
    var skipLabel = cur === 'matrix' && selectedCats().length ? 'Skip area' : 'Skip';
    var isFinal = last && state.step === activeSteps()[activeSteps().length - 1].id;
    nav.innerHTML = '<button type="button" class="btn nav-back btn-upper" data-action="back">Back</button>' +
      '<div class="nav-secondary"><button type="button" class="btn btn-quiet btn-sm btn-upper" data-action="skip">' + skipLabel + '</button>' +
      '<button type="button" class="btn btn-quiet btn-sm btn-upper" data-action="save-exit">Save &amp; exit</button>' +
      '<button type="button" class="btn btn-quiet btn-sm btn-upper" data-action="go" data-to="results">View results</button></div>' +
      '<span class="spacer"></span>' +
      (isFinal ?
        '<button type="button" class="btn btn-primary nav-next btn-upper" data-action="submit"' + (submitting ? ' disabled aria-busy="true"' : '') + '>' + (submitting ? esc(submitLabel) : 'See my results') + '</button>' :
        '<button type="button" class="btn btn-primary nav-next btn-upper" data-action="next">' + (last ? 'View results' : 'Continue') + ARROW_R.replace('<svg', '<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"') + '</button>');
  }

  function renderFooter() {
    $('#site-foot').innerHTML =
      '<div class="foot-row"><span class="foot-bubble">Your answers are stored locally in this browser. This tool does not require an account. Nothing is sent anywhere unless you choose to submit your assessment.</span></div>' +
      '<details><summary>How to publish this website</summary>' +
      '<ol>' +
      '<li><strong>Download the project files.</strong> Keep the folder together: <code>index.html</code>, <code>styles.css</code>, <code>script.js</code>, <code>README.md</code> and the <code>assets</code> folder.</li>' +
      '<li><strong>Create a GitHub account</strong> at github.com (free). Confirm your email address.</li>' +
      '<li><strong>Create a repository.</strong> Click the <code>+</code> in the top right, choose <em>New repository</em>, name it (for example <code>visibility-map</code>).</li>' +
      '<li><strong>Make the repository public.</strong> Choose <em>Public</em> on the same screen, then click <em>Create repository</em>.</li>' +
      '<li><strong>Upload the files.</strong> Click <em>uploading an existing file</em>, drag in everything from the project folder (including the <code>assets</code> folder), then click <em>Commit changes</em>. <code>index.html</code> must sit at the top level, not inside another folder.</li>' +
      '<li><strong>Open Settings → Pages</strong> (the Settings tab at the top of your repository, then Pages in the left menu).</li>' +
      '<li><strong>Select the main branch.</strong> Under <em>Build and deployment</em>, set Source to <em>Deploy from a branch</em>, choose <code>main</code> and <code>/ (root)</code>.</li>' +
      '<li><strong>Click Save.</strong></li>' +
      '<li><strong>Open your website.</strong> After a minute or two, refresh the Pages screen. Your address appears at the top, like <code>https://your-name.github.io/visibility-map/</code>.</li>' +
      '</ol></details>';
  }

  /* ------------------------------------------------------------------------
     7. VIEWS — questionnaire
     ------------------------------------------------------------------------ */

  function viewLanding() {
    var resume = hasAnswers() && state.lastStep && isStep(state.lastStep);
    var rs = resume ? stepDef(state.lastStep) : null;
    return '' +
      '<section class="hero">' +
        '<div class="hero-copy">' +
          '<span class="eyebrow">Visibility Map · a personal strategy tool</span>' +
          '<h2 class="hero-title">You don’t have to show <em>everything</em> to be visible.</h2>' +
          '<p class="hero-sub">Build a personal visibility strategy around who you are, what you want to be known for, and what you want to keep private.</p>' +
          '<p class="hero-support">Decide what belongs in public, what belongs in specific rooms, what belongs online, and what should stay yours.</p>' +
          '<div class="hero-actions">' +
            '<button type="button" class="cta-bubble" data-action="start">' + (resume ? 'Continue the assessment' : 'Start the Assessment') + ARROW_R + '</button>' +
            '<button type="button" class="btn" data-action="how">How it works</button>' +
          '</div>' +
          (resume ? '<div class="resume">' + tag('done') + '<span>Saved ' + esc(fmtDate(state.updatedAt)) + '. You were at <strong>' + esc(rs.short) + '</strong>.</span>' +
            '<button type="button" class="linkbtn" data-action="go" data-to="results">See results so far</button></div>' : '') +
        '</div>' +
        '<div class="hero-board" aria-hidden="true">' +
          '<div class="pin p1">' + FOLDER_SVG + '<p>' + tag('public') + 'what you show</p></div>' +
          '<div class="pin p2 pink">' + FOLDER_SVG + '<p>' + tag('selective') + 'who gets access</p></div>' +
          '<div class="pin p3"><div class="doc-thumb"><div class="dt-top"><span>private</span><span>vol. 01</span></div><div class="dt-title">what I keep <em>for me</em></div><ul><li>progress</li><li>lessons</li><li>drafts</li><li>ideas</li></ul></div><p>' + tag('document') + 'what you document</p></div>' +
          '<div class="pin p4 pink">' + FOLDER_SVG + '<p>' + tag('private') + 'what stays yours</p></div>' +
          '<span class="bubble tail-left b1">@visibility.map</span>' +
          '<span class="bubble bubble-pink tail-left b2">visibility ≠ exposure</span>' +
        '</div>' +
      '</section>' +

      '<section class="section" aria-labelledby="principles-h">' +
        '<h2 class="sr" id="principles-h">Principles</h2>' +
        '<div class="principles">' +
          '<article class="principle"><span class="p-num">' + tag('public') + '01</span><h3>Visibility <em>≠</em> Exposure</h3><p>You can be visible without revealing everything.</p></article>' +
          '<article class="principle"><span class="p-num">' + tag('strategic') + '02</span><h3>Different audiences, <em>different versions</em></h3><p>What belongs on LinkedIn does not necessarily belong on Instagram, or in real life.</p></article>' +
          '<article class="principle"><span class="p-num">' + tag('document') + '03</span><h3>Private progress <em>still counts</em></h3><p>You can document your growth without publishing it.</p></article>' +
        '</div>' +
      '</section>' +

      '<section class="how" id="how" tabindex="-1" aria-labelledby="how-h">' +
        '<div class="section">' +
          sectionHead('How it <em>works</em>', 'Six short sections, about 15 minutes. Every question can be skipped or marked “not sure”. Nothing here assumes that more openness is better.', 'Identity → Visibility → Context → Boundaries → Strategy → Results').replace('<h2>', '<h2 id="how-h">') +
          '<ol class="flow">' +
            '<li><span class="f-n">01</span><div><strong>Identity</strong><span>Choose the rooms you care about and the parts of your life that exist right now.</span></div></li>' +
            '<li><span class="f-n">02</span><div><strong>Visibility</strong><span>Rate each part on comfort, usefulness, control, durability and who should have access.</span></div></li>' +
            '<li><span class="f-n">03</span><div><strong>Context</strong><span>Only the rooms you picked: real life, social media, career, portfolio.</span></div></li>' +
            '<li><span class="f-n">04</span><div><strong>Boundaries</strong><span>Separate what you document from what you publish, and name what never goes public.</span></div></li>' +
            '<li><span class="f-n">05</span><div><strong>Strategy</strong><span>Say who you are building toward, and what should wait until later.</span></div></li>' +
            '<li><span class="f-n">06</span><div><strong>Results</strong><span>A visibility map, brand pillars, and a documentation dashboard you can keep using.</span></div></li>' +
          '</ol>' +
          '<p class="privacy-line">' + icon('lock') + 'Your answers are stored locally in this browser. This tool does not require an account. Nothing is sent anywhere unless you choose to submit your assessment.</p>' +
        '</div>' +
        '<div class="section">' +
          sectionHead('Seven <em>distinctions</em>', 'Personal branding is not the same thing as making your entire life public. The tool keeps these apart.') +
          '<div class="distinctions">' +
            '<div class="distinction"><b>Identity</b><span>who I am</span></div>' +
            '<div class="distinction"><b>Brand</b><span>what I want people to associate with me</span></div>' +
            '<div class="distinction"><b>Visibility</b><span>what people can see</span></div>' +
            '<div class="distinction"><b>Documentation</b><span>what I preserve for myself</span></div>' +
            '<div class="distinction"><b>Privacy</b><span>what remains mine</span></div>' +
            '<div class="distinction"><b>Audience</b><span>who gets access</span></div>' +
            '<div class="distinction"><b>Timing</b><span>when something becomes appropriate to reveal</span></div>' +
          '</div>' +
        '</div>' +
      '</section>';
  }

  /* ---------- Shared building blocks for every step ---------- */

  var VIS_LABELS = ['Nobody knows', 'A few close people', 'People I know', 'Many people', 'Anyone can find it'];
  var COMFORT_LABELS = ['I’d rather nobody knew', 'Only a few people', 'Depends who it is', 'Happy for most to know', 'Happy for anyone to know'];
  var CONTROL_LABELS = ['Very little', 'A little', 'Some', 'A lot', 'Completely'];
  var USEFUL_LABELS = ['Not at all', 'A little', 'Somewhat', 'A lot', 'It’s essential'];
  var DURABLE_LABELS = ['Definitely not', 'Probably not', 'Unsure', 'Probably yes', 'Definitely yes'];
  var VALUE_LABELS = ['Not at all', 'A little', 'Somewhat', 'Quite a lot', 'A great deal'];
  var CTX_NOW = [['none', 'Not at all', 'na'], ['little', 'A little', 'private'], ['some', 'Somewhat', 'selective'], ['very', 'Very', 'public']];
  var POST_FREQ = [['never', 'Never'], ['yearly', 'A few times a year'], ['monthly', 'Monthly'], ['weekly', 'Weekly'], ['often', 'Several times a week'], ['daily', 'Daily']];
  var PLATFORMS = [['instagram', 'Instagram'], ['tiktok', 'TikTok'], ['linkedin', 'LinkedIn'], ['x', 'X / Twitter'], ['facebook', 'Facebook'], ['youtube', 'YouTube'], ['threads', 'Threads'], ['other', 'Other']];
  var DOC_NOW = [['', '—'], ['regular', 'Yes, regularly'], ['sometimes', 'Sometimes'], ['no', 'Not yet']];
  var IRL_NOW = [
    { key: 'nowOpen', q: 'Right now, how much do people you meet casually learn about you?', labels: ['Very little', 'A little', 'Some', 'Quite a lot', 'A lot'] },
    { key: 'nowCareerTalk', q: 'How often do you talk about your work when you meet new people?', labels: ['Never', 'Rarely', 'Sometimes', 'Often', 'Almost always'] }
  ];
  var SOCIAL_GLOSSARY = [
    ['Private', 'Nobody online can see it.'],
    ['Close friends', 'Only a small private list, like a close-friends story.'],
    ['Selective', 'Some people or accounts you choose.'],
    ['Followers', 'Everyone who follows you.'],
    ['Public', 'Anyone, including search engines.'],
    ['Strategic', 'Public, but shown on purpose and in a planned way.']
  ];

  function intro(what, why, how) {
    return '<div class="intro-card" role="note" aria-label="About this section">' +
      '<div><b>What this is</b><p>' + what + '</p></div>' +
      '<div><b>Why it matters</b><p>' + why + '</p></div>' +
      '<div><b>How to answer</b><p>' + how + '</p></div></div>';
  }
  var PART_META = { now: ['Where you are now', 'selective'], goal: ['Where you want to be', 'public'], both: ['Now and goal, item by item', 'strategic'], notes: ['Your notes', 'document'] };
  function part(kind, title, desc, body) {
    var L = PART_META[kind];
    return '<section class="part part-' + kind + '"><div class="part-head"><span class="part-label">' + tag(L[1]) + L[0] + '</span>' +
      (title ? '<h2>' + title + '</h2>' : '') + (desc ? '<p>' + desc + '</p>' : '') + '</div>' + body + '</section>';
  }
  function notesBox(path, prompt) {
    var id = fid('notes-' + path);
    return part('notes', null, null,
      '<div class="field"><label for="' + id + '">' + esc(prompt) + '</label>' +
      '<p class="hint">Saved in this browser. Included in your Word and Excel downloads, and in your submission if you submit.</p>' +
      '<textarea class="textarea notes-area" id="' + id + '" rows="4" data-bind-text="' + path + '" placeholder="Write anything you want to remember…">' + esc(getPath(path) || '') + '</textarea></div>');
  }
  function textField(path, label, hint, placeholder, rows) {
    var id = fid('tf-' + path);
    var v = esc(getPath(path) || '');
    return '<div class="field"><label for="' + id + '">' + esc(label) + '</label>' + (hint ? '<p class="hint">' + esc(hint) + '</p>' : '') +
      (rows ? '<textarea class="textarea" id="' + id + '" rows="' + rows + '" data-bind-text="' + path + '" placeholder="' + esc(placeholder || '') + '">' + v + '</textarea>' :
        '<input class="input" id="' + id + '" maxlength="300" data-bind-text="' + path + '" value="' + v + '" placeholder="' + esc(placeholder || '') + '">') + '</div>';
  }
  function fieldQ(num, question, hint, body) {
    return '<fieldset class="q"><legend>' + (num ? '<span class="q-num">' + num + '</span>' : '') + esc(question) + '</legend>' + (hint ? '<p class="hint">' + esc(hint) + '</p>' : '') + body + '</fieldset>';
  }
  function selectBind(path, options, label) {
    var v = getPath(path) || '';
    var id = fid('sel-' + path);
    return '<label class="mini" for="' + id + '"><span>' + label + '</span><select class="select" id="' + id + '" data-bind="' + path + '">' +
      options.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (v === o[0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select></label>';
  }
  function subLabel(kind) { return '<span class="sub-label">' + tag(PART_META[kind][1]) + (kind === 'now' ? 'Now' : 'Goal') + '</span>'; }

  /* ---------- Step 1: contexts ---------- */
  function viewContexts() {
    var rows = CONTEXTS.map(function (c) {
      var lid = fid('ctxnow-' + c.id);
      return '<div class="row"><div class="row-label" id="' + lid + '">' + esc(c.label) + '<small>' + esc(c.desc) + '</small></div>' +
        '<div class="row-body" role="radiogroup" aria-labelledby="' + lid + '">' + seg('contextsNow.' + c.id, CTX_NOW, 'seg-4') + '</div></div>';
    }).join('');
    return intro('A context is a “room” where people can see you: in person, on social media, at work, among friends.',
        'The same fact can be right for one room and wrong for another. Later steps only ask about the rooms you pick.',
        'First say how visible you are in each room today. Then pick the rooms you want to plan for.') +
      part('now', 'How visible are you in each room <em>today?</em>', 'Be honest rather than hopeful. Leave a row empty if you are not sure.', '<div class="rows">' + rows + '</div>') +
      part('goal', 'Which rooms do you want to <em>plan for?</em>', 'Pick every room where you want to be more intentional. You can pick as many as you like. <strong>Different audiences can receive different versions of your story.</strong>',
        '<div class="folders lg" role="group" aria-label="Rooms to plan for">' +
        CONTEXTS.map(function (c, i) { return folderToggle('contexts', c.id, c.label, c.desc, has(c.id), i % 3 === 1); }).join('') +
        '</div><div id="ctx-note">' + contextNote() + '</div>') +
      notesBox('notes.contexts', 'Anything about these rooms you want to remember? For example, a platform you want to leave, or a room you tend to avoid.');
  }
  function contextNote() {
    var n = state.contexts.length;
    if (!n) return '<p class="note">' + tag('na') + '<span>No room picked yet. You can continue anyway: the assessment stays general and skips the room-specific sections.</span></p>';
    return '<p class="note">' + tag('done') + '<span>' + n + ' room' + (n > 1 ? 's' : '') + ' picked. Your assessment has ' + activeSteps().length + ' steps.</span></p>';
  }

  /* ---------- Step 2: identity ---------- */
  function viewIdentity() {
    var cats = allCategories();
    var cur = state.categories;
    return intro('These are the parts of your life: work, interests, relationships, progress and plans.',
        'You can only choose what to show once you have named what exists. Nothing here is shared by picking it.',
        'First pick everything that is real for you today, even things you would never show. Then pick the few you most want to be known for.') +
      part('now', 'What is part of your life <em>right now?</em>', 'Select everything that applies today. Pick at least three for a useful map.',
        '<p class="hint" id="cat-count" aria-live="polite">' + catCountText() + '</p>' +
        '<div class="folders sm" role="group" aria-label="Parts of your life">' +
        cats.map(function (c, i) {
          var isCustom = hasTag(c, 'custom');
          var extra = isCustom ? '<button type="button" class="remove-custom" data-action="remove-custom" data-id="' + esc(c.id) + '" aria-label="Remove ' + esc(c.label) + '">×</button>' : '';
          return folderToggle('categories', c.id, c.label, '', cur.indexOf(c.id) > -1, (i % 5 === 1 || i % 5 === 3), extra);
        }).join('') + '</div>' +
        '<div class="form-card">' +
          '<div class="field"><label for="custom-cat">Add your own area</label><p class="hint">For anything the list misses: a community you lead, a language you are learning, a cause.</p></div>' +
          '<form class="inline-form" data-form="custom">' +
            '<input class="input" id="custom-cat" maxlength="60" autocomplete="off" placeholder="e.g. Language learning">' +
            '<label class="check"><input type="checkbox" id="custom-work"> Work-related</label>' +
            '<button type="submit" class="btn">Add area</button>' +
          '</form></div>') +
      part('goal', 'Which of these do you most want to be <em>known for?</em>', 'Pick up to five from the areas you selected above. This is about direction; it does not mean hiding the rest.',
        '<div id="known-for">' + knownForBlock() + '</div>') +
      notesBox('notes.identity', 'Anything about these parts of your life you want to remember? For example, an area that is changing, or one you feel unsure about.');
  }
  function catCountText() {
    var n = state.categories.length;
    if (!n) return 'Nothing selected yet.';
    return n + ' area' + (n > 1 ? 's' : '') + ' selected. ' + (n > 14 ? 'That is a lot to rate; consider focusing on the ones you actively think about.' : 'Each gets a short profile in the next step.');
  }
  function knownForBlock() {
    var cats = selectedCats();
    state.knownFor = state.knownFor.filter(function (k) { return state.categories.indexOf(k) > -1; });
    if (!cats.length) return '<p class="hint">Select some areas above first; they will appear here.</p>';
    var n = state.knownFor.length;
    return chips('knownFor', cats.map(function (c) { return [c.id, c.label]; })) +
      '<p class="hint" aria-live="polite">' + (n ? n + ' picked.' + (n > 5 ? ' Five or fewer gives a clearer signal.' : '') : 'None picked yet.') + '</p>';
  }

  /* ---------- Step 3: visibility matrix ---------- */
  function viewMatrix() {
    var cats = selectedCats();
    if (!cats.length) {
      return '<div class="empty-state"><h3>No areas to rate yet</h3><p>This step gives each part of your life its own profile: how visible it is today and how visible you want it to be. Pick a few areas first, or skip ahead and come back later.</p>' +
        '<button type="button" class="btn btn-primary" data-action="go" data-to="identity">Choose areas</button></div>';
    }
    if (state.matrixIndex >= cats.length) state.matrixIndex = cats.length - 1;
    var c = cats[state.matrixIndex];
    var base = 'matrix.' + c.id;
    var pink = state.matrixIndex % 2 === 1;
    return '<div id="mx-strip">' + matrixStrip() + '</div>' +
      '<div class="mx-head"><span class="folder' + (pink ? ' pink' : '') + '" aria-hidden="true"><span class="folder-art">' + FOLDER_SVG + '</span></span>' +
        '<div class="mx-name"><span class="eyebrow">Area ' + (state.matrixIndex + 1) + ' of ' + cats.length + '</span><b>' + esc(c.label) + '</b></div></div>' +
      (state.matrixIndex === 0 ? intro('Each area gets its own short profile: how things are today and how you want them to be.',
          'The gap between the two is where your strategy comes from: what to show more, what to pull back, what to leave alone.',
          'Answer about this area only. A low number is as useful an answer as a high one. Use “Not sure” when you genuinely are.') : '') +
      part('now', 'How it is <em>today</em>', null, '<div class="mx-qs">' +
        scaleQ('Now · 1', base + '.now', 'How visible is this part of you right now?', VIS_LABELS) +
        scaleQ('Now · 2', base + '.comfort', 'How do you feel about people knowing this today?', COMFORT_LABELS) +
        scaleQ('Now · 3', base + '.control', 'If people saw this, how much could you shape how they understand it?', CONTROL_LABELS) +
        '</div>') +
      part('goal', 'How you want it to <em>be</em>', null, '<div class="mx-qs">' +
        scaleQ('Goal · 1', base + '.goal', 'How visible do you want it to be?', VIS_LABELS) +
        '<p class="gap-line" id="gap-line" aria-live="polite">' + gapText(state.matrix[c.id] || {}) + '</p>' +
        scaleQ('Goal · 2', base + '.useful', 'How much would showing this help your goals (work, relationships, projects)?', USEFUL_LABELS) +
        scaleQ('Goal · 3', base + '.future', 'If this were public, would you still be fine with it two years from now?', DURABLE_LABELS, { noNs: true }) +
        fieldQ('Goal · 4', 'Who should be able to see it?', 'Choose every audience that fits. “Nobody” clears the others.', chips(base + '.access', ACCESS)) +
        scaleQ('Goal · 5', base + '.value', 'How much is it worth keeping a private record of this, just for you?', VALUE_LABELS) +
        '</div>') +
      notesBox(base + '.note', 'Notes on ' + c.label + ': examples, worries, people involved, or anything you want to remember.');
  }
  function gapText(a) {
    var n = typeof a.now === 'number' ? a.now : null, g = typeof a.goal === 'number' ? a.goal : null;
    if (n == null || g == null) return 'Answer “Now · 1” and “Goal · 1” to see the change you are aiming for.';
    if (g > n) return 'Today: ' + VIS_LABELS[n - 1] + '. Goal: ' + VIS_LABELS[g - 1] + '. You want this to be more visible.';
    if (g < n) return 'Today: ' + VIS_LABELS[n - 1] + '. Goal: ' + VIS_LABELS[g - 1] + '. You want this to be less visible.';
    return 'Today and goal match (' + VIS_LABELS[n - 1] + '). You want to keep it as it is.';
  }
  function matrixStrip() {
    var cats = selectedCats();
    return '<div class="mx-strip" role="list" aria-label="Areas">' + cats.map(function (c, i) {
      var a = state.matrix[c.id] || {};
      var done = a.comfort != null && a.useful != null;
      var partial = !done && Object.keys(a).filter(function (k) { return k !== 'note'; }).length > 0;
      return '<span role="listitem"><button type="button" class="mx-tab" data-action="matrix-jump" data-index="' + i + '"' + (i === state.matrixIndex ? ' aria-current="true"' : '') + '>' +
        tag(done ? 'done' : (partial ? 'partial' : 'na')) + esc(c.label) + '<span class="sr">' + (done ? ', rated' : partial ? ', partly rated' : ', not rated') + '</span></button></span>';
    }).join('') + '</div>';
  }

  /* ---------- Step: Public / IRL ---------- */
  function viewIRL() {
    return intro('This is about everyday real life: offices, events, dinners, family gatherings, people you meet once.',
        'In person you cannot edit or delete what you said, so it helps to decide your defaults in advance.',
        'First describe how you usually come across today. Then describe how you would like to come across.') +
      part('now', 'How you come across <em>today</em>', null, '<div class="mx-qs">' +
        IRL_NOW.map(function (q, i) { return scaleQ('Now · ' + (i + 1), 'irl.' + q.key, q.q, q.labels); }).join('') +
        fieldQ('Now · 3', 'When someone asks what you do, what do you usually say today?', null, seg('irl.intro', IRL_INTRO)) +
        '</div>') +
      part('goal', 'How you want to come <em>across</em>', '<strong>Privacy can be a deliberate strategy</strong>, not a lack of confidence.', '<div class="mx-qs">' +
        IRL_QS.map(function (q, i) { return scaleQ('Goal · ' + (i + 1), 'irl.' + q.key, q.q, q.labels); }).join('') +
        fieldQ('Goal · 7', 'How do you want to introduce yourself?', null, seg('irl.introGoal', IRL_INTRO)) +
        '</div>') +
      notesBox('notes.irl', 'Anything about real-life situations you want to remember? For example, a question people often ask that you find hard to answer.');
  }

  /* ---------- Step: Social media ---------- */
  function viewSocial() {
    var items = state.social.items;
    var h = intro('Each row below is one thing the internet could know about you, from your face to your opinions.',
        'Being findable online is a choice you make item by item, not all at once. It is also hard to undo.',
        'First describe how you use social media today and how you want to use it. Then set a “Now” and a “Goal” level for each item. Leave a row blank if it does not apply.');
    h += part('now', 'How you use social media <em>today</em>', null, '<div class="mx-qs">' +
      fieldQ('Now · 1', 'How often do you post right now?', null, seg('social.postNow', POST_FREQ, 'seg-3')) +
      fieldQ('Now · 2', 'Which platforms do you use?', 'Pick all that apply.', chips('social.platforms', PLATFORMS)) + '</div>');
    h += part('goal', 'How you want to use <em>it</em>', null, '<div class="mx-qs">' +
      fieldQ('Goal · 1', 'How often do you want to post?', null, seg('social.postGoal', POST_FREQ, 'seg-3')) +
      '<label class="switch"><input type="checkbox" data-bind-bool="social.lowFrequency"' + (state.social.lowFrequency ? ' checked' : '') + '><span class="track" aria-hidden="true"></span>' +
      '<span class="switch-text"><strong>I prefer low-frequency, intentional posting.</strong><small>Your content plan will assume a few considered posts, not a daily schedule.</small></span></label></div>');
    var body = '<dl class="glossary">' + SOCIAL_GLOSSARY.map(function (g) { return '<div><dt>' + g[0] + '</dt><dd>' + g[1] + '</dd></div>'; }).join('') + '</dl>' +
      '<p class="note">' + tag('selective') + '<span>Every reason to share is legitimate, including validation and habit. Naming the reason helps you choose the room.</span></p>';
    var opts = [['', '—']].concat(SOCIAL_LEVELS.map(function (l) { return [l[0], l[1]]; }));
    SOCIAL_GROUPS.forEach(function (g) {
      body += '<div class="section"><div class="group-title">' + esc(g.title) + '</div><div class="rows">';
      g.items.forEach(function (it) {
        var id = it[0];
        var cur = items[id] || {};
        var reasons = cur.reasons || [];
        body += '<div class="row"><div class="row-label">' + esc(it[1]) + '</div><div class="row-body">' +
          '<div class="dual">' + selectBind('social.items.' + id + '.now', opts, subLabel('now')) + selectBind('social.items.' + id + '.level', opts, subLabel('goal')) + '</div>' +
          '<details' + (reasons.length ? ' open' : '') + '><summary>Why would you share this?' + (reasons.length ? ' (' + reasons.length + ')' : '') + '</summary>' +
          chips('social.items.' + id + '.reasons', SOCIAL_REASONS) + '</details></div></div>';
      });
      body += '</div></div>';
    });
    h += part('both', 'What should the internet <em>know?</em>', 'Set where each item is today and where you want it to be. The levels are explained first.', body);
    return h + notesBox('notes.social', 'Anything about social media you want to remember? For example, old posts to clean up, or an account to set up.');
  }

  /* ---------- Step: Career ---------- */
  function viewCareer() {
    var c = state.career;
    var h = intro('How employers, clients, collaborators and professional contacts see you.',
        'People decide in seconds what you do and whether you are credible. You can shape that without disclosing everything.',
        'First describe your work and your proof as they are today. Then describe the direction you are aiming for.');
    var now = '<div class="mx-qs">' +
      textField('career.currentRole', 'Now · 1 — What do you do now?', 'Your role, field, or what you are studying. One line is enough.', 'e.g. TikTok Creator Manager at a creator marketing agency') +
      fieldQ('Now · 2', 'What do people already associate with you at work?', 'Pick what colleagues or clients would say today, not what you hope they would say.', chips('career.nowKnownFor', ATTRIBUTES)) +
      fieldQ('Now · 3', 'What proof of your work exists today?', 'Anything that exists, even if it is messy or unpublished.', chips('career.evidence', EVIDENCE)) +
      fieldQ('Now · 4', 'Where have you done good work but have little proof?', 'These become your portfolio gaps.', chips('career.underDocumented', EVIDENCE, 'dark')) +
      (has('networking') ? textField('career.nowIntro', 'Now · 5 — How do you introduce yourself today?', 'The words you actually use at events or in messages.', '', 2) : '') +
      '</div>';
    var goal = '<div class="mx-qs">' +
      textField('career.targetRole', 'Goal · 1 — What role or direction are you aiming for next?', 'Name it as specifically as you can, even if it is a few years away.', 'e.g. Digital policy analyst in government') +
      fieldQ('Goal · 2', 'What do you want to be known for?', 'Three to five traits give a clear signal. More than that tends to blur it.', chips('career.attributes', ATTRIBUTES) +
        '<p class="hint" id="attr-count" aria-live="polite">' + attrCountText() + '</p>') +
      textField('career.otherAttribute', 'Another trait not in the list (optional)', null, 'e.g. Culturally fluent') +
      (has('networking') ?
        fieldQ('Goal · 3', 'After one conversation, what should people understand about you?', 'For events, coffee chats and introductions.', chips('career.networkingLead', NETWORK_LEAD)) +
        textField('career.networkingLine', 'Goal · 4 — How do you want to introduce yourself?', 'How you would say it out loud. Plain words beat titles.', 'I run creator programs for restaurant brands, and I’m moving toward digital policy.', 2) : '') +
      '</div>';
    return h + part('now', 'Your work and proof <em>today</em>', null, now) + part('goal', 'Where you are <em>heading</em>', null, goal) +
      notesBox('notes.career', 'Anything about your career you want to remember? For example, people to ask for references, or a project you want to be known for.');
  }
  function attrCountText() {
    var n = state.career.attributes.length;
    if (!n) return 'None selected yet.';
    if (n > 5) return n + ' selected. Consider trimming to the five you most want repeated about you.';
    return n + ' selected.';
  }

  /* ---------- Step: Portfolio ---------- */
  function viewPortfolio() {
    var p = state.portfolio;
    var h = intro('A portfolio is the proof people can see: results, samples, case studies.',
        'What you have done and what you want to be hired for are often different. A portfolio should lean toward the second.',
        'First pick your current areas of work and check what proof you have for each. Then say which work you want more of.');
    h += part('now', 'Your work and proof <em>today</em>', null, '<div class="mx-qs">' +
      textField('portfolio.currentWork', 'Now · 1 — What kind of work do you mostly do now?', 'Describe a normal week in one or two sentences.', 'Recruiting creators, running campaigns, tracking performance.', 2) +
      fieldQ('Now · 2', 'Which of these are part of your work today?', 'Pick the areas you could say something about. You will check each one below.',
        '<div class="folders sm" role="group" aria-label="Areas of work">' +
        PORTFOLIO_AREAS.map(function (a, i) { return folderToggle('portfolio.areas', a[0], a[1], '', p.areas.indexOf(a[0]) > -1, i % 4 === 1 || i % 4 === 2); }).join('') + '</div>') +
      '<div id="pf-audit">' + portfolioAudit() + '</div></div>');
    h += part('goal', 'The work you want <em>more of</em>', null, '<div class="mx-qs"><div id="pf-goal">' + portfolioGoal() + '</div>' +
      textField('portfolio.hiredForNote', 'Goal · 2 — In one sentence, what do you want to be hired for next?', null, 'Running creator programs end to end, from recruitment to reporting.', 2) + '</div>');
    return h + notesBox('notes.portfolio', 'Anything about your portfolio you want to remember? For example, files to find, or permission you need before showing client work.');
  }
  function portfolioAudit() {
    var p = state.portfolio;
    if (!p.areas.length) return '<p class="hint">Select at least one area above to check your proof for it.</p>';
    var h = '<p class="q-title"><span class="q-num">Now · 3</span>What proof do you have in each area?</p><p class="hint">“Partly” is a fine answer. Confidential work can still be shown as an anonymised outcome.</p>';
    p.areas.forEach(function (aid) {
      h += '<div class="section"><div class="group-title">' + esc(labelOf(PORTFOLIO_AREAS, aid)) + '</div><div class="rows">';
      PORTFOLIO_QS.slice(0, 5).forEach(function (q) {
        var lid = fid('pf-' + aid + '-' + q[0]);
        h += '<div class="row"><div class="row-label" id="' + lid + '">' + esc(q[1]) + '</div><div class="row-body" role="radiogroup" aria-labelledby="' + lid + '">' +
          seg('portfolio.answers.' + aid + '.' + q[0], TRI, 'seg-3') + '</div></div>';
      });
      h += '</div></div>';
    });
    return h;
  }
  function portfolioGoal() {
    var p = state.portfolio;
    if (!p.areas.length) return '<p class="hint">Pick your areas of work above; they will appear here.</p>';
    return '<p class="q-title"><span class="q-num">Goal · 1</span>Do you want more of this work?</p><div class="rows">' + p.areas.map(function (aid) {
      var lid = fid('pfg-' + aid);
      return '<div class="row"><div class="row-label" id="' + lid + '">' + esc(labelOf(PORTFOLIO_AREAS, aid)) + '</div><div class="row-body" role="radiogroup" aria-labelledby="' + lid + '">' +
        seg('portfolio.answers.' + aid + '.wantMore', TRI, 'seg-3') + '</div></div>';
    }).join('') + '</div>';
  }

  /* ---------- Step: Documentation ---------- */
  function viewDocument() {
    var body = '<p class="hint">For each item: <strong>Now</strong> is whether you keep a record today. <strong>Goal</strong> is what you want to do with it from here. Leave the goal empty if you do not want to track it.</p><div class="rows">';
    DOC_ITEMS.forEach(function (it) {
      var path = 'documentation.' + it[0];
      var lid = fid('doc-' + it[0]);
      body += '<div class="row"><div class="row-label" id="' + lid + '">' + esc(it[1]) + '</div><div class="row-body">' +
        '<div class="dual">' + selectBind('documentationNow.' + it[0], DOC_NOW, subLabel('now')) + '</div>' +
        '<div class="sub" role="radiogroup" aria-labelledby="' + lid + '">' + subLabel('goal') + seg(path, DOC_CHOICES) + '</div>' +
        (getPath(path) ? '<button type="button" class="linkbtn" data-action="clear" data-path="' + path + '">Not tracking this</button>' : '') + '</div></div>';
    });
    body += '</div>';
    return '<p class="statement"><em>Documentation</em> and publication are separate decisions.</p>' +
      intro('Documenting means keeping a record for yourself: notes, screenshots, numbers, photos, journals.',
        'Records you keep now become evidence later, when you decide to share. <strong>You can document something without publishing it.</strong>',
        'For each item, say whether you track it today, then what you want to do with it.') +
      part('both', 'What to <em>keep a record of</em>', null, body) +
      notesBox('notes.document', 'Anything about documenting you want to remember? For example, where you will keep records, or a habit you want to start.');
  }

  /* ---------- Step: Boundaries ---------- */
  function viewBoundaries() {
    return intro('Boundaries are the things you never want publicly accessible, whatever else you decide.',
        'This list follows you to your results and overrides every other recommendation. <strong>Some things are yours by default.</strong>',
        'First tick anything that is already public today in a way you would like to change. Then mark what should never be public.') +
      part('now', 'Is any of this <em>already out there?</em>', 'Tick anything that is public today (an old post, a tagged photo, a profile field) that you would like to change.',
        chips('boundaries.exposedNow', BOUNDARIES)) +
      part('goal', 'What should <em>never</em> be public?', null,
        '<div class="mx-qs">' + chips('boundaries.never', BOUNDARIES, 'dark') +
        '<div class="field"><label for="b-other">Anything else?</label><p class="hint">Separate items with commas.</p>' +
        '<input class="input" id="b-other" maxlength="400" data-bind-text="boundaries.other" value="' + esc(state.boundaries.other) + '" placeholder="e.g. My siblings’ names, my salary history"></div>' +
        '<div class="section" aria-live="polite"><div class="group-title">Your boundary list</div><div id="boundary-preview">' + boundaryPreview() + '</div></div></div>') +
      notesBox('notes.boundaries', 'Anything about your boundaries you want to remember? For example, who to ask to remove a photo, or settings to change.');
  }
  function boundaryItems() {
    var items = state.boundaries.never.map(function (b) { return labelOf(BOUNDARIES, b); });
    (state.boundaries.other || '').split(',').forEach(function (x) { x = x.trim(); if (x) items.push(x); });
    return items;
  }
  function cleanupItems() {
    return state.boundaries.exposedNow.filter(function (b) { return state.boundaries.never.indexOf(b) > -1; }).map(function (b) { return labelOf(BOUNDARIES, b); });
  }
  function boundaryPreview() {
    var items = boundaryItems();
    var clean = cleanupItems();
    var h = items.length ? '<ul class="boundary-list">' + items.map(function (b) { return '<li>' + tag('private') + esc(b) + '</li>'; }).join('') + '</ul>' : '<p class="hint">Nothing marked yet.</p>';
    if (clean.length) h += '<p class="note">' + tag('public') + '<span><strong>To clean up:</strong> ' + esc(list(clean)) + ' ' + (clean.length > 1 ? 'are' : 'is') + ' public today but on your never-public list.</span></p>';
    return h;
  }

  /* ---------- Step: Future self ---------- */
  function viewFuture() {
    var cats = selectedCats();
    var h = intro('Your future self is who you want people to recognise you as in one to three years.',
        'What you document and show today can quietly build toward that, or pull against it.',
        'First describe how people see you today. Then describe who you are becoming, and sort each part of your life against it.');
    h += part('now', 'How people see you <em>today</em>', null,
      textField('future.currentIdentity', 'Now · 1 — How would people describe you today?', 'One or two sentences, in the words someone who knows you might use.', 'Someone who runs creator campaigns and knows the Jakarta food scene.', 3));
    var roles = !cats.length ? '<p class="hint">Pick identity areas first to sort them here.</p>' :
      '<div class="rows">' + cats.map(function (c) {
        var lid = fid('fut-' + c.id);
        return '<div class="row"><div class="row-label" id="' + lid + '">' + esc(c.label) + '</div><div class="row-body" role="radiogroup" aria-labelledby="' + lid + '">' + seg('future.roles.' + c.id, FUTURE_ROLES) + '</div></div>';
      }).join('') + '</div>';
    h += part('goal', 'Who you are <em>becoming</em>', null, '<div class="mx-qs">' +
      textField('future.identity', 'Goal · 1 — Who do you want people to recognise you as, one to three years from now?', 'Write it the way you would want someone to introduce you.', 'A digital policy practitioner who understands how creators and platforms actually work.', 3) +
      fieldQ('Goal · 2', 'How does each part of your life fit that goal?', 'Supports it: show it in that direction. Reveal later: hold it for a later stage. Irrelevant: no need to show. Keep private: stays yours.' + (has('future') ? ' “Reveal later” is how timing enters your strategy.' : ''), roles) +
      textField('future.evidenceNeeded', 'Goal · 3 — What evidence do you need to start collecting now?', null, 'Policy writing samples, a record of programs I have run, references from people in government.', 3) +
      fieldQ('Goal · 4', 'What should you start documenting now, even if you are not ready to publish it?', null, chips('future.startDocumenting', DOC_ITEMS) +
        '<div class="field"><label for="fut-doc" class="sr">Anything else to document</label><input class="input" id="fut-doc" maxlength="200" data-bind-text="future.documentingNote" value="' + esc(state.future.documentingNote) + '" placeholder="Anything else to document"></div>') +
      '</div>');
    h += notesBox('notes.future', 'Anything about your future self you want to remember? For example, people whose path you admire, or a first step you could take this month.');
    h += submitPanel('step');
    return h;
  }

  /* ------------------------------------------------------------------------
     8. SCORING MODEL
     Deterministic. Every recommendation carries the numbers behind it.
     ------------------------------------------------------------------------ */

  function num(v) { if (v === 'ns') return 3; return typeof v === 'number' ? v : null; }
  function mean(arr) { arr = arr.filter(function (x) { return typeof x === 'number' && !isNaN(x); }); return arr.length ? arr.reduce(function (a, b) { return a + b; }, 0) / arr.length : null; }
  function weighted(parts) {
    var tw = 0, sum = 0;
    parts.forEach(function (p) { if (p && typeof p[0] === 'number' && !isNaN(p[0])) { tw += p[1]; sum += p[0] * p[1]; } });
    return tw ? clamp(Math.round((sum / tw) * 100), 0, 100) : null;
  }

  function boundaryCats() {
    var out = {};
    state.boundaries.never.forEach(function (b) { (BOUNDARY_TO_CATS[b] || []).forEach(function (c) { out[c] = labelOf(BOUNDARIES, b); }); });
    return out;
  }

  var SOCIAL_LEVEL_MAP = { private: 'private', close: 'selective', selective: 'selective', followers: 'public', public: 'public', strategic: 'strategic' };

  function evaluateCategory(cat, bmap) {
    var a = state.matrix[cat.id] || {};
    var C = num(a.comfort), U = num(a.useful), K = num(a.control), F = num(a.future), V = num(a.value);
    var N = typeof a.now === 'number' ? a.now : null, G = typeof a.goal === 'number' ? a.goal : null;
    var rated = C != null || U != null;
    var unsure = ['comfort', 'useful', 'control', 'value'].filter(function (k) { return a[k] === 'ns'; }).length;
    var c = C == null ? 3 : C, u0 = U == null ? 3 : U, k = K == null ? 3 : K, f = F == null ? 3 : F, v = V == null ? 3 : V;
    var role = state.future.roles[cat.id] || '';
    var u = clamp(u0 + (role === 'supports' ? 1 : 0) - (role === 'irrelevant' ? 1 : 0), 1, 5);
    var access = a.access || [];
    var broad = access.some(function (x) { return x === 'everyone' || x === 'followers'; });
    var pro = access.some(function (x) { return ['everyone', 'professional', 'recruiters', 'clients'].indexOf(x) > -1; });
    var circle = access.some(function (x) { return ['everyone', 'friends', 'closefriends', 'family'].indexOf(x) > -1; });
    var nobody = access.length === 1 && access[0] === 'nobody';
    var boundary = bmap[cat.id] || '';
    var wantHidden = G === 1;
    var forced = role === 'private' || !!boundary || nobody || wantHidden;
    var later = role === 'later';

    var verdict, why;
    if (!rated) { verdict = 'unrated'; why = 'Not rated yet.'; }
    else if (forced) {
      verdict = v >= 4 ? 'document' : 'private';
      why = role === 'private' ? 'You chose to keep this private in your future plan.' :
        boundary ? 'It falls behind your boundary on ' + boundary.toLowerCase() + '.' : wantHidden ? 'Your goal is that nobody knows about this.' : 'You said nobody should have access.';
      if (verdict === 'document') why += ' It still matters to you, so keep a record.';
    }
    else if (u >= 4 && c >= 4 && k >= 3 && f >= 3) { verdict = 'show'; why = 'Useful, comfortable to share, and you control how it is read.'; }
    else if (u >= 4 && c >= 4) { verdict = 'selective'; why = k < 3 ? 'Useful, but how it is read is hard to control. Choose the room.' : 'Useful now, but you are unsure it will age well. Keep it audience-controlled.'; }
    else if (u >= 4 && c <= 2) { verdict = v >= 3 ? 'document' : 'selective'; why = 'Strategically useful, but outside your comfort. ' + (v >= 3 ? 'Keep the record now; decide on release later.' : 'Share only with people you choose.'); }
    else if (u >= 3 && c >= 2) { verdict = 'selective'; why = c <= 3 ? 'Useful, but beyond your comfort for wide release. Share with chosen audiences.' : 'Moderately useful. Share where it adds context.'; }
    else if (v >= 4) { verdict = 'document'; why = 'Low public payoff, high personal value. Worth keeping a record of.'; }
    else if (c >= 4) { verdict = 'selective'; why = 'Little strategic weight. Share where it comes up naturally, mostly with people you know.'; }
    else { verdict = 'private'; why = 'Little strategic benefit, and outside your comfort boundary.'; }

    if (G === 2 && verdict === 'show') { verdict = 'selective'; why = 'Useful and comfortable, but your goal is that only a few close people know. Share it with them.'; }
    if (later && verdict === 'show') { verdict = 'selective'; why = 'Strong enough to show, but you chose to reveal it later. Hold it for selected audiences for now.'; }

    // --- Map cells ---
    var cells = {};
    var isPro = hasTag(cat, 'pro'), canProve = hasTag(cat, 'prove');
    if (!rated) {
      cells = { irl: 'na', social: 'na', career: 'na', portfolio: 'na', friends: 'na', private: v >= 3 && V != null ? 'document' : 'na' };
    } else {
      // Private column
      cells.private = (v >= 3 || verdict === 'document') ? 'document' : 'private';
      // Friends
      if (forced && !circle) cells.friends = 'private';
      else if (access.length && !circle) cells.friends = c >= 4 ? 'selective' : 'private';
      else cells.friends = c >= 4 ? 'public' : (c >= 2 ? 'selective' : 'private');
      // IRL
      var irl = state.irl;
      var base = c;
      if (cat.id === 'financial' && num(irl.finance) != null) base = num(irl.finance);
      if ((cat.id === 'career' || cat.id === 'skills') && num(irl.career) != null) base = Math.round((c + num(irl.career)) / 2);
      if ((cat.id === 'ambitions' || cat.id === 'futuregoals') && num(irl.ambitions) != null) base = Math.round((c + num(irl.ambitions)) / 2);
      var ir = base >= 4 ? 'public' : (base >= 3 ? 'selective' : 'private');
      if (ir === 'public' && num(irl.mystery) >= 4 && !isPro) ir = 'selective';
      if (ir === 'public' && cat.id === 'achievements' && num(irl.gradual) >= 4) ir = 'selective';
      if (forced) ir = boundary || nobody ? 'private' : (ir === 'public' ? 'selective' : ir);
      cells.irl = ir;
      // Career column
      var cr;
      if (!isPro && u < 4) cr = 'na';
      else if (forced) cr = 'private';
      else if (access.length && !pro) cr = u >= 4 ? 'selective' : 'private';
      else cr = (u >= 4 && c >= 3) ? 'public' : (u >= 3 ? 'strategic' : 'selective');
      cells.career = cr;
      // Portfolio column
      var pf;
      if (!canProve) pf = 'na';
      else if (forced) pf = verdict === 'document' ? 'document' : 'private';
      else pf = { show: k >= 4 ? 'public' : 'strategic', selective: 'selective', document: 'document', private: 'private' }[verdict];
      cells.portfolio = pf;
      // Social column (explicit social answers win)
      var so;
      var socialKey = null;
      Object.keys(SOCIAL_TO_CAT).forEach(function (s) { if (SOCIAL_TO_CAT[s] === cat.id && state.social.items[s] && state.social.items[s].level) socialKey = s; });
      if (socialKey) so = SOCIAL_LEVEL_MAP[state.social.items[socialKey].level];
      else if (forced) so = verdict === 'document' ? 'document' : 'private';
      else so = { show: broad && c >= 5 ? 'public' : 'strategic', selective: 'selective', document: 'document', private: 'private' }[verdict];
      if (boundary && (so === 'public' || so === 'strategic')) so = 'private';
      cells.social = so;
      if (later) ['social', 'career', 'portfolio'].forEach(function (col) { if (cells[col] === 'public' || cells[col] === 'strategic') cells[col] = 'selective'; });
    }
    return {
      id: cat.id, label: cat.label, cat: cat, rated: rated, unsure: unsure, C: C, U: U, K: K, F: F, V: V, N: N, G: G,
      c: c, u: u, k: k, f: f, v: v, access: access, role: role, later: later, forced: forced, boundary: boundary,
      verdict: verdict, why: why, cells: cells, broad: broad, pro: pro, circle: circle
    };
  }

  function scoreLine(e) {
    if (!e.rated) return 'Not rated';
    function s(x) { return x == null ? '–' : x; }
    return 'Comfort ' + s(e.C) + ' · Useful ' + s(e.U) + ' · Control ' + s(e.K) + ' · Durable ' + s(e.F) + ' · Personal value ' + s(e.V);
  }

  function computeDimensions(evals) {
    var R = evals.filter(function (e) { return e.rated; });
    var socialLevels = Object.keys(state.social.items).map(function (k) { return state.social.items[k].level; }).filter(Boolean);
    var socialScore = { private: 0, close: 1, selective: 2, followers: 3, strategic: 3, public: 4 };
    var socialMean = socialLevels.length ? mean(socialLevels.map(function (l) { return socialScore[l] / 4; })) : null;
    var privShare = socialLevels.length ? socialLevels.filter(function (l) { return l === 'private' || l === 'close'; }).length / socialLevels.length : null;
    var bCount = boundaryItems().length;
    var irlM = num(state.irl.mystery);
    var docVals = Object.keys(state.documentation).map(function (k) { return state.documentation[k]; }).filter(Boolean);
    var proCats = R.filter(function (e) { return hasTag(e.cat, 'pro'); });
    var dims = {};

    dims.privacy = {
      name: 'Privacy preference', sub: 'Preference for controlled, private visibility',
      value: weighted([
        [R.length ? mean(R.map(function (e) { return (5 - e.c) / 4; })) : null, 0.45],
        [bCount ? Math.min(bCount, 8) / 8 : (hasAnswers() && state.visited.boundaries ? 0 : null), 0.2],
        [irlM != null ? (irlM - 1) / 4 : null, 0.15],
        [privShare, 0.2]
      ]),
      basis: 'Average discomfort across rated areas (45%), number of boundaries (20%), preferred mystery in real life (15%), share of social signals kept private or close-friends-only (20%).'
    };
    dims.strategic = {
      name: 'Strategic visibility', sub: 'Benefit from intentionally showing specific things',
      value: weighted([
        [R.length ? mean(R.map(function (e) { return ((e.u - 1) / 4) * (0.6 + 0.4 * (e.k - 1) / 4); })) : null, 0.6],
        [R.length ? R.filter(function (e) { return e.verdict === 'show' || e.verdict === 'selective'; }).length / R.length : null, 0.25],
        [socialLevels.length ? socialLevels.filter(function (l) { return l === 'strategic'; }).length / socialLevels.length : null, 0.15]
      ]),
      basis: 'Usefulness weighted by how much control you have over perception (60%), share of areas worth showing or sharing selectively (25%), share of social signals marked strategic (15%).'
    };
    dims.professional = {
      name: 'Professional visibility', sub: 'How much career information should surface',
      value: weighted([
        [proCats.length ? mean(proCats.map(function (e) { return (e.u + e.c - 2) / 8; })) : null, 0.45],
        [(has('career') || has('portfolio') || has('networking')) ? Math.min(state.career.attributes.length, 5) / 5 : null, 0.2],
        [(has('career') || has('portfolio')) ? Math.min(state.career.evidence.length, 6) / 6 : null, 0.2],
        [state.contexts.length ? ['career', 'portfolio', 'networking'].filter(has).length / 3 : null, 0.15]
      ]),
      basis: 'Usefulness plus comfort for work-related areas (45%), clarity of what you want to be known for (20%), evidence you already have (20%), how many professional contexts you chose (15%).'
    };
    var faceName = ['face', 'name'].map(function (k) { return state.social.items[k] && state.social.items[k].level; }).filter(Boolean);
    dims.social = {
      name: 'Social visibility', sub: 'Comfort with being publicly recognisable',
      value: weighted([
        [socialMean, 0.4],
        [faceName.length ? mean(faceName.map(function (l) { return socialScore[l] / 4; })) : null, 0.2],
        [R.length ? mean(R.map(function (e) { return (e.c - 1) / 4; })) : null, 0.25],
        [irlM != null ? (5 - irlM) / 4 : null, 0.15]
      ]),
      basis: 'Average level across social signals (40%), face and name visibility (20%), average comfort across rated areas (25%), openness in real life (15%).'
    };
    dims.documentation = {
      name: 'Documentation need', sub: 'Value of private records for your goals',
      value: weighted([
        [R.some(function (e) { return e.V != null; }) ? mean(R.filter(function (e) { return e.V != null; }).map(function (e) { return (e.v - 1) / 4; })) : null, 0.35],
        [docVals.length || state.visited.document ? Math.min(docVals.length, 8) / 8 : null, 0.25],
        [docVals.length ? docVals.filter(function (d) { return d === 'private' || d === 'later'; }).length / docVals.length : null, 0.15],
        [(has('career') || has('portfolio')) ? Math.min(state.career.underDocumented.length, 5) / 5 : null, 0.1],
        [state.visited.future || state.future.startDocumenting.length ? Math.min(state.future.startDocumenting.length, 5) / 5 : null, 0.15]
      ]),
      basis: 'How much rated areas are worth recording (35%), how many things you want to track (25%), share tracked privately or undecided (15%), under-documented work (10%), things to start documenting for your future identity (15%).'
    };
    var accessSets = R.filter(function (e) { return e.access.length; }).map(function (e) { return e.access.slice().sort().join('|'); });
    var distinct = accessSets.filter(function (x, i, a) { return a.indexOf(x) === i; }).length;
    dims.audience = {
      name: 'Audience control', sub: 'Giving different audiences different information',
      value: weighted([
        [accessSets.length ? accessSets.filter(function (s) { return s.indexOf('everyone') === -1; }).length / accessSets.length : null, 0.35],
        [accessSets.length > 1 ? (distinct - 1) / (accessSets.length - 1) : null, 0.25],
        [R.length ? R.filter(function (e) { return e.verdict === 'selective'; }).length / R.length : null, 0.2],
        [socialLevels.length ? socialLevels.filter(function (l) { return l === 'selective' || l === 'close' || l === 'strategic'; }).length / socialLevels.length : null, 0.2]
      ]),
      basis: 'Share of areas not open to everyone (35%), how varied your audience choices are across areas (25%), share of areas recommended for selective sharing (20%), social signals set to selective, close friends or strategic (20%).'
    };
    var roles = Object.keys(state.future.roles).map(function (k) { return state.future.roles[k]; });
    dims.future = {
      name: 'Future-building', sub: 'How much today’s records should serve a future identity',
      value: weighted([
        [state.future.identity.trim() ? 1 : (state.visited.future ? 0 : null), 0.25],
        [roles.length ? Math.min(roles.filter(function (r) { return r === 'supports' || r === 'later'; }).length, 5) / 5 : null, 0.2],
        [state.future.evidenceNeeded.trim() ? 1 : (state.visited.future ? 0 : null), 0.15],
        [state.visited.future || state.future.startDocumenting.length ? Math.min(state.future.startDocumenting.length, 4) / 4 : null, 0.15],
        [R.length ? mean(R.map(function (e) { return (e.f - 1) / 4; })) : null, 0.1],
        [num(state.irl.association) != null ? (num(state.irl.association) - 1) / 4 : null, 0.05],
        [state.contexts.length ? (has('future') ? 1 : 0) : null, 0.1]
      ]),
      basis: 'A written future identity (25%), areas that support it or will be revealed later (20%), evidence you plan to collect (15%), things to start documenting (15%), durability of what you rated (10%), wanting your present tied to your ambitions (5%), choosing Future persona as a context (10%).'
    };
    return dims;
  }

  var DIM_READ = {
    privacy: ['You are relaxed about being known; privacy is situational rather than a default.', 'You keep some areas private and open others. Privacy is a tool you use, not a wall.', 'You lean toward controlled, private visibility. That is a coherent strategy, and it shapes everything below.'],
    strategic: ['Few areas carry strategic weight right now. Visibility is mostly personal for you.', 'Several areas would help your goals if shown in the right room.', 'Much of what you rated helps your goals when you control how it is shown.'],
    professional: ['Your professional side needs little surfacing at this stage.', 'Some career information is worth surfacing, in specific places.', 'Career information is a central part of what you should make visible.'],
    social: ['You prefer not to be publicly recognisable. Your strategy should not depend on a public persona.', 'You are comfortable being recognisable in some places and not others.', 'You are comfortable being publicly recognisable. Your face and name can carry your work.'],
    documentation: ['Private records play a small role in your goals.', 'Keeping records would help, especially for areas you are not ready to publish.', 'Private documentation is a major lever for you: record now, decide on publishing later.'],
    audience: ['You tend to give most audiences the same view.', 'You give different audiences somewhat different views.', 'You deliberately give different audiences different versions of your story.'],
    future: ['Your strategy is mostly about the present.', 'Your present choices partly serve a future identity.', 'Much of what you document now should serve who you are becoming.']
  };
  function band(v) { return v == null ? -1 : v < 34 ? 0 : v < 67 ? 1 : 2; }

  // Returns every pattern that fits, strongest first. [0] is the primary strategy, [1] the secondary.
  function computePatterns(d) {
    var P = d.privacy.value, S = d.strategic.value, D = d.documentation.value, A = d.audience.value,
      Pr = d.professional.value, So = d.social.value, Fu = d.future.value;
    var z = function (x) { return x == null ? 50 : x; };
    if ([P, S, D, A, Pr, So, Fu].every(function (x) { return x == null; })) return [];
    var out = [];
    P = z(P); S = z(S); D = z(D); A = z(A); Pr = z(Pr); So = z(So); Fu = z(Fu);
    if ((A >= 55 || P >= 55) && S >= 45) out.push({
      key: 'controlled', title: 'controlled visibility',
      body: 'You appear to benefit from making selected parts of your identity visible while keeping other areas intentionally private.',
      means: 'Your visibility works best as a set of deliberate openings rather than a single public persona. Decide the room first, then the content.'
    });
    if (S >= 55 && P < 45) out.push({
      key: 'open', title: 'open, strategic visibility',
      body: 'You are comfortable being seen, and much of what you rated would help your goals if shown.',
      means: 'Visibility is an asset you can use actively. The main risk is dilution, so tie what you show to a few clear pillars.'
    });
    if (D >= 55 && S < 50) out.push({
      key: 'document', title: 'document first, publish later',
      body: 'A lot of what matters to you is worth recording, and less of it needs to be public right now.',
      means: 'Build the archive before the audience. When you are ready to publish, you will have evidence instead of starting from zero.'
    });
    if (P >= 60) out.push({
      key: 'private', title: 'private by design',
      body: 'You keep most of your life to yourself, and your answers show that is a considered choice.',
      means: 'Your visibility can be narrow and precise: a small number of things, shown to specific people, with everything else left alone.'
    });
    if (Pr - So >= 18) out.push({
      key: 'pro', title: 'professional-first visibility',
      body: 'Your work is where visibility pays off; your personal life does not need to carry your brand.',
      means: 'Put your effort into career and portfolio surfaces. Personal channels can stay personal.'
    });
    if (So - Pr >= 18) out.push({
      key: 'personal', title: 'personal-first visibility',
      body: 'You are more comfortable being known as a person than being marketed as a professional.',
      means: 'Your taste, perspective and everyday life are your visible layer. Work can surface through them, selectively.'
    });
    if (Fu >= 60) out.push({
      key: 'future', title: 'future-facing visibility',
      body: 'Much of your strategy points at who you are becoming rather than who you are today.',
      means: 'Collect evidence now, reveal it in stages, and let your public identity catch up with your plans on your schedule.'
    });
    if (!out.length) out.push({
      key: 'balanced', title: 'balanced, situational visibility',
      body: 'No single pattern dominates. You adjust what you show to the situation.',
      means: 'Your map below matters more than any headline. Use it room by room.'
    });
    return out;
  }
  function computePattern(d) { return computePatterns(d)[0] || null; }

  var ARCHETYPES = [
    { id: 'craft', cats: ['career', 'skills', 'achievements', 'projects'], name: 'Professional craft', evidence: ['Case studies', 'Metrics with baselines', 'Testimonials'], channels: ['career', 'portfolio', 'networking'] },
    { id: 'venture', cats: ['sidehustles', 'entrepreneurship'], name: 'Builder / <em>founder</em>', evidence: ['Revenue or growth milestones', 'Customer feedback', 'Launch timelines'], channels: ['career', 'social', 'networking'] },
    { id: 'creative', cats: ['creative', 'artistic', 'content', 'fashion'], name: 'Creative <em>practice</em>', evidence: ['Selected works', 'Process notes and drafts', 'Audience response'], channels: ['portfolio', 'social'] },
    { id: 'ideas', cats: ['education', 'intellectual', 'growth'], name: 'Learning &amp; <em>ideas</em>', evidence: ['Reading notes', 'Essays or long posts', 'Certificates and coursework'], channels: ['career', 'social', 'networking'] },
    { id: 'values', cats: ['values', 'opinions', 'beliefs'], name: 'Point of <em>view</em>', evidence: ['Written positions', 'Talks or panels', 'Consistent public comments'], channels: ['social', 'networking', 'career'] },
    { id: 'taste', cats: ['food', 'travel', 'fitness', 'lifestyle', 'music', 'film', 'hobbies'], name: 'Taste &amp; <em>everyday life</em>', evidence: ['Curated photos', 'Recommendations lists', 'Recurring formats'], channels: ['social', 'friends', 'irl'] },
    { id: 'direction', cats: ['ambitions', 'futuregoals'], name: 'Where you are <em>headed</em>', evidence: ['Milestones toward the goal', 'Applications and outcomes', 'Mentors and references'], channels: ['networking', 'career', 'future'] }
  ];
  var CRAFT_NAMES = [
    { attrs: ['strategic', 'analytical', 'problem'], name: 'Strategy &amp; <em>problem solving</em>' },
    { attrs: ['creative', 'innovative', 'creator'], name: 'Creative <em>execution</em>' },
    { attrs: ['builder', 'organizer', 'reliable', 'adaptable'], name: 'Builder / <em>operator</em>' },
    { attrs: ['leadership', 'communicator'], name: 'Leadership &amp; <em>communication</em>' },
    { attrs: ['specialist', 'expert', 'experienced'], name: 'Specialist <em>expertise</em>' },
    { attrs: ['entrepreneurial', 'ambitious'], name: 'Entrepreneurial <em>drive</em>' },
    { attrs: ['generalist'], name: 'Versatile <em>generalist</em>' }
  ];
  var CHANNEL_LABEL = {
    career: 'Professional profile (e.g. LinkedIn), CV', portfolio: 'Portfolio', networking: 'Networking conversations',
    social: 'Social media', friends: 'Friends and social circle', irl: 'Real-life conversations', future: 'Held for a future stage', private: 'Private archive'
  };

  function computePillars(evals) {
    var byId = {};
    evals.forEach(function (e) { byId[e.id] = e; });
    var attrs = state.career.attributes;
    var W = { show: 3, selective: 2, document: 0.5, private: 0, unrated: 0.5 };
    var pillars = [];

    ARCHETYPES.forEach(function (a) {
      var members = a.cats.filter(function (c) { return byId[c]; }).map(function (c) { return byId[c]; });
      if (a.id === 'craft') {
        state.custom.filter(function (c) { return c.work; }).forEach(function (c) { if (byId[c.id]) members.push(byId[c.id]); });
      }
      if (!members.length) return;
      var score = 0, qualifies = false;
      members.forEach(function (m) {
        score += W[m.verdict] * (m.u / 5);
        if (m.verdict === 'show' || m.verdict === 'selective' || m.role === 'supports' || m.role === 'later') qualifies = true;
        if (m.role === 'supports') score += 1.5;
      });
      var name = a.name, matched = [];
      if (a.id === 'craft') {
        var best = null, bestN = 0;
        CRAFT_NAMES.forEach(function (cn) {
          var n = cn.attrs.filter(function (x) { return attrs.indexOf(x) > -1; }).length;
          if (n > bestN) { best = cn; bestN = n; }
        });
        if (best) { name = best.name; matched = best.attrs.filter(function (x) { return attrs.indexOf(x) > -1; }).map(function (x) { return labelOf(ATTRIBUTES, x); }); score += bestN; }
        else name = 'Professional <em>craft</em>';
      }
      if (a.id === 'creative' && (attrs.indexOf('creative') > -1 || attrs.indexOf('creator') > -1)) score += 1;
      if (a.id === 'venture' && attrs.indexOf('entrepreneurial') > -1) score += 1;
      if (!qualifies || score < 1.5) return;
      var visible = members.filter(function (m) { return m.verdict !== 'private'; });
      var channels = a.channels.filter(function (ch) { return ch === 'future' ? has('future') : has(ch); });
      if (!channels.length) channels = a.channels.slice(0, 2);
      if (members.some(function (m) { return m.verdict === 'document'; })) channels.push('private');
      pillars.push({
        id: a.id, name: name, score: score,
        represents: list(visible.map(function (m) { return m.label; }).concat(matched)),
        evidence: a.evidence.slice(),
        channels: channels.map(function (ch) { return CHANNEL_LABEL[ch]; }),
        members: members
      });
    });

    // Portfolio: what you want to be hired for
    var hired = state.portfolio.areas.filter(function (aid) { var x = state.portfolio.answers[aid] || {}; return x.wantMore === 'yes'; });
    if (hired.length) {
      var names = hired.map(function (h) { return labelOf(PORTFOLIO_AREAS, h); });
      pillars.push({
        id: 'hired', name: esc(names[0]) + (names[1] ? ' &amp; <em>' + esc(names[1].toLowerCase()) + '</em>' : ''), score: 2.5 + hired.length,
        represents: 'The work you want more of: ' + list(names) + '.',
        evidence: hired.slice(0, 3).map(function (h) { return PROOF_SHORT[h]; }),
        channels: ['portfolio', 'career'].filter(has).map(function (ch) { return CHANNEL_LABEL[ch]; }).concat(has('portfolio') || has('career') ? [] : [CHANNEL_LABEL.career]),
        members: []
      });
    }
    pillars.sort(function (a, b) { return b.score - a.score; });
    return pillars.slice(0, 5);
  }

  function computeModel() {
    var bmap = boundaryCats();
    var evals = selectedCats().map(function (c) { return evaluateCategory(c, bmap); });
    var dims = computeDimensions(evals);
    var patterns = computePatterns(dims);
    var pattern = patterns[0] || null;
    var pillars = computePillars(evals);
    var R = evals.filter(function (e) { return e.rated; });
    var docItems = Object.keys(state.documentation).filter(function (k) { return state.documentation[k]; });
    return {
      evals: evals, rated: R, dims: dims, pattern: pattern, secondary: patterns[1] || null, pillars: pillars,
      show: R.filter(function (e) { return e.verdict === 'show'; }).sort(function (a, b) { return (b.u + b.c) - (a.u + a.c); }),
      selective: R.filter(function (e) { return e.verdict === 'selective'; }).sort(function (a, b) { return b.u - a.u; }),
      document: R.filter(function (e) { return e.verdict === 'document'; }),
      private: R.filter(function (e) { return e.verdict === 'private'; }),
      unrated: evals.filter(function (e) { return !e.rated; }),
      unsure: R.filter(function (e) { return e.unsure > 0; }),
      docItems: docItems,
      boundaries: boundaryItems()
    };
  }

  /* ------------------------------------------------------------------------
     9. RESULTS VIEW
     ------------------------------------------------------------------------ */

  function viewResults() {
    var m = computeModel();
    var anything = m.rated.length || m.docItems.length || m.boundaries.length || state.future.identity.trim() || state.contexts.length;
    if (!anything) {
      return '<div class="empty-state"><h3>Nothing to map yet</h3><p>Your results are built entirely from your answers. Choose a few contexts and identity areas, rate them, and your visibility map appears here.</p>' +
        '<div class="actions"><button type="button" class="btn btn-primary" data-action="go" data-to="contexts">Start with contexts</button>' +
        '<button type="button" class="btn" data-action="open-data">Import saved results</button></div></div>';
    }
    var h = '';
    h += '<header class="print-only"><p class="eyebrow">Visibility Map · Personal strategy document · ' + esc(state.assessmentId) + ' · ' + esc(fmtDate(new Date().toISOString())) + '</p>' +
      (state.exportIncludePrivate ? '' : '<p class="hint">Items you marked private are left out of this printout.</p>') + '</header>';

    // Hero
    h += '<section class="res-hero">';
    if (m.pattern) {
      h += '<p class="eyebrow">Your visibility strategy</p><h2 class="res-pattern">Your strongest pattern is <em>' + esc(m.pattern.title) + '.</em></h2>' +
        '<p class="res-body">' + esc(m.pattern.body) + (m.secondary ? ' Your secondary pattern is ' + esc(m.secondary.title) + '.' : '') + '</p>';
    } else {
      h += '<h2 class="res-pattern">Your map is <em>just starting.</em></h2><p class="res-body">Rate a few identity areas in the visibility matrix to see your pattern.</p>';
    }
    h += submissionNotice();
    h += '<div class="res-meta"><span>ID ' + esc(state.assessmentId) + '</span><span>' + m.rated.length + ' of ' + m.evals.length + ' areas rated</span><span>' + state.contexts.length + ' contexts</span><span>' + m.boundaries.length + ' boundaries</span>' +
      (state.updatedAt ? '<span>Saved ' + esc(fmtDate(state.updatedAt)) + '</span>' : '') + '</div>';
    if (m.unrated.length) h += '<p class="note no-print">' + tag('na') + '<span>' + m.unrated.length + ' area' + (m.unrated.length > 1 ? 's are' : ' is') + ' not rated yet (' + esc(list(m.unrated.slice(0, 4).map(function (e) { return e.label; }))) + (m.unrated.length > 4 ? ', …' : '') + '). <button type="button" class="linkbtn" data-action="go-matrix-unrated">Rate them</button></span></p>';
    if (m.unsure.length) h += '<p class="note">' + tag('selective') + '<span>You marked some answers “not sure” for ' + esc(list(m.unsure.map(function (e) { return e.label; }))) + '. Those were scored as neutral; treat their recommendations as provisional.</span></p>';
    h += '</section>';

    // What this means
    if (m.pattern) {
      h += '<section class="section">' + sectionHead('What this <em>means</em>', esc(m.pattern.means)) + '</section>';
    }

    // Now → goal
    h += fromToSection(m);

    // Buckets
    h += '<section class="section">' + sectionHead('What to show, share, document <em>and keep</em>', 'Neutral, strategic sorting. None of these is better than another.') +
      '<div class="four">' +
      bucket('public', 'Show', 'Useful, controllable, aligned with your goals, and comfortable to reveal.', m.show) +
      bucket('selective', 'Selectively share', 'Useful, but best given to chosen audiences.', m.selective) +
      bucket('document', 'Document privately', 'Worth preserving for yourself, not necessarily publishing.', m.document, docExtras(m)) +
      bucket('private', 'Keep private', 'Little strategic benefit, or beyond your comfort boundary.', m.private, m.boundaries.length ? ['Plus your boundary list below'] : null) +
      '</div></section>';

    // Map
    h += '<section class="section">' + sectionHead('Your visibility <em>map</em>', 'Each area, room by room. Generated from your ratings, audiences, boundaries and timing choices.') +
      '<div class="legend">' + ['public', 'strategic', 'selective', 'private', 'document'].map(function (k) { return '<span>' + tag(LEVELS[k].tag) + LEVELS[k].label + '</span>'; }).join('') +
      '<span>— Not needed</span><span><span class="later">later</span> Reveal later</span></div>' +
      mapTable(m) + '</section>';

    // Credibility vs boundaries
    h += '<section class="section two">' + credibilityCard(m) + boundaryCard(m) + '</section>';

    // Pillars
    h += pillarSection(m);

    // Dimensions
    h += '<section class="section">' + sectionHead('Strategic <em>dimensions</em>', 'Seven readings of your answers. They describe tendencies, not grades, and they are not compared with anyone else.') +
      '<div class="dims">' + Object.keys(m.dims).map(function (k) { return dimRow(k, m.dims[k]); }).join('') + '</div>' +
      '<details class="method"><summary>How these are calculated</summary><ul>' +
      Object.keys(m.dims).map(function (k) { return '<li><strong>' + esc(m.dims[k].name) + ':</strong> ' + esc(m.dims[k].basis) + '</li>'; }).join('') +
      '<li><strong>Area recommendations:</strong> “Show” needs usefulness ≥ 4, comfort ≥ 4, control ≥ 3 and durability ≥ 3. Useful areas outside your comfort or control become “Selectively share”. Low-usefulness areas you value personally (≥ 4) become “Document privately”. Boundaries, “Nobody” access and “Keep private” in your future plan always override. “Supports my future identity” adds one point of usefulness; “Irrelevant” removes one.</li>' +
      '<li>“Not sure” and missing answers count as a neutral 3.</li></ul></details></section>';

    if (has('social')) h += contentSection(m);
    if (has('career') || has('networking')) h += careerSection(m);
    if (state.portfolio.areas.length) h += portfolioSection();
    h += futureSection(m);

    // Boundary list
    h += '<section class="section priv">' + sectionHead('Privacy <em>boundaries</em>', 'Never share publicly. This list overrides every recommendation above.') +
      (m.boundaries.length ? '<ul class="boundary-list">' + m.boundaries.map(function (b) { return '<li>' + tag('private') + esc(b) + '</li>'; }).join('') + '</ul>' :
        '<p class="hint">No boundaries set. <button type="button" class="linkbtn no-print" data-action="go" data-to="boundaries">Add some</button></p>') + '</section>';

    // Seven distinctions filled in
    h += distinctionsSection(m);

    // The visitor's own reflections
    h += '<section class="section">' + notesBox('notes.results', 'Your reflections on these results: what surprised you, what you disagree with, what you will do first.') + '</section>';

    // Submit (optional)
    h += submitSection();

    // Export
    h += '<section class="section no-print" id="export">' + sectionHead('Export my <em>strategy</em>', 'Everything below happens in your browser. Exports are not sent anywhere.') + dataPanel('inline') + '</section>';

    // Final
    h += '<section class="final no-print"><h2>Your life doesn’t need to be public to be <em>real.</em></h2>' +
      '<div class="actions"><button type="button" class="btn btn-primary" data-action="save">Save my strategy</button>' +
      '<button type="button" class="btn" data-action="download-docx">Download Word</button>' +
      '<button type="button" class="btn" data-action="download-xlsx">Download Excel</button>' +
      '<button type="button" class="btn" data-action="start-over">Start over</button>' +
      (FRAMED ? '' : '<button type="button" class="btn" data-action="print">Print results</button>') +
      '<button type="button" class="btn btn-quiet" data-action="go" data-to="dashboard">Open documentation dashboard</button></div>' +
      (FRAMED ? '<p class="hint">Printing is switched off in this preview. It works on your published website.</p>' : '') +
      '<div id="start-over-slot"></div></section>';
    return h;
  }

  function changeLabel(e) {
    if (!e.N || !e.G) return '';
    return e.G > e.N ? 'More visible' : e.G < e.N ? 'Less visible' : 'Keep as is';
  }
  function fromToRows(m, inc) {
    return m.evals.filter(function (e) { return e.N && e.G && (inc || !isPrivateEval(e)); })
      .map(function (e) { return [e.label, VIS_LABELS[e.N - 1], VIS_LABELS[e.G - 1], changeLabel(e)]; });
  }
  function fromToLines() {
    var out = [];
    var nowCtx = CONTEXTS.filter(function (c) { return state.contextsNow[c.id] === 'some' || state.contextsNow[c.id] === 'very'; }).map(function (c) { return c.label; });
    var planCtx = state.contexts.map(function (c) { return (CONTEXTS.filter(function (x) { return x.id === c; })[0] || {}).label; });
    if (nowCtx.length || planCtx.length) out.push(['Rooms', nowCtx.length ? 'Most visible in: ' + list(nowCtx) : '—', planCtx.length ? 'Planning for: ' + list(planCtx) : '—']);
    if (state.social.postNow || state.social.postGoal) out.push(['Posting', state.social.postNow ? labelOf(POST_FREQ, state.social.postNow) : '—', (state.social.postGoal ? labelOf(POST_FREQ, state.social.postGoal) : '—') + (state.social.lowFrequency ? ' (intentional, low-frequency)' : '')]);
    if (state.career.currentRole.trim() || state.career.targetRole.trim()) out.push(['Work', state.career.currentRole.trim() || '—', state.career.targetRole.trim() || '—']);
    if (state.career.nowKnownFor.length || state.career.attributes.length) out.push(['Known for', list(state.career.nowKnownFor.map(function (a) { return labelOf(ATTRIBUTES, a); }), '—'), list(state.career.attributes.map(function (a) { return labelOf(ATTRIBUTES, a); }), '—')]);
    if (state.future.currentIdentity.trim() || state.future.identity.trim()) out.push(['How people see you', state.future.currentIdentity.trim() || '—', state.future.identity.trim() || '—']);
    return out;
  }
  function fromToSection(m) {
    var rows = fromToRows(m, true), lines = fromToLines(), clean = cleanupItems();
    if (!rows.length && !lines.length && !clean.length) return '';
    var byDir = function (d) { return m.evals.filter(function (e) { return changeLabel(e) === d; }); };
    var h = '<section class="section">' + sectionHead('From where you are <em>to where you want to be</em>', 'Your “now” answers next to your “goal” answers. The gap is where the work is.');
    if (lines.length) {
      h += '<div class="card"><dl class="kv fromto">' + lines.map(function (l) { return '<dt>' + esc(l[0]) + '</dt><dd><span class="ft-now">' + tag('selective') + esc(l[1]) + '</span><span class="ft-arrow" aria-hidden="true">→</span><span class="ft-goal">' + tag('public') + esc(l[2]) + '</span></dd>'; }).join('') + '</dl></div>';
    }
    if (rows.length) {
      h += '<div class="three">' +
        [['More visible', 'public', 'Show these more than you do today, starting where you have proof.'], ['Less visible', 'private', 'Pull these back: tighten audiences, archive or remove old posts.'], ['Keep as is', 'selective', 'Where you are is where you want to be.']].map(function (g) {
          var items = byDir(g[0]);
          return '<div class="bucket"><div class="bucket-head">' + tag(g[1]) + '<h3>' + g[0] + '</h3></div><p class="bucket-desc">' + g[2] + '</p><ul>' +
            (items.length ? items.map(function (e) { return '<li' + (isPrivateEval(e) ? ' class="priv"' : '') + '><b>' + esc(e.label) + '</b><small>' + esc(VIS_LABELS[e.N - 1]) + ' → ' + esc(VIS_LABELS[e.G - 1]) + '</small></li>'; }).join('') : '<li class="empty">Nothing here.</li>') + '</ul></div>';
        }).join('') + '</div>';
    }
    if (clean.length) h += '<p class="note priv">' + tag('public') + '<span><strong>To clean up:</strong> ' + esc(list(clean)) + ' ' + (clean.length > 1 ? 'are' : 'is') + ' public today but on your never-public list.</span></p>';
    return h + '</section>';
  }

  function docExtras(m) {
    var extra = m.docItems.filter(function (k) { return state.documentation[k] === 'private' || state.documentation[k] === 'later'; })
      .map(function (k) { return labelOf(DOC_ITEMS, k) + (state.documentation[k] === 'later' ? ' (decide later)' : ''); });
    return extra.length ? extra : null;
  }

  function isPrivateEval(e) { return e.rated && (e.forced || e.verdict === 'private'); }
  function bucket(level, title, desc, items, extras) {
    var h = '<div class="bucket"><div class="bucket-head">' + tag(level) + '<h3>' + esc(title) + '</h3></div><p class="bucket-desc">' + esc(desc) + '</p><ul>';
    if (!items.length && !(extras && extras.length)) h += '<li class="empty">Nothing here from your answers.</li>';
    items.forEach(function (e) {
      h += '<li' + (isPrivateEval(e) ? ' class="priv"' : '') + '><b>' + esc(e.label) + (e.later ? '<span class="later">later</span>' : '') + '</b><small>' + esc(e.why) + '</small></li>';
    });
    if (extras && extras.length) h += '<li><b>Also tracked</b><small>' + esc(list(extras)) + '</small></li>';
    return h + '</ul></div>';
  }

  var MAP_COLS = [['irl', 'IRL'], ['social', 'Social'], ['career', 'Career'], ['portfolio', 'Portfolio'], ['friends', 'Friends'], ['private', 'Private']];
  function mapTable(m) {
    if (!m.evals.length) return '<p class="hint">Pick identity areas to build the map.</p>';
    var rows = m.evals.slice().sort(function (a, b) { return (b.rated - a.rated); });
    var t = '<div class="map-wrap"><table class="map"><caption class="sr">Visibility map by area and context</caption><thead><tr><th scope="col">Area</th>' +
      MAP_COLS.map(function (c) { return '<th scope="col">' + c[1] + '</th>'; }).join('') + '</tr></thead><tbody>';
    rows.forEach(function (e) {
      t += '<tr class="' + (e.rated ? '' : 'unrated') + (isPrivateEval(e) ? ' priv' : '') + '"><th scope="row">' + esc(e.label) + (e.rated ? '' : ' <small>(not rated)</small>') + '</th>' +
        MAP_COLS.map(function (c) { return '<td>' + lvl(e.cells[c[0]], e.later && (c[0] === 'social' || c[0] === 'career' || c[0] === 'portfolio')) + '</td>'; }).join('') + '</tr>';
    });
    t += '</tbody></table></div><div class="map-cards">';
    rows.forEach(function (e) {
      t += '<article class="map-card' + (isPrivateEval(e) ? ' priv' : '') + '"><h4>' + esc(e.label) + (e.rated ? '' : ' <small class="muted">(not rated)</small>') + '</h4><dl>' +
        MAP_COLS.map(function (c) { return '<div><dt>' + c[1] + '</dt><dd>' + lvl(e.cells[c[0]], e.later && (c[0] === 'social' || c[0] === 'career' || c[0] === 'portfolio')) + '</dd></div>'; }).join('') + '</dl></article>';
    });
    return t + '</div>';
  }

  function colSummary(m, col, levels) {
    return m.rated.filter(function (e) { return levels.indexOf(e.cells[col]) > -1; }).map(function (e) { return e.label; });
  }
  function credibilityCard(m) {
    var lines = [];
    var cr = colSummary(m, 'career', ['public', 'strategic']);
    var pf = colSummary(m, 'portfolio', ['public', 'strategic']);
    var so = colSummary(m, 'social', ['public', 'strategic']);
    var ir = colSummary(m, 'irl', ['public']);
    if (cr.length) lines.push('<b>Career profiles:</b> ' + esc(list(cr)));
    if (pf.length) lines.push('<b>Portfolio:</b> ' + esc(list(pf)));
    if (so.length) lines.push('<b>Social media:</b> ' + esc(list(so)));
    if (ir.length) lines.push('<b>In person:</b> ' + esc(list(ir)));
    if (has('networking') && state.career.networkingLead.length) lines.push('<b>Networking:</b> lead with ' + esc(list(state.career.networkingLead.map(function (x) { return lowerFirst(labelOf(NETWORK_LEAD, x)); }))));
    return '<div class="card"><h3><span class="eyebrow">Where to build</span>Public credibility</h3>' +
      (lines.length ? '<ul>' + lines.map(function (l) { return '<li>' + l + '</li>'; }).join('') + '</ul>' : '<p class="muted">Nothing is marked for public or strategic visibility yet. That can be the right answer; it means credibility is built in private rooms first.</p>') + '</div>';
  }
  function boundaryCard(m) {
    var lines = [];
    MAP_COLS.slice(0, 5).forEach(function (c) {
      var p = colSummary(m, c[0], ['private']);
      if (p.length) lines.push('<b>' + c[1] + ':</b> keep ' + esc(list(p)) + ' private');
    });
    var later = m.rated.filter(function (e) { return e.later; }).map(function (e) { return e.label; });
    if (later.length) lines.push('<b>Timing:</b> hold ' + esc(list(later)) + ' until a later stage');
    if (m.boundaries.length) lines.push('<b>Always:</b> ' + esc(list(m.boundaries)));
    return '<div class="card card-dark priv"><h3><span class="eyebrow">Where to maintain</span>Boundaries</h3>' +
      (lines.length ? '<ul>' + lines.map(function (l) { return '<li>' + l + '</li>'; }).join('') + '</ul>' : '<p class="muted">No firm boundaries appear in your answers yet.</p>') + '</div>';
  }

  function pillarSection(m) {
    var h = '<section class="section">' + sectionHead('Personal brand <em>pillars</em>', 'What you could be associated with, drawn from the areas you would show or share, your traits and the work you want more of.');
    if (state.future.identity.trim()) h += '<p class="quote">“' + esc(state.future.identity.trim()) + '”</p>';
    if (!m.pillars.length) return h + '<p class="hint">Not enough rated areas to suggest pillars yet. Rate a few areas as useful and comfortable, or mark some as supporting your future identity.</p></section>';
    h += '<div class="pillars n-' + m.pillars.length + '">' + m.pillars.map(function (p, i) {
      return '<article class="pillar"><div class="pl-top"><span>Pillar ' + String(i + 1).padStart(2, '0') + '</span><span>' + esc(p.channels.length) + ' channel' + (p.channels.length === 1 ? '' : 's') + '</span></div>' +
        '<h3>' + p.name + '</h3><dl>' +
        '<div><dt>What it represents</dt><dd>' + esc(p.represents || '—') + '</dd></div>' +
        '<div><dt>Evidence to collect</dt><dd>' + esc(list(p.evidence)) + '</dd></div>' +
        '<div><dt>Potential channels</dt><dd>' + esc(list(p.channels)) + '</dd></div></dl></article>';
    }).join('') + '</div>';
    if (m.pillars.length < 3) h += '<p class="hint">Only ' + m.pillars.length + ' pillar' + (m.pillars.length > 1 ? 's' : '') + ' can be supported by your answers so far. That is a fine place to start.</p>';
    return h + '</section>';
  }

  function dimRow(key, d) {
    var v = d.value;
    var b = band(v);
    return '<div class="dim"><div class="dim-name">' + esc(d.name) + '<small>' + esc(d.sub) + '</small></div>' +
      '<div class="dim-meter" role="img" aria-label="' + esc(d.name) + ': ' + (v == null ? 'not enough answers' : v + ' out of 100') + '"><span style="width:' + (v || 0) + '%"></span></div>' +
      '<div class="dim-val">' + (v == null ? '—' : v + '/100') + '</div>' +
      '<p class="dim-read">' + (b < 0 ? 'Not enough answers yet.' : esc(DIM_READ[key][b])) + '</p></div>';
  }

  function socialByLevel(levels) {
    var out = [];
    SOCIAL_GROUPS.forEach(function (g) { g.items.forEach(function (it) { var x = state.social.items[it[0]]; if (x && levels.indexOf(x.level) > -1) out.push(it[1]); }); });
    return out;
  }
  function contentSection(m) {
    var talk = m.show.concat(m.selective.filter(function (e) { return e.c >= 3; })).map(function (e) { return e.label; });
    var showIt = socialByLevel(['public', 'followers', 'strategic']);
    var docIt = socialByLevel(['close']).concat(m.docItems.filter(function (k) { return state.documentation[k] === 'private' || state.documentation[k] === 'later'; }).map(function (k) { return labelOf(DOC_ITEMS, k); }));
    var keep = socialByLevel(['private']).concat(m.private.map(function (e) { return e.label; }));
    var reasons = {};
    Object.keys(state.social.items).forEach(function (k) { (state.social.items[k].reasons || []).forEach(function (r) { reasons[r] = (reasons[r] || 0) + 1; }); });
    var topR = Object.keys(reasons).sort(function (a, b) { return reasons[b] - reasons[a]; }).slice(0, 3);
    var cadence = state.social.lowFrequency ?
      'Low-frequency by choice: two to four considered posts a month, each tied to pillar 01 or 02. Nothing daily. Quiet stretches are part of the plan.' :
      'A steady, modest rhythm: about one post a week around pillar 01, with pillar 02 as supporting material. Skipping weeks is fine.';
    var h = '<section class="section">' + sectionHead('Content <em>strategy</em>', 'This does not ask you to post more. It tells you what fits, if and when you post.', 'Social media') +
      '<div class="two">' +
      contentCard('01', 'What to talk about', talk, 'Areas you rated useful and comfortable.') +
      contentCard('02', 'What to show', showIt, 'Signals you set to public, followers or strategic.') +
      contentCard('03', 'What to document', docIt, 'Recorded for you; published only if you later decide to.') +
      contentCard('04', 'What to keep personal', keep, 'Private by your own settings.').replace('class="card"', 'class="card priv"') +
      '</div>' +
      '<div class="three">' +
      '<div class="card"><h3>' + tag('public') + ' Public content</h3><p class="muted">' + esc(list(socialByLevel(['public', 'followers']), 'None set.')) + '</p></div>' +
      '<div class="card"><h3>' + tag('selective') + ' Selective content</h3><p class="muted">' + esc(list(socialByLevel(['selective', 'strategic', 'close']), 'None set.')) + '</p></div>' +
      '<div class="card"><h3>' + tag('document') + ' Private documentation</h3><p class="muted">' + esc(list(docIt, 'None set.')) + '</p></div>' +
      '</div>' +
      '<div class="card"><h3><span class="eyebrow">Cadence</span>' + (state.social.lowFrequency ? 'Intentional, low-frequency' : 'Steady and modest') + '</h3><p>' + esc(cadence) + '</p>' +
      (topR.length ? '<p class="muted">Your most common reasons to share: ' + esc(list(topR.map(function (r) { return labelOf(SOCIAL_REASONS, r) + ' (' + reasons[r] + ')'; }))) + '.</p>' : '') + '</div>' +
      '</section>';
    return h;
  }
  function contentCard(n, title, items, note) {
    return '<div class="card"><h3><span class="eyebrow">Content pillar ' + n + '</span>' + esc(title) + '</h3>' +
      (items.length ? '<p>' + esc(list(items)) + '</p>' : '<p class="muted">Nothing from your answers yet.</p>') + '<p class="hint">' + esc(note) + '</p></div>';
  }

  function careerModel(m) {
    var c = state.career;
    var attrs = c.attributes.map(function (a) { return labelOf(ATTRIBUTES, a); });
    if (c.otherAttribute.trim()) attrs.push(c.otherAttribute.trim());
    var primary = state.future.identity.trim() || (m.pillars[0] ? m.pillars[0].name.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&') : '') || (state.portfolio.hiredForNote.trim()) || 'Not defined yet';
    var skills = attrs.slice(3).concat(m.rated.filter(function (e) { return hasTag(e.cat, 'pro') && (e.verdict === 'show' || e.verdict === 'selective'); }).map(function (e) { return e.label; }));
    var done = state.portfolio.areas.filter(function (a) { var x = state.portfolio.answers[a] || {}; return x.evidence === 'yes' || x.evidence === 'partly'; }).map(function (a) { return labelOf(PORTFOLIO_AREAS, a); });
    skills = skills.concat(done).filter(function (x, i, arr) { return arr.indexOf(x) === i; });
    var evidence = c.evidence.map(function (e) { return labelOf(EVIDENCE, e); });
    var gaps = [], proof = [];
    c.underDocumented.forEach(function (g) { gaps.push(labelOf(EVIDENCE, g)); proof.push(PROOF_FOR[g]); });
    state.portfolio.areas.forEach(function (a) {
      var x = state.portfolio.answers[a] || {};
      if (x.wantMore === 'yes' && (x.evidence !== 'yes' || x.organized !== 'yes' || x.measurable === 'no')) {
        gaps.push(labelOf(PORTFOLIO_AREAS, a) + ' (work you want more of)');
        proof.push(PROOF_FOR[a + '_area']);
      }
    });
    if (c.attributes.indexOf('analytical') > -1 && c.evidence.indexOf('metrics') === -1 && c.underDocumented.indexOf('metrics') === -1) { gaps.push('Metrics to back “Analytical”'); proof.push(PROOF_FOR.metrics); }
    if ((c.attributes.indexOf('leadership') > -1) && c.evidence.indexOf('testimonials') === -1 && c.underDocumented.indexOf('testimonials') === -1) { gaps.push('Testimonials to back “Leadership-oriented”'); proof.push(PROOF_FOR.testimonials); }
    var confidential = state.portfolio.areas.filter(function (a) { var x = state.portfolio.answers[a] || {}; return x.confidential === 'yes' || x.confidential === 'partly'; }).map(function (a) { return labelOf(PORTFOLIO_AREAS, a); });
    var notNeeded = m.private.map(function (e) { return e.label; }).concat(m.boundaries);
    if (confidential.length) notNeeded.push('Client names and raw data from ' + list(confidential) + ': share the outcome and your role instead');
    return { attrs: attrs, primary: primary, skills: skills, evidence: evidence, gaps: gaps, proof: proof.filter(Boolean), notNeeded: notNeeded };
  }
  function careerSection(m) {
    var cm = careerModel(m);
    var h = '<section class="section">' + sectionHead('Career <em>brand</em>', 'Your actual experience, arranged into something a stranger can follow.', 'Career');
    h += '<div class="card card-dark"><h3><span class="eyebrow">What recruiters should understand in 10 seconds</span></h3>' +
      '<p class="tenline">' + esc(cm.primary) + '</p>' +
      '<p class="muted">' + (cm.attrs.length ? 'Known for being ' + esc(list(cm.attrs.slice(0, 3).map(function (a) { return a.toLowerCase(); }))) + '. ' : '') +
      (cm.evidence.length ? 'Backed by ' + esc(list(cm.evidence.slice(0, 3).map(function (a) { return a.toLowerCase(); }))) + '.' : 'Evidence still to be collected.') + '</p></div>';
    h += '<div class="card"><dl class="kv">' +
      '<dt>Primary identity</dt><dd>' + esc(cm.primary) + '</dd>' +
      '<dt>Supporting skills</dt><dd>' + esc(list(cm.skills, '—')) + '</dd>' +
      '<dt>Evidence</dt><dd>' + esc(list(cm.evidence, 'None listed yet')) + '</dd>' +
      '<dt>Portfolio gaps</dt><dd>' + esc(list(cm.gaps, 'None flagged')) + '</dd>' +
      '<dt>Proof to collect</dt><dd>' + (cm.proof.length ? '<ul>' + cm.proof.map(function (p) { return '<li>' + esc(p) + '</li>'; }).join('') + '</ul>' : '—') + '</dd>' +
      '<dt class="priv">Not necessary to disclose</dt><dd class="priv">' + esc(list(cm.notNeeded, 'Nothing specific')) + '</dd>' +
      (has('networking') ? '<dt>Networking line</dt><dd>' + esc(state.career.networkingLine.trim() || ('Lead with ' + list(state.career.networkingLead.map(function (x) { return lowerFirst(labelOf(NETWORK_LEAD, x)); }), 'your current role') + '.')) + '</dd>' : '') +
      '</dl></div></section>';
    return h;
  }

  function portfolioSection() {
    var p = state.portfolio;
    var done = [], hired = [];
    var status = [];
    p.areas.forEach(function (a) {
      var x = p.answers[a] || {}, L = labelOf(PORTFOLIO_AREAS, a);
      var isDone = x.evidence === 'yes' || x.evidence === 'partly';
      if (isDone) done.push(a);
      if (x.wantMore === 'yes') hired.push(a);
      var st;
      if (!x.evidence) st = 'Not audited';
      else if (x.evidence === 'no') st = 'No evidence yet';
      else if (x.confidential === 'yes' || x.shareable === 'no') st = 'Needs an anonymised, shareable version';
      else if (x.organized !== 'yes') st = 'Needs organising';
      else if (x.measurable === 'no') st = 'Needs a measurable result';
      else st = 'Ready to show';
      status.push([L, st]);
    });
    var lead = hired.filter(function (a) { return done.indexOf(a) > -1; });
    var build = hired.filter(function (a) { return done.indexOf(a) === -1; });
    var bg = done.filter(function (a) { return hired.indexOf(a) === -1; });
    var L = function (arr) { return arr.map(function (a) { return labelOf(PORTFOLIO_AREAS, a); }); };
    return '<section class="section">' + sectionHead('What you have done vs. <em>what you want to be hired for</em>', p.hiredForNote.trim() ? '“' + esc(p.hiredForNote.trim()) + '”' : 'A portfolio should lean toward the work you want more of.', 'Portfolio') +
      '<div class="three">' +
      '<div class="card"><h3>' + tag('public') + ' Lead with</h3><p>' + esc(list(L(lead), 'Nothing overlaps yet.')) + '</p><p class="hint">Done it, have proof, want more of it.</p></div>' +
      '<div class="card"><h3>' + tag('strategic') + ' Build proof for</h3><p>' + esc(list(L(build), 'No gaps between ambition and evidence.')) + '</p><p class="hint">Wanted, but thin on evidence.</p></div>' +
      '<div class="card"><h3>' + tag('document') + ' Keep in the background</h3><p>' + esc(list(L(bg), 'Nothing.')) + '</p><p class="hint">Done it, but not what you want to be hired for.</p></div>' +
      '</div>' +
      '<div class="card"><h3>Readiness by area</h3><dl class="kv">' + status.map(function (s) { return '<dt>' + esc(s[0]) + '</dt><dd>' + esc(s[1]) + '</dd>'; }).join('') + '</dl></div></section>';
  }

  function futureSection(m) {
    var f = state.future;
    var byRole = function (r) { return selectedCats().filter(function (c) { return f.roles[c.id] === r; }).map(function (c) { return c.label; }); };
    var docs = f.startDocumenting.map(function (d) { return labelOf(DOC_ITEMS, d); });
    if (f.documentingNote.trim()) docs.push(f.documentingNote.trim());
    if (!f.identity.trim() && !Object.keys(f.roles).length && !f.evidenceNeeded.trim() && !docs.length) return '';
    return '<section class="section">' + sectionHead('Future <em>strategy</em>', f.identity.trim() ? 'Toward: ' + esc(f.identity.trim()) : 'What your present should set up.', 'Timing') +
      '<div class="card"><dl class="kv">' +
      '<dt>Supports it</dt><dd>' + esc(list(byRole('supports'), '—')) + '</dd>' +
      '<dt>Reveal later</dt><dd>' + esc(list(byRole('later'), '—')) + '</dd>' +
      '<dt>Irrelevant</dt><dd>' + esc(list(byRole('irrelevant'), '—')) + '</dd>' +
      '<dt class="priv">Stays private</dt><dd class="priv">' + esc(list(byRole('private'), '—')) + '</dd>' +
      '<dt>Evidence to collect</dt><dd>' + esc(f.evidenceNeeded.trim() || '—') + '</dd>' +
      '<dt>Start documenting</dt><dd>' + esc(list(docs, '—')) + '</dd></dl></div></section>';
  }

  function distinctionsSection(m) {
    var audiences = {};
    m.rated.forEach(function (e) { e.access.forEach(function (a) { audiences[a] = (audiences[a] || 0) + 1; }); });
    var topA = Object.keys(audiences).sort(function (a, b) { return audiences[b] - audiences[a]; }).slice(0, 3).map(function (a) { return labelOf(ACCESS, a); });
    var rows = [
      ['Identity', 'who I am', list(selectedCats().map(function (c) { return c.label; }).slice(0, 8), '—') + (selectedCats().length > 8 ? ', …' : '')],
      ['Brand', 'what I want people to associate with me', list(m.pillars.map(function (p) { return p.name.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&'); }), '—')],
      ['Visibility', 'what people can see', list(m.show.map(function (e) { return e.label; }), 'Nothing fully public yet')],
      ['Documentation', 'what I preserve for myself', list(m.document.map(function (e) { return e.label; }).concat(m.docItems.filter(function (k) { return state.documentation[k] === 'private'; }).map(function (k) { return labelOf(DOC_ITEMS, k); })), '—')],
      ['Privacy', 'what remains mine', list(m.private.map(function (e) { return e.label; }).concat(m.boundaries), '—')],
      ['Audience', 'who gets access', list(topA, '—')],
      ['Timing', 'when something becomes appropriate to reveal', list(m.rated.filter(function (e) { return e.later; }).map(function (e) { return e.label; }), 'Nothing held for later')]
    ];
    return '<section class="section">' + sectionHead('Your seven <em>distinctions</em>', 'Personal branding is not the same thing as making your entire life public.') +
      '<div class="card"><dl class="kv">' + rows.map(function (r) { var pc = r[0] === 'Privacy' ? ' class="priv"' : ''; return '<dt' + pc + '>' + r[0] + '</dt><dd' + pc + '><span class="muted">' + esc(r[1]) + ':</span> ' + esc(r[2]) + '</dd>'; }).join('') + '</dl></div></section>';
  }

  /* ------------------------------------------------------------------------
     10. DATA PANEL (save / export / import / clear)
     ------------------------------------------------------------------------ */

  function dataPanel(where) {
    var saved = state.updatedAt ? 'Last saved ' + fmtDate(state.updatedAt) + ', ' + fmtTime(state.updatedAt) + '.' : 'Not saved yet.';
    return '<div class="data-panel">' +
      '<p class="privacy-line">' + icon('lock') + '<span>Your answers are stored locally in this browser. This tool does not require an account. ' + esc(saved) + (storageOK ? '' : ' Browser storage is unavailable here, so export to keep your answers.') + '</span></p>' +
      '<label class="check"><input type="checkbox" data-bind-bool="exportIncludePrivate"' + (state.exportIncludePrivate ? ' checked' : '') + '> Include items I marked private in exports (boundaries, private areas)</label>' +
      '<div class="data-grid">' +
      '<button type="button" class="data-action" data-action="download-docx"><b>Download Word (.docx)</b><small>Your strategy, every answer (now and goal) and your notes, as a document.</small></button>' +
      '<button type="button" class="data-action" data-action="download-xlsx"><b>Download Excel (.xlsx)</b><small>The same in a workbook: summary, now vs goal, map, answers, notes.</small></button>' +
      '<button type="button" class="data-action" data-action="save"><b>Save progress</b><small>Store everything in this browser now.</small></button>' +
      '<button type="button" class="data-action" data-action="download-results-json"><b>Download results (JSON)</b><small>Your strategy, scores, pillars and map.</small></button>' +
      '<button type="button" class="data-action" data-action="copy-summary"><b>Copy summary</b><small>Your strategy as plain text, ready to paste.</small></button>' +
      (FRAMED ? '' : '<button type="button" class="data-action" data-action="print"><b>Print / Save as PDF</b><small>A formatted strategy document.</small></button>') +
      '<button type="button" class="data-action" data-action="download-json"><b>Download full backup</b><small>Every answer, including private ones. Use it to import later.</small></button>' +
      '<button type="button" class="data-action" data-action="import"><b>Import a backup</b><small>Load a full backup file from this tool.</small></button>' +
      '<button type="button" class="data-action danger" data-action="clear-all"><b>Clear all data</b><small>Remove answers and dashboard from this browser.</small></button>' +
      '</div>' +
      '<input type="file" class="sr" id="import-' + where + '" accept="application/json,.json" data-import tabindex="-1" aria-label="Choose a Visibility Map backup file">' +
      '<div class="data-slot" aria-live="polite"></div>' +
      (state.submission.status === 'sent' ? '<p class="hint">Clearing data here does not remove an assessment you already submitted. Keep your assessment ID (' + esc(state.assessmentId) + ') if you may want it removed later.</p>' : '') +
      (FRAMED ? '<p class="hint">In this preview, downloads ask you to confirm first, and printing is switched off. Both work directly on your published website.</p>' : '') +
      '</div>';
  }

  function openData() {
    var d = $('#data-dialog');
    d.innerHTML = '<div class="sheet-inner"><div class="sheet-head"><h2 id="data-dialog-title">Your data</h2><button type="button" class="btn btn-sm" data-action="close-dialog">Close</button></div>' + dataPanel('dialog') + '</div>';
    openDialog(d);
  }
  function openMenu() {
    var d = $('#menu-dialog');
    d.innerHTML = '<div class="sheet-inner"><div class="sheet-head"><h2>Sections</h2><button type="button" class="btn btn-sm" data-action="close-dialog">Close</button></div>' + sideNav(true) + '</div>';
    openDialog(d);
  }
  function openDialog(d) {
    if (typeof d.showModal === 'function') { try { d.showModal(); } catch (e) { d.setAttribute('open', ''); } }
    else d.setAttribute('open', '');
  }
  function closeDialogs() {
    $$('dialog').forEach(function (d) { if (d.open) { if (typeof d.close === 'function') d.close(); else d.removeAttribute('open'); } });
  }

  function slotFor(el) {
    var panel = el.closest('.data-panel');
    return panel ? $('.data-slot', panel) : null;
  }

  // Full backup: everything, so it can be imported again.
  function exportPayload() {
    var copy = JSON.parse(JSON.stringify(state));
    copy.exportedAt = new Date().toISOString();
    copy.app = 'Visibility Map';
    copy.kind = 'backup';
    return JSON.stringify(copy, null, 2);
  }

  // Results export: the strategy only. Private items are left out unless the user ticks the box.
  function resultsExport() {
    var m = computeModel();
    var inc = !!state.exportIncludePrivate;
    function name(e) { return (!inc && isPrivateEval(e)) ? 'Private item' : e.label; }
    function recs(arr) { return arr.map(function (e) { return { category: name(e), reason: (!inc && isPrivateEval(e)) ? '' : e.why, reveal_later: !!e.later }; }); }
    var out = {
      app: 'Visibility Map', kind: 'results', assessment_id: state.assessmentId,
      date: new Date().toISOString(), includes_private_items: inc,
      visibility_strategy: {
        primary: m.pattern ? m.pattern.title : null, secondary: m.secondary ? m.secondary.title : null,
        description: m.pattern ? m.pattern.body : null, what_it_means: m.pattern ? m.pattern.means : null
      },
      scores: scoreObject(m),
      brand_pillars: m.pillars.map(function (p) { return { name: plain(p.name), represents: p.represents, evidence_to_collect: p.evidence, channels: p.channels }; }),
      visibility_matrix: m.evals.filter(function (e) { return inc || !isPrivateEval(e); }).map(matrixRow),
      recommendations: { show: recs(m.show), selectively_share: recs(m.selective), document_privately: recs(m.document), keep_private: recs(m.private) }
    };
    if (inc) out.privacy_boundaries = m.boundaries;
    else out.private_items_hidden = m.evals.filter(function (e) { return isPrivateEval(e); }).length + m.boundaries.length;
    return JSON.stringify(out, null, 2);
  }

  function downloadFile(text, filename, okMsg) { saveBlob(new Blob([text], { type: 'application/json' }), filename, okMsg); }
  function downloadJSON() { downloadFile(exportPayload(), 'visibility-map-backup-' + state.assessmentId + '.json', 'Downloaded your full backup.'); }
  function downloadResultsJSON() { downloadFile(resultsExport(), 'visibility-map-results-' + state.assessmentId + '.json', 'Downloaded your results.'); }

  function copyText(text, okMsg, el) {
    function fallback() {
      var slot = el ? slotFor(el) : null;
      if (slot) {
        slot.innerHTML = '<div class="field"><label for="copy-fallback">Copying was blocked. Select all and copy manually:</label><textarea class="textarea copy-area" id="copy-fallback" readonly></textarea></div>';
        var ta = $('#copy-fallback', slot);
        ta.value = text; ta.focus(); ta.select();
      } else toast('Copying was blocked by the browser.');
    }
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () { toast(okMsg); }, fallback);
      } else fallback();
    } catch (e) { fallback(); }
  }

  function summaryText() {
    var m = computeModel();
    var L = [];
    var inc = !!state.exportIncludePrivate;
    function nm(e) { return !inc && isPrivateEval(e) ? 'Private item' : e.label; }
    L.push('VISIBILITY MAP — PERSONAL STRATEGY');
    L.push('Assessment ID: ' + state.assessmentId);
    L.push('Date: ' + fmtDate(new Date().toISOString()));
    if (!inc) L.push('(Items you marked private are not included.)');
    L.push('');
    if (m.pattern) { L.push('Your strongest pattern is ' + m.pattern.title + '.'); if (m.secondary) L.push('Secondary pattern: ' + m.secondary.title + '.'); L.push(m.pattern.body); L.push(m.pattern.means); L.push(''); }
    function sec(title, items) { L.push(title.toUpperCase()); if (!items.length) L.push('  —'); items.forEach(function (i) { L.push('  • ' + i); }); L.push(''); }
    sec('Show', m.show.map(function (e) { return e.label + ': ' + e.why; }));
    sec('Selectively share', m.selective.map(function (e) { return e.label + (e.later ? ' [reveal later]' : '') + ': ' + e.why; }));
    sec('Document privately', m.document.map(function (e) { return nm(e) + (nm(e) === e.label ? ': ' + e.why : ''); }).concat(docExtras(m) || []));
    sec('Keep private', inc ? m.private.map(function (e) { return e.label + ': ' + e.why; }) : (m.private.length ? [m.private.length + ' area' + (m.private.length > 1 ? 's' : '') + ' (hidden)'] : []));
    var ftl = fromToLines(), ftr = fromToRows(m, inc);
    if (ftl.length || ftr.length) sec('Now → goal', ftl.map(function (l) { return l[0] + ': ' + l[1] + ' → ' + l[2]; }).concat(ftr.map(function (r) { return r[0] + ': ' + r[1] + ' → ' + r[2] + ' (' + r[3] + ')'; })));
    L.push('VISIBILITY MAP (IRL / Social / Career / Portfolio / Friends / Private)');
    m.evals.filter(function (e) { return inc || !isPrivateEval(e); }).forEach(function (e) {
      L.push('  ' + e.label + ': ' + MAP_COLS.map(function (c) { return (LEVELS[e.cells[c[0]]] || LEVELS.na).label; }).join(' / ') + (e.rated ? '' : ' (not rated)'));
    });
    L.push('');
    sec('Brand pillars', m.pillars.map(function (p) { return p.name.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&') + ' — ' + p.represents + ' | Evidence: ' + list(p.evidence) + ' | Channels: ' + list(p.channels); }));
    sec('Dimensions', Object.keys(m.dims).map(function (k) { var d = m.dims[k]; return d.name + ': ' + (d.value == null ? 'not enough answers' : d.value + '/100'); }));
    if (has('career') || has('networking')) {
      var cm = careerModel(m);
      sec('Career brand', ['Primary identity: ' + cm.primary, 'Known for: ' + list(cm.attrs, '—'), 'Evidence: ' + list(cm.evidence, '—'), 'Gaps: ' + list(cm.gaps, '—')].concat(cm.proof.map(function (p) { return 'Collect: ' + p; })));
    }
    if (state.future.identity.trim()) sec('Building toward', [state.future.identity.trim()]);
    if (inc) sec('Privacy boundaries (never public)', m.boundaries);
    else if (m.boundaries.length) sec('Privacy boundaries (never public)', [m.boundaries.length + ' boundaries (hidden)']);
    L.push('Your life doesn’t need to be public to be real.');
    return L.join('\n');
  }

  var pendingImport = null;
  function handleImportFile(input) {
    var file = input.files && input.files[0];
    var slot = slotFor(input);
    input.value = '';
    if (!file) return;
    if (file.size > 12 * 1024 * 1024) { showSlot(slot, '<p class="note">' + tag('private') + '<span>That file is larger than 12 MB, which is too big for an export from this tool.</span></p>'); return; }
    var reader = new FileReader();
    reader.onload = function () {
      var parsed;
      try { parsed = JSON.parse(String(reader.result)); } catch (e) {
        showSlot(slot, '<p class="note">' + tag('private') + '<span>“' + esc(file.name) + '” is not valid JSON. Choose a file exported from Visibility Map.</span></p>');
        return;
      }
      if (parsed && parsed.kind === 'results') {
        showSlot(slot, '<p class="note">' + tag('selective') + '<span>“' + esc(file.name) + '” is a results summary, which cannot be imported. Choose a full backup file instead.</span></p>');
        return;
      }
      if (!parsed || typeof parsed !== 'object' || (parsed.version !== 1 && !parsed.matrix && !parsed.categories)) {
        showSlot(slot, '<p class="note">' + tag('private') + '<span>“' + esc(file.name) + '” does not look like a Visibility Map export.</span></p>');
        return;
      }
      pendingImport = normalize(parsed);
      showSlot(slot, '<div class="confirm"><p>Import <strong>' + esc(file.name) + '</strong>' + (pendingImport.updatedAt ? ', saved ' + esc(fmtDate(pendingImport.updatedAt)) : '') +
        ' with ' + pendingImport.categories.length + ' areas and ' + pendingImport.dashboard.entries.length + ' dashboard entries? This replaces what is in this browser now.</p>' +
        '<div class="actions"><button type="button" class="btn btn-primary btn-sm" data-action="confirm-import">Replace with import</button><button type="button" class="btn btn-sm" data-action="cancel-slot">Cancel</button></div></div>');
    };
    reader.onerror = function () { showSlot(slot, '<p class="note">' + tag('private') + '<span>The file could not be read.</span></p>'); };
    reader.readAsText(file);
  }
  function showSlot(slot, html) { if (slot) slot.innerHTML = html; else toast(html.replace(/<[^>]+>/g, '')); }

  /* ------------------------------------------------------------------------
     10b. SUBMISSION TO GOOGLE SHEETS (optional, only when the user submits)
     ------------------------------------------------------------------------ */

  function plain(html) { return String(html).replace(/<[^>]+>/g, '').replace(/&amp;/g, '&'); }
  function isConfigured() {
    var u = (typeof GOOGLE_SCRIPT_URL === 'string' ? GOOGLE_SCRIPT_URL : '').trim();
    return /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(u);
  }
  function scoreObject(m) {
    function v(k) { return m.dims[k].value; }
    return {
      privacy_preference: v('privacy'), strategic_visibility: v('strategic'), professional_visibility: v('professional'),
      social_visibility: v('social'), documentation_need: v('documentation'), audience_control: v('audience'), future_building: v('future')
    };
  }
  function matrixRow(e) {
    function L(k) { return (LEVELS[e.cells[k]] || LEVELS.na).label; }
    return {
      category: e.label, category_id: e.id, rated: e.rated,
      irl: e.rated ? L('irl') : 'Not rated', social: e.rated ? L('social') : 'Not rated', career: e.rated ? L('career') : 'Not rated',
      portfolio: e.rated ? L('portfolio') : 'Not rated', friends: e.rated ? L('friends') : 'Not rated', private: e.rated ? L('private') : 'Not rated',
      recommendation: { show: 'Show', selective: 'Selectively share', document: 'Document privately', private: 'Keep private', unrated: 'Not rated' }[e.verdict],
      reveal_later: !!e.later,
      visible_now: e.N ? VIS_LABELS[e.N - 1] : null,
      visible_goal: e.G ? VIS_LABELS[e.G - 1] : null,
      change: changeLabel(e)
    };
  }
  function scaleValue(v) { return v === 'ns' ? 'not sure' : (typeof v === 'number' ? v : null); }

  // Every answer, in plain readable form.
  function rawAnswers() {
    var cats = selectedCats();
    return {
      contexts: state.contexts.map(function (c) { return { id: c, label: (CONTEXTS.filter(function (x) { return x.id === c; })[0] || {}).label || c }; }),
      identity_categories: cats.map(function (c) { return { id: c.id, label: c.label, custom: hasTag(c, 'custom') }; }),
      custom_categories: state.custom.map(function (c) { return { id: c.id, label: c.label, work_related: c.work, selected: state.categories.indexOf(c.id) > -1 }; }),
      visibility_matrix_answers: cats.map(function (c) {
        var a = state.matrix[c.id] || {};
        return {
          category_id: c.id, category: c.label,
          comfort: scaleValue(a.comfort), usefulness: scaleValue(a.useful), control: scaleValue(a.control),
          still_comfortable_in_two_years: scaleValue(a.future), personal_value: scaleValue(a.value),
          visible_now: scaleValue(a.now), visible_goal: scaleValue(a.goal),
          access: (a.access || []).map(function (x) { return labelOf(ACCESS, x); })
        };
      }),
      public_irl: IRL_QS.reduce(function (o, q) { o[q.key] = scaleValue(state.irl[q.key]); return o; }, { intro_style: state.irl.intro ? labelOf(IRL_INTRO, state.irl.intro) : null }),
      social_media: {
        low_frequency_posting: !!state.social.lowFrequency,
        items: SOCIAL_GROUPS.reduce(function (arr, g) {
          g.items.forEach(function (it) {
            var x = state.social.items[it[0]] || {};
            if (x.level || (x.reasons && x.reasons.length)) arr.push({ item: it[1], level: x.level ? labelOf(SOCIAL_LEVELS, x.level) : null, reasons: (x.reasons || []).map(function (r) { return labelOf(SOCIAL_REASONS, r); }) });
          });
          return arr;
        }, [])
      },
      career: {
        known_for: state.career.attributes.map(function (a) { return labelOf(ATTRIBUTES, a); }),
        other_trait: state.career.otherAttribute,
        evidence_available: state.career.evidence.map(function (e) { return labelOf(EVIDENCE, e); }),
        under_documented: state.career.underDocumented.map(function (e) { return labelOf(EVIDENCE, e); }),
        networking_lead_with: state.career.networkingLead.map(function (e) { return labelOf(NETWORK_LEAD, e); }),
        networking_introduction: state.career.networkingLine
      },
      portfolio: {
        areas: state.portfolio.areas.map(function (a) {
          var x = state.portfolio.answers[a] || {};
          return { area: labelOf(PORTFOLIO_AREAS, a), has_evidence: x.evidence || null, organized: x.organized || null, publicly_shareable: x.shareable || null,
            confidential: x.confidential || null, measurable_result: x.measurable || null, want_more_of_this_work: x.wantMore || null };
        }),
        want_to_be_hired_for: state.portfolio.hiredForNote
      },
      documentation_preferences: DOC_ITEMS.filter(function (it) { return state.documentation[it[0]]; }).map(function (it) { return { item: it[1], choice: labelOf(DOC_CHOICES, state.documentation[it[0]]) }; }),
      privacy_boundaries: { never_share_publicly: state.boundaries.never.map(function (b) { return labelOf(BOUNDARIES, b); }), other: state.boundaries.other },
      future_self: {
        identity_in_1_to_3_years: state.future.identity,
        current_areas: cats.filter(function (c) { return state.future.roles[c.id]; }).map(function (c) { return { category: c.label, role: labelOf(FUTURE_ROLES, state.future.roles[c.id]) }; }),
        evidence_to_collect: state.future.evidenceNeeded,
        start_documenting: state.future.startDocumenting.map(function (d) { return labelOf(DOC_ITEMS, d); }),
        start_documenting_note: state.future.documentingNote
      },
      now_vs_goal: {
        contexts_visibility_now: CONTEXTS.filter(function (c) { return state.contextsNow[c.id]; }).map(function (c) { return { context: c.label, visible_now: labelOf(CTX_NOW, state.contextsNow[c.id]) }; }),
        most_want_to_be_known_for: state.knownFor.map(function (k) { var c = catById(k); return c ? c.label : k; }),
        irl_now: { how_much_people_learn: scaleValue(state.irl.nowOpen), talk_about_work: scaleValue(state.irl.nowCareerTalk) },
        irl_intro_goal: state.irl.introGoal ? labelOf(IRL_INTRO, state.irl.introGoal) : null,
        social_posting_now: state.social.postNow ? labelOf(POST_FREQ, state.social.postNow) : null,
        social_posting_goal: state.social.postGoal ? labelOf(POST_FREQ, state.social.postGoal) : null,
        social_platforms: state.social.platforms.map(function (x) { return labelOf(PLATFORMS, x); }),
        social_items_now: Object.keys(state.social.items).filter(function (k) { return state.social.items[k].now; }).map(function (k) { return { item: k, now: labelOf(SOCIAL_LEVELS, state.social.items[k].now) }; }),
        career_current_role: state.career.currentRole, career_target_role: state.career.targetRole,
        career_known_for_now: state.career.nowKnownFor.map(function (a) { return labelOf(ATTRIBUTES, a); }),
        career_intro_now: state.career.nowIntro,
        portfolio_current_work: state.portfolio.currentWork,
        documentation_now: DOC_ITEMS.filter(function (it) { return state.documentationNow[it[0]]; }).map(function (it) { return { item: it[1], tracking_now: labelOf(DOC_NOW, state.documentationNow[it[0]]) }; }),
        boundaries_already_public: state.boundaries.exposedNow.map(function (b) { return labelOf(BOUNDARIES, b); }),
        identity_today: state.future.currentIdentity
      },
      notes: (function () {
        var n = {};
        Object.keys(state.notes).forEach(function (k) { if (state.notes[k] && String(state.notes[k]).trim()) n[k] = state.notes[k]; });
        cats.forEach(function (c) { var t = (state.matrix[c.id] || {}).note; if (t && String(t).trim()) n['area: ' + c.label] = t; });
        return n;
      })(),
      completed_steps: Object.keys(state.visited).filter(function (k) { return state.visited[k]; }),
      skipped_steps: Object.keys(state.skipped).filter(function (k) { return state.skipped[k]; })
    };
  }

  function hashString(str2) {
    var h = 5381;
    for (var i = 0; i < str2.length; i++) h = ((h << 5) + h + str2.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36);
  }
  function answersHash() { return hashString(JSON.stringify(rawAnswers()) + '|' + state.respondent.name + '|' + state.respondent.email); }

  // The JSON object sent to Google Apps Script. The website does not know the
  // spreadsheet layout; the Apps Script decides which fields go into which columns.
  function buildPayload() {
    var m = computeModel();
    function recs(arr) { return arr.map(function (e) { return { category: e.label, reason: e.why, reveal_later: !!e.later }; }); }
    var name = (state.respondent.name || '').trim();
    var email = (state.respondent.email || '').trim();
    return {
      schema_version: 1,
      app: 'Visibility Map',
      app_version: APP_VERSION,
      assessment_id: state.assessmentId,
      timestamp: new Date().toISOString(),
      started_at: state.createdAt,
      submission_number: (state.submission.attempts || 0) + 1,
      respondent: { name: name || null, email: email || null },
      consent: { submitted_by_user: true, notice: PRIVACY_NOTICE },
      raw: rawAnswers(),
      calculated: {
        scores: scoreObject(m),
        primary_strategy: m.pattern ? m.pattern.title : null,
        secondary_strategy: m.secondary ? m.secondary.title : null,
        strategy_description: m.pattern ? m.pattern.body : null,
        brand_pillars: m.pillars.map(function (p) { return { name: plain(p.name), represents: p.represents, evidence_to_collect: p.evidence, channels: p.channels }; }),
        visibility_matrix: m.evals.map(matrixRow),
        recommendations: { show: recs(m.show), selectively_share: recs(m.selective), document_privately: recs(m.document), keep_private: recs(m.private), not_rated: m.unrated.map(function (e) { return e.label; }) },
        areas_rated: m.rated.length,
        areas_selected: m.evals.length
      },
      // Spam trap: real visitors never see or fill this field.
      website: ($('#vm-website') && $('#vm-website').value) || ''
    };
  }

  function sendToGoogle(payload) {
    var ctrl = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, SUBMIT_TIMEOUT_MS);
    // text/plain keeps this a "simple" request, which Google Apps Script accepts from any website.
    return fetch(GOOGLE_SCRIPT_URL.trim(), {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
      redirect: 'follow',
      credentials: 'omit',
      cache: 'no-store',
      signal: ctrl ? ctrl.signal : undefined
    }).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.text();
    }).then(function (text) {
      var json;
      try { json = JSON.parse(text); } catch (e) { throw new Error('Response was not JSON'); }
      if (!json || json.ok !== true) throw new Error((json && json.error) || 'Rejected by Apps Script');
      clearTimeout(timer);
      return json;
    }, function (err) { clearTimeout(timer); throw err; });
  }

  var submitting = false;
  var submitLabel = '';
  var lastNotice = null; // set right after a submit so the results page can show the outcome

  function setSubmitButtons(label, busy) {
    submitLabel = label;
    $$('[data-action="submit"], [data-action="retry-submit"]').forEach(function (b) {
      b.disabled = !!busy;
      if (busy) b.setAttribute('aria-busy', 'true'); else b.removeAttribute('aria-busy');
      if (b.getAttribute('data-action') === 'submit' || busy) b.textContent = label;
    });
    var nb = $('[data-action="results-no-submit"]'); if (nb) nb.disabled = !!busy;
  }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  function submitAssessment(opts) {
    if (submitting) return;
    var email = (state.respondent.email || '').trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      var err = $('#submit-error');
      if (err) err.textContent = 'That email address looks incomplete. Correct it, or leave the field empty: it is optional.';
      var ef = $('#sub-email'); if (ef) ef.focus();
      if (!err) toast('Check the optional email address on the last step.');
      return;
    }
    submitting = true;
    if (isStep(state.step)) { state.visited[state.step] = true; delete state.skipped[state.step]; }
    setSubmitButtons('Generating your results…', true);
    var payload = null;
    wait(450).then(function () {
      try { payload = buildPayload(); } catch (e) { payload = null; if (window.console) console.warn('[Visibility Map] Could not build submission:', e); }
      persistNow();
      if (!payload) return 'failed';
      if (!isConfigured()) {
        if (window.console) console.info('[Visibility Map] GOOGLE_SCRIPT_URL is not set (or does not end in /exec), so nothing was sent. Results are shown normally.');
        return 'not-configured';
      }
      setSubmitButtons('Saving your assessment…', true);
      state.submission.attempts = (state.submission.attempts || 0) + 1;
      state.submission.lastAttemptAt = payload.timestamp;
      persistNow();
      return sendToGoogle(payload).then(function () { return 'sent'; }, function (e) {
        if (window.console) console.warn('[Visibility Map] Submission did not reach Google Sheets:', e && e.message);
        return 'failed';
      });
    }).then(function (status) {
      state.submission.status = status;
      if (status === 'sent') { state.submission.submittedAt = payload.timestamp; state.submission.hash = answersHash(); }
      persistNow();
      lastNotice = status;
      setSubmitButtons('Results ready', true);
      return wait(500);
    }).then(function () {
      submitting = false;
      setSubmitButtons('See my results', false);
      if (state.step === 'results') { render({ focus: false }); var n = $('#submit-notice'); if (n) n.focus(); }
      else go('results');
    });
  }

  function submitPanel(where) {
    return '<section class="form-card" id="submit-panel" aria-labelledby="submit-h">' +
      '<div class="section-head"><h2 id="submit-h">See your <em>results</em></h2>' +
      '<p>' + esc(PRIVACY_NOTICE) + '</p></div>' +
      '<div class="entry-form">' +
      '<div class="field"><label for="sub-name">Name <span class="hint">(optional)</span></label><input class="input" id="sub-name" maxlength="120" autocomplete="name" data-bind-text="respondent.name" value="' + esc(state.respondent.name) + '"></div>' +
      '<div class="field"><label for="sub-email">Email <span class="hint">(optional)</span></label><input class="input" type="email" id="sub-email" maxlength="200" autocomplete="email" data-bind-text="respondent.email" value="' + esc(state.respondent.email) + '"></div>' +
      '</div>' +
      '<p class="hint">Leave both empty to submit without them. Your assessment ID is <strong>' + esc(state.assessmentId) + '</strong>.</p>' +
      '<div class="sr" aria-hidden="true"><label for="vm-website">Leave this empty</label><input id="vm-website" tabindex="-1" autocomplete="off"></div>' +
      '<p class="hint" id="submit-error" role="alert"></p>' +
      '<div class="actions">' +
        '<button type="button" class="btn btn-primary" data-action="submit"' + (submitting ? ' disabled aria-busy="true"' : '') + '>' + (submitting ? esc(submitLabel) : 'See my results') + '</button>' +
        '<button type="button" class="btn btn-quiet" data-action="results-no-submit">See results without submitting</button>' +
      '</div></section>';
  }

  function submissionNotice() {
    var st = lastNotice;
    if (!st) return '';
    if (st === 'failed') {
      return '<p class="note no-print" id="submit-notice" tabindex="-1">' + tag('selective') + '<span>Your results are available. We couldn’t save your response right now. ' +
        '<button type="button" class="linkbtn" data-action="retry-submit">Try again</button></span></p>';
    }
    return '<p class="note no-print" id="submit-notice" tabindex="-1">' + tag('done') + '<span>Your results have been generated.' + (st === 'sent' ? ' Your assessment was submitted.' : '') + '</span></p>';
  }

  function submitSection() {
    var sub = state.submission;
    if (sub.status === 'sent') {
      var changed = sub.hash && sub.hash !== answersHash();
      return '<section class="section no-print" id="submit-section">' + sectionHead('Your <em>submission</em>',
        'Submitted ' + esc(fmtDate(sub.submittedAt)) + ' as ' + esc(state.assessmentId) + '.' + (changed ? ' You have changed some answers since then.' : '')) +
        (changed ? '<div class="actions"><button type="button" class="btn" data-action="retry-submit">Update my submission</button></div>' : '') +
        '<p class="hint">' + esc(PRIVACY_NOTICE) + '</p></section>';
    }
    if (lastNotice === 'failed') return '';
    return '<section class="section no-print" id="submit-section">' + sectionHead('Submit your <em>assessment</em>', esc(PRIVACY_NOTICE)) +
      '<div class="entry-form">' +
      '<div class="field"><label for="sub-name">Name <span class="hint">(optional)</span></label><input class="input" id="sub-name" maxlength="120" autocomplete="name" data-bind-text="respondent.name" value="' + esc(state.respondent.name) + '"></div>' +
      '<div class="field"><label for="sub-email">Email <span class="hint">(optional)</span></label><input class="input" type="email" id="sub-email" maxlength="200" autocomplete="email" data-bind-text="respondent.email" value="' + esc(state.respondent.email) + '"></div>' +
      '</div>' +
      '<div class="sr" aria-hidden="true"><label for="vm-website">Leave this empty</label><input id="vm-website" tabindex="-1" autocomplete="off"></div>' +
      '<p class="hint" id="submit-error" role="alert"></p>' +
      '<div class="actions"><button type="button" class="btn" data-action="retry-submit">Submit assessment</button></div></section>';
  }

  /* ------------------------------------------------------------------------
     10c. WORD (.docx) AND EXCEL (.xlsx) DOWNLOADS
     Built here in the browser. No external library, nothing sent anywhere.
     ------------------------------------------------------------------------ */

  // Every answer, grouped by section and split into Now / Goal / Notes.
  // Used by the Word and Excel files. Private items are left out unless the
  // visitor ticks "Include items I marked private".
  function answerSections() {
    var inc = !!state.exportIncludePrivate;
    var m = computeModel();
    var privIds = m.evals.filter(isPrivateEval).map(function (e) { return e.id; });
    function sc(v, labels) { if (v === 'ns') return 'Not sure'; if (typeof v !== 'number') return ''; return v + ' — ' + labels[v - 1]; }
    function L(listArr, id) { return id ? labelOf(listArr, id) : ''; }
    function many(listArr, ids) { return (ids || []).map(function (x) { return labelOf(listArr, x); }).join(', '); }
    var S = [];
    function add(id, title, now, goal, notes, extra) { S.push({ id: id, title: title, now: now.filter(function (r) { return r[1] !== ''; }), goal: goal.filter(function (r) { return r[1] !== ''; }), both: extra || [], notes: notes || '' }); }

    add('contexts', 'Rooms (contexts)',
      CONTEXTS.map(function (c) { return ['How visible are you in ' + c.label + ' today?', L(CTX_NOW, state.contextsNow[c.id])]; }),
      [['Rooms you want to plan for', state.contexts.map(function (c) { return (CONTEXTS.filter(function (x) { return x.id === c; })[0] || {}).label; }).join(', ')]],
      state.notes.contexts);
    add('identity', 'Parts of your life',
      [['What is part of your life right now?', selectedCats().map(function (c) { return c.label; }).join(', ')]],
      [['What do you most want to be known for?', state.knownFor.map(function (k) { var c = catById(k); return c ? c.label : k; }).join(', ')]],
      state.notes.identity);
    selectedCats().forEach(function (c) {
      var a = state.matrix[c.id] || {};
      var hidden = !inc && privIds.indexOf(c.id) > -1;
      if (hidden) { S.push({ id: 'matrix-' + c.id, title: 'Area: private item', now: [], goal: [], both: [['Answers', 'Hidden because you marked this area private']], notes: '' }); return; }
      add('matrix-' + c.id, 'Area: ' + c.label,
        [['How visible is this part of you right now?', sc(a.now, VIS_LABELS)], ['How do you feel about people knowing this today?', sc(a.comfort, COMFORT_LABELS)], ['How much could you shape how people understand it?', sc(a.control, CONTROL_LABELS)]],
        [['How visible do you want it to be?', sc(a.goal, VIS_LABELS)], ['How much would showing this help your goals?', sc(a.useful, USEFUL_LABELS)], ['Still fine with it being public in two years?', sc(a.future, DURABLE_LABELS)],
          ['Who should be able to see it?', many(ACCESS, a.access)], ['Worth keeping a private record of?', sc(a.value, VALUE_LABELS)]],
        a.note);
    });
    if (has('irl')) add('irl', 'Public / real life',
      IRL_NOW.map(function (q) { return [q.q, sc(state.irl[q.key], q.labels)]; }).concat([['When someone asks what you do, what do you usually say today?', L(IRL_INTRO, state.irl.intro)]]),
      IRL_QS.map(function (q) { return [q.q, sc(state.irl[q.key], q.labels)]; }).concat([['How do you want to introduce yourself?', L(IRL_INTRO, state.irl.introGoal)]]),
      state.notes.irl);
    if (has('social')) {
      var items = [];
      SOCIAL_GROUPS.forEach(function (g) { g.items.forEach(function (it) {
        var x = state.social.items[it[0]] || {};
        if (x.now || x.level || (x.reasons && x.reasons.length)) items.push([it[1], 'Now: ' + (x.now ? labelOf(SOCIAL_LEVELS, x.now) : '—') + ' · Goal: ' + (x.level ? labelOf(SOCIAL_LEVELS, x.level) : '—') + (x.reasons && x.reasons.length ? ' · Why: ' + many(SOCIAL_REASONS, x.reasons) : '')]);
      }); });
      add('social', 'Social media',
        [['How often do you post right now?', L(POST_FREQ, state.social.postNow)], ['Which platforms do you use?', many(PLATFORMS, state.social.platforms)]],
        [['How often do you want to post?', L(POST_FREQ, state.social.postGoal)], ['Prefer low-frequency, intentional posting?', state.social.lowFrequency ? 'Yes' : '']],
        state.notes.social, items);
    }
    if (has('career') || has('networking')) add('career', 'Career',
      [['What do you do now?', state.career.currentRole], ['What do people already associate with you at work?', many(ATTRIBUTES, state.career.nowKnownFor)],
        ['What proof of your work exists today?', many(EVIDENCE, state.career.evidence)], ['Where have you done good work but have little proof?', many(EVIDENCE, state.career.underDocumented)],
        ['How do you introduce yourself today?', state.career.nowIntro]],
      [['What role or direction are you aiming for next?', state.career.targetRole], ['What do you want to be known for?', many(ATTRIBUTES, state.career.attributes) + (state.career.otherAttribute ? ', ' + state.career.otherAttribute : '')],
        ['After one conversation, what should people understand?', many(NETWORK_LEAD, state.career.networkingLead)], ['How do you want to introduce yourself?', state.career.networkingLine]],
      state.notes.career);
    if (has('portfolio') || has('career')) {
      var pa = state.portfolio.areas;
      add('portfolio', 'Portfolio',
        [['What kind of work do you mostly do now?', state.portfolio.currentWork]].concat(pa.map(function (a) {
          var x = state.portfolio.answers[a] || {};
          return [labelOf(PORTFOLIO_AREAS, a) + ': proof today', PORTFOLIO_QS.slice(0, 5).map(function (q) { return q[1].replace(/\?$/, '') + ': ' + (x[q[0]] ? labelOf(TRI, x[q[0]]) : '—'); }).join(' · ')];
        })),
        pa.map(function (a) { var x = state.portfolio.answers[a] || {}; return [labelOf(PORTFOLIO_AREAS, a) + ': want more of this work?', x.wantMore ? labelOf(TRI, x.wantMore) : '']; })
          .concat([['What do you want to be hired for next?', state.portfolio.hiredForNote]]),
        state.notes.portfolio);
    }
    add('document', 'Documentation', [], [], state.notes.document, DOC_ITEMS.filter(function (it) { return state.documentationNow[it[0]] || state.documentation[it[0]]; }).map(function (it) {
      return [it[1], 'Now: ' + (state.documentationNow[it[0]] ? labelOf(DOC_NOW, state.documentationNow[it[0]]) : '—') + ' · Goal: ' + (state.documentation[it[0]] ? labelOf(DOC_CHOICES, state.documentation[it[0]]) : 'Not tracking')];
    }));
    if (inc) add('boundaries', 'Boundaries',
      [['Already public today, and you would like to change', many(BOUNDARIES, state.boundaries.exposedNow)]],
      [['Never share publicly', boundaryItems().join(', ')]], state.notes.boundaries);
    else S.push({ id: 'boundaries', title: 'Boundaries', now: [], goal: [], both: [['Answers', 'Hidden because boundaries are private. Tick “Include items I marked private” to include them.']], notes: '' });
    add('future', 'Future self',
      [['How would people describe you today?', state.future.currentIdentity]],
      [['Who do you want people to recognise you as in 1–3 years?', state.future.identity],
        ['How each part of your life fits that goal', selectedCats().filter(function (c) { return state.future.roles[c.id] && (inc || privIds.indexOf(c.id) === -1); }).map(function (c) { return c.label + ': ' + labelOf(FUTURE_ROLES, state.future.roles[c.id]); }).join('; ')],
        ['Evidence to start collecting', state.future.evidenceNeeded],
        ['Start documenting now', many(DOC_ITEMS, state.future.startDocumenting) + (state.future.documentingNote ? (state.future.startDocumenting.length ? ', ' : '') + state.future.documentingNote : '')]],
      state.notes.future);
    return S;
  }

  /* --- tiny ZIP writer (files stored uncompressed, which Word and Excel accept) --- */
  var CRC_TABLE = (function () {
    var t = new Uint32Array(256);
    for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); t[n] = c >>> 0; }
    return t;
  })();
  function crc32(bytes) { var c = 0xFFFFFFFF; for (var i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  function makeZip(files, mime) {
    var enc = new TextEncoder(), parts = [], central = [], offset = 0;
    var d = new Date();
    var dosTime = ((d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)) & 0xFFFF;
    var dosDate = (((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()) & 0xFFFF;
    files.forEach(function (f) {
      var name = enc.encode(f.name), data = enc.encode(f.data), crc = crc32(data);
      var h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true);
      h.setUint16(10, dosTime, true); h.setUint16(12, dosDate, true); h.setUint32(14, crc, true);
      h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, name.length, true); h.setUint16(28, 0, true);
      parts.push(new Uint8Array(h.buffer), name, data);
      var c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, 0, true);
      c.setUint16(12, dosTime, true); c.setUint16(14, dosDate, true); c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true);
      c.setUint16(28, name.length, true); c.setUint16(30, 0, true); c.setUint16(32, 0, true); c.setUint16(34, 0, true); c.setUint16(36, 0, true); c.setUint32(38, 0, true); c.setUint32(42, offset, true);
      central.push(new Uint8Array(c.buffer), name);
      offset += 30 + name.length + data.length;
    });
    var cdSize = central.reduce(function (a, b) { return a + b.length; }, 0);
    var e = new DataView(new ArrayBuffer(22));
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, cdSize, true); e.setUint32(16, offset, true);
    return new Blob(parts.concat(central, [new Uint8Array(e.buffer)]), { type: mime });
  }
  function xe(s) {
    return String(s == null ? '' : s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  var XML_HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

  /* --- Word --- */
  function wRun(text, o) {
    o = o || {};
    var rpr = (o.b ? '<w:b/>' : '') + (o.i ? '<w:i/>' : '') + (o.color ? '<w:color w:val="' + o.color + '"/>' : '') + (o.sz ? '<w:sz w:val="' + o.sz + '"/>' : '');
    return String(text == null ? '' : text).split('\n').map(function (line, i) {
      return '<w:r>' + (rpr ? '<w:rPr>' + rpr + '</w:rPr>' : '') + (i ? '<w:br/>' : '') + '<w:t xml:space="preserve">' + xe(line) + '</w:t></w:r>';
    }).join('');
  }
  var BOX = '<w:pBdr><w:top w:val="single" w:sz="6" w:space="6" w:color="C9C7D2"/><w:left w:val="single" w:sz="6" w:space="6" w:color="C9C7D2"/><w:bottom w:val="single" w:sz="6" w:space="6" w:color="C9C7D2"/><w:right w:val="single" w:sz="6" w:space="6" w:color="C9C7D2"/></w:pBdr><w:shd w:val="clear" w:color="auto" w:fill="F7F6FA"/>';
  function wP(runs, o) {
    o = o || {};
    var ppr = (o.style ? '<w:pStyle w:val="' + o.style + '"/>' : '') + (o.box ? BOX : '') + (o.after != null ? '<w:spacing w:after="' + o.after + '"/>' : '') + (o.ind ? '<w:ind w:left="' + o.ind + '"/>' : '');
    return '<w:p>' + (ppr ? '<w:pPr>' + ppr + '</w:pPr>' : '') + runs + '</w:p>';
  }
  function wH(text, level) { return wP(wRun(text), { style: level === 0 ? 'Title' : 'Heading' + level }); }
  function wTable(header, rows, widths) {
    var B = '<w:tblBorders>' + ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(function (s) { return '<w:' + s + ' w:val="single" w:sz="4" w:space="0" w:color="D5D3DC"/>'; }).join('') + '</w:tblBorders>';
    function cell(t, i, head) {
      return '<w:tc><w:tcPr><w:tcW w:w="' + widths[i] + '" w:type="dxa"/>' + (head ? '<w:shd w:val="clear" w:color="auto" w:fill="EDEBF2"/>' : '') + '</w:tcPr>' +
        wP(wRun(t, { b: head, sz: 18 }), { after: 0 }) + '</w:tc>';
    }
    return '<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/>' + B + '<w:tblCellMar><w:top w:w="60" w:type="dxa"/><w:left w:w="100" w:type="dxa"/><w:bottom w:w="60" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tblCellMar></w:tblPr>' +
      '<w:tblGrid>' + widths.map(function (w) { return '<w:gridCol w:w="' + w + '"/>'; }).join('') + '</w:tblGrid>' +
      '<w:tr><w:trPr><w:tblHeader/></w:trPr>' + header.map(function (h, i) { return cell(h, i, true); }).join('') + '</w:tr>' +
      rows.map(function (r) { return '<w:tr>' + r.map(function (c, i) { return cell(c, i, false); }).join('') + '</w:tr>'; }).join('') +
      '</w:tbl>' + wP('', { after: 120 });
  }
  function wNotes(text) {
    return wP(wRun('Your notes', { b: true, color: '64636D', sz: 18 }), { after: 60 }) +
      wP(wRun(text && String(text).trim() ? String(text).trim() : '\n\n\n', {}), { box: true, after: 240 });
  }
  function wQA(pairs) {
    return pairs.map(function (p) { return wP(wRun(p[0], { b: true, sz: 20 }), { after: 20 }) + wP(wRun(p[1] || '—'), { after: 140, ind: 240 }); }).join('');
  }

  function buildDocx() {
    var m = computeModel(), inc = !!state.exportIncludePrivate;
    var today = fmtDate(new Date().toISOString());
    var b = '';
    b += wH('Visibility Map — Personal Strategy', 0);
    b += wP(wRun('Assessment ID ' + state.assessmentId + '  ·  ' + today, { color: '64636D' }));
    if (!inc) b += wP(wRun('Items you marked private are left out of this document.', { i: true, color: '64636D', sz: 18 }));

    b += wH('Your visibility strategy', 1);
    if (m.pattern) {
      b += wP(wRun('Your strongest pattern is ' + m.pattern.title + '.', { b: true, sz: 26 }));
      if (m.secondary) b += wP(wRun('Secondary pattern: ' + m.secondary.title + '.'));
      b += wP(wRun(m.pattern.body)) + wP(wRun('What this means: ' + m.pattern.means));
    } else b += wP(wRun('Rate a few areas in the visibility matrix to see your pattern.'));

    var fg = fromToRows(m, inc);
    if (fg.length) { b += wH('From where you are to where you want to be', 1); b += wTable(['Area', 'Now', 'Goal', 'Change'], fg, [2600, 2400, 2400, 2238]); }
    var moves = fromToLines();
    if (moves.length) b += wTable(['Topic', 'Now', 'Goal'], moves, [2200, 3700, 3738]);

    b += wH('What to show, share, document and keep', 1);
    [['Show', m.show], ['Selectively share', m.selective], ['Document privately', m.document], ['Keep private', m.private]].forEach(function (g) {
      b += wH(g[0], 2);
      var items = g[1].filter(function (e) { return inc || !isPrivateEval(e); });
      if (!items.length) b += wP(wRun(g[1].length ? g[1].length + ' private item(s) hidden' : 'Nothing here from your answers.', { color: '64636D' }));
      items.forEach(function (e) { b += wP(wRun('• ' + e.label + (e.later ? ' (reveal later)' : '') + ': ', { b: true }) + wRun(e.why), { ind: 240, after: 60 }); });
    });

    b += wH('Visibility map', 1);
    var mapRows = m.evals.filter(function (e) { return inc || !isPrivateEval(e); }).map(function (e) {
      return [e.label].concat(MAP_COLS.map(function (c) { return e.rated ? (LEVELS[e.cells[c[0]]] || LEVELS.na).label : 'Not rated'; }));
    });
    b += mapRows.length ? wTable(['Area'].concat(MAP_COLS.map(function (c) { return c[1]; })), mapRows, [2038, 1270, 1270, 1270, 1270, 1270, 1250]) : wP(wRun('No areas selected.'));

    b += wH('Strategic dimensions', 1);
    b += wTable(['Dimension', 'Score (0–100)', 'Reading'], Object.keys(m.dims).map(function (k) {
      var d = m.dims[k], bd = band(d.value);
      return [d.name, d.value == null ? '—' : String(d.value), bd < 0 ? 'Not enough answers yet.' : DIM_READ[k][bd]];
    }), [2600, 1400, 5638]);

    b += wH('Personal brand pillars', 1);
    if (state.future.identity.trim()) b += wP(wRun('Building toward: ' + state.future.identity.trim(), { i: true }));
    if (!m.pillars.length) b += wP(wRun('Not enough answers yet to suggest pillars.'));
    m.pillars.forEach(function (p, i) {
      b += wH('Pillar ' + (i + 1) + ': ' + plain(p.name), 2);
      b += wQA([['What it represents', p.represents], ['Evidence to collect', list(p.evidence)], ['Potential channels', list(p.channels)]]);
    });

    if (inc && m.boundaries.length) { b += wH('Privacy boundaries', 1); m.boundaries.forEach(function (x) { b += wP(wRun('• ' + x), { ind: 240, after: 40 }); }); }

    b += wH('Your answers, section by section', 1);
    answerSections().forEach(function (s) {
      b += wH(s.title, 2);
      if (s.now.length) { b += wH('Where you are now', 3); b += wQA(s.now); }
      if (s.goal.length) { b += wH('Where you want to be', 3); b += wQA(s.goal); }
      if (s.both.length) { b += wH('Now and goal, item by item', 3); b += wQA(s.both); }
      if (!s.now.length && !s.goal.length && !s.both.length) b += wP(wRun('No answers yet.', { color: '64636D' }));
      if (s.title.indexOf('private item') === -1) b += wNotes(s.notes);
    });

    b += wH('Your reflections on these results', 1);
    b += wNotes(state.notes.results);
    b += wP(wRun('Your life doesn’t need to be public to be real.', { i: true, color: 'CC2B7A' }));

    var doc = XML_HEAD + '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>' + b +
      '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>';
    var H = function (id, name, sz, color, extra) {
      return '<w:style w:type="paragraph" w:styleId="' + id + '"><w:name w:val="' + name + '"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/>' +
        '<w:pPr><w:keepNext/><w:spacing w:before="' + (id === 'Title' ? 0 : 280) + '" w:after="100"/>' + (id === 'Title' ? '' : '<w:outlineLvl w:val="' + (Number(id.slice(-1)) - 1) + '"/>') + '</w:pPr>' +
        '<w:rPr>' + (extra || '') + '<w:b/>' + '<w:color w:val="' + color + '"/><w:sz w:val="' + sz + '"/></w:rPr></w:style>';
    };
    var styles = XML_HEAD + '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
      '<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="Calibri" w:cs="Calibri"/><w:sz w:val="22"/><w:szCs w:val="22"/><w:lang w:val="en-GB"/></w:rPr></w:rPrDefault>' +
      '<w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>' +
      '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/><w:rPr><w:color w:val="1C1C21"/></w:rPr></w:style>' +
      H('Title', 'Title', 48, '1C1C21', '<w:rFonts w:ascii="Georgia" w:hAnsi="Georgia"/>') +
      H('Heading1', 'heading 1', 32, 'CC2B7A', '<w:rFonts w:ascii="Georgia" w:hAnsi="Georgia"/>') +
      H('Heading2', 'heading 2', 26, '1C1C21') +
      H('Heading3', 'heading 3', 20, '1D71C9') +
      '</w:styles>';
    return makeZip([
      { name: '[Content_Types].xml', data: XML_HEAD + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>' },
      { name: '_rels/.rels', data: XML_HEAD + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>' },
      { name: 'docProps/core.xml', data: XML_HEAD + '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>Visibility Map ' + xe(state.assessmentId) + '</dc:title><dc:creator>Visibility Map</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">' + new Date().toISOString().slice(0, 19) + 'Z</dcterms:created></cp:coreProperties>' },
      { name: 'word/_rels/document.xml.rels', data: XML_HEAD + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>' },
      { name: 'word/document.xml', data: doc },
      { name: 'word/styles.xml', data: styles }
    ], 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  }

  /* --- Excel --- */
  function colName(i) { var s = ''; i++; while (i > 0) { var r = (i - 1) % 26; s = String.fromCharCode(65 + r) + s; i = Math.floor((i - 1) / 26); } return s; }
  function sheetXml(rows, widths) {
    var data = rows.map(function (r, ri) {
      return '<row r="' + (ri + 1) + '">' + r.map(function (v, ci) {
        var ref = colName(ci) + (ri + 1), s = ri ? 2 : 1;
        if (typeof v === 'number' && isFinite(v)) return '<c r="' + ref + '" s="' + s + '"><v>' + v + '</v></c>';
        if (v == null || v === '') return '<c r="' + ref + '" s="' + s + '"/>';
        return '<c r="' + ref + '" t="inlineStr" s="' + s + '"><is><t xml:space="preserve">' + xe(String(v).slice(0, 32000)) + '</t></is></c>';
      }).join('') + '</row>';
    }).join('');
    return XML_HEAD + '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' +
      '<sheetFormatPr defaultRowHeight="15"/><cols>' + widths.map(function (w, i) { return '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + w + '" customWidth="1"/>'; }).join('') + '</cols>' +
      '<sheetData>' + data + '</sheetData></worksheet>';
  }
  function buildXlsx() {
    var m = computeModel(), inc = !!state.exportIncludePrivate;
    var sheets = [];
    var sum = [['Field', 'Value'], ['Assessment ID', state.assessmentId], ['Date', fmtDate(new Date().toISOString())],
      ['Primary strategy', m.pattern ? m.pattern.title : ''], ['Secondary strategy', m.secondary ? m.secondary.title : ''],
      ['What it means', m.pattern ? m.pattern.body + ' ' + m.pattern.means : ''], ['Areas rated', m.rated.length + ' of ' + m.evals.length]];
    Object.keys(m.dims).forEach(function (k) { sum.push([m.dims[k].name + ' (0–100)', m.dims[k].value == null ? '' : m.dims[k].value]); });
    m.pillars.forEach(function (p, i) { sum.push(['Brand pillar ' + (i + 1), plain(p.name) + ' — ' + p.represents]); });
    if (state.future.identity.trim()) sum.push(['Building toward', state.future.identity.trim()]);
    if (!inc) sum.push(['Privacy', 'Items marked private are not included in this file.']);
    sheets.push(['Summary', sum, [28, 90]]);

    var ng = [['Area', 'Visible now', 'Goal', 'Change', 'Comfort today', 'Useful for goals', 'Control', 'Recommendation', 'Your notes']];
    m.evals.filter(function (e) { return inc || !isPrivateEval(e); }).forEach(function (e) {
      var a = state.matrix[e.id] || {};
      ng.push([e.label, typeof a.now === 'number' ? VIS_LABELS[a.now - 1] : '', typeof a.goal === 'number' ? VIS_LABELS[a.goal - 1] : '', changeLabel(e),
        typeof a.comfort === 'number' ? a.comfort : '', typeof a.useful === 'number' ? a.useful : '', typeof a.control === 'number' ? a.control : '',
        matrixRow(e).recommendation, a.note || '']);
    });
    sheets.push(['Now vs Goal', ng, [22, 20, 20, 18, 14, 16, 10, 20, 50]]);

    var mp = [['Area'].concat(MAP_COLS.map(function (c) { return c[1]; })).concat(['Reveal later'])];
    m.evals.filter(function (e) { return inc || !isPrivateEval(e); }).forEach(function (e) {
      var r = matrixRow(e); mp.push([e.label, r.irl, r.social, r.career, r.portfolio, r.friends, r.private, r.reveal_later ? 'Yes' : '']);
    });
    sheets.push(['Visibility Map', mp, [24, 14, 14, 14, 14, 14, 16, 12]]);

    var ans = [['Section', 'Now / Goal', 'Question', 'Answer']];
    var notes = [['Section', 'Your notes (type here too)']];
    answerSections().forEach(function (s) {
      s.now.forEach(function (p) { ans.push([s.title, 'Now', p[0], p[1]]); });
      s.goal.forEach(function (p) { ans.push([s.title, 'Goal', p[0], p[1]]); });
      s.both.forEach(function (p) { ans.push([s.title, 'Now and goal', p[0], p[1]]); });
      if (s.title.indexOf('private item') === -1) notes.push([s.title, s.notes || '']);
    });
    notes.push(['Your reflections on the results', state.notes.results || '']);
    sheets.push(['Answers', ans, [24, 13, 50, 60]]);
    sheets.push(['Notes', notes, [30, 100]]);

    var rec = [['Recommendation', 'Area', 'Why', 'Reveal later']];
    [['Show', m.show], ['Selectively share', m.selective], ['Document privately', m.document], ['Keep private', m.private]].forEach(function (g) {
      g[1].forEach(function (e) { if (inc || !isPrivateEval(e)) rec.push([g[0], e.label, e.why, e.later ? 'Yes' : '']); });
    });
    sheets.push(['Recommendations', rec, [20, 24, 70, 12]]);

    var log = [['Project', 'Evidence', 'Date', 'Result', 'Link', 'Notes', 'Status']];
    state.dashboard.entries.filter(function (e) { return inc || e.status !== 'private'; }).forEach(function (e) {
      log.push([e.project, e.evidence, e.date, e.result, e.link, e.notes, labelOf(DASH_STATUS, e.status)]);
    });
    sheets.push(['Documentation Log', log, [28, 24, 12, 24, 30, 40, 16]]);

    var files = [];
    files.push({ name: '[Content_Types].xml', data: XML_HEAD + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
      sheets.map(function (s, i) { return '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'; }).join('') + '</Types>' });
    files.push({ name: '_rels/.rels', data: XML_HEAD + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' });
    files.push({ name: 'xl/workbook.xml', data: XML_HEAD + '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' +
      sheets.map(function (s, i) { return '<sheet name="' + xe(s[0]) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>'; }).join('') + '</sheets></workbook>' });
    files.push({ name: 'xl/_rels/workbook.xml.rels', data: XML_HEAD + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      sheets.map(function (s, i) { return '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>'; }).join('') +
      '<Relationship Id="rId' + (sheets.length + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>' });
    files.push({ name: 'xl/styles.xml', data: XML_HEAD + '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>' +
      '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFEDEBF2"/><bgColor indexed="64"/></patternFill></fill></fills>' +
      '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
      '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
      '<cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
      '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>' +
      '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf></cellXfs>' +
      '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>' });
    sheets.forEach(function (s, i) { files.push({ name: 'xl/worksheets/sheet' + (i + 1) + '.xml', data: sheetXml(s[1], s[2]) }); });
    return makeZip(files, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  }

  /* --- saving a file: a normal download on your website; the preview's save prompt inside Claude --- */
  function saveBlob(blob, filename, okMsg) {
    if (FRAMED) {
      var use = window.claude && typeof window.claude.use === 'function' ? window.claude.use('downloads') : Promise.resolve(null);
      Promise.resolve(use).then(function (dl) {
        if (!dl) { toast('Downloads are not available in this preview. They work on your published website.'); return; }
        return dl.save({ filename: filename, data: blob }).then(function () { toast(okMsg); }, function (err) {
          if (err && err.code === 'declined') return;
          toast('The file could not be saved here. It works on your published website.');
        });
      }, function () { toast('Downloads are not available in this preview.'); });
      return;
    }
    try {
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 1500);
      toast(okMsg);
    } catch (e) { toast('Download failed. Try “Copy summary” instead.'); }
  }
  function downloadDocx() { try { saveBlob(buildDocx(), 'visibility-map-' + state.assessmentId + '.docx', 'Downloaded your strategy as a Word document.'); } catch (e) { if (window.console) console.warn('[Visibility Map] docx', e); toast('Could not create the Word file.'); } }
  function downloadXlsx() { try { saveBlob(buildXlsx(), 'visibility-map-' + state.assessmentId + '.xlsx', 'Downloaded your strategy as an Excel workbook.'); } catch (e) { if (window.console) console.warn('[Visibility Map] xlsx', e); toast('Could not create the Excel file.'); } }

  /* ------------------------------------------------------------------------
     11. DASHBOARD
     ------------------------------------------------------------------------ */

  var editingId = null;
  var draftShot = null; // data URL for the form's screenshot (null = unchanged)

  function viewDashboard() {
    var entries = state.dashboard.entries;
    var e = editingId ? entries.filter(function (x) { return x.id === editingId; })[0] : null;
    if (editingId && !e) editingId = null;
    var shot = draftShot !== null ? draftShot : (e ? e.screenshot : '');
    var h = '<p class="lead">A private working log. Record evidence as it happens, decide its visibility when you are ready. <strong>Documentation and publication are separate decisions.</strong></p>';
    h += '<div class="form-card" id="entry-form-card"><div class="section-head"><h2>' + (e ? 'Edit <em>entry</em>' : 'Add an <em>entry</em>') + '</h2></div>' +
      '<form class="entry-form" data-form="entry" novalidate>' +
      '<div class="field full"><label for="en-project">Project</label><input class="input" id="en-project" maxlength="140" required value="' + esc(e ? e.project : '') + '" placeholder="e.g. Ramadan dining campaign"></div>' +
      '<div class="field"><label for="en-evidence">Evidence</label><input class="input" id="en-evidence" maxlength="200" value="' + esc(e ? e.evidence : '') + '" placeholder="e.g. Campaign report, creator roster"></div>' +
      '<div class="field"><label for="en-date">Date</label><input class="input" type="date" id="en-date" value="' + esc(e ? e.date : '') + '"></div>' +
      '<div class="field"><label for="en-result">Result</label><input class="input" id="en-result" maxlength="200" value="' + esc(e ? e.result : '') + '" placeholder="e.g. 38 creators, 2.1M views"></div>' +
      '<div class="field"><label for="en-link">Link</label><input class="input" type="url" id="en-link" maxlength="500" value="' + esc(e ? e.link : '') + '" placeholder="https://"></div>' +
      '<div class="field full"><label for="en-shot">Screenshot</label><p class="hint">Stored in this browser only, resized to save space.</p>' +
        '<div class="shot-preview">' + (shot ? '<img src="' + shot + '" alt="Screenshot preview"><button type="button" class="btn btn-sm" data-action="remove-shot">Remove screenshot</button>' : '') +
        '<input type="file" id="en-shot" accept="image/*" class="input" data-shot></div></div>' +
      '<div class="field full"><label for="en-notes">Notes</label><textarea class="textarea" id="en-notes" rows="3" maxlength="2000" placeholder="Context, your role, what you would say about it">' + esc(e ? e.notes : '') + '</textarea></div>' +
      '<div class="field"><label for="en-status">Status</label><select class="select" id="en-status">' + DASH_STATUS.map(function (s) {
        var sel = e ? e.status === s[0] : s[0] === 'review';
        return '<option value="' + s[0] + '"' + (sel ? ' selected' : '') + '>' + s[1] + '</option>';
      }).join('') + '</select></div>' +
      '<div class="field" style="justify-content:flex-end"><div class="actions"><button type="submit" class="btn btn-primary">' + (e ? 'Save changes' : 'Add entry') + '</button>' +
      (e ? '<button type="button" class="btn" data-action="cancel-edit">Cancel</button>' : '') + '</div></div>' +
      '<p class="full hint" id="entry-error" role="alert"></p>' +
      '</form></div>';

    var sugg = suggestions();
    if (sugg.length) {
      h += '<div class="note">' + tag('document') + '<span>Your results list ' + sugg.length + ' piece' + (sugg.length > 1 ? 's' : '') + ' of proof to collect. <button type="button" class="linkbtn" data-action="add-suggestions">Add them to “To document”</button></span></div>';
    }

    h += '<div class="board">' + DASH_STATUS.map(function (s) {
      var items = entries.filter(function (x) { return x.status === s[0]; });
      return '<section class="col" aria-labelledby="col-' + s[0] + '"><div class="col-head">' + tag(s[3]) + '<h3 id="col-' + s[0] + '">' + s[1] + '</h3><span class="count">' + items.length + '</span></div>' +
        '<p class="col-desc">' + s[2] + '</p>' +
        (items.length ? items.map(entryCard).join('') : '<p class="empty">Nothing here.</p>') + '</section>';
    }).join('') + '</div>';
    return h;
  }

  function entryCard(e) {
    var safeLink = /^https?:\/\//i.test(e.link) ? e.link : '';
    return '<article class="entry"><h4>' + esc(e.project || 'Untitled') + '</h4>' +
      (e.date ? '<span class="meta">' + esc(e.date) + '</span>' : '') +
      (e.evidence ? '<p><b>Evidence:</b> ' + esc(e.evidence) + '</p>' : '') +
      (e.result ? '<p><b>Result:</b> ' + esc(e.result) + '</p>' : '') +
      (e.screenshot ? '<img src="' + e.screenshot + '" alt="Screenshot for ' + esc(e.project) + '">' : '') +
      (safeLink ? '<a href="' + esc(safeLink) + '" target="_blank" rel="noopener noreferrer">' + esc(safeLink.replace(/^https?:\/\//, '').slice(0, 60)) + '</a>' : (e.link ? '<p>' + esc(e.link) + '</p>' : '')) +
      (e.notes ? '<p>' + esc(e.notes) + '</p>' : '') +
      '<div class="entry-actions"><label class="sr" for="st-' + esc(e.id) + '">Move ' + esc(e.project) + ' to</label>' +
      '<select class="select" id="st-' + esc(e.id) + '" data-entry-status="' + esc(e.id) + '">' + DASH_STATUS.map(function (s) { return '<option value="' + s[0] + '"' + (e.status === s[0] ? ' selected' : '') + '>' + s[1] + '</option>'; }).join('') + '</select>' +
      '<button type="button" class="btn btn-sm" data-action="edit-entry" data-id="' + esc(e.id) + '">Edit</button>' +
      '<button type="button" class="btn btn-sm btn-danger" data-action="delete-entry" data-id="' + esc(e.id) + '">Delete</button></div></article>';
  }

  function suggestions() {
    var m = computeModel();
    var out = [];
    if (has('career') || has('networking') || state.portfolio.areas.length) {
      var cm = careerModel(m);
      cm.gaps.forEach(function (g, i) { if (cm.proof[i]) out.push({ project: g, notes: cm.proof[i] }); });
    }
    if (state.future.evidenceNeeded.trim()) out.push({ project: 'Evidence for my future identity', notes: state.future.evidenceNeeded.trim() });
    var existing = state.dashboard.entries.map(function (e) { return e.project; });
    return out.filter(function (s) { return existing.indexOf(s.project) === -1; });
  }

  function downscale(file, cb) {
    var reader = new FileReader();
    reader.onload = function () {
      var img = new Image();
      img.onload = function () {
        var max = 900, w = img.width, h = img.height;
        if (w > max || h > max) { var r = Math.min(max / w, max / h); w = Math.round(w * r); h = Math.round(h * r); }
        var cv = document.createElement('canvas'); cv.width = w; cv.height = h;
        cv.getContext('2d').drawImage(img, 0, 0, w, h);
        try { cb(cv.toDataURL('image/jpeg', 0.72)); } catch (e) { cb(null); }
      };
      img.onerror = function () { cb(null); };
      img.src = String(reader.result);
    };
    reader.onerror = function () { cb(null); };
    reader.readAsDataURL(file);
  }

  /* ------------------------------------------------------------------------
     12. RENDER
     ------------------------------------------------------------------------ */

  var VIEWS = {
    landing: viewLanding, contexts: viewContexts, identity: viewIdentity, matrix: viewMatrix, irl: viewIRL, social: viewSocial,
    career: viewCareer, portfolio: viewPortfolio, document: viewDocument, boundaries: viewBoundaries, future: viewFuture,
    results: viewResults, dashboard: viewDashboard
  };

  function render(opts) {
    opts = opts || {};
    if (!VIEWS[state.step]) state.step = 'landing';
    document.body.classList.toggle('hide-private', !state.exportIncludePrivate);
    renderSidebar();
    renderToolbar();
    var view = $('#view');
    view.classList.remove('enter');
    view.innerHTML = VIEWS[state.step]();
    if (opts.animate) { void view.offsetWidth; view.classList.add('enter'); }
    renderStepnav();
    document.title = (state.step === 'landing' ? '' : ((stepDef(state.step) || {}).short || (PAGES[state.step] || {}).short) + ' · ') + 'Visibility Map';
    if (opts.focus) { var t = $('#view-title'); if (t) t.focus({ preventScroll: true }); }
  }

  function refreshChrome() { renderSidebar(); renderToolbar(); renderStepnav(); }

  var toastTimer = null;
  function toast(msg) {
    var t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 3200);
  }

  /* ------------------------------------------------------------------------
     13. EVENTS
     ------------------------------------------------------------------------ */

  function afterBind(path) {
    scheduleSave();
    if (path === 'contexts') { var n = $('#ctx-note'); if (n) n.innerHTML = contextNote(); refreshChrome(); }
    else if (path === 'knownFor') { var kf0 = $('#known-for'); if (kf0) { var fo = document.activeElement && document.activeElement.value; kf0.innerHTML = knownForBlock(); var back = fo && $('#known-for input[value="' + CSS.escape(fo) + '"]'); if (back) back.focus(); } }
    else if (path === 'categories') { var cc = $('#cat-count'); if (cc) cc.textContent = catCountText(); var kf = $('#known-for'); if (kf) kf.innerHTML = knownForBlock(); if (state.matrixIndex >= state.categories.length) state.matrixIndex = Math.max(0, state.categories.length - 1); renderSidebar(); }
    else if (path.indexOf('boundaries') === 0) { var bp = $('#boundary-preview'); if (bp) bp.innerHTML = boundaryPreview(); }
    else if (path === 'career.attributes') { var ac = $('#attr-count'); if (ac) ac.textContent = attrCountText(); }
    else if (path === 'portfolio.areas') { var pa = $('#pf-audit'); if (pa) pa.innerHTML = portfolioAudit(); var pg = $('#pf-goal'); if (pg) pg.innerHTML = portfolioGoal(); }
    else if (path === 'exportIncludePrivate') { document.body.classList.toggle('hide-private', !state.exportIncludePrivate); $$('[data-bind-bool="exportIncludePrivate"]').forEach(function (i) { i.checked = state.exportIncludePrivate; }); }
    else if (path.indexOf('respondent.') === 0) { var se = $('#submit-error'); if (se) se.textContent = ''; }
    else if (/^matrix\.[^.]+\.(now|goal)$/.test(path)) { var gl = $('#gap-line'); if (gl) gl.textContent = gapText(state.matrix[path.split('.')[1]] || {}); var ms2 = $('#mx-strip'); if (ms2) ms2.innerHTML = matrixStrip(); renderSidebar(); }
    else if (path.indexOf('matrix.') === 0) { var ms = $('#mx-strip'); if (ms) ms.innerHTML = matrixStrip(); renderSidebar(); }
  }

  document.addEventListener('change', function (ev) {
    var el = ev.target;
    if (el.matches('select[data-bind]')) {
      setPath(el.getAttribute('data-bind'), el.value === '' ? undefined : el.value);
      afterBind(el.getAttribute('data-bind'));
      return;
    }
    if (el.matches('[data-bind]') && el.type === 'radio') {
      var v = el.value;
      var val = /^\d+$/.test(v) ? Number(v) : v;
      setPath(el.getAttribute('data-bind'), val);
      var cap = $('[data-caption-for="' + el.getAttribute('data-bind') + '"]');
      if (cap) { try { cap.innerHTML = captionText(val, JSON.parse(cap.getAttribute('data-labels'))); } catch (e) { /* ignore */ } }
      // Show "clear" affordance on rows that support it
      var row = el.closest('.row-body');
      if (row && !$('[data-action="clear"]', row) && (el.getAttribute('data-bind').indexOf('documentation.') === 0 || /^social\.items\.[^.]+\.level$/.test(el.getAttribute('data-bind')))) {
        var b = document.createElement('button');
        b.type = 'button'; b.className = 'linkbtn'; b.setAttribute('data-action', 'clear'); b.setAttribute('data-path', el.getAttribute('data-bind'));
        b.textContent = el.getAttribute('data-bind').indexOf('documentation.') === 0 ? 'Not tracking this' : 'Clear level';
        row.appendChild(b);
      }
      afterBind(el.getAttribute('data-bind'));
      return;
    }
    if (el.matches('[data-bind-array]')) {
      var path = el.getAttribute('data-bind-array');
      var arr = (getPath(path) || []).slice();
      var val2 = el.value;
      if (el.checked) { if (arr.indexOf(val2) === -1) arr.push(val2); }
      else arr = arr.filter(function (x) { return x !== val2; });
      // "Nobody" is exclusive in access lists
      if (/\.access$/.test(path)) {
        if (val2 === 'nobody' && el.checked) arr = ['nobody'];
        else if (val2 !== 'nobody' && el.checked) arr = arr.filter(function (x) { return x !== 'nobody'; });
        $$('[data-bind-array="' + path + '"]').forEach(function (i) { i.checked = arr.indexOf(i.value) > -1; });
      }
      if (/^social\.items\.[^.]+\.reasons$/.test(path)) {
        var sum = el.closest('details') && $('summary', el.closest('details'));
        if (sum) sum.textContent = 'Why would you share this?' + (arr.length ? ' (' + arr.length + ')' : '');
      }
      setPath(path, arr);
      afterBind(path);
      return;
    }
    if (el.matches('[data-bind-bool]')) { setPath(el.getAttribute('data-bind-bool'), el.checked); afterBind(el.getAttribute('data-bind-bool')); return; }
    if (el.matches('[data-import]')) { handleImportFile(el); return; }
    if (el.matches('[data-entry-status]')) {
      var id = el.getAttribute('data-entry-status');
      state.dashboard.entries.forEach(function (x) { if (x.id === id) x.status = el.value; });
      persistNow('Moved to ' + labelOf(DASH_STATUS, el.value) + '.');
      render();
      var s = $('#st-' + CSS.escape(id)); if (s) s.focus();
      return;
    }
    if (el.matches('[data-shot]')) {
      var f = el.files && el.files[0];
      if (!f) return;
      if (!/^image\//.test(f.type)) { toast('Choose an image file.'); el.value = ''; return; }
      downscale(f, function (data) {
        if (!data) { toast('That image could not be read.'); return; }
        draftShot = data;
        keepFormValues(function () { render(); });
        toast('Screenshot attached. Save the entry to keep it.');
      });
    }
  });

  document.addEventListener('input', function (ev) {
    var el = ev.target;
    if (el.matches('[data-bind-text]')) {
      setPath(el.getAttribute('data-bind-text'), el.value);
      afterBind(el.getAttribute('data-bind-text'));
    }
  });

  function persistNow(msg) {
    clearTimeout(saveTimer);
    var ok = persist();
    if (!ok) toast('Could not save in this browser (storage full or blocked). Export your data to keep it.');
    else if (msg) toast(msg);
    return ok;
  }

  function keepFormValues(fn) {
    var ids = ['en-project', 'en-evidence', 'en-date', 'en-result', 'en-link', 'en-notes', 'en-status'];
    var vals = {};
    ids.forEach(function (id) { var el = document.getElementById(id); if (el) vals[id] = el.value; });
    fn();
    ids.forEach(function (id) { var el = document.getElementById(id); if (el && vals[id] != null) el.value = vals[id]; });
  }

  function armed(btn, label) {
    if (btn.hasAttribute('data-armed')) return true;
    var orig = btn.innerHTML;
    btn.setAttribute('data-armed', '');
    btn.textContent = label;
    setTimeout(function () { if (btn.isConnected) { btn.removeAttribute('data-armed'); btn.innerHTML = orig; } }, 4000);
    return false;
  }

  document.addEventListener('click', function (ev) {
    var btn = ev.target.closest('[data-action]');
    if (!btn) return;
    var a = btn.getAttribute('data-action');
    switch (a) {
      case 'start': ev.preventDefault(); go(state.lastStep && isStep(state.lastStep) && hasAnswers() ? state.lastStep : 'contexts'); break;
      case 'how': { var how = $('#how'); if (how) { how.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }); how.focus({ preventScroll: true }); } break; }
      case 'go': closeDialogs(); go(btn.getAttribute('data-to'), btn.getAttribute('data-to') === 'matrix' ? { matrixIndex: state.matrixIndex } : {}); break;
      case 'next': next(false); break;
      case 'skip': next(true); break;
      case 'back': back(); break;
      case 'save-exit':
        if (isStep(state.step)) state.lastStep = state.step;
        persistNow();
        go('landing');
        toast(storageOK ? 'Saved. Pick up where you left off any time.' : 'Could not save here. Export your answers first.');
        break;
      case 'save': persistNow('Saved in this browser at ' + fmtTime(new Date().toISOString()) + '.'); if ($('#data-dialog').open) { $('#data-dialog').innerHTML = '<div class="sheet-inner"><div class="sheet-head"><h2 id="data-dialog-title">Your data</h2><button type="button" class="btn btn-sm" data-action="close-dialog">Close</button></div>' + dataPanel('dialog') + '</div>'; } break;
      case 'matrix-jump': state.matrixIndex = Number(btn.getAttribute('data-index')) || 0; render({ focus: false, animate: true }); scheduleSave(); { var cur = $('.mx-tab[aria-current="true"]'); if (cur) cur.focus(); } break;
      case 'go-matrix-unrated': {
        var cats = selectedCats(), idx = 0;
        for (var i = 0; i < cats.length; i++) { var x = state.matrix[cats[i].id] || {}; if (x.comfort == null && x.useful == null) { idx = i; break; } }
        go('matrix', { matrixIndex: idx });
        break;
      }
      case 'clear': setPath(btn.getAttribute('data-path'), undefined); scheduleSave(); { var group = btn.closest('.row-body'); if (group) $$('input[type="radio"]', group).forEach(function (r) { r.checked = false; }); btn.remove(); } break;
      case 'remove-custom': {
        ev.preventDefault(); ev.stopPropagation();
        var cid = btn.getAttribute('data-id');
        var cu = state.custom.filter(function (c) { return c.id === cid; })[0];
        if (!armed(btn, 'Remove?')) return;
        state.custom = state.custom.filter(function (c) { return c.id !== cid; });
        state.categories = state.categories.filter(function (c) { return c !== cid; });
        delete state.matrix[cid]; delete state.future.roles[cid];
        persistNow('Removed ' + (cu ? cu.label : 'area') + '.');
        render();
        break;
      }
      case 'open-data': openData(); break;
      case 'import': { var panel = btn.closest('.data-panel'); var fi = panel && $('[data-import]', panel); if (fi) fi.click(); break; }
      case 'open-menu': openMenu(); break;
      case 'close-dialog': closeDialogs(); break;
      case 'download-json': downloadJSON(); break;
      case 'download-docx': downloadDocx(); break;
      case 'download-xlsx': downloadXlsx(); break;
      case 'download-results-json': downloadResultsJSON(); break;
      case 'copy-json': copyText(exportPayload(), 'Copied your full backup.', btn); break;
      case 'copy-results-json': copyText(resultsExport(), 'Copied your results as JSON.', btn); break;
      case 'submit': submitAssessment({ send: true }); break;
      case 'results-no-submit': if (!submitting) { if (isStep(state.step)) state.visited[state.step] = true; lastNotice = null; go('results'); } break;
      case 'retry-submit': submitAssessment({ send: true, retry: true }); break;
      case 'copy-summary': copyText(summaryText(), 'Copied your strategy summary.', btn); break;
      case 'print': closeDialogs(); if (state.step !== 'results') { go('results', { focus: false }); setTimeout(function () { window.print(); }, 120); } else window.print(); break;
      case 'clear-all': {
        var slot = slotFor(btn);
        showSlot(slot, '<div class="confirm"><p>Clear all data? This removes every answer and dashboard entry from this browser. Export first if you might want them back.</p>' +
          '<div class="actions"><button type="button" class="btn btn-danger btn-sm" data-action="confirm-clear">Clear everything</button><button type="button" class="btn btn-sm" data-action="cancel-slot">Cancel</button></div></div>');
        var cb = slot && $('[data-action="confirm-clear"]', slot); if (cb) cb.focus();
        break;
      }
      case 'confirm-clear':
        try { localStorage.removeItem(STORE_KEY); } catch (e) { /* ignore */ }
        state = defaults(); editingId = null; draftShot = null;
        closeDialogs();
        go('landing');
        toast('All data cleared from this browser.');
        break;
      case 'cancel-slot': { var s2 = btn.closest('.data-slot, #start-over-slot'); if (s2) s2.innerHTML = ''; pendingImport = null; break; }
      case 'confirm-import':
        if (pendingImport) {
          state = pendingImport; pendingImport = null; editingId = null; draftShot = null;
          state.step = 'results';
          persistNow();
          closeDialogs();
          render({ focus: true, animate: true });
          window.scrollTo({ top: 0 });
          toast('Imported. Your results are below.');
        }
        break;
      case 'start-over': {
        var so = $('#start-over-slot');
        if (so) {
          so.innerHTML = '<div class="confirm"><p>Start over? Your answers will be cleared from this browser.</p>' +
            '<label class="check"><input type="checkbox" id="so-dash"> Also clear the documentation dashboard (' + state.dashboard.entries.length + ' entries)</label>' +
            '<div class="actions"><button type="button" class="btn btn-danger btn-sm" data-action="confirm-start-over">Clear answers and start over</button><button type="button" class="btn btn-sm" data-action="cancel-slot">Cancel</button></div></div>';
          $('[data-action="confirm-start-over"]', so).focus();
        }
        break;
      }
      case 'confirm-start-over': {
        var keepDash = !($('#so-dash') && $('#so-dash').checked);
        var entries = state.dashboard.entries;
        state = defaults();
        if (keepDash) state.dashboard.entries = entries;
        persistNow();
        go('contexts');
        toast(keepDash ? 'Answers cleared. Your dashboard is kept.' : 'Everything cleared. Starting fresh.');
        break;
      }
      case 'edit-entry': editingId = btn.getAttribute('data-id'); draftShot = null; render(); { var fc = $('#en-project'); if (fc) { fc.focus(); $('#entry-form-card').scrollIntoView({ block: 'start' }); } } break;
      case 'cancel-edit': editingId = null; draftShot = null; render(); break;
      case 'remove-shot': draftShot = ''; keepFormValues(function () { render(); }); break;
      case 'delete-entry': {
        if (!armed(btn, 'Confirm delete')) return;
        var did = btn.getAttribute('data-id');
        state.dashboard.entries = state.dashboard.entries.filter(function (x) { return x.id !== did; });
        if (editingId === did) { editingId = null; draftShot = null; }
        persistNow('Entry deleted.');
        render();
        break;
      }
      case 'add-suggestions': {
        var sg = suggestions();
        sg.forEach(function (s) { state.dashboard.entries.push({ id: uid(), project: s.project, evidence: '', date: '', result: '', screenshot: '', link: '', notes: s.notes, status: 'document' }); });
        persistNow('Added ' + sg.length + ' item' + (sg.length === 1 ? '' : 's') + ' to “To document”.');
        render();
        break;
      }
    }
  });

  document.addEventListener('submit', function (ev) {
    var form = ev.target;
    var kind = form.getAttribute('data-form');
    if (!kind) return;
    ev.preventDefault();
    if (kind === 'custom') {
      var input = $('#custom-cat');
      var label = (input.value || '').trim().replace(/\s+/g, ' ');
      if (!label) { input.focus(); toast('Type a name for the area first.'); return; }
      var dup = allCategories().filter(function (c) { return c.label.toLowerCase() === label.toLowerCase(); })[0];
      if (dup) {
        if (state.categories.indexOf(dup.id) === -1) state.categories.push(dup.id);
        persistNow('“' + dup.label + '” is already in the list and is now selected.');
        render(); $('#custom-cat').focus();
        return;
      }
      var id = 'c-' + uid();
      state.custom.push({ id: id, label: label.slice(0, 60), work: !!($('#custom-work') && $('#custom-work').checked) });
      state.categories.push(id);
      persistNow('Added “' + label.slice(0, 60) + '”.');
      render();
      $('#custom-cat').focus();
      return;
    }
    if (kind === 'entry') {
      var project = $('#en-project').value.trim();
      var err = $('#entry-error');
      if (!project) { err.textContent = 'Give the entry a project name so you can find it later.'; $('#en-project').focus(); return; }
      var link = $('#en-link').value.trim();
      if (link && !/^https?:\/\/\S+$/i.test(link)) { err.textContent = 'Links need to start with http:// or https://. Leave it empty if you do not have one.'; $('#en-link').focus(); return; }
      var data = {
        project: project, evidence: $('#en-evidence').value.trim(), date: $('#en-date').value, result: $('#en-result').value.trim(),
        link: link, notes: $('#en-notes').value.trim(), status: $('#en-status').value
      };
      var prevEntries = JSON.parse(JSON.stringify(state.dashboard.entries));
      if (editingId) {
        state.dashboard.entries.forEach(function (x) {
          if (x.id === editingId) { Object.keys(data).forEach(function (k) { x[k] = data[k]; }); if (draftShot !== null) x.screenshot = draftShot; }
        });
      } else {
        data.id = uid(); data.screenshot = draftShot || '';
        state.dashboard.entries.push(data);
      }
      if (!persist()) {
        state.dashboard.entries = prevEntries;
        err.textContent = 'This browser ran out of storage. Try removing the screenshot or an older entry’s screenshot, then save again.';
        return;
      }
      var wasEdit = !!editingId;
      editingId = null; draftShot = null;
      render();
      toast(wasEdit ? 'Changes saved.' : 'Entry added to ' + labelOf(DASH_STATUS, data.status) + '.');
      $('#en-project').focus();
    }
  });

  document.addEventListener('keydown', function (ev) {
    // Allow Enter on the custom-category field without submitting other forms
    if (ev.key === 'Escape') { /* dialogs close natively */ }
  });

  // Keep multiple tabs in sync
  window.addEventListener('storage', function (ev) {
    if (ev.key === STORE_KEY) { state = load(); render(); }
  });

  // Flush pending save on close
  window.addEventListener('pagehide', function () { if (saveTimer) { clearTimeout(saveTimer); persist(); } });

  /* ------------------------------------------------------------------------
     14. BOOT
     ------------------------------------------------------------------------ */
  renderFooter();
  render({ focus: false });
  if (!storageOK) toast('Browser storage is unavailable. Your answers last until this tab closes; export to keep them.');

  // Exposed for automated testing only
  window.__vm = { get state() { return state; }, computeModel: computeModel, summaryText: summaryText };
})();
