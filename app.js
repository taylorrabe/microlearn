(function () {
  "use strict";

  const STORAGE_KEY = "microlearn_data";
  const RATING_W = { love: 5, like: 2, meh: -1, dislike: -3 };
  const SIGNAL_W = { read: 0.5, bookmark: 3, quiz: 1.5 };
  const CAT_COLORS = {
    science: "#34d399", psychology: "#fb923c", mathematics: "#a78bfa",
    history: "#fbbf24", technology: "#60a5fa", philosophy: "#c084fc",
    linguistics: "#2dd4bf",
  };
  const GRADIENTS = [
    "var(--grad-1)", "var(--grad-2)", "var(--grad-3)", "var(--grad-4)",
    "var(--grad-5)", "var(--grad-6)", "var(--grad-7)",
  ];

  const state = {
    lessons: [], categories: [], todayLesson: null, currentLesson: null,
    currentScreen: "today", activeFilter: "all",
    readerCards: [], readerIndex: 0,
    userData: loadUserData(),
  };

  /* ---------- persistence ---------- */
  function loadUserData() {
    const d = { streak: 0, lastVisit: null, lessonsRead: [], quizzesPassed: [],
      bookmarks: [], reviewQueue: [], ratings: {}, categoryScores: {},
      todayLessonId: null, todayDate: null };
    try { const s = JSON.parse(localStorage.getItem(STORAGE_KEY)); return s ? { ...d, ...s } : d; }
    catch { return d; }
  }
  function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.userData)); }

  function today() { return new Date().toISOString().split("T")[0]; }

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

    renderRecommended();
    renderContinue();
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
  function openReader(lessonId) {
    const lesson = state.lessons.find(l => l.id === lessonId);
    if (!lesson) return;
    state.currentLesson = lesson;

    const contentCards = splitContent(lesson.content);
    const cards = [];

    cards.push({ type: "intro", lesson });

    contentCards.forEach((text, i) => {
      cards.push({ type: "content", text, index: i + 1, total: contentCards.length });
    });

    cards.push({ type: "takeaway", lesson });

    if (lesson.quiz) cards.push({ type: "quiz", lesson });

    cards.push({ type: "feedback", lesson });

    state.readerCards = cards;
    state.readerIndex = 0;

    if (!state.userData.lessonsRead.includes(lesson.id)) {
      state.userData.lessonsRead.push(lesson.id);
      catScore(lesson.category, SIGNAL_W.read);
      scheduleReview(lesson.id);
      save();
    }

    updateStreak();
    renderReader();

    document.getElementById("screen-reader").classList.remove("hidden");
    document.getElementById("screen-reader").classList.add("active");
    document.getElementById("bottom-nav").style.display = "none";

    updateBookmarkBtn();
  }

  function closeReader() {
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
        rateLesson(state.currentLesson.id, r);
        document.querySelectorAll(".fb-btn").forEach(b => b.classList.toggle("selected", b.dataset.r === r));
      });
    });
    const done = document.getElementById("card-done");
    if (done) done.addEventListener("click", closeReader);
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
    else { state.userData.bookmarks.push(id); catScore(state.currentLesson.category, SIGNAL_W.bookmark); }
    save();
    updateBookmarkBtn();
  }

  /* ---------- spaced repetition ---------- */
  function scheduleReview(id) {
    if (state.userData.reviewQueue.find(r => r.lessonId === id)) return;
    const d = new Date(); d.setDate(d.getDate() + 3);
    state.userData.reviewQueue.push({ lessonId: id, dueDate: d.toISOString().split("T")[0], interval: 3 });
    save();
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
    const due = state.userData.reviewQueue.filter(r => r.dueDate <= today());
    document.getElementById("review-badge").textContent = due.length;
    if (!due.length) rl.innerHTML = '<p class="empty-state">No reviews due.</p>';
    else {
      rl.innerHTML = due.map(r => {
        const l = state.lessons.find(x => x.id === r.lessonId);
        return l ? `<div class="rv-item" data-id="${l.id}"><span class="rv-item-emoji">${l.emoji}</span><span class="rv-item-title">${l.title}</span><span class="rv-item-due">Due today</span></div>` : "";
      }).join("");
      rl.querySelectorAll(".rv-item").forEach(x => x.addEventListener("click", () => openReader(parseInt(x.dataset.id))));
    }
  }

  /* ---------- nav ---------- */
  function showScreen(name) {
    state.currentScreen = name;
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
