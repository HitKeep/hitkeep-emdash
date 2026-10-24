# HitKeep for EmDash

Native source candidate that adds HitKeep's existing asynchronous `hk.js` tracker through EmDash's generated settings and `EmDashHead`. Disabled until an administrator enables it. No credentials, analytics backend, dashboard or tracker copy are included.

Source is available at [HitKeep/hitkeep-emdash](https://github.com/HitKeep/hitkeep-emdash). `@hitkeep/emdash` is the local manifest name; the npm package remains private and unpublished, and npm scope ownership and availability have not been verified. It is **not** an EmDash sandboxed registry plugin: executable page fragments require trusted native installation.

## Compatibility

Tested: EmDash **1.3.1**, Astro **7.4.1**, `@astrojs/node` **11.1.9**, `@astrojs/react` **7.1.0**, React/React DOM **19.3.1**, Node **24.19.0**. The peer dependency is deliberately exact. Other releases are unverified. Astro ClientRouter acceptance currently fails: the official hosted tracker emitted an extra pageview for the old route during navigation. Use full-document navigation for this candidate; client navigation needs an upstream tracker fix before release.

Cloudflare server rendering and packaged host checks are also tested locally with EmDash **1.3.1**, Astro **7.3.2**, `@astrojs/cloudflare` **14.3.0**, `@astrojs/react` **7.0.0**, React/React DOM **19.3.1**, Kysely **0.29.7**, Vite **8.3.4**, Rolldown **1.2.14**, Wrangler **4.151.3** and Node **24.19.0**. This proves local workerd rendering, settings, suppression, disable and descriptor removal; hosted deployment and Cloudflare browser navigation are unverified. ClientRouter remains excluded on both hosts.

For that Cloudflare build, preserve server module execution order in the host's existing Astro configuration:

```js
vite: {
  environments: {
    ssr: {
      build: {
        rolldownOptions: {
          output: {strictExecutionOrder: true}
        }
      }
    }
  }
}
```

Without this setting, the tested bundler splits Kysely into circularly importing chunks and initializes `ImmediateValueTransformer` before its superclass, producing HTTP 500 before plugin execution. [Rolldown's native execution-order option](https://rolldown.rs/reference/OutputOptions.strictExecutionOrder) fixes this without changing the tracker or dependency versions. It adds server initialization wrappers and increases the server bundle size; scoping it to `ssr` leaves browser bundles unchanged. Merge this into existing `vite` settings, rebuild and restart the host. Other dependency combinations are unverified.

## Install locally

Clone the source and build a local artifact (no npm registry installation is available):

```sh
git clone https://github.com/HitKeep/hitkeep-emdash.git
cd hitkeep-emdash
npm ci
npm test
npm pack
npm install /path/to/hitkeep-emdash-0.1.0.tgz
```

Run the last command in your EmDash host, then register the native descriptor:

```js
import {hitkeepPlugin} from '@hitkeep/emdash';
// Inside your existing emdash({...}) configuration:
plugins: [hitkeepPlugin()]
```

Keep the host's existing Astro adapter, React integration and EmDash configuration. Register this descriptor once under `plugins`, rather than `sandboxed`.

The public layout must provide the native head seam:

```astro
---
import {createPublicPageContext} from 'emdash/page';
import {EmDashHead} from 'emdash/ui';
const page = createPublicPageContext({Astro, kind:'custom', title:'Page title'});
---
<head><EmDashHead page={page} /></head>
```

Use the theme's existing page context when available. A missing `EmDashHead` silently omits the tracker. Inspect the rendered public page source for exactly one asynchronous `hk.js` script after installation.

In **Plugins → HitKeep → Settings**, enter the public HitKeep base URL and enable collection. The generated settings backend requires `plugins:manage` for reading and changing values. Both form and runtime default to `enabled=false` and `baseUrl=""`.

The URL must be absolute HTTPS, without credentials, whitespace, controls, markup, query parameters or a fragment. An optional deployment prefix accepts ASCII letters, numbers, `/`, `.`, `_`, `~` and `-`, with no `.` or `..` path segments or percent encoding. Examples:

- `https://analytics.example.com` → `https://analytics.example.com/hk.js`
- `https://analytics.example.com/analytics/` → `https://analytics.example.com/analytics/hk.js`
- A verified custom tracking host works the same way.

Enter a base URL, not a script filename. Invalid configuration loads nothing and leaves page rendering intact. URL validation happens again when rendering; EmDash's generic URL form validation is less restrictive. The server never fetches the configured URL. Verify spelling and ownership: enabling this setting trusts that origin to execute JavaScript on your public pages.

Remove any manual tracker snippet or tag-manager installation before enabling the plugin. The stable fragment key deduplicates native contributions within one head placement; it cannot discover a separately written theme or tag-manager script. Render `EmDashHead` once per document.

## Privacy, previews and policy

The adapter adds only `src` and `async`. It supplies no site ID, DNT override, localhost override, Web Vitals option or persistent identifier. HitKeep's existing tracker owns cookieless collection, DNT, visitor opt-out, automatic events and client navigation. Cookieless does not mean a consent policy is automatically satisfied.

Admin paths containing an `_emdash` segment, URLs carrying `_preview` or `_edit` (including empty flags), and EmDash request contexts with verified `preview` or `editMode` produce no fragment. This does **not** exclude every signed-in staff member browsing an ordinary public page: the fragment API does not provide a general authenticated-user context. Theme-level staff suppression must also account for shared route caches.

The plugin does not change CSP. Permit the chosen tracker origin in your host's `script-src` and its collection endpoints in `connect-src` only if your policy permits collection. Restrictive policies continue to block it. This candidate does not claim nonce or `strict-dynamic` support.

When consent must precede **any** tracker request, leave automatic injection disabled everywhere. Your CMP must own loading, navigation and revocation. Removing a loaded script does not remove its listeners or timers; revocation needs the tracker's supported opt-out behavior and a fresh document as appropriate to your policy. No general CMP integration is included or claimed.

## Disable, update and remove

1. Disable **Enable HitKeep** before changing or removing an installation.
2. Invalidate every cached public HTML response at the route cache, CDN, proxy and static output layers you use. A warm cache can keep serving the old script without executing the fragment hook. Object-cache invalidation alone is insufficient.
3. For Astro's cache, invalidate the affected routes using the supported host cache API (`Astro.cache.invalidate({path:'/affected-route'})`). Purge all affected language routes too. For prerendered pages, rebuild and redeploy the host. Use your CDN/provider's existing purge operation separately.
4. Reload a public page and check that its source has no `hk.js` script and the browser makes no tracker requests. Already open documents may keep the old tracker running until navigation/reload.

For a local update, retain the prior tarball and lockfile, install the replacement artifact in the host, rebuild/restart, invalidate cached HTML, and repeat the public/preview checks. This first candidate has no released predecessor, so no cross-release upgrade is claimed. The test runner verifies packed reinstallation. Roll back by reinstalling the saved artifact and host lockfile, rebuilding and purging caches.

To remove completely, remove the descriptor import and its `plugins` entry, run `npm uninstall @hitkeep/emdash` in the host, rebuild/restart, and purge cached HTML. Host-managed plugin settings may remain in EmDash's database; no custom tables or deletion hooks are added.

## Reproduce checks

```sh
npm ci
npm test
npm run test:hosts -- node
npm run test:hosts -- cloudflare
```

The host runner packs the artifact, installs it into the selected fixture, builds and starts it locally, then exercises real EmDash settings handlers, SQLite/D1 runtime, theme insertion, disabled/default/invalid values, permissions, language routes and preview/edit URLs. Both hosts prove descriptor removal. Node additionally proves stale route-cache retention and invalidation; the Cloudflare fixture does not enable an HTML route cache.

Fixtures have synthetic-identity settings and cache-purge routes for local tests. **Never deploy these fixtures.** They are excluded from the npm artifact. Role tests exercise EmDash's real authorization handler with synthetic identities; they do not replace real passkey/session acceptance.

Browser checks use `ego-browser` and the unmodified official tracker, with all collection traffic addressed to `.invalid` and blocked locally. The browser driver captures the real tracker through an instrumented successful `sendBeacon` transport, so no analytics are transmitted. Default checks force full-document link navigation; pass `clientNavigation:true` to reproduce the excluded ClientRouter failure. Run through the API shown in `tests/browser.mjs` with a current ego task space, a running Node fixture, and an official `hk.js` file downloaded to a temporary path. The package never bundles that file. The fixture's consent route only proves the absence of automatic requests; a real CMP grant/revoke lifecycle remains a deployment acceptance gate.

## Sources and documentation impact

- [Native authoring](https://docs.emdashcms.com/plugins/creating-native-plugins/your-first-native-plugin/)
- [Generated settings](https://docs.emdashcms.com/plugins/creating-native-plugins/react-admin/)
- [Page fragments and deduplication](https://docs.emdashcms.com/plugins/creating-native-plugins/page-fragments/)
- [Route caching](https://docs.emdashcms.com/deployment/route-caching/)
- [Cloudflare host configuration](https://docs.emdashcms.com/deployment/cloudflare/)
- [HitKeep tracker behavior](https://hitkeep.com/guides/tracking/tracker-architecture/)
- [Official hosted tracker URL](https://hitkeep.com/guides/integrations/wordpress/)

A maintainer still needs to apply this installation, privacy, theme-seam and removal guidance to the dedicated public EmDash integration guide. GitHub source availability does not imply npm publication, a registry listing, a stable release or full production acceptance.
