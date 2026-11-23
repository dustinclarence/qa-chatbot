// TestPal — retrieval chatbot using TF-IDF + cosine similarity (no external AI service).

/* ---------------- Knowledge base ----------------
   q: example questions (several phrasings), a: answer (simple markup:
   **bold**, lines starting with "- " become bullet lists), rel: related topic ids */
const KB = [
  { id: 'qa', topic: 'What is QA?', q: ['what is quality assurance', 'what is qa', 'meaning of qa', 'what does a qa tester do', 'qa tester job role'],
    a: '**Quality assurance (QA)** is the work of making sure software meets its requirements and works well for users.\nA QA tester usually:\n- reads the requirements and plans what to test\n- writes and runs test cases\n- reports bugs clearly so developers can fix them\n- retests fixes and checks nothing else broke', rel: ['qc', 'testcase', 'bugreport'] },
  { id: 'qc', topic: 'QA vs QC vs testing', q: ['difference between qa and qc', 'qa vs qc', 'quality control vs quality assurance', 'is testing the same as qa'],
    a: '**QA** is about the process: preventing defects by improving how software is built.\n**QC** is about the product: finding defects in what was built.\n**Testing** is the main QC activity: running the software to find problems.', rel: ['qa', 'verification'] },
  { id: 'testcase', topic: 'Writing a test case', q: ['what is a test case', 'how to write a test case', 'test case example', 'parts of a test case', 'test case format'],
    a: 'A **test case** is a set of steps that checks one behaviour. A good one has:\n- an ID and a clear title\n- preconditions (for example "user is logged out")\n- numbered steps\n- test data\n- the expected result\n- the actual result and a pass/fail status after running it\nExample: "Login with a valid email and password → user lands on the dashboard."', rel: ['testplan', 'bva', 'bugreport'] },
  { id: 'bugreport', topic: 'Writing a bug report', q: ['how to write a bug report', 'what is a good bug report', 'bug report template', 'how to report a defect', 'what to include in a bug report'],
    a: 'A good **bug report** lets a developer reproduce the problem on the first try:\n- short, specific title\n- steps to reproduce\n- expected result vs actual result\n- environment (browser, device, version)\n- severity and priority\n- screenshot, video or logs\nReport one bug per report, and stick to facts.', rel: ['severity', 'lifecycle', 'testcase'] },
  { id: 'severity', topic: 'Severity vs priority', q: ['difference between severity and priority', 'severity vs priority', 'what is bug severity', 'what is bug priority', 'high severity low priority example'],
    a: '**Severity** = how badly the bug affects the system (a crash is critical).\n**Priority** = how soon it should be fixed (decided with the business).\nThey can differ:\n- High severity, low priority: a crash in a feature almost nobody uses\n- Low severity, high priority: a typo in the company name on the home page', rel: ['bugreport', 'lifecycle'] },
  { id: 'lifecycle', topic: 'Bug life cycle', q: ['what is the bug life cycle', 'defect life cycle', 'bug statuses', 'stages of a defect', 'bug workflow'],
    a: 'A common **defect life cycle**:\n- New → Assigned → In progress → Fixed\n- Fixed → Retest → Verified → Closed\n- If the retest fails: Reopened\nOther outcomes: Rejected (not a bug), Duplicate, or Deferred (fix later).', rel: ['bugreport', 'retest'] },
  { id: 'regression', topic: 'Regression testing', q: ['what is regression testing', 'regression test meaning', 'why do regression testing', 'when to do regression testing'],
    a: '**Regression testing** re-runs existing tests after a change to check that features which used to work still work. It is done after bug fixes, new features, or updates. Because it repeats a lot, it is a good candidate for **automation**.', rel: ['retest', 'smoke', 'automation'] },
  { id: 'retest', topic: 'Retesting vs regression', q: ['difference between retesting and regression testing', 'retesting vs regression', 'what is retesting', 'confirmation testing'],
    a: '**Retesting** (confirmation testing) checks that a specific bug is really fixed, using the same steps that found it.\n**Regression testing** checks that the fix did not break anything else.', rel: ['regression', 'lifecycle'] },
  { id: 'smoke', topic: 'Smoke vs sanity testing', q: ['what is smoke testing', 'what is sanity testing', 'smoke vs sanity', 'build verification test'],
    a: '**Smoke testing** is a quick, broad check that a new build\'s most important features work, before deeper testing starts.\n**Sanity testing** is a quick, narrow check of one area after a small change or fix.', rel: ['regression', 'levels'] },
  { id: 'blackbox', topic: 'Black-box vs white-box', q: ['what is black box testing', 'what is white box testing', 'black box vs white box', 'grey box testing'],
    a: '**Black-box testing** checks behaviour from the outside, using requirements, without looking at the code.\n**White-box testing** uses knowledge of the code, for example making sure every branch runs.\n**Grey-box** mixes both, such as testing a page while also checking the database.', rel: ['bva', 'unit'] },
  { id: 'bva', topic: 'Boundary value analysis', q: ['what is boundary value analysis', 'boundary testing', 'bva example', 'equivalence partitioning', 'test design techniques'],
    a: 'Two classic **test design techniques**:\n- **Equivalence partitioning**: split inputs into groups that should behave the same, then test one value from each group.\n- **Boundary value analysis**: bugs hide at the edges, so test just below, on and just above each limit.\nExample for an age field that accepts 18–60: test 17, 18, 60 and 61.', rel: ['testcase', 'blackbox'] },
  { id: 'levels', topic: 'Levels of testing', q: ['levels of testing', 'unit integration system acceptance', 'testing levels', 'types of testing levels'],
    a: 'The four main **test levels**:\n- **Unit**: one function or class\n- **Integration**: parts working together (for example the app and the database)\n- **System**: the whole application against requirements\n- **Acceptance (UAT)**: users or clients confirm it meets their needs', rel: ['unit', 'uat'] },
  { id: 'unit', topic: 'Unit testing', q: ['what is unit testing', 'unit test example', 'who writes unit tests', 'phpunit', 'junit'],
    a: '**Unit tests** check small pieces of code, such as one function, in isolation. Developers usually write them with tools like **JUnit** (Java), **PHPUnit** (PHP) or **Jest** (JavaScript). They run fast and catch problems early.', rel: ['levels', 'automation'] },
  { id: 'uat', topic: 'User acceptance testing', q: ['what is uat', 'user acceptance testing', 'acceptance testing meaning', 'who does uat'],
    a: '**User acceptance testing (UAT)** is the last test level. Real users or the client try the system in realistic scenarios to confirm it meets their needs before release.', rel: ['levels', 'verification'] },
  { id: 'verification', topic: 'Verification vs validation', q: ['verification vs validation', 'difference between verification and validation', 'are we building the product right'],
    a: '**Verification**: "Are we building the product right?" Reviews and checks against the specification.\n**Validation**: "Are we building the right product?" Checking that it actually meets the user\'s needs.', rel: ['qc', 'uat'] },
  { id: 'functional', topic: 'Functional vs non-functional', q: ['functional vs non functional testing', 'what is non functional testing', 'what is functional testing', 'examples of non functional testing'],
    a: '**Functional testing** checks what the system does (login, search, checkout).\n**Non-functional testing** checks how well it does it:\n- performance and load\n- security\n- usability and accessibility\n- compatibility across browsers and devices', rel: ['performance', 'security', 'accessibility'] },
  { id: 'performance', topic: 'Performance testing', q: ['what is performance testing', 'load testing vs stress testing', 'what is load testing', 'what is stress testing'],
    a: '**Performance testing** measures speed and stability.\n- **Load testing**: expected number of users\n- **Stress testing**: beyond the limit, to see how it fails\n- **Endurance testing**: normal load for a long time\nTools include JMeter and k6.', rel: ['functional'] },
  { id: 'security', topic: 'Security testing basics', q: ['what is security testing', 'sql injection', 'xss', 'security testing examples', 'owasp'],
    a: '**Security testing** looks for weaknesses attackers could use. Common checks, many from the **OWASP Top 10**:\n- SQL injection and cross-site scripting (XSS)\n- broken access control (seeing other users\' data)\n- weak passwords and session handling\n- sensitive data exposure', rel: ['functional'] },
  { id: 'accessibility', topic: 'Accessibility testing', q: ['what is accessibility testing', 'wcag', 'a11y testing', 'how to test accessibility'],
    a: '**Accessibility testing** checks that people with disabilities can use the site. It follows **WCAG**. Quick checks:\n- use the whole page with only the keyboard\n- check colour contrast\n- images have alt text\n- try a screen reader\n- run tools like axe or Lighthouse, then test manually too', rel: ['functional'] },
  { id: 'automation', topic: 'Test automation', q: ['what is test automation', 'manual vs automation testing', 'when to automate tests', 'automation tools', 'selenium playwright cypress'],
    a: '**Test automation** uses scripts to run tests. Automate tests that are repeated often, stable and important, like regression and smoke tests.\nPopular tools: **Playwright**, **Selenium** and **Cypress** for web UI, and **Postman** for APIs. Manual testing is still needed for exploratory and usability testing.', rel: ['regression', 'exploratory', 'api'] },
  { id: 'exploratory', topic: 'Exploratory testing', q: ['what is exploratory testing', 'ad hoc testing', 'exploratory vs scripted testing'],
    a: '**Exploratory testing** means learning, designing and running tests at the same time, without a fixed script. Testers follow their curiosity, often within a time box and a goal ("charter"), and take notes on what they find.', rel: ['automation', 'testcase'] },
  { id: 'api', topic: 'API testing', q: ['what is api testing', 'how to test an api', 'postman', 'rest api testing', 'status codes'],
    a: '**API testing** checks the back end directly, without the UI. You send requests and check:\n- status codes (200 OK, 404 Not Found, 500 Server Error)\n- the response data and format\n- error handling with bad input\n- authorisation\n**Postman** is a common tool to start with.', rel: ['automation'] },
  { id: 'testplan', topic: 'Test plan', q: ['what is a test plan', 'test plan contents', 'test strategy vs test plan', 'how to make a test plan'],
    a: 'A **test plan** describes how testing will be done for a project:\n- scope (what will and will not be tested)\n- approach and test levels\n- environments and tools\n- schedule and who does what\n- entry and exit criteria\n- risks', rel: ['testcase', 'stlc'] },
  { id: 'stlc', topic: 'STLC and SDLC', q: ['what is stlc', 'software testing life cycle', 'what is sdlc', 'sdlc phases', 'stlc phases'],
    a: 'The **SDLC** is how software is built: requirements → design → development → testing → deployment → maintenance.\nThe **STLC** is the testing part: requirement analysis → test planning → test case design → environment setup → test execution → test closure.', rel: ['testplan', 'agile'] },
  { id: 'agile', topic: 'QA in Agile and Scrum', q: ['qa in agile', 'what is scrum', 'tester role in scrum', 'what is a sprint'],
    a: 'In **Agile/Scrum**, work is done in short **sprints** (often 1–2 weeks). Testers join from the start: they help refine user stories, define acceptance criteria, test during the sprint, and attend stand-ups, reviews and retrospectives.', rel: ['stlc'] },
  { id: 'istqb', topic: 'ISTQB certification', q: ['what is istqb', 'istqb foundation level', 'qa certification', 'how to start a qa career'],
    a: '**ISTQB Certified Tester Foundation Level (CTFL)** is a widely recognised entry-level testing certificate. To start a QA career:\n- learn testing basics and test design techniques\n- practise writing test cases and bug reports on real websites\n- learn some SQL and an automation tool\n- build a portfolio that shows your testing work', rel: ['qa', 'automation'] },
  { id: 'sql', topic: 'SQL for testers', q: ['why should testers learn sql', 'sql for qa', 'database testing', 'how to test a database'],
    a: 'Testers use **SQL** to check that the app saved the right data. For example, after registering a user, run a SELECT query to confirm the new row has the correct values. It also helps you prepare test data and find the cause of bugs.', rel: ['api'] },
  { id: 'browser', topic: 'Cross-browser testing', q: ['what is cross browser testing', 'compatibility testing', 'responsive testing', 'test on mobile'],
    a: '**Cross-browser / compatibility testing** checks the site on different browsers, devices and screen sizes. Use browser DevTools device mode for quick checks, then test on real phones for important flows.', rel: ['functional', 'accessibility'] },
];

const SMALLTALK = [
  { q: ['hi', 'hello', 'hey', 'good morning', 'good evening', 'kumusta'], a: 'Hi! I am **TestPal**, a small chatbot about software testing. Ask me something like "What is regression testing?"' },
  { q: ['thanks', 'thank you', 'salamat', 'great thanks', 'nice'], a: 'You are welcome! Happy testing.' },
  { q: ['who are you', 'what are you', 'are you chatgpt', 'how do you work', 'are you ai'], a: 'I am a **retrieval chatbot**. I compare your message with my knowledge base using **TF-IDF** and **cosine similarity**, then reply with the closest answer. I run fully in your browser.' },
  { q: ['bye', 'goodbye', 'see you'], a: 'Goodbye! Come back anytime you have a testing question.' },
];

/* ---------------- NLP ---------------- */
const STOP = new Set('a an the is are was be to of and or in on at for with what how why when do does i you me my it this that can should which who about between vs versus difference meaning give example examples please tell explain'.split(' '));
const SYN = { defect: 'bug', issue: 'bug', error: 'bug', qa: 'quality', tester: 'test', testing: 'test', tests: 'test', automate: 'automation', automated: 'automation', uat: 'acceptance' };

function stem(w) {
  if (SYN[w]) return SYN[w];
  if (w.length <= 4) return w;
  return w.replace(/(ing|ed|es|s)$/, '') || w;
}
function tokens(text) {
  return (text.toLowerCase().match(/[a-z0-9]+/g) || []).filter((w) => !STOP.has(w)).map(stem);
}

// Build documents: each example question is a document linked to its entry.
const docs = [];
for (const e of KB) for (const q of e.q) docs.push({ entry: e, toks: tokens(q + ' ' + e.topic) });
for (const e of SMALLTALK) for (const q of e.q) docs.push({ entry: e, toks: (q.toLowerCase().match(/[a-z]+/g) || []).map(stem), small: true });

const df = new Map();
for (const d of docs) for (const t of new Set(d.toks)) df.set(t, (df.get(t) || 0) + 1);
const N = docs.length;
const idf = (t) => Math.log((N + 1) / ((df.get(t) || 0) + 1)) + 1;

function vector(toks) {
  const tf = new Map();
  for (const t of toks) tf.set(t, (tf.get(t) || 0) + 1);
  const v = new Map();
  let norm = 0;
  for (const [t, c] of tf) {
    const w = (1 + Math.log(c)) * idf(t);
    v.set(t, w);
    norm += w * w;
  }
  return { v, norm: Math.sqrt(norm) || 1 };
}
for (const d of docs) d.vec = vector(d.toks);

function cosine(a, b) {
  let dot = 0;
  for (const [t, w] of a.v) if (b.v.has(t)) dot += w * b.v.get(t);
  return dot / (a.norm * b.norm);
}

function respond(text) {
  const raw = text.toLowerCase().match(/[a-z]+/g) || [];
  const qv = vector(tokens(text).length ? tokens(text) : raw.map(stem));
  const scored = docs.map((d) => ({ d, s: cosine(qv, d.vec) })).sort((a, b) => b.s - a.s);
  // best score per entry
  const seen = new Set();
  const ranked = scored.filter(({ d }) => (seen.has(d.entry) ? false : seen.add(d.entry)));
  const best = ranked[0];
  if (!best || best.s < 0.28) {
    const ideas = ranked.filter((r) => !r.d.small && r.s > 0.05).slice(0, 3).map((r) => r.d.entry);
    return { text: "I'm not sure I understood that. I only know about software testing topics." + (ideas.length ? ' Did you mean one of these?' : ' Try one of the topics on the left.'), related: ideas, confidence: best ? best.s : 0 };
  }
  const e = best.d.entry;
  return { text: e.a, topic: e.topic, confidence: best.s, related: (e.rel || []).map((id) => KB.find((k) => k.id === id)).filter(Boolean) };
}

/* ---------------- UI ---------------- */
const log = document.getElementById('log');
const form = document.getElementById('composer');
const input = document.getElementById('msg');

function rich(text) {
  // Safe tiny formatter: escape, then **bold** and "- " bullets.
  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const lines = esc(text).split('\n');
  let html = '';
  let inList = false;
  for (const line of lines) {
    const b = line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    if (line.startsWith('- ')) {
      if (!inList) { html += '<ul>'; inList = true; }
      html += `<li>${b.slice(2)}</li>`;
    } else {
      if (inList) { html += '</ul>'; inList = false; }
      html += `<p>${b}</p>`;
    }
  }
  return html + (inList ? '</ul>' : '');
}

function addMessage(who, html, extra) {
  const li = document.createElement('li');
  li.className = `msg msg--${who}`;
  li.innerHTML = `<span class="avatar" aria-hidden="true">${who === 'me' ? 'You' : 'TP'}</span><div class="bubble"><span class="visually-hidden">${who === 'me' ? 'You said:' : 'TestPal said:'}</span>${html}</div>`;
  if (extra) li.querySelector('.bubble').append(extra);
  log.append(li);
  log.scrollTop = log.scrollHeight;
  return li;
}

function chipList(entries) {
  if (!entries.length) return null;
  const wrap = document.createElement('div');
  wrap.className = 'chips';
  for (const e of entries) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = e.topic;
    b.addEventListener('click', () => ask(e.q[0].replace(/^\w/, (c) => c.toUpperCase()) + '?'));
    wrap.append(b);
  }
  return wrap;
}

let busy = false;
function ask(text) {
  const q = text.trim();
  if (!q || busy) return;
  busy = true;
  const safe = document.createElement('p');
  safe.textContent = q;
  addMessage('me', safe.outerHTML);
  const typing = addMessage('bot', '<i></i><i></i><i></i>');
  typing.classList.add('typing');
  typing.querySelector('.visually-hidden')?.remove();
  const res = respond(q);
  const delay = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 350 + Math.min(900, res.text.length * 2);
  setTimeout(() => {
    typing.remove();
    const extra = document.createDocumentFragment();
    if (res.topic) {
      const meta = document.createElement('div');
      meta.className = 'meta';
      const pct = Math.round(Math.min(1, res.confidence) * 100);
      meta.innerHTML = `<span class="tag">Topic: ${res.topic}</span><span class="conf">Match ${pct}% <span class="conf__bar" aria-hidden="true"><span style="width:${pct}%"></span></span></span>`;
      extra.append(meta);
    }
    const chips = chipList(res.related || []);
    if (chips) extra.append(chips);
    addMessage('bot', rich(res.text), extra);
    busy = false;
  }, delay);
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  ask(input.value);
  input.value = '';
  input.focus();
});

function greet() {
  log.replaceChildren();
  addMessage('bot', rich('Hi! I am **TestPal**. Ask me anything about software testing and QA: test cases, bug reports, regression testing, severity vs priority, automation and more.'));
}
document.getElementById('clear').addEventListener('click', () => {
  greet();
  input.focus();
});

const featured = ['bugreport', 'severity', 'regression', 'bva', 'automation', 'istqb'];
document.getElementById('topics').replaceChildren(
  ...featured.map((id) => {
    const e = KB.find((k) => k.id === id);
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = e.topic;
    b.addEventListener('click', () => ask(e.q[0].replace(/^\w/, (c) => c.toUpperCase()) + '?'));
    li.append(b);
    return li;
  }),
);
document.getElementById('kb-size').textContent = `Knowledge base: ${KB.length} testing topics, ${docs.length} example questions.`;
greet();
