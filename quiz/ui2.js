/* ===== QUIZ UI2: header, home, avatars sprite, validation toast ===== */
Object.assign(EN,{"اعمل كويز":"Create a quiz","ابدأ لعبة مباشرة":"Host a live game","ادخل بكود":"Join with a code","آخر الكويزات":"Recent quizzes","إحصائيات سريعة":"Quick stats","ألعاب اتعملت":"Games hosted","إجمالي المشاركين":"Total participants","متوسط اللاعبين في اللعبة":"Avg players per game","كويزات محفوظة":"Saved quizzes","اعمل كويز الأول":"Create a quiz first","اكتب اسم الكويز":"Write the quiz name","أضف سؤال واحد":"Add one question","في سؤال من غير نص":"A question has no text","في اختيار فاضي":"An option is empty"});
/* avatar sprite */
document.body.insertAdjacentHTML('beforeend','<svg width="0" height="0" style="position:absolute" aria-hidden="true">'+QAV_SYMBOLS+'</svg>');
/* header: shrink on scroll (hysteresis, one class toggle) */
{const h=document.querySelector('header');let s=false,tk=false;const f=()=>{tk=false;const y=window.scrollY||0;if(!s&&y>90){s=true;h.classList.add('hdr-s')}else if(s&&y<24){s=false;h.classList.remove('hdr-s')}};
addEventListener('scroll',()=>{if(!tk){tk=true;requestAnimationFrame(f)}},{passive:true})}
/* validation notice */
{const M={'اكتب اسم الكويز.':'اكتب اسم الكويز','أضف سؤال واحد على الأقل.':'أضف سؤال واحد','اكتب نص كل سؤال.':'في سؤال من غير نص','كمّل اختيارات كل سؤال.':'في اختيار فاضي'};
const _qe=qerr;qerr=function(e){if(role==='quiz'&&Q.view==='edit'&&e&&e.message){for(const k in M){if(e.message===t(k)){$('globalError').textContent='';qtoast(t(M[k]));return}}}_qe(e)}}
/* home decoration on the quiz library */
const QH_ICON={mc:'<path d="M4 6h16M4 12h16M4 18h16"/>',spot:'<circle cx="11" cy="11" r="6.5"/><path d="M16 16l5 5"/>',cloud:'<path d="M7 18a4 4 0 010-8 5 5 0 019.5-1A3.5 3.5 0 0117 18z"/>'};
const qsvg=(p,c)=>'<svg class="'+(c||'')+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+p+'</svg>';
let qstat=null,qstatAt=0;
function qhome(){const r=$('quizRoot');if(!r||r.querySelector('.qhero'))return;
 const hero='<div class="qhero" role="img" aria-label="RoomPulse"></div><div class="qbtns"><button type="button" class="qbt w" id="qh1"><span class="qbi">'+qsvg('<path d="M12 5v14M5 12h14"/>')+'</span><b>'+t('اعمل كويز')+'</b></button><button type="button" class="qbt r" id="qh2"><span class="qbi">'+qsvg('<path d="M7 4l13 8-13 8z"/>')+'</span><b>'+t('ابدأ لعبة مباشرة')+'</b></button><button type="button" class="qbt d" id="qh3"><span class="qbi">'+qsvg('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-4 3-6 6.5-6s6.5 2 6.5 6M17 11l4 3-4 3"/>')+'</span><b>'+t('ادخل بكود')+'</b></button></div>';
 const first=r.firstChild;r.insertAdjacentHTML('afterbegin',hero);
 $('qh1').onclick=()=>{const b=$('qnew');if(b)b.click()};
 $('qh2').onclick=()=>{if($('qresume')){$('qresume').click();return}const b=r.querySelector('#qlist [data-a=run]');if(b)b.click();else qtoast(t('اعمل كويز الأول'))};
 $('qh3').onclick=()=>{location.href=joinPath+(lang?'?lang='+lang:'')};
 r.querySelectorAll('#qlist .qitem').forEach((el,i)=>{const x=Q.lib[i];if(!x)return;const ty=x.types&&x.types.length===1?x.types[0]:'mc';el.insertAdjacentHTML('afterbegin','<span class="qtile">'+qsvg(QH_ICON[ty]||QH_ICON.mc)+'</span>')});
 const box=document.createElement('div');box.id='qstats';r.appendChild(box);qstatsRender();
 if(Date.now()-qstatAt>60000||!qstat){qstatAt=Date.now();qapi('/history',null,Q.tok).then(d=>{qstat=d;qstatsRender()}).catch(()=>{})}}
function qstatsRender(){const b=$('qstats');if(!b)return;const g=qstat&&qstat.games||[];const total=qstat?(qstat.total!=null?qstat.total:g.length):0;const ppl=g.reduce((a,x)=>a+(x.players||0),0);
 const cells=[['game',total,'ألعاب اتعملت'],['ppl',ppl,'إجمالي المشاركين'],['chk',g.length?Math.round(ppl/g.length):0,'متوسط اللاعبين في اللعبة'],['cup',Q.lib.length,'كويزات محفوظة']];
 const IC={game:'<rect x="3" y="7" width="18" height="11" rx="5"/><path d="M8 10v5M5.5 12.5h5"/>',ppl:'<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-4 3-6 6.5-6s6.5 2 6.5 6M16 5a3.5 3.5 0 010 7M18 14c2.5.6 3.5 2.6 3.5 6"/>',chk:'<rect x="4" y="12" width="4" height="8" rx="1"/><rect x="10" y="5" width="4" height="15" rx="1"/><rect x="16" y="9" width="4" height="11" rx="1"/>',cup:'<path d="M7 4h10v5a5 5 0 01-10 0zM7 6H3c0 3 1.5 4 4 4M17 6h4c0 3-1.5 4-4 4M12 14v4M8 20h8"/>'};
 b.innerHTML='<h3>'+t('إحصائيات سريعة')+'</h3><div class="qstats">'+cells.map(c=>'<div class="qsc"><span class="qsi">'+qsvg(IC[c[0]])+'</span><div><b>'+c[1]+'</b><small>'+t(c[2])+'</small></div></div>').join('')+'</div>'}
{const _qr2=qrender;qrender=function(){_qr2();if(role==='quiz'&&Q.view==='lib')qhome()}}
