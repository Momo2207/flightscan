import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8'),source=html.split('/* ROUTE_ENGINE_START:')[1].split('/* ROUTE_ENGINE_END */')[0];
const Routes=vm.runInNewContext('/* ROUTE_ENGINE_START:'+source+'\nAircraftRoutes');
const T=Date.parse('2026-09-30T06:00:00Z');
const report=(extra={})=>({hex:'3c4b31',flight:'DLH123',lat:48.5,lon:7.95,alt_baro:35000,positionTime:T-1000,...extra});
const airport=(extra={})=>({icao:'EDDF',iata:'FRA',name:'Frankfurt Airport',city:'Frankfurt',lat:50.03,lon:8.57,...extra});
const route=(extra={})=>({callsign:'DLH123',from:airport(),to:airport({icao:'LPPT',iata:'LIS',city:'Lisbon',lat:38.775,lon:-9.135}),source:'ADSB.lol',confidence:'likely',checkedAt:T,observationTime:T-1000,...extra});
test('route attaches to the exact observed aircraft/callsign episode and expires',()=>{
 const store=new Routes(),a=report();store.observe([a],T);assert.equal(store.accept(store.entry(a).key,route(),T),true);assert.equal(store.get(a,T).to.code,'LIS');assert.equal(store.get(report({hex:'abcdef'}),T),null);assert.equal(store.get(a,T+600001),null);
});
test('a callsign change clears the live route while delayed observations keep their own route',()=>{
 const store=new Routes(),a=report();store.observe([a],T);store.accept(store.entry(a).key,route(),T);const newer=report({flight:'DLH456',positionTime:T+10000});store.observe([newer],T+10000);
 assert.equal(store.get(newer,T+10000),null);assert.equal(store.get(a,T+10000).from.code,'FRA');assert.equal(store.entry(newer).route,null);
});
test('a reused callsign after a reception gap needs a new lookup',()=>{
 const store=new Routes(),a=report();store.observe([a],T);store.accept(store.entry(a).key,route(),T);const key=store.entry(a).key,later=report({positionTime:T+1801000});store.observe([later],T+1801000);assert.notEqual(store.entry(later).key,key);assert.equal(store.get(later,T+1801000),null);
});
test('unknown callsign closes the episode and older responses cannot resurrect it',()=>{
 const store=new Routes(),a=report();store.observe([a],T);store.accept(store.entry(a).key,route(),T);store.observe([report({flight:'',positionTime:T+1000})],T+1000);store.observe([a],T+2000);
 const later=report({positionTime:T+3000});store.observe([later],T+3000);assert.equal(store.get(later,T+3000),null);assert.equal(store.get(a,T+3000).to.code,'LIS');
});
test('fractional timestamps and normalized callsigns match without leaking to prior observations',()=>{
 const store=new Routes(),a=report({flight:' dlh123 ',positionTime:T-999.4});store.observe([a],T);const e=store.entry(a);assert.equal(e.from,T-1000);assert.equal(store.accept(e.key,route(),T),true);assert.ok(store.get(a,T));assert.equal(store.get(report({positionTime:T-2000}),T),null);
});
test('implausible geography and low aircraft far from airports are suppressed',()=>{
 const store=new Routes(),a=report();store.observe([a],T);store.accept(store.entry(a).key,route(),T);assert.equal(store.get({...a,lat:0,lon:120},T),null);
 assert.equal(Routes.fits(route(),{lat:44,lon:0,alt_baro:1500}),false);assert.equal(Routes.fits(route(),{lat:50,lon:8.6,alt_baro:1500}),true);
});
test('cache rejects future, expired, changed-flight and untrusted route answers',()=>{
 for(const bad of [route({checkedAt:T+60000}),route({checkedAt:T-600001}),route({callsign:'DLH456'}),route({observationTime:T-3000}),route({source:'other'}),route({confidence:'confirmed'}),route({from:airport({icao:'<svg>'})})]){
  const store=new Routes(),a=report();store.observe([a],T);assert.equal(store.accept(store.entry(a).key,bad,T),false);assert.equal(store.get(a,T),null);
 }
});
test('negative results have a retry interval and cache size stays bounded',()=>{
 const store=new Routes(),a=report();store.observe([a],T);const e=store.entry(a);store.accept(e.key,null,T);assert.equal(e.retryAt,T+300000);
 store.observe(Array.from({length:600},(_,i)=>report({hex:(0x400000+i).toString(16)})),T);assert.ok(store.entries.size<=512);assert.ok(store.latest.size<=512);
});
test('a cached route follows earlier matching observations already recorded for wall playback',()=>{
 const store=new Routes(),current=report(),delayed=report({positionTime:T-90000});
 store.observe([current],T);store.accept(store.entry(current).key,route(),T);
 assert.equal(store.get(delayed,T),null);const key=store.entry(current).key;
 store.backfill([delayed,report({positionTime:T-60000}),current],T);
 assert.equal(store.get(delayed,T).to.code,'LIS');assert.equal(store.entry(delayed).key,key);
 assert.equal(store.get(report({positionTime:T-120000}),T),null);
 assert.equal(store.get({...delayed,lat:0,lon:120},T),null);
});
test('playback recovery stops at changed, unknown and already closed flight identities',()=>{
 for(const flight of ['DLH456','']){
  const store=new Routes(),current=report(),earlier=report({positionTime:T-120000}),after=report({positionTime:T-60000});
  store.observe([current],T);store.accept(store.entry(current).key,route(),T);
  store.backfill([earlier,report({flight,positionTime:T-90000}),after,current],T);
  assert.equal(store.entry(current).from,after.positionTime);assert.equal(store.get(earlier,T),null);assert.ok(store.get(after,T));
 }
 const store=new Routes(),earlier=report({positionTime:T-120000}),current=report();
 store.observe([earlier],T-120000);store.observe([report({flight:'',positionTime:T-90000})],T-90000);store.observe([current],T);store.accept(store.entry(current).key,route(),T);
 const key=store.entry(current).key;store.backfill([earlier,current],T);
 assert.equal(store.entry(current).key,key);assert.equal(store.entry(current).from,current.positionTime);assert.equal(store.get(earlier,T),null);
});
test('a wider wall feed does not evict a valid route learnt in the normal view',()=>{
 const store=new Routes(),current=report();store.observe([current],T);store.accept(store.entry(current).key,route(),T);
 store.observe(Array.from({length:600},(_,i)=>report({hex:(0x400000+i).toString(16),positionTime:T})),T);
 assert.ok(store.entries.size<=512);assert.ok(store.latest.size<=512);assert.equal(store.get(current,T).to.code,'LIS');
});
