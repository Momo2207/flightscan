import assert from 'node:assert/strict';
import test from 'node:test';
import {createRelay} from '../api/relay.js';
const T=Date.parse('2026-09-30T06:00:00Z'),origin='https://momo2207.github.io',base='https://flightscan-test.vercel.app';
const plane=(extra={})=>({hex:'3c4b31',callsign:'DLH123',lat:48.5,lon:7.95,time:T-1000,...extra});
const airports=[{icao:'EDDF',iata:'FRA',name:'Frankfurt Airport',location:'Frankfurt',lat:50.033,lon:8.57},{icao:'LPPT',iata:'LIS',name:'Humberto Delgado Airport',location:'Lisbon',lat:38.775,lon:-9.135}];
const answer=(extra={})=>({callsign:'DLH123',plausible:true,_airports:airports,...extra});
function request(planes=[plane()],extra=''){
 const url=new URL('/api/relay',base);url.searchParams.set('path','routes');url.searchParams.set('planes',JSON.stringify(planes));if(extra)url.searchParams.set('url',extra);return new Request(url,{headers:{Origin:origin}});
}
function point(){return new Request(base+'/api/relay?path=adsb/point/48.5/7.95/54',{headers:{Origin:origin}})}
test('route batch uses the working individual GET endpoint and retains observation identity',async()=>{
 const calls=[],relay=createRelay({now:()=>T,fetchUpstream:async(url,opts)=>{calls.push({url,opts});return Response.json(answer())}});
 const response=await relay(request());assert.equal(response.status,200);assert.equal(response.headers.get('Access-Control-Allow-Origin'),origin);
 assert.equal(calls[0].url,'https://api.adsb.lol/api/0/route/DLH123/48.50000/7.95000');assert.equal(calls[0].opts.method,'GET');assert.equal(calls[0].opts.redirect,'manual');assert.equal(calls[0].opts.body,undefined);
 const body=await response.json();assert.equal(body.service,'flightscan-routes');assert.equal(body.routes[0].hex,'3c4b31');assert.equal(body.routes[0].time,T-1000);assert.equal(body.routes[0].route.from.code,'FRA');assert.equal(body.routes[0].route.to.code,'LIS');assert.equal(body.routes[0].route.confidence,'likely');
 const health=await relay(new Request(base+'/api/relay?path=health'));assert.equal(health.status,200);assert.equal((await health.json()).routeLookupMethod,'individual-get');
});
test('unvalidated, multi-leg and incomplete results remain unknown',async()=>{
 for(const row of [answer({plausible:false}),answer({plausible:undefined}),answer({_airports:[...airports,airports[0]]}),answer({_airports:[airports[0]]}),answer({_airports:[airports[0],{...airports[1],icao:'<svg>'}]}),answer({callsign:'DLH456'}),{callsign:'DLH123',airport_codes:'unknown',_airports:[]}]){
  const relay=createRelay({now:()=>T,fetchUpstream:async()=>Response.json(row)});const data=await(await relay(request())).json();assert.equal(data.routes[0].route,null);
 }
});
test('request bounds prevent arbitrary destinations, stale flights and unlimited batches',async()=>{
 let calls=0;const relay=createRelay({now:()=>T,fetchUpstream:async()=>{calls++;throw Error('No upstream request expected')}});
 const invalid=[[],Array.from({length:9},(_,i)=>plane({hex:(0x300000+i).toString(16),callsign:'DLH'+i})),[plane(),plane({hex:'abcdef'})],[plane({lat:91})],[plane({time:T-240001})],[plane({time:T+5001})],[plane({callsign:'DLH*'})],[plane({hex:'~abcde'})],[plane({url:'https://evil.test'})],[plane({lon:null})]];
 for(const rows of invalid)assert.equal((await relay(request(rows))).status,400);
 assert.equal((await relay(request([plane()],'https://evil.test'))).status,400);assert.equal(calls,0);
});
test('concurrent batches share work, cache keeps original timestamps and different observations are paced',async()=>{
 let clock=T,calls=0,finish;const relay=createRelay({now:()=>clock,fetchUpstream:async()=>{calls++;return new Promise(resolve=>finish=resolve)}});
 const one=relay(request()),two=relay(request());await new Promise(resolve=>setImmediate(resolve));assert.equal(calls,1);finish(Response.json(answer()));await Promise.all([one,two]);
 clock+=1000;const cached=await relay(request());assert.equal(cached.headers.get('X-Flightscan-Cache'),'HIT');assert.equal((await cached.json()).checkedAt,T);
 const paced=await relay(request([plane({time:T+500})]));assert.equal(paced.status,429);assert.equal(paced.headers.get('Retry-After'),'14');assert.equal(calls,1);
});
test('route rate limits do not cool down the aircraft position provider',async()=>{
 let calls=0;const relay=createRelay({now:()=>T,fetchUpstream:async url=>{calls++;return url.includes('/api/0/route/')?new Response('',{status:429,headers:{'Retry-After':'240'}}):Response.json({ac:[]})}});
 const limited=await relay(request());assert.equal(limited.status,429);assert.equal((await limited.json()).stage,'routes');assert.equal((await relay(point())).status,200);assert.equal((await relay(request())).status,429);assert.equal(calls,2);
});
test('route transport and body parsing have a bounded deadline without exposing credentials',async()=>{
 let signal;const relay=createRelay({now:()=>T,limits:{routes:10},fetchUpstream:async(_url,opts)=>{signal=opts.signal;assert.equal(opts.headers.Authorization,undefined);return new Promise(()=>{})}});
 const response=await relay(request(),{OPENSKY_CLIENT_ID:'private-client',OPENSKY_CLIENT_SECRET:'private-secret'});assert.equal(response.status,504);assert.equal(signal.aborted,true);const body=await response.text();assert.ok(!body.includes('private-'));assert.equal(JSON.parse(body).stage,'routes');
 const bodyRelay=createRelay({now:()=>T,limits:{routes:10},fetchUpstream:async()=>({ok:true,status:200,headers:new Headers(),text:()=>new Promise(()=>{})})});assert.equal((await bodyRelay(request())).status,504);
});
test('unexpected route responses are rejected; encoded JSON objects are supported',async()=>{
 for(const rows of [{error:'upstream detail'},[answer(),answer()],Array.from({length:65},()=>answer())]){
  const relay=createRelay({now:()=>T,fetchUpstream:async()=>Response.json(rows)});const response=await relay(request());assert.equal(response.status,502);assert.equal((await response.json()).stage,'routes');
 }
 const relay=createRelay({now:()=>T,fetchUpstream:async()=>Response.json(JSON.stringify(answer()))});assert.equal((await(await relay(request())).json()).routes[0].route.from.code,'FRA');
});
test('the observed empty 201 response and invalid JSON produce specific safe diagnostics',async()=>{
 for(const [status,body,code]of [[201,'','UPSTREAM_EMPTY'],[200,'<html>upstream private detail</html>','UPSTREAM_NON_JSON']]){
  const relay=createRelay({now:()=>T,fetchUpstream:async()=>new Response(body,{status})});
  const response=await relay(request()),data=await response.json();assert.equal(response.status,502);assert.equal(data.code,code);assert.equal(data.stage,'routes');assert.ok(data.error.includes('HTTP '+status));assert.ok(!data.error.includes('private detail'));
 }
});
test('older eight-plane batches use at most two concurrent requests and keep results in identity order',async()=>{
 const planes=Array.from({length:8},(_,i)=>plane({hex:(0x300000+i).toString(16),callsign:'DLH'+i}));
 let active=0,peak=0,calls=0;
 const relay=createRelay({now:()=>T,fetchUpstream:async url=>{
  calls++;active++;peak=Math.max(peak,active);const callsign=new URL(url).pathname.split('/')[4];
  await new Promise(resolve=>setTimeout(resolve,callsign.endsWith('0')?4:1));active--;return Response.json(answer({callsign}));
 }});
 const response=await relay(request(planes)),data=await response.json();assert.equal(response.status,200);assert.equal(peak,2);assert.equal(calls,8);
 assert.deepEqual(data.routes.map(row=>[row.hex,row.route.callsign]),planes.map(p=>[p.hex,p.callsign]));
});
test('a provider error aborts other sockets and prevents remaining queued calls',async()=>{
 let calls=0;const signals=[];
 const relay=createRelay({now:()=>T,fetchUpstream:async(_url,opts)=>{
  calls++;signals.push(opts.signal);
  if(calls===1)return new Response('',{status:429,headers:{'Retry-After':'240'}});
  return new Promise((resolve,reject)=>opts.signal.addEventListener('abort',()=>reject(opts.signal.reason),{once:true}));
 }});
 const planes=Array.from({length:8},(_,i)=>plane({hex:(0x300000+i).toString(16),callsign:'DLH'+i}));
 const response=await relay(request(planes));assert.equal(response.status,429);assert.equal(calls,2);assert.ok(signals.every(signal=>signal.aborted));
});
test('a broken callsign does not discard valid routes in the same batch',async()=>{
 const relay=createRelay({now:()=>T,fetchUpstream:async url=>url.includes('/DLH456/')?new Response('upstream exception',{status:500}):Response.json(answer())});
 const response=await relay(request([plane(),plane({hex:'abcdef',callsign:'DLH456'})])),data=await response.json();
 assert.equal(response.status,200);assert.equal(data.partial,true);assert.equal(data.routes[0].route.from.code,'FRA');assert.equal(data.routes[1].route,null);assert.equal(data.routes[1].error.status,500);assert.equal(data.routes[1].error.retryAfter,120);assert.equal(data.retryAfter,undefined);
});
test('a timed out callsign preserves completed routes and cannot decorate them later',async()=>{
 let finish;const relay=createRelay({now:()=>T,limits:{routes:10},fetchUpstream:async url=>url.includes('/DLH456/')?new Promise(resolve=>finish=resolve):Response.json(answer())});
 const response=await relay(request([plane(),plane({hex:'abcdef',callsign:'DLH456'})])),data=await response.json();
 assert.equal(response.status,200);assert.equal(data.routes[0].route.to.code,'LIS');assert.equal(data.routes[1].error.code,'UPSTREAM_TIMEOUT');finish(Response.json(answer({callsign:'DLH456'})));
 await new Promise(resolve=>setImmediate(resolve));assert.equal(data.routes[1].route,null);
});
test('partial results still honor a provider-wide quota across later batches',async()=>{
 let calls=0;const relay=createRelay({now:()=>T,fetchUpstream:async url=>{calls++;if(url.includes('/DLH456/')){await new Promise(resolve=>setImmediate(resolve));return new Response('',{status:429,headers:{'Retry-After':'240'}})}return Response.json(answer())}});
 const planes=[plane(),plane({hex:'abcdef',callsign:'DLH456'})],response=await relay(request(planes)),data=await response.json();
 assert.equal(response.status,200);assert.equal(data.routes[0].route.from.code,'FRA');assert.equal(data.retryAfter,240);assert.equal((await relay(request())).status,429);assert.equal(calls,2);
});
test('different concurrent batches share the warm instance route concurrency limit',async()=>{
 let clock=T,calls=0,finish;const relay=createRelay({now:()=>clock,fetchUpstream:async()=>{calls++;return new Promise(resolve=>finish=resolve)}});
 const pending=relay(request());await new Promise(resolve=>setImmediate(resolve));clock+=16000;
 const second=await relay(request([plane({time:clock})]));assert.equal(second.status,429);assert.equal((await second.json()).code,'RELAY_PACING');assert.equal(calls,1);
 finish(Response.json(answer()));assert.equal((await pending).status,200);
});
