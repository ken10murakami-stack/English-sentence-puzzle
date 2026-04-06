/**
 * 1. CONFIGURATION (設定)
 */
const CONFIG = {
  SET_SIZE: 10,
  STORAGE_KEYS: {
    STATS: "englishPuzzleStats",
    FILTERS: "englishPuzzleFilters"
  },
  SLOT_LABELS: [
    "⓪疑問文のとき", "①だれは/何は", "②どうする/=", "③何を/何", "④いつ・どこで・どのように"
  ],
  DEFAULT_SHEET_URL: "https://docs.google.com/spreadsheets/d/1oyFDh3Y4RoooTTmJjC-cXjQlCJIroDCz9eTVNebAKE4/edit?gid=863237441#gid=863237441",
  DEFAULT_HINT_TEXT: ""
};

/**
 * 2. APP STATE (状態管理)
 */
let state = {
  lessons: [],
  currentSet: [],
  setIndex: 0,
  setScore: 0,
  slotWords: Array.from({ length: CONFIG.SLOT_LABELS.length }, () => []),
  filters: {
    grades: new Set(["中1", "中2", "中3"]),
    grammar: new Set(),
    levels: new Set([1, 2, 3])
  },
  ui: {
    hintUsed: false,
    showWordHints: false
  }
};

/**
 * 3. DOM ELEMENTS (要素取得)
 */
const el = {
  japaneseHint: document.getElementById("japanese-hint"),
  slots: document.getElementById("slots"),
  wordBank: document.getElementById("word-bank"),
  feedback: document.getElementById("feedback"),
  checkBtn: document.getElementById("check-btn"),
  resetBtn: document.getElementById("reset-btn"),
  nextBtn: document.getElementById("next-btn"),
  homeBtn: document.getElementById("home-btn"),
  progressText: document.getElementById("progress-text"),
  progressValue: document.getElementById("progress-value"),
  answerExample: document.getElementById("answer-example"),
  answerSlots: document.getElementById("answer-slots"),
  confetti: document.getElementById("confetti"),
  homeScreen: document.getElementById("home-screen"),
  quizScreen: document.getElementById("quiz-screen"),
  gradeFilters: document.getElementById("grade-filters"),
  grammarFilters: document.getElementById("grammar-filters"),
  levelFilters: document.getElementById("level-filters"),
  startSetBtn: document.getElementById("start-set-btn"),
  resetStatsBtn: document.getElementById("reset-stats-btn"),
  homeStatus: document.getElementById("home-status"),
  levelProgress: document.getElementById("level-progress"),
  setSummary: document.getElementById("set-summary"),
  setScoreText: document.getElementById("set-score"),
  setMessage: document.getElementById("set-message"),
  setNextBtn: document.getElementById("set-next-btn"),
  toggleProgressBtn: document.getElementById("toggle-progress-btn"),
  progressPanel: document.getElementById("progress-panel"),
  progressTables: document.getElementById("progress-tables"),
  exportStatsBtn: document.getElementById("export-stats-btn"),
  importStatsInput: document.getElementById("import-stats-input"),
  resetGrammarSelect: document.getElementById("reset-grammar-select"),
  resetGrammarBtn: document.getElementById("reset-grammar-btn"),
  toggleWordHintsBtn: document.getElementById("toggle-word-hints-btn"),
  wordHintPanel: document.getElementById("word-hint-panel"),
  wordHintText: document.getElementById("word-hint-text")
};

/**
 * 4. UTILITIES (汎用ロジック)
 */
const Utils = {
  shuffle: (array) => {
    const copy = [...array];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  },
  normalize: (word) => (word || "").toLowerCase().trim(),
  countOccurrences: (list) => list.reduce((acc, word) => { acc[word] = (acc[word] ?? 0) + 1; return acc; }, {}),
  parseCsv: (text) => {
    const rows = []; let row = []; let current = ""; let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (char === '"') {
        if (inQuotes && text[i + 1] === '"') { current += '"'; i++; } else { inQuotes = !inQuotes; }
      } else if (char === ',' && !inQuotes) { row.push(current); current = ""; }
      else if ((char === "\n" || char === "\r") && !inQuotes) {
        if (char === "\r" && text[i + 1] === "\n") i++;
        row.push(current); rows.push(row); row = []; current = "";
      } else { current += char; }
    }
    if (current || row.length) { row.push(current); rows.push(row); }
    return rows.filter(r => r.some(c => c.trim().length > 0));
  }
};

/**
 * 5. STORAGE & DATA (データ管理)
 */
const Storage = {
  loadStats: () => { try { return JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEYS.STATS)) || {}; } catch { return {}; } },
  saveStats: (stats) => localStorage.setItem(CONFIG.STORAGE_KEYS.STATS, JSON.stringify(stats)),
  loadFilters: () => { try { return JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEYS.FILTERS)); } catch { return null; } },
  saveFilters: () => {
    const payload = { grades: Array.from(state.filters.grades), grammar: Array.from(state.filters.grammar), levels: Array.from(state.filters.levels) };
    localStorage.setItem(CONFIG.STORAGE_KEYS.FILTERS, JSON.stringify(payload));
  }
};

/**
 * 6. RENDERING ENGINE (描画処理)
 */
const Renderer = {
  createSlotCard: ({ label, words, index, droppable, onDrop }) => {
    const card = document.createElement("div");
    card.className = "slot-card";
    card.innerHTML = `<p class="slot-label">${label}</p>`;
    const slotDrop = document.createElement("div");
    slotDrop.className = "slot";
    slotDrop.dataset.index = index;

    if (droppable) {
      slotDrop.addEventListener("dragover", (e) => { e.preventDefault(); slotDrop.classList.add("slot--active"); });
      slotDrop.addEventListener("dragleave", () => slotDrop.classList.remove("slot--active"));
      slotDrop.addEventListener("drop", (e) => { e.preventDefault(); slotDrop.classList.remove("slot--active"); onDrop(e, index); });
    }

    words.forEach((word, wIdx) => {
      const chip = document.createElement("button");
      chip.className = "word word--chip";
      chip.textContent = word;
      chip.draggable = droppable;
      if (droppable) {
        chip.addEventListener("dragstart", (e) => {
          e.dataTransfer.setData("text/plain", word);
          e.dataTransfer.setData("source", "slot");
          e.dataTransfer.setData("sourceIndex", String(index));
          e.dataTransfer.setData("wordIndex", String(wIdx));
        });
      }
      slotDrop.appendChild(chip);
    });
    card.appendChild(slotDrop);
    return card;
  },

  renderSlots: () => {
    el.slots.innerHTML = "";
    CONFIG.SLOT_LABELS.forEach((label, index) => {
      el.slots.appendChild(Renderer.createSlotCard({
        label, words: state.slotWords[index], index, droppable: true,
        onDrop: (e, targetIdx) => {
          const word = e.dataTransfer.getData("text/plain");
          const source = e.dataTransfer.getData("source");
          if (source === "slot") {
            const sIdx = Number(e.dataTransfer.getData("sourceIndex"));
            const wIdx = Number(e.dataTransfer.getData("wordIndex"));
            const [moved] = state.slotWords[sIdx].splice(wIdx, 1);
            state.slotWords[targetIdx].push(moved);
          } else if (Logic.canAddWord(word)) {
            state.slotWords[targetIdx].push(word);
          }
          Renderer.renderSlots();
          Renderer.renderWordBank(Logic.getDisplayPieces(Logic.currentLesson()));
        }
      }));
    });
  },

  renderWordBank: (pieces) => {
    const selectedCounts = Utils.countOccurrences(state.slotWords.flat());
    el.wordBank.innerHTML = "";
    pieces.forEach(({ word, meaning }) => {
      const wrapper = document.createElement("div");
      wrapper.className = "word-piece";
      const btn = document.createElement("button");
      btn.className = "word";
      btn.textContent = word;
      btn.draggable = selectedCounts[word] <= 0;
      btn.addEventListener("dragstart", (e) => { e.dataTransfer.setData("text/plain", word); e.dataTransfer.setData("source", "bank"); });
      if (selectedCounts[word] > 0) { btn.classList.add("disabled"); selectedCounts[word]--; }
      wrapper.appendChild(btn);
      if (state.ui.showWordHints) {
        const p = document.createElement("p"); p.className = "word-meaning"; p.textContent = meaning || ""; wrapper.appendChild(p);
      }
      el.wordBank.appendChild(wrapper);
    });
  },

  triggerConfetti: (mode) => {
    el.confetti.innerHTML = "";
    el.confetti.className = mode === "grand" ? "confetti confetti--grand" : "confetti";
    const count = mode === "grand" ? 120 : 60;
    for (let i = 0; i < count; i++) {
      const p = document.createElement("span");
      p.className = "confetti-piece";
      p.style.setProperty("--x", `${Math.random() * 100}%`);
      p.style.setProperty("--delay", `${Math.random() * 0.4}s`);
      p.style.setProperty("--duration", `${1 + Math.random() * 0.8}s`);
      p.style.setProperty("--hue", `${Math.random() * 360}`);
      el.confetti.appendChild(p);
    }
    setTimeout(() => { el.confetti.innerHTML = ""; }, 2500);
  }
};

/**
 * 7. LOGIC (判定・解析)
 */
const Logic = {
  currentLesson: () => state.lessons[state.currentSet[state.setIndex]],
  canAddWord: (word) => {
    const lesson = Logic.currentLesson();
    const current = Utils.countOccurrences(state.slotWords.flat())[word] ?? 0;
    const total = lesson.words.filter(w => w === word).length;
    return current < total;
  },
  getDisplayPieces: (lesson) => {
    const pieces = lesson.words.map((w, i) => ({ word: w, meaning: lesson.wordMeanings[i] || "" }));
    if (!state.ui.showWordHints || !lesson.phraseGroups.length) return Utils.shuffle(pieces);
    const occupied = new Set(); const chunks = [];
    lesson.phraseGroups.forEach(g => {
      const range = Array.from({ length: g.end - g.start + 1 }, (_, o) => g.start + o);
      if (!range.some(idx => occupied.has(idx))) {
        chunks.push(range.map(idx => { occupied.add(idx); return pieces[idx]; }));
      }
    });
    pieces.forEach((p, i) => { if (!occupied.has(i)) chunks.push([p]); });
    return Utils.shuffle(chunks).flat();
  },
  checkAnswer: () => {
    const lesson = Logic.currentLesson();
    const arranged = state.slotWords.flat();
    const isCorrect = arranged.length === lesson.words.length &&
      lesson.slots.every((exp, i) => {
        const act = state.slotWords[i] || [];
        return act.length === exp.length && exp.every((w, wi) => Utils.normalize(w) === Utils.normalize(act[wi]));
      }) &&
      lesson.words.every((w, i) => Utils.normalize(w) === Utils.normalize(arranged[i]));

    const stats = Storage.loadStats();
    const entry = stats[lesson.id] ?? { correct: 0, wrong: 0, attempts: 0 };
    entry.attempts++;
    if (isCorrect) {
      entry.correct++; entry.wrong = 0;
      el.feedback.textContent = "正解！"; el.feedback.className = "feedback success";
      state.setScore++; Renderer.triggerConfetti("normal");
      setTimeout(Actions.advanceLesson, 1200);
    } else {
      entry.wrong++;
      el.feedback.textContent = "間違いです。"; el.feedback.className = "feedback error";
      state.ui.showWordHints = true; state.ui.hintUsed = true;
      Actions.showCorrectAnswer(lesson);
    }
    stats[lesson.id] = entry; Storage.saveStats(stats);
    Actions.updateStatus();
  },
  pickSet: () => {
    const stats = Storage.loadStats();
    const eligible = state.lessons.filter(l => state.filters.levels.has(l.level) && state.filters.grades.has(l.grade) && (state.filters.grammar.size === 0 || state.filters.grammar.has(l.grammar)));
    return Utils.shuffle(eligible).sort((a, b) => (stats[b.id]?.wrong || 0) - (stats[a.id]?.wrong || 0)).slice(0, CONFIG.SET_SIZE).map(l => state.lessons.indexOf(l));
  }
};

/**
 * 8. ACTIONS (操作)
 */
const Actions = {
  loadLesson: () => {
    const lesson = Logic.currentLesson();
    state.slotWords = Array.from({ length: CONFIG.SLOT_LABELS.length }, () => []);
    state.ui.hintUsed = false; state.ui.showWordHints = false;
    el.japaneseHint.textContent = lesson.japanese;
    el.feedback.textContent = ""; el.answerExample.hidden = true; el.nextBtn.hidden = true;
    el.checkBtn.disabled = false; el.resetBtn.disabled = false; el.wordHintPanel.hidden = true;
    Renderer.renderSlots();
    Renderer.renderWordBank(Logic.getDisplayPieces(lesson));
    Actions.updateProgress();
    el.wordHintText.textContent = lesson.hintText || "";
  },
  advanceLesson: () => {
    state.setIndex++;
    if (state.setIndex >= state.currentSet.length) {
      el.setSummary.hidden = false; el.setScoreText.textContent = `${state.setScore} / ${state.currentSet.length} 正解`;
      if (state.setScore === state.currentSet.length) Renderer.triggerConfetti("grand");
    } else { Actions.loadLesson(); }
  },
  showCorrectAnswer: (lesson) => {
    el.answerSlots.innerHTML = "";
    CONFIG.SLOT_LABELS.forEach((label, i) => el.answerSlots.appendChild(Renderer.createSlotCard({ label, words: lesson.slots[i] || [], index: i, droppable: false })));
    el.answerExample.hidden = false; el.nextBtn.hidden = false; el.checkBtn.disabled = true; el.resetBtn.disabled = true;
    Renderer.renderWordBank(Logic.getDisplayPieces(lesson));
  },
  updateProgress: () => {
    const p = ((state.setIndex + 1) / state.currentSet.length) * 100;
    el.progressText.textContent = `${state.setIndex + 1} / ${state.currentSet.length} 問目`;
    el.progressValue.style.width = `${p}%`;
  },
  updateStatus: () => {
    const stats = Storage.loadStats();
    const filtered = state.lessons.filter(l => state.filters.levels.has(l.level) && state.filters.grades.has(l.grade));
    const correctCount = filtered.filter(l => (stats[l.id]?.correct || 0) > 0).length;
    const rate = filtered.length ? Math.round((correctCount / filtered.length) * 100) : 0;
    el.levelProgress.innerHTML = `正解達成率: <strong>${rate}%</strong>`;
    el.homeStatus.textContent = rate === 100 ? "全問正解済みです！" : "準備OK！";
  }
};

/**
 * 9. DATA LOADER
 */
const DataLoader = {
  load: async () => {
    try {
      const res = await fetch(CONFIG.DEFAULT_SHEET_URL.replace(/\/edit.*$/, "/gviz/tq?tqx=out:csv&gid=863237441"));
      const text = await res.text();
      const rows = Utils.parseCsv(text);
      if (rows.length < 2) return;
      const h = rows[0].map(c => c.trim());
      state.lessons = rows.slice(1).map(r => {
        const english = (r[h.indexOf("英文")] || "").trim();
        const words = english.split(/\s+/);
        const hint = (r[h.indexOf("ヒント")] || "").trim();
        return {
          id: (r[h.indexOf("ID")] || "").trim(),
          grade: (r[h.indexOf("学年")] || "").trim(),
          grammar: (r[h.indexOf("文法項目")] || "").trim(),
          japanese: (r[h.indexOf("日本文")] || "").trim(),
          words,
          level: parseInt(r[h.indexOf("難易度")]) || 1,
          hintText: hint,
          wordMeanings: (r[h.indexOf("単語訳")] || hint).split(/[|｜]/).map(s => s.trim()),
          phraseGroups: Array.from(hint.matchAll(/\[([^\]]+)\]/g)).map(m => {
            const p = m[1].split(/\s+/).map(w => w.toLowerCase());
            const start = words.map(w => w.toLowerCase()).indexOf(p[0]);
            return start > -1 ? { start, end: start + p.length - 1 } : null;
          }).filter(g => g),
          slots: CONFIG.SLOT_LABELS.map(l => (r[h.indexOf(l)] || "").trim() ? r[h.indexOf(l)].trim().split(/\s+/) : [])
        };
      }).filter(l => l.japanese);
      
      const grammars = Array.from(new Set(state.lessons.map(l => l.grammar).filter(Boolean)));
      el.grammarFilters.innerHTML = "";
      grammars.forEach(g => {
        const lbl = document.createElement("label");
        lbl.innerHTML = `<input type="checkbox" value="${g}" checked> <span>${g}</span>`;
        lbl.querySelector("input").addEventListener("change", (e) => { e.target.checked ? state.filters.grammar.add(g) : state.filters.grammar.delete(g); Actions.updateStatus(); });
        el.grammarFilters.appendChild(lbl);
        state.filters.grammar.add(g);
      });
      Actions.updateStatus();
    } catch (e) { console.error(e); }
  }
};

/**
 * 10. INITIALIZE
 */
el.startSetBtn.addEventListener("click", () => {
  state.currentSet = Logic.pickSet();
  if (state.currentSet.length) { state.setIndex = 0; state.setScore = 0; el.quizScreen.hidden = false; el.homeScreen.hidden = true; Actions.loadLesson(); }
});
el.checkBtn.addEventListener("click", Logic.checkAnswer);
el.resetBtn.addEventListener("click", Actions.loadLesson);
el.nextBtn.addEventListener("click", Actions.advanceLesson);
el.homeBtn.addEventListener("click", () => { el.quizScreen.hidden = true; el.homeScreen.hidden = false; });
el.setNextBtn.addEventListener("click", () => el.startSetBtn.click());
el.toggleWordHintsBtn.addEventListener("click", () => { 
  state.ui.showWordHints = !state.ui.showWordHints; 
  el.wordHintPanel.hidden = !state.ui.showWordHints;
  Renderer.renderWordBank(Logic.getDisplayPieces(Logic.currentLesson())); 
});
/**
 * 10. INITIALIZE (イベントリスナーの完全登録)
 */
const initializeApp = () => {
  // --- 1. クイズ開始・ナビゲーション ---
  el.startSetBtn.addEventListener("click", () => {
    state.currentSet = Logic.pickSet();
    if (state.currentSet.length > 0) {
      state.setIndex = 0;
      state.setScore = 0;
      el.quizScreen.hidden = false;
      el.homeScreen.hidden = true;
      Actions.loadLesson();
    } else {
      el.homeStatus.textContent = "条件に合う問題がありません。選択範囲を確認してください。";
    }
  });

  el.homeBtn.addEventListener("click", () => {
    el.quizScreen.hidden = true;
    el.homeScreen.hidden = false;
    Actions.updateStatus(); // ホームに戻った時に進捗を更新
  });

  // --- 2. クイズ操作 ---
  el.checkBtn.addEventListener("click", Logic.checkAnswer);
  el.resetBtn.addEventListener("click", Actions.loadLesson);
  el.nextBtn.addEventListener("click", Actions.advanceLesson);
  el.setNextBtn.addEventListener("click", () => el.startSetBtn.click());

  // --- 3. 学習データ管理 (保存/リセット/表示) ---
  if (el.exportStatsBtn) {
    el.exportStatsBtn.addEventListener("click", () => {
      const stats = Storage.loadStats();
      const blob = new Blob([JSON.stringify(stats, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "english-puzzle-stats.json";
      a.click();
      URL.revokeObjectURL(url);
      el.homeStatus.textContent = "学習データを保存しました。";
    });
  }

  if (el.resetStatsBtn) {
    el.resetStatsBtn.addEventListener("click", () => {
      if (confirm("すべての学習記録をリセットしますか？")) {
        Storage.saveStats({});
        Actions.updateStatus();
        el.homeStatus.textContent = "記録をリセットしました。";
      }
    });
  }

  if (el.toggleProgressBtn) {
    el.toggleProgressBtn.addEventListener("click", () => {
      el.progressPanel.hidden = !el.progressPanel.hidden;
      // 達成状況表示のテーブル描画が必要な場合はここに追記
    });
  }

  // --- 4. フィルター操作 (学年・難易度) ---
  const setupFilters = (containerId, filterSet) => {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.querySelectorAll("input[type='checkbox']").forEach(input => {
      // 初期状態を反映
      if (input.checked) filterSet.add(isNaN(input.value) ? input.value : Number(input.value));
      
      input.addEventListener("change", (e) => {
        const val = isNaN(e.target.value) ? e.target.value : Number(e.target.value);
        e.target.checked ? filterSet.add(val) : filterSet.delete(val);
        Actions.updateStatus();
        Storage.saveFilters(); // フィルター状態を保存
      });
    });
  };

  setupFilters("grade-filters", state.filters.grades);
  setupFilters("level-filters", state.filters.levels);

  // --- 5. ヒント切り替え ---
  if (el.toggleWordHintsBtn) {
    el.toggleWordHintsBtn.addEventListener("click", () => { 
      state.ui.showWordHints = !state.ui.showWordHints; 
      el.wordHintPanel.hidden = !state.ui.showWordHints;
      el.toggleWordHintsBtn.textContent = state.ui.showWordHints ? "ヒントを隠す" : "ヒントを表示";
      Renderer.renderWordBank(Logic.getDisplayPieces(Logic.currentLesson())); 
    });
  }

  // 最後にデータの読み込みを開始
  DataLoader.load();
};

// 実行
initializeApp();
DataLoader.load();
