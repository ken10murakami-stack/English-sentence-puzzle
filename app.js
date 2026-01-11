let lessons = [];

const SET_SIZE = 10;
const STATS_KEY = "englishPuzzleStats";
let currentSet = [];
let setIndex = 0;
let setScore = 0;
let gradeOptions = ["中1", "中2", "中3"];
let selectedGrades = new Set(gradeOptions);
let selectedGrammar = new Set();
let selectedLevels = new Set([1, 2, 3]);
const slotLabels = [
  "⓪疑問文のとき",
  "①だれは/何は",
  "②どうする/=",
  "③何を/何",
  "④いつ・どこで・どのように",
];
let slotWords = Array.from({ length: slotLabels.length }, () => []);

const japaneseHint = document.getElementById("japanese-hint");
const slots = document.getElementById("slots");
const wordBank = document.getElementById("word-bank");
const feedback = document.getElementById("feedback");
const checkBtn = document.getElementById("check-btn");
const resetBtn = document.getElementById("reset-btn");
const nextBtn = document.getElementById("next-btn");
const homeBtn = document.getElementById("home-btn");
const progressText = document.getElementById("progress-text");
const progressValue = document.getElementById("progress-value");
const answerExample = document.getElementById("answer-example");
const answerSlots = document.getElementById("answer-slots");
const confetti = document.getElementById("confetti");
const homeScreen = document.getElementById("home-screen");
const quizScreen = document.getElementById("quiz-screen");
const gradeFilters = document.getElementById("grade-filters");
const grammarFilters = document.getElementById("grammar-filters");
const levelFilters = document.getElementById("level-filters");
const startSetBtn = document.getElementById("start-set-btn");
const resetStatsBtn = document.getElementById("reset-stats-btn");
const homeStatus = document.getElementById("home-status");
const levelProgress = document.getElementById("level-progress");
const setSummary = document.getElementById("set-summary");
const setScoreText = document.getElementById("set-score");
const setMessage = document.getElementById("set-message");
const setNextBtn = document.getElementById("set-next-btn");
const sheetUrlInput = document.getElementById("sheet-url");
const loadSheetBtn = document.getElementById("load-sheet-btn");
const DEFAULT_SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1A4oxIkzDYQ2sAhdLCATzU2Yi7-jflm01kkxhIjmuLo4/edit?gid=863237441#gid=863237441";

const shuffleArray = (array) => {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

const normalizeLessonId = (lesson) =>
  `${lesson.japanese}__${lesson.words.join(" ")}`.replace(/\s+/g, "_");

const assignLessonIds = (lessonList) =>
  lessonList.map((lesson) => ({
    ...lesson,
    id: lesson.id ?? normalizeLessonId(lesson),
    level: lesson.level ?? 1,
  }));

lessons = assignLessonIds(lessons);

const loadStats = () => {
  const raw = localStorage.getItem(STATS_KEY);
  if (!raw) {
    return {};
  }
  try {
    return JSON.parse(raw);
  } catch (error) {
    return {};
  }
};

const saveStats = (stats) => {
  localStorage.setItem(STATS_KEY, JSON.stringify(stats));
};

const clearStats = () => {
  localStorage.removeItem(STATS_KEY);
};

const getLessonStats = (stats, lessonId) =>
  stats[lessonId] ?? { correct: 0, wrong: 0, attempts: 0 };

const updateLessonStats = (lessonId, isCorrect) => {
  const stats = loadStats();
  const entry = getLessonStats(stats, lessonId);
  entry.attempts += 1;
  if (isCorrect) {
    entry.correct += 1;
  } else {
    entry.wrong += 1;
  }
  stats[lessonId] = entry;
  saveStats(stats);
};

const buildCheckboxOption = (label, value, checked, onChange) => {
  const wrapper = document.createElement("label");
  wrapper.className = "filter-option";
  const input = document.createElement("input");
  input.type = "checkbox";
  input.value = value;
  input.checked = checked;
  input.addEventListener("change", onChange);
  const text = document.createElement("span");
  text.textContent = label;
  wrapper.appendChild(input);
  wrapper.appendChild(text);
  return wrapper;
};

const renderGradeFilters = () => {
  gradeFilters.innerHTML = "";
  gradeOptions.forEach((grade) => {
    const option = buildCheckboxOption(
      grade,
      grade,
      selectedGrades.has(grade),
      (event) => {
        if (event.target.checked) {
          selectedGrades.add(grade);
        } else {
          selectedGrades.delete(grade);
        }
        updateHomeStatus();
        updateLevelProgress();
      }
    );
    gradeFilters.appendChild(option);
  });
};

const renderGrammarFilters = () => {
  grammarFilters.innerHTML = "";
  const items = [...selectedGrammar];
  const grammarOptions = Array.from(
    new Set(lessons.map((lesson) => lesson.grammar).filter(Boolean))
  );
  if (items.length === 0) {
    selectedGrammar = new Set(grammarOptions);
  }
  grammarOptions.forEach((grammar) => {
    const option = buildCheckboxOption(
      grammar,
      grammar,
      selectedGrammar.has(grammar),
      (event) => {
        if (event.target.checked) {
          selectedGrammar.add(grammar);
        } else {
          selectedGrammar.delete(grammar);
        }
        updateHomeStatus();
        updateLevelProgress();
      }
    );
    grammarFilters.appendChild(option);
  });
};

const renderLevelFilters = () => {
  levelFilters.innerHTML = "";
  [1, 2, 3].forEach((level) => {
    const label = `レベル${level}`;
    const option = buildCheckboxOption(
      label,
      String(level),
      selectedLevels.has(level),
      (event) => {
        const value = Number(event.target.value);
        if (event.target.checked) {
          selectedLevels.add(value);
        } else {
          selectedLevels.delete(value);
        }
        updateHomeStatus();
        updateLevelProgress();
      }
    );
    levelFilters.appendChild(option);
  });
};

const parseCsvRow = (row) => {
  const result = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < row.length; i += 1) {
    const char = row[i];
    if (char === "\"") {
      if (inQuotes && row[i + 1] === "\"") {
        current += "\"";
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
};

const parseCsv = (text) =>
  text
    .trim()
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map(parseCsvRow);

const buildLessonSlots = (row, slotIndices) => {
  const indices = slotIndices ?? [2, 3, 4, 5, 6];
  const slotValues = indices.map((index) => (row[index] ?? "").trim());
  if (slotValues.some((value) => value.length > 0)) {
    return slotValues.map((value) => (value ? value.split(" ") : []));
  }
  return Array.from({ length: slotLabels.length }, (_, index) =>
    index === slotLabels.length - 1 ? row[1].split(" ") : []
  );
};

const parseLevelValue = (value) => {
  const text = value.trim();
  if (text.includes("レベル1") || text === "1") {
    return 1;
  }
  if (text.includes("レベル2") || text === "2") {
    return 2;
  }
  if (text.includes("レベル3") || text === "3") {
    return 3;
  }
  const parsed = Number.parseInt(text, 10);
  if ([1, 2, 3].includes(parsed)) {
    return parsed;
  }
  return 1;
};

const buildHeaderMap = (headerRow) => {
  const normalized = headerRow.map((cell) => cell.trim());
  const findIndex = (label) => normalized.findIndex((cell) => cell === label);
  const slotIndices = slotLabels.map((label) => findIndex(label));
  const required = [
    "ID",
    "学年",
    "文法項目",
    "英文",
    "日本文",
    "難易度",
  ];
  if (required.every((label) => findIndex(label) >= 0) && slotIndices.every((index) => index >= 0)) {
    return {
      japaneseIdx: findIndex("日本文"),
      englishIdx: findIndex("英文"),
      idIdx: findIndex("ID"),
      gradeIdx: findIndex("学年"),
      grammarIdx: findIndex("文法項目"),
      levelIdx: findIndex("難易度"),
      slotIndices,
      hasHeader: true,
    };
  }
  return { hasHeader: false };
};

const buildLessonFromRow = (row, headerMap) => {
  const japaneseIdx = headerMap.japaneseIdx ?? 0;
  const englishIdx = headerMap.englishIdx ?? 1;
  const slots = buildLessonSlots(row, headerMap.slotIndices);
  const english = (row[englishIdx] ?? "").trim();
  const words = english.length > 0 ? english.split(" ") : slots.flat().filter(Boolean);
  const level = parseLevelValue(row[headerMap.levelIdx ?? 7] ?? "1");
  return {
    id: (row[headerMap.idIdx ?? -1] ?? "").trim() || undefined,
    grade: (row[headerMap.gradeIdx ?? -1] ?? "").trim(),
    grammar: (row[headerMap.grammarIdx ?? -1] ?? "").trim(),
    japanese: (row[japaneseIdx] ?? "").trim(),
    words,
    slots,
    level,
  };
};

const loadLessonsFromRows = (rows, headerMap) => {
  const parsedLessons = rows
    .map((row) => row.map((cell) => cell.trim()))
    .filter((row) => {
      const hasSlots = (headerMap.slotIndices ?? [2, 3, 4, 5, 6])
        .map((index) => row[index] ?? "")
        .some((value) => value.trim().length > 0);
      const japanese = (row[headerMap.japaneseIdx ?? 0] ?? "").trim();
      const english = (row[headerMap.englishIdx ?? 1] ?? "").trim();
      return row.length >= 2 && japanese && (english || hasSlots);
    })
    .map((row) => buildLessonFromRow(row, headerMap));

  if (parsedLessons.length === 0) {
    return null;
  }
  return assignLessonIds(parsedLessons);
};

const buildSheetCsvUrl = (url) => {
  if (url.includes("gviz") || url.includes("export?format=csv")) {
    return url;
  }
  const match = url.match(/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!match) {
    return null;
  }
  const sheetId = match[1];
  const gidMatch = url.match(/gid=([0-9]+)/);
  const gid = gidMatch ? gidMatch[1] : "0";
  return `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&gid=${gid}`;
};

const createSlotCard = ({
  label,
  words,
  index,
  droppable,
  onDrop,
}) => {
  const slotCard = document.createElement("div");
  slotCard.className = "slot-card";

  const slotLabel = document.createElement("p");
  slotLabel.className = "slot-label";
  slotLabel.textContent = label;

  const slotDrop = document.createElement("div");
  slotDrop.className = "slot";
  slotDrop.dataset.index = index;

  if (droppable) {
    slotDrop.addEventListener("dragover", (event) => {
      event.preventDefault();
      slotDrop.classList.add("slot--active");
    });
    slotDrop.addEventListener("dragleave", () => {
      slotDrop.classList.remove("slot--active");
    });
    slotDrop.addEventListener("drop", (event) => {
      event.preventDefault();
      slotDrop.classList.remove("slot--active");
      onDrop(event, slotDrop);
    });
  }

  words.forEach((word, wordIndex) => {
    const chip = document.createElement("button");
    chip.className = "word word--chip";
    chip.type = "button";
    chip.textContent = word;
    chip.draggable = droppable;
    if (droppable) {
      chip.addEventListener("dragstart", (event) => {
        event.dataTransfer.setData("text/plain", word);
        event.dataTransfer.setData("source", "slot");
        event.dataTransfer.setData("sourceIndex", String(index));
        event.dataTransfer.setData("wordIndex", String(wordIndex));
      });
    }
    slotDrop.appendChild(chip);
  });

  slotCard.appendChild(slotLabel);
  slotCard.appendChild(slotDrop);
  return slotCard;
};

const renderSlots = () => {
  slots.innerHTML = "";
  slotLabels.forEach((label, index) => {
    const slotCard = createSlotCard({
      label,
      words: slotWords[index],
      index,
      droppable: true,
      onDrop: (event) => {
        const word = event.dataTransfer.getData("text/plain");
        const source = event.dataTransfer.getData("source");
        const sourceIndex = Number(event.dataTransfer.getData("sourceIndex"));
        const wordIndex = Number(event.dataTransfer.getData("wordIndex"));
        if (source === "slot" && Number.isFinite(sourceIndex) && Number.isFinite(wordIndex)) {
          const [moved] = slotWords[sourceIndex].splice(wordIndex, 1);
          if (moved) {
            slotWords[index].push(moved);
          }
        } else if (source === "bank") {
          if (addWord(word)) {
            slotWords[index].push(word);
          }
        }
        renderSlots();
        renderWordBank(shuffleArray(currentLesson().words));
      },
    });
    slots.appendChild(slotCard);
  });
};

const renderAnswerSlots = (lesson) => {
  answerSlots.innerHTML = "";
  slotLabels.forEach((label, index) => {
    const slotCard = createSlotCard({
      label,
      words: lesson.slots[index] ?? [],
      index,
      droppable: false,
      onDrop: null,
    });
    answerSlots.appendChild(slotCard);
  });
};

const countOccurrences = (list) =>
  list.reduce((accumulator, word) => {
    accumulator[word] = (accumulator[word] ?? 0) + 1;
    return accumulator;
  }, {});

const renderWordBank = (words) => {
  const selectedCounts = countOccurrences(slotWords.flat());
  wordBank.innerHTML = "";
  words.forEach((word) => {
    const button = document.createElement("button");
    button.className = "word";
    button.type = "button";
    button.textContent = word;
    button.draggable = true;
    button.addEventListener("dragstart", (event) => {
      event.dataTransfer.setData("text/plain", word);
      event.dataTransfer.setData("source", "bank");
    });
    if (selectedCounts[word] > 0) {
      button.classList.add("disabled");
      button.draggable = false;
      selectedCounts[word] -= 1;
    }
    wordBank.appendChild(button);
  });
};

const pickSetLessons = () => {
  const stats = loadStats();
  const eligible = lessons
    .map((lesson, index) => ({ lesson, index }))
    .filter((item) => selectedLevels.has(item.lesson.level))
    .filter((item) => selectedGrades.has(item.lesson.grade))
    .filter((item) =>
      selectedGrammar.size === 0 ? true : selectedGrammar.has(item.lesson.grammar)
    );
  const prioritized = eligible.map(({ lesson, index }) => {
    const entry = getLessonStats(stats, lesson.id);
    return {
      lessonIndex: index,
      wrong: entry.wrong,
      unattempted: entry.attempts === 0,
      correct: entry.correct,
      random: Math.random(),
    };
  });

  prioritized.sort((a, b) => {
    if (b.wrong !== a.wrong) {
      return b.wrong - a.wrong;
    }
    if (a.unattempted !== b.unattempted) {
      return a.unattempted ? -1 : 1;
    }
    if (a.correct !== b.correct) {
      return a.correct - b.correct;
    }
    return a.random - b.random;
  });

  return prioritized.slice(0, SET_SIZE).map((item) => item.lessonIndex);
};

const filteredLessons = () =>
  lessons.filter(
    (lesson) =>
      selectedLevels.has(lesson.level) &&
      selectedGrades.has(lesson.grade) &&
      (selectedGrammar.size === 0 || selectedGrammar.has(lesson.grammar))
  );

const updateHomeStatus = () => {
  const stats = loadStats();
  const levelLessons = filteredLessons();
  if (levelLessons.length === 0) {
    homeStatus.textContent = "条件に合う問題がありません。";
    return;
  }
  const allCorrect = levelLessons.every((lesson) => getLessonStats(stats, lesson.id).correct > 0);
  homeStatus.textContent = allCorrect
    ? "このレベルの問題はすべて正解済みです。"
    : "準備OK！10問1セットに挑戦しよう。";
};

const updateLevelProgress = () => {
  const stats = loadStats();
  const levelLessons = filteredLessons();
  const total = levelLessons.length;
  const correct = levelLessons.filter((lesson) => getLessonStats(stats, lesson.id).correct > 0)
    .length;
  const rate = total === 0 ? 0 : Math.round((correct / total) * 100);
  levelProgress.innerHTML =
    total === 0
      ? "このレベルには問題がありません。"
      : `正解達成率: <strong>${rate}%</strong>`;
};

const startSet = () => {
  currentSet = pickSetLessons();
  if (currentSet.length === 0) {
    homeStatus.textContent = "出題できる問題がありません。";
    return;
  }
  setIndex = 0;
  setScore = 0;
  quizScreen.hidden = false;
  homeScreen.hidden = true;
  checkBtn.disabled = false;
  resetBtn.disabled = false;
  loadLesson();
};

const finishSet = () => {
  setSummary.hidden = false;
  setScoreText.textContent = `${setScore} / ${currentSet.length} 正解`;
  setMessage.textContent =
    setScore === currentSet.length ? "全問正解！この調子で次の10問へ進もう。" : "おつかれさま！次の10問で復習しよう。";
  checkBtn.disabled = true;
  resetBtn.disabled = true;
  nextBtn.hidden = true;
  answerExample.hidden = true;
  if (setScore === currentSet.length) {
    triggerConfetti("grand");
  }
};

const updateProgress = () => {
  if (currentSet.length === 0) {
    progressText.textContent = "0 / 0 問目";
    progressValue.style.width = "0%";
    return;
  }
  progressText.textContent = `${setIndex + 1} / ${currentSet.length} 問目`;
  const percentage = ((setIndex + 1) / currentSet.length) * 100;
  progressValue.style.width = `${percentage}%`;
};

const currentLesson = () => lessons[currentSet[setIndex]];

const loadLesson = () => {
  const lesson = currentLesson();
  slotWords = Array.from({ length: slotLabels.length }, () => []);
  japaneseHint.textContent = lesson.japanese;
  renderSlots();
  renderWordBank(shuffleArray(lesson.words));
  feedback.textContent = "";
  feedback.className = "feedback";
  answerExample.hidden = true;
  answerSlots.innerHTML = "";
  nextBtn.hidden = true;
  setSummary.hidden = true;
  updateProgress();
};

wordBank.addEventListener("dragover", (event) => {
  event.preventDefault();
  wordBank.classList.add("word-bank__list--active");
});

wordBank.addEventListener("dragleave", () => {
  wordBank.classList.remove("word-bank__list--active");
});

wordBank.addEventListener("drop", (event) => {
  event.preventDefault();
  wordBank.classList.remove("word-bank__list--active");
  const source = event.dataTransfer.getData("source");
  const sourceIndex = Number(event.dataTransfer.getData("sourceIndex"));
  const wordIndex = Number(event.dataTransfer.getData("wordIndex"));
  if (source === "slot" && Number.isFinite(sourceIndex) && Number.isFinite(wordIndex)) {
    slotWords[sourceIndex].splice(wordIndex, 1);
    renderSlots();
    renderWordBank(shuffleArray(currentLesson().words));
  }
});

const addWord = (word) => {
  const lesson = currentLesson();
  const selectedCount = countOccurrences(slotWords.flat())[word] ?? 0;
  const totalCount = lesson.words.filter((item) => item === word).length;
  if (selectedCount >= totalCount) {
    return false;
  }
  return true;
};

const resetAnswer = () => {
  const lesson = currentLesson();
  slotWords = Array.from({ length: slotLabels.length }, () => []);
  renderSlots();
  renderWordBank(shuffleArray(lesson.words));
  feedback.textContent = "";
  feedback.className = "feedback";
  answerExample.hidden = true;
  answerSlots.innerHTML = "";
  nextBtn.hidden = true;
};

const advanceLesson = () => {
  setIndex += 1;
  if (setIndex >= currentSet.length) {
    finishSet();
    return;
  }
  loadLesson();
};

const normalizeWord = (word) => word.toLowerCase();

const areSlotWordsEqual = (currentSlots, expectedSlots) =>
  expectedSlots.every((expectedWords, index) => {
    const actualWords = currentSlots[index] ?? [];
    if (actualWords.length !== expectedWords.length) {
      return false;
    }
    return expectedWords.every(
      (word, wordIndex) => normalizeWord(word) === normalizeWord(actualWords[wordIndex])
    );
  });

const applyLessons = (newLessons) => {
  lessons = assignLessonIds(newLessons);
  const derivedGrades = Array.from(
    new Set(lessons.map((lesson) => lesson.grade).filter(Boolean))
  );
  if (derivedGrades.length > 0) {
    gradeOptions = derivedGrades;
  }
  selectedGrades = new Set(gradeOptions);
  selectedGrammar = new Set();
  currentSet = [];
  setIndex = 0;
  setScore = 0;
  quizScreen.hidden = true;
  homeScreen.hidden = false;
  renderGrammarFilters();
  renderGradeFilters();
  renderLevelFilters();
  updateHomeStatus();
  updateLevelProgress();
};

const returnHome = () => {
  quizScreen.hidden = true;
  homeScreen.hidden = false;
  setSummary.hidden = true;
  updateHomeStatus();
  updateLevelProgress();
};

const resetStats = () => {
  const message = "今までの学習データが全て消えます。本当にリセットしますか";
  if (!window.confirm(message)) {
    return;
  }
  clearStats();
  updateHomeStatus();
  updateLevelProgress();
};

const loadSheetLessons = async (sheetUrl) => {
  const csvUrl = buildSheetCsvUrl(sheetUrl);
  if (!csvUrl) {
    return;
  }
  try {
    const response = await fetch(csvUrl);
    if (!response.ok) {
      throw new Error("Failed to load sheet.");
    }
    const text = await response.text();
    let rows = parseCsv(text);
    let headerMap = { hasHeader: false };
    if (rows.length > 0) {
      headerMap = buildHeaderMap(rows[0]);
      if (headerMap.hasHeader) {
        rows = rows.slice(1);
      }
    }
    const parsedLessons = loadLessonsFromRows(rows, headerMap);
    if (!parsedLessons) {
      return;
    }
    applyLessons(parsedLessons);
  } catch (error) {
    console.warn("Sheet load failed.", error);
  }
};

const checkAnswer = () => {
  const lesson = currentLesson();
  const arrangedWords = slotWords.flat();
  const isCorrect =
    arrangedWords.length === lesson.words.length &&
    areSlotWordsEqual(slotWords, lesson.slots) &&
    lesson.words.every(
      (word, index) => normalizeWord(word) === normalizeWord(arrangedWords[index])
    );
  updateLessonStats(lesson.id, isCorrect);
  if (isCorrect) {
    feedback.textContent = "正解！次の問題に進みます。";
    feedback.className = "feedback success";
    setScore += 1;
    triggerConfetti("normal");
    nextBtn.hidden = true;
    setTimeout(advanceLesson, 1200);
  } else {
    feedback.textContent = "間違いです。正解例を確認して次の問題へ進んでね。";
    feedback.className = "feedback error";
    renderAnswerSlots(lesson);
    answerExample.hidden = false;
    nextBtn.hidden = false;
  }
  updateHomeStatus();
};

const triggerConfetti = (mode) => {
  confetti.innerHTML = "";
  confetti.className = mode === "grand" ? "confetti confetti--grand" : "confetti";
  const count = mode === "grand" ? 120 : 60;
  for (let i = 0; i < count; i += 1) {
    const piece = document.createElement("span");
    piece.className = "confetti-piece";
    piece.style.setProperty("--x", `${Math.random() * 100}%`);
    piece.style.setProperty("--delay", `${Math.random() * 0.4}s`);
    piece.style.setProperty("--duration", `${1 + Math.random() * 0.8}s`);
    piece.style.setProperty("--size", `${6 + Math.random() * 6}px`);
    piece.style.setProperty("--rotate", `${Math.random() * 360}deg`);
    piece.style.setProperty("--hue", `${Math.random() * 360}`);
    confetti.appendChild(piece);
  }
  setTimeout(() => {
    confetti.innerHTML = "";
  }, mode === "grand" ? 2400 : 1600);
};

resetBtn.addEventListener("click", resetAnswer);
checkBtn.addEventListener("click", checkAnswer);
nextBtn.addEventListener("click", advanceLesson);
startSetBtn.addEventListener("click", startSet);
setNextBtn.addEventListener("click", startSet);
homeBtn.addEventListener("click", returnHome);
resetStatsBtn.addEventListener("click", resetStats);
loadSheetBtn.addEventListener("click", () => {
  const rawUrl = sheetUrlInput.value.trim();
  if (!rawUrl) {
    homeStatus.textContent = "スプレッドシートのURLを入力してください。";
    return;
  }
  if (!buildSheetCsvUrl(rawUrl)) {
    homeStatus.textContent = "有効なスプレッドシートURLを入力してください。";
    return;
  }
  homeStatus.textContent = "シートを読み込み中です...";
  loadSheetLessons(rawUrl);
});

renderGradeFilters();
renderGrammarFilters();
renderLevelFilters();
updateHomeStatus();
updateLevelProgress();
sheetUrlInput.value = DEFAULT_SHEET_URL;

loadSheetLessons(DEFAULT_SHEET_URL);
