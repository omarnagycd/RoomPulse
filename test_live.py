import asyncio,json,subprocess,pathlib,os
from playwright.async_api import async_playwright,expect
BASE=os.getenv('TEST_URL','https://roompulse.s21smk.workers.dev')
OUT=pathlib.Path('/downloads/hall-live-v3/tests');OUT.mkdir(exist_ok=True)
async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(executable_path='/usr/bin/google-chrome',headless=True,args=['--no-sandbox'])
  trainer=await browser.new_context(viewport={'width':1280,'height':900})
  phone=await browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
  manual=await browser.new_context(viewport={'width':320,'height':780})
  t=await trainer.new_page();a=await phone.new_page();m=await manual.new_page()
  errors=[]
  for page in [t,a,m]:page.on('pageerror',lambda e:errors.append(str(e)))
  await t.goto(BASE);await expect(t.locator('#welcome')).to_be_visible()
  for width in [320,390,1280]:
   await t.set_viewport_size({'width':width,'height':900});await t.screenshot(path=str(OUT/f'welcome-{width}.png'),full_page=True)
  await t.locator('#startTrainer').click()
  for width in [320,390,1280]:
   await t.set_viewport_size({'width':width,'height':900});await t.screenshot(path=str(OUT/f'setup-{width}.png'),full_page=True)
  await t.locator('#create').click();await expect(t.locator('#sessionCode')).to_have_text(__import__('re').compile(r'\d{6}'),timeout=20000)
  code=await t.locator('#sessionCode').inner_text();await expect(t.locator('#connection')).to_contain_text('متصل',timeout=15000)
  await expect(t.locator('#total')).to_have_text('0')
  await t.locator('#qr').screenshot(path=str(OUT/'qr.png'))
  decoded=subprocess.check_output(['node','/downloads/hall-live-v3/decode.cjs',str(OUT/'qr.png')],text=True).strip()
  assert decoded==BASE+'/join?code='+code,(decoded,code)
  await a.goto(decoded);await expect(a.locator('#participant')).to_be_visible(timeout=15000)
  await expect(a.locator('#vote')).to_be_disabled()
  for width in [320,390,1280]:
   await a.set_viewport_size({'width':width,'height':900});await a.screenshot(path=str(OUT/f'participant-{width}.png'),full_page=True)
  await a.set_viewport_size({'width':390,'height':844})
  await a.locator('[data-choice="1"]').click();await a.locator('#vote').click();await expect(a.locator('#voteStatus')).to_contain_text('اتسجّل',timeout=15000)
  await expect(t.locator('#total')).to_have_text('1',timeout=15000)
  await a.reload();await expect(a.locator('#voteStatus')).to_contain_text('اتسجّل',timeout=15000);await expect(a.locator('#vote')).to_be_hidden()
  await m.goto(BASE+'/join')
  for width in [320,390,1280]:
   await m.set_viewport_size({'width':width,'height':900});await m.screenshot(path=str(OUT/f'join-{width}.png'),full_page=True)
  await m.set_viewport_size({'width':320,'height':780})
  await m.locator('#joinCode').fill('000000');await m.locator('#joinButton').click();await expect(m.locator('#globalError')).not_to_be_empty()
  await m.locator('#joinCode').fill(code);await m.locator('#joinButton').click();await expect(m.locator('#participant')).to_be_visible()
  await t.locator('#toggle').click();await expect(t.locator('#pollStatus')).to_have_text('التصويت مقفول')
  await expect(m.locator('[data-choice="0"]')).to_be_disabled(timeout=15000)
  await m.screenshot(path=str(OUT/'closed-phone.png'),full_page=True)
  await t.locator('#toggle').click();await expect(m.locator('[data-choice="0"]')).to_be_enabled(timeout=15000)
  await m.locator('[data-choice="0"]').click();await m.locator('#vote').click();await expect(t.locator('#total')).to_have_text('2',timeout=15000)
  counts=await t.locator('.result-head strong').all_text_contents();assert counts==['1 · 50%','1 · 50%','0 · 0%'],counts
  for width in [320,390,1280]:
   await t.set_viewport_size({'width':width,'height':900});await t.screenshot(path=str(OUT/f'trainer-{width}.png'),full_page=True)
  await a.screenshot(path=str(OUT/'vote-confirmed-phone.png'),full_page=True)
  # Authorization checks use the participant's independent context, with no trainer secret.
  r=await phone.request.get(BASE+'/api/sessions/'+code+'/results');assert r.status==403,r.status
  r=await phone.request.post(BASE+'/api/sessions/'+code+'/status',data={'open':False});assert r.status==403,r.status
  r=await phone.request.get(BASE+'/api/sessions/'+code);public=await r.json();assert 'token' not in public and 'counts' not in public
  await t.reload();await expect(t.locator('#resumeBox')).to_be_visible();await t.locator('#resume').click();await expect(t.locator('#total')).to_have_text('2',timeout=15000)
  assert not errors,errors
  result={'passed':True,'session_code':code,'qr_decoded_url':decoded,'independent_contexts':3,'total':2,'counts':counts,'checks':['QR decoded from rendered image','independent phone vote updates trainer within 15 seconds','manual code join','empty selection blocked','invalid code error','duplicate vote blocked after reload','close and reopen propagate to second participant','exact aggregate counts','unauthorized results and controls denied','public session has no trainer token or vote counts','trainer resumes after refresh','no browser JS errors'],'screenshots':15}
  (OUT/'result.json').write_text(json.dumps(result,ensure_ascii=False,indent=2));print(json.dumps(result,ensure_ascii=False))
  await browser.close()
asyncio.run(main())
