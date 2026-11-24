import asyncio,re,os,json
from playwright.async_api import async_playwright,expect
BASE=os.getenv('BASE','http://localhost:8799');OUT='/downloads/qm/shots2/';os.makedirs(OUT,exist_ok=True)
async def main():
 async with async_playwright() as p:
  br=await p.chromium.launch(executable_path='/usr/bin/google-chrome',headless=True,args=['--no-sandbox'])
  errs=[]
  ctx=await br.new_context(viewport={'width':1280,'height':900},accept_downloads=True,permissions=['clipboard-read','clipboard-write'])
  host=await ctx.new_page()
  ph=[await (await br.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)).new_page() for _ in range(2)]
  for pg in [host]+ph: pg.on('pageerror',lambda e:errs.append(str(e)))
  await host.goto(BASE+'/?lang=ar');await host.locator('#quizTab').click()
  await host.locator('#qpass').fill('omar1234');await host.locator('#qpass2').fill('omar1234');await host.locator('#qauth').click()
  await expect(host.locator('#qnew')).to_be_visible()
  # template download
  async with host.expect_download() as d: await host.locator('#qtpl').click()
  dl=await d.value;await dl.save_as('/downloads/quiz-template.xlsx');print('template',dl.suggested_filename)
  await host.screenshot(path=OUT+'01-library.png')
  # import the template itself (must parse: 3 questions + cloud)
  await host.locator('#qfile').set_input_files('/downloads/quiz-template.xlsx')
  await expect(host.locator('.qqcard')).to_have_count(4,timeout=10000);print('template re-import: 4 cards')
  await host.locator('#qcancel').click()
  # import 30 q xlsx
  await host.locator('#qfile').set_input_files('/tmp/test30.xlsx')
  await expect(host.locator('.qqcard')).to_have_count(31,timeout=10000)
  v=await host.locator('[data-f=points]').evaluate_all('e=>e.map(x=>x.value)');print('points first/second',v[0],v[1],len(v))
  assert v[0]=='20' and v[1]=='10'
  await host.locator('[data-f=points]').nth(1).fill('15')
  await host.locator('#qtitle').fill('تجربة ٣٠ سؤال');await host.screenshot(path=OUT+'02-builder-points.png')
  await host.locator('#qsave').click();await expect(host.locator('.qitem')).to_have_count(1)
  await host.locator('[data-a=run]').click();await host.locator('#qteams').click();await host.locator('#qgo').click()
  await expect(host.locator('.qcode')).to_have_text(re.compile(r'\d{6}'),timeout=15000)
  code=await host.locator('.qcode').inner_text()
  # share
  await host.evaluate("window.__sh=null;navigator.share=(o)=>{window.__sh=o;return Promise.resolve()}")
  await host.locator('#qshare').click();sh=await host.evaluate('window.__sh');print('share',json.dumps(sh,ensure_ascii=False))
  assert code in sh['text'] and 'code='+code in sh['url']
  await host.evaluate("navigator.share=undefined")
  await host.locator('#qshare').click();clip=await host.evaluate('navigator.clipboard.readText()');assert code in clip and 'code='+code in clip;print('clipboard ok')
  await host.screenshot(path=OUT+'03-lobby-share.png')
  for i,pg in enumerate(ph):
   await pg.goto(BASE+'/join?code='+code+'&lang=ar');await expect(pg.locator('#qname')).to_be_visible(timeout=15000)
   await pg.locator('#qname').fill(['منى','أحمد'][i]);await pg.locator('#qjoin').click()
   await expect(pg.locator('#quizPlayRoot')).to_contain_text('استنى المدرب',timeout=15000)
  await expect(host.locator('#qstart')).to_be_enabled(timeout=10000);await host.locator('#qstart').click()
  await expect(ph[0].locator('button.qa').first).to_be_visible(timeout=10000)
  await ph[0].locator('button.qa').nth(1).click()   # correct (q1 correct_number=2 -> index1)
  await asyncio.sleep(2.0)
  await ph[1].locator('button.qa').nth(1).click()
  await expect(host.locator('#qnext')).to_be_visible(timeout=10000)
  await asyncio.sleep(3)
  t0=await ph[0].locator('#quizPlayRoot').inner_text();t1=await ph[1].locator('#quizPlayRoot').inner_text()
  print('phone0:',re.findall(r'\+[\d.]+',t0),' phone1:',re.findall(r'\+[\d.]+',t1))
  await ph[0].screenshot(path=OUT+'04-phone-score.png')
  a=float(re.findall(r'\+([\d.]+)',t0)[0]);b=float(re.findall(r'\+([\d.]+)',t1)[0]);assert a>b and a<=20 and b>=10,(a,b)
  # end game through host API
  r=await host.evaluate("""async(c)=>{const h=JSON.parse(sessionStorage.getItem('quiz.host'));const x=await fetch('/api/quiz/game/'+c+'/host',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+h.token},body:JSON.stringify({action:'end'})});return x.status}""",code);print('end status',r)
  await host.reload();await host.locator('#quizTab').click()
  await expect(host.locator('#qhist')).to_be_visible(timeout=10000);await host.locator('#qhist').click()
  await expect(host.locator('#hlist .qitem')).to_have_count(1,timeout=10000)
  await host.screenshot(path=OUT+'05-history-list.png')
  await host.locator('[data-a=open]').click();await expect(host.locator('#hexp')).to_be_visible()
  txt=await host.locator('#quizRoot').inner_text();assert 'منى' in txt and 'أحمد' in txt;await host.screenshot(path=OUT+'06-history-detail.png',full_page=True)
  async with host.expect_download() as d: await host.locator('#hexp').click()
  dl=await d.value;pth=await dl.path();csv=open(pth,encoding='utf-8-sig').read();print(csv[:400]);assert 'Q1_points' in csv and 'منى' in csv
  await host.locator('#hback').click()
  host.on('dialog',lambda dg:asyncio.ensure_future(dg.accept()))
  await host.locator('[data-a=del]').click();await expect(host.locator('#hlist')).to_have_count(0,timeout=10000);print('history delete ok')
  await host.locator('#hlib').click()
  await host.locator('#langBtn,[data-lang=en]').first.click() if await host.locator('#langBtn,[data-lang=en]').count() else None
  print('JS errors:',errs)
  await br.close()
asyncio.run(main())
