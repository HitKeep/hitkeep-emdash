import {defineMiddleware} from 'astro:middleware';
export const onRequest = defineMiddleware(async (context,next)=>{
 const response = await next();
 if(context.url.pathname === '/blocked-script') response.headers.set('Content-Security-Policy',"script-src 'self'; connect-src 'none'");
 return response;
});
