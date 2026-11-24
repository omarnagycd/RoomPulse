import asyncio,re,os
from playwright.async_api import async_playwright,expect
BASE=os.getenv('BASE','http://localhost:8799');OUT='/downloads/qm/shots3/';os.makedirs(OUT,exist_ok=True)
async def main():
 async with async_playwright() as p:
  br=await p.chromium.launch(executable_path='/usr/bin/google-chrome',headless=True,args=['--no-sandbox'])
  errs=[];ctx=await br.new_context(viewport={'width':1280,'height':900})
  h=await ctx.new_page();h.on('pageerror',lambda e:errs.append(str(e)));h.on('dialog',lambda d:asyncio.ensure_future(d.accept()))
  await h.goto(BASE+'/?lang=ar');await h.locator('#quizTab').click()
  await h.locator('#qpass').fill('omar1234');await h.locator('#qpass2').fill('omar1234');await h.locator('#qauth').click()
  await expect(h.locator('#qnew')).to_be_visible()
  await h.locator('#qfile').set_input_files('/tmp/test30.xlsx');await expect(h.locator('.qqcard')).to_have_count(31,timeout=10000)
  await h.locator('#qtitle').fill('end test');await h.locator('#qsave').click();await expect(h.locator('.qitem')).to_have_count(1)
  # game 1: end from library notice
  await h.locator('[data-a=run]').click();await h.locator('#qgo').click()
  await expect(h.locator('.qcode')).to_have_text(re.compile(r'\d{6}'),timeout=15000)
  await expect(h.locator('#qendgame')).to_be_visible();await h.screenshot(path=OUT+'01-lobby-end.png')
  await h.locator('#qleave').click();await expect(h.locator('#qresume')).to_be_visible();await expect(h.locator('#qendlib')).to_be_visible()
  await h.screenshot(path=OUT+'02-library-end.png')
  await h.locator('#qendlib').click();await expect(h.locator('#qresume')).to_have_count(0,timeout=10000);print('end from library ok')
  # game 2: end from the game page
  await h.locator('[data-a=run]').click();await h.locator('#qgo').click()
  await expect(h.locator('#qendgame')).to_be_visible(timeout=15000)
  await h.locator('#qendgame').click();await expect(h.locator('#qendgame')).to_have_count(0,timeout=10000);print('end from game page ok')
  await h.screenshot(path=OUT+'03-ended.png')
  await h.locator('#qdone').click();await expect(h.locator('#qnew')).to_be_visible()
  await h.locator('#qhist').click();await expect(h.locator('.qitem')).to_have_count(2,timeout=10000);print('history has 2 games')
  await h.screenshot(path=OUT+'04-history.png')
  print('JS errors',errs);await br.close()
asyncio.run(main())
