import asyncio,json,os,math
from pathlib import Path
from playwright.async_api import async_playwright,expect
BASE=os.getenv('TEST_URL','http://127.0.0.1:8787');OUT=Path(__file__).parent/'tests-wheel';OUT.mkdir(exist_ok=True)
async def main():
 async with async_playwright() as p:
  b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',headless=True,args=['--no-sandbox']);errors=[]
  for lang in ['ar','en']:
   ctx=await b.new_context(viewport={'width':390,'height':844},reduced_motion='reduce');page=await ctx.new_page();page.on('pageerror',lambda e:errors.append(str(e)));sends=[];page.on('request',lambda r:sends.append(r.url) if '/api/' in r.url else None)
   await page.goto(BASE+'/?lang='+lang);await page.locator('#wheelTab').click();await expect(page.locator('#wheel')).to_be_visible();await expect(page.locator('#wheelSpin')).to_be_disabled();await page.locator('#wheelEntries').fill('Only one');await expect(page.locator('#wheelSpin')).to_be_disabled()
   entries=['سارة','Omar','42','جائزة: كتاب','<img src=x onerror=alert(1)>'];await page.locator('#wheelEntries').fill('\n'.join(entries));await page.evaluate('wheelRandomIndex=()=>2');await page.locator('#wheelSpin').click();await expect(page.locator('#wheelWinner')).to_have_text('42');index=await page.evaluate('Math.floor((((-wheelRotation)%(2*Math.PI))+2*Math.PI)%(2*Math.PI)/(2*Math.PI/wheelItems.length))');assert index==2,index
   await page.locator('#lang'+('EN' if lang=='ar' else 'AR')).click();await expect(page.locator('#wheelWinner')).to_have_text('42');await expect(page.locator('#wheelEntries')).to_have_value('\n'.join(entries));await page.locator('#lang'+('AR' if lang=='ar' else 'EN')).click();await page.evaluate('wheelRandomIndex=()=>4');await page.locator('#wheelSpin').click();await expect(page.locator('#wheelWinner')).to_have_text(entries[4]);assert await page.locator('#wheelWinner img').count()==0
   await page.locator('#wheelEntries').fill('سارة\nعمر\nنور\nأحمد\n42\nجائزة');await page.evaluate('wheelRandomIndex=()=>1');await page.locator('#wheelSpin').click()
   for theme in ['light','dark']:
    if await page.locator('html').get_attribute('data-theme')!=theme:await page.locator('#themeToggle').click()
    for w in [320,390,1280]:
     await page.set_viewport_size({'width':w,'height':900});assert await page.evaluate('document.documentElement.scrollWidth<=innerWidth');await page.screenshot(path=str(OUT/f'{lang}-{theme}-{w}.png'),full_page=True)
   await page.locator('#wheelEntries').fill('\n'.join('Entry '+str(i) for i in range(200)));await expect(page.locator('#wheelSpin')).to_be_enabled();await page.evaluate('wheelRandomIndex=()=>199');await page.locator('#wheelSpin').click();await expect(page.locator('#wheelWinner')).to_have_text('Entry 199')
   await page.locator('#wheelEntries').fill('\n'.join(str(i) for i in range(201)));await expect(page.locator('#wheelSpin')).to_be_disabled();await page.locator('#wheelEntries').fill('A'*101+'\nB');await expect(page.locator('#wheelSpin')).to_be_disabled();await page.locator('#wheelEntries').fill(' A \n\n B \nA');assert await page.evaluate('JSON.stringify(wheelEntries())')=='["A","B","A"]'
   assert not sends,sends
   await page.reload();await page.locator('#wheelTab').click();await expect(page.locator('#wheelEntries')).to_have_value('');await expect(page.locator('#wheelResult')).to_be_hidden();await ctx.close()
  # Actual animated spin, locked editing, repeat spin keeps entries, final pointer agrees.
  ctx=await b.new_context(viewport={'width':1280,'height':900});page=await ctx.new_page();await page.goto(BASE+'/?lang=en');await page.locator('#openWheel').click();await page.locator('#wheelEntries').fill('One\nTwo\nThree\nFour');await page.locator('#wheelSpin').click();await expect(page.locator('#wheelEntries')).to_be_disabled();await expect(page.locator('#wheelClear')).to_be_disabled();await expect(page.locator('#wheelResult')).to_be_visible(timeout=8000);result=await page.evaluate('({winner:wheelWinner,pointer:Math.floor((((-wheelRotation)%(2*Math.PI))+2*Math.PI)%(2*Math.PI)/(2*Math.PI/wheelItems.length))})');assert result['winner']==result['pointer'],result;await expect(page.locator('#wheelEntries')).to_have_value('One\nTwo\nThree\nFour');await ctx.close();assert not errors,errors
  print(json.dumps({'passed':True,'url':BASE,'checks':['AR/EN','dark/light','320/390/1280','blank/one/max/long validation','names/numbers/items','crypto winner and pointer match','actual animation','reduced motion','locked edits','safe literal output','same entries after repeat','no API traffic','refresh clears entries'],'jsErrors':errors}));await b.close()
asyncio.run(main())
