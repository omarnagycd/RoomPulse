import asyncio,sys;sys.path.insert(0,"quiz");import tt;tt.seed();import re,os
from playwright.async_api import async_playwright,expect
BASE=os.getenv('BASE','http://localhost:8799');OUT='/downloads/qm/shots5/';os.makedirs(OUT,exist_ok=True)
async def main():
 async with async_playwright() as p:
  br=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox','--autoplay-policy=no-user-gesture-required'])
  errs=[]
  async def newpage(w,h,theme='light'):
   c=await br.new_context(viewport={'width':w,'height':h});pg=await c.new_page();pg.on('pageerror',lambda e:errs.append(str(e)));pg.on('dialog',lambda d:asyncio.ensure_future(d.accept()))
   await pg.add_init_script("localStorage.setItem('roompulse.theme','%s')"%theme);return pg
  h=await newpage(1280,900);await h.goto(BASE+'/?lang=ar');await h.wait_for_timeout(800);await h.screenshot(path=OUT+'01-activities-light.png')
  await h.locator('#quizTab').click()
  await h.locator('#qem').fill('t@x.com');await h.locator('#qpass').fill('secret12');await h.locator('#qauth').click()
  await expect(h.locator('#qnew')).to_be_visible()
  await h.locator('#qnew').click();await h.locator('#qtitle').fill('كويز الحيوانات')
  await h.locator('#qsave').click();await expect(h.locator('#qtoast')).to_be_visible();print('toast ok');await h.screenshot(path=OUT+'02-toast.png')
  await h.locator('.qqcard [data-f=text]').first.fill('ده أنهي حيوان؟');o=h.locator('.qqcard').first.locator('input[data-f=opt]')
  for i,v in enumerate(['باندا','أسد','ثعلب']):await o.nth(i).fill(v)
  await h.locator('#qsave').click();await expect(h.locator('.qitem')).to_have_count(1)
  await h.wait_for_timeout(800);await h.screenshot(path=OUT+'03-quiz-home-light.png',full_page=True)
  await expect(h.locator('.qsc')).to_have_count(4);print('stats ok')
  # sticky/shrink
  await h.evaluate("document.body.style.minHeight='3000px'");await h.evaluate("window.scrollTo(0,600)");await h.wait_for_timeout(500)
  print('shrunk',await h.evaluate("document.querySelector('header').classList.contains('hdr-s')"),'top',await h.evaluate("Math.round(document.querySelector('header').getBoundingClientRect().top)"))
  await h.screenshot(path=OUT+'04-sticky.png');await h.evaluate("window.scrollTo(0,0)");await h.wait_for_timeout(500)
  print('restored',not await h.evaluate("document.querySelector('header').classList.contains('hdr-s')"))
  # game with avatar
  await h.locator('[data-a=run]').click();await h.locator('#qcls').fill('Class A');await h.locator('#qgo').click();await expect(h.locator('.qcode')).to_have_text(re.compile(r'\d{6}'),timeout=15000);code=await h.locator('.qcode').inner_text()
  m=await newpage(390,800);await m.goto(BASE+'/join?code='+code+'&lang=ar');await expect(m.locator('.qavpick')).to_have_count(8,timeout=15000)
  await m.locator('.qavpick').nth(1).click();await m.locator('#qname').fill('سارة');await m.screenshot(path=OUT+'05-player-name-phone.png')
  await m.locator('#qjoin').click();await h.wait_for_timeout(2500);await expect(h.locator('.qchip .qav')).to_have_count(1);print('avatar in lobby ok');await h.screenshot(path=OUT+'06-lobby.png')
  await h.locator('#qstart').click();await m.locator('button.qa').first.click() if False else None
  await expect(m.locator('button.qa').first).to_be_visible(timeout=15000);await m.locator('button.qa').first.click();await h.wait_for_timeout(2500)
  await expect(h.locator('#qnext')).to_be_visible(timeout=15000);await h.locator('#qnext').click()
  await expect(m.locator('.qpod .qav')).to_have_count(1,timeout=10000);await m.screenshot(path=OUT+'07-player-final-phone.png');print('avatar on podium ok')
  # dark + phone
  d=await newpage(390,800,'dark');await d.goto(BASE+'/?lang=ar');await d.wait_for_timeout(800);await d.screenshot(path=OUT+'08-activities-dark-phone.png')
  d2=await newpage(1280,900,'dark');await d2.goto(BASE+'/?lang=ar');await d2.wait_for_timeout(800);await d2.screenshot(path=OUT+'09-activities-dark.png')
  l=await newpage(390,800);await l.goto(BASE+'/?lang=ar');await l.wait_for_timeout(800);await l.screenshot(path=OUT+'10-activities-light-phone.png')
  print('JS errors',errs);await br.close()
asyncio.run(main())
