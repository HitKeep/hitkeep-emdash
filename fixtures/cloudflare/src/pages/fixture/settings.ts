// Local fixture only: synthetic identities exercise the real EmDash settings routes.
// This is excluded from the npm artifact. Never deploy this fixture.
import {GET as settingsGet, PUT as settingsPut} from '../../../node_modules/emdash/src/astro/routes/api/admin/plugins/[id]/settings.ts';
import {getDb} from 'emdash/runtime';
import {createPlugin} from '@hitkeep/emdash/plugin';
export async function POST({request}) {
 const input = await request.json();
 const locals = {user:input.role === null ? null : {id:'fixture-user',role:input.role ?? 50}, emdash:{db:await getDb(),configuredPlugins:[createPlugin()],sandboxedPluginEntries:[],getRuntimePluginSettingsSchema:()=>null}};
 const context = {params:{id:'hitkeep'},locals,request:new Request('http://localhost/settings',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({values:input.values ?? {}})})};
 return input.values ? settingsPut(context) : settingsGet(context);
}
