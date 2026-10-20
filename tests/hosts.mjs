import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import fs from 'node:fs/promises';
import {createWriteStream} from 'node:fs';
import {createServer} from 'node:net';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {checkHost} from './host-assertions.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const host=process.argv[2] ?? 'node';
assert.ok(['node','cloudflare'].includes(host));
const cwd=path.join(root,'fixtures',host);
const logs=await fs.mkdtemp(path.join(tmpdir(),'hitkeep-emdash-'+host+'-'));
console.log('Evidence directory:',logs);
async function command(args,name,env={},directory=cwd) {
 const log=createWriteStream(path.join(logs,name+'.log'));
 const child=spawn(args[0],args.slice(1),{cwd:directory,env:{...process.env,...env},stdio:['ignore','pipe','pipe']});
 child.stdout.pipe(log);child.stderr.pipe(log);
 const [code]=await once(child,'exit');log.end();
 assert.equal(code,0,name+' failed; see '+path.join(logs,name+'.log'));
}
await command(['npm','pack','--json'],'pack',{},root);
await command(['npm','install','--ignore-scripts','../../hitkeep-emdash-0.1.0.tgz'],'install');
await command(['npm','run','build'],'build');
const socket=createServer();await new Promise(r=>socket.listen(0,'::1',r));const port=socket.address().port;await new Promise(r=>socket.close(r));
let child;
async function start(name) {
 const log=createWriteStream(path.join(logs,name+'.log'));
 const args=host==='node'?[process.execPath,'dist/server/entry.mjs']:['./node_modules/.bin/wrangler','dev','--config','dist/server/wrangler.json','--ip','::1','--port',String(port),'--local'];
 child=spawn(args[0],args.slice(1),{cwd,env:{...process.env,HOST:'::1',PORT:String(port)},stdio:['ignore','pipe','pipe'],detached:true});
 child.stdout.pipe(log);child.stderr.pipe(log);
 const url='http://[::1]:'+port;
 for(let attempt=0;attempt<90;attempt++) {
  if(child.exitCode!==null) throw new Error('Host exited; see '+logs);
  try {const response=await fetch(url+'/');if(response.status>=500) throw new Error('Runtime returned '+response.status+'; see '+logs);return url;} catch(error) {if(error.message.includes('Runtime returned')) throw error;}
  await new Promise(r=>setTimeout(r,500));
 }
 throw new Error('Host did not become ready; see '+logs);
}
async function stop() {if(child?.exitCode===null) {const exited=once(child,'exit');process.kill(-child.pid,'SIGTERM');await exited;}}
try {
 const base=await start('runtime');const result=await checkHost(base);
 if(host==='node') {
  assert.equal(result.cachedAfterDisable,1);
  await result.settings({values:{enabled:false}});
  assert.equal(result.scripts((await result.get('/cached')).html).length,1);
  assert.equal((await fetch(base+'/fixture/purge',{method:'POST'})).status,200);
  assert.equal(result.scripts((await result.get('/cached')).html).length,0);
 }
 await stop();
 await command(['npm','run','build'],'removed-build',{FIXTURE_UNINSTALLED:'1'});
 const removed=await start('removed-runtime');
 assert.doesNotMatch(await (await fetch(removed+'/')).text(),/src="https:\/\/analytics\.invalid[^\"]*\/hk\.js"/);
 console.log('PASS: packaged '+host+' installation, settings, rendering, disable, cache and descriptor removal');
} finally {await stop();}
