/* ===== QUIZ EXTRAS: sound, hints, autosave ===== */
Object.assign(EN,{"صوت":"Sound","اكتم الصوت":"Mute","شغّل الصوت":"Unmute",
"اكتب الأسئلة، حدّد الإجابة الصح، وبعدين احفظ.":"Write the questions, mark the right answer, then save.",
"اختار كويز وابدأه، أو اعمل واحد جديد.":"Pick a quiz to start, or create a new one.",
"اختار شكل اللعب: فردي أو فرق.":"Choose how to play: individual or teams.",
"شارك الكود أو الـQR، واضغط ابدأ لما الكل يدخل.":"Share the code or QR, and press Start when everyone has joined.",
"اللاعبين بيجاوبوا دلوقتي. تقدر تعرض النتيجة بدري.":"Players are answering now. You can show the result early.",
"دي الإجابة والترتيب. اضغط التالي لما تبقى جاهز.":"Here are the answer and ranking. Press Next when ready.",
"الكويز خلص. صدّر النتايج أو ارجع للمكتبة.":"The quiz is over. Export the results or go back to the library.",
"رجّعنا تعديلاتك اللي ما اتحفظتش.":"We restored your unsaved changes.","ابدأ من جديد":"Start over","اتحفظ تلقائياً":"Autosaved"});
const QX=(()=>{
let ctx=null,master=null,mus=null,muted=false;try{muted=localStorage.getItem('quiz.mute')==='1'}catch{}
function unlock(){try{if(!ctx){const A=window.AudioContext||window.webkitAudioContext;if(!A)return;ctx=new A();master=ctx.createGain();master.gain.value=muted?0:0.9;master.connect(ctx.destination)}if(ctx.state==='suspended')ctx.resume()}catch{}}
['pointerdown','keydown','touchstart'].forEach(e=>addEventListener(e,unlock,{passive:true}));
function ready(){return ctx&&ctx.state==='running'&&!muted}
function stopMusic(){if(mus){clearTimeout(mus.t);try{mus.g.gain.cancelScheduledValues(0);mus.g.gain.setTargetAtTime(0,ctx.currentTime,0.08)}catch{}const g=mus.g;setTimeout(()=>{try{g.disconnect()}catch{}},600);mus=null}}
function startMusic(){if(mus||!ready())return;const g=ctx.createGain();g.gain.value=0.55;g.connect(master);mus={g,t:0};const loop=()=>{if(!mus||mus.g!==g)return;const len=QS.music(ctx,g,'arcade',ctx.currentTime+0.05);mus.t=setTimeout(loop,Math.max(1000,(len-0.3)*1000))};loop()}
function once(fn){if(ready()){try{fn(ctx,master,ctx.currentTime+0.03)}catch{}}}
function setMuted(v){muted=v;try{localStorage.setItem('quiz.mute',v?'1':'0')}catch{}if(master)master.gain.value=v?0:0.9;if(v)stopMusic();btn();watch(true)}
function confetti(){const box=document.createElement('div');box.className='qconf';const cols=['#E60000','#ffffff','#ff6b6b','#ffd166','#4cc38a'];for(let i=0;i<70;i++){const p=document.createElement('i');p.style.left=Math.random()*100+'%';p.style.background=cols[i%cols.length];p.style.animationDelay=Math.random()*1.2+'s';p.style.animationDuration=2.4+Math.random()*2+'s';p.style.setProperty('--dx',(Math.random()*160-80)+'px');box.appendChild(p)}document.body.appendChild(box);setTimeout(()=>box.remove(),6500)}
function btn(){let b=document.getElementById('qmute');const on=(role==='quiz'&&Q.view==='host')||role==='quizPlay';if(!on){if(b)b.remove();return}if(!b){b=document.createElement('button');b.id='qmute';b.type='button';b.className='secondary';b.onclick=()=>{unlock();setMuted(!muted)};document.body.appendChild(b)}b.textContent=muted?'🔇':'🔊';b.title=b.ariaLabel=t(muted?'شغّل الصوت':'اكتم الصوت')}
let last=null;
function watch(force){btn();const s=Q.gs,host=role==='quiz'&&Q.view==='host',pl=role==='quizPlay';if(!s||!(host||pl)){stopMusic();last=null;return}
 const key=s.code+'|'+s.phase+'|'+s.qi+'|'+(pl?'p':'h');
 if(host){if(s.phase==='answering')startMusic();else stopMusic()}else stopMusic();
 if(key===last&&!force)return;const prev=last;last=key;if(force||!prev)return;if(prev.split('|')[0]!==key.split('|')[0])return;
 if(s.phase==='reveal'&&pl&&s.me&&s.me.answered&&s.q&&s.q.type!=='cloud'){once(s.me.ok?QS.ting:QS.buzz)}
 if(s.phase==='ended'){once(QS.cheer);confetti()}}
setInterval(()=>watch(false),400);
return {unlock,watch}})();
/* hints */
{const H={edit:'اكتب الأسئلة، حدّد الإجابة الصح، وبعدين احفظ.',lib:'اختار كويز وابدأه، أو اعمل واحد جديد.',launch:'اختار شكل اللعب: فردي أو فرق.'};
const HP={lobby:'شارك الكود أو الـQR، واضغط ابدأ لما الكل يدخل.',answering:'اللاعبين بيجاوبوا دلوقتي. تقدر تعرض النتيجة بدري.',reveal:'دي الإجابة والترتيب. اضغط التالي لما تبقى جاهز.',ended:'الكويز خلص. صدّر النتايج أو ارجع للمكتبة.'};
const _qr=qrender;qrender=function(){_qr();if(role!=='quiz')return;const r=$('quizRoot');if(!r)return;let k=H[Q.view];if(Q.view==='host'&&Q.gs)k=HP[Q.gs.phase];if(!k)return;const old=r.querySelector('.qhint');if(old)old.remove();const p=document.createElement('p');p.className='qhint';p.textContent=t(k);r.insertBefore(p,r.firstChild)}}
/* autosave of drafts */
{const key=()=>'quiz.draft.'+(Q.draftId||'new');let tm=0;
const save=()=>{if(role!=='quiz'||Q.view!=='edit'||!Q.draft||Q._base==null)return;try{const cur=JSON.stringify(Q.draft);if(cur===Q._base)localStorage.removeItem(key());else localStorage.setItem(key(),JSON.stringify({base:Q._base,cur}))}catch{}};
const sched=()=>{clearTimeout(tm);tm=setTimeout(save,500)};
const _ev=editView;editView=function(r){if(Q._dr!==Q.draft){Q._dr=Q.draft;Q._base=JSON.stringify(Q.draft);try{const s=JSON.parse(localStorage.getItem(key())||'null');if(s&&s.base===Q._base&&s.cur!==Q._base){Q.draft=Q._dr=JSON.parse(s.cur);qtoast(t('رجّعنا تعديلاتك اللي ما اتحفظتش.'),{label:t('ابدأ من جديد'),fn:()=>{try{localStorage.removeItem(key())}catch{}Q.draft=Q._dr=JSON.parse(Q._base);editView($('quizRoot'))}})}}catch{}}_ev(r);sched()};
addEventListener('input',e=>{if(role==='quiz'&&Q.view==='edit'&&e.target.closest&&e.target.closest('#quizRoot'))sched()},true);
addEventListener('pagehide',save);document.addEventListener('visibilitychange',()=>{if(document.hidden)save()});
const _api=qapi;qapi=async function(p,b,tok){const k=key(),res=await _api(p,b,tok);if(p==='/library/save'){try{localStorage.removeItem(k)}catch{}}return res}}
function qtoast(msg,act){const old=document.getElementById('qtoast');if(old)old.remove();const d=document.createElement('div');d.id='qtoast';d.setAttribute('role','status');const s=document.createElement('span');s.textContent=msg;d.appendChild(s);if(act){const a=document.createElement('button');a.type='button';a.className='secondary';a.textContent=act.label;a.onclick=()=>{act.fn();d.remove()};d.appendChild(a)}const x=document.createElement('button');x.type='button';x.className='secondary';x.textContent='✕';x.setAttribute('aria-label','close');x.onclick=()=>d.remove();d.appendChild(x);document.body.appendChild(d);setTimeout(()=>d.remove(),5000)}
