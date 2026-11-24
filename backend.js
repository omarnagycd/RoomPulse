const schema = [
`CREATE TABLE IF NOT EXISTS ranking_rounds (code TEXT PRIMARY KEY, ended INTEGER NOT NULL DEFAULT 0)`,
`CREATE TABLE IF NOT EXISTS ranking_sessions (code TEXT PRIMARY KEY, started INTEGER NOT NULL, correct INTEGER, group_code TEXT NOT NULL)`,
`CREATE TABLE IF NOT EXISTS ranking_answers (id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT NOT NULL, client TEXT NOT NULL, choice INTEGER NOT NULL, received INTEGER NOT NULL, UNIQUE(code,client))`,
`CREATE INDEX IF NOT EXISTS ranking_answers_code ON ranking_answers(code,received,id)`,
`CREATE TABLE IF NOT EXISTS session_timers (code TEXT PRIMARY KEY, duration INTEGER NOT NULL, ends_at INTEGER NOT NULL)`,
`CREATE TABLE IF NOT EXISTS sessions (code TEXT PRIMARY KEY, token TEXT NOT NULL, title TEXT NOT NULL, question TEXT NOT NULL, options TEXT NOT NULL, open INTEGER NOT NULL DEFAULT 1, expires INTEGER NOT NULL)`,
`CREATE TABLE IF NOT EXISTS votes (code TEXT NOT NULL, client TEXT NOT NULL, choice INTEGER NOT NULL, PRIMARY KEY(code,client))`,
`CREATE INDEX IF NOT EXISTS session_expiry ON sessions(expires)`,
`CREATE TABLE IF NOT EXISTS session_modes (code TEXT PRIMARY KEY, mode TEXT NOT NULL)`,
`CREATE TABLE IF NOT EXISTS text_answers (id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT NOT NULL, client TEXT NOT NULL, answer TEXT NOT NULL, created INTEGER NOT NULL, UNIQUE(code,client))`,
`CREATE INDEX IF NOT EXISTS answers_code ON text_answers(code,id)`,
`CREATE TABLE IF NOT EXISTS session_identity (code TEXT PRIMARY KEY, identity TEXT NOT NULL)`,
`CREATE TABLE IF NOT EXISTS participant_names (code TEXT NOT NULL, client TEXT NOT NULL, name TEXT NOT NULL, PRIMARY KEY(code,client))`
];
const json=(d,status=200)=>new Response(JSON.stringify(d),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status})};
async function hash(s){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))].map(x=>x.toString(16).padStart(2,'0')).join('')}
async function body(req){const t=await req.text();if(t.length>8192)fail('حجم الطلب أكبر من المسموح.');try{return JSON.parse(t)}catch{fail('بيانات الطلب غير صحيحة.')}}
function clean(s,n){if(typeof s!=='string'||!s.trim()||s.trim().length>n)fail('كمّل السؤال والاختيارات، والتزم بالطول المسموح.');return s.trim()}

async function roundScores(db,groupCode,identity){
const rows=await db.prepare('SELECT a.id,a.client,a.choice,a.received,r.code,r.started,r.correct,n.name FROM ranking_answers a JOIN ranking_sessions r ON r.code=a.code LEFT JOIN participant_names n ON n.code=a.code AND n.client=a.client WHERE r.group_code=? ORDER BY a.id').bind(groupCode).all();
const players=new Map();for(const a of rows.results){if(!players.has(a.client))players.set(a.client,{participant:players.size+1,...(identity==='named'?{name:a.name||''}:{}),points:0,correctAnswers:0,answers:0});players.get(a.client).answers++;}
const codes=[...new Set(rows.results.map(a=>a.code))];for(const code of codes){const eligible=rows.results.filter(a=>a.code===code&&(a.correct===null||a.choice===a.correct)).sort((a,b)=>a.received-b.received||a.id-b.id);let previous=null,rank=0;eligible.forEach((a,i)=>{if(a.received!==previous)rank=i+1;previous=a.received;const p=players.get(a.client);p.points+=Math.max(1,Math.floor(1000/rank));p.correctAnswers++;});}
const list=[...players.values()].sort((a,b)=>b.points-a.points||a.participant-b.participant);let previous=null,rank=0;return list.map((p,i)=>{if(p.points!==previous)rank=i+1;previous=p.points;return {...p,rank}});
}

// ===== QUIZ MODULE (added 2026-11-24): admin quiz library + live quiz games under /api/quiz/*. Existing routes are untouched. =====
const QSCHEMA=[
`CREATE TABLE IF NOT EXISTS quiz_admin (id INTEGER PRIMARY KEY CHECK(id=1), salt TEXT NOT NULL, hash TEXT NOT NULL)`,
`CREATE TABLE IF NOT EXISTS quiz_admin_tokens (hash TEXT PRIMARY KEY, expires INTEGER NOT NULL)`,
`CREATE TABLE IF NOT EXISTS quiz_attempts (id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER NOT NULL)`,
`CREATE TABLE IF NOT EXISTS quiz_library (id TEXT PRIMARY KEY, title TEXT NOT NULL, data TEXT NOT NULL, updated INTEGER NOT NULL)`,
`CREATE TABLE IF NOT EXISTS quiz_games (code TEXT PRIMARY KEY, token TEXT NOT NULL, quiz TEXT NOT NULL, teams INTEGER NOT NULL, state TEXT NOT NULL, qi INTEGER NOT NULL, q_start INTEGER NOT NULL, q_end INTEGER NOT NULL, expires INTEGER NOT NULL)`,
`CREATE TABLE IF NOT EXISTS quiz_players (code TEXT NOT NULL, client TEXT NOT NULL, name TEXT NOT NULL, team INTEGER NOT NULL, score INTEGER NOT NULL DEFAULT 0, joined INTEGER NOT NULL, PRIMARY KEY(code,client))`,
`CREATE TABLE IF NOT EXISTS quiz_answers (code TEXT NOT NULL, qi INTEGER NOT NULL, client TEXT NOT NULL, choice INTEGER, text TEXT, ms INTEGER NOT NULL, points INTEGER NOT NULL, ok INTEGER NOT NULL, PRIMARY KEY(code,qi,client))`,
`CREATE TABLE IF NOT EXISTS quiz_history (code TEXT PRIMARY KEY, title TEXT NOT NULL, ended INTEGER NOT NULL, teams INTEGER NOT NULL, players INTEGER NOT NULL, top TEXT NOT NULL, data TEXT NOT NULL)`,
`CREATE TABLE IF NOT EXISTS quiz_teams (id TEXT PRIMARY KEY, name TEXT NOT NULL, created INTEGER NOT NULL, suspended INTEGER NOT NULL DEFAULT 0)`,
`CREATE TABLE IF NOT EXISTS quiz_accounts (id TEXT PRIMARY KEY, team TEXT NOT NULL, email TEXT NOT NULL UNIQUE, salt TEXT NOT NULL, hash TEXT NOT NULL, created INTEGER NOT NULL, suspended INTEGER NOT NULL DEFAULT 0)`,
`CREATE TABLE IF NOT EXISTS quiz_sessions (hash TEXT PRIMARY KEY, role TEXT NOT NULL, account TEXT NOT NULL, team TEXT NOT NULL, expires INTEGER NOT NULL, seen INTEGER NOT NULL DEFAULT 0)`,
`CREATE TABLE IF NOT EXISTS quiz_invites (hash TEXT PRIMARY KEY, team TEXT NOT NULL, expires INTEGER NOT NULL, used INTEGER NOT NULL DEFAULT 0)`,
`CREATE TABLE IF NOT EXISTS quiz_sys (id INTEGER PRIMARY KEY CHECK(id=1), email TEXT NOT NULL, salt TEXT NOT NULL, hash TEXT NOT NULL)`,
`CREATE TABLE IF NOT EXISTS quiz_daily (day TEXT NOT NULL, team TEXT NOT NULL, players INTEGER NOT NULL DEFAULT 0, trainers INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(day,team))`,
`CREATE TABLE IF NOT EXISTS quiz_avatars (code TEXT NOT NULL, client TEXT NOT NULL, avatar INTEGER NOT NULL, PRIMARY KEY(code,client))`,
`CREATE INDEX IF NOT EXISTS quiz_history_ended ON quiz_history(ended)`
];
let quizReady=false;
async function qbody(req,max){const t=await req.text();if(t.length>max)fail('حجم الطلب أكبر من المسموح.',413);try{return t?JSON.parse(t):{}}catch{fail('بيانات الطلب غير صحيحة.')}}
async function qpass(salt,pass){const k=await crypto.subtle.importKey('raw',new TextEncoder().encode(pass),'PBKDF2',false,['deriveBits']);const b=await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:new TextEncoder().encode(salt),iterations:10000},k,256);return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('')}
async function qissue(db,now){const token=crypto.randomUUID()+crypto.randomUUID();await db.prepare('DELETE FROM quiz_admin_tokens WHERE expires<?').bind(now).run();await db.prepare('INSERT INTO quiz_admin_tokens(hash,expires) VALUES(?,?)').bind(await hash(token),now+60*86400000).run();return token}
const QMIG=["ALTER TABLE quiz_library ADD COLUMN team TEXT NOT NULL DEFAULT 'omar'","ALTER TABLE quiz_games ADD COLUMN team TEXT NOT NULL DEFAULT 'omar'","ALTER TABLE quiz_games ADD COLUMN cls TEXT NOT NULL DEFAULT ''","ALTER TABLE quiz_history ADD COLUMN team TEXT NOT NULL DEFAULT 'omar'","ALTER TABLE quiz_history ADD COLUMN cls TEXT NOT NULL DEFAULT ''"];
async function qinit(db){await db.batch(QSCHEMA.map(s=>db.prepare(s)));for(const s of QMIG){try{await db.prepare(s).run()}catch{}}
 try{const old=await db.prepare("SELECT (SELECT count(*) FROM quiz_library WHERE team='omar')+(SELECT count(*) FROM quiz_games WHERE team='omar')+(SELECT count(*) FROM quiz_history WHERE team='omar') n,(SELECT count(*) FROM quiz_sys) s").first();if(old&&(old.n>0||old.s===0))await db.prepare("INSERT OR IGNORE INTO quiz_teams(id,name,created) VALUES('omar','Omar Nagy Training Team',?)").bind(Date.now()).run()}catch{}
 try{await db.batch([db.prepare('DELETE FROM quiz_admin'),db.prepare('DELETE FROM quiz_admin_tokens')])}catch{}}
async function qday(db,team,now,col){const day=new Date(now).toISOString().slice(0,10);const c=col==='trainers'?'trainers':'players';await db.prepare('INSERT INTO quiz_daily(day,team,'+c+') VALUES(?,?,1) ON CONFLICT(day,team) DO UPDATE SET '+c+'='+c+'+1').bind(day,team).run()}
function qemail(e){e=typeof e==='string'?e.trim().toLowerCase():'';if(!/^[^\s@]{1,64}@[^\s@]{1,100}$/.test(e))fail('اكتب إيميل صحيح.');return e}
function qlogin(e){e=typeof e==='string'?e.trim().toLowerCase():'';if(!/^[a-z0-9._-]{3,64}$/.test(e)&&!/^[^\s@]{1,64}@[^\s@]{1,100}$/.test(e))fail('اكتب يوزر (حروف وأرقام ونقطة وشرطة، 3 على الأقل) أو إيميل صحيح.');return e}
function qpw(p){if(typeof p!=='string'||p.length<6||p.length>64)fail('كلمة السر من ٦ لـ ٦٤ حرف أو رقم.');return p}
async function qsess(db,role,account,team,now){const token=crypto.randomUUID()+crypto.randomUUID();await db.prepare('DELETE FROM quiz_sessions WHERE expires<?').bind(now).run();await db.prepare('INSERT INTO quiz_sessions(hash,role,account,team,expires,seen) VALUES(?,?,?,?,?,?)').bind(await hash(token),role,account,team,now+60*86400000,now).run();return token}
async function qthrottle(db,now){const r=await db.prepare('SELECT count(*) n FROM quiz_attempts WHERE ts>?').bind(now-900000).first();if(r.n>=10)fail('محاولات كتير غلط. استنى ١٥ دقيقة وجرّب تاني.',429)}
async function qteam(req,db,now,write){const a=req.headers.get('Authorization')||'';if(!a.startsWith('Bearer '))fail('سجّل الدخول الأول.',401);
 const s=await db.prepare('SELECT hash,role,account,team,seen FROM quiz_sessions WHERE hash=? AND expires>?').bind(await hash(a.slice(7)),now).first();if(!s)fail('الجلسة انتهت. سجّل الدخول تاني.',401);
 if(s.seen<now-60000)await db.prepare('UPDATE quiz_sessions SET seen=?,expires=? WHERE hash=?').bind(now,now+60*86400000,s.hash).run();
 if(s.role==='admin'){const id=req.headers.get('X-Team')||'';const t=id?await db.prepare('SELECT id FROM quiz_teams WHERE id=?').bind(id).first():null;if(!t)fail('اختار فريق الأول.',400);if(write)fail('الأدمن بيشوف بيانات الفريق للقراءة بس.',403);return {team:t.id,role:'admin',account:s.account}}
 const x=await db.prepare('SELECT a.suspended s,t.suspended ts FROM quiz_accounts a JOIN quiz_teams t ON t.id=a.team WHERE a.id=?').bind(s.account).first();if(!x||x.s||x.ts)fail('الحساب ده موقوف.',403);
 return {team:s.team,role:'user',account:s.account}}
async function qsys(req,db,now){const a=req.headers.get('Authorization')||'';const s=a.startsWith('Bearer ')?await db.prepare("SELECT hash,seen FROM quiz_sessions WHERE hash=? AND role='admin' AND expires>?").bind(await hash(a.slice(7)),now).first():null;if(!s)fail('ادخل بحساب الأدمن.',401);if(s.seen<now-60000)await db.prepare('UPDATE quiz_sessions SET seen=?,expires=? WHERE hash=?').bind(now,now+60*86400000,s.hash).run()}
async function qaccount(db,now,team,email,password){const e=qlogin(email);qpw(password);const t=await db.prepare('SELECT 1 FROM quiz_teams WHERE id=?').bind(team).first();if(!t)fail('الفريق مش موجود.',404);const salt=crypto.randomUUID(),id=crypto.randomUUID();const r=await db.prepare('INSERT OR IGNORE INTO quiz_accounts(id,team,email,salt,hash,created) VALUES(?,?,?,?,?,?)').bind(id,team,e,salt,await qpass(salt,password),now).run();if(!r.meta.changes)fail('اليوزر أو الإيميل ده مستخدم بالفعل.',409);return id}
async function qreport(db,code,g,quiz,state){state=state||g.state;
  const pl=await db.prepare('SELECT client,name,team,score FROM quiz_players WHERE code=? ORDER BY score DESC,joined').bind(code).all();const an=await db.prepare('SELECT qi,client,choice,text,points,ok,ms FROM quiz_answers WHERE code=?').bind(code).all();
  const nm=new Map(pl.results.map(p=>[p.client,p.name]));
  const questions=quiz.questions.map((q,i)=>{const a=an.results.filter(x=>x.qi===i);const o={index:i,type:q.type,text:q.text,answered:a.length,players:pl.results.length};
   if(q.type==='cloud'){const w={};for(const x of a)w[x.text]=(w[x.text]||0)+1;o.words=Object.entries(w).sort((x,y)=>y[1]-x[1]).map(([word,n])=>({word,n}));return o}
   o.options=q.options;o.correct=q.correct;o.correctCount=a.filter(x=>x.ok).length;o.pct=pl.results.length?Math.round(100*o.correctCount/pl.results.length):0;o.counts=q.options.map((_,k)=>a.filter(x=>x.choice===k).length);
   o.wrong=a.filter(x=>!x.ok).map(x=>({name:nm.get(x.client)||'',choice:x.choice}));o.missing=pl.results.filter(p=>!a.some(x=>x.client===p.client)).map(p=>p.name);return o});
  const pmap=new Map(an.results.map(x=>[x.client+'|'+x.qi,x.points]));
  const players=pl.results.map((p,i)=>({rank:i+1,name:p.name,team:p.team,score:p.score,pts:quiz.questions.map((_,k)=>pmap.get(p.client+'|'+k)||0)}));
  const teamBoard=g.teams>0?Array.from({length:g.teams},(_,i)=>{const mem=players.filter(p=>p.team===i+1);return {team:i+1,members:mem.length,score:mem.length?Math.round(100*mem.reduce((s,p)=>s+p.score,0)/mem.length)/100:0}}).sort((a,b)=>b.score-a.score||a.team-b.team):null;
  return {title:quiz.title,teams:g.teams,state:state,players,teamBoard,questions}
}
async function qsave(db,code,g,quiz,now){const r=await qreport(db,code,g,quiz,'ended');const top=r.players.slice(0,3).map(p=>({name:p.name,score:p.score}));await db.prepare('INSERT OR REPLACE INTO quiz_history(code,title,ended,teams,players,top,data,team,cls) VALUES(?,?,?,?,?,?,?,?,?)').bind(code,quiz.title,now,g.teams,r.players.length,JSON.stringify(top),JSON.stringify(r),g.team||'omar',g.cls||'').run()}
function qclean(q){
 if(!q||typeof q!=='object')fail('الكويز غير صحيح.');
 const title=typeof q.title==='string'?q.title.trim():'';if(!title||title.length>80)fail('اكتب اسم للكويز لحد ٨٠ حرف.');
 if(!Array.isArray(q.questions)||q.questions.length<1||q.questions.length>50)fail('الكويز لازم يكون فيه من ١ لـ ٥٠ سؤال.');
 const questions=q.questions.map((x,i)=>{
  const type=['mc','spot','cloud'].includes(x?.type)?x.type:fail('نوع السؤال '+(i+1)+' غير صحيح.');
  const text=typeof x.text==='string'?x.text.trim():'';if(!text||text.length>300)fail('اكتب نص السؤال '+(i+1)+' لحد ٣٠٠ حرف.');
  let time=Number.isInteger(x.time)?x.time:20;if(time<5||time>240)fail('وقت السؤال '+(i+1)+' من ٥ لـ ٢٤٠ ثانية.');
  const out={type,text,time};
  if(type==='cloud'){out.points=0;return out}
  const max=type==='mc'?4:6,opts=Array.isArray(x.options)?x.options.map(o=>typeof o==='string'?o.trim():''):[];
  if(opts.length<2||opts.length>max||opts.some(o=>!o||o.length>(type==='spot'?200:120)))fail('كمّل اختيارات السؤال '+(i+1)+'.');
  if(!Number.isInteger(x.correct)||x.correct<0||x.correct>=opts.length)fail('حدد الإجابة الصح في السؤال '+(i+1)+'.');
  let points=x.points===undefined?1:x.points;if(Number.isInteger(points)&&points>100)points=1;if(!Number.isInteger(points)||points<1)fail('نقاط السؤال '+(i+1)+' من ١ لـ ١٠٠.');
  return {...out,options:opts,correct:x.correct,points}
 });
 return {title,questions}
}
function qP(q){const p=q.points;return Number.isInteger(p)&&p>=1&&p<=100?p:1}
async function qpush(db,code,now){
 const g=await db.prepare('SELECT * FROM quiz_games WHERE code=? AND expires>?').bind(code,now).first();if(!g)return null;
 const quiz=JSON.parse(g.quiz),total=quiz.questions.length,cur=g.state==='question'?quiz.questions[g.qi]:null,answering=!!cur&&now<g.q_end;
 const pub={code,title:quiz.title,teams:g.teams,state:g.state,qi:g.qi,total,serverNow:now,qStart:g.q_start,qEnd:g.q_end,isHost:false};
 pub.phase=g.state==='lobby'?'lobby':g.state==='ended'?'ended':answering?'answering':'reveal';
 if(cur)pub.q=qpublicQ(cur,!answering);
 const pl=await db.prepare('SELECT client,name,team,score,joined,(SELECT avatar FROM quiz_avatars a WHERE a.code=quiz_players.code AND a.client=quiz_players.client) av FROM quiz_players WHERE code=? ORDER BY score DESC,joined').bind(code).all();
 const rows=pl.results;const avf=p=>p.av===null||p.av===undefined?-1:p.av;
 const ans=cur?(await db.prepare('SELECT client,choice,text,points,ok FROM quiz_answers WHERE code=? AND qi=?').bind(code,g.qi).all()).results:[];
 pub.playerCount=rows.length;
 if(g.state==='lobby')pub.players=[...rows].sort((a,b)=>b.joined-a.joined).slice(0,60).map(p=>({name:p.name,team:p.team,av:p.av}));
 let prev=null,rank=0;const ranked=rows.map((p,i)=>{if(p.score!==prev)rank=i+1;prev=p.score;return {...p,rank}});
 const reveal=g.state==='question'&&!answering||g.state==='ended';let tb=null;
 if(reveal){
  pub.leaderboard=ranked.slice(0,g.state==='ended'?10:5).map(p=>({rank:p.rank,name:p.name,team:p.team,score:p.score,av:avf(p)}));
  if(g.teams>0){tb=Array.from({length:g.teams},(_,i)=>{const mem=ranked.filter(p=>p.team===i+1);return {team:i+1,members:mem.length,score:mem.length?Math.round(100*mem.reduce((s,p)=>s+p.score,0)/mem.length)/100:0}}).sort((a,b)=>b.score-a.score||a.team-b.team);pub.teamBoard=tb}
  if(cur){pub.answered=ans.length;if(cur.type==='cloud'){const w={};for(const x of ans)w[x.text]=(w[x.text]||0)+1;pub.words=Object.entries(w).sort((x,y)=>y[1]-x[1]).slice(0,60).map(([word,n])=>({word,n}))}else pub.counts=cur.options.map((_,k)=>ans.filter(x=>x.choice===k).length)}}
 const am=new Map(ans.map(a=>[a.client,a]));const me={};
 for(const p of ranked){const o={name:p.name,team:p.team,score:p.score,av:avf(p)};
  if(cur){const a=am.get(p.client);o.answered=!!a;if(a&&!answering){o.ok=!!a.ok;o.points=a.points}if(a&&answering&&cur.type==='cloud')o.text=a.text;if(a&&cur.type!=='cloud')o.choice=a.choice}
  if(reveal){o.rank=p.rank;if(tb)o.teamRank=tb.findIndex(x=>x.team===p.team)+1}
  me[p.client]=o}
 return {pub,me,g,answering}}
function qpublicQ(q,withCorrect){const o={type:q.type,text:q.text,time:q.time,points:qP(q)};if(q.options)o.options=q.options;if(withCorrect&&q.correct!==undefined)o.correct=q.correct;return o}
async function qhandle(req,env,path,u,now){
 const db=env.DB;
 if(!quizReady){await qinit(db);quizReady=true}
 const m=req.method,sub=path.slice('/api/quiz'.length);
 // ---- accounts / admin ----
 if(sub==='/admin/status'&&m==='GET'){const r=await db.prepare('SELECT 1 FROM quiz_sys WHERE id=1').first();return json({configured:true,teams:true,sysConfigured:!!r})}
 if(sub==='/login'&&m==='POST'){await qthrottle(db,now);const b=await qbody(req,2048);const e=typeof b.email==='string'?b.email.trim().toLowerCase():'';const a=e?await db.prepare('SELECT a.id,a.team,a.salt,a.hash,a.suspended s,t.name,t.suspended ts FROM quiz_accounts a JOIN quiz_teams t ON t.id=a.team WHERE a.email=?').bind(e).first():null;
  const ok=a&&await qpass(a.salt,typeof b.password==='string'?b.password:'')===a.hash;if(!ok){await db.prepare('INSERT INTO quiz_attempts(ts) VALUES(?)').bind(now).run();fail('الإيميل أو كلمة السر غلط.',403)}
  if(a.s||a.ts)fail('الحساب ده موقوف.',403);await qday(db,a.team,now,'trainers');return json({token:await qsess(db,'user',a.id,a.team,now),email:e,team:{id:a.team,name:a.name}})}
 if(sub==='/me'&&m==='GET'){const T=await qteam(req,db,now,false);const t=await db.prepare('SELECT id,name FROM quiz_teams WHERE id=?').bind(T.team).first();return json({team:t,role:T.role})}
 if(sub==='/invite/info'&&m==='GET'){const i=await db.prepare('SELECT i.team,t.name FROM quiz_invites i JOIN quiz_teams t ON t.id=i.team WHERE i.hash=? AND i.used=0 AND i.expires>?').bind(await hash(u.searchParams.get('t')||'x'),now).first();if(!i)fail('اللينك ده انتهى أو اتستخدم.',404);return json({team:i.name})}
 if(sub==='/invite/accept'&&m==='POST'){const b=await qbody(req,2048);const h=await hash(String(b.token||'x'));const i=await db.prepare('SELECT team FROM quiz_invites WHERE hash=? AND used=0 AND expires>?').bind(h,now).first();if(!i)fail('اللينك ده انتهى أو اتستخدم.',404);
  const id=await qaccount(db,now,i.team,b.email,b.password);await db.prepare('UPDATE quiz_invites SET used=1 WHERE hash=?').bind(h).run();const t=await db.prepare('SELECT name FROM quiz_teams WHERE id=?').bind(i.team).first();await qday(db,i.team,now,'trainers');return json({token:await qsess(db,'user',id,i.team,now),email:qlogin(b.email),team:{id:i.team,name:t.name}},201)}
 if(sub==='/sys/setup'&&m==='POST'){const b=await qbody(req,2048);const e=qlogin(b.email);qpw(b.password);const salt=crypto.randomUUID();const r=await db.prepare('INSERT OR IGNORE INTO quiz_sys(id,email,salt,hash) VALUES(1,?,?,?)').bind(e,salt,await qpass(salt,b.password)).run();if(!r.meta.changes)fail('حساب الأدمن متحدد بالفعل.',409);return json({token:await qsess(db,'admin','sys','',now)},201)}
 if(sub==='/sys/login'&&m==='POST'){await qthrottle(db,now);const b=await qbody(req,2048);const row=await db.prepare('SELECT email,salt,hash FROM quiz_sys WHERE id=1').first();
  if(!row||row.email!==String(b.email||'').trim().toLowerCase()||await qpass(row.salt,typeof b.password==='string'?b.password:'')!==row.hash){await db.prepare('INSERT INTO quiz_attempts(ts) VALUES(?)').bind(now).run();fail('الإيميل أو كلمة السر غلط.',403)}
  return json({token:await qsess(db,'admin','sys','',now)})}
 if(sub.startsWith('/sys/')){await qsys(req,db,now);
  if(sub==='/sys/teams'&&m==='GET'){const r=await db.prepare('SELECT t.id,t.name,t.suspended,t.created,(SELECT count(*) FROM quiz_accounts a WHERE a.team=t.id) members,(SELECT a.email FROM quiz_accounts a WHERE a.team=t.id ORDER BY a.created LIMIT 1) login,(SELECT count(*) FROM quiz_library l WHERE l.team=t.id) quizzes,(SELECT count(*) FROM quiz_history h WHERE h.team=t.id) games FROM quiz_teams t ORDER BY t.created').all();return json({teams:r.results})}
  if(sub==='/sys/teams/create'&&m==='POST'){const b=await qbody(req,2048);const n=typeof b.name==='string'?b.name.trim():'';if(!n||n.length>60)fail('اسم الفريق لحد ٦٠ حرف.');const id=crypto.randomUUID().slice(0,12);if(b.email!==undefined&&b.email!==''){const e=qlogin(b.email);qpw(b.password);if(await db.prepare('SELECT 1 FROM quiz_accounts WHERE email=?').bind(e).first())fail('اليوزر أو الإيميل ده مستخدم بالفعل.',409);const salt=crypto.randomUUID();await db.batch([db.prepare('INSERT INTO quiz_teams(id,name,created) VALUES(?,?,?)').bind(id,n,now),db.prepare('INSERT INTO quiz_accounts(id,team,email,salt,hash,created) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),id,e,salt,await qpass(salt,b.password),now)]);return json({id,login:e},201)}await db.prepare('INSERT INTO quiz_teams(id,name,created) VALUES(?,?,?)').bind(id,n,now).run();return json({id},201)}
  if(sub==='/sys/teams/rename'&&m==='POST'){const b=await qbody(req,2048);const n=typeof b.name==='string'?b.name.trim():'';if(!n||n.length>60)fail('اسم الفريق لحد ٦٠ حرف.');const r=await db.prepare('UPDATE quiz_teams SET name=? WHERE id=?').bind(n,String(b.id||'')).run();if(!r.meta.changes)fail('الفريق مش موجود.',404);return json({ok:true})}
  if(sub==='/sys/teams/invite'&&m==='POST'){const b=await qbody(req,2048);const t=await db.prepare('SELECT 1 FROM quiz_teams WHERE id=?').bind(String(b.id||'')).first();if(!t)fail('الفريق مش موجود.',404);const token=crypto.randomUUID()+crypto.randomUUID();await db.prepare('DELETE FROM quiz_invites WHERE expires<?').bind(now).run();await db.prepare('INSERT INTO quiz_invites(hash,team,expires) VALUES(?,?,?)').bind(await hash(token),b.id,now+86400000).run();return json({token,expires:now+86400000},201)}
  if(sub==='/sys/teams/suspend'&&m==='POST'){const b=await qbody(req,2048);await db.prepare('UPDATE quiz_teams SET suspended=? WHERE id=?').bind(b.suspended?1:0,String(b.id||'')).run();return json({ok:true})}
  if(sub==='/sys/accounts'&&m==='GET'){const r=await db.prepare('SELECT id,email,suspended,created FROM quiz_accounts WHERE team=? ORDER BY created').bind(u.searchParams.get('team')||'').all();return json({accounts:r.results})}
  if(sub==='/sys/accounts/create'&&m==='POST'){const b=await qbody(req,2048);const id=await qaccount(db,now,String(b.team||''),b.email,b.password);return json({id},201)}
  if(sub==='/sys/accounts/reset'&&m==='POST'){const b=await qbody(req,2048);qpw(b.password);const salt=crypto.randomUUID();const r=await db.prepare('UPDATE quiz_accounts SET salt=?,hash=? WHERE id=?').bind(salt,await qpass(salt,b.password),String(b.id||'')).run();if(!r.meta.changes)fail('الحساب مش موجود.',404);await db.prepare('DELETE FROM quiz_sessions WHERE account=?').bind(b.id).run();return json({ok:true})}
  if(sub==='/sys/accounts/update'&&m==='POST'){const b=await qbody(req,2048);const e=qlogin(b.email);let r;try{r=await db.prepare('UPDATE quiz_accounts SET email=? WHERE id=?').bind(e,String(b.id||'')).run()}catch{fail('اليوزر أو الإيميل ده مستخدم بالفعل.',409)}if(!r.meta.changes)fail('الحساب مش موجود.',404);return json({ok:true,email:e})}
  if(sub==='/sys/accounts/delete'&&m==='POST'){const b=await qbody(req,2048);const id=String(b.id||'');await db.prepare('DELETE FROM quiz_sessions WHERE account=?').bind(id).run();const r=await db.prepare('DELETE FROM quiz_accounts WHERE id=?').bind(id).run();if(!r.meta.changes)fail('الحساب مش موجود.',404);return json({ok:true})}
  if(sub==='/sys/teams/delete'&&m==='POST'){const b=await qbody(req,2048);const id=String(b.id||'');const t=await db.prepare('SELECT name FROM quiz_teams WHERE id=?').bind(id).first();if(!t)fail('الفريق مش موجود.',404);if(String(b.name||'').trim()!==t.name)fail('اكتب اسم الفريق بالظبط للتأكيد.');const C='SELECT code FROM quiz_games WHERE team=?';await db.batch([db.prepare('DELETE FROM quiz_answers WHERE code IN ('+C+')').bind(id),db.prepare('DELETE FROM quiz_players WHERE code IN ('+C+')').bind(id),db.prepare('DELETE FROM quiz_avatars WHERE code IN ('+C+')').bind(id),db.prepare('DELETE FROM quiz_history WHERE team=?').bind(id),db.prepare('DELETE FROM quiz_games WHERE team=?').bind(id),db.prepare('DELETE FROM quiz_library WHERE team=?').bind(id),db.prepare('DELETE FROM quiz_invites WHERE team=?').bind(id),db.prepare('DELETE FROM quiz_sessions WHERE team=? AND role=?').bind(id,'user'),db.prepare('DELETE FROM quiz_accounts WHERE team=?').bind(id),db.prepare('DELETE FROM quiz_daily WHERE team=?').bind(id),db.prepare('DELETE FROM quiz_teams WHERE id=?').bind(id)]);return json({ok:true})}
  if(sub==='/sys/accounts/suspend'&&m==='POST'){const b=await qbody(req,2048);await db.prepare('UPDATE quiz_accounts SET suspended=? WHERE id=?').bind(b.suspended?1:0,String(b.id||'')).run();if(b.suspended)await db.prepare('DELETE FROM quiz_sessions WHERE account=?').bind(b.id).run();return json({ok:true})}
  if(sub==='/sys/stats'&&m==='GET'){const pl=await db.prepare("SELECT g.team,count(*) n FROM quiz_players p JOIN quiz_games g ON g.code=p.code WHERE g.state!='ended' AND g.expires>? AND p.joined>? GROUP BY g.team").bind(now,now-10800000).all();
   const tr=await db.prepare("SELECT team,count(*) n FROM quiz_sessions WHERE role='user' AND seen>? GROUP BY team").bind(now-300000).all();
   const tm=await db.prepare('SELECT id,name FROM quiz_teams ORDER BY created').all();const day=new Date(now-13*86400000).toISOString().slice(0,10);
   const dl=await db.prepare('SELECT day,sum(players) players,sum(trainers) trainers FROM quiz_daily WHERE day>=? GROUP BY day ORDER BY day').bind(day).all();
   const teams=tm.results.map(t=>({id:t.id,name:t.name,players:pl.results.find(x=>x.team===t.id)?.n||0,trainers:tr.results.find(x=>x.team===t.id)?.n||0}));
   return json({teams,players:teams.reduce((s,t)=>s+t.players,0),trainers:teams.reduce((s,t)=>s+t.trainers,0),daily:dl.results})}
  fail('الطلب غير مسموح.',405)}
 // ---- library (admin) ----
 if(sub==='/library'&&m==='GET'){const T=await qteam(req,db,now,m!=='GET');const r=await db.prepare('SELECT id,title,data,updated FROM quiz_library WHERE team=? ORDER BY updated DESC').bind(T.team).all();return json({quizzes:r.results.map(x=>{const d=JSON.parse(x.data);return {id:x.id,title:x.title,count:d.questions.length,types:[...new Set(d.questions.map(q=>q.type))],updated:x.updated}})})}
 let lm=sub.match(/^\/library\/([A-Za-z0-9-]{8,40})$/);
 if(lm&&m==='GET'){const T=await qteam(req,db,now,m!=='GET');const r=await db.prepare('SELECT id,data FROM quiz_library WHERE id=? AND team=?').bind(lm[1],T.team).first();if(!r)fail('الكويز مش موجود.',404);return json({id:r.id,quiz:JSON.parse(r.data)})}
 if(sub==='/library/save'&&m==='POST'){const T=await qteam(req,db,now,m!=='GET');const b=await qbody(req,70000);const quiz=qclean(b.quiz);let id=typeof b.id==='string'&&/^[A-Za-z0-9-]{8,40}$/.test(b.id)?b.id:null;
  if(id){const e=await db.prepare('SELECT 1 FROM quiz_library WHERE id=? AND team=?').bind(id,T.team).first();if(!e)id=null}
  if(!id){const n=await db.prepare('SELECT count(*) n FROM quiz_library WHERE team=?').bind(T.team).first();if(n.n>=100)fail('وصلت للحد الأقصى ١٠٠ كويز. امسح كويز قديم.',429);id=crypto.randomUUID()}
  await db.prepare('INSERT INTO quiz_library(id,title,data,updated,team) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,data=excluded.data,updated=excluded.updated WHERE quiz_library.team=excluded.team').bind(id,quiz.title,JSON.stringify(quiz),now,T.team).run();return json({id})}
 if(sub==='/library/delete'&&m==='POST'){const T=await qteam(req,db,now,m!=='GET');const b=await qbody(req,2048);if(typeof b.id!=='string')fail('الكويز غير صحيح.');await db.prepare('DELETE FROM quiz_library WHERE id=? AND team=?').bind(b.id,T.team).run();return json({ok:true})}
 // ---- games ----
 if(sub==='/history'&&m==='GET'){const T=await qteam(req,db,now,m!=='GET');const r=await db.prepare('SELECT code,title,ended,teams,players,top,cls FROM quiz_history WHERE team=? ORDER BY ended DESC LIMIT 500').bind(T.team).all();const n=await db.prepare('SELECT count(*) n FROM quiz_history WHERE team=?').bind(T.team).first();return json({games:r.results.map(x=>({...x,top:JSON.parse(x.top)})),total:n.n})}
 if(sub.startsWith('/history/')&&sub!=='/history/delete'&&m==='GET'){const T=await qteam(req,db,now,m!=='GET');const r=await db.prepare('SELECT data,ended,cls FROM quiz_history WHERE code=? AND team=?').bind(sub.slice(9),T.team).first();if(!r)fail('اللعبة مش موجودة في السجل.',404);return json({report:JSON.parse(r.data),ended:r.ended})}
 if(sub==='/history/delete'&&m==='POST'){const T=await qteam(req,db,now,m!=='GET');const b=await qbody(req,2048);if(typeof b.code!=='string')fail('الكود غير صحيح.');await db.prepare('DELETE FROM quiz_history WHERE code=? AND team=?').bind(b.code,T.team).run();return json({ok:true})}
 if(sub==='/game/create'&&m==='POST'){const T=await qteam(req,db,now,m!=='GET');const b=await qbody(req,2048);const r=await db.prepare('SELECT data FROM quiz_library WHERE id=? AND team=?').bind(String(b.quizId||''),T.team).first();if(!r)fail('الكويز مش موجود.',404);
  const cls=typeof b.cls==='string'?b.cls.trim().replace(/\s+/g,' '):'';if(!cls||cls.length>60)fail('اكتب اسم الفصل أو المجموعة (لحد ٦٠ حرف).');const teams=b.teams===undefined||b.teams===0?0:b.teams;if(!Number.isInteger(teams)||teams<0||teams===1||teams>6)fail('عدد الفرق من ٢ لـ ٦.');
  await db.batch(['DELETE FROM quiz_avatars WHERE code IN (SELECT code FROM quiz_games WHERE expires<?)','DELETE FROM quiz_answers WHERE code IN (SELECT code FROM quiz_games WHERE expires<?)','DELETE FROM quiz_players WHERE code IN (SELECT code FROM quiz_games WHERE expires<?)','DELETE FROM quiz_games WHERE expires<?'].map(s=>db.prepare(s).bind(now)));
  const token=crypto.randomUUID()+crypto.randomUUID(),th=await hash(token);let code,ok=false;
  for(let i=0;i<8&&!ok;i++){code=String(100000+crypto.getRandomValues(new Uint32Array(1))[0]%900000);const used=await db.prepare('SELECT 1 FROM sessions WHERE code=?').bind(code).first().catch(()=>null);if(used)continue;const x=await db.prepare("INSERT OR IGNORE INTO quiz_games(code,token,quiz,teams,state,qi,q_start,q_end,expires,team,cls) VALUES(?,?,?,?,'lobby',0,0,0,?,?,?)").bind(code,th,r.data,teams,now+3*86400000,T.team,cls).run();ok=!!x.meta.changes}
  if(!ok)fail('تعذّر إنشاء كود جديد. جرّب تاني.',503);return json({code,token},201)}
 const gm=sub.match(/^\/game\/(\d{6})(?:\/(state|join|answer|host|report))?$/);if(!gm)fail('الرابط مش موجود.',404);
 const code=gm[1],action=gm[2]||'state';
 const g=await db.prepare('SELECT * FROM quiz_games WHERE code=? AND expires>?').bind(code,now).first();if(!g)fail('الكود غير صحيح أو الكويز انتهى.',404);
 const quiz=JSON.parse(g.quiz),total=quiz.questions.length;
 const auth=req.headers.get('Authorization')||'';const isHost=auth.startsWith('Bearer ')&&await hash(auth.slice(7))===g.token;
 const client=async c=>{if(typeof c!=='string'||!c||c.length>100)fail('بيانات المتصفح غير صحيحة.');return hash(c)};
 if(action==='join'&&m==='POST'){const b=await qbody(req,2048);const c=await client(b.client);const name=typeof b.name==='string'?b.name.trim():'';if(!name||name.length>40)fail('اكتب اسمك لحد ٤٠ حرف.');
  const ex=await db.prepare('SELECT name,team FROM quiz_players WHERE code=? AND client=?').bind(code,c).first();if(ex)return json({ok:true,name:ex.name,team:ex.team});
  if(g.state==='ended')fail('الكويز خلص.',409);const cnt=await db.prepare('SELECT count(*) n FROM quiz_players WHERE code=?').bind(code).first();if(cnt.n>=200)fail('وصلنا للحد الأقصى ٢٠٠ مشارك.',429);
  let team=0;if(g.teams>0){const t=await db.prepare('SELECT team,count(*) n FROM quiz_players WHERE code=? GROUP BY team').bind(code).all();const sizes=Array.from({length:g.teams},(_,i)=>t.results.find(x=>x.team===i+1)?.n||0);team=sizes.indexOf(Math.min(...sizes))+1}
  const ins=await db.prepare('INSERT OR IGNORE INTO quiz_players(code,client,name,team,joined) VALUES(?,?,?,?,?)').bind(code,c,name,team,now).run();if(ins.meta.changes)await qday(db,g.team,now,'players');const av=Number.isInteger(b.avatar)&&b.avatar>=0&&b.avatar<8?b.avatar:-1;if(av>=0)await db.prepare('INSERT OR IGNORE INTO quiz_avatars(code,client,avatar) VALUES(?,?,?)').bind(code,c,av).run();return json({ok:true,name,team},201)}
 if(action==='answer'&&m==='POST'){const b=await qbody(req,2048);const c=await client(b.client);
  if(g.state!=='question'||b.qi!==g.qi)fail('السؤال ده مش مفتوح.',409);if(now>g.q_end+1500)fail('الوقت خلص.',409);
  const p=await db.prepare('SELECT 1 FROM quiz_players WHERE code=? AND client=?').bind(code,c).first();if(!p)fail('ادخل بالاسم الأول.',403);
  const q=quiz.questions[g.qi];let choice=null,text=null,ok=0,points=0;const ms=Math.max(0,now-g.q_start);
  if(q.type==='cloud'){let w=typeof b.text==='string'?b.text.trim().replace(/\s+/g,' ').toLowerCase():'';if(!w||w.length>30)fail('اكتب كلمة أو جملة قصيرة لحد ٣٠ حرف.');text=w}
  else{if(!Number.isInteger(b.choice)||b.choice<0||b.choice>=q.options.length)fail('اختيار غير صحيح.');choice=b.choice;ok=choice===q.correct?1:0;if(ok)points=Math.round(qP(q)*(1+0.5*(1-Math.min(1,ms/(q.time*1000))))*100)/100}
  const r=await db.prepare('INSERT OR IGNORE INTO quiz_answers(code,qi,client,choice,text,ms,points,ok) VALUES(?,?,?,?,?,?,?,?)').bind(code,g.qi,c,choice,text,ms,points,ok).run();
  if(!r.meta.changes)return json({ok:true,duplicate:true});
  if(points)await db.prepare('UPDATE quiz_players SET score=ROUND(score+?,2) WHERE code=? AND client=?').bind(points,code,c).run();
  const n=await db.prepare('SELECT (SELECT count(*) FROM quiz_answers WHERE code=? AND qi=?) a,(SELECT count(*) FROM quiz_players WHERE code=?) p').bind(code,g.qi,code).first();
  if(n.a>=n.p)await db.prepare("UPDATE quiz_games SET q_end=? WHERE code=? AND qi=? AND state='question' AND q_end>?").bind(now,code,g.qi,now).run();
  return json({ok:true},201)}
 if(action==='host'&&m==='POST'){if(!isHost)fail('شاشة المدرب دي مش متاحة من المتصفح الحالي.',403);const b=await qbody(req,2048);
  if(b.action==='start'){if(g.state!=='lobby')fail('الكويز بدأ بالفعل.',409);const n=await db.prepare('SELECT count(*) n FROM quiz_players WHERE code=?').bind(code).first();if(!n.n)fail('مفيش مشاركين لسه.',409);const q=quiz.questions[0];await db.prepare("UPDATE quiz_games SET state='question',qi=0,q_start=?,q_end=? WHERE code=?").bind(now,now+q.time*1000,code).run();return json({ok:true})}
  if(b.action==='reveal'){if(g.state!=='question')fail('مفيش سؤال مفتوح.',409);await db.prepare('UPDATE quiz_games SET q_end=? WHERE code=? AND q_end>?').bind(now,code,now).run();return json({ok:true})}
  if(b.action==='next'){if(g.state!=='question')fail('مفيش سؤال مفتوح.',409);if(b.qi!==g.qi)return json({ok:true,duplicate:true});if(g.qi+1>=total){await db.prepare("UPDATE quiz_games SET state='ended' WHERE code=?").bind(code).run();await qsave(db,code,g,quiz,now);return json({ok:true,ended:true})}const q=quiz.questions[g.qi+1];await db.prepare("UPDATE quiz_games SET qi=qi+1,q_start=?,q_end=? WHERE code=? AND qi=?").bind(now,now+q.time*1000,code,g.qi).run();return json({ok:true})}
  if(b.action==='end'){await db.prepare("UPDATE quiz_games SET state='ended' WHERE code=?").bind(code).run();await qsave(db,code,g,quiz,now);return json({ok:true})}
  fail('أمر غير صحيح.')}
 if(action==='report'&&m==='GET'){if(!isHost)fail('شاشة المدرب دي مش متاحة من المتصفح الحالي.',403);
  return json(await qreport(db,code,g,quiz))}
 // ---- state (players and host) ----
 if(action==='state'&&m==='GET'){
  const cl=u.searchParams.get('client')||'';const c=cl&&cl.length<100?await hash(cl):'';
  const out={code,title:quiz.title,teams:g.teams,state:g.state,qi:g.qi,total,serverNow:now,qStart:g.q_start,qEnd:g.q_end,isHost};
  const me=c?await db.prepare('SELECT name,team,score,(SELECT avatar FROM quiz_avatars a WHERE a.code=quiz_players.code AND a.client=quiz_players.client) av FROM quiz_players WHERE code=? AND client=?').bind(code,c).first():null;
  const cur=g.state==='question'?quiz.questions[g.qi]:null;const answering=!!cur&&now<g.q_end;out.phase=g.state==='lobby'?'lobby':g.state==='ended'?'ended':answering?'answering':'reveal';
  if(cur)out.q=qpublicQ(cur,isHost||!answering);
  if(me){out.me={name:me.name,team:me.team,score:me.score,av:me.av===null||me.av===undefined?-1:me.av};if(cur){const a=await db.prepare('SELECT choice,text,points,ok FROM quiz_answers WHERE code=? AND qi=? AND client=?').bind(code,g.qi,c).first();out.me.answered=!!a;if(a&&!answering){out.me.ok=!!a.ok;out.me.points=a.points}if(a&&answering&&cur.type==='cloud')out.me.text=a.text;if(a&&cur.type!=='cloud')out.me.choice=a.choice}}
  if(isHost||g.state==='lobby'){const cnt=await db.prepare('SELECT count(*) n FROM quiz_players WHERE code=?').bind(code).first();out.playerCount=cnt.n;if(g.state==='lobby'){const l=await db.prepare('SELECT name,team,(SELECT avatar FROM quiz_avatars a WHERE a.code=quiz_players.code AND a.client=quiz_players.client) av FROM quiz_players WHERE code=? ORDER BY joined DESC LIMIT 60').bind(code).all();out.players=l.results}}
  if(isHost&&answering){const a=await db.prepare('SELECT count(*) n FROM quiz_answers WHERE code=? AND qi=?').bind(code,g.qi).first();out.answered=a.n}
  if(g.state==='question'&&!answering||g.state==='ended'){
   const lb=await db.prepare('SELECT client,name,team,score,(SELECT avatar FROM quiz_avatars a WHERE a.code=quiz_players.code AND a.client=quiz_players.client) av FROM quiz_players WHERE code=? ORDER BY score DESC,joined').bind(code).all();let prev=null,rank=0;const rows=lb.results.map((p,i)=>{if(p.score!==prev)rank=i+1;prev=p.score;return {...p,rank}});
   out.leaderboard=rows.slice(0,g.state==='ended'?10:5).map(p=>({rank:p.rank,name:p.name,team:p.team,score:p.score,av:p.av===null||p.av===undefined?-1:p.av}));out.playerCount=rows.length;const mine=rows.find(p=>p.client===c);if(mine&&out.me)out.me.rank=mine.rank;
   if(g.teams>0){const tb=Array.from({length:g.teams},(_,i)=>{const mem=rows.filter(p=>p.team===i+1);return {team:i+1,members:mem.length,score:mem.length?Math.round(100*mem.reduce((s,p)=>s+p.score,0)/mem.length)/100:0}}).sort((a,b)=>b.score-a.score||a.team-b.team);out.teamBoard=tb;if(out.me)out.me.teamRank=tb.findIndex(x=>x.team===out.me.team)+1}
   if(cur){const a=await db.prepare('SELECT choice,text FROM quiz_answers WHERE code=? AND qi=?').bind(code,g.qi).all();out.answered=a.results.length;if(cur.type==='cloud'){const w={};for(const x of a.results)w[x.text]=(w[x.text]||0)+1;out.words=Object.entries(w).sort((x,y)=>y[1]-x[1]).slice(0,60).map(([word,n])=>({word,n}))}else out.counts=cur.options.map((_,k)=>a.results.filter(x=>x.choice===k).length)}}
  return json(out)}
 fail('الطلب غير مسموح.',405)}

const app = {
async fetch(req,env){try{
const u=new URL(req.url),path=u.pathname,now=Date.now();
if(path==='/qr'&&req.method==='GET'){const code=u.searchParams.get('code');if(!/^\d{6}$/.test(code||''))return json({error:'كود غير صحيح.'},400);const qr=qrcode(0,'M');qr.addData((u.searchParams.get('frontend')==='pages'?'https://omarnagycd.github.io/RoomPulse/join/':u.origin+'/join')+'?code='+code+'&lang='+(u.searchParams.get('lang')==='en'?'en':'ar'));qr.make();return new Response(qr.createSvgTag({cellSize:5,margin:20,scalable:true}),{headers:{'Content-Type':'image/svg+xml','Cache-Control':'public,max-age=300'}})}
if(!path.startsWith('/api/')){if(path!=='/'&&path!=='/join')return new Response('Not found',{status:404});return new Response(HTML,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'"}})}
if(!env.DB)fail('الخدمة قيد التجهيز. جرّب بعد قليل.',503);
const wm=path.match(/^\/api\/quiz\/game\/(\d{6})\/ws$/);
if(wm){if(!env.ROOM)fail('الخدمة قيد التجهيز.',503);const cl=u.searchParams.get('client')||'';if(!cl||cl.length>100)fail('بيانات المتصفح غير صحيحة.');const gx=await env.DB.prepare('SELECT 1 FROM quiz_games WHERE code=? AND expires>?').bind(wm[1],now).first();if(!gx)fail('الكود غير صحيح أو الكويز انتهى.',404);return await env.ROOM.get(env.ROOM.idFromName(wm[1])).fetch(new Request('https://room/ws?code='+wm[1]+'&c='+encodeURIComponent(cl),req))}
if(path.startsWith('/api/quiz/')){const qres=await qhandle(req,env,path,u,now);const nm=path.match(/^\/api\/quiz\/game\/(\d{6})\/(join|host|answer)$/);if(nm&&req.method==='POST'&&qres.ok)await qnotify(env,nm[1]);return qres}
if(req.method==='POST'&&path==='/api/sessions'){
const b=await body(req),title=clean(b.title,80),question=clean(b.question,300),mode=['text','ranking'].includes(b.mode)?b.mode:'poll',identity=b.identity==='named'?'named':'anonymous';
if(mode!=='text'&&(!Array.isArray(b.options)||![2,3].includes(b.options.length)))fail('مطلوب خيارين أو ٣ اختيارات.');const options=mode==='text'?[]:b.options.map(x=>clean(x,200));
let groupCode=null;if(mode==='ranking'&&b.rankingRound){const prior=b.rankingRound;if(typeof prior.code!=='string'||typeof prior.token!=='string'||prior.token.length>200)fail('جولة غير صحيحة.',403);const owner=await env.DB.prepare('SELECT s.token,r.group_code,g.ended,i.identity FROM sessions s JOIN ranking_sessions r ON r.code=s.code JOIN ranking_rounds g ON g.code=r.group_code JOIN session_identity i ON i.code=s.code WHERE s.code=? AND s.expires>?').bind(prior.code,now).first();if(!owner||owner.token!==await hash(prior.token))fail('الجولة دي مش متاحة من المتصفح الحالي.',403);if(owner.ended)fail('الجولة انتهت. ابدأ جولة جديدة.',409);if(owner.identity!==identity)fail('خلي وضع الأسماء ثابت في نفس الجولة.');groupCode=owner.group_code;const size=await env.DB.prepare('SELECT count(*) as n FROM ranking_sessions WHERE group_code=?').bind(groupCode).first();if(size.n>=50)fail('الجولة وصلت ٥٠ سؤال. ابدأ جولة جديدة.',409);}
const correct=mode==='ranking'&&b.hasCorrect===true?b.correctChoice:null;if(correct!==null&&(!Number.isInteger(correct)||correct<0||correct>=options.length))fail('اختار الإجابة الصحيحة من الاختيارات.');
const duration=b.durationSeconds??0;if(!Number.isInteger(duration)||duration<0||duration>86399)fail('اختار مدة صحيحة من ثانية لحد ٢٣ ساعة و٥٩ دقيقة و٥٩ ثانية، أو اقفل المؤقت.');
await env.DB.batch(schema.map(s=>env.DB.prepare(s)));
await env.DB.batch([env.DB.prepare('DELETE FROM ranking_rounds WHERE code NOT IN (SELECT group_code FROM ranking_sessions WHERE code IN (SELECT code FROM sessions WHERE expires >= ?))').bind(now),env.DB.prepare('DELETE FROM ranking_answers WHERE code IN (SELECT code FROM sessions WHERE expires < ?)').bind(now),env.DB.prepare('DELETE FROM ranking_sessions WHERE code IN (SELECT code FROM sessions WHERE expires < ?)').bind(now),env.DB.prepare('DELETE FROM session_timers WHERE code IN (SELECT code FROM sessions WHERE expires < ?)').bind(now),env.DB.prepare('DELETE FROM participant_names WHERE code IN (SELECT code FROM sessions WHERE expires < ?)').bind(now),env.DB.prepare('DELETE FROM session_identity WHERE code IN (SELECT code FROM sessions WHERE expires < ?)').bind(now),env.DB.prepare('DELETE FROM text_answers WHERE code IN (SELECT code FROM sessions WHERE expires < ?)').bind(now),env.DB.prepare('DELETE FROM session_modes WHERE code IN (SELECT code FROM sessions WHERE expires < ?)').bind(now),env.DB.prepare('DELETE FROM votes WHERE code IN (SELECT code FROM sessions WHERE expires < ?)').bind(now),env.DB.prepare('DELETE FROM sessions WHERE expires < ?').bind(now)]);
const count=await env.DB.prepare('SELECT count(*) as n FROM sessions').first();if(count.n>=1000)fail('وصلنا للحد التجريبي اليومي. جرّب لاحقاً.',429);
if(groupCode)await env.DB.prepare('UPDATE sessions SET open=0 WHERE code IN (SELECT code FROM ranking_sessions WHERE group_code=?)').bind(groupCode).run();
const token=crypto.randomUUID()+crypto.randomUUID(),tokenHash=await hash(token);let code,ok=false;
for(let i=0;i<5;i++){code=String(100000+crypto.getRandomValues(new Uint32Array(1))[0]%900000);const r=await env.DB.prepare('INSERT OR IGNORE INTO sessions(code,token,title,question,options,expires) VALUES(?,?,?,?,?,?)').bind(code,tokenHash,title,question,JSON.stringify(options),now+86400000).run();if(r.meta.changes){ok=true;break}}
if(!ok)fail('تعذّر إنشاء كود جديد. جرّب تاني.',503);await env.DB.prepare('INSERT INTO session_modes(code,mode) VALUES(?,?)').bind(code,mode).run();await env.DB.prepare('INSERT INTO session_identity(code,identity) VALUES(?,?)').bind(code,identity).run();if(mode==='ranking'){groupCode=groupCode||code;await env.DB.batch([env.DB.prepare('INSERT OR IGNORE INTO ranking_rounds(code) VALUES(?)').bind(groupCode),env.DB.prepare('INSERT INTO ranking_sessions(code,started,correct,group_code) VALUES(?,?,?,?)').bind(code,now,correct,groupCode)]);}if(duration)await env.DB.prepare('INSERT INTO session_timers(code,duration,ends_at) VALUES(?,?,?)').bind(code,duration,Date.now()+duration*1000).run();return json({code,token},201)}
const m=path.match(/^\/api\/sessions\/(\d{6})(?:\/(results|vote|status|finish))?$/);if(!m)fail('الرابط مش موجود.',404);const code=m[1],action=m[2];
let s;try{s=await env.DB.prepare('SELECT * FROM sessions WHERE code=? AND expires>?').bind(code,now).first()}catch{fail('مفيش سيشن بالكود ده. اتأكد من الكود.',404)}
if(!s)fail('الكود غير صحيح أو السيشن انتهى. اتأكد من المدرب.',404);
const row=await env.DB.prepare('SELECT mode FROM session_modes WHERE code=?').bind(code).first();const mode=row?.mode||'poll';const ident=await env.DB.prepare('SELECT identity FROM session_identity WHERE code=?').bind(code).first();const identity=ident?.identity||'anonymous';let clock=null;try{clock=await env.DB.prepare('SELECT duration,ends_at FROM session_timers WHERE code=?').bind(code).first()}catch(e){if(!String(e.message).includes('no such table'))throw e}const timeUp=!!clock&&now>=clock.ends_at;if(timeUp)s.open=0;const options=JSON.parse(s.options),base={code,mode,identity,title:s.title,question:s.question,options,open:!!s.open,expires:s.expires,durationSeconds:clock?.duration||0,endsAt:clock?.ends_at||null,serverNow:now,timeUp};
const ranking=mode==='ranking'?await env.DB.prepare('SELECT r.started,r.correct,r.group_code,g.ended FROM ranking_sessions r JOIN ranking_rounds g ON g.code=r.group_code WHERE r.code=?').bind(code).first():null;if(ranking){base.hasCorrect=ranking.correct!==null;if(ranking.ended){s.open=0;base.open=false;}base.roundEnded=!!ranking.ended;}
if(!action&&req.method==='GET'){const c=u.searchParams.get('client')||'';let voted=false;if(c&&c.length<100){const v=await env.DB.prepare(mode==='ranking'?'SELECT 1 FROM ranking_answers WHERE code=? AND client=?':mode==='text'?'SELECT 1 FROM text_answers WHERE code=? AND client=?':'SELECT 1 FROM votes WHERE code=? AND client=?').bind(code,await hash(c)).first();voted=!!v}return json({...base,voted})}
if(action==='vote'&&req.method==='POST'){
if(timeUp)fail('الوقت خلص. استقبال الردود اتقفل تلقائياً.',409);const b=await body(req);if(identity==='named'){if(typeof b.client!=='string'||!b.client||b.client.length>100)fail('بيانات المتصفح غير صحيحة.');if(typeof b.name!=='string'||!b.name.trim()||b.name.length>200)fail('اكتب الاسم اللي تحب تظهر بيه، لحد ٢٠٠ حرف.');const name=b.name;if(!s.open)fail('المدرب قفل استقبال الردود.',409);await env.DB.prepare('INSERT OR IGNORE INTO participant_names(code,client,name) VALUES(?,?,?)').bind(code,await hash(b.client),name).run()}if(mode==='text'){if(typeof b.client!=='string'||!b.client||b.client.length>100)fail('بيانات المتصفح غير صحيحة.');const answer=clean(b.answer,500),c=await hash(b.client);const existing=await env.DB.prepare('SELECT 1 FROM text_answers WHERE code=? AND client=?').bind(code,c).first();if(existing)return json({ok:true,duplicate:true});if(!s.open)fail('المدرب قفل الردود.',409);const r=await env.DB.prepare('INSERT OR IGNORE INTO text_answers(code,client,answer,created) SELECT ?,?,?,? WHERE EXISTS (SELECT 1 FROM sessions WHERE code=? AND open=1 AND expires>?) AND NOT EXISTS (SELECT 1 FROM session_timers WHERE code=? AND ends_at<=CAST((julianday(\'now\')-2440587.5)*86400000 AS INTEGER)) AND (SELECT count(*) FROM text_answers WHERE code=?)<5000').bind(code,c,answer,now,code,now,code,code).run();if(!r.meta.changes)fail('استقبال الردود مقفول أو وصل للحد التجريبي.',409);return json({ok:true},201)}if(typeof b.client!=='string'||!b.client||b.client.length>100||!Number.isInteger(b.choice)||b.choice<0||b.choice>=options.length)fail('اختار إجابة صحيحة.');
if(mode==='ranking'){
const c=await hash(b.client);const existing=await env.DB.prepare('SELECT 1 FROM ranking_answers WHERE code=? AND client=?').bind(code,c).first();if(existing)return json({ok:true,duplicate:true});if(!s.open)fail('المدرب قفل استقبال الردود.',409);
const r=await env.DB.prepare("INSERT OR IGNORE INTO ranking_answers(code,client,choice,received) SELECT ?,?,?,CAST((julianday('now')-2440587.5)*86400000 AS INTEGER) WHERE EXISTS (SELECT 1 FROM sessions WHERE code=? AND open=1 AND expires>?) AND NOT EXISTS (SELECT 1 FROM session_timers WHERE code=? AND ends_at<=CAST((julianday('now')-2440587.5)*86400000 AS INTEGER)) AND (SELECT count(*) FROM ranking_answers WHERE code=?)<5000").bind(code,c,b.choice,code,now,code,code).run();if(!r.meta.changes)fail('استقبال الردود مقفول أو وصل للحد التجريبي.',409);return json({ok:true},201)}
const c=await hash(b.client);const existing=await env.DB.prepare('SELECT 1 FROM votes WHERE code=? AND client=?').bind(code,c).first();if(existing)return json({ok:true,duplicate:true});if(!s.open)fail('المدرب قفل التصويت.',409);
const r=await env.DB.prepare('INSERT OR IGNORE INTO votes(code,client,choice) SELECT ?,?,? WHERE EXISTS (SELECT 1 FROM sessions WHERE code=? AND open=1 AND expires>?) AND NOT EXISTS (SELECT 1 FROM session_timers WHERE code=? AND ends_at<=CAST((julianday(\'now\')-2440587.5)*86400000 AS INTEGER)) AND (SELECT count(*) FROM votes WHERE code=?) < 5000').bind(code,c,b.choice,code,now,code,code).run();if(!r.meta.changes)fail('التصويت مقفول أو وصل للحد التجريبي.',409);return json({ok:true},201)}
if(action==='results'||action==='status'||action==='finish'){
const auth=req.headers.get('Authorization')||'';if(!auth.startsWith('Bearer ')||await hash(auth.slice(7))!==s.token)fail('شاشة المدرب دي مش متاحة من المتصفح الحالي.',403);
if(action==='finish'&&req.method==='POST'&&ranking){await env.DB.batch([env.DB.prepare('UPDATE ranking_rounds SET ended=1 WHERE code=?').bind(ranking.group_code),env.DB.prepare('UPDATE sessions SET open=0 WHERE code IN (SELECT code FROM ranking_sessions WHERE group_code=?)').bind(ranking.group_code)]);return json({ok:true})}
if(action==='status'&&req.method==='POST'){const b=await body(req);if(typeof b.open!=='boolean')fail('حالة التصويت غير صحيحة.');if(b.open&&ranking?.ended)fail('الجولة انتهت. ابدأ جولة جديدة.',409);if(b.open&&timeUp)fail('الوقت خلص. ابدأ سيشن جديد لو عايز تكمل.',409);await env.DB.prepare('UPDATE sessions SET open=? WHERE code=?').bind(b.open?1:0,code).run();return json({ok:true})}
if(action==='results'&&req.method==='GET'){if(mode==='ranking'){
const all=await env.DB.prepare('SELECT a.id,a.client,a.choice,a.received,n.name FROM ranking_answers a LEFT JOIN participant_names n ON n.code=a.code AND n.client=a.client WHERE a.code=? ORDER BY a.received,a.id').bind(code).all();
const ids=await env.DB.prepare('SELECT a.client,MIN(a.id) AS first_id FROM ranking_answers a JOIN ranking_sessions r ON r.code=a.code WHERE r.group_code=? GROUP BY a.client ORDER BY first_id').bind(ranking.group_code).all();const counts=options.map((_,i)=>all.results.filter(a=>a.choice===i).length);const eligible=all.results.filter(a=>ranking.correct===null||a.choice===ranking.correct);let previous=null,rank=0;
const leaderboard=s.open?[]:eligible.map((a,i)=>{const elapsed=Math.max(0,a.received-ranking.started);if(elapsed!==previous)rank=i+1;previous=elapsed;return {rank,participant:ids.results.findIndex(x=>x.client===a.client)+1,...(identity==='named'?{name:a.name||''}:{}),choice:a.choice,elapsedMs:elapsed,points:Math.max(1,Math.floor(1000/rank))}});
const roundLeaderboard=ranking.ended?await roundScores(env.DB,ranking.group_code,identity):[];return json({...base,roundLeaderboard,counts,total:all.results.length,rankingReady:!s.open,correctChoice:ranking.correct,eligibleTotal:s.open?null:eligible.length,leaderboard})}
if(mode==='text'){const a=await env.DB.prepare(identity==='named'?'SELECT a.id,a.answer,a.created,n.name FROM text_answers a LEFT JOIN participant_names n ON n.code=a.code AND n.client=a.client WHERE a.code=? ORDER BY a.id DESC':'SELECT id,answer,created FROM text_answers WHERE code=? ORDER BY id DESC').bind(code).all();return json({...base,answers:a.results,total:a.results.length})}const r=await env.DB.prepare('SELECT choice,count(*) as n FROM votes WHERE code=? GROUP BY choice').bind(code).all();const counts=options.map((_,i)=>r.results.find(x=>x.choice===i)?.n||0);let respondents=[];if(identity==='named'){const n=await env.DB.prepare('SELECT n.name,v.choice FROM votes v JOIN participant_names n ON n.code=v.code AND n.client=v.client WHERE v.code=? ORDER BY v.rowid DESC').bind(code).all();respondents=n.results}return json({...base,counts,total:counts.reduce((a,b)=>a+b,0),...(identity==='named'?{respondents}:{})})}}
return json({error:'الطلب غير مسموح.'},405);
}catch(e){return json({error:e.status?e.message:'تعذّر الاتصال بالخدمة. جرّب تاني بعد قليل.'},e.status||503)}}
};


// CORS is browser read permission, not authentication. Existing trainer-token checks remain required.
const PAGES_ORIGIN = 'https://omarnagycd.github.io';
// Live push hub for one quiz game (Durable Object, free plan, SQLite-backed, hibernating WebSockets).
async function qnotify(env,code){try{if(env.ROOM)await env.ROOM.get(env.ROOM.idFromName(code)).fetch('https://room/notify?code='+code)}catch{}}
export class QuizRoom{
 constructor(state,env){this.s=state;this.env=env;try{state.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping','pong'))}catch{}}
 async fetch(req){const u=new URL(req.url),code=u.searchParams.get('code')||'';
  if(!/^\d{6}$/.test(code))return new Response('bad',{status:400});
  if(u.pathname==='/ws'){
   if(req.headers.get('Upgrade')!=='websocket')return new Response('expected websocket',{status:426});
   if(this.s.getWebSockets().length>=400)return new Response('full',{status:429});
   const pair=new WebSocketPair(),[c,s]=Object.values(pair);const raw=u.searchParams.get('c')||'',cl=raw?await hash(raw):'',att={c:cl,raw,code};
   this.s.acceptWebSocket(s);s.serializeAttachment(att);
   try{await this.sendTo(s,att)}catch{}
   return new Response(null,{status:101,webSocket:c})}
  if(u.pathname==='/notify'){await this.later(700);return new Response('ok')}
  return new Response('not found',{status:404})}
 async later(ms){const at=Date.now()+ms,cur=await this.s.storage.getAlarm();if(cur===null||cur>at)await this.s.storage.setAlarm(at)}
 async sendTo(ws,att){const d=await qpush(this.env.DB,att.code,Date.now());if(!d){ws.send(JSON.stringify({t:'gone'}));return}
  ws.send(JSON.stringify({t:'s',s:{...d.pub,me:d.me[att.c]||null}}));return d}
 async alarm(){const socks=this.s.getWebSockets();if(!socks.length)return;
  const first=socks[0].deserializeAttachment();const d=await qpush(this.env.DB,first.code,Date.now());
  if(!d){for(const w of socks){try{w.send(JSON.stringify({t:'gone'}))}catch{}}return}
  for(const w of socks){try{const a=w.deserializeAttachment()||{};w.send(JSON.stringify({t:'s',s:{...d.pub,me:d.me[a.c]||null}}))}catch{}}
  if(d.answering)await this.s.storage.setAlarm(Math.max(Date.now()+300,d.g.q_end+60))}
 async webSocketMessage(ws,msg){let b;try{b=JSON.parse(typeof msg==='string'?msg:'')}catch{return}
  const a=ws.deserializeAttachment()||{};
  if(b&&b.t==='a'){const now=Date.now(),path='/api/quiz/game/'+a.code+'/answer';
   try{const r=await qhandle(new Request('https://room'+path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...b.body,client:a.raw,qi:b.qi})}),this.env,path,new URL('https://room'+path),now);const j=await r.json().catch(()=>({}));ws.send(JSON.stringify({t:'ack',ok:r.ok,err:r.ok?undefined:(j.error||'')}))}catch(e){ws.send(JSON.stringify({t:'ack',ok:false,err:'error'}))}
   await this.later(900);return}
  if(b&&b.t==='r'){await this.sendTo(ws,a)}}
 async webSocketClose(ws){try{ws.close()}catch{}}
 async webSocketError(ws){try{ws.close()}catch{}}
}
export default {
 async fetch(req,env,ctx) {
  const url=new URL(req.url),origin=req.headers.get('Origin');
  const apiRoute=url.pathname.startsWith('/api/');
  const allowed=origin===PAGES_ORIGIN;
  if(apiRoute && req.method==='OPTIONS'){
   if(!allowed)return new Response(null,{status:403,headers:{'Vary':'Origin'}});
   const method=req.headers.get('Access-Control-Request-Method');
   const headers=(req.headers.get('Access-Control-Request-Headers')||'').toLowerCase().split(',').map(s=>s.trim()).filter(Boolean);
   if(!['GET','POST'].includes(method)||headers.some(h=>!['authorization','content-type'].includes(h)))return new Response(null,{status:403,headers:{'Vary':'Origin'}});
   return new Response(null,{status:204,headers:{'Access-Control-Allow-Origin':PAGES_ORIGIN,'Access-Control-Allow-Methods':'GET, POST','Access-Control-Allow-Headers':'Content-Type, Authorization','Access-Control-Max-Age':'600','Vary':'Origin'}});
  }
  const response=await app.fetch(req,env,ctx);
  if(response.status===101)return response;
  if(!apiRoute||!allowed)return response;
  const out=new Response(response.body,response);out.headers.set('Access-Control-Allow-Origin',PAGES_ORIGIN);out.headers.set('Vary','Origin');return out;
 }
};
