// Run through ego-browser nodejs; all analytics URLs use the reserved .invalid TLD.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
export async function checkBrowser({spaceId,base,trackerPath,reportPath,clientNavigation=false}) {
 await fetch(base+'/fixture/settings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({values:{enabled:true,baseUrl:'https://analytics.invalid/prefix'}})});
 const task=await taskSpace(spaceId);const page=task.page('p1');
 const body=(await fs.readFile(trackerPath)).toString('base64');
 const report={};let requests=[],failures=[];
 await page.cdp('Network.enable');
 await page.cdp('Network.setBlockedURLs',{urls:['https://analytics.invalid/*ingest*']});
 await page.cdp('Fetch.enable',{patterns:[{urlPattern:'https://analytics.invalid/*hk.js',requestStage:'Request'}]});
 async function drain(offline=false) {
  for(let i=0;i<15;i++) {
   const events=await page.events();
   for(const e of events) {
    if(e.method==='Network.requestWillBeSent' && e.params.request.url.startsWith('https://analytics.invalid/')) { const request=e.params.request; if(request.method==='POST' && !request.postData) { try { request.postData=(await page.cdp('Network.getRequestPostData',{requestId:e.params.requestId})).postData; } catch {} } requests.push(request); }
    if(e.method==='Network.loadingFailed') failures.push(e.params);
    if(e.method==='Fetch.requestPaused') {
     if(offline) await page.cdp('Fetch.failRequest',{requestId:e.params.requestId,errorReason:'InternetDisconnected'});
     else await page.cdp('Fetch.fulfillRequest',{requestId:e.params.requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:'application/javascript'}],body});
    }
   }
   await new Promise(r=>setTimeout(r,100));
  }
 }
 const normal=await page.cdp('Page.addScriptToEvaluateOnNewDocument',{source:'Object.defineProperty(navigator,"doNotTrack",{get:()=>"0",configurable:true});localStorage.setItem("hk_ignore","false");window.fixtureSends=[];Object.defineProperty(navigator,"sendBeacon",{value:(url,body)=>{const row={url};window.fixtureSends.push(row);body.text().then(text=>row.payload=JSON.parse(text));return true},configurable:true});'});
 try {
  await page.goto(base+'/',{waitUntil:'domcontentloaded'});await drain();
  const posts=()=>requests.filter(x=>x.method==='POST');
  const pageviews=()=>new Set(posts().filter(x=>x.postData).map(x=>JSON.parse(x.postData).page_id));
  await page.waitForFunction(()=>window.fixtureSends?.length===1,undefined,{timeout:5000});
  assert.equal((await page.evaluate(()=>window.fixtureSends)).length,1);
  await page.evaluate(()=>window.fixtureMarker=true);
  if(!clientNavigation) await page.evaluate(()=>document.querySelector('a[href="/de/second"]').setAttribute('data-astro-reload',''));
  await page.snapshot();
  await page.click('a[href="/de/second"]');await page.waitForURL(base+'/de/second');await drain();
  assert.equal(await page.evaluate(()=>Boolean(window.fixtureMarker)),clientNavigation);
  await page.waitForFunction(()=>window.fixtureSends?.some(x=>x.payload?.path==='/de/second'),undefined,{timeout:5000});
  assert.equal(await page.evaluate(()=>[...document.scripts].filter(x=>x.src.includes('/hk.js')).length),1);
  report.navigation={initialPageviews:1,mode:clientNavigation?'ClientRouter':'full document',totalPageviews:(clientNavigation?0:1)+(await page.evaluate(()=>window.fixtureSends)).length,expectedTotalPageviews:2,transport:'instrumented sendBeacon returning success; no network collection',sends:await page.evaluate(()=>window.fixtureSends)};
  await page.cdp('Page.removeScriptToEvaluateOnNewDocument',{identifier:normal.identifier});
  for(const [name,source] of [['dnt','Object.defineProperty(navigator,"doNotTrack",{get:()=>"1",configurable:true});localStorage.setItem("hk_ignore","false");'],['optout','Object.defineProperty(navigator,"doNotTrack",{get:()=>"0",configurable:true});localStorage.setItem("hk_ignore","true");']]) {
   const script=await page.cdp('Page.addScriptToEvaluateOnNewDocument',{source});
   requests=[];await page.goto(base+'/',{waitUntil:'domcontentloaded'});await drain();
   assert.equal(posts().length,0);assert.equal(requests.filter(x=>x.url.endsWith('/hk.js')).length,1);
   report[name]={pageviews:0};await page.cdp('Page.removeScriptToEvaluateOnNewDocument',{identifier:script.identifier});
  }
  requests=[];failures=[];await page.goto(base+'/blocked-script',{waitUntil:'domcontentloaded'});await drain();
  assert.ok(failures.some(x=>x.blockedReason==='csp'),JSON.stringify(failures));report.cspBlocked=true;
  requests=[];await page.goto(base+'/consent',{waitUntil:'domcontentloaded'});await drain();
  assert.equal(requests.length,0);report.consentRouteNoRequests=true;
  requests=[];await page.goto(base+'/',{waitUntil:'domcontentloaded'});await drain(true);
  assert.ok((await page.title()).includes('HitKeep'));report.offlineRenders=true;
  await fs.writeFile(reportPath,JSON.stringify(report,null,2));console.log(report);
  assert.equal(report.navigation.totalPageviews,2,'Astro navigation emitted a duplicate old-route pageview; see '+reportPath);
 } finally {await page.cdp('Fetch.disable');await page.cdp('Network.setBlockedURLs',{urls:[]});}
}
