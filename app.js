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
 * 4. UTILITIES & DATA PROCESSING (汎用ロジック)
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
  normalize: (word) => word.toLowerCase().trim(),
  generateId: (lesson) => `${lesson.japanese}__${lesson.words.join(" ")}`.replace(/\s+/g, "_"),
  countOccurrences: (list) => list.reduce((acc, word) => { acc[word] = (acc[word] ?? 0) + 1; return acc; }, {}),
  
  parseCsv: (text) => {
    const rows = []; let row = []; let current = ""; let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (char === '"') {
        if (inQuotes && text[i + 1] === '"') { current += '"'; i++; } 
        else { inQuotes = !inQuotes; }
      } else if (char === ',' && !inQuotes) { row.push(current.trim()); current = ""; }
      else if ((char === "\n" || char === "\r") && !inQuotes) {
        if (char === "\r" && text[i + 1] === "\n") i++;
        row.push(current.trim()); rows.push(row); row = []; current = "";
      } else { current += char; }
    }
    if (current || row.length) { row.push(current.trim()); rows.push(row); }
    return rows.filter(r => r.some(c => c.length > 0));
  }
};

/**
 * 5. STORAGE MANAGER (データ保存)
 */
const Storage = {
  loadStats: () => {
    try { return JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEYS.STATS)) || {}; } 
    catch { return {}; }
  },
  saveStats: (stats) => localStorage.setItem(CONFIG.STORAGE_KEYS.STATS, JSON.stringify(stats)),
  loadFilters: () => {
    try { return JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEYS.FILTERS)); } 
    catch { return null; }
  },
  saveFilters: (filters) => {
    const payload = { grades: Array.from(filters.grades), grammar: Array.from(filters.grammar), levels: Array.from(filters.levels) };
    localStorage.setItem(CONFIG.STORAGE_KEYS.FILTERS, JSON.stringify(payload));
  }
};
/**
 * 6. RENDERING ENGINE (描画処理)
 */
const Renderer = {
  // スロットの生成
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
      slotDrop.addEventListener("drop", (e) => { e.preventDefault(); slotDrop.classList.remove("slot--active"); onDrop(e, slotDrop); });
    }

    words.forEach((word, wordIndex) => {
      const chip = document.createElement("button");
      chip.className = "word word--chip";
      chip.type = "button";
      chip.textContent = word;
      chip.draggable = droppable;
      if (droppable) {
        chip.addEventListener("dragstart", (e) => {
          e.dataTransfer.setData("text/plain", word);
          e.dataTransfer.setData("source", "slot");
          e.dataTransfer.setData("sourceIndex", String(index));
          e.dataTransfer.setData("wordIndex", String(wordIndex));
        });
      }
      slotDrop.appendChild(chip);
    });

    card.appendChild(slotDrop);
    return card;
  },

  // 解答欄の描画
  renderSlots: () => {
    el.slots.innerHTML = "";
    CONFIG.SLOT_LABELS.forEach((label, index) => {
      const card = Renderer.createSlotCard({
        label,
        words: state.slotWords[index],
        index,
        droppable: true,
        onDrop: (e) => {
          const word = e.dataTransfer.getData("text/plain");
          const source = e.dataTransfer.getData("source");
          const sIdx = Number(e.dataTransfer.getData("sourceIndex"));
          const wIdx = Number(e.dataTransfer.getData("wordIndex"));

          if (source === "slot" && Number.isFinite(sIdx)) {
            const [moved] = state.slotWords[sIdx].splice(wIdx, 1);
            if (moved) state.slotWords[index].push(moved);
          } else if (source === "bank") {
            if (Logic.canAddWord(word)) state.slotWords[index].push(word);
          }
          Renderer.renderSlots();
          Renderer.renderWordBank(Logic.getDisplayPieces(Logic.currentLesson()));
        }
      });
      el.slots.appendChild(card);
    });
  },

  // 単語バンクの描画
  renderWordBank: (pieces) => {
    const selectedCounts = Utils.countOccurrences(state.slotWords.flat());
    el.wordBank.innerHTML = "";
    pieces.forEach(({ word, meaning }) => {
      const wrapper = document.createElement("div");
      wrapper.className = "word-piece";
      const btn = document.createElement("button");
      btn.className = "word";
      btn.textContent = word;
      btn.draggable = true;
      btn.addEventListener("dragstart", (e) => {
        e.dataTransfer.setData("text/plain", word);
        e.dataTransfer.setData("source", "bank");
      });

      if (selectedCounts[word] > 0) {
        btn.classList.add("disabled");
        btn.draggable = false;
        selectedCounts[word]--;
      }
      wrapper.appendChild(btn);
      if (state.ui.showWordHints) {
        const p = document.createElement("p");
        p.className = "word-meaning";
        p.textContent = meaning || "";
        wrapper.appendChild(p);
      }
      el.wordBank.appendChild(wrapper);
    });
  },

  // 紙吹雪の演出
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
      p.style.setProperty("--size", `${6 + Math.random() * 6}px`);
      p.style.setProperty("--rotate", `${Math.random() * 360}deg`);
      p.style.setProperty("--hue", `${Math.random() * 360}`);
      el.confetti.appendChild(p);
    }
    setTimeout(() => { el.confetti.innerHTML = ""; }, mode === "grand" ? 2400 : 1600);
  }
};

/**
 * 7. QUIZ LOGIC (クイズの核となる論理)
 */
const Logic = {
  currentLesson: () => state.lessons[state.currentSet[state.setIndex]],

  canAddWord: (word) => {
    const lesson = Logic.currentLesson();
    const selectedCount = Utils.countOccurrences(state.slotWords.flat())[word] ?? 0;
    const totalCount = lesson.words.filter(w => w === word).length;
    return selectedCount < totalCount;
  },

  getDisplayPieces: (lesson) => {
    const pieces = lesson.words.map((w, i) => ({ word: w, meaning: lesson.wordMeanings?.[i] || "" }));
    if (!state.ui.showWordHints) return Utils.shuffle(pieces);
    
    // フレーズ（熟語）のグループ化ロジック
    const groups = [...(lesson.phraseGroups ?? [])].sort((a, b) => a.start - b.start);
    if (groups.length === 0) return Utils.shuffle(pieces);

    const occupied = new Set();
    const chunks = [];
    groups.forEach(g => {
      const range = Array.from({ length: g.end - g.start + 1 }, (_, o) => g.start + o);
      if (range.some(idx => occupied.has(idx))) return;
      chunks.push(range.map(idx => { occupied.add(idx); return pieces[idx]; }));
    });
    pieces.forEach((p, i) => { if (!occupied.has(i)) chunks.push([p]); });
    return Utils.shuffle(chunks).flat();
  },

  checkAnswer: () => {
    const lesson = Logic.currentLesson();
    const arranged = state.slotWords.flat();
    
    // 判定ロジックの整理
    const isCorrect = arranged.length === lesson.words.length &&
      lesson.slots.every((expected, i) => {
        const actual = state.slotWords[i] || [];
        return actual.length === expected.length && 
               expected.every((w, wi) => Utils.normalize(w) === Utils.normalize(actual[wi]));
      }) &&
      lesson.words.every((w, i) => Utils.normalize(w) === Utils.normalize(arranged[i]));

    if (!state.ui.hintUsed || !isCorrect) Logic.updateStats(lesson.id, isCorrect);

    if (isCorrect) {
      el.feedback.textContent = "正解！次の問題に進みます。";
      el.feedback.className = "feedback success";
      state.setScore++;
      Renderer.triggerConfetti("normal");
      setTimeout(Actions.advanceLesson, 1200);
    } else {
      el.feedback.textContent = "間違いです。正解例を確認して次の問題へ進んでね。";
      el.feedback.className = "feedback error";
      state.ui.showWordHints = true;
      state.ui.hintUsed = true;
      el.answerExample.hidden = false;
      // 正解例の描画などはActionsで実行
      Actions.showCorrectAnswer(lesson);
    }
    Actions.updateUIProgress();
  },

  updateStats: (id, isCorrect) => {
    const stats = Storage.loadStats();
    const entry = stats[id] ?? { correct: 0, wrong: 0, attempts: 0 };
    entry.attempts++;
    if (isCorrect) { entry.correct++; entry.wrong = 0; } else { entry.wrong++; }
    stats[id] = entry;
    Storage.saveStats(stats);
  }
};
/**
 * 8. UI ACTIONS (画面遷移・ボタン動作)
 */
const Actions = {
  // 問題のセットアップ
  loadLesson: () => {
    const lesson = Logic.currentLesson();
    state.slotWords = Array.from({ length: CONFIG.SLOT_LABELS.length }, () => []);
    state.ui.hintUsed = false;
    state.ui.showWordHints = false;
    
    el.wordHintPanel.hidden = true;
    el.toggleWordHintsBtn.textContent = "ヒントを表示";
    el.japaneseHint.textContent = lesson.japanese;
    el.feedback.textContent = "";
    el.feedback.className = "feedback";
    el.answerExample.hidden = true;
    el.nextBtn.hidden = true;
    el.checkBtn.disabled = false;
    el.resetBtn.disabled = false;
    el.setSummary.hidden = true;

    Renderer.renderSlots();
    Renderer.renderWordBank(Logic.getDisplayPieces(lesson));
    Actions.updateUIProgress();
    Actions.renderWordHints(lesson);
  },

  // 次の問題へ進む / 終了判定
  advanceLesson: () => {
    state.setIndex++;
    if (state.setIndex >= state.currentSet.length) {
      Actions.finishSet();
    } else {
      Actions.loadLesson();
    }
  },

  // 正解例の表示（間違い時）
  showCorrectAnswer: (lesson) => {
    el.answerSlots.innerHTML = "";
    CONFIG.SLOT_LABELS.forEach((label, i) => {
      const card = Renderer.createSlotCard({
        label,
        words: lesson.slots[i] ?? [],
        index: i,
        droppable: false
      });
      el.answerSlots.appendChild(card);
    });
    el.nextBtn.hidden = false;
    el.checkBtn.disabled = true;
    el.resetBtn.disabled = true;
    Renderer.renderWordBank(Logic.getDisplayPieces(lesson));
  },

  // セット終了時
  finishSet: () => {
    el.setSummary.hidden = false;
    el.setScoreText.textContent = `${state.setScore} / ${state.currentSet.length} 正解`;
    el.setMessage.textContent = state.setScore === state.currentSet.length 
      ? "全問正解！この調子で次の10問へ進もう。" 
      : "おつかれさま！次の10問で復習しよう。";
    el.checkBtn.disabled = true;
    el.resetBtn.disabled = true;
    if (state.setScore === state.currentSet.length) Renderer.triggerConfetti("grand");
  },

  // 進捗バーの更新
  updateUIProgress: () => {
    const current = state.setIndex + 1;
    const total = state.currentSet.length;
    el.progressText.textContent = `${current} / ${total} 問目`;
    el.progressValue.style.width = `${(current / total) * 100}%`;
  },

  // ヒントテキストの描画
  renderWordHints: (lesson) => {
    const text = lesson.hintText || CONFIG.DEFAULT_HINT_TEXT || "";
    el.wordHintText.textContent = text;
    return text.trim().length > 0;
  }
};

/**
 * 9. DATA LOADING (外部データ取得)
 */
const DataLoader = {
  loadFromSheet: async (url) => {
    const csvUrl = DataLoader.buildCsvUrl(url);
    if (!csvUrl) return;
    try {
      const response = await fetch(csvUrl);
      const text = await response.text();
      const rows = Utils.parseCsv(text);
      if (rows.length === 0) return;

      // ヘッダー解析とデータ変換（元のロジックを維持）
      // ... (中略: ヘッダーマップの作成とビルド処理) ...
      // 簡略化のため、元のbuildHeaderMap/buildLessonFromRowと同等の処理を実行
      const headerRow = rows[0];
      const lessons = rows.slice(1).map(row => {
        // ここに以前の buildLessonFromRow と同等のパース処理が入ります
        // 実装の詳細は元のコードをベースにstate.lessonsへ格納
        return Logic.parseLessonRow(row, headerRow); 
      }).filter(l => l !== null);

      state.lessons = lessons;
      Actions.initFilters(); // フィルターの初期化
    } catch (e) { console.warn("Sheet load failed.", e); }
  },

  buildCsvUrl: (url) => {
    if (url.includes("gviz") || url.includes("export?format=csv")) return url;
    const match = url.match(/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (!match) return null;
    const gidMatch = url.match(/gid=([0-9]+)/);
    return `https://docs.google.com/spreadsheets/d/${match[1]}/gviz/tq?tqx=out:csv&gid=${gidMatch ? gidMatch[1] : "0"}`;
  }
};

/**
 * 10. INITIALIZATION & EVENTS (起動とイベント設定)
 */
const initializeApp = () => {
  // イベントリスナーの一括登録
  el.checkBtn.addEventListener("click", Logic.checkAnswer);
  el.resetBtn.addEventListener("click", () => Actions.loadLesson());
  el.nextBtn.addEventListener("click", Actions.advanceLesson);
  el.startSetBtn.addEventListener("click", () => {
    // 問題の抽出ロジック（pickSetLessons）を実行し、state.currentSetを更新して開始
    state.currentSet = Logic.pickSet(); 
    if (state.currentSet.length > 0) {
      state.setIndex = 0; state.setScore = 0;
      el.quizScreen.hidden = false; el.homeScreen.hidden = true;
      Actions.loadLesson();
    }
  });
  el.homeBtn.addEventListener("click", () => {
    el.quizScreen.hidden = true; el.homeScreen.hidden = false;
  });

  // スプレッドシート読み込み開始
  DataLoader.loadFromSheet(CONFIG.DEFAULT_SHEET_URL);
};

// 実行
initializeApp();
/**
 * 8. QUIZ LOGIC (追加：データ解析・抽出ロジック)
 */
Object.assign(Logic, {
  // 元の buildHeaderMap と同等：列のタイトルからインデックスを特定
  buildHeaderMap: (headerRow) => {
    const normalized = headerRow.map(cell => cell.trim());
    const findIdx = (label) => normalized.findIndex(cell => cell === label);
    
    const slotIndices = CONFIG.SLOT_LABELS.map(label => findIdx(label));
    const hintIdx = ["ヒント", "説明", "単語意味", "Meaning"].map(findIdx).find(i => i >= 0);
    const wordMeaningIdx = ["単語訳", "単語ごとの意味", "Word Gloss"].map(findIdx).find(i => i >= 0);

    return {
      japaneseIdx: findIdx("日本文"),
      englishIdx: findIdx("英文"),
      idIdx: findIdx("ID"),
      gradeIdx: findIdx("学年"),
      grammarIdx: findIdx("文法項目"),
      levelIdx: findIdx("難易度"),
      hintIdx,
      wordMeaningIdx,
      slotIndices,
      hasHeader: findIdx("日本文") >= 0
    };
  },

  // 元の buildLessonFromRow と同等：1行のデータをLessonオブジェクトに変換
  parseLessonRow: (row, headerMap) => {
    const japanese = (row[headerMap.japaneseIdx] ?? "").trim();
    if (!japanese) return null;

    const english = (row[headerMap.englishIdx] ?? "").trim();
    const level = parseInt(row[headerMap.levelIdx]) || 1;
    
    // スロットデータの構築
    const slots = headerMap.slotIndices.map(idx => {
      const val = (row[idx] ?? "").trim();
      return val ? val.split(/\s+/) : [];
    });

    const words = english ? english.split(/\s+/) : slots.flat().filter(Boolean);
    const hintCell = (row[headerMap.hintIdx] ?? "").trim();
    const wordMeaningCell = (row[headerMap.wordMeaningIdx] ?? hintCell).trim();

    return {
      id: (row[headerMap.idIdx] ?? "").trim() || `ID_${Math.random().toString(36).substr(2, 9)}`,
      grade: (row[headerMap.gradeIdx] ?? "").trim(),
      grammar: (row[headerMap.grammarIdx] ?? "").trim(),
      japanese,
      words,
      slots,
      hintText: hintCell,
      wordMeanings: Logic.parseWordMeanings(wordMeaningCell, words),
      phraseGroups: Logic.parsePhraseGroups(wordMeaningCell, words),
      level
    };
  },

  // 補助：単語ごとの意味をパース
  parseWordMeanings: (cell, words) => {
    if (!cell) return words.map(() => "");
    const parts = cell.split(/[|｜]/).map(s => s.trim());
    return words.map((_, i) => parts[i] || "");
  },

  // 補助：熟語（[take a bus]など）を特定
  parsePhraseGroups: (cell, words) => {
    const pattern = /\[([^\]]+)\]/g;
    const matches = Array.from(cell.matchAll(pattern));
    const groups = [];
    const lowerWords = words.map(w => w.toLowerCase());

    matches.forEach(m => {
      const pWords = m[1].trim().split(/\s+/).map(w => w.toLowerCase());
      for (let i = 0; i <= lowerWords.length - pWords.length; i++) {
        if (pWords.every((pw, offset) => lowerWords[i + offset] === pw)) {
          groups.push({ start: i, end: i + pWords.length - 1 });
        }
      }
    });
    return groups;
  },

  // 問題を10問選出するロジック（統計に基づいた優先順位）
  pickSet: () => {
    const stats = Storage.loadStats();
    const eligible = state.lessons.filter(l => 
      state.filters.levels.has(l.level) &&
      state.filters.grades.has(l.grade) &&
      (state.filters.grammar.size === 0 || state.filters.grammar.has(l.grammar))
    );

    return Utils.shuffle(eligible)
      .sort((a, b) => {
        const sA = stats[a.id] ?? { wrong: 0, attempts: 0 };
        const sB = stats[b.id] ?? { wrong: 0, attempts: 0 };
        if (sB.wrong !== sA.wrong) return sB.wrong - sA.wrong; // 負け越し優先
        return sA.attempts - sB.attempts; // 未着手優先
      })
      .slice(0, CONFIG.SET_SIZE)
      .map(lesson => state.lessons.indexOf(lesson));
  }
});

/**
 * 9. DATA LOADING (完全版：データ取得フロー)
 */
const DataLoader = {
  loadFromSheet: async (url) => {
    const csvUrl = DataLoader.buildCsvUrl(url);
    if (!csvUrl) return;
    try {
      const response = await fetch(csvUrl);
      const text = await response.text();
      const rows = Utils.parseCsv(text);
      if (rows.length < 2) return;

      const headerMap = Logic.buildHeaderMap(rows[0]);
      state.lessons = rows.slice(1)
        .map(row => Logic.parseLessonRow(row, headerMap))
        .filter(l => l !== null);

      Actions.initFilters(); // フィルターUIを生成
      Actions.updateHomeStatus(); // ホーム画面のメッセージを更新
    } catch (e) { console.error("Sheet load failed.", e); }
  },

  buildCsvUrl: (url) => {
    const match = url.match(/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (!match) return null;
    const gidMatch = url.match(/gid=([0-9]+)/);
    const gid = gidMatch ? gidMatch[1] : "0";
    return `https://docs.google.com/spreadsheets/d/${match[1]}/gviz/tq?tqx=out:csv&gid=${gid}`;
  }
};

/**
 * 10. INITIALIZATION (追加：フィルター初期化などの補助)
 */
Actions.initFilters = () => {
  // 文法項目のリストを作成
  const grammars = Array.from(new Set(state.lessons.map(l => l.grammar).filter(Boolean)));
  state.filters.grammar = new Set(grammars);
  
  // 各フィルター（学年、文法、レベル）のチェックボックスを描画する処理をここに記述
  // (元の renderGradeFilters 等を呼び出す)
  // ... 
};

// 最後にアプリを起動
const initializeApp = () => {
  el.checkBtn.addEventListener("click", Logic.checkAnswer);
  el.resetBtn.addEventListener("click", () => Actions.loadLesson());
  el.nextBtn.addEventListener("click", Actions.advanceLesson);
  el.startSetBtn.addEventListener("click", () => {
    state.currentSet = Logic.pickSet();
    if (state.currentSet.length > 0) {
      state.setIndex = 0; state.setScore = 0;
      el.quizScreen.hidden = false; el.homeScreen.hidden = true;
      Actions.loadLesson();
    } else {
      el.homeStatus.textContent = "条件に合う問題がありません。";
    }
  });
  el.homeBtn.addEventListener("click", () => {
    el.quizScreen.hidden = true; el.homeScreen.hidden = false;
  });

  DataLoader.loadFromSheet(CONFIG.DEFAULT_SHEET_URL);
};

initializeApp();
