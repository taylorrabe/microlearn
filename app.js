(function () {
  "use strict";

  const STORAGE_KEY = "microlearn_data";

  const PAINTINGS = [
    { cls: "art-0", title: "The Starry Night", artist: "Vincent van Gogh, 1889" },
    { cls: "art-1", title: "The Great Wave off Kanagawa", artist: "Katsushika Hokusai, 1831" },
    { cls: "art-2", title: "Water Lilies", artist: "Claude Monet, 1906" },
    { cls: "art-3", title: "The School of Athens", artist: "Raphael, 1511" },
    { cls: "art-4", title: "Mona Lisa", artist: "Leonardo da Vinci, 1503" },
    { cls: "art-5", title: "The Birth of Venus", artist: "Sandro Botticelli, 1485" },
    { cls: "art-6", title: "Girl with a Pearl Earring", artist: "Johannes Vermeer, 1665" },
  ];

  const RATING_WEIGHTS = { love: 5, like: 2, meh: -1, dislike: -3 };
  const SIGNAL_WEIGHTS = { read: 0.5, bookmark: 3, quiz_pass: 1.5 };
  const CATEGORY_COLORS = {
    science: "#1a7a6d",
    psychology: "#b85c3a",
    mathematics: "#5b4a9e",
    history: "#9e7c20",
    technology: "#2c6fbb",
    philosophy: "#7b6aad",
    linguistics: "#2a8a5e",
  };

  let currentArtIndex = -1;

  function setBackground() {
    let next;
    do {
      next = Math.floor(Math.random() * PAINTINGS.length);
    } while (next === currentArtIndex && PAINTINGS.length > 1);
    currentArtIndex = next;

    const painting = PAINTINGS[currentArtIndex];
    document.body.className = painting.cls;

    let credit = document.querySelector(".art-credit");
    if (!credit) {
      credit = document.createElement("div");
      credit.className = "art-credit";
      document.body.appendChild(credit);
    }
    credit.textContent = painting.title + " — " + painting.artist;
  }

  setBackground();

  const state = {
    lessons: [],
    categories: [],
    todayLesson: null,
    currentLesson: null,
    currentScreen: "today",
    activeFilter: "all",
    userData: loadUserData(),
  };

  function loadUserData() {
    const defaults = {
      streak: 0,
      lastVisit: null,
      lessonsRead: [],
      quizzesPassed: [],
      bookmarks: [],
      reviewQueue: [],
      ratings: {},
      categoryScores: {},
      todayLessonId: null,
      todayDate: null,
    };
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      return saved ? { ...defaults, ...saved } : defaults;
    } catch {
      return defaults;
    }
  }

  function saveUserData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.userData));
  }

  function today() {
    return new Date().toISOString().split("T")[0];
  }

  // --- Preference Engine ---

  function getCategoryScores() {
    return state.userData.categoryScores || {};
  }

  function addCategorySignal(category, weight) {
    if (!category) return;
    if (!state.userData.categoryScores) state.userData.categoryScores = {};
    const current = state.userData.categoryScores[category] || 0;
    state.userData.categoryScores[category] = Math.round((current + weight) * 100) / 100;
    saveUserData();
  }

  function ratelesson(lessonId, rating) {
    const lesson = state.lessons.find((l) => l.id === lessonId);
    if (!lesson) return;

    const prev = state.userData.ratings[lessonId];
    if (prev) {
      addCategorySignal(lesson.category, -RATING_WEIGHTS[prev]);
    }

    state.userData.ratings[lessonId] = rating;
    addCategorySignal(lesson.category, RATING_WEIGHTS[rating]);
    saveUserData();
  }

  function getLessonScore(lesson) {
    const scores = getCategoryScores();
    const catScore = scores[lesson.category] || 0;
    const wasRead = state.userData.lessonsRead.includes(lesson.id) ? -2 : 0;
    return catScore + wasRead;
  }

  function getRecommendedLessons(excludeId, count) {
    const scored = state.lessons
      .filter((l) => l.id !== excludeId)
      .map((l) => ({ lesson: l, score: getLessonScore(l) }));

    scored.sort((a, b) => b.score - a.score);

    const unread = scored.filter(
      (s) => !state.userData.lessonsRead.includes(s.lesson.id)
    );
    const read = scored.filter((s) =>
      state.userData.lessonsRead.includes(s.lesson.id)
    );

    const pool = [...unread, ...read];
    return pool.slice(0, count);
  }

  function pickTodayLesson() {
    const todayStr = today();
    if (
      state.userData.todayDate === todayStr &&
      state.userData.todayLessonId
    ) {
      const cached = state.lessons.find(
        (l) => l.id === state.userData.todayLessonId
      );
      if (cached) return cached;
    }

    const scores = getCategoryScores();
    const hasPreferences = Object.values(scores).some((s) => s !== 0);

    let chosen;

    if (hasPreferences) {
      const unread = state.lessons.filter(
        (l) => !state.userData.lessonsRead.includes(l.id)
      );
      const pool = unread.length > 0 ? unread : state.lessons;

      const weighted = pool.map((l) => {
        const catScore = scores[l.category] || 0;
        return { lesson: l, weight: Math.max(catScore + 10, 1) };
      });

      const dayHash = hashDate(todayStr);
      const totalWeight = weighted.reduce((s, w) => s + w.weight, 0);
      let target = (dayHash % (totalWeight * 100)) / 100;

      chosen = weighted[weighted.length - 1].lesson;
      for (const w of weighted) {
        target -= w.weight;
        if (target <= 0) {
          chosen = w.lesson;
          break;
        }
      }
    } else {
      const dayIndex = Math.floor(
        (new Date(todayStr) - new Date("2025-01-01")) / (1000 * 60 * 60 * 24)
      );
      chosen = state.lessons[dayIndex % state.lessons.length];
    }

    state.userData.todayLessonId = chosen.id;
    state.userData.todayDate = todayStr;
    saveUserData();
    return chosen;
  }

  function hashDate(dateStr) {
    let h = 0;
    for (let i = 0; i < dateStr.length; i++) {
      h = ((h << 5) - h + dateStr.charCodeAt(i)) | 0;
    }
    return Math.abs(h);
  }

  // --- Streak ---

  function updateStreak() {
    const now = today();
    const last = state.userData.lastVisit;

    if (!last) {
      state.userData.streak = 1;
    } else if (last === now) {
      // same day
    } else {
      const lastDate = new Date(last);
      const nowDate = new Date(now);
      const diff = Math.floor(
        (nowDate - lastDate) / (1000 * 60 * 60 * 24)
      );
      state.userData.streak = diff === 1 ? state.userData.streak + 1 : 1;
    }

    state.userData.lastVisit = now;
    saveUserData();
    renderStreak();
  }

  function renderStreak() {
    document.getElementById("streak-count").textContent =
      state.userData.streak;
    const statEl = document.getElementById("stat-streak");
    if (statEl) statEl.textContent = state.userData.streak;
  }

  // --- Markdown ---

  function markdownToHtml(text) {
    return text
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      .replace(/^- (.+)$/gm, "<li>$1</li>")
      .replace(/(<li>.*<\/li>)/s, "<ul>$1</ul>")
      .replace(/\n\n/g, "</p><p>")
      .replace(/\n/g, "<br>")
      .replace(/^(.+)$/gm, function (line) {
        if (line.startsWith("<") || line.startsWith("</")) return line;
        return line;
      })
      .replace(/^(?!<)/, "<p>")
      .replace(/(?!>)$/, "</p>");
  }

  function categoryClass(cat) {
    return "cat-" + cat;
  }

  // --- Data Loading ---

  async function fetchLessons() {
    const res = await fetch("lessons.json");
    state.lessons = await res.json();
    state.categories = [...new Set(state.lessons.map((l) => l.category))];
  }

  // --- Feedback UI ---

  function setupFeedbackButtons(prefix, getLessonFn) {
    ["love", "like", "meh", "dislike"].forEach((rating) => {
      const btn = document.getElementById(prefix + "-fb-" + rating);
      if (!btn) return;
      btn.addEventListener("click", () => {
        const lesson = getLessonFn();
        if (!lesson) return;
        ratelesson(lesson.id, rating);
        updateFeedbackUI(prefix, lesson.id);
        renderRecommended();
      });
    });
  }

  function updateFeedbackUI(prefix, lessonId) {
    const current = state.userData.ratings[lessonId];
    ["love", "like", "meh", "dislike"].forEach((r) => {
      const btn = document.getElementById(prefix + "-fb-" + r);
      if (btn) btn.classList.toggle("selected", current === r);
    });
  }

  // --- Rendering ---

  function renderTodayLesson() {
    const lesson = state.todayLesson;
    if (!lesson) return;

    document.getElementById("today-category").textContent = lesson.category;
    document.getElementById("today-category").className =
      "today-category " + categoryClass(lesson.category);
    document.getElementById("today-emoji").textContent = lesson.emoji;
    document.getElementById("today-title").textContent = lesson.title;
    document.getElementById("today-duration").textContent = lesson.duration;
    document.getElementById("today-body").innerHTML = markdownToHtml(
      lesson.content
    );
    document.getElementById("today-takeaway-text").textContent =
      lesson.keyTakeaway;
    document.getElementById("today-further-text").textContent =
      lesson.furtherReading;

    updateBookmarkButton(
      lesson.id,
      document.getElementById("btn-bookmark"),
      document.getElementById("bookmark-icon")
    );

    updateFeedbackUI("today", lesson.id);

    if (!state.userData.lessonsRead.includes(lesson.id)) {
      state.userData.lessonsRead.push(lesson.id);
      addCategorySignal(lesson.category, SIGNAL_WEIGHTS.read);
      scheduleReview(lesson.id);
      saveUserData();
    }

    updateStreak();
    renderRecommended();
  }

  function renderRecommended() {
    const list = document.getElementById("recommended-list");
    const hint = document.getElementById("recommended-hint");
    const section = document.getElementById("today-recommended");
    if (!list || !section) return;

    const scores = getCategoryScores();
    const hasPrefs = Object.values(scores).some((s) => s > 0);

    if (!hasPrefs) {
      hint.textContent = "Rate lessons to get personalized recommendations.";
      list.innerHTML = "";
      return;
    }

    const recs = getRecommendedLessons(
      state.todayLesson ? state.todayLesson.id : -1,
      4
    );

    if (recs.length === 0) {
      list.innerHTML =
        '<p class="empty-state">Rate more lessons to unlock recommendations.</p>';
      return;
    }

    const maxScore = Math.max(...recs.map((r) => r.score), 1);

    hint.textContent = "Based on what you enjoy";
    list.innerHTML = recs
      .map((r) => {
        const pct = Math.min(Math.round((Math.max(r.score, 0) / maxScore) * 100), 100);
        const isUnread = !state.userData.lessonsRead.includes(r.lesson.id);
        return `
        <div class="recommended-card" data-id="${r.lesson.id}">
          <div class="recommended-card-emoji">${r.lesson.emoji}</div>
          <div class="recommended-card-info">
            <div class="recommended-card-title">${r.lesson.title}</div>
            <div class="recommended-card-meta">
              <span class="library-card-cat ${categoryClass(r.lesson.category)}">${r.lesson.category}</span>
              <span>${r.lesson.duration}</span>
              ${isUnread ? "" : '<span class="library-card-check">✓ Read</span>'}
            </div>
          </div>
          <span class="recommended-card-match">${pct}% match</span>
        </div>`;
      })
      .join("");

    list.querySelectorAll(".recommended-card").forEach((card) => {
      card.addEventListener("click", () =>
        openLesson(parseInt(card.dataset.id))
      );
    });
  }

  function renderLibrary(filter) {
    const grid = document.getElementById("library-grid");
    let filtered =
      filter && filter !== "all"
        ? state.lessons.filter((l) => l.category === filter)
        : [...state.lessons];

    const scores = getCategoryScores();
    const hasPrefs = Object.values(scores).some((s) => s !== 0);

    if (hasPrefs && (!filter || filter === "all")) {
      filtered.sort((a, b) => getLessonScore(b) - getLessonScore(a));
    }

    grid.innerHTML = filtered
      .map((lesson) => {
        const rating = state.userData.ratings[lesson.id];
        const ratingBadge = rating
          ? `<span class="library-card-rating">${rating === "love" ? "♥" : rating === "like" ? "👍" : rating === "meh" ? "😐" : "👎"}</span>`
          : "";
        return `
      <div class="library-card" data-id="${lesson.id}">
        <div class="library-card-emoji">${lesson.emoji}</div>
        <div class="library-card-info">
          <div class="library-card-title">${lesson.title}</div>
          <div class="library-card-meta">
            <span class="library-card-cat ${categoryClass(lesson.category)}">${lesson.category}</span>
            <span>${lesson.duration}</span>
            ${state.userData.lessonsRead.includes(lesson.id) ? '<span class="library-card-check">✓ Read</span>' : ""}
            ${ratingBadge}
          </div>
        </div>
      </div>
    `;
      })
      .join("");

    grid.querySelectorAll(".library-card").forEach((card) => {
      card.addEventListener("click", () => {
        openLesson(parseInt(card.dataset.id));
      });
    });
  }

  function renderFilters() {
    const container = document.getElementById("library-filters");
    const scores = getCategoryScores();
    const sorted = [...state.categories].sort(
      (a, b) => (scores[b] || 0) - (scores[a] || 0)
    );
    const chips = ["all", ...sorted];

    container.innerHTML = chips
      .map(
        (cat) =>
          `<button class="filter-chip ${cat === state.activeFilter ? "active" : ""}" data-cat="${cat}">${cat}</button>`
      )
      .join("");

    container.querySelectorAll(".filter-chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        state.activeFilter = chip.dataset.cat;
        container
          .querySelectorAll(".filter-chip")
          .forEach((c) => c.classList.remove("active"));
        chip.classList.add("active");
        renderLibrary(state.activeFilter);
      });
    });
  }

  function renderInterests() {
    const grid = document.getElementById("interests-grid");
    if (!grid) return;

    const scores = getCategoryScores();
    const entries = state.categories.map((cat) => ({
      cat,
      score: scores[cat] || 0,
    }));

    entries.sort((a, b) => b.score - a.score);
    const maxScore = Math.max(...entries.map((e) => Math.abs(e.score)), 1);

    if (entries.every((e) => e.score === 0)) {
      grid.innerHTML =
        '<p class="empty-state">Read and rate lessons to see your interest profile.</p>';
      return;
    }

    grid.innerHTML = entries
      .map((e) => {
        const pct = Math.round(
          (Math.max(e.score, 0) / maxScore) * 100
        );
        const color = CATEGORY_COLORS[e.cat] || "#7c5c3c";
        return `
        <div class="interest-row">
          <span class="interest-label">${e.cat}</span>
          <div class="interest-bar-track">
            <div class="interest-bar-fill" style="width:${Math.max(pct, 2)}%;background:${color}"></div>
          </div>
          <span class="interest-score">${e.score > 0 ? "+" : ""}${e.score}</span>
        </div>`;
      })
      .join("");
  }

  function renderProgress() {
    document.getElementById("stat-streak").textContent =
      state.userData.streak;
    document.getElementById("stat-lessons").textContent =
      state.userData.lessonsRead.length;
    document.getElementById("stat-quizzes").textContent =
      state.userData.quizzesPassed.length;
    document.getElementById("stat-bookmarks").textContent =
      state.userData.bookmarks.length;

    renderInterests();

    const bookmarksList = document.getElementById("bookmarks-list");
    if (state.userData.bookmarks.length === 0) {
      bookmarksList.innerHTML =
        '<p class="empty-state">No bookmarks yet. Save lessons you want to revisit!</p>';
    } else {
      bookmarksList.innerHTML = state.userData.bookmarks
        .map((id) => {
          const lesson = state.lessons.find((l) => l.id === id);
          if (!lesson) return "";
          return `
          <div class="bookmark-item" data-id="${lesson.id}">
            <span class="bookmark-item-emoji">${lesson.emoji}</span>
            <span class="bookmark-item-title">${lesson.title}</span>
          </div>
        `;
        })
        .join("");

      bookmarksList.querySelectorAll(".bookmark-item").forEach((item) => {
        item.addEventListener("click", () => {
          openLesson(parseInt(item.dataset.id));
        });
      });
    }

    const reviewList = document.getElementById("review-list");
    const dueReviews = state.userData.reviewQueue.filter(
      (r) => r.dueDate <= today()
    );
    document.getElementById("review-badge").textContent = dueReviews.length;

    if (dueReviews.length === 0) {
      reviewList.innerHTML =
        '<p class="empty-state">No reviews due. Check back later!</p>';
    } else {
      reviewList.innerHTML = dueReviews
        .map((review) => {
          const lesson = state.lessons.find(
            (l) => l.id === review.lessonId
          );
          if (!lesson) return "";
          return `
          <div class="review-item" data-id="${lesson.id}">
            <span class="review-item-emoji">${lesson.emoji}</span>
            <span class="review-item-title">${lesson.title}</span>
            <span class="review-item-due">Due today</span>
          </div>
        `;
        })
        .join("");

      reviewList.querySelectorAll(".review-item").forEach((item) => {
        item.addEventListener("click", () => {
          openLesson(parseInt(item.dataset.id));
        });
      });
    }
  }

  function openLesson(id) {
    const lesson = state.lessons.find((l) => l.id === id);
    if (!lesson) return;
    state.currentLesson = lesson;

    document.getElementById("lesson-category").textContent = lesson.category;
    document.getElementById("lesson-category").className =
      "today-category " + categoryClass(lesson.category);
    document.getElementById("lesson-emoji").textContent = lesson.emoji;
    document.getElementById("lesson-title").textContent = lesson.title;
    document.getElementById("lesson-duration").textContent = lesson.duration;
    document.getElementById("lesson-body").innerHTML = markdownToHtml(
      lesson.content
    );
    document.getElementById("lesson-takeaway-text").textContent =
      lesson.keyTakeaway;
    document.getElementById("lesson-further-text").textContent =
      lesson.furtherReading;

    updateBookmarkButton(
      lesson.id,
      document.getElementById("btn-lesson-bookmark"),
      document.getElementById("lesson-bookmark-icon")
    );

    updateFeedbackUI("lesson", lesson.id);

    if (!state.userData.lessonsRead.includes(lesson.id)) {
      state.userData.lessonsRead.push(lesson.id);
      addCategorySignal(lesson.category, SIGNAL_WEIGHTS.read);
      scheduleReview(lesson.id);
      saveUserData();
    }

    showScreen("lesson");
  }

  function updateBookmarkButton(lessonId, btn, icon) {
    const isBookmarked = state.userData.bookmarks.includes(lessonId);
    icon.textContent = isBookmarked ? "★" : "☆";
    btn.classList.toggle("bookmarked", isBookmarked);
  }

  function toggleBookmark(lessonId, btn, icon) {
    const lesson = state.lessons.find((l) => l.id === lessonId);
    const idx = state.userData.bookmarks.indexOf(lessonId);
    if (idx >= 0) {
      state.userData.bookmarks.splice(idx, 1);
      if (lesson) addCategorySignal(lesson.category, -SIGNAL_WEIGHTS.bookmark);
    } else {
      state.userData.bookmarks.push(lessonId);
      if (lesson) addCategorySignal(lesson.category, SIGNAL_WEIGHTS.bookmark);
    }
    saveUserData();
    updateBookmarkButton(lessonId, btn, icon);
  }

  // --- Quiz ---

  function openQuiz(lesson) {
    if (!lesson || !lesson.quiz) return;
    state.currentLesson = lesson;

    document.getElementById("quiz-question").textContent =
      lesson.quiz.question;
    const optionsEl = document.getElementById("quiz-options");
    const resultEl = document.getElementById("quiz-result");
    resultEl.classList.add("hidden");

    optionsEl.innerHTML = lesson.quiz.options
      .map(
        (opt, i) =>
          `<button class="quiz-option" data-index="${i}">${opt}</button>`
      )
      .join("");

    optionsEl.querySelectorAll(".quiz-option").forEach((btn) => {
      btn.addEventListener("click", () => handleQuizAnswer(btn, lesson));
    });

    showScreen("quiz");
  }

  function handleQuizAnswer(btn, lesson) {
    const selected = parseInt(btn.dataset.index);
    const correct = lesson.quiz.correctIndex;
    const isCorrect = selected === correct;

    const allBtns = document.querySelectorAll(".quiz-option");
    allBtns.forEach((b) => {
      b.classList.add("disabled");
      if (parseInt(b.dataset.index) === correct) b.classList.add("correct");
    });

    if (!isCorrect) btn.classList.add("incorrect");

    const resultEl = document.getElementById("quiz-result");
    const resultText = document.getElementById("quiz-result-text");
    const explanation = document.getElementById("quiz-explanation");

    resultText.textContent = isCorrect ? "Correct!" : "Not quite!";
    resultText.className =
      "quiz-result-text " + (isCorrect ? "correct" : "incorrect");
    explanation.textContent = lesson.quiz.explanation;
    resultEl.classList.remove("hidden");

    if (isCorrect && !state.userData.quizzesPassed.includes(lesson.id)) {
      state.userData.quizzesPassed.push(lesson.id);
      addCategorySignal(lesson.category, SIGNAL_WEIGHTS.quiz_pass);
      saveUserData();
    }
  }

  // --- Spaced Repetition ---

  function scheduleReview(lessonId) {
    const existing = state.userData.reviewQueue.find(
      (r) => r.lessonId === lessonId
    );
    if (existing) return;

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 3);

    state.userData.reviewQueue.push({
      lessonId,
      dueDate: dueDate.toISOString().split("T")[0],
      interval: 3,
    });
    saveUserData();
  }

  function completeReview(lessonId) {
    const review = state.userData.reviewQueue.find(
      (r) => r.lessonId === lessonId
    );
    if (!review) return;

    review.interval = Math.min(review.interval * 2, 30);
    const nextDue = new Date();
    nextDue.setDate(nextDue.getDate() + review.interval);
    review.dueDate = nextDue.toISOString().split("T")[0];
    saveUserData();
  }

  // --- Navigation ---

  function showScreen(name) {
    state.currentScreen = name;
    setBackground();

    document
      .querySelectorAll(".screen")
      .forEach((s) => s.classList.remove("active"));
    const target = document.getElementById("screen-" + name);
    if (target) target.classList.add("active");

    document.querySelectorAll(".nav-tab").forEach((t) => {
      t.classList.toggle("active", t.dataset.screen === name);
    });

    const backBtn = document.getElementById("btn-back");
    const isSubScreen = name === "quiz" || name === "lesson";
    backBtn.classList.toggle("hidden", !isSubScreen);

    if (name === "library") {
      renderFilters();
      renderLibrary(state.activeFilter);
    } else if (name === "progress") {
      renderProgress();
    }

    window.scrollTo({ top: 0, behavior: "smooth" });

    if (!isSubScreen) {
      state._parentScreen = name;
    }
  }

  // --- Init ---

  async function init() {
    await fetchLessons();

    state.todayLesson = pickTodayLesson();

    renderTodayLesson();
    renderFilters();
    renderStreak();

    setupFeedbackButtons("today", () => state.todayLesson);
    setupFeedbackButtons("lesson", () => state.currentLesson);

    document.querySelectorAll(".nav-tab").forEach((tab) => {
      tab.addEventListener("click", () => showScreen(tab.dataset.screen));
    });

    document.getElementById("btn-back").addEventListener("click", () => {
      showScreen(state._parentScreen || "today");
    });

    document.getElementById("btn-quiz").addEventListener("click", () => {
      openQuiz(state.todayLesson);
    });

    document
      .getElementById("btn-lesson-quiz")
      .addEventListener("click", () => {
        openQuiz(state.currentLesson);
      });

    document.getElementById("btn-bookmark").addEventListener("click", () => {
      if (state.todayLesson) {
        toggleBookmark(
          state.todayLesson.id,
          document.getElementById("btn-bookmark"),
          document.getElementById("bookmark-icon")
        );
      }
    });

    document
      .getElementById("btn-lesson-bookmark")
      .addEventListener("click", () => {
        if (state.currentLesson) {
          toggleBookmark(
            state.currentLesson.id,
            document.getElementById("btn-lesson-bookmark"),
            document.getElementById("lesson-bookmark-icon")
          );
        }
      });

    document.getElementById("btn-quiz-done").addEventListener("click", () => {
      if (state.currentLesson) {
        completeReview(state.currentLesson.id);
      }
      showScreen(state._parentScreen || "today");
    });

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    setupInstallPrompt();
  }

  // --- Install Prompt ---

  let deferredInstallPrompt = null;

  function setupInstallPrompt() {
    const banner = document.getElementById("install-banner");
    const btnInstall = document.getElementById("btn-install");
    const btnClose = document.getElementById("btn-install-close");
    const instructions = document.getElementById("install-instructions");

    if (
      window.matchMedia("(display-mode: standalone)").matches ||
      navigator.standalone
    ) {
      return;
    }

    const dismissed = sessionStorage.getItem("microlearn_install_dismissed");
    if (dismissed) return;

    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      deferredInstallPrompt = e;
      instructions.textContent = "Get quick access from your home screen.";
      banner.classList.remove("hidden");
    });

    const isIOS =
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

    if (isIOS) {
      instructions.textContent =
        'Tap the share button ⎙ then "Add to Home Screen."';
      btnInstall.textContent = "Got it";
      banner.classList.remove("hidden");

      btnInstall.addEventListener("click", () => {
        banner.classList.add("hidden");
        sessionStorage.setItem("microlearn_install_dismissed", "1");
      });
    } else {
      btnInstall.addEventListener("click", async () => {
        if (deferredInstallPrompt) {
          deferredInstallPrompt.prompt();
          const result = await deferredInstallPrompt.userChoice;
          if (result.outcome === "accepted") {
            banner.classList.add("hidden");
          }
          deferredInstallPrompt = null;
        } else {
          instructions.textContent =
            'Use your browser menu → "Add to Home Screen" or "Install App."';
          btnInstall.textContent = "Got it";
          btnInstall.addEventListener(
            "click",
            () => {
              banner.classList.add("hidden");
              sessionStorage.setItem("microlearn_install_dismissed", "1");
            },
            { once: true }
          );
        }
      });
    }

    btnClose.addEventListener("click", () => {
      banner.classList.add("hidden");
      sessionStorage.setItem("microlearn_install_dismissed", "1");
    });

    setTimeout(() => {
      if (
        !deferredInstallPrompt &&
        !isIOS &&
        !banner.classList.contains("hidden")
      )
        return;
      if (!deferredInstallPrompt && !isIOS) {
        instructions.textContent =
          'Use your browser menu → "Add to Home Screen."';
        btnInstall.textContent = "Got it";
        banner.classList.remove("hidden");
      }
    }, 3000);
  }

  init();
})();
