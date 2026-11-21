import asyncio,os,json
from pathlib import Path
from playwright.async_api import async_playwright,expect
BASE=os.getenv('TEST_URL','https://roompulse.s21smk.workers.dev')
async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(headless=True,executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
  page=await browser.new_page(viewport={'width':390,'height':844},device_scale_factor=1)
  errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  for lang in ['ar','en']:
   await page.goto(BASE+'/?lang='+lang);await page.locator('#startTrainer').click()
   for id in ['title','question','option0','option1','option2']:await expect(page.locator('#'+id)).to_have_value('')
   await page.locator('#lang'+('EN' if lang=='ar' else 'AR')).click()
   for id in ['title','question','option0','option1','option2']:await expect(page.locator('#'+id)).to_have_value('')
   await page.locator('#create').click();await expect(page.locator('#globalError')).not_to_be_empty();await expect(page.locator('#setup')).to_be_visible()
   await page.locator('#title').fill('My title');await page.locator('#question').fill('My question');await page.locator('#langEN').click();await expect(page.locator('#title')).to_have_value('My title');await expect(page.locator('#question')).to_have_value('My question')
   await page.screenshot(path=f'/downloads/roompulse-bilingual/empty-{lang}.png',full_page=True)
   await page.locator('#bankPanel').evaluate('(el)=>el.open=true');await page.locator('[data-bank]').first.click();await expect(page.locator('#question')).not_to_have_value('')
  assert not errors,errors
  print(json.dumps({'passed':True,'languages':['ar','en'],'fields':5,'validation':True,'preservesUserText':True,'bank':True,'jsErrors':errors}))
  await browser.close()
asyncio.run(main())
