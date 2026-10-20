import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runWithContext } from 'emdash/request-context';
import { createPublicPageContext } from 'emdash/page';
import { hitkeepPlugin } from '../dist/index.js';
import { createPlugin } from '../dist/plugin.js';

async function fragment(settings = { enabled: true, baseUrl: 'https://analytics.example.com/prefix' }, url = 'https://site.example.com/', requestContext) {
  const plugin = createPlugin();
  const invoke = () => plugin.hooks['page:fragments'].handler({ page: createPublicPageContext({ url: new URL(url), kind: 'custom', title: 'Test' }) }, { settings: { get: async key => settings[key] ?? null } });
  return requestContext ? runWithContext(requestContext, invoke) : invoke();
}

test('native descriptor identity matches runtime and has no client admin bundle', () => {
  assert.equal(hitkeepPlugin().id, createPlugin().id);
  assert.equal(hitkeepPlugin().version, createPlugin().version);
  assert.equal(hitkeepPlugin().format, 'native');
  assert.equal(hitkeepPlugin().adminEntry, undefined);
});
test('one async external script preserves the deployment prefix', async () => {
  assert.deepEqual(await fragment(), {kind:'external-script', placement:'head', src:'https://analytics.example.com/prefix/hk.js', async:true, key:'hitkeep-tracker'});
});
test('schema defaults and absent runtime settings keep collection disabled', async () => {
  assert.equal(createPlugin().admin.settingsSchema.enabled.default, false);
  assert.equal(createPlugin().admin.settingsSchema.baseUrl.default, '');
  for (const enabled of [undefined, false, 'true', 1, null]) assert.equal(await fragment({enabled,baseUrl:'https://analytics.example.com'}), null);
});
test('invalid configuration fails closed at the fragment boundary', async () => {
  for (const baseUrl of [undefined,null,22,'','/analytics','//analytics.example.com','http://analytics.example.com','javascript:alert(1)','https:analytics.example.com','https:///analytics.example.com','https://@analytics.example.com','https://user:password@analytics.example.com','https://analytics.example.com?','https://analytics.example.com?q=1','https://analytics.example.com#','https://analytics.example.com/#x','https://analytics.example.com/\nfoo',' https://analytics.example.com','https://analytics.example.com/<script>','https://analytics.example.com/"','https://analytics.example.com/../private','https://analytics.example.com/a%2fb','https://analytics.example.com/\\evil']) {
    assert.equal(await fragment({enabled:true,baseUrl}), null, String(baseUrl));
  }
});
test('valid root, trailing slash and custom host resolve only hk.js', async () => {
  for (const [baseUrl,src] of [['https://analytics.example.com','https://analytics.example.com/hk.js'],['https://analytics.example.com/a/','https://analytics.example.com/a/hk.js'],['https://custom.example.com:8443/a-b_2/v1.0','https://custom.example.com:8443/a-b_2/v1.0/hk.js']]) {
    assert.equal((await fragment({enabled:true,baseUrl})).src, src);
  }
});
test('admin, preview and edit URLs are excluded, including query flag presence', async () => {
  for (const path of ['/_emdash','/_emdash/admin','/?_preview','/article?_preview=invalid','/de/article?_edit=false','/%5femdash/admin']) assert.equal(await fragment(undefined,'https://site.example.com'+path),null,path);
  assert.ok(await fragment(undefined,'https://site.example.com/de/article'));
});
test('verified preview and visual editing contexts suppress clean public URLs', async () => {
  assert.equal(await fragment(undefined,undefined,{editMode:true}), null);
  assert.equal(await fragment(undefined,undefined,{editMode:false,preview:{collection:'posts',id:'test'}}),null);
  assert.ok(await fragment(undefined,undefined,{editMode:false}));
});
