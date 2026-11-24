"""Injects the quiz module (quiz/client.*) into index.html. Idempotent: run on a clean index.html from git."""
from pathlib import Path
import json
import re
p=Path(__file__).parent;h=(p/'index.html').read_text()
if 'QUIZ MODULE (client)' in h: raise SystemExit('already built')
css=(p/'quiz/client.css').read_text();A=p/'quiz/assets';AV=json.loads((A/'avatars.json').read_text())
import re as _re
SYM=''.join('<symbol id="qa%d" viewBox="0 0 64 64">%s</symbol>'%(i,_re.sub(r'^<svg[^>]*>|</svg>$','',v)) for i,v in enumerate(AV.values()))
js='const QAV_SYMBOLS='+json.dumps(SYM)+';\n'+(p/'quiz/sound.js').read_text()+'\n'+(p/'quiz/client.js').read_text()+'\n'+(p/'quiz/extras.js').read_text()+'\n'+(p/'quiz/ui2.js').read_text();html=(p/'quiz/client.html').read_text()
h=h.replace('</style>',css+'</style>',1)
tab='<button aria-pressed="false" class="secondary" id="wheelTab" type="button"><span data-i18n="العجلة">العجلة</span></button>'
assert tab in h
h=h.replace(tab,tab+'<button aria-pressed="false" class="secondary" id="quizTab" type="button"><span data-i18n="كويز">كويز</span></button>',1)
# sections: before the join section
a='<section class="hidden" id="join">';assert a in h;h=h.replace(a,html+a,1)
old="for(const n of ['welcome','setup','trainer','join','participant','wheel'])"
assert old in h;h=h.replace(old,"for(const n of ['welcome','setup','trainer','join','participant','wheel','quiz','quizPlay'])")
old="$('activitiesTab').setAttribute('aria-pressed',String(id!=='wheel'));$('wheelTab').setAttribute('aria-pressed',String(id==='wheel'));"
assert old in h;h=h.replace(old,"$('activitiesTab').setAttribute('aria-pressed',String(id!=='wheel'&&id!=='quiz'));$('wheelTab').setAttribute('aria-pressed',String(id==='wheel'));$('quizTab').setAttribute('aria-pressed',String(id==='quiz'));")
old="classList.toggle('hidden',id==='join'||id==='participant')"
assert old in h;h=h.replace(old,"classList.toggle('hidden',id==='join'||id==='participant'||id==='quizPlay')")
old="const code=new URLSearchParams(location.search).get('code');if(code){$('joinCode').value=code;join()}"
assert old in h;h=h.replace(old,"const code=new URLSearchParams(location.search).get('code');if(code){$('joinCode').value=code;quizTryJoin()}")
anchor="document.querySelectorAll('a[href=\"/\"]').forEach(a=>a.href=appBase);"
assert anchor in h;h=h.replace(anchor,js+"\n"+anchor,1)

# ---- UI2: header, logo, tab icons, favicon, hero ----
LL=(A/'logo-light.b64.txt').read_text();LD=(A/'logo-dark.b64.txt').read_text();FV=(A/'favicon.b64.txt').read_text();HE=(A/'hero.b64.txt').read_text()
old='<a href="/"><span data-i18n="البداية">البداية</span></a>'
assert old in h
h=h.replace(old,'<a class="brand" href="/" aria-label="RoomPulse"><img class="lg lg-l" alt="RoomPulse" width="150" height="40" src="data:image/png;base64,'+LL+'"/><img class="lg lg-d" alt="RoomPulse" width="150" height="40" src="data:image/png;base64,'+LD+'"/></a>',1)
old='<h1><bdi><strong>RoomPulse</strong></bdi></h1>'
assert old in h;h=h.replace(old,'<h1 class="sr"><bdi><strong>RoomPulse</strong></bdi></h1>',1)
m=_re.search(r'<nav aria-label="App sections" class="mode-buttons section-tabs">.*?</nav>',h,_re.S);assert m
nav=m.group(0);h=h.replace(nav,'',1)
IC={'activitiesTab':'<rect x="4" y="12" width="4" height="8" rx="1"/><rect x="10" y="5" width="4" height="15" rx="1"/><rect x="16" y="9" width="4" height="11" rx="1"/>','quizTab':'<path d="M4 5h16v11H11l-4 4v-4H4z"/><path d="M10 9.5a2 2 0 114 0c0 1.4-2 1.5-2 3"/>','wheelTab':'<circle cx="12" cy="12" r="9"/><path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6L5.6 18.4"/>'}
for k,v in IC.items():
    a='id="%s" type="button"><span'%k
    if k=='quizTab': a='id="quizTab" type="button"><span'
    assert a in nav,k
    nav=nav.replace(a,a.replace('><span','><svg class="tbi" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+v+'</svg><span'),1)
anchor='</a><div aria-label="Language / اللغة"'
assert anchor in h;h=h.replace(anchor,'</a>'+nav+'<div aria-label="Language / اللغة"',1)
h=h.replace('<meta content="#E60000" name="theme-color"/>','<meta content="#E60000" name="theme-color"/><link rel="icon" type="image/png" href="data:image/png;base64,'+FV+'"/>',1)
h=h.replace('</style>','.qhero{background:#0b0405 url(data:image/jpeg;base64,'+HE+') center/cover no-repeat}</style>',1)
a='<section id="welcome">';assert a in h
h=h.replace(a,a+'<div class="qhero qhero-act" role="img" aria-label="RoomPulse"></div>',1)
(p/'index.html').write_text(h)
print('built')
