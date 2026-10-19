/* نظام أحمد — وظائف لوحة التحكم */
"use strict";

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const STORAGE_KEY = "ahmed-study-v2";
const DAY_NAMES = ["الأحد","الاثنين","الثلاثاء","الأربعاء","الخميس","الجمعة","السبت"];
const SUBJECTS = ["فرنساوي","فلسفة","رياضيات","إنجليزي","تاريخ","علوم متكاملة","برمجة"];
const WEEK = [
  {day:6,name:"السبت",subjects:["فرنساوي"],gym:true,color:"#b16cff",icon:"Ａ"},
  {day:0,name:"الأحد",subjects:[],gym:true,color:"#49e7b9",icon:"☼"},
  {day:1,name:"الاثنين",subjects:["فلسفة","رياضيات"],gym:true,color:"#68a7ff",icon:"∑"},
  {day:2,name:"الثلاثاء",subjects:["إنجليزي"],gym:false,color:"#ff76d0",icon:"Ab"},
  {day:3,name:"الأربعاء",subjects:["تاريخ"],gym:true,color:"#35e9ff",icon:"⌛"},
  {day:4,name:"الخميس",subjects:["علوم متكاملة"],gym:true,color:"#49e7b9",icon:"⚗"},
  {day:5,name:"الجمعة",subjects:["برمجة"],gym:false,color:"#a18aff",icon:"</>"}
];
const DEFAULTS = {
  tasks:[], lessons:[], xp:0, studyMinutes:0, sessions:0, dailyGoal:120,
  settings:{wakeTime:"05:00",schoolEnd:"14:00",gymTime:"17:00"},
  weeklyMinutes:{}, userName:"أحمد"
};
let state = loadState();
let ambientContext = null, ambientNodes = [], ambientGain = null, ambientOn = false, quranObjectUrl = null, quranPlaylist = [], quranTrackIndex = -1;
let filter = "all", timerMode = "focus", timerDuration = 25*60, secondsLeft = 25*60, timerInterval = null, running = false, toastTimer = null;

function loadState(){
  try{
    const raw=JSON.parse(localStorage.getItem(STORAGE_KEY));
    if(raw && typeof raw==="object") return {...DEFAULTS,...raw,settings:{...DEFAULTS.settings,...raw.settings},tasks:Array.isArray(raw.tasks)?raw.tasks:[],lessons:Array.isArray(raw.lessons)?raw.lessons:[],weeklyMinutes:raw.weeklyMinutes||{}};
  }catch(e){console.warn("تعذر قراءة البيانات",e)}
  return structuredClone(DEFAULTS);
}
function saveState(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(state))}catch(e){toast("تعذر حفظ البيانات في المتصفح")}}
function toast(message){const el=$("#toast");if(!el)return;el.textContent=message;el.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove("show"),2600)}
function escapeHTML(value){return String(value).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function dateKey(date=new Date()){const y=date.getFullYear(),m=String(date.getMonth()+1).padStart(2,"0"),d=String(date.getDate()).padStart(2,"0");return `${y}-${m}-${d}`}
function addDays(dateString,days){const d=new Date(`${dateString}T12:00:00`);d.setDate(d.getDate()+days);return dateKey(d)}
function formatArabicDate(date=new Date()){return new Intl.DateTimeFormat("ar-EG",{weekday:"long",day:"numeric",month:"long"}).format(date)}
function getLevel(){return Math.floor(state.xp/100)+1}
function levelProgress(){return state.xp%100}
function getDueReviews(){const today=dateKey();return state.lessons.flatMap(lesson=>lesson.reviewDates.map((date,index)=>({lesson,date,index,days:[1,3,7,14,30][index]})).filter(item=>item.date<=today&&!lesson.reviewed.includes(item.index)))}
function setWidth(selector,value){const el=$(selector);if(el)el.style.width=`${Math.max(0,Math.min(100,value))}%`}
function setText(selector,value){const el=$(selector);if(el)el.textContent=String(value)}
function addXP(amount,reason){const before=getLevel();state.xp=Math.max(0,state.xp+amount);saveState();renderStats();if(getLevel()>before)toast(`🎉 وصلت للمستوى ${getLevel()}! ${reason||""}`);else toast(`${amount>0?"+":""}${amount} XP — ${reason||"استمر في التقدم"}`)}
function renderHeader(){
  const now=new Date();setText("#todayDate",formatArabicDate(now));setText("#heroDay",DAY_NAMES[now.getDay()]);setText("#heroDate",formatArabicDate(now));setText("#planDate",formatArabicDate(now));
  setText("#profileName",state.userName);setText("#profileLevel",`المستوى ${getLevel()}`);
}
function renderStats(){
  const done=state.tasks.filter(t=>t.done).length,total=state.tasks.length,level=getLevel(),progress=levelProgress(),due=getDueReviews().length;
  setText("#xpPoints",`${state.xp} `);setText("#levelValue",level);setText("#levelCaption",level>=10?"أسطورة":level>=5?"متقدم":"مبتدئ");
  setText("#studyMinutes",state.studyMinutes);setText("#completedTasks",done);setText("#taskStatCaption",`من ${total} مهمة`);setText("#sideLevel",`المستوى ${level}`);setText("#sideRank",level>=10?"أسطورة":level>=5?"محترف":"مبتدئ");setText("#sideXp",`${progress} XP`);setText("#sideNextXp",`${level*100} XP`);setText("#reviewNavCount",due);setText("#dueCount",`${due} مستحقة`);
  setWidth("#sideXpBar",progress);setWidth("#xpBar",progress);setWidth("#levelBar",progress);setWidth("#timeBar",Math.min(100,state.studyMinutes/Math.max(state.dailyGoal,1)*100));setWidth("#tasksBar",total?done/total*100:0);
  setText("#profileLevel",`المستوى ${level}`);setText("#taskCounter",`${done} / ${total}`);
}
function renderWeek(){
  const target=$("#weekSchedule");if(!target)return;
  const today=new Date().getDay();
  target.innerHTML=WEEK.map(day=>`<div class="week-row ${day.day===today?"today":""}" style="--subject-color:${day.color};--subject-border:${day.color}70;--subject-bg:${day.color}0d">
    <div><div class="week-day">${day.name}</div><div class="week-extra">${day.gym?"الجيم":"بدون جيم"}</div></div>
    <div><div class="week-subject">${day.subjects.length?day.subjects.join(" + "):"إجازة من الدروس"}</div><div class="week-extra">${day.subjects.length?"ساعتان للدرس + ساعة تحضير":"راحة واستعادة النشاط"}</div></div>
  </div>`).join("");
}
function timeToMinutes(value){const [h,m]=String(value||"00:00").split(":").map(Number);return h*60+m}
function formatClock(total){total=((total%1440)+1440)%1440;return `${String(Math.floor(total/60)).padStart(2,"0")}:${String(total%60).padStart(2,"0")}`}
function renderPlan(){
  const target=$("#dailyTimeline");if(!target)return;
  const now=new Date(),day=WEEK.find(d=>d.day===now.getDay()),settings=state.settings;
  const slots=[];
  let t=timeToMinutes(settings.wakeTime);
  slots.push({time:formatClock(t),title:"الاستيقاظ والصلاة",detail:"ابدأ بهدوء، وافتح يومك بالصلاة حسب وقتها المحلي.",duration:""});
  t+=60;
  if(day?.subjects.length){
    slots.push({time:formatClock(t),title:`التحضير لـ ${day.subjects.join(" و ")}`,detail:"ساعة تجهيز: مراجعة سريعة، تحضير الأسئلة وتجهيز الأدوات.",duration:"1س"});
    t+=60;
    slots.push({time:formatClock(t),title:`درس ${day.subjects.join(" و ")}`,detail:"ساعتان للدرس. لو عندك درسان، وزّع الوقت على مواعيدهما الفعلية.",duration:"2س"});
    t+=120;
  } else {
    slots.push({time:formatClock(t),title:"وقت مرن للمذاكرة أو الراحة",detail:"الأحد إجازة من الدروس الجديدة؛ خذ راحة حقيقية.",duration:""});
    t+=60;
  }
  const schoolEnd=timeToMinutes(settings.schoolEnd);
  slots.push({time:formatClock(Math.max(t,schoolEnd)),title:"راحة وغداء / بعد المدرسة",detail:"اترك وقتًا للأكل والانتقال والراحة قبل أي جلسة.",duration:""});
  const due=getDueReviews();
  if(due.length)slots.push({time:"بعد الراحة",title:`مراجعة ${due.length} درس مستحق`,detail:"ابدأ بالاسترجاع من الذاكرة، ثم صحّح إجاباتك.",duration:"25د"});
  slots.push({time:"وقت مناسب",title:"جلسة مذاكرة مركزة",detail:`حل أسئلة أو ذاكر مادة أساسية لمدة ${Math.min(25,state.dailyGoal)} دقيقة كبداية.`,duration:"25د"});
  if(day?.gym)slots.push({time:settings.gymTime,title:"الجيم",detail:"اترك وقتًا للتنقل والأكل والاستحمام، ولا تضغط على نومك.",duration:""});
  slots.push({time:"قبل النوم",title:"تجهيز بكرة والنوم",detail:"جهّز شنطتك ومهامك، واحرص على نوم كافٍ خصوصًا مع الاستيقاظ المبكر.",duration:""});
  target.innerHTML=slots.map(s=>`<div class="timeline-row"><div class="timeline-time">${escapeHTML(s.time)}</div><div><div class="timeline-title">${escapeHTML(s.title)}</div><div class="timeline-detail">${escapeHTML(s.detail)}</div></div>${s.duration?`<span class="timeline-duration">${escapeHTML(s.duration)}</span>`:""}</div>`).join("");
}
function renderTasks(){
  const list=$("#taskList");if(!list)return;
  let tasks=state.tasks.filter(t=>filter==="all"||(filter==="open"&&!t.done)||(filter==="done"&&t.done));
  const query=$("#searchInput")?.value.trim().toLowerCase();
  if(query)tasks=tasks.filter(t=>(t.title+" "+t.subject).toLowerCase().includes(query));
  if(!tasks.length){list.innerHTML=`<div class="empty-state">${query?"مفيش نتائج للبحث ده.":"مفيش مهام هنا دلوقتي. أضف أول مهمة وابدأ الإنجاز!"}</div>`}
  else list.innerHTML=tasks.map(task=>`<div class="task-row ${task.done?"done":""}">
    <input type="checkbox" aria-label="إنجاز المهمة" data-task-check="${escapeHTML(task.id)}" ${task.done?"checked":""}>
    <div class="task-main"><strong>${escapeHTML(task.title)}</strong><small>${escapeHTML(task.subject)} · ${task.minutes} دقيقة</small></div>
    <span class="task-subject-badge">${escapeHTML(task.subject)}</span>
    <button class="task-delete" title="حذف المهمة" aria-label="حذف المهمة" data-task-delete="${escapeHTML(task.id)}">×</button>
  </div>`).join("");
  $$("[data-task-check]",list).forEach(input=>input.addEventListener("change",()=>toggleTask(input.dataset.taskCheck,input.checked)));
  $$("[data-task-delete]",list).forEach(button=>button.addEventListener("click",()=>deleteTask(button.dataset.taskDelete)));
  const done=state.tasks.filter(t=>t.done).length,total=state.tasks.length;
  setText("#tasksFooterText",total?`أنجزت ${done} من ${total} مهمة`:"ابدأ بمهمة واحدة صغيرة");
  setWidth("#taskProgress",total?done/total*100:0);renderStats();
}
function addTask(event){
  event.preventDefault();const input=$("#taskInput"),title=input.value.trim();if(!title)return;
  const subject=$("#taskSubject").value,minutes=Number($("#taskDuration").value)||25;
  state.tasks.unshift({id:crypto.randomUUID?crypto.randomUUID():String(Date.now()+Math.random()),title,subject,minutes,done:false,createdAt:dateKey()});
  saveState();input.value="";renderTasks();toast("تمت إضافة المهمة — يلا ننجزها!");
}
function toggleTask(id,done){
  const task=state.tasks.find(t=>t.id===id);if(!task||task.done===done)return;
  task.done=done;if(done){state.xp+=10;toast("+10 XP — مهمة مكتملة!")}else{state.xp=Math.max(0,state.xp-10);toast("تم إلغاء الإنجاز وخصم 10 XP")}
  saveState();renderTasks();renderStats();
}
function deleteTask(id){const task=state.tasks.find(t=>t.id===id);if(!task)return;if(task.done)state.xp=Math.max(0,state.xp-10);state.tasks=state.tasks.filter(t=>t.id!==id);saveState();renderTasks();renderStats();toast("تم حذف المهمة")}
function clearDone(){const count=state.tasks.filter(t=>t.done).length;if(!count){toast("مفيش مهام مكتملة");return}state.tasks=state.tasks.filter(t=>!t.done);saveState();renderTasks();toast("تم حذف المهام المكتملة")}
function renderReviews(){
  const target=$("#reviewList");if(!target)return;const due=getDueReviews().slice(0,6);
  if(!due.length){target.innerHTML=`<div class="empty-state">مفيش مراجعات مستحقة الآن.<br>سجّل درسًا جديدًا وسيحدد الموقع مواعيده.</div>`;return}
  const colors=["#b16cff","#35e9ff","#ffbc63","#ff76d0","#49e7b9"];
  target.innerHTML=due.map(item=>`<div class="review-row"><div class="review-symbol" style="--rev-color:${colors[item.index]}">⟳</div><div><b>${escapeHTML(item.lesson.title)}</b><small>${escapeHTML(item.lesson.subject)} · مراجعة ${item.days===1?"بعد يوم":`بعد ${item.days} يوم`}</small><div class="review-actions"><button data-review-done="${escapeHTML(item.lesson.id)}" data-review-index="${item.index}">تمت المراجعة +5 XP</button></div></div></div>`).join("");
  $$("[data-review-done]",target).forEach(button=>button.addEventListener("click",()=>completeReview(button.dataset.reviewDone,Number(button.dataset.reviewIndex))));
}
function completeReview(id,index){const lesson=state.lessons.find(l=>l.id===id);if(!lesson||lesson.reviewed.includes(index))return;lesson.reviewed.push(index);state.xp+=5;saveState();renderAll();toast("+5 XP — مراجعة ممتازة!")}
function addLesson(event){
  event.preventDefault();const title=$("#lessonTitle").value.trim(),subject=$("#lessonSubject").value,date=$("#lessonDate").value||dateKey();if(!title)return;
  state.lessons.unshift({id:crypto.randomUUID?crypto.randomUUID():String(Date.now()+Math.random()),title,subject,date,reviewDates:[1,3,7,14,30].map(n=>addDays(date,n)),reviewed:[]});
  saveState();$("#lessonTitle").value="";renderAll();toast("اتسجل الدرس ومواعيد مراجعته تلقائيًا");
}
function renderLessonRecords(){
  const target=$("#lessonRecords");if(!target)return;
  if(!state.lessons.length){target.innerHTML=`<div class="empty-state">لسه مفيش دروس مسجلة.</div>`;return}
  target.innerHTML=state.lessons.slice(0,8).map(l=>`<div class="lesson-record"><b>${escapeHTML(l.title)} · ${escapeHTML(l.subject)}</b><small>الدرس: ${escapeHTML(l.date)}<br>المراجعات: ${l.reviewDates.map((d,i)=>`${[1,3,7,14,30][i]} يوم (${d})`).join("، ")}<br>المنجز: ${l.reviewed.length}/5</small></div>`).join("");
}
function renderChart(){
  const chart=$("#weeklyChart");if(!chart)return;const today=new Date();const labels=[];
  for(let i=6;i>=0;i--){const d=new Date(today);d.setDate(today.getDate()-i);labels.push({date:dateKey(d),name:new Intl.DateTimeFormat("ar-EG",{weekday:"short"}).format(d)})}
  chart.innerHTML=labels.map(item=>{const value=Number(state.weeklyMinutes[item.date]||0);const height=Math.min(100,value/120*100);return `<div class="bar-col" title="${value} دقيقة"><div class="bar-fill" style="height:${Math.max(3,height)}%"></div><small>${escapeHTML(item.name)}</small></div>`}).join("");
}
function renderAll(){renderHeader();renderStats();renderWeek();renderPlan();renderTasks();renderReviews();renderLessonRecords();renderChart()}
function formatTime(seconds){return `${String(Math.floor(seconds/60)).padStart(2,"0")}:${String(seconds%60).padStart(2,"0")}`}
function renderTimer(){
  setText("#timerDisplay",formatTime(secondsLeft));setText("#timerStatus",timerMode==="focus"?"جلسة مذاكرة":"وقت الراحة");
  const progress=timerDuration?(timerDuration-secondsLeft)/timerDuration:0;
  $("#timerRing").style.background=`conic-gradient(var(--purple) 0deg,var(--cyan) ${progress*360}deg,#17234b ${progress*360}deg)`;
  setText("#timerStart",running?"إيقاف مؤقت":"ابدأ الآن ▷");
  $$(".mode-btn[data-mode]").forEach(b=>b.classList.toggle("active",b.dataset.mode===timerMode));
}
function stopTimer(){if(timerInterval)clearInterval(timerInterval);timerInterval=null;running=false;renderTimer()}
function startTimer(){
  if(running){stopTimer();toast("المؤقت متوقف مؤقتًا");return}
  running=true;renderTimer();timerInterval=setInterval(()=>{secondsLeft--;renderTimer();if(secondsLeft<=0)finishTimer()},1000);toast(timerMode==="focus"?"ركز في مهمة واحدة دلوقتي":"راحة قصيرة، اشرب مياه واتحرك شوية");
}
function finishTimer(){
  stopTimer();secondsLeft=0;renderTimer();
  if(timerMode==="focus"){
    const mins=Math.round(timerDuration/60);state.studyMinutes+=mins;state.weeklyMinutes[dateKey()]=(state.weeklyMinutes[dateKey()]||0)+mins;state.sessions++;state.xp+=25;saveState();renderAll();setText("#timerMessage","عاش! خلصت جلسة تركيز وكسبت 25 XP. خد راحة.");toast("انتهت جلسة التركيز! +25 XP 🎉");
  }else{setText("#timerMessage","الراحة خلصت. لما تكون جاهز ارجع للتركيز.");toast("انتهت الراحة")}
}
function changeTimerMode(mode){stopTimer();timerMode=mode;timerDuration=mode==="focus"?25*60:5*60;secondsLeft=timerDuration;renderTimer();setText("#timerMessage",mode==="focus"?"25 دقيقة تركيز من غير مشتتات.":"5 دقائق راحة قصيرة.");}
function resetTimer(){stopTimer();secondsLeft=timerDuration;renderTimer();setText("#timerMessage","المؤقت اتصفّر. ابدأ لما تكون جاهز.");}
function saveSettings(event){
  event.preventDefault();state.settings={wakeTime:$("#wakeTime").value,schoolEnd:$("#schoolEnd").value,gymTime:$("#gymTime").value};state.dailyGoal=Number($("#dailyGoal").value)||120;saveState();renderPlan();toast("اتحفظت إعدادات يومك");
}
function populateSettings(){ $("#wakeTime").value=state.settings.wakeTime;$("#schoolEnd").value=state.settings.schoolEnd;$("#gymTime").value=state.settings.gymTime;$("#dailyGoal").value=state.dailyGoal;$("#lessonDate").value=dateKey()}
function bindEvents(){
  $("#taskForm").addEventListener("submit",addTask);$("#lessonForm").addEventListener("submit",addLesson);$("#settingsForm").addEventListener("submit",saveSettings);
  $("#timerStart").addEventListener("click",startTimer);$("#timerReset").addEventListener("click",resetTimer);
  $$("[data-mode]").forEach(b=>b.addEventListener("click",()=>changeTimerMode(b.dataset.mode)));
  $("#heroStart").addEventListener("click",()=>{$("#focus").scrollIntoView({behavior:"smooth",block:"center"});if(!running)toast("جاهز؟ اضغط ابدأ الآن")});
  $$(".filter-btn").forEach(b=>b.addEventListener("click",()=>{filter=b.dataset.filter;$$(".filter-btn").forEach(x=>x.classList.toggle("active",x===b));renderTasks()}));
  $("#clearDone").addEventListener("click",clearDone);$("#searchInput").addEventListener("input",renderTasks);
  $$(".subject-tile").forEach(b=>b.addEventListener("click",()=>{const subject=b.dataset.subject;$("#taskSubject").value=subject;$("#taskInput").focus();$("#tasks").scrollIntoView({behavior:"smooth",block:"center"});$$(".subject-tile").forEach(x=>x.classList.toggle("selected",x===b));toast(`تم اختيار مادة ${subject}. اكتب المهمة وأضفها.`)}));
  $("#addLessonShortcut").addEventListener("click",()=>{$("#lessonForm").scrollIntoView({behavior:"smooth",block:"center"});$("#lessonTitle").focus()});
  $("#editPlanBtn").addEventListener("click",()=>{$("#settings").scrollIntoView({behavior:"smooth",block:"center"});toast("عدّل وقت الاستيقاظ والمدرسة والجيم من الإعدادات")});
  $("#themeGlow").addEventListener("click",()=>{document.body.classList.toggle("glow-low");toast(document.body.classList.contains("glow-low")?"تم تقليل الإضاءة":"تم تفعيل الإضاءة")});
  $("#profileButton").addEventListener("click",()=>{const name=prompt("تحب نعرض اسم إيه؟",state.userName);if(name&&name.trim()){state.userName=name.trim().slice(0,30);saveState();renderHeader();toast("تم تحديث الاسم") }});
  $("#resetProgress").addEventListener("click",()=>{if(confirm("متأكد إنك عايز تمسح كل المهام والنقاط والدروس المسجلة من هذا المتصفح؟")){state=structuredClone(DEFAULTS);saveState();resetTimer();populateSettings();renderAll();toast("تمت إعادة ضبط التقدم") }});
  $$(".nav-item").forEach(a=>a.addEventListener("click",()=>{$$(".nav-item").forEach(n=>n.classList.toggle("active",n===a));const target=$(a.getAttribute("href"));if(target){target.scrollIntoView({behavior:document.body.classList.contains("reduce-motion")?"auto":"smooth",block:"start"})}}));
  bindMediaAndEffects();
}
function bindMediaAndEffects(){
  const qAudio=$("#quranAudio"), qUrl=$("#quranUrl"), qFile=$("#quranFile");
  const mediaQuery=$("#mediaSearchQuery"), results=$("#mediaResults");
  const isQuran=q=>/قرآن|قران|سورة|سوره|تلاوة|قارئ|الشيخ|مشاري|الحصري|المنشاوي|عبدالباسط|العفاسي|ماهر المعيقلي|السديس|الشريم/i.test(q);
  function clearResults(msg){results.replaceChildren();const p=document.createElement('p');p.className='media-hint';p.textContent=msg;results.appendChild(p)}
  function makeResult(title,sub,buttonText,action,link){
    const card=document.createElement('div');card.className='media-result';const copy=document.createElement('div');copy.className='media-result-copy';const strong=document.createElement('strong');strong.textContent=title;const small=document.createElement('small');small.textContent=sub;copy.append(strong,small);card.appendChild(copy);
    const actions=document.createElement('div');actions.style.cssText='display:flex;gap:8px;flex-wrap:wrap';const btn=document.createElement('button');btn.type='button';btn.className='primary-btn';btn.textContent=buttonText;btn.addEventListener('click',action);actions.appendChild(btn);
    if(link){const a=document.createElement('a');a.href=link;a.target='_blank';a.rel='noopener noreferrer';a.textContent='فتح المصدر ↗';a.className='small-outline';a.style.cssText='display:inline-flex;align-items:center;padding:10px;border-radius:10px;text-decoration:none';actions.appendChild(a)}card.appendChild(actions);results.appendChild(card)
  }
  async function searchMusic(query){
    clearResults('جاري البحث عن نتائج صوتية...');
    try{
      const url='https://itunes.apple.com/search?term='+encodeURIComponent(query)+'&entity=song&limit=15&country=eg';
      const response=await fetch(url);if(!response.ok)throw new Error('search failed');const data=await response.json();results.replaceChildren();
      if(!data.results||!data.results.length){clearResults('ملقيناش معاينة متاحة. جرّب كتابة اسم الأغنية والمطرب أو استخدم بحث YouTube.');return}
      data.results.forEach(track=>makeResult(track.trackName,track.artistName+' · معاينة صوتية متاحة', '▶ تشغيل المعاينة',async()=>{try{stopAmbient();qAudio.src=track.previewUrl;qAudio.load();await qAudio.play();toast('شغّال دلوقتي: '+track.trackName)}catch(e){toast('المعاينة غير متاحة حاليًا؛ افتح المصدر الرسمي')}},track.trackViewUrl));
      const note=document.createElement('p');note.className='media-hint';note.textContent='المعاينات غالبًا قصيرة (حوالي 30 ثانية). تشغيل الأغنية كاملة يعتمد على توفرها في المصدر الرسمي؛ الموقع لا يتجاوز اشتراكات أو قيود حقوق النشر.';results.prepend(note)
    }catch(e){clearResults('تعذّر جلب نتائج الموسيقى. تأكد من الإنترنت أو استخدم زر بحث YouTube لفتح النتائج الخارجية.')}
  }
  async function searchQuran(query){
    const reciters=[['الحصري','ar.husary'],['المنشاوي','ar.minshawi'],['عبدالباسط','ar.abdulbasitmurattal'],['عبد الباسط','ar.abdulbasitmurattal'],['العفاسي','ar.alafasy'],['مشاري','ar.alafasy'],['ماهر المعيقلي','ar.mahermuaiqly'],['السديس','ar.abdurrahmaansudais']];
    const match=reciters.find(([name])=>query.includes(name));const edition=match?match[1]:'ar.alafasy';
    const surahs=[['الفاتحة',1],['البقرة',2],['آل عمران',3],['ال عمران',3],['النساء',4],['المائدة',5],['الأنعام',6],['الاعراف',7],['يونس',10],['الكهف',18],['مريم',19],['طه',20],['يس',36],['يسٓ',36],['الرحمن',55],['الواقعة',56],['الملك',67],['النبأ',78],['الإخلاص',112],['الفلق',113],['الناس',114]];
    const found=surahs.find(([name])=>query.includes(name));if(!found){clearResults('اكتب اسم سورة معروفًا مثل: سورة الرحمن مشاري العفاسي، أو استخدم زر بحث القرآن لفتح المكتبة الكاملة.');return}
    clearResults('جاري تحميل التلاوة...');
    try{const response=await fetch(`https://api.alquran.cloud/v1/surah/${found[1]}/${edition}`);if(!response.ok)throw new Error('quran unavailable');const json=await response.json();if(json.code!==200||!json.data?.ayahs?.length)throw new Error('edition unavailable');quranPlaylist=json.data.ayahs.map(a=>a.audio).filter(Boolean);quranTrackIndex=0;results.replaceChildren();makeResult(`سورة ${found[0]}`,`القارئ: ${match?match[0]:'مشاري العفاسي'} · تشغيل متتابع للآيات`,'▶ تشغيل السورة',async()=>{try{stopAmbient();qAudio.src=quranPlaylist[0];qAudio.load();await qAudio.play();toast('بدأت التلاوة، وسيتم الانتقال للآية التالية تلقائيًا')}catch(e){toast('تعذّر تشغيل التلاوة؛ جرّب قارئًا آخر')}} ,'https://mp3quran.net/ar');const note=document.createElement('p');note.className='media-hint';note.textContent='التشغيل يعتمد على اتصال الإنترنت وتوفر القارئ لدى مصدر التلاوات.';results.appendChild(note)}catch(e){clearResults('مصدر التلاوة غير متاح حاليًا أو القارئ غير موجود. جرّب مشاري العفاسي أو الحصري، أو افتح مكتبة MP3 Quran.')}
  }
  async function doSearch(){const query=mediaQuery.value.trim();if(!query){toast('اكتب اسم الأغنية أو السورة الأول');return}if(isQuran(query))await searchQuran(query);else await searchMusic(query)}
  $('#mediaSearchForm').addEventListener('submit',e=>{e.preventDefault();doSearch()});
  $('#searchYouTube').addEventListener('click',()=>{const q=mediaQuery.value.trim();if(!q){toast('اكتب اللي بتدور عليه الأول');return}window.open('https://www.youtube.com/results?search_query='+encodeURIComponent(q),'_blank','noopener,noreferrer')});
  $('#searchQuran').addEventListener('click',()=>{if(!mediaQuery.value.trim()){mediaQuery.value='سورة الرحمن مشاري العفاسي'}searchQuran(mediaQuery.value.trim())});
  $('#searchWeb').addEventListener('click',()=>{const q=mediaQuery.value.trim();if(!q){toast('اكتب اللي بتدور عليه الأول');return}window.open('https://www.google.com/search?q='+encodeURIComponent(q+' تشغيل صوت'),'_blank','noopener,noreferrer')});
  qAudio.addEventListener('ended',async()=>{if(quranPlaylist.length&&quranTrackIndex>=0&&quranTrackIndex+1<quranPlaylist.length){quranTrackIndex++;qAudio.src=quranPlaylist[quranTrackIndex];try{await qAudio.play()}catch(e){toast('اضغط تشغيل لمتابعة التلاوة')}}else{quranTrackIndex=-1;quranPlaylist=[]}});
  $('#playQuran').addEventListener('click',async()=>{const url=qUrl.value.trim();if(!url){toast('الصق رابط MP3 مباشر أو اختار ملف صوتي الأول');return}try{quranPlaylist=[];quranTrackIndex=-1;qAudio.src=url;stopAmbient();await qAudio.play();toast('بدأ تشغيل الصوت')}catch(e){toast('الرابط مش مباشر أو المتصفح منع التشغيل؛ جرّب رابط MP3 صحيح')}});
  qFile.addEventListener('change',()=>{const file=qFile.files&&qFile.files[0];if(!file)return;if(quranObjectUrl)URL.revokeObjectURL(quranObjectUrl);quranObjectUrl=URL.createObjectURL(file);quranPlaylist=[];quranTrackIndex=-1;qAudio.src=quranObjectUrl;stopAmbient();qAudio.play().catch(()=>{});toast('تم فتح الملف الصوتي من جهازك')});
  qAudio.addEventListener('play',stopAmbient);
  $('#ambientToggle').addEventListener('click',()=>ambientOn?stopAmbient():startAmbient());$('#ambientStop').addEventListener('click',stopAmbient);
  $('#ambientVolume').addEventListener('input',e=>{if(ambientGain)ambientGain.gain.setTargetAtTime(Number(e.target.value)/100,ambientContext.currentTime,.08)});
  $('#starsToggle').addEventListener('change',e=>document.body.classList.toggle('no-stars',!e.target.checked));$('#neonToggle').addEventListener('change',e=>document.body.classList.toggle('no-neon',!e.target.checked));$('#motionToggle').addEventListener('change',e=>document.body.classList.toggle('no-motion',!e.target.checked));
  $('#reduceMotion').addEventListener('change',e=>{document.body.classList.toggle('reduce-motion',e.target.checked);if(e.target.checked){$('#motionToggle').checked=false;document.body.classList.add('no-motion')}else{$('#motionToggle').checked=true;document.body.classList.remove('no-motion')}});
}
function startAmbient(){
  try{const AC=window.AudioContext||window.webkitAudioContext;if(!AC){toast("المتصفح لا يدعم الصوت التوليدي");return}if(!ambientContext)ambientContext=new AC();ambientContext.resume();ambientNodes.forEach(n=>{try{n.stop()}catch(e){}});ambientNodes=[];const master=ambientContext.createGain();master.gain.value=Number($("#ambientVolume").value)/100;master.connect(ambientContext.destination);ambientGain=master;
    // نغمات هادئة مولدة محليًا، وليست أغنية مسجلة.
    [110,164.81,220,329.63].forEach((freq,i)=>{const osc=ambientContext.createOscillator(),gain=ambientContext.createGain(),filter=ambientContext.createBiquadFilter();osc.type=i%2?"sine":"triangle";osc.frequency.value=freq;gain.gain.value=i===0?.22:.08;filter.type="lowpass";filter.frequency.value=650;osc.connect(filter);filter.connect(gain);gain.connect(master);osc.start();ambientNodes.push(osc)});
    ambientOn=true;$("#ambientToggle").textContent="Ⅱ إيقاف مؤقت";$(".sound-visual").classList.add("playing");toast("الأجواء الهادئة شغالة — ربنا يوفقك")
  }catch(e){toast("تعذر تشغيل الصوت؛ جرّب الضغط مرة أخرى")}
}
function stopAmbient(){if(ambientContext&&ambientGain){try{ambientGain.gain.setTargetAtTime(0,ambientContext.currentTime,.06)}catch(e){}}ambientNodes.forEach(n=>{try{n.stop()}catch(e){}});ambientNodes=[];ambientGain=null;ambientOn=false;const b=$("#ambientToggle"),visual=$(".sound-visual");if(b)b.textContent="▶ تشغيل الأجواء";if(visual)visual.classList.remove("playing")}
function init(){renderAll();populateSettings();renderTimer();bindEvents();console.log("نظام أحمد جاهز")}
document.addEventListener("DOMContentLoaded",init);
