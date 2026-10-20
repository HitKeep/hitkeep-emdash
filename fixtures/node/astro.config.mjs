import {defineConfig} from 'astro/config';
import node from '@astrojs/node';
import emdash from 'emdash/astro';
import react from '@astrojs/react';
import {sqlite} from 'emdash/db';
import {hitkeepPlugin} from '@hitkeep/emdash';
export default defineConfig({
 cache:{provider:{entrypoint:'astro/cache/memory'}},routeRules:{'/cached':{maxAge:300}},
 output:'server',adapter:node({mode:'standalone'}),
 integrations:[react(),emdash({database:sqlite({url:'file:'+new URL('./fixture.sqlite',import.meta.url).pathname}),plugins:process.env.FIXTURE_UNINSTALLED ? [] : [hitkeepPlugin()]})],
});
