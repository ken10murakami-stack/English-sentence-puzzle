let lessons = [];

const SET_SIZE = 10;
const STATS_KEY = "englishPuzzleStats";
let currentSet = [];
let setIndex = 0;
let setScore = 0;
const gradeOptions = ["中1", "中2", "中3"];
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
@@ -584,130 +586,136 @@ const loadLesson = () => {
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

const loadSheetLessons = async () => {
  const csvUrl = buildSheetCsvUrl(DEFAULT_SHEET_URL);
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
@@ -745,33 +753,47 @@ const triggerConfetti = (mode) => {
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

loadSheetLessons();
loadSheetLessons(DEFAULT_SHEET_URL);
