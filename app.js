(function () {
  "use strict";

  const STORAGE_KEY = "microlearn_data";
  const RATING_W = { love: 5, like: 2, meh: -1, dislike: -3 };
  const SIGNAL_W = { read: 0.5, bookmark: 3, quiz: 1.5 };
  const CAT_COLORS = {
    science: "#1a7a6d", psychology: "#b85c3a", mathematics: "#5b4a9e",
    history: "#9e7c20", technology: "#2c6fbb", philosophy: "#7b6aad",
    linguistics: "#2a8a5e",
  };

  const XP_REWARDS = { read: 10, quiz: 25, bookmark: 5, rate: 5, review: 15, journal: 10, pathComplete: 75 };
  const REVIEW_INTERVALS = [1, 3, 7, 14, 30];
  const LEVELS = [
    { level: 1, title: "Curious Novice", xp: 0 },
    { level: 2, title: "Eager Learner", xp: 50 },
    { level: 3, title: "Knowledge Seeker", xp: 150 },
    { level: 4, title: "Quick Study", xp: 300 },
    { level: 5, title: "Deep Thinker", xp: 500 },
    { level: 6, title: "Avid Scholar", xp: 800 },
    { level: 7, title: "Wisdom Keeper", xp: 1200 },
    { level: 8, title: "Renaissance Mind", xp: 1800 },
    { level: 9, title: "Enlightened Soul", xp: 2500 },
    { level: 10, title: "Polymath", xp: 3500 },
  ];
  const ACHIEVEMENTS = [
    { id: "first_lesson", title: "First Steps", desc: "Read your first lesson", icon: "📖", check: u => u.lessonsRead.length >= 1 },
    { id: "five_lessons", title: "Bookworm", desc: "Read 5 lessons", icon: "📚", check: u => u.lessonsRead.length >= 5 },
    { id: "streak_3", title: "Getting Warm", desc: "3-day streak", icon: "🔥", check: u => u.streak >= 3 },
    { id: "streak_7", title: "On Fire", desc: "7-day streak", icon: "🔥", check: u => u.streak >= 7 },
    { id: "streak_30", title: "Unstoppable", desc: "30-day streak", icon: "💪", check: u => u.streak >= 30 },
    { id: "quiz_5", title: "Quiz Whiz", desc: "Pass 5 quizzes", icon: "🎯", check: u => u.quizzesPassed.length >= 5 },
    { id: "bookmarks_3", title: "Collector", desc: "Bookmark 3 lessons", icon: "⭐", check: u => u.bookmarks.length >= 3 },
    { id: "journal_5", title: "Reflective Mind", desc: "Write 5 journal entries", icon: "✍️", check: u => Object.keys(u.journal || {}).length >= 5 },
    { id: "review_5", title: "Memory Master", desc: "Complete 5 reviews", icon: "🧠", check: u => (u.reviewsCompleted || 0) >= 5 },
    { id: "path_complete", title: "Pathfinder", desc: "Complete a learning path", icon: "🏆", check: u => Object.values(u.pathProgress || {}).some(p => p.completed) },
    { id: "xp_500", title: "Scholar", desc: "Earn 500 XP", icon: "✨", check: u => (u.xp || 0) >= 500 },
    { id: "xp_2000", title: "Luminary", desc: "Earn 2000 XP", icon: "🌟", check: u => (u.xp || 0) >= 2000 },
  ];
  const PATHS = [
    { id: "minds", title: "Minds & Decisions", desc: "How your brain tricks, helps, and limits you", emoji: "🧠", lessons: [2, 12, 17, 21, 30, 26], days: "6 days" },
    { id: "philosophy", title: "Thinking About Thinking", desc: "Classical questions that still matter today", emoji: "🏛️", lessons: [6, 14, 16, 23, 25], days: "5 days" },
    { id: "dostoevsky", title: "Dostoevsky Deep Dive", desc: "The Russian master's ideas, struggles, and legacy", emoji: "📕", lessons: [31, 32, 33, 34, 35, 36, 37], days: "7 days" },
    { id: "cosmos", title: "The Universe & Beyond", desc: "From quantum particles to the edge of space", emoji: "🌌", lessons: [1, 7, 13, 15, 20, 22, 29], days: "7 days" },
    { id: "numbers", title: "Numbers & Patterns", desc: "Beautiful paradoxes hiding inside mathematics", emoji: "🔢", lessons: [3, 9, 18, 27], days: "4 days" },
  ];

  const PAINTINGS = [
    { cls: "art-0", title: "The Starry Night", artist: "Vincent van Gogh, 1889" },
    { cls: "art-1", title: "The Great Wave off Kanagawa", artist: "Katsushika Hokusai, 1831" },
    { cls: "art-2", title: "Water Lilies", artist: "Claude Monet, 1906" },
    { cls: "art-3", title: "The School of Athens", artist: "Raphael, 1511" },
    { cls: "art-4", title: "Mona Lisa", artist: "Leonardo da Vinci, 1503" },
    { cls: "art-5", title: "The Birth of Venus", artist: "Sandro Botticelli, 1485" },
    { cls: "art-6", title: "Girl with a Pearl Earring", artist: "Johannes Vermeer, 1665" },
  ];
  let curArt = -1;
  function setArt() {
    let n; do { n = Math.floor(Math.random() * PAINTINGS.length); } while (n === curArt && PAINTINGS.length > 1);
    curArt = n;
    const p = PAINTINGS[curArt];
    document.body.className = p.cls;
    let c = document.querySelector(".art-credit");
    if (!c) { c = document.createElement("div"); c.className = "art-credit"; document.body.appendChild(c); }
    c.textContent = p.title + " — " + p.artist;
  }
  setArt();
  const GRADIENTS = [
    "var(--grad-1)", "var(--grad-2)", "var(--grad-3)", "var(--grad-4)",
    "var(--grad-5)", "var(--grad-6)", "var(--grad-7)",
  ];

  const state = {
    lessons: [], categories: [], todayLesson: null, currentLesson: null,
    currentScreen: "today", activeFilter: "all",
    readerCards: [], readerIndex: 0, isReview: false,
    userData: loadUserData(),
  };

  /* ---------- persistence ---------- */
  function loadUserData() {
    const d = { streak: 0, lastVisit: null, lessonsRead: [], quizzesPassed: [],
      bookmarks: [], reviewQueue: [], ratings: {}, categoryScores: {},
      todayLessonId: null, todayDate: null,
      xp: 0, achievements: [], journal: {}, pathProgress: {}, reviewsCompleted: 0 };
    try { const s = JSON.parse(localStorage.getItem(STORAGE_KEY)); return s ? { ...d, ...s } : d; }
    catch { return d; }
  }
  function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.userData)); }

  /* ---------- XP & leveling ---------- */
  function awardXP(amount) {
    const oldLevel = getLevel();
    state.userData.xp = (state.userData.xp || 0) + amount;
    save();
    const newLevel = getLevel();
    updateXPDisplay();
    if (newLevel.level > oldLevel.level) showLevelUp(newLevel);
    checkAchievements();
  }
  function getLevel() {
    const xp = state.userData.xp || 0;
    let current = LEVELS[0];
    for (const l of LEVELS) { if (xp >= l.xp) current = l; }
    return current;
  }
  function getNextLevel() {
    const cur = getLevel();
    return LEVELS.find(l => l.level === cur.level + 1) || null;
  }
  function updateXPDisplay() {
    const xp = state.userData.xp || 0;
    const lvl = getLevel();
    const next = getNextLevel();
    const el = document.getElementById("xp-level-title");
    if (el) el.textContent = lvl.title;
    const badge = document.getElementById("xp-level-num");
    if (badge) badge.textContent = "Lv." + lvl.level;

    const fills = [document.getElementById("xp-bar-fill"), document.getElementById("prog-xp-bar-fill")];
    const labels = [document.getElementById("xp-bar-label"), document.getElementById("prog-xp-bar-label")];

    fills.forEach((fill, i) => {
      const label = labels[i];
      if (!fill) return;
      if (next) {
        const pct = ((xp - lvl.xp) / (next.xp - lvl.xp)) * 100;
        fill.style.width = Math.min(pct, 100) + "%";
        if (label) label.textContent = xp + " / " + next.xp + " XP";
      } else {
        fill.style.width = "100%";
        if (label) label.textContent = xp + " XP — Max Level!";
      }
    });
  }
  function showLevelUp(level) {
    const el = document.createElement("div");
    el.className = "level-up-toast";
    el.innerHTML = `<span class="toast-icon">⬆️</span> Level ${level.level}: <strong>${level.title}</strong>`;
    document.body.appendChild(el);
    setTimeout(() => el.classList.add("show"), 50);
    setTimeout(() => { el.classList.remove("show"); setTimeout(() => el.remove(), 400); }, 3000);
  }
  function showXPToast(amount, label) {
    const el = document.createElement("div");
    el.className = "xp-toast";
    el.textContent = "+" + amount + " XP · " + label;
    document.body.appendChild(el);
    setTimeout(() => el.classList.add("show"), 50);
    setTimeout(() => { el.classList.remove("show"); setTimeout(() => el.remove(), 400); }, 2000);
  }
  function checkAchievements() {
    const u = state.userData;
    if (!u.achievements) u.achievements = [];
    for (const a of ACHIEVEMENTS) {
      if (u.achievements.includes(a.id)) continue;
      if (a.check && a.check(u)) {
        u.achievements.push(a.id);
        save();
        showAchievementToast(a);
      }
    }
  }

  function today() { return new Date().toISOString().split("T")[0]; }

  function showAchievementToast(a) {
    const el = document.createElement("div");
    el.className = "achievement-toast";
    el.innerHTML = `<span class="toast-icon">${a.icon}</span> <strong>${a.title}</strong> — ${a.desc}`;
    document.body.appendChild(el);
    setTimeout(() => el.classList.add("show"), 50);
    setTimeout(() => { el.classList.remove("show"); setTimeout(() => el.remove(), 400); }, 3500);
  }

  /* ---------- preference engine ---------- */
  function catScore(cat, delta) {
    if (!cat) return;
    const s = state.userData.categoryScores;
    s[cat] = Math.round(((s[cat] || 0) + delta) * 100) / 100;
    save();
  }
  function rateLesson(id, rating) {
    const l = state.lessons.find(x => x.id === id);
    if (!l) return;
    const prev = state.userData.ratings[id];
    if (prev) catScore(l.category, -RATING_W[prev]);
    state.userData.ratings[id] = rating;
    catScore(l.category, RATING_W[rating]);
  }
  function lessonScore(l) {
    return (state.userData.categoryScores[l.category] || 0)
      + (state.userData.lessonsRead.includes(l.id) ? -2 : 0);
  }
  function recommended(excludeId, n) {
    const scored = state.lessons.filter(l => l.id !== excludeId)
      .map(l => ({ l, s: lessonScore(l) })).sort((a, b) => b.s - a.s);
    const unread = scored.filter(x => !state.userData.lessonsRead.includes(x.l.id));
    return [...unread, ...scored].slice(0, n);
  }

  function pickToday() {
    const d = today();
    if (state.userData.todayDate === d && state.userData.todayLessonId) {
      const c = state.lessons.find(l => l.id === state.userData.todayLessonId);
      if (c) return c;
    }
    const sc = state.userData.categoryScores;
    const hasP = Object.values(sc).some(v => v !== 0);
    let chosen;
    if (hasP) {
      const pool = state.lessons.filter(l => !state.userData.lessonsRead.includes(l.id));
      const src = pool.length ? pool : state.lessons;
      const w = src.map(l => ({ l, w: Math.max((sc[l.category] || 0) + 10, 1) }));
      const h = hashDate(d);
      const tot = w.reduce((s, x) => s + x.w, 0);
      let t = (h % (tot * 100)) / 100;
      chosen = w[w.length - 1].l;
      for (const x of w) { t -= x.w; if (t <= 0) { chosen = x.l; break; } }
    } else {
      const di = Math.floor((new Date(d) - new Date("2025-01-01")) / 864e5);
      chosen = state.lessons[di % state.lessons.length];
    }
    state.userData.todayLessonId = chosen.id;
    state.userData.todayDate = d;
    save();
    return chosen;
  }
  function hashDate(s) { let h = 0; for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0; return Math.abs(h); }

  /* ---------- streak ---------- */
  function updateStreak() {
    const d = today(), last = state.userData.lastVisit;
    if (!last) state.userData.streak = 1;
    else if (last !== d) {
      const diff = Math.floor((new Date(d) - new Date(last)) / 864e5);
      state.userData.streak = diff === 1 ? state.userData.streak + 1 : 1;
    }
    state.userData.lastVisit = d;
    save();
    document.getElementById("streak-count").textContent = state.userData.streak;
  }

  /* ---------- markdown ---------- */
  function md(text) {
    return text
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      .replace(/^- (.+)$/gm, "<li>$1</li>")
      .replace(/(<li>[\s\S]*?<\/li>)/g, "<ul>$1</ul>")
      .replace(/\n\n/g, "</p><p>")
      .replace(/\n/g, "<br>")
      .replace(/^(?!<)/, "<p>")
      .replace(/(?!>)$/, "</p>");
  }

  /* ---------- split content into cards ---------- */
  function splitContent(text) {
    const paragraphs = text.split(/\n\n+/).filter(p => p.trim());
    const cards = [];
    let buf = "";
    for (const p of paragraphs) {
      if (buf && (buf + "\n\n" + p).length > 500) {
        cards.push(buf);
        buf = p;
      } else {
        buf = buf ? buf + "\n\n" + p : p;
      }
    }
    if (buf) cards.push(buf);
    return cards;
  }

  /* ---------- data ---------- */
  async function fetchLessons() {
    const r = await fetch("lessons.json");
    state.lessons = await r.json();
    state.categories = [...new Set(state.lessons.map(l => l.category))];
  }

  /* ---------- greeting ---------- */
  function greeting() {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  }

  /* ---------- HOME rendering ---------- */
  function renderHome() {
    const l = state.todayLesson;
    if (!l) return;

    document.getElementById("home-greeting").textContent = greeting();
    document.getElementById("featured-category").textContent = l.category;
    document.getElementById("featured-emoji").textContent = l.emoji;
    document.getElementById("featured-title").textContent = l.title;
    document.getElementById("featured-duration").textContent = l.duration;

    const teaser = l.content.split("\n\n")[0].replace(/\*+/g, "").slice(0, 160) + "…";
    document.getElementById("featured-teaser").textContent = teaser;

    const numCards = splitContent(l.content).length + 3;
    document.getElementById("featured-cards-count").textContent = numCards + " cards";

    const gi = hashDate(today()) % GRADIENTS.length;
    document.getElementById("featured-card").style.background = GRADIENTS[gi];

    updateXPDisplay();
    renderReviewsDue();
    renderPaths();
    renderRecommended();
    renderContinue();
  }

  function renderReviewsDue() {
    const container = document.getElementById("reviews-due-section");
    const list = document.getElementById("reviews-due-list");
    const due = getDueReviews();
    if (!due.length) { container.classList.add("hidden"); return; }
    container.classList.remove("hidden");
    document.getElementById("reviews-due-count").textContent = due.length;
    list.innerHTML = due.map(r => {
      const l = state.lessons.find(x => x.id === r.lessonId);
      if (!l) return "";
      const stage = r.stage || 0;
      const labels = ["1 day", "3 days", "1 week", "2 weeks", "1 month"];
      return `<div class="review-due-card" data-id="${l.id}">
        <div class="review-due-emoji">${l.emoji}</div>
        <div class="review-due-info">
          <div class="review-due-title">${l.title}</div>
          <div class="review-due-meta">Interval: ${labels[stage] || "?"} · Stage ${stage + 1}/${REVIEW_INTERVALS.length}</div>
        </div>
        <div class="review-due-btn">Review</div>
      </div>`;
    }).join("");
    list.querySelectorAll(".review-due-card").forEach(c =>
      c.addEventListener("click", () => openReader(parseInt(c.dataset.id), true)));
  }

  function renderPaths() {
    const list = document.getElementById("paths-list");
    if (!list) return;
    list.innerHTML = PATHS.map((p, i) => {
      const pct = Math.round(getPathProgress(p) * 100);
      const pp = (state.userData.pathProgress || {})[p.id];
      const done = pp && pp.completed;
      const gi = i % GRADIENTS.length;
      return `<div class="path-card ${done ? "path-done" : ""}" data-path="${p.id}" style="background:${GRADIENTS[gi]}">
        <div class="path-card-emoji">${p.emoji}</div>
        <div class="path-card-title">${p.title}</div>
        <div class="path-card-desc">${p.desc}</div>
        <div class="path-card-footer">
          <span class="path-card-days">${p.lessons.length} lessons · ${p.days}</span>
          <span class="path-card-pct">${done ? "✓ Complete" : pct + "%"}</span>
        </div>
        <div class="path-card-bar"><div class="path-card-bar-fill" style="width:${pct}%"></div></div>
      </div>`;
    }).join("");
    list.querySelectorAll(".path-card").forEach(c => {
      c.addEventListener("click", () => {
        const path = PATHS.find(p => p.id === c.dataset.path);
        if (!path) return;
        const next = getNextPathLesson(path);
        if (next) openReader(next);
        else openReader(path.lessons[0]);
      });
    });
  }

  function renderRecommended() {
    const list = document.getElementById("recommended-list");
    const hint = document.getElementById("recommended-hint");
    const sc = state.userData.categoryScores;
    const hasP = Object.values(sc).some(v => v > 0);
    if (!hasP) { hint.textContent = "Rate lessons to unlock personalized picks."; list.innerHTML = ""; return; }
    hint.textContent = "Based on what you enjoy";
    const recs = recommended(state.todayLesson ? state.todayLesson.id : -1, 6);
    list.innerHTML = recs.map((r, i) => {
      const gi = (i + 1) % GRADIENTS.length;
      return `<div class="mini-card" data-id="${r.l.id}" style="background:${GRADIENTS[gi]}">
        <div class="mini-card-emoji">${r.l.emoji}</div>
        <div class="mini-card-title">${r.l.title}</div>
        <div class="mini-card-meta">${r.l.category} · ${r.l.duration}</div>
      </div>`;
    }).join("");
    list.querySelectorAll(".mini-card").forEach(c =>
      c.addEventListener("click", () => openReader(parseInt(c.dataset.id))));
  }

  function renderContinue() {
    const list = document.getElementById("continue-list");
    const unread = state.lessons.filter(l =>
      !state.userData.lessonsRead.includes(l.id) &&
      (!state.todayLesson || l.id !== state.todayLesson.id)
    ).slice(0, 6);
    if (!unread.length) { list.innerHTML = '<p class="empty-state" style="padding:8px 0;font-size:0.82rem;">You\'ve read everything! More lessons coming soon.</p>'; return; }
    list.innerHTML = unread.map((l, i) => {
      const gi = (i + 3) % GRADIENTS.length;
      return `<div class="mini-card" data-id="${l.id}" style="background:${GRADIENTS[gi]}">
        <div class="mini-card-emoji">${l.emoji}</div>
        <div class="mini-card-title">${l.title}</div>
        <div class="mini-card-meta">${l.category} · ${l.duration}</div>
      </div>`;
    }).join("");
    list.querySelectorAll(".mini-card").forEach(c =>
      c.addEventListener("click", () => openReader(parseInt(c.dataset.id))));
  }

  /* ---------- CARD READER ---------- */
  function openReader(lessonId, isReview) {
    const lesson = state.lessons.find(l => l.id === lessonId);
    if (!lesson) return;
    state.currentLesson = lesson;
    state.isReview = !!isReview;

    const contentCards = splitContent(lesson.content);
    const cards = [];

    cards.push({ type: "intro", lesson });

    contentCards.forEach((text, i) => {
      cards.push({ type: "content", text, index: i + 1, total: contentCards.length });
    });

    cards.push({ type: "takeaway", lesson });

    if (lesson.quiz) cards.push({ type: "quiz", lesson });

    cards.push({ type: "journal", lesson });
    cards.push({ type: "feedback", lesson });

    state.readerCards = cards;
    state.readerIndex = 0;

    const firstRead = !state.userData.lessonsRead.includes(lesson.id);
    if (firstRead) {
      state.userData.lessonsRead.push(lesson.id);
      catScore(lesson.category, SIGNAL_W.read);
      scheduleReview(lesson.id);
      save();
      awardXP(XP_REWARDS.read);
      showXPToast(XP_REWARDS.read, "Lesson started");
      advancePaths(lesson.id);
    }

    updateStreak();
    renderReader();

    document.getElementById("screen-reader").classList.remove("hidden");
    document.getElementById("screen-reader").classList.add("active");
    document.getElementById("bottom-nav").style.display = "none";

    updateBookmarkBtn();
  }

  function closeReader() {
    if (state.isReview && state.currentLesson) {
      completeReview(state.currentLesson.id);
    }
    state.isReview = false;
    document.getElementById("screen-reader").classList.add("hidden");
    document.getElementById("screen-reader").classList.remove("active");
    document.getElementById("bottom-nav").style.display = "";
    renderHome();
    if (state.currentScreen === "library") renderLibrary(state.activeFilter);
    if (state.currentScreen === "progress") renderProgress();
  }

  function renderReader() {
    const container = document.getElementById("reader-cards");
    const dots = document.getElementById("reader-dots");
    const cards = state.readerCards;
    const idx = state.readerIndex;

    container.innerHTML = cards.map((card, i) => {
      let pos = "hidden";
      if (i === idx) pos = "current";
      else if (i === idx + 1) pos = "next";
      else if (i === idx - 1) pos = "prev";
      return `<div class="reader-card" data-pos="${pos}" data-idx="${i}">${renderCardContent(card)}</div>`;
    }).join("");

    dots.innerHTML = cards.map((_, i) =>
      `<div class="dot ${i === idx ? "active" : ""}"></div>`
    ).join("");

    document.getElementById("reader-counter").textContent = `${idx + 1} / ${cards.length}`;
    document.getElementById("reader-progress-fill").style.width = `${((idx + 1) / cards.length) * 100}%`;

    attachCardListeners();
    setupSwipe();
  }

  function renderCardContent(card) {
    if (card.type === "intro") {
      return `<div class="card-intro">
        <div class="card-intro-category">${card.lesson.category}</div>
        <div class="card-intro-emoji">${card.lesson.emoji}</div>
        <div class="card-intro-title">${card.lesson.title}</div>
        <div class="card-intro-meta">${card.lesson.duration} · ${state.readerCards.length} cards</div>
      </div>`;
    }

    if (card.type === "content") {
      return `<div class="card-content">
        <div class="card-label">Insight ${card.index} of ${card.total}</div>
        <div class="card-body">${md(card.text)}</div>
      </div>`;
    }

    if (card.type === "takeaway") {
      return `<div class="card-takeaway">
        <div class="card-takeaway-label">Key Takeaway</div>
        <div class="card-takeaway-text">${card.lesson.keyTakeaway}</div>
        <div class="card-further"><strong>Further Reading:</strong> ${card.lesson.furtherReading}</div>
      </div>`;
    }

    if (card.type === "quiz") {
      const q = card.lesson.quiz;
      return `<div class="card-quiz">
        <div class="card-quiz-label">Test Yourself</div>
        <div class="card-quiz-question">${q.question}</div>
        <div class="card-quiz-options">${q.options.map((o, i) =>
          `<button class="quiz-opt" data-qi="${i}">${o}</button>`).join("")}</div>
        <div class="card-quiz-result hidden" id="cq-result">
          <div class="quiz-result-head" id="cq-head"></div>
          <div class="quiz-result-explain" id="cq-explain"></div>
        </div>
      </div>`;
    }

    if (card.type === "journal") {
      const existing = (state.userData.journal || {})[card.lesson.id];
      const prev = existing && existing.length ? existing[existing.length - 1].text : "";
      return `<div class="card-journal">
        <div class="card-journal-label">Reflect</div>
        <div class="card-journal-prompt">What did this make you think about?</div>
        <textarea class="card-journal-input" id="journal-input" placeholder="Write your thoughts..." rows="5">${prev}</textarea>
        <button class="card-journal-save" id="journal-save">Save Reflection</button>
        <div class="card-journal-hint">Your reflections are private and stored locally.</div>
      </div>`;
    }

    if (card.type === "feedback") {
      const rating = state.userData.ratings[card.lesson.id] || "";
      return `<div class="card-feedback">
        <div class="card-feedback-title">How was this?</div>
        <div class="card-feedback-sub">Your feedback shapes future recommendations</div>
        <div class="feedback-btns">
          <button class="fb-btn ${rating==="love"?"selected":""}" data-r="love"><span class="fb-icon">♥</span><span class="fb-text">Love it</span></button>
          <button class="fb-btn ${rating==="like"?"selected":""}" data-r="like"><span class="fb-icon">👍</span><span class="fb-text">Good</span></button>
          <button class="fb-btn ${rating==="meh"?"selected":""}" data-r="meh"><span class="fb-icon">😐</span><span class="fb-text">Meh</span></button>
          <button class="fb-btn ${rating==="dislike"?"selected":""}" data-r="dislike"><span class="fb-icon">👎</span><span class="fb-text">Less</span></button>
        </div>
        <button class="card-done-btn" id="card-done">Done</button>
      </div>`;
    }
    return "";
  }

  function attachCardListeners() {
    document.querySelectorAll(".quiz-opt").forEach(btn => {
      btn.addEventListener("click", () => handleQuiz(btn));
    });
    document.querySelectorAll(".fb-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const r = btn.dataset.r;
        const hadRating = !!state.userData.ratings[state.currentLesson.id];
        rateLesson(state.currentLesson.id, r);
        document.querySelectorAll(".fb-btn").forEach(b => b.classList.toggle("selected", b.dataset.r === r));
        if (!hadRating) { awardXP(XP_REWARDS.rate); showXPToast(XP_REWARDS.rate, "Feedback"); }
      });
    });
    const done = document.getElementById("card-done");
    if (done) done.addEventListener("click", closeReader);

    const jsave = document.getElementById("journal-save");
    if (jsave) jsave.addEventListener("click", saveJournal);
  }

  function saveJournal() {
    const input = document.getElementById("journal-input");
    if (!input || !input.value.trim()) return;
    const id = state.currentLesson.id;
    if (!state.userData.journal) state.userData.journal = {};
    if (!state.userData.journal[id]) state.userData.journal[id] = [];
    const entries = state.userData.journal[id];
    const d = today();
    const existing = entries.findIndex(e => e.date === d);
    if (existing >= 0) entries[existing].text = input.value.trim();
    else entries.push({ date: d, text: input.value.trim() });
    save();
    awardXP(XP_REWARDS.journal);
    showXPToast(XP_REWARDS.journal, "Reflection saved");
    const btn = document.getElementById("journal-save");
    if (btn) { btn.textContent = "Saved ✓"; btn.style.background = "var(--success)"; }
  }

  function handleQuiz(btn) {
    const qi = parseInt(btn.dataset.qi);
    const q = state.currentLesson.quiz;
    const correct = qi === q.correctIndex;
    document.querySelectorAll(".quiz-opt").forEach((b, i) => {
      b.classList.add("disabled");
      if (i === q.correctIndex) b.classList.add("correct");
    });
    if (!correct) btn.classList.add("wrong");
    const res = document.getElementById("cq-result");
    const head = document.getElementById("cq-head");
    const exp = document.getElementById("cq-explain");
    head.textContent = correct ? "Correct!" : "Not quite!";
    head.className = "quiz-result-head " + (correct ? "correct" : "wrong");
    exp.textContent = q.explanation;
    res.classList.remove("hidden");
    if (correct && !state.userData.quizzesPassed.includes(state.currentLesson.id)) {
      state.userData.quizzesPassed.push(state.currentLesson.id);
      catScore(state.currentLesson.category, SIGNAL_W.quiz);
      save();
      awardXP(XP_REWARDS.quiz);
      showXPToast(XP_REWARDS.quiz, "Quiz aced!");
    }
  }

  function navigateReader(dir) {
    const next = state.readerIndex + dir;
    if (next < 0 || next >= state.readerCards.length) return;
    state.readerIndex = next;

    const cards = document.querySelectorAll(".reader-card");
    cards.forEach(c => {
      const i = parseInt(c.dataset.idx);
      if (i === next) c.dataset.pos = "current";
      else if (i === next + 1) c.dataset.pos = "next";
      else if (i === next - 1) c.dataset.pos = "prev";
      else c.dataset.pos = "hidden";
    });

    const dots = document.querySelectorAll(".dot");
    dots.forEach((d, i) => d.classList.toggle("active", i === next));

    document.getElementById("reader-counter").textContent = `${next + 1} / ${state.readerCards.length}`;
    document.getElementById("reader-progress-fill").style.width = `${((next + 1) / state.readerCards.length) * 100}%`;

    attachCardListeners();
  }

  /* ---------- swipe ---------- */
  function setupSwipe() {
    const el = document.getElementById("reader-cards");
    let sx = 0, sy = 0, moving = false, locked = false;

    el.addEventListener("touchstart", e => {
      sx = e.touches[0].clientX;
      sy = e.touches[0].clientY;
      moving = true;
      locked = false;
    }, { passive: true });

    el.addEventListener("touchmove", e => {
      if (!moving) return;
      const dx = e.touches[0].clientX - sx;
      const dy = e.touches[0].clientY - sy;
      if (!locked) {
        locked = true;
        if (Math.abs(dy) > Math.abs(dx)) { moving = false; return; }
      }
    }, { passive: true });

    el.addEventListener("touchend", e => {
      if (!moving) return;
      moving = false;
      const dx = e.changedTouches[0].clientX - sx;
      if (dx < -50) navigateReader(1);
      else if (dx > 50) navigateReader(-1);
    }, { passive: true });
  }

  /* ---------- bookmark ---------- */
  function updateBookmarkBtn() {
    if (!state.currentLesson) return;
    const btn = document.getElementById("reader-bookmark");
    const is = state.userData.bookmarks.includes(state.currentLesson.id);
    btn.textContent = is ? "★" : "☆";
    btn.classList.toggle("active", is);
  }
  function toggleBookmark() {
    if (!state.currentLesson) return;
    const id = state.currentLesson.id;
    const idx = state.userData.bookmarks.indexOf(id);
    if (idx >= 0) { state.userData.bookmarks.splice(idx, 1); catScore(state.currentLesson.category, -SIGNAL_W.bookmark); }
    else {
      state.userData.bookmarks.push(id);
      catScore(state.currentLesson.category, SIGNAL_W.bookmark);
      awardXP(XP_REWARDS.bookmark);
      showXPToast(XP_REWARDS.bookmark, "Bookmarked");
    }
    save();
    updateBookmarkBtn();
  }

  /* ---------- learning paths ---------- */
  function advancePaths(lessonId) {
    if (!state.userData.pathProgress) state.userData.pathProgress = {};
    for (const path of PATHS) {
      if (!path.lessons.includes(lessonId)) continue;
      let pp = state.userData.pathProgress[path.id];
      if (!pp) { pp = { started: today(), lessonsRead: [], completed: false }; state.userData.pathProgress[path.id] = pp; }
      if (!pp.lessonsRead.includes(lessonId)) pp.lessonsRead.push(lessonId);
      if (!pp.completed && pp.lessonsRead.length === path.lessons.length) {
        pp.completed = true;
        pp.completedDate = today();
        awardXP(XP_REWARDS.pathComplete);
        showXPToast(XP_REWARDS.pathComplete, "Path complete!");
      }
      save();
    }
  }
  function getPathProgress(path) {
    const pp = (state.userData.pathProgress || {})[path.id];
    if (!pp) return 0;
    return pp.lessonsRead.length / path.lessons.length;
  }
  function getNextPathLesson(path) {
    const pp = (state.userData.pathProgress || {})[path.id];
    const read = pp ? pp.lessonsRead : [];
    return path.lessons.find(id => !read.includes(id));
  }

  /* ---------- spaced repetition ---------- */
  function scheduleReview(id) {
    if (state.userData.reviewQueue.find(r => r.lessonId === id)) return;
    const d = new Date();
    d.setDate(d.getDate() + REVIEW_INTERVALS[0]);
    state.userData.reviewQueue.push({ lessonId: id, dueDate: d.toISOString().split("T")[0], stage: 0 });
    save();
  }
  function completeReview(lessonId) {
    const q = state.userData.reviewQueue;
    const idx = q.findIndex(r => r.lessonId === lessonId);
    if (idx < 0) return;
    const item = q[idx];
    const nextStage = (item.stage || 0) + 1;
    if (nextStage >= REVIEW_INTERVALS.length) {
      q.splice(idx, 1);
    } else {
      const d = new Date();
      d.setDate(d.getDate() + REVIEW_INTERVALS[nextStage]);
      item.dueDate = d.toISOString().split("T")[0];
      item.stage = nextStage;
    }
    state.userData.reviewsCompleted = (state.userData.reviewsCompleted || 0) + 1;
    save();
    awardXP(XP_REWARDS.review);
    showXPToast(XP_REWARDS.review, "Review completed");
  }
  function getDueReviews() {
    return (state.userData.reviewQueue || []).filter(r => r.dueDate <= today());
  }

  /* ---------- library ---------- */
  function renderLibrary(filter) {
    const grid = document.getElementById("library-grid");
    let list = filter && filter !== "all" ? state.lessons.filter(l => l.category === filter) : [...state.lessons];
    const sc = state.userData.categoryScores;
    if (Object.values(sc).some(v => v !== 0) && (!filter || filter === "all"))
      list.sort((a, b) => lessonScore(b) - lessonScore(a));

    grid.innerHTML = list.map(l => `
      <div class="lib-card" data-id="${l.id}">
        <div class="lib-card-emoji">${l.emoji}</div>
        <div class="lib-card-info">
          <div class="lib-card-title">${l.title}</div>
          <div class="lib-card-meta">
            <span class="cat-pill cat-${l.category}">${l.category}</span>
            <span>${l.duration}</span>
            ${state.userData.lessonsRead.includes(l.id) ? '<span class="lib-card-check">✓</span>' : ""}
          </div>
        </div>
      </div>`).join("");

    grid.querySelectorAll(".lib-card").forEach(c =>
      c.addEventListener("click", () => openReader(parseInt(c.dataset.id))));
  }

  function renderFilters() {
    const el = document.getElementById("library-filters");
    const sc = state.userData.categoryScores;
    const sorted = [...state.categories].sort((a, b) => (sc[b] || 0) - (sc[a] || 0));
    el.innerHTML = ["all", ...sorted].map(c =>
      `<button class="filter-chip ${c === state.activeFilter ? "active" : ""}" data-cat="${c}">${c}</button>`
    ).join("");
    el.querySelectorAll(".filter-chip").forEach(ch => ch.addEventListener("click", () => {
      state.activeFilter = ch.dataset.cat;
      el.querySelectorAll(".filter-chip").forEach(c => c.classList.toggle("active", c.dataset.cat === state.activeFilter));
      renderLibrary(state.activeFilter);
    }));
  }

  /* ---------- progress ---------- */
  function renderProgress() {
    document.getElementById("stat-streak").textContent = state.userData.streak;
    document.getElementById("stat-lessons").textContent = state.userData.lessonsRead.length;
    document.getElementById("stat-quizzes").textContent = state.userData.quizzesPassed.length;
    document.getElementById("stat-bookmarks").textContent = state.userData.bookmarks.length;

    updateXPDisplay();
    renderAchievements();
    renderJournalHistory();

    const ig = document.getElementById("interests-grid");
    const sc = state.userData.categoryScores;
    const entries = state.categories.map(c => ({ c, s: sc[c] || 0 })).sort((a, b) => b.s - a.s);
    const max = Math.max(...entries.map(e => Math.abs(e.s)), 1);
    if (entries.every(e => e.s === 0)) ig.innerHTML = '<p class="empty-state">Read and rate lessons to see your profile.</p>';
    else ig.innerHTML = entries.map(e => {
      const pct = Math.round(Math.max(e.s, 0) / max * 100);
      return `<div class="interest-row"><span class="interest-label">${e.c}</span>
        <div class="interest-bar-track"><div class="interest-bar-fill" style="width:${Math.max(pct,2)}%;background:${CAT_COLORS[e.c]||"#7c6cf0"}"></div></div>
        <span class="interest-score">${e.s > 0 ? "+" : ""}${e.s}</span></div>`;
    }).join("");

    const bl = document.getElementById("bookmarks-list");
    if (!state.userData.bookmarks.length) bl.innerHTML = '<p class="empty-state">No bookmarks yet.</p>';
    else {
      bl.innerHTML = state.userData.bookmarks.map(id => {
        const l = state.lessons.find(x => x.id === id);
        return l ? `<div class="bk-item" data-id="${l.id}"><span class="bk-item-emoji">${l.emoji}</span><span class="bk-item-title">${l.title}</span></div>` : "";
      }).join("");
      bl.querySelectorAll(".bk-item").forEach(x => x.addEventListener("click", () => openReader(parseInt(x.dataset.id))));
    }

    const rl = document.getElementById("review-list");
    const due = getDueReviews();
    document.getElementById("review-badge").textContent = due.length;
    if (!due.length) rl.innerHTML = '<p class="empty-state">No reviews due.</p>';
    else {
      rl.innerHTML = due.map(r => {
        const l = state.lessons.find(x => x.id === r.lessonId);
        const stage = r.stage || 0;
        const labels = ["1d", "3d", "1w", "2w", "1mo"];
        return l ? `<div class="rv-item" data-id="${l.id}"><span class="rv-item-emoji">${l.emoji}</span><span class="rv-item-title">${l.title}</span><span class="rv-item-due">Stage ${stage + 1} · ${labels[stage]}</span></div>` : "";
      }).join("");
      rl.querySelectorAll(".rv-item").forEach(x => x.addEventListener("click", () => openReader(parseInt(x.dataset.id), true)));
    }
  }

  function renderAchievements() {
    const grid = document.getElementById("achievements-grid");
    if (!grid) return;
    const earned = state.userData.achievements || [];
    grid.innerHTML = ACHIEVEMENTS.map(a => {
      const unlocked = earned.includes(a.id);
      return `<div class="achievement-card ${unlocked ? "unlocked" : "locked"}">
        <div class="achievement-icon">${unlocked ? a.icon : "🔒"}</div>
        <div class="achievement-title">${a.title}</div>
        <div class="achievement-desc">${a.desc}</div>
      </div>`;
    }).join("");
  }

  function renderJournalHistory() {
    const list = document.getElementById("journal-list");
    if (!list) return;
    const journal = state.userData.journal || {};
    const allEntries = [];
    for (const [lid, entries] of Object.entries(journal)) {
      const l = state.lessons.find(x => x.id === parseInt(lid));
      if (!l) continue;
      for (const e of entries) allEntries.push({ lesson: l, date: e.date, text: e.text });
    }
    allEntries.sort((a, b) => b.date.localeCompare(a.date));
    if (!allEntries.length) { list.innerHTML = '<p class="empty-state">No reflections yet. Write one after a lesson!</p>'; return; }
    list.innerHTML = allEntries.slice(0, 20).map(e => `
      <div class="journal-entry">
        <div class="journal-entry-header">
          <span class="journal-entry-lesson">${e.lesson.emoji} ${e.lesson.title}</span>
          <span class="journal-entry-date">${e.date}</span>
        </div>
        <div class="journal-entry-text">${e.text}</div>
      </div>
    `).join("");
  }

  /* ---------- nav ---------- */
  function showScreen(name) {
    state.currentScreen = name;
    setArt();
    document.querySelectorAll("#screen-today,#screen-library,#screen-progress").forEach(s => s.classList.remove("active"));
    const t = document.getElementById("screen-" + name);
    if (t) t.classList.add("active");
    document.querySelectorAll(".nav-tab").forEach(tab => tab.classList.toggle("active", tab.dataset.screen === name));
    if (name === "library") { renderFilters(); renderLibrary(state.activeFilter); }
    else if (name === "progress") renderProgress();
    else renderHome();
    window.scrollTo({ top: 0 });
  }

  /* ---------- init ---------- */
  async function init() {
    await fetchLessons();
    state.todayLesson = pickToday();
    updateStreak();
    renderHome();

    document.getElementById("featured-card").addEventListener("click", e => {
      if (e.target.closest(".featured-start")) openReader(state.todayLesson.id);
    });
    document.getElementById("featured-start").addEventListener("click", () => openReader(state.todayLesson.id));

    document.querySelectorAll(".nav-tab").forEach(t => t.addEventListener("click", () => showScreen(t.dataset.screen)));
    document.getElementById("reader-close").addEventListener("click", closeReader);
    document.getElementById("reader-prev").addEventListener("click", () => navigateReader(-1));
    document.getElementById("reader-next").addEventListener("click", () => navigateReader(1));
    document.getElementById("reader-bookmark").addEventListener("click", toggleBookmark);

    document.addEventListener("keydown", e => {
      if (!document.getElementById("screen-reader").classList.contains("active")) return;
      if (e.key === "ArrowRight") navigateReader(1);
      if (e.key === "ArrowLeft") navigateReader(-1);
      if (e.key === "Escape") closeReader();
    });

    if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
    setupInstall();
  }

  /* ---------- install ---------- */
  let dip = null;
  function setupInstall() {
    const b = document.getElementById("install-banner");
    const bi = document.getElementById("btn-install");
    const bc = document.getElementById("btn-install-close");
    const ins = document.getElementById("install-instructions");
    if (window.matchMedia("(display-mode: standalone)").matches || navigator.standalone) return;
    if (sessionStorage.getItem("ml_inst_d")) return;
    window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); dip = e; ins.textContent = "Get quick access from your home screen."; b.classList.remove("hidden"); });
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    if (iOS) { ins.textContent = 'Tap share ⎙ then "Add to Home Screen."'; bi.textContent = "Got it"; b.classList.remove("hidden"); bi.addEventListener("click", () => { b.classList.add("hidden"); sessionStorage.setItem("ml_inst_d", "1"); }); }
    else bi.addEventListener("click", async () => { if (dip) { dip.prompt(); await dip.userChoice; dip = null; } b.classList.add("hidden"); sessionStorage.setItem("ml_inst_d", "1"); });
    bc.addEventListener("click", () => { b.classList.add("hidden"); sessionStorage.setItem("ml_inst_d", "1"); });
  }

  init();
})();
