/* ---------- DATA: add new words here (format: LEVEL|word|reading|meaning) ---------- */
const VOCAB = window.VOCAB;

/* ---------- Question engine ---------- */
const TYPES = {
  meaning: { label: 'What does this word mean?',  p: x => x.w, o: x => x.s },
  reading: { label: 'How do you read this word?', p: x => x.w, o: x => x.r },
  word:    { label: 'Which Japanese word matches?', p: x => x.s, o: x => x.w }
};
const shuffle = a => [...a].sort(() => Math.random() - 0.5);
const pick = a => a[Math.floor(Math.random() * a.length)];

function makeQ(item, level) {
  const type = pick(item.w === item.r ? ['meaning', 'word'] : Object.keys(TYPES)), T = TYPES[type];
  let pool = VOCAB.filter(x => x !== item && (level === 'ALL' || x.lv === level));
  if (pool.length < 3) pool = VOCAB.filter(x => x !== item);
  const correct = T.o(item), seen = new Set([correct]), wrong = [];
  for (const x of shuffle(pool).sort((a, b) => (b.p === item.p) - (a.p === item.p))) { const v = T.o(x); if (!seen.has(v)) { seen.add(v); wrong.push(v); } if (wrong.length === 3) break; }
  const options = shuffle([correct, ...wrong]);
  return { item, type, prompt: T.p(item), label: T.label, options, ans: options.indexOf(correct), correct, lv: item.lv };
}

/* ---------- App state & tabs ---------- */
const S = { tab: 'practice', level: 'N5', q: null, score: 0, total: 0, streak: 0, answered: false, mock: null };
const TABS = [['practice', 'Vocabulary Practice'], ['mock', 'Mock Test'], ['roadmap', 'Roadmap']];
const $ = s => document.querySelector(s);

function renderTabs() {
  $('#tabs').innerHTML = TABS.map(([id, name]) =>
    `<button onclick="goTab('${id}')" class="px-4 py-2.5 border-b-2 whitespace-nowrap ${S.tab === id ? 'border-rose-600 text-rose-600 font-semibold' : 'border-transparent text-slate-500 hover:text-slate-700'}">${name}</button>`).join('');
}
function goTab(id) {
  if (S.mock && S.mock.timer) clearInterval(S.mock.timer);
  S.tab = id; renderTabs();
  if (id === 'practice') { nextPractice(); }
  else if (id === 'mock') { renderMockStart(); }
  else { renderRoadmap(); }
}

const optBtn = (o, i, fn, cls = '') =>
  `<button ${fn ? `onclick="${fn}(${i})"` : 'disabled'} data-i="${i}" class="opt jp text-left px-4 py-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 font-medium ${cls}">${o}</button>`;

/* ---------- Practice mode ---------- */
function nextPractice() {
  const pool = VOCAB.filter(x => S.level === 'ALL' || x.lv === S.level);
  S.q = makeQ(pick(pool), S.level); S.answered = false; renderPractice();
}
function setLevel(l) { S.level = l; S.score = S.total = S.streak = 0; nextPractice(); }

function renderPractice() {
  const q = S.q;
  $('#view').innerHTML = `
  <div class="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col gap-4">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <div class="flex gap-2">${['N5', 'N4', 'ALL'].map(l =>
        `<button onclick="setLevel('${l}')" class="px-3 py-1 rounded-full text-xs font-semibold ${S.level === l ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-600'}">${l === 'ALL' ? 'N5 + N4' : l}</button>`).join('')}</div>
      <div class="text-xs font-semibold text-slate-600">Score ${S.score}/${S.total} &middot; Streak ${S.streak} 🔥</div>
    </div>
    <p class="text-xs uppercase tracking-wider text-slate-400 font-semibold">${q.label}</p>
    <p class="jp text-4xl font-bold text-center py-4">${q.prompt}</p>
    <div class="grid sm:grid-cols-2 gap-2" id="opts">${q.options.map((o, i) => optBtn(o, i, 'answerPractice')).join('')}</div>
    <div id="fb" class="min-h-[2.5rem] flex flex-wrap items-center justify-between gap-2 text-sm"></div><div id="ai-box" class="text-sm"></div>
  </div>`;
}
function answerPractice(i) {
  if (S.answered) return; S.answered = true; S.total++;
  const q = S.q, ok = i === q.ans, btns = document.querySelectorAll('#opts .opt');
  btns[q.ans].classList.add('!bg-emerald-500', 'text-white', '!border-emerald-600');
  if (ok) { S.score++; S.streak++; } else { S.streak = 0; btns[i].classList.add('!bg-rose-500', 'text-white', '!border-rose-600'); }
  btns.forEach(b => b.disabled = true);
  $('#fb').innerHTML = `<span class="font-semibold ${ok ? 'text-emerald-600' : 'text-rose-600'}">${ok ? 'Correct!' : 'Answer: <span class="jp">' + q.correct + '</span>'}</span>
    <button onclick="nextPractice()" class="bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-lg font-medium">Next →</button>
    <button onclick="explain(S.q.item, 'ai-box')" class="border border-violet-300 text-violet-700 hover:bg-violet-50 px-4 py-2 rounded-lg font-medium">✨ How do I use this word?</button>`;
}

/* ---------- Mock test ---------- */
const MOCK_N = 20, MOCK_SECS = 600, PASS = 0.6;

function renderMockStart() {
  $('#view').innerHTML = `
  <div class="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col gap-3 items-start">
    <h2 class="text-lg font-bold">Vocabulary Mock Test</h2>
    <ul class="text-sm text-slate-600 list-disc list-inside">
      <li>${Math.min(MOCK_N, VOCAB.length)} mixed N5 + N4 questions</li>
      <li>${MOCK_SECS / 60} minute timer</li>
      <li>Answers are revealed at the end, with a review of your mistakes</li>
      <li>Pass mark: ${PASS * 100}% (practice target, not an official JLPT score)</li>
    </ul>
    <button onclick="startMock()" class="bg-rose-600 hover:bg-rose-700 text-white px-5 py-2.5 rounded-lg font-medium">Start test</button>
  </div>`;
}
function startMock() {
  const qs = shuffle(VOCAB).slice(0, MOCK_N).map(x => makeQ(x, 'ALL'));
  S.mock = { qs, i: 0, ans: [], end: Date.now() + MOCK_SECS * 1000 };
  S.mock.timer = setInterval(tick, 500);
  renderMockQ();
}
function tick() {
  const left = Math.max(0, Math.round((S.mock.end - Date.now()) / 1000)), c = $('#clock');
  if (c) c.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
  if (left === 0) finishMock();
}
function renderMockQ() {
  const m = S.mock, q = m.qs[m.i];
  $('#view').innerHTML = `
  <div class="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col gap-4">
    <div class="flex justify-between text-sm font-semibold">
      <span>Question ${m.i + 1} / ${m.qs.length}</span><span id="clock" class="text-rose-600">--:--</span>
    </div>
    <div class="h-1.5 bg-slate-100 rounded"><div class="h-1.5 bg-rose-500 rounded" style="width:${(m.i / m.qs.length) * 100}%"></div></div>
    <p class="text-xs uppercase tracking-wider text-slate-400 font-semibold">${q.label}</p>
    <p class="jp text-4xl font-bold text-center py-4">${q.prompt}</p>
    <div class="grid sm:grid-cols-2 gap-2">${q.options.map((o, i) => optBtn(o, i, 'answerMock')).join('')}</div>
  </div>`;
  tick();
}
function answerMock(i) {
  const m = S.mock; m.ans[m.i] = i; m.i++;
  m.i >= m.qs.length ? finishMock() : renderMockQ();
}
function finishMock() {
  const m = S.mock; if (!m) return; clearInterval(m.timer);
  const right = m.qs.filter((q, i) => m.ans[i] === q.ans).length, pct = Math.round((right / m.qs.length) * 100), pass = pct >= PASS * 100;
  const wrong = m.qs.map((q, i) => ({ q, a: m.ans[i] })).filter(x => x.a !== x.q.ans);
  S.rv = wrong.map(x => x.q.item);
  $('#view').innerHTML = `
  <div class="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col gap-4">
    <div class="text-center">
      <p class="text-5xl font-bold ${pass ? 'text-emerald-600' : 'text-rose-600'}">${pct}%</p>
      <p class="text-sm text-slate-600 mt-1">${right} / ${m.qs.length} correct &middot; ${pass ? 'Passed 🎉' : 'Keep practising'}</p>
    </div>
    ${wrong.length ? `<h3 class="font-semibold text-sm">Review your mistakes</h3>
    <div class="flex flex-col gap-2">${wrong.map(({ q, a }, n) => `
      <div class="jp border border-slate-200 rounded-xl p-3 text-sm">
        <p class="font-bold text-base">${q.prompt}</p>
        <p class="text-rose-600">Your answer: ${a === undefined ? '(unanswered)' : q.options[a]}</p>
        <p class="text-emerald-600">Correct: ${q.correct}</p>
        <button onclick="explain(S.rv[${n}], 'ai-r${n}')" class="mt-1 text-violet-700 font-medium">✨ How do I use it?</button><div id="ai-r${n}"></div>
      </div>`).join('')}</div>` : '<p class="text-center text-emerald-600 font-semibold">Perfect score!</p>'}
    <button onclick="renderMockStart()" class="self-center bg-rose-600 hover:bg-rose-700 text-white px-5 py-2.5 rounded-lg font-medium">Try again</button>
  </div>`;
}

/* ---------- Roadmap ---------- */
function renderRoadmap() {
  const items = [
    ['✅', 'Vocabulary MCQ (N5 + N4)', 'Live'],
    ['✅', 'Vocabulary mock test', 'Live'], ['✅', 'AI usage coach (Gemma 4 / Ollama)', 'Live'],
    ['📘', 'Grammar', 'Planned'], ['🔤', 'Particles (は, が, を, に, で...)', 'Planned'],
    ['📖', 'Reading comprehension', 'Planned'], ['🎧', 'Listening', 'Planned'], ['🎌', 'JFT-Basic mock tests', 'Planned']
  ];
  $('#view').innerHTML = `<div class="grid sm:grid-cols-2 gap-3">${items.map(([e, n, s]) => `
    <div class="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between">
      <span class="font-medium">${e} ${n}</span>
      <span class="text-xs font-semibold px-2 py-0.5 rounded-full ${s === 'Live' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}">${s}</span>
    </div>`).join('')}</div>`;
}

/* ---------- AI usage coach (Gemma 4 via Gemini API, or local Ollama) ---------- */
const ls = (k, v) => { try { return v === undefined ? localStorage.getItem(k) : localStorage.setItem(k, v); } catch (e) { return null; } };
const esc = t => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const cfg = () => ({ provider: ls('ai_provider') || 'gemma', key: ls('ai_key') || '', model: ls('ai_model') || 'gemma-4-26b-a4b-it', url: ls('ai_url') || 'http://localhost:11434' });

function openAI() { const c = cfg(); for (const k of ['provider', 'key', 'model', 'url']) $('#ai-' + k).value = c[k]; $('#aiDlg').showModal(); }
function saveAI() { for (const k of ['provider', 'key', 'model', 'url']) ls('ai_' + k, $('#ai-' + k).value.trim()); }

async function askAI(prompt) {
  const c = cfg();
  if (c.provider === 'ollama') {
    const r = await fetch(c.url + '/api/generate', { method: 'POST', body: JSON.stringify({ model: c.model, prompt, stream: false }) });
    return (await r.json()).response;
  }
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(c.model)}:generateContent`,
    { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': c.key }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error?.message || r.status);
  return d.candidates[0].content.parts.filter(p => !p.thought).map(p => p.text).join('');
}

async function explain(item, boxId) {
  const box = document.getElementById(boxId), ck = 'ai:' + item.w + item.r, c = cfg();
  if (c.provider === 'gemma' && !c.key) { box.innerHTML = `<p class="mt-2 p-3 rounded-lg bg-amber-50 text-amber-800">Add a free Google AI Studio key in <b>⚙ AI settings</b> to get AI usage tips for <span class="jp">${esc(item.w)}</span>.</p>`; return; }
  box.innerHTML = '<p class="mt-2 text-slate-500">✨ Thinking…</p>';
  try {
    let raw = ls(ck);
    if (!raw) {
      raw = await askAI(`You are a friendly JLPT tutor. Learner level: ${item.lv}. Word: ${item.w} (reading: ${item.r}), meaning: ${item.m}.
Reply with ONLY valid JSON, no markdown: {"use":"2 short sentences on when and in what situations a native speaker uses this word","examples":[{"jp":"","reading":"","en":""},{"jp":"","reading":"","en":""}],"tip":"one common mistake or a similar word to not confuse it with"}
Keep every Japanese example at ${item.lv} level.`);
      ls(ck, raw);
    }
    const j = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1));
    box.innerHTML = `<div class="mt-2 p-3 rounded-lg bg-violet-50 border border-violet-200 flex flex-col gap-2">
      <p><b>Best use:</b> ${esc(j.use)}</p>
      ${(j.examples || []).map(e => `<p class="jp pl-3 border-l-2 border-violet-300">${esc(e.jp)}<br><span class="text-xs text-slate-500">${esc(e.reading)} — ${esc(e.en)}</span></p>`).join('')}
      <p><b>Tip:</b> ${esc(j.tip)}</p><p class="text-[10px] text-slate-400">AI-generated — double-check with your textbook.</p></div>`;
  } catch (e) { box.innerHTML = `<p class="mt-2 p-3 rounded-lg bg-rose-50 text-rose-700">AI request failed: ${esc(e.message)}. Check your key/model in ⚙ AI settings.</p>`; }
}

$('#count').textContent = VOCAB.length;

renderTabs(); nextPractice();
