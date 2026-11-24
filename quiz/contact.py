import re as _r,json as _j
def apply(h):
    EN={"تواصل":"Contact","تواصل مع صانع الموقع":"Contact the creator","عمر ناجي":"Omar Nagy","ع":"O","الموبايل":"Mobile","الإيميل":"Email","صانع RoomPulse":"Creator of RoomPulse"}
    css='''#contact{max-width:560px;margin:0 auto}.ctc{text-align:center;padding:30px 20px 26px;border-radius:24px;border:1px solid var(--glass-field-line,#d9b9c0);background:var(--glass-field,#ffffff80);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);margin:10px 0}
.ctc .av{width:92px;height:92px;border-radius:50%;margin:0 auto 14px;background:#E60000;color:#fff;display:grid;place-items:center;font-size:40px;font-weight:800;box-shadow:0 10px 26px #e6000040}
.ctc h2{margin:0 0 4px;font-size:26px}.ctc .role{margin:0 0 22px;opacity:.7;font-size:15px}
.ctr{display:flex;align-items:center;gap:14px;text-decoration:none;color:inherit;padding:14px 16px;margin:10px 0;border-radius:16px;border:1px solid var(--glass-field-line,#d9b9c0);background:#ffffff55;text-align:start}
html[data-theme=dark] .ctr{background:#ffffff0d}
.ctr svg{width:26px;height:26px;flex:none;color:#E60000}.ctr small{display:block;opacity:.65;font-size:12.5px}.ctr b{display:block;font-size:17px;direction:ltr;unicode-bidi:plaintext;word-break:break-all}
@media(max-width:520px){.section-tabs{gap:2px!important;padding:5px!important}.section-tabs button{padding-inline:5px!important;font-size:13px!important;gap:4px!important}.section-tabs .tbi{width:15px!important;height:15px!important;flex:none!important;min-width:15px}}
html[dir=rtl] .ctr b{text-align:right}.ctr:active,.ctr:hover{border-color:#E60000}'''
    ph='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A15 15 0 013 6a2 2 0 012-2z"/></svg>'
    ml='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>'
    sec='<section class="hidden" id="contact"><div class="ctc"><div class="av" aria-hidden="true" data-i18n="ع">ع</div><h2 data-i18n="عمر ناجي">عمر ناجي</h2><p class="role" data-i18n="صانع RoomPulse">صانع RoomPulse</p><a class="ctr" href="tel:+201065555507">'+ph+'<span><small data-i18n="الموبايل">الموبايل</small><b>01065555507</b></span></a><a class="ctr" href="mailto:omarnagycd@gmail.com">'+ml+'<span><small data-i18n="الإيميل">الإيميل</small><b>omarnagycd@gmail.com</b></span></a></div></section>'
    a='<section class="hidden" id="join">';assert a in h;h=h.replace(a,sec+a,1)
    h=h.replace('</style>',css+'</style>',1)
    m=_r.search(r'<button[^>]*id="quizTab".*?</button>',h,_r.S);assert m
    ic='<svg class="tbi" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/></svg>'
    h=h.replace(m.group(0),m.group(0)+'<button aria-pressed="false" class="secondary" id="contactTab" type="button">'+ic+'<span data-i18n="تواصل">تواصل</span></button>',1)
    old="'wheel','quiz','quizPlay'])";assert old in h;h=h.replace(old,"'wheel','quiz','quizPlay','contact'])")
    old="String(id!=='wheel'&&id!=='quiz'));";assert old in h;h=h.replace(old,"String(id!=='wheel'&&id!=='quiz'&&id!=='contact'));$('contactTab').setAttribute('aria-pressed',String(id==='contact'));")
    anchor="document.querySelectorAll('a[href=\"/\"]').forEach(a=>a.href=appBase);"
    h=h.replace(anchor,"Object.assign(EN,"+_j.dumps(EN,ensure_ascii=False)+");$('contactTab').onclick=()=>show('contact');\n"+anchor,1)
    return h
