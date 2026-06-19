// ============================================================
// ЛОГІКА ЗАСТОСУНКУ
// ============================================================

const STATE = {
  currentDayIndex: 0,
  currentTopicId: null,
  currentQuestionIndex: 0,
  progress: {}, // { topicId: true } коли тема завершена
  view: "map" // map | day | lesson | report
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
  theoryBody: document.getElementById("theoryBody"),
  quizProgressBar: document.getElementById("quizProgressBar"),
  questionCard: document.getElementById("questionCard"),
  backToDay: document.getElementById("backToDay"),
  reportSection: document.getElementById("reportSection"),
  reportContent: document.getElementById("reportContent"),
  navMap: document.getElementById("navMap"),
  navReport: document.getElementById("navReport"),
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
  // день розблокований, якщо всі теми попереднього дня завершені
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
  try{
    localStorage.setItem("mathExpeditionProgress", JSON.stringify(STATE.progress));
  }catch(e){ /* ignore - in-memory fallback */ }
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
      if(!unlocked){
        flashLockedHint(btn);
        return;
      }
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
  STATE.view = "day";
  const day = getDay(dayIdx);

  els.dayCard.style.display = "block";
  els.lessonView.style.display = "none";
  els.reportSection.style.display = "none";
  setActiveNav(null);

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
    row.innerHTML = `
      <div class="topic-num">${complete ? "✓" : (tIdx+1)}</div>
      <div class="topic-info">
        <h3>${topic.title}</h3>
        <p>${topic.subtitle}</p>
      </div>
      <div class="topic-status">${complete ? "Завершено" : (unlocked ? "Почати" : "Заблоковано")}</div>
    `;
    row.addEventListener("click", () => {
      if(!unlocked) return;
      openTopic(topic.id);
    });
    els.topicList.appendChild(row);
  });

  // Якщо весь день завершено — показати екран завершення дня замість списку (з опцією переглянути)
  window.scrollTo({top: document.querySelector('.route-wrap').offsetTop - 20, behavior:'smooth'});
  renderRouteMap();
}

// ---------- РЕНДЕР: ТЕМА (теорія + питання) ----------
function openTopic(topicId){
  STATE.currentTopicId = topicId;
  STATE.currentQuestionIndex = 0;
  STATE.view = "lesson";

  const found = findTopic(topicId);
  if(!found) return;
  const { day, topic } = found;

  els.dayCard.style.display = "none";
  els.lessonView.style.display = "block";
  els.reportSection.style.display = "none";

  els.lessonTag.textContent = day.title;
  els.lessonTitle.textContent = topic.title;
  els.theoryBody.innerHTML = topic.theory;

  renderQuestion(topic, 0);
  window.scrollTo({top:0, behavior:'smooth'});
}

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
    <div class="q-meta">Питання ${qIdx+1} з ${topic.questions.length}${q.isExamStyle ? '<span class="style-badge">у стилі майбутнього тесту</span>' : ''}</div>
    <div class="q-text">${q.prompt}</div>
    <div class="options" id="optionsWrap"></div>
    <div class="feedback" id="feedbackBox"></div>
    <div class="q-footer" id="qFooter"></div>
  `;

  const optionsWrap = card.querySelector("#optionsWrap");
  const letters = ["А","Б","В","Г"];
  let answered = false;
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
        showNextButton(topic, qIdx);
      }, wrongChosen);
    });
    optionsWrap.appendChild(optBtn);
  });
}

function handleAnswer(q, optIdx, optBtn, optionsWrap, onSolved, wrongChosen){
  const feedbackBox = document.getElementById("feedbackBox");
  const allOptions = optionsWrap.querySelectorAll(".option");

  if(optIdx === q.correct){
    // правильно
    allOptions.forEach(o => o.classList.add("disabled"));
    optBtn.classList.add("correct");
    feedbackBox.className = "feedback right-fb show";
    feedbackBox.innerHTML = `<strong>Правильно! ✓</strong>Чудово, рухаємось далі.`;
    onSolved();
  } else {
    // неправильно
    optBtn.classList.add("wrong");
    optBtn.classList.add("disabled");
    wrongChosen.add(optIdx);
    const explainText = (q.explain && q.explain[optIdx]) ? q.explain[optIdx] : "Це неправильна відповідь. Подумай ще раз і спробуй іншу.";
    feedbackBox.className = "feedback wrong-fb show";
    feedbackBox.innerHTML = `<strong>Не зовсім так</strong>${explainText} Спробуй обрати іншу відповідь.`;
  }
}

function showNextButton(topic, qIdx){
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
      <p>Ти відповіла правильно на всі питання теми «${topic.title}». ${dayNowComplete ? "І це останя тема цього дня — чудова робота!" : "Можна переходити до наступної теми."}</p>
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

function setActiveNav(which){
  els.navMap.classList.toggle("active", which === "map");
  els.navReport.classList.toggle("active", which === "report");
}

els.navMap.addEventListener("click", () => {
  els.dayCard.style.display = "none";
  els.lessonView.style.display = "none";
  els.reportSection.style.display = "none";
  setActiveNav("map");
});

els.navReport.addEventListener("click", () => {
  els.dayCard.style.display = "none";
  els.lessonView.style.display = "none";
  els.reportSection.style.display = "block";
  setActiveNav("report");
  renderReport();
});

function renderReport(){
  if(els.reportContent.dataset.rendered === "1") return;
  els.reportContent.dataset.rendered = "1";

  let html = "";
  REPORT_DATA.forEach(section => {
    html += `<h4 style="font-family:'Fraunces',serif; font-size:18px; margin: 26px 0 4px; color: var(--ink);">${section.day}</h4>`;
    html += `<table class="report-table"><thead><tr>
      <th style="width:28%;">Тема уроку</th>
      <th style="width:18%;">Питання тесту</th>
      <th>Чому включено</th>
    </tr></thead><tbody>`;
    section.rows.forEach(row => {
      html += `<tr>
        <td><strong>${row.topic}</strong></td>
        <td><span class="qnum">${row.testQuestions}</span></td>
        <td>${row.reason}</td>
      </tr>`;
    });
    html += `</tbody></table>`;
  });

  html += `<h4 style="font-family:'Fraunces',serif; font-size:18px; margin: 30px 0 10px; color: var(--ink);">Теми, які НЕ включені в урок</h4>
    <p style="font-size:13px; color:rgba(27,42,74,0.6); margin-bottom:10px;">Ці прогалини були помічені в попередніх тестах, але жодне питання наступного тесту їх не стосується — тому їх свідомо виключено, щоб не перевантажувати урок.</p>
    <ul style="font-size:14px; line-height:1.7; color: rgba(27,42,74,0.75); padding-left:20px;">`;
  EXCLUDED_TOPICS.forEach(t => { html += `<li>${t}</li>`; });
  html += `</ul>`;

  els.reportContent.innerHTML = html;
}

// ---------- ІНІЦІАЛІЗАЦІЯ ----------
function init(){
  loadProgress();
  renderRouteMap();

  // Відкриваємо перший незавершений/розблокований день
  let targetDay = 0;
  for(let i = 0; i < LESSON_DATA.days.length; i++){
    if(isDayUnlocked(i) && !isDayComplete(i)){ targetDay = i; break; }
    if(i === LESSON_DATA.days.length - 1) targetDay = i;
  }
  openDay(targetDay);
}

init();
