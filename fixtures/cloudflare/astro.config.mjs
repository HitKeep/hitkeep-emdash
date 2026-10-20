import {defineConfig} from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import react from '@astrojs/react';
import emdash from 'emdash/astro';
import {d1} from '@emdash-cms/cloudflare';
import {hitkeepPlugin} from '@hitkeep/emdash';
export default defineConfig({
 output:'server',
 adapter:cloudflare(),
 // Preserve Kysely initialization order across generated server chunks.
 vite:{environments:{ssr:{build:{rolldownOptions:{output:{strictExecutionOrder:true}}}}}},
 integrations:[react(),emdash({database:d1({binding:'DB'}),plugins:process.env.FIXTURE_UNINSTALLED ? [] : [hitkeepPlugin()]})]
});
