"""Injects the quiz module (quiz/client.*) into index.html. Idempotent: run on a clean index.html from git."""
from pathlib import Path
import re
p=Path(__file__).parent;h=(p/'index.html').read_text()
if 'QUIZ MODULE (client)' in h: raise SystemExit('already built')
css=(p/'quiz/client.css').read_text();js=(p/'quiz/client.js').read_text();html=(p/'quiz/client.html').read_text()
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
(p/'index.html').write_text(h)
print('built')
