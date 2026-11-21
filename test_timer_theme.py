import asyncio,json,os,pathlib,re,signal,subprocess,time,urllib.request,uuid
from playwright.async_api import async_playwright,expect
P=pathlib.Path(__file__).parent;OUT=P/'tests-timer-theme';OUT.mkdir(exist_ok=True);BASE=os.getenv('TEST_URL','http://127.0.0.1:8787')
async def fill_if_empty(t):
 for id,val in [('title','Regression title'),('question','Regression question'),('option0','A'),('option1','B'),('option2','C')]:
  if await t.locator('#'+id).is_visible() and not await t.locator('#'+id).input_value():await t.locator('#'+id).fill(val)
async def main():
 async with async_playwright() as pw:
  b=await pw.chromium.launch(executable_path='/usr/bin/google-chrome',headless=True,args=['--no-sandbox']);errors=[]
  for lang in ['ar','en']:
   tc=await b.new_context(viewport={'width':1280,'height':950});pc=await b.new_context(viewport={'width':390,'height':950});t=await tc.new_page();a=await pc.new_page()
   for p in [t,a]:p.on('pageerror',lambda e:errors.append(str(e)))
   async def shots(p,view):
    for w in [320,390,1280]:
     await p.set_viewport_size({'width':w,'height':950});await p.screenshot(path=str(OUT/f'{lang}-{view}-{w}.png'),full_page=True);assert await p.evaluate('document.documentElement.scrollWidth<=innerWidth'),(lang,view,w)
    await p.set_viewport_size({'width':1280 if p==t else 390,'height':950})
   await t.goto(BASE+'/?lang='+lang);await expect(t.locator('html')).to_have_attribute('data-theme','light');await t.locator('#themeToggle').click();await expect(t.locator('html')).to_have_attribute('data-theme','dark');await shots(t,'dark-home');await t.reload();await expect(t.locator('html')).to_have_attribute('data-theme','dark')
   await t.locator('#startTrainer').click();await expect(t.locator('#timerOff')).to_have_attribute('aria-pressed','true');await expect(t.locator('#timerDuration')).to_be_hidden();await t.locator('#timerOn').click();await t.locator('#timerMinutes').fill('0');await t.locator('#timerSeconds').fill('0');await t.locator('#create').click();await expect(t.locator('#globalError')).not_to_be_empty();await expect(t.locator('#setup')).to_be_visible();await t.locator('#timerSeconds').fill('20');await shots(t,'dark-setup')
   await t.locator('#openBank').count() # shared controls remain available
   await t.locator('#bankPanel').evaluate('(e)=>e.open=true');await shots(t,'dark-bank');await t.locator('#bankPanel').evaluate('(e)=>e.open=false')
   for kind in ['poll','text']:
    if kind=='text':
     await t.goto(BASE+'/?lang='+lang);await t.locator('#startTrainer').click();await t.locator('#timerOn').click();await t.locator('#timerMinutes').fill('0');await t.locator('#timerSeconds').fill('20');await t.locator('#modeText').click()
    await t.locator('#identityNamed').click();await fill_if_empty(t);await t.locator('#create').click();await expect(t.locator('#sessionCode')).to_have_text(re.compile(r'\d{6}'),timeout=15000);code=await t.locator('#sessionCode').inner_text();await expect(t.locator('#trainerCountdown')).to_be_visible();await a.goto(BASE+'/join?code='+code+'&lang='+lang);await expect(a.locator('#participantCountdown')).to_be_visible();await a.evaluate("()=>{if(document.documentElement.dataset.theme!=='dark')document.getElementById('themeToggle').click()}");await expect(a.locator('html')).to_have_attribute('data-theme','dark')
    pub=await pc.request.get(BASE+'/api/sessions/'+code);d=await pub.json();deadline=d['endsAt'];assert d['durationSeconds']==20
    # Manual close/reopen must not reset the deadline.
    await t.locator('#toggle').click();await t.locator('#toggle').click();assert (await (await pc.request.get(BASE+'/api/sessions/'+code)).json())['endsAt']==deadline
    await shots(a,'dark-'+kind+'-entry');await shots(t,'dark-'+kind+'-trainer')
    await a.locator('#participantName').fill('Timer test')
    if kind=='poll':await a.locator('[data-choice="0"]').click()
    else:await a.locator('#writtenAnswer').fill('Within time')
    await a.locator('#vote').click();await expect(t.locator('#total')).to_have_text('1',timeout=10000)
    # A different independent participant waits without submitting.
    lc=await b.new_context(viewport={'width':390,'height':950});late=await lc.new_page();await late.goto(BASE+'/join?code='+code+'&lang='+lang);await expect(late.locator('#participant')).to_be_visible();await late.locator('#participantName').fill('Late participant')
    if kind=='poll':await late.locator('[data-choice="1"]').click()
    else:await late.locator('#writtenAnswer').fill('Should not send')
    await late.locator('#themeToggle').click();await expect(late.locator('#vote')).to_be_disabled(timeout=25000);await expect(t.locator('#trainerCountdown .countdown-value')).to_have_text('00:00',timeout=10000);await expect(t.locator('#toggle')).to_be_disabled();await expect(late.locator('#participantCountdown .countdown-value')).to_have_text('00:00')
    rr=await pc.request.post(BASE+'/api/sessions/'+code+'/vote',data={'client':str(uuid.uuid4()),'name':'Late direct','choice':0,'answer':'Too late'});assert rr.status==409
    saved=await t.evaluate("JSON.parse(sessionStorage.getItem('hall.trainer'))")
    rr=await tc.request.post(BASE+'/api/sessions/'+code+'/status',headers={'Authorization':'Bearer '+saved['token']},data={'open':True});assert rr.status==409
    d=await (await pc.request.get(BASE+'/api/sessions/'+code)).json();assert d['timeUp'] and not d['open'] and d['endsAt']==deadline
    await t.reload();await t.locator('#resume').click();await expect(t.locator('#trainerCountdown .countdown-value')).to_have_text('00:00');await expect(t.locator('#total')).to_have_text('1');await shots(t,'dark-'+kind+'-expired');await shots(late,'dark-'+kind+'-late');await lc.close()
   # Untimed sessions continue to work with no countdown.
   await t.goto(BASE+'/?lang='+lang);await t.locator('#startTrainer').click();await fill_if_empty(t);await t.locator('#create').click();await expect(t.locator('#sessionCode')).to_have_text(re.compile(r'\d{6}'));await expect(t.locator('#trainerCountdown')).to_be_hidden()
   # Theme switching preserves trainer controls and stored session.
   code=await t.locator('#sessionCode').inner_text();await t.locator('#themeToggle').click();await expect(t.locator('html')).to_have_attribute('data-theme','light');await expect(t.locator('#sessionCode')).to_have_text(code)
   for duration in [-1,86400,1.5,'60']:
    r=await tc.request.post(BASE+'/api/sessions',data={'title':'Validation','question':'Question','options':['A','B'],'durationSeconds':duration});assert r.status==400,(duration,r.status)
   await tc.close();await pc.close()
  assert not errors,errors
  result={'passed':True,'url':BASE,'languages':['ar','en'],'widths':[320,390,1280],'checks':['dark/light preference and controls','timer off by default','minute and second validation','named polls and text with timer','trainer and participant countdown','manual close/reopen does not reset deadline','answer before cutoff accepted','late browser submit disabled','direct late API rejected','expired timer cannot reopen','refresh preserves deadline and results','untimed regression','theme switch preserves trainer session','no JS errors']};(OUT/'result.json').write_text(json.dumps(result,indent=2));print(json.dumps(result));await b.close()
server=None
try:
 if 'TEST_URL' not in os.environ:
  log=open('/tmp/roompulse-timer-dev.log','w');server=subprocess.Popen(['npx','wrangler','dev','--port','8787','--local'],cwd=P,stdout=log,stderr=log,start_new_session=True)
  for i in range(60):
   try:urllib.request.urlopen(BASE,timeout=1);break
   except Exception:time.sleep(.5)
 asyncio.run(main())
finally:
 if server:os.killpg(server.pid,signal.SIGTERM);server.wait();log.close()
