// ============================================================
// ЛОГІКА ЗАСТОСУНКУ v2
// ============================================================

const STATE = {
  currentDayIndex: 0,
  currentTopicId: null,
  currentQuestionIndex: 0,
  progress: {}, // { topicId: true } коли тема завершена
};

const els = {
  routeMap: document.getElementById("routeMap"),
  dayCard: document.getElementById("dayCard"),
  dayTag: document.getElementById("dayTag"),
  dayTitle: document.getElementById("dayTitle"),
  dayProgress: document.getElementById("dayProgress"),
  topicList: document.getElementById("topicList"),
  lessonView: document.getElementById("lessonView"),
  lessonTag: document.getElementById("lessonTag"),
  lessonTitle: document.getElementById("lessonTitle"),
  reviewBanner: document.getElementById("reviewBanner"),
  referenceBtnWrap: document.getElementById("referenceBtnWrap"),
  openReferenceBtn: document.getElementById("openReferenceBtn"),
  theoryBody: document.getElementById("theoryBody"),
  quizProgressBar: document.getElementById("quizProgressBar"),
  questionCard: document.getElementById("questionCard"),
  reviewContainer: document.getElementById("reviewContainer"),
  backToDay: document.getElementById("backToDay"),
  referenceModal: document.getElementById("referenceModal"),
  referenceModalTitle: document.getElementById("referenceModalTitle"),
  referenceModalBody: document.getElementById("referenceModalBody"),
  closeReferenceBtn: document.getElementById("closeReferenceBtn"),
};

// ---------- ХЕЛПЕРИ ----------
function getDay(idx){ return LESSON_DATA.days[idx]; }
function findTopic(topicId){
  for(const day of LESSON_DATA.days){
    const t = day.topics.find(t => t.id === topicId);
    if(t) return { day, topic: t };
  }
  return null;
}
function isTopicDone(topicId){ return !!STATE.progress[topicId]; }

function isDayUnlocked(dayIdx){
  if(dayIdx === 0) return true;
  const prevDay = getDay(dayIdx - 1);
  return prevDay.topics.every(t => isTopicDone(t.id));
}

function isDayComplete(dayIdx){
  const day = getDay(dayIdx);
  return day.topics.every(t => isTopicDone(t.id));
}

function isTopicUnlocked(dayIdx, topicIdx){
  if(!isDayUnlocked(dayIdx)) return false;
  if(topicIdx === 0) return true;
  const day = getDay(dayIdx);
  return isTopicDone(day.topics[topicIdx - 1].id);
}

function saveProgress(){
  try{ localStorage.setItem("mathExpeditionProgress", JSON.stringify(STATE.progress)); }
  catch(e){ /* ignore */ }
}
function loadProgress(){
  try{
    const raw = localStorage.getItem("mathExpeditionProgress");
    if(raw) STATE.progress = JSON.parse(raw);
  }catch(e){ /* ignore */ }
}

// ---------- РЕНДЕР: КАРТА МАРШРУТУ ----------
function renderRouteMap(){
  els.routeMap.innerHTML = '<div class="route-line"></div>';
  LESSON_DATA.days.forEach((day, idx) => {
    const unlocked = isDayUnlocked(idx);
    const complete = isDayComplete(idx);
    const isCurrentTarget = unlocked && !complete;

    const btn = document.createElement("button");
    btn.className = "route-stop" +
      (complete ? " is-done" : "") +
      (isCurrentTarget ? " is-current" : "") +
      (!unlocked ? " is-locked" : "");
    btn.innerHTML = `
      <div class="route-node">${complete ? "✓" : (idx+1)}</div>
      <div class="route-label">${day.title}</div>
    `;
    btn.addEventListener("click", () => {
      if(!unlocked){ flashLockedHint(btn); return; }
      openDay(idx);
    });
    els.routeMap.appendChild(btn);
  });
}

function flashLockedHint(btn){
  btn.style.transition = "transform 0.15s";
  btn.style.transform = "translateX(-3px)";
  setTimeout(()=>{ btn.style.transform = "translateX(3px)"; }, 80);
  setTimeout(()=>{ btn.style.transform = "translateX(0)"; }, 160);
}

// ---------- РЕНДЕР: ОГЛЯД ДНЯ (список тем) ----------
function openDay(dayIdx){
  STATE.currentDayIndex = dayIdx;
  const day = getDay(dayIdx);

  els.dayCard.style.display = "block";
  els.lessonView.style.display = "none";

  els.dayTag.textContent = day.tag;
  els.dayTitle.textContent = day.title;

  const doneCount = day.topics.filter(t => isTopicDone(t.id)).length;
  els.dayProgress.textContent = `${doneCount} / ${day.topics.length} тем`;

  els.topicList.innerHTML = "";
  day.topics.forEach((topic, tIdx) => {
    const unlocked = isTopicUnlocked(dayIdx, tIdx);
    const complete = isTopicDone(topic.id);

    const row = document.createElement("div");
    row.className = "topic-row" + (complete ? " complete" : "") + (!unlocked ? " locked" : "");
    const statusLabel = complete ? "Переглянути" : (unlocked ? "Почати" : "Заблоковано");
    row.innerHTML = `
      <div class="topic-num">${complete ? "✓" : (tIdx+1)}</div>
      <div class="topic-info">
        <h3>${topic.title}</h3>
        <p>${topic.subtitle}</p>
      </div>
      <button class="topic-status-btn" type="button">${statusLabel}</button>
    `;
    if(unlocked){
      row.addEventListener("click", () => openTopic(topic.id));
    }
    els.topicList.appendChild(row);
  });

  window.scrollTo({top: document.querySelector('.route-wrap').offsetTop - 20, behavior:'smooth'});
  renderRouteMap();
}

// ---------- РЕФЕРЕНС МОДАЛКА (Довідник) ----------
function openReferenceModal(topic){
  els.referenceModalTitle.textContent = topic.title;
  els.referenceModalBody.innerHTML = topic.reference || "<p>Довідник для цієї теми відсутній.</p>";
  els.referenceModal.classList.add("show");
}
function closeReferenceModal(){
  els.referenceModal.classList.remove("show");
}
els.closeReferenceBtn.addEventListener("click", closeReferenceModal);
els.referenceModal.addEventListener("click", (e) => {
  if(e.target === els.referenceModal) closeReferenceModal();
});

// ---------- РЕНДЕР: ТЕМА (теорія + питання, або режим перегляду) ----------
function openTopic(topicId){
  STATE.currentTopicId = topicId;
  STATE.currentQuestionIndex = 0;

  const found = findTopic(topicId);
  if(!found) return;
  const { day, topic } = found;

  els.dayCard.style.display = "none";
  els.lessonView.style.display = "block";

  els.lessonTag.textContent = day.title;
  els.lessonTitle.textContent = topic.title;
  els.theoryBody.innerHTML = topic.theory;

  els.openReferenceBtn.onclick = () => openReferenceModal(topic);

  const alreadyDone = isTopicDone(topicId);

  if(alreadyDone){
    els.reviewBanner.style.display = "flex";
    els.quizProgressBar.style.display = "none";
    els.questionCard.style.display = "none";
    renderReviewMode(topic);
  } else {
    els.reviewBanner.style.display = "none";
    els.quizProgressBar.style.display = "flex";
    els.questionCard.style.display = "block";
    els.reviewContainer.innerHTML = "";
    renderQuestion(topic, 0);
  }

  window.scrollTo({top:0, behavior:'smooth'});
}

// ---------- РЕЖИМ ПЕРЕГЛЯДУ ЗАВЕРШЕНОЇ ТЕМИ ----------
function renderReviewMode(topic){
  const letters = ["А","Б","В","Г"];
  let html = "";
  topic.questions.forEach((q, qi) => {
    html += `<div class="review-question-block">
      <div class="review-q-num">Питання ${qi+1} з ${topic.questions.length}</div>
      <div class="review-q-text">${q.prompt}</div>
      <div class="review-options">`;
    q.options.forEach((opt, oi) => {
      const isCorrect = oi === q.correct;
      html += `<div class="review-option${isCorrect ? ' is-correct' : ''}">
        <div class="opt-letter">${letters[oi]}</div>
        <div>${opt}${isCorrect ? ' ✓' : ''}</div>
      </div>`;
    });
    html += `</div>
      <div class="review-solution"><strong>Розв'язок</strong>${q.solution}</div>
    </div>`;
  });
  els.reviewContainer.innerHTML = html;

  const footer = document.createElement("div");
  footer.className = "review-footer";
  const backBtn = document.createElement("button");
  backBtn.className = "btn btn-primary";
  backBtn.textContent = "До списку тем дня";
  backBtn.addEventListener("click", () => {
    const found = findTopic(topic.id);
    const dayIdx = LESSON_DATA.days.findIndex(d => d.id === found.day.id);
    openDay(dayIdx);
  });
  footer.appendChild(backBtn);
  els.reviewContainer.appendChild(footer);
}

// ---------- РЕНДЕР ПИТАННЯ (активний режим проходження) ----------
function renderQuizProgressBar(topic, currentIdx){
  els.quizProgressBar.innerHTML = "";
  topic.questions.forEach((q, i) => {
    const seg = document.createElement("div");
    seg.className = "seg" + (i < currentIdx ? " done" : (i === currentIdx ? " current" : ""));
    els.quizProgressBar.appendChild(seg);
  });
}

function renderQuestion(topic, qIdx){
  renderQuizProgressBar(topic, qIdx);

  if(qIdx >= topic.questions.length){
    renderTopicComplete(topic);
    return;
  }

  const q = topic.questions[qIdx];
  const card = els.questionCard;
  card.innerHTML = `
    <div class="q-meta">Питання ${qIdx+1} з ${topic.questions.length}</div>
    <div class="q-text">${q.prompt}</div>
    <div class="options" id="optionsWrap"></div>
    <div class="feedback" id="feedbackBox"></div>
    <div class="solution-box" id="solutionBox"></div>
    <div class="q-footer" id="qFooter"></div>
  `;

  const optionsWrap = card.querySelector("#optionsWrap");
  const letters = ["А","Б","В","Г"];
  let solved = false;
  const wrongChosen = new Set();

  q.options.forEach((optText, optIdx) => {
    const optBtn = document.createElement("button");
    optBtn.className = "option";
    optBtn.innerHTML = `<div class="opt-letter">${letters[optIdx]}</div><div>${optText}</div>`;
    optBtn.addEventListener("click", () => {
      if(solved) return;
      handleAnswer(q, optIdx, optBtn, optionsWrap, () => {
        solved = true;
        showSolutionAndNext(topic, qIdx, q);
      }, wrongChosen);
    });
    optionsWrap.appendChild(optBtn);
  });
}

function handleAnswer(q, optIdx, optBtn, optionsWrap, onSolved, wrongChosen){
  const feedbackBox = document.getElementById("feedbackBox");
  const allOptions = optionsWrap.querySelectorAll(".option");

  if(optIdx === q.correct){
    allOptions.forEach(o => o.classList.add("disabled"));
    optBtn.classList.add("correct");
    feedbackBox.className = "feedback right-fb show";
    feedbackBox.innerHTML = `<strong>Правильно! ✓</strong>Чудово, рухаємось далі.`;
    onSolved();
  } else {
    optBtn.classList.add("wrong");
    optBtn.classList.add("disabled");
    wrongChosen.add(optIdx);
    const explainText = (q.explain && q.explain[optIdx]) ? q.explain[optIdx] : "Це неправильна відповідь. Подумай ще раз і спробуй іншу.";
    feedbackBox.className = "feedback wrong-fb show";
    feedbackBox.innerHTML = `<strong>Не зовсім так</strong>${explainText} Спробуй обрати іншу відповідь.`;
  }
}

function showSolutionAndNext(topic, qIdx, q){
  const solutionBox = document.getElementById("solutionBox");
  solutionBox.className = "solution-box show";
  solutionBox.innerHTML = `<strong>Розв'язок</strong>${q.solution}`;

  const footer = document.getElementById("qFooter");
  const isLast = qIdx === topic.questions.length - 1;
  const btn = document.createElement("button");
  btn.className = "btn btn-teal";
  btn.textContent = isLast ? "Завершити тему →" : "Наступне питання →";
  btn.addEventListener("click", () => {
    renderQuestion(topic, qIdx + 1);
  });
  footer.appendChild(btn);
}

function renderTopicComplete(topic){
  STATE.progress[topic.id] = true;
  saveProgress();

  const found = findTopic(topic.id);
  const day = found.day;
  const dayIdx = LESSON_DATA.days.findIndex(d => d.id === day.id);
  const dayNowComplete = isDayComplete(dayIdx);

  els.quizProgressBar.innerHTML = "";
  els.questionCard.innerHTML = `
    <div class="topic-complete-screen">
      <div class="badge">✓</div>
      <h3>Тему завершено!</h3>
      <p>Ти відповіла правильно на всі питання теми «${topic.title}». ${dayNowComplete ? "І це остання тема цього дня — чудова робота!" : "Можна переходити до наступної теми."}</p>
      <button class="btn btn-primary" id="toDayListBtn">До списку тем дня</button>
    </div>
  `;
  document.getElementById("toDayListBtn").addEventListener("click", () => {
    openDay(dayIdx);
  });

  renderRouteMap();
}

// ---------- НАВІГАЦІЯ ----------
els.backToDay.addEventListener("click", () => {
  openDay(STATE.currentDayIndex);
});

// ---------- ІНІЦІАЛІЗАЦІЯ ----------
function init(){
  loadProgress();
  renderRouteMap();

  let targetDay = 0;
  for(let i = 0; i < LESSON_DATA.days.length; i++){
    if(isDayUnlocked(i) && !isDayComplete(i)){ targetDay = i; break; }
    if(i === LESSON_DATA.days.length - 1) targetDay = i;
  }
  openDay(targetDay);
}

init();
