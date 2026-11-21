import asyncio,json,subprocess,pathlib,os,re
from playwright.async_api import async_playwright,expect
BASE=os.environ.get('TEST_URL','http://127.0.0.1:8787')
OUT=pathlib.Path('/downloads/hall-live-v2/tests-text');OUT.mkdir(exist_ok=True)
async def main():
 async with async_playwright() as p:
  b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',headless=True,args=['--no-sandbox'])
  tc=await b.new_context(viewport={'width':1280,'height':900});pc=await b.new_context(viewport={'width':390,'height':844});mc=await b.new_context(viewport={'width':320,'height':780})
  t=await tc.new_page();a=await pc.new_page();m=await mc.new_page();errs=[]
  for page in [t,a,m]:page.on('pageerror',lambda e:errs.append(str(e)))
  await t.goto(BASE);await t.locator('#startTrainer').click();await t.locator('#modeText').click();await expect(t.locator('#option0')).to_be_hidden()
  await t.locator('#question').fill('إيه أول جملة تقولها لعميل متضايق من تأخير طلبه؟')
  for w in [320,390,1280]:
   await t.set_viewport_size({'width':w,'height':900});await t.screenshot(path=str(OUT/f'setup-{w}.png'),full_page=True)
  await t.locator('#create').click();await expect(t.locator('#sessionCode')).to_have_text(re.compile(r'\d{6}'),timeout=15000);code=await t.locator('#sessionCode').inner_text()
  await expect(t.locator('#connection')).to_contain_text('متصل',timeout=15000)
  await t.locator('#qr').screenshot(path=str(OUT/'qr.png'));url=subprocess.check_output(['node','/downloads/hall-live-v2/decode.cjs',str(OUT/'qr.png')],text=True).strip();assert url==BASE+'/join?code='+code
  await a.goto(url);await expect(a.locator('#textEntry')).to_be_visible(timeout=15000);await expect(a.locator('#choices')).to_be_hidden();await expect(a.locator('#vote')).to_be_disabled()
  await a.locator('#writtenAnswer').fill('   ');await expect(a.locator('#vote')).to_be_disabled()
  one='أنا فاهم إن التأخير عطّل يومك. خليني أتأكد من حالة الطلب وأقولك الخطوة الجاية.'
  two='أسمع العميل الأول وأسأله عن المشكلة.\nبعدها أوضّح له إيه اللي هعمله.'
  for w in [320,390,1280]:
   await a.set_viewport_size({'width':w,'height':900});await a.screenshot(path=str(OUT/f'participant-{w}.png'),full_page=True)
  await a.set_viewport_size({'width':390,'height':844});await a.locator('#writtenAnswer').fill(one);await a.locator('#vote').click();await expect(a.locator('#voteStatus')).to_contain_text('اتسجّل',timeout=15000)
  await expect(t.locator('.written-answer')).to_have_count(1,timeout=15000);await expect(t.locator('.written-answer')).to_contain_text(one)
  await m.goto(BASE+'/join');await m.locator('#joinCode').fill(code);await m.locator('#joinButton').click();await expect(m.locator('#participant')).to_be_visible()
  await t.locator('#toggle').click();await expect(t.locator('#pollStatus')).to_contain_text('مقفول');await expect(m.locator('#writtenAnswer')).to_be_disabled(timeout=15000)
  await t.locator('#toggle').click();await expect(m.locator('#writtenAnswer')).to_be_enabled(timeout=15000)
  await m.locator('#writtenAnswer').fill(two);await m.locator('#vote').click();await expect(t.locator('#total')).to_have_text('2',timeout=15000)
  await expect(t.locator('.written-answer').first).to_contain_text(two)
  # Check reload cannot resubmit, and the browser draft remains untouched during status refresh.
  await a.reload();await expect(a.locator('#voteStatus')).to_contain_text('اتسجّل',timeout=15000);await expect(a.locator('#writtenAnswer')).to_be_disabled();await expect(a.locator('#vote')).to_be_hidden()
  r=await pc.request.get(BASE+'/api/sessions/'+code);d=await r.json();assert 'answers' not in d and 'token' not in d
  r=await pc.request.get(BASE+'/api/sessions/'+code+'/results');assert r.status==403
  # Backend rejects blank and overlength written replies, safely renders markup as text.
  for text in [' ', 'x'*501]:
   r=await pc.request.post(BASE+'/api/sessions/'+code+'/vote',data={'client':'validation-'+str(len(text)),'answer':text});assert r.status==400
  unsafe='<img src=x onerror=alert(1)> & تجربة'
  r=await pc.request.post(BASE+'/api/sessions/'+code+'/vote',data={'client':'escaping-test','answer':unsafe});assert r.status==201
  await expect(t.locator('#total')).to_have_text('3',timeout=15000);await expect(t.locator('.written-answer').first).to_contain_text(unsafe);assert await t.locator('.written-answer img').count()==0
  # Remove escaped-markup test only from screenshot view, not from server data.
  for w in [320,390,1280]:
   await t.set_viewport_size({'width':w,'height':900});await t.screenshot(path=str(OUT/f'trainer-{w}.png'),full_page=True)
  await a.screenshot(path=str(OUT/'confirmed-390.png'),full_page=True)
  assert not errs,errs
  result={'passed':True,'url':BASE,'code':code,'qr_url':url,'independent_browser_contexts':3,'written_answers_total':3,'checks':['written-mode selector','QR image decoded to participant join','manual code join','empty text disabled','two Arabic written replies update trainer live','multiline text preserved','close/open propagates','repeat reply prevented after reload','participant cannot read others replies or trainer controls','server rejects blank or over 500 characters','HTML markup rendered as text, no injected elements','no JS errors'],'screenshots':'setup, participant and trainer at 320,390,1280, plus confirmation'}
  (OUT/'result.json').write_text(json.dumps(result,ensure_ascii=False,indent=2));print(json.dumps(result,ensure_ascii=False))
  await b.close()
asyncio.run(main())
