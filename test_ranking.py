import asyncio,os,json,re
from pathlib import Path
from playwright.async_api import async_playwright,expect
BASE=os.getenv('TEST_URL','http://127.0.0.1:8787');OUT=Path(__file__).parent/'tests-ranking';OUT.mkdir(exist_ok=True)
async def main():
 async with async_playwright() as pw:
  b=await pw.chromium.launch(executable_path='/usr/bin/google-chrome',headless=True,args=['--no-sandbox']);errors=[]
  req=await pw.request.new_context(base_url=BASE)
  async def call(path,body=None,token=None,status=200):
   r=await req.fetch('/api'+path,method='POST' if body is not None else 'GET',data=body,headers={'Authorization':'Bearer '+token} if token else {})
   d=await r.json();assert r.status==status,(path,r.status,d);return d
  payload={'mode':'ranking','identity':'named','title':'Ranking round','question':'Pick B','options':['A','B','C'],'hasCorrect':True,'correctChoice':1,'durationSeconds':0}
  await call('/sessions',{**payload,'correctChoice':3},status=400)
  one=await call('/sessions',payload,status=201);code=one['code'];token=one['token']
  public=await call('/sessions/'+code);assert public['hasCorrect'] is True and 'correctChoice' not in public and 'leaderboard' not in public
  await call('/sessions/'+code+'/results',status=403)
  await call('/sessions/'+code+'/vote',{'client':'wrong','name':'Wrong first','choice':0},status=201)
  await asyncio.sleep(.08)
  await call('/sessions/'+code+'/vote',{'client':'alice','name':'Alice <script>','choice':1,'received':0,'elapsedMs':0},status=201)
  await asyncio.sleep(.08)
  await call('/sessions/'+code+'/vote',{'client':'bob','name':'Bob','choice':1},status=201)
  duplicate=await call('/sessions/'+code+'/vote',{'client':'bob','name':'changed','choice':0});assert duplicate.get('duplicate')
  x=await call('/sessions/'+code+'/results',token=token);assert x['leaderboard']==[] and x['total']==3
  await call('/sessions/'+code+'/status',{'open':False},token)
  x=await call('/sessions/'+code+'/results',token=token);assert [a['name'] for a in x['leaderboard']]==['Alice <script>','Bob'];assert [a['points'] for a in x['leaderboard']]==[1000,500];assert x['leaderboard'][0]['elapsedMs']>0
  await call('/sessions',{**payload,'rankingRound':{'code':code,'token':'bad'}},status=403)
  await call('/sessions',{**payload,'identity':'anonymous','rankingRound':one},status=400)
  two=await call('/sessions',{**payload,'question':'Fastest only','hasCorrect':False,'rankingRound':one},status=201)
  await call('/sessions/'+two['code']+'/vote',{'client':'bob','name':'Bob','choice':0},status=201);await asyncio.sleep(.08)
  await call('/sessions/'+two['code']+'/vote',{'client':'alice','name':'Alice <script>','choice':2},status=201)
  await call('/sessions/'+two['code']+'/finish',{},two['token'])
  x=await call('/sessions/'+two['code']+'/results',token=two['token']);assert x['roundEnded'] and [a['points'] for a in x['roundLeaderboard']]==[1500,1500,0];assert [a['rank'] for a in x['roundLeaderboard']]==[1,1,3]
  await call('/sessions/'+code+'/status',{'open':True},token,status=409)
  await call('/sessions',{**payload,'rankingRound':two},status=409)
  await call('/sessions/'+two['code']+'/vote',{'client':'late','name':'late','choice':0},status=409)
  anon=await call('/sessions',{**payload,'identity':'anonymous','hasCorrect':False,'durationSeconds':2},status=201)
  await call('/sessions/'+anon['code']+'/vote',{'client':'anon','choice':2},status=201)
  await asyncio.sleep(2.1)
  await call('/sessions/'+anon['code']+'/vote',{'client':'late','choice':1},status=409)
  ax=await call('/sessions/'+anon['code']+'/results',token=anon['token']);assert ax['rankingReady'] and len(ax['leaderboard'])==1 and 'name' not in ax['leaderboard'][0]
  await call('/sessions/'+anon['code']+'/status',{'open':True},anon['token'],status=409)
  # Timed ranking reveals at zero without closing manually.
  timerctx=await b.new_context();tp=await timerctx.new_page();await tp.goto(BASE+'/?lang=en');await tp.locator('#startTrainer').click();await tp.locator('#modeRanking').click();await tp.locator('#title').fill('Timed ranking');await tp.locator('#question').fill('Choose quickly')
  for i in range(3):await tp.locator('#option'+str(i)).fill(str(i+1))
  await tp.locator('#timerOn').click();await tp.locator('#timerMinutes').fill('0');await tp.locator('#timerSeconds').fill('3');await tp.locator('#create').click();await expect(tp.locator('#trainer')).to_be_visible();tc=await tp.locator('#sessionCode').inner_text();await call('/sessions/'+tc+'/vote',{'client':'timed-ui','choice':0},status=201);await expect(tp.locator('#trainerCountdown .countdown-value')).to_have_text('00:00',timeout=10000);await expect(tp.locator('#rankingList')).to_contain_text('1000');await timerctx.close()
  # full UI, two questions and a final round, both languages, no changes to guest flow
  for lang in ['ar','en']:
   ctx=await b.new_context(viewport={'width':390,'height':844});t=await ctx.new_page();t.on('pageerror',lambda e:errors.append(str(e)))
   await t.goto(BASE+'/?lang='+lang);await t.locator('#startTrainer').click();await t.locator('#modeRanking').click();await t.locator('#rankingHasCorrect').click();await t.locator('#title').fill('Quiz round');await t.locator('#question').fill('Which option is correct?')
   for i in range(3):await t.locator('#option'+str(i)).fill(['First','Second','Third'][i])
   await t.locator('#correctChoice').select_option('1');await t.locator('#identityNamed').click();await t.locator('#themeToggle').click()
   await t.screenshot(path=str(OUT/f'{lang}-setup-dark.png'),full_page=True)
   await t.locator('#create').click();await expect(t.locator('#sessionCode')).to_have_text(re.compile(r'\d{6}'));c=await t.locator('#sessionCode').inner_text()
   pc=await b.new_context(viewport={'width':390,'height':844});a=await pc.new_page();await a.goto(BASE+'/join?code='+c+'&lang='+lang);await a.locator('#participantName').fill('سارة / Sara');await a.locator('[data-choice="1"]').click();await a.locator('#vote').click();await expect(a.locator('#voteStatus')).to_be_visible();await t.evaluate('refreshTrainer()');await expect(t.locator('#rankingList')).to_be_empty();await t.locator('#toggle').click();await expect(t.locator('#rankingList')).to_contain_text('سارة / Sara')
   await t.screenshot(path=str(OUT/f'{lang}-question-ranking.png'),full_page=True)
   await t.locator('#nextRanking').click();await expect(t.locator('#continuingRanking')).to_be_visible();await t.locator('#rankingNoCorrect').click();await t.locator('#question').fill('Fastest answer')
   for i in range(3):await t.locator('#option'+str(i)).fill(['Yes','No','Maybe'][i])
   await t.locator('#create').click();await expect(t.locator('#trainer')).to_be_visible();c2=await t.locator('#sessionCode').inner_text();assert c2!=c
   await a.goto(BASE+'/join?code='+c2+'&lang='+lang);await a.locator('[data-choice="0"]').click();await a.locator('#vote').click();await expect(a.locator('#voteStatus')).to_be_visible()
   t.on('dialog',lambda d:d.accept());await t.locator('#finishRanking').click();await expect(t.locator('#roundResults')).to_be_visible();await expect(t.locator('#roundList')).to_contain_text('2000');await expect(t.locator('#toggle')).to_be_disabled();await t.reload();await t.locator('#resume').click();await expect(t.locator('#roundList')).to_contain_text('2000')
   await t.screenshot(path=str(OUT/f'{lang}-round-final-mobile.png'),full_page=True);await t.set_viewport_size({'width':1280,'height':900});await t.screenshot(path=str(OUT/f'{lang}-round-final-desktop.png'),full_page=True)
   await t.locator('#lang'+('EN' if lang=='ar' else 'AR')).click();await expect(t.locator('#roundList')).to_contain_text('2000')
   await t.set_viewport_size({'width':320,'height':844});assert await t.evaluate('document.documentElement.scrollWidth<=innerWidth')
   await ctx.close();await pc.close()
  assert not errors,errors
  await b.close();await req.dispose();(OUT/'result.json').write_text(json.dumps({'passed':True,'checks':['correctness','fastest-only','cumulative','ties','privacy','auth','immutable-vote','server-timing','timer-cutoff','round-end','AR/EN','refresh','320/390/1280'],'jsErrors':errors}));print((OUT/'result.json').read_text())
asyncio.run(main())
