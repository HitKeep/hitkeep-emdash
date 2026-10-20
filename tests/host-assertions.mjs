import assert from 'node:assert/strict';
export async function checkHost(base) {
 const get = async path => {const response=await fetch(base+path);return {status:response.status,html:await response.text(),headers:Object.fromEntries(response.headers)}};
 const settings = async (body) => {const response=await fetch(base+'/fixture/settings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:response.status,data:await response.json()}};
 const scripts = html => [...html.matchAll(/<script\b[^>]*src="([^"]*\/hk\.js)"[^>]*>/g)].map(m=>m[0]);
 let result=await settings({values:{enabled:null,baseUrl:null}});assert.equal(result.status,200,JSON.stringify(result));
 assert.equal(result.data.data.values.enabled,false);
 assert.equal(result.data.data.values.baseUrl,'');
 assert.equal(scripts((await get('/')).html).length,0);
 for(const role of [null,10,40]) {
  result=await settings({role,values:{enabled:true}});assert.equal(result.status,role === null ? 401 : 403,JSON.stringify(result));
 }
 assert.equal((await settings({values:{enabled:'true'}})).status,400);
 for(const baseUrl of ['https://analytics.invalid','https://analytics.invalid/prefix/','https://custom.invalid/a-b_2/v1.0']) {
  assert.equal((await settings({values:{enabled:true,baseUrl}})).status,200);
  for(const path of ['/','/de/second']) {
   const response=await get(path);assert.equal(response.status,200);const tags=scripts(response.html);assert.equal(tags.length,1,response.html);assert.match(tags[0],/ async(?:[ =>])/);assert.ok(tags[0].includes(baseUrl.replace(/\/+$/,'')+'/hk.js'));
  }
 }
 for(const path of ['/missing-head','/consent','/?_preview=invalid','/?_edit=false','/_emdash/admin']) assert.equal(scripts((await get(path)).html).length,0,path);
 for(const baseUrl of ['http://analytics.invalid','https://user:secret@analytics.invalid','https://analytics.invalid?x=1','https://analytics.invalid/#x','https://analytics.invalid/../secret']) {
  await settings({values:{enabled:true,baseUrl}});
  assert.equal(scripts((await get('/')).html).length,0,baseUrl);
 }
 await settings({values:{enabled:true,baseUrl:'https://analytics.invalid/prefix'}});
 assert.equal(scripts((await get('/cached')).html).length,1);
 await settings({values:{enabled:false}});
 assert.equal(scripts((await get('/')).html).length,0);
 // A route-cache hit may bypass settings reads. Keep this observation in the report.
 const cachedAfterDisable=scripts((await get('/cached')).html).length;
 await settings({values:{enabled:true}});
 const policy=await get('/blocked-script');assert.equal(policy.headers['content-security-policy'],"script-src 'self'; connect-src 'none'");
 assert.equal(scripts(policy.html).length,1);
 const unauth=await fetch(base+'/_emdash/api/admin/plugins/hitkeep/settings');assert.equal(unauth.status,401);
 console.log(JSON.stringify({base,passed:true,cachedAfterDisable,checks:'generated settings defaults, type validation, 401/403 role denial, persisted root/prefix/custom URL, one async script, language routes, missing seam, consent route, preview/edit/admin suppression, unsafe URL rejection, disable, CSP header, real unauthenticated API'},null,2));
 return {cachedAfterDisable,settings,get,scripts};
}
if(process.argv[1]?.endsWith('host-assertions.mjs')) await checkHost(process.argv[2]);
