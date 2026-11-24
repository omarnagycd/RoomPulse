const B=process.env.B||'http://localhost:8799/api/quiz';
const call=async(p,body,tok,method)=>{const r=await fetch(B+p,{method:method||(body?'POST':'GET'),headers:{'Content-Type':'application/json',...(tok?{Authorization:'Bearer '+tok}:{})},body:body?JSON.stringify(body):undefined});const d=await r.json();return {s:r.status,d}};
const ok=(c,m)=>{if(!c){console.log('FAIL',m);process.exitCode=1}else console.log('ok',m)};
let r=await call('/admin/status');ok(r.d.configured===false,'not configured');
r=await call('/admin/setup',{passcode:'12'});ok(r.s===400,'short passcode rejected');
r=await call('/library');ok(r.s===401,'library needs auth');
r=await call('/admin/setup',{passcode:'omar2026'});ok(r.s===201&&r.d.token,'setup');const T=r.d.token;
r=await call('/admin/setup',{passcode:'other'});ok(r.s===409,'setup only once');
r=await call('/admin/login',{passcode:'bad'});ok(r.s===403,'bad login');
r=await call('/admin/login',{passcode:'omar2026'});ok(r.s===200,'login');
const quiz={title:'تجربة',questions:[
 {type:'mc',text:'عميل غضبان؟',options:['اسمعه','قاطعه','حوله'],correct:0,time:20,points:10},
 {type:'spot',text:'فين الغلطة؟',options:['أهلا','مش مشكلتي'],correct:1,time:10,points:10},
 {type:'cloud',text:'كلمة؟',time:10}]};
r=await call('/library/save',{quiz:{title:'x',questions:[{type:'mc',text:'q',options:['a','b'],correct:0,time:10,points:0}]}},T);ok(r.s===400,'points 0 rejected');r=await call('/library/save',{quiz:{title:'x',questions:[]}},T);ok(r.s===400,'invalid quiz');
r=await call('/library/save',{quiz},T);ok(r.s===200&&r.d.id,'save');const id=r.d.id;
r=await call('/library',null,T);ok(r.d.quizzes.length===1&&r.d.quizzes[0].count===3,'list');
r=await call('/library/'+id,null,T);ok(r.d.quiz.questions[2].type==='cloud','get');
r=await call('/library/save',{id,quiz:{...quiz,title:'معدل'}},T);ok(r.d.id===id,'update');
r=await call('/game/create',{quizId:id,teams:2},T);ok(r.s===201,'create game');const code=r.d.code,H=r.d.token;
const P=['a','b','c'].map(x=>'client-'+x);
for(const [i,c] of P.entries()){r=await call('/game/'+code+'/join',{client:c,name:'P'+i});ok(r.s===201&&r.d.team===(i%2)+1,'join team '+r.d.team)}
r=await call('/game/'+code+'/state?client='+P[0]);ok(r.d.phase==='lobby'&&r.d.playerCount===3,'lobby');
r=await call('/game/'+code+'/host',{action:'start'},H);ok(r.s===200,'start');
r=await call('/game/'+code+'/state?client='+P[0]);ok(r.d.phase==='answering'&&!('correct' in r.d.q),'q1 hidden correct');
r=await call('/game/'+code+'/state',null,H);ok(r.d.q.correct===0&&r.d.answered===0,'host sees correct');
r=await call('/game/'+code+'/answer',{client:P[0],qi:0,choice:0});ok(r.s===201,'answer');
r=await call('/game/'+code+'/answer',{client:P[0],qi:0,choice:1});ok(r.d.duplicate,'dup');
await call('/game/'+code+'/answer',{client:P[1],qi:0,choice:1});
await new Promise(z=>setTimeout(z,1200));
r=await call('/game/'+code+'/answer',{client:P[2],qi:0,choice:0});
r=await call('/game/'+code+'/state?client='+P[0]);ok(r.d.phase==='reveal'&&r.d.counts.join()==='2,1,0'&&r.d.me.ok===true&&r.d.me.points>=10&&r.d.me.points<=15&&r.d.leaderboard.length===3&&r.d.teamBoard.length===2,'reveal '+JSON.stringify(r.d.me));
{const s0=(await call('/game/'+code+'/state?client='+P[0])).d,s2=(await call('/game/'+code+'/state?client='+P[2])).d,s1=(await call('/game/'+code+'/state?client='+P[1])).d;
 console.log('scores fast/slow/wrong:',s0.me.points,s2.me.points,s1.me.points);
 ok(s0.me.points>s2.me.points,'faster correct answer scores higher ('+s0.me.points+' > '+s2.me.points+')');
 ok(s1.me.points===undefined||s1.me.points===0,'wrong answer scores 0');
 ok(Math.round(s0.me.points*100)===s0.me.points*100||Math.abs(s0.me.points*100-Math.round(s0.me.points*100))<1e-6,'max 2 decimals');}
r=await call('/game/'+code+'/host',{action:'next',qi:0},H);ok(r.s===200,'next');
r=await call('/game/'+code+'/answer',{client:P[1],qi:1,choice:1});
r=await call('/game/'+code+'/host',{action:'reveal'},H);
r=await call('/game/'+code+'/host',{action:'next',qi:1},H);
for(const [i,c] of P.entries())await call('/game/'+code+'/answer',{client:c,qi:2,text:i<2?' صبر ':'Patience'});
r=await call('/game/'+code+'/state?client='+P[0]);ok(r.d.words[0].word==='صبر'&&r.d.words[0].n===2,'cloud words');
r=await call('/game/'+code+'/host',{action:'next',qi:2},H);ok(r.d.ended,'ended');
r=await call('/game/'+code+'/state?client='+P[1]);ok(r.d.phase==='ended'&&r.d.me.rank>=1,'final');
r=await call('/game/'+code+'/report',null,H);ok(r.d.questions[0].pct===67&&r.d.questions[0].wrong[0].name==='P1','report');
r=await call('/game/'+code+'/report');ok(r.s===403,'report needs host');
r=await call('/game/'+code+'/host',{action:'start'});ok(r.s===403,'host needs token');
r=await call('/library/delete',{id},T);r=await call('/library',null,T);ok(r.d.quizzes.length===0,'delete');
r=await call('/game/'+code+'/state?client='+P[0]);ok(r.s===200,'game survives quiz delete (snapshot)');
{const q2={title:'legacy',questions:[{type:'mc',text:'q',options:['a','b'],correct:0,time:10,points:1000}]};r=await call('/library/save',{quiz:q2},T);ok(r.s===200,'legacy 1000 accepted');const i2=r.d.id;r=await call('/game/create',{quizId:i2},T);const c2=r.d.code,H2=r.d.token;await call('/game/'+c2+'/join',{client:'lg1',name:'L'});await call('/game/'+c2+'/host',{action:'start'},H2);await call('/game/'+c2+'/answer',{client:'lg1',qi:0,choice:0});await call('/game/'+c2+'/host',{action:'reveal'},H2);r=await call('/game/'+c2+'/state?client=lg1');console.log('legacy points',r.d.me.points);ok(r.d.me.points>=1&&r.d.me.points<=1.5,'legacy >100 falls back to 1 ('+r.d.me.points+')');
r=await call('/library/save',{quiz:{title:'x',questions:[{type:'mc',text:'q',options:['a','b'],correct:0,time:10,points:50.5}]}},T);ok(r.s===400,'fraction rejected');
r=await call('/library/save',{quiz:{title:'d',questions:[{type:'mc',text:'q',options:['a','b'],correct:0,time:10}]}},T);ok(r.s===200,'default ok');}
r=await call('/admin/change',{passcode:'omar2026',newPasscode:'new1234'});ok(r.s===200,'change passcode');
r=await call('/library',null,T);ok(r.s===401,'old token revoked');
// existing endpoints still work
const e=await fetch(B.replace('/quiz','')+'/sessions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:'t',question:'q',options:['a','b'],mode:'poll'})});ok(e.status===201,'existing sessions API still works');
