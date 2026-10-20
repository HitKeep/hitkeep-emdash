import { definePlugin } from "emdash";
import { getRequestContext } from "emdash/request-context";

function trackerUrl(value: unknown): string | null {
  if (typeof value !== "string" || /[\s<>"'`\\?#\u0000-\u001f\u007f]/.test(value)) return null;
  const parts = /^https:\/\/([^/]+)(\/[A-Za-z0-9/._~-]*)?$/.exec(value);
  if (!parts || parts[1].includes("@") || parts[2]?.split("/").some(part => part === "." || part === "..")) return null;
  try {
    const url = new URL(value);
    if (!url.hostname) return null;
    return `${url.origin}${url.pathname.replace(/\/+$/, "")}/hk.js`;
  } catch {
    return null;
  }
}

export function createPlugin() {
  return definePlugin({
    id: "hitkeep",
    version: "0.1.0",
    capabilities: ["hooks.page-fragments:register"],
    admin: {
      settingsSchema: {
        enabled: { type: "boolean", label: "Enable HitKeep", default: false, description: "Load the cookieless HitKeep tracker on public pages. Keep disabled when consent must precede loading." },
        baseUrl: { type: "url", label: "HitKeep base URL", default: "", placeholder: "https://analytics.example.com", description: "Absolute HTTPS origin, optionally with a deployment prefix. No credentials, query, fragment or script filename. Invalid values load nothing." },
      },
    },
    hooks: {
      "page:fragments": async ({ page }, ctx) => {
        const request = getRequestContext();
        if (request?.editMode || request?.preview) return null;
        try {
          const url = new URL(page.url);
          if (/(?:^|\/)\_emdash(?:\/|$)/.test(decodeURIComponent(url.pathname)) || url.searchParams.has("_preview") || url.searchParams.has("_edit")) return null;
        } catch {
          return null;
        }
        if (await ctx.settings.get("enabled") !== true) return null;
        const src = trackerUrl(await ctx.settings.get("baseUrl"));
        return src ? { kind: "external-script", placement: "head", src, async: true, key: "hitkeep-tracker" } : null;
      },
    },
  });
}
