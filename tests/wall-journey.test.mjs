import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../design-system/wall-journey.js',import.meta.url),'utf8');
const Journey=vm.runInNewContext(source+'\nWallJourney');
const route={from:{lat:50.033,lon:8.57},to:{lat:38.775,lon:-9.135}};
test('airport distance is a whole-route great-circle distance, independent of aircraft position',()=>{
 const value=Journey.estimate({t:'A320',lat:50.03,lon:8.57},route,'narrow');
 assert.ok(value.distanceKm>1850&&value.distanceKm<1900);assert.equal(value.durationMinutes,155);
 assert.equal(Journey.estimate({t:'A320',lat:39,lon:-9},route,'narrow').distanceKm,value.distanceKm);
});
test('ground, slow approach and held telemetry cannot turn the duration into a taxi-speed estimate',()=>{
 for(const state of [{alt_baro:'ground',gs:0},{gs:11},{gs:450},{held:true,gs:20}])assert.equal(Journey.estimate({t:'A320',...state},route,'narrow').durationMinutes,155);
});
test('malformed, missing or identical airport coordinates produce no journey figures',()=>{
 for(const bad of [null,{}, {...route,from:{lat:null,lon:8}}, {...route,to:{lat:'38',lon:-9}}, {...route,to:{lat:91,lon:0}}, {...route,to:{lat:20,lon:181}}, {...route,to:{lat:NaN,lon:0}}, {...route,to:route.from}])assert.equal(Journey.estimate({},bad,'narrow'),null);
});
test('longitude wrap uses the short path across the date line',()=>{
 const value=Journey.estimate({}, {from:{lat:0,lon:179},to:{lat:0,lon:-179}},'wide');
 assert.ok(value.distanceKm>222&&value.distanceKm<223);
});
test('near-antipodal airports remain finite despite floating-point rounding',()=>{
 const value=Journey.estimate({}, {from:{lat:51.23,lon:8.123},to:{lat:-51.23,lon:-171.877}},'wide');
 assert.ok(Number.isFinite(value.distanceKm)&&value.distanceKm>20000);
});
test('known jet classes get rounded estimates and unmodelled categories get distance only',()=>{
 for(const kind of ['wide','narrow','regional','business','jet'])assert.equal(Journey.estimate({},route,kind).durationMinutes%5,0);
 for(const kind of ['generic','light','helicopter','military','transport','glider','turboprop','toString','__proto__']){
  const info=Journey.estimate({},route,kind);assert.ok(info.distanceKm>0);assert.equal(info.durationMinutes,null);assert.equal(Journey.duration(info),'');
 }
 assert.equal(Journey.estimate({t:' b738 '},route,'narrow').speedKt,460);
});
test('distance respects aviation and metric units without excessive precision',()=>{
 const info=Journey.estimate({t:'A320'},route,'narrow');assert.equal(Journey.distance(info,true),'1,870');assert.equal(Journey.distance(info,false),'1,010');
 assert.equal(Journey.distance(null,true),'');assert.equal(Journey.distance({distanceKm:28},true),'28');
});
test('duration labels use readable hours and minutes without clock-time or ETA formatting',()=>{
 assert.equal(Journey.duration({durationMinutes:155}),'2 h 35 m');assert.equal(Journey.duration({durationMinutes:120}),'2 h');assert.equal(Journey.duration({durationMinutes:35}),'35 min');assert.equal(Journey.duration(null),'');
});
