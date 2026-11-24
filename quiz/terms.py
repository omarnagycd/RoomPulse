import json as _j
AR=["١. RoomPulse أداة للأنشطة التفاعلية والكويز والتدريب. باستخدامك للموقع أنت موافق على الشروط دي.",
"٢. كل المحتوى والتصميم والكود والاسم والشعار بتوع RoomPulse ملك عمر محمد ناجي. ممنوع نسخ أي حاجة منها أو إعادة نشرها أو بيعها أو استخدام الاسم والشعار من غير إذن مكتوب منه.",
"٣. أنت المسؤول عن أي سؤال أو نص أو صورة أو اسم تكتبه أو ترفعه. ما تستخدمش محتوى مش ملكك أو مالكش حق استخدامه، أو محتوى مسيء أو مخالف للقانون أو فيه بيانات شخصية أو حساسة لغيرك من غير إذنهم.",
"٤. الموقع بيتحفظ فيه اللي بتكتبه: الأسماء أو الألقاب، الإجابات ونتائج الألعاب، وحسابات المدربين والفرق وسجل الأسئلة والألعاب. استخدم أسئلة وبيانات مناسبة بس.",
"٥. الحسابات بتتعمل بمعرفة صاحب الموقع. أنت مسؤول عن سرية بيانات دخولك، وأي استخدام بحسابك هو مسؤوليتك.",
"٦. الموقع بيتقدم \"كما هو\" ومجاني، من غير ضمان إنه يشتغل من غير توقف أو أخطاء أو إن البيانات تفضل محفوظة. صاحب الموقع مش مسؤول عن أي خسارة أو ضرر ناتج عن استخدام الموقع أو عن محتوى كتبه المستخدمين.",
"٧. يحق لصاحب الموقع يوقف أو يحذف أي حساب أو محتوى مخالف، ويعدّل الشروط دي في أي وقت. استمرارك في الاستخدام معناه موافقتك على النسخة الحالية.",
"٨. للتواصل أو لطلب إذن: من تبويب \"تواصل\"."]
EN=["1. RoomPulse is a tool for interactive activities, quizzes and training. By using the site you agree to these terms.",
"2. All RoomPulse content, design, code, name and logo belong to Omar Mohamed Nagy. Do not copy, republish, sell, or use the name or logo without his written permission.",
"3. You are responsible for every question, text, image or name you write or upload. Do not use content you do not own or have no right to use, or content that is abusive, unlawful, or contains other people's personal or sensitive data without their permission.",
"4. The site stores what you enter: names or nicknames, answers and game results, trainer and team accounts, and question and game history. Use suitable questions and data only.",
"5. Accounts are created by the site owner. You are responsible for keeping your sign-in details private and for all use of your account.",
"6. The site is provided \"as is\" and free, with no guarantee that it will run without interruption or errors, or that data will be kept. The owner is not liable for any loss or damage from using the site or from content written by users.",
"7. The owner may suspend or remove any account or content that breaks these terms, and may change the terms at any time. Continuing to use the site means you accept the current version.",
"8. To contact the owner or ask for permission, use the Contact tab."]
def apply(h):
    m={"شروط الاستخدام":"Terms of Use","© RoomPulse · عمر محمد ناجي":"© RoomPulse · Omar Mohamed Nagy","إغلاق":"Close"}
    for a,e in zip(AR,EN):m[a]=e
    paras=''.join('<p><span data-i18n="%s">%s</span></p>'%(a.replace('"','&quot;'),a) for a in AR)
    css='.rp-terms-link{background:none;border:0;padding:0;margin:0 6px;color:inherit;text-decoration:underline;font:inherit;cursor:pointer;min-height:0}#rpTerms{max-width:640px;margin:24px auto 0;padding:18px 20px;border:1px solid #eadede;border-radius:14px;background:#fff;font-size:14px;line-height:1.9;color:#252525}#rpTerms h3{margin:0 0 8px}#rpTerms p{margin:6px 0}html[data-theme=dark] #rpTerms{background:#261c1c;border-color:#4f3b3b;color:#f2eeee}'
    foot='<footer class="rp-foot"><div id="rpTerms" class="hidden" role="region" aria-label="Terms"><h3 data-i18n="شروط الاستخدام">شروط الاستخدام</h3>'+paras+'<button type="button" class="secondary" id="rpTermsX"><span data-i18n="إغلاق">إغلاق</span></button></div><div style="margin-top:14px;text-align:center"><span data-i18n="© RoomPulse · عمر محمد ناجي">© RoomPulse · عمر محمد ناجي</span> · <button type="button" class="rp-terms-link" id="rpTermsB"><span data-i18n="شروط الاستخدام">شروط الاستخدام</span></button></div></footer>'
    assert '</main><script>' in h
    h=h.replace('</main><script>','</main>'+foot+'<script>',1)
    h=h.replace('</style>',css+'</style>',1)
    js="Object.assign(EN,"+_j.dumps(m,ensure_ascii=False)+");$('rpTermsB').onclick=()=>{const t=$('rpTerms');t.classList.toggle('hidden');if(!t.classList.contains('hidden'))t.scrollIntoView({behavior:'smooth',block:'start'})};$('rpTermsX').onclick=()=>$('rpTerms').classList.add('hidden');\n"
    anchor="document.querySelectorAll('a[href=\"/\"]').forEach(a=>a.href=appBase);"
    assert anchor in h
    return h.replace(anchor,js+anchor,1)
