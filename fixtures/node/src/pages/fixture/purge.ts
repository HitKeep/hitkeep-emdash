// Local fixture only. Never deploy these test routes.
export async function POST(Astro) {
 await Astro.cache.invalidate({path:'/cached'});
 return new Response('purged');
}
