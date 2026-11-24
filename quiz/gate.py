import json as _j
def apply(h):
    EN={"الأنشطة للأدمن والفرق بس":"Activities are for Admins and Teams only","سجّل دخول بحساب الأدمن أو الفريق عشان تجهّز أنشطة وتشوف الردود.":"Sign in as Admin or Team to set up activities and see responses.","سجّل دخول":"Sign in"}
    css='''.wheel-layout{display:flex!important;flex-direction:column-reverse!important;gap:18px!important;max-width:620px;margin-inline:auto}.wheel-layout>*{width:100%!important;max-width:none!important}
body.rp-out #welcome .welcome-grid>div:first-child .rp-in{display:none}body:not(.rp-out) #welcome .rp-gate{display:none}
body.rp-out #welcome .welcome-grid>div:first-child>.eyebrow:not(.rp-gate),body.rp-out #welcome .welcome-grid>div:first-child>h2:not(.rp-gate),body.rp-out #welcome .welcome-grid>div:first-child>p:not(.rp-gate),body.rp-out #welcome .welcome-grid>div:first-child>.actions:not(.rp-gate){display:none}'''
    js='''Object.assign(EN,'''+_j.dumps(EN,ensure_ascii=False)+''');
(function(){const signedIn=()=>!!(Q.tok||Q.sys);
 const g=document.querySelector('#welcome .welcome-grid>div');
 g.insertAdjacentHTML('beforeend','<span class="eyebrow rp-gate"><span data-i18n="للمدرب">للمدرب</span></span><h2 class="rp-gate"><span data-i18n="الأنشطة للأدمن والفرق بس">الأنشطة للأدمن والفرق بس</span></h2><p class="rp-gate"><span data-i18n="سجّل دخول بحساب الأدمن أو الفريق عشان تجهّز أنشطة وتشوف الردود.">سجّل دخول بحساب الأدمن أو الفريق عشان تجهّز أنشطة وتشوف الردود.</span></p><div class="actions rp-gate"><button id="rpGateBtn"><span data-i18n="سجّل دخول">سجّل دخول</span></button></div>');
 const upd=()=>{document.body.classList.toggle('rp-out',!signedIn())};upd();setInterval(upd,400);
 $('rpGateBtn').onclick=()=>openQuiz();
 $('activitiesTab').onclick=()=>{if(signedIn())show('welcome');else{show('welcome');window.scrollTo(0,0)}};
 const _show=show;show=function(id){if((id==='setup'||id==='trainer')&&!signedIn()){id='welcome'}return _show.apply(this,arguments.length?[id]:[])};
})();'''
    h=h.replace('</style>',css+'</style>',1)
    anchor="document.querySelectorAll('a[href=\"/\"]').forEach(a=>a.href=appBase);"
    assert anchor in h
    h=h.replace(anchor,js+"\n"+anchor,1)
    return h
