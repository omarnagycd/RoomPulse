import asyncio,json,os,pathlib,re,subprocess,time,urllib.request
from playwright.async_api import async_playwright,expect
P=pathlib.Path(__file__).parent;OUT=P/'tests-bilingual';OUT.mkdir(exist_ok=True)
BASE=os.getenv('TEST_URL','http://127.0.0.1:8787');bank=json.loads((P/'bank-bilingual.json').read_text())
async def fill_if_empty(t):
 for id,val in [('title','Regression title'),('question','Regression question'),('option0','A'),('option1','B'),('option2','C')]:
  if await t.locator('#'+id).is_visible() and not await t.locator('#'+id).input_value():await t.locator('#'+id).fill(val)
async def main():
 async with async_playwright() as pw:
  b=await pw.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'],headless=True)
  errors=[];checks=[]
  for language in ['ar','en']:
   tc=await b.new_context(viewport={'width':1280,'height':950});pc=await b.new_context(viewport={'width':390,'height':844});mc=await b.new_context(viewport={'width':320,'height':780})
   t=await tc.new_page();a=await pc.new_page();m=await mc.new_page()
   for pg in [t,a,m]:pg.on('pageerror',lambda e:errors.append(str(e)))
   async def shot(pg,name):
    for w in [320,390,1280]:
     await pg.set_viewport_size({'width':w,'height':950});await pg.screenshot(path=str(OUT/f'{language}-{name}-{w}.png'),full_page=True)
     assert await pg.evaluate('document.documentElement.scrollWidth<=innerWidth'),(language,name,w,'overflow')
     assert await pg.locator('#langAR').is_visible() and await pg.locator('#langEN').is_visible()
    await pg.set_viewport_size({'width':1280 if pg==t else 390,'height':950})
   await t.goto(BASE+'/?lang='+language);await expect(t.locator('html')).to_have_attribute('dir','rtl' if language=='ar' else 'ltr');await shot(t,'home')
   await t.locator('#openBank').click();await shot(t,'bank')
   for x in bank:
    await t.locator('#bankPanel').evaluate('(e)=>e.open=true');await t.locator('[data-category]').filter(has_text=x['en']['category'] if language=='en' else x['category']).click();await t.locator('[data-bank="'+str(x['id'])+'"]').click()
    y=x['en'] if language=='en' else x
    await expect(t.locator('#question')).to_have_value(y['question']);await expect(t.locator('#title')).to_have_value(y['category'])
    for i,o in enumerate(y['options']):await expect(t.locator('#option'+str(i))).to_have_value(o)
   await t.locator('#title').fill('عنوان custom 🙂');await t.locator('#question').fill('هل تفضل A or B?');await t.locator('#langEN' if language=='ar' else '#langAR').click();await expect(t.locator('#title')).to_have_value('عنوان custom 🙂');await expect(t.locator('#question')).to_have_value('هل تفضل A or B?');await t.locator('#langAR' if language=='ar' else '#langEN').click()
   await shot(t,'setup')
   for kind in ['poll','text']:
    await t.goto(BASE+'/?lang='+language);await t.locator('#openBank').click()
    if kind=='poll':await t.locator('[data-category]').nth(2).click()
    await t.locator('[data-bank="'+('21' if kind=='poll' else '1')+'"]').click();await t.locator('#identityNamed').click();await fill_if_empty(t);await t.locator('#create').click();await expect(t.locator('#sessionCode')).to_have_text(re.compile(r'\d{6}'),timeout=20000);code=await t.locator('#sessionCode').inner_text()
    await t.locator('#qr').evaluate('(img)=>img.decode()');await t.locator('#qr').screenshot(path=str(OUT/f'{language}-{kind}-qr.png'));u=subprocess.check_output(['node',str(P/'decode.cjs'),str(OUT/f'{language}-{kind}-qr.png')],text=True).strip();assert u==BASE+'/join?code='+code+'&lang='+language,u
    await a.goto(u);await expect(a.locator('#participant')).to_be_visible();await expect(a.locator('html')).to_have_attribute('lang',language);await shot(a,kind+'-entry')
    await a.locator('#participantName').fill('  Alex / أحمد 🙂  ')
    if kind=='poll':await a.locator('[data-choice="0"]').click()
    else:await a.locator('#writtenAnswer').fill('Reply / إجابة <b>safe</b>')
    await a.locator('#langEN' if language=='ar' else '#langAR').click();await expect(a.locator('#participantName')).to_have_value('  Alex / أحمد 🙂  ')
    if kind=='text':await expect(a.locator('#writtenAnswer')).to_have_value('Reply / إجابة <b>safe</b>')
    else:await expect(a.locator('[data-choice="0"]')).to_have_attribute('aria-pressed','true')
    await a.locator('#langAR' if language=='ar' else '#langEN').click();await a.locator('#vote').click();await expect(a.locator('#voteStatus')).to_contain_text('Thanks' if language=='en' else 'شكراً',timeout=15000);await expect(t.locator('#total')).to_have_text('1',timeout=15000)
    await m.goto(BASE+'/join?lang='+language);await shot(m,'join');await m.locator('#joinCode').fill(code);await m.locator('#joinButton').click();await expect(m.locator('#nameEntry')).to_be_visible();await m.locator('#participantName').fill('Second participant')
    if kind=='poll':await m.locator('[data-choice="1"]').click()
    else:await m.locator('#writtenAnswer').fill('Another reply')
    await m.locator('#vote').click();await expect(t.locator('#total')).to_have_text('2',timeout=15000);await shot(t,kind+'-results');await shot(a,kind+'-confirmation')
    await t.locator('#toggle').click();await expect(t.locator('#pollStatus')).to_contain_text('closed' if language=='en' else 'مقفول');await t.locator('#toggle').click()
    await a.reload();await expect(a.locator('#vote')).to_be_hidden();await expect(a.locator('html')).to_have_attribute('lang',language)
   # Anonymous, English validation and preference persistence.
   await t.goto(BASE+'/?lang='+language);await t.locator('#startTrainer').click();await expect(t.locator('#identityAnonymous')).to_have_attribute('aria-pressed','true');await fill_if_empty(t);await t.locator('#create').click();await expect(t.locator('#sessionCode')).to_have_text(re.compile(r'\d{6}'));code=await t.locator('#sessionCode').inner_text()
   await a.goto(BASE+'/join?code='+code+'&lang='+language);await expect(a.locator('#nameEntry')).to_be_hidden()
   await a.goto(BASE+'/join?lang='+language);await a.locator('#joinCode').fill('123');await a.locator('#joinButton').click();await expect(a.locator('#globalError')).to_contain_text('6-digit' if language=='en' else '٦ أرقام');await shot(a,'validation')
   await t.goto(BASE+'/');await expect(t.locator('html')).to_have_attribute('lang',language)
   checks.append(language+': 50 bank entries; all screens at 320/390/1280; named poll/text QR and manual code; preserved custom content on switch; anonymous default; close/reopen; repeat prevention; preference persistence; validation')
   await tc.close();await pc.close();await mc.close()
  assert not errors,errors
  out={'passed':True,'url':BASE,'checks':checks,'js_errors':errors};(OUT/'result.json').write_text(json.dumps(out,indent=2));print(json.dumps(out));await b.close()
server=None
try:
 if 'TEST_URL' not in os.environ:
  log=open('/tmp/roompulse-dev.log','w');server=subprocess.Popen(['npx','wrangler','dev','--port','8787','--local'],cwd=P,stdout=log,stderr=log,start_new_session=True)
  for i in range(60):
   try:urllib.request.urlopen(BASE,timeout=1);break
   except Exception:time.sleep(.5)
 asyncio.run(main())
finally:
 if server:
  import signal
  os.killpg(server.pid,signal.SIGTERM);server.wait();log.close()
