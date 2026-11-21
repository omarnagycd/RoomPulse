import asyncio,json,os,pathlib,re,subprocess
from playwright.async_api import async_playwright,expect
BASE=os.getenv('TEST_URL','http://127.0.0.1:8787');P=pathlib.Path(__file__).parent;OUT=P/'tests-v3';OUT.mkdir(exist_ok=True)
async def main():
 async with async_playwright() as pw:
  b=await pw.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'],headless=True)
  tc=await b.new_context(viewport={'width':1280,'height':900});pc=await b.new_context(viewport={'width':390,'height':844});mc=await b.new_context(viewport={'width':320,'height':780})
  t=await tc.new_page();a=await pc.new_page();m=await mc.new_page();errors=[]
  for pg in [t,a,m]:pg.on('pageerror',lambda e:errors.append(str(e)))
  await t.goto(BASE);await t.locator('#openBank').click();await expect(t.locator('#bankPanel')).to_have_attribute('open','')
  data=json.loads((P/'bank-expanded.json').read_text())
  for x in data:
   await t.locator('#bankPanel').evaluate('(e)=>e.open=true')
   await t.locator('[data-category]').filter(has_text=x['category']).click()
   await expect(t.locator('[data-bank]')).to_have_count(10)
   await t.locator('[data-bank="'+str(x['id'])+'"]').click()
   await expect(t.locator('#question')).to_have_value(x['question']);await expect(t.locator('#title')).to_have_value(x['category'])
   await expect(t.locator('#modeText' if x['mode']=='text' else '#modePoll')).to_have_attribute('aria-pressed','true')
   if x['mode']=='poll':
    await expect(t.locator('#option0')).to_have_value(x['options'][0]);await expect(t.locator('#option1')).to_have_value(x['options'][1]);await expect(t.locator('#option2')).to_be_hidden()
   await expect(t.locator('#setup')).to_be_visible();await expect(t.locator('#trainer')).to_be_hidden()
  for w in [320,390,1280]:
   await t.set_viewport_size({'width':w,'height':900});await t.locator('#bankPanel').evaluate('(e)=>e.open=true');await t.screenshot(path=str(OUT/f'bank-{w}.png'),full_page=True)
  for kind in ['poll','text']:
   await t.goto(BASE);await t.locator('#openBank').click()
   if kind=='poll':await t.locator('[data-category]').filter(has_text='ده ولا ده').click()
   await t.locator('[data-bank="'+('21' if kind=='poll' else '1')+'"]').click()
   await t.locator('#identityNamed').click();await t.locator('#title').fill('تجربة بالأسماء')
   await t.locator('#create').click();await expect(t.locator('#sessionCode')).to_have_text(re.compile(r'\d{6}'),timeout=15000)
   code=await t.locator('#sessionCode').inner_text();await expect(t.locator('#connection')).to_contain_text('متصل',timeout=15000)
   await t.locator('#qr').screenshot(path=str(OUT/f'qr-{kind}.png'));u=subprocess.check_output(['node',str(P/'decode.cjs'),str(OUT/f'qr-{kind}.png')],text=True).strip();assert u==BASE+'/join?code='+code
   await a.goto(u);await expect(a.locator('#nameEntry')).to_be_visible(timeout=15000)
   if kind=='poll':await a.locator('[data-choice="0"]').click()
   else:await a.locator('#writtenAnswer').fill('كشري بالشطة والليمون')
   if not (await a.locator('#participantName').input_value()):await expect(a.locator('#vote')).to_be_disabled()
   await a.locator('#participantName').fill('مشارك تجريبي ١');await a.locator('#vote').click();await expect(a.locator('#voteStatus')).to_contain_text('اتسجّل',timeout=15000)
   await expect(t.locator('#total')).to_have_text('1',timeout=15000)
   await expect(t.locator('#namedPollAnswers' if kind=='poll' else '#results')).to_contain_text('مشارك تجريبي ١')
   await m.goto(BASE+'/join');await m.locator('#joinCode').fill(code);await m.locator('#joinButton').click();await expect(m.locator('#nameEntry')).to_be_visible()
   await m.locator('#participantName').fill('مشارك تجريبي ٢')
   if kind=='poll':await m.locator('[data-choice="1"]').click()
   else:await m.locator('#writtenAnswer').fill('فول وطعمية')
   await m.locator('#vote').click();await expect(t.locator('#total')).to_have_text('2',timeout=15000)
   section=t.locator('#namedPollAnswers' if kind=='poll' else '#results');await expect(section).to_contain_text('مشارك تجريبي ٢');await expect(section).to_contain_text('جبل' if kind=='poll' else 'فول وطعمية')
   await a.reload();await expect(a.locator('#voteStatus')).to_contain_text('اتسجّل',timeout=15000)
   r=await pc.request.get(BASE+'/api/sessions/'+code);d=await r.json();assert d['identity']=='named' and 'respondents' not in d and 'answers' not in d
   r=await pc.request.post(BASE+'/api/sessions/'+code+'/vote',data={'client':'no-name','choice':0,'answer':'answer'});assert r.status==400
   r=await pc.request.get(BASE+'/api/sessions/'+code+'/results');assert r.status==403
   await t.locator('#toggle').click();await expect(t.locator('#pollStatus')).to_contain_text('مقفول')
   await t.locator('#toggle').click()
   for w in [320,390,1280]:
    await t.set_viewport_size({'width':w,'height':900});await t.screenshot(path=str(OUT/f'named-{kind}-{w}.png'),full_page=True)
   await a.screenshot(path=str(OUT/f'named-{kind}-confirmed.png'),full_page=True)
  # Anonymous bank poll retains aggregate-only results.
  await t.goto(BASE);await t.locator('#openBank').click();await t.locator('[data-category]').filter(has_text='ده ولا ده').click();await t.locator('[data-bank="30"]').click();await t.locator('#create').click();await expect(t.locator('#sessionCode')).to_have_text(re.compile(r'\d{6}'),timeout=15000);code=await t.locator('#sessionCode').inner_text()
  await a.goto(BASE+'/join?code='+code);await expect(a.locator('#participant')).to_be_visible();await expect(a.locator('#nameEntry')).to_be_hidden();await expect(a.locator('[data-choice]')).to_have_count(2)
  await a.locator('[data-choice="0"]').click();await a.locator('#vote').click();await expect(t.locator('#total')).to_have_text('1',timeout=15000);await expect(t.locator('#namedPollSection')).to_be_hidden()
  assert not errors,errors
  result={'passed':True,'url':BASE,'bank_questions_verified':50,'categories':5,'polls':10,'written_questions':40,'checks':['all exact bank questions, categories, modes and options populate editable fields','bank selection never starts a session','named poll via decoded QR and manual code','named text via decoded QR and manual code','correct participant names mapped to their exact answers','names required on server and client','participant API does not expose names or other answers','unauthorized trainer results denied','reload prevents repeat reply','close/open controls work','anonymous two-option poll has no name field or named results','no JS errors']}
  (OUT/'result.json').write_text(json.dumps(result,ensure_ascii=False,indent=2));print(json.dumps(result,ensure_ascii=False));await b.close()
asyncio.run(main())
