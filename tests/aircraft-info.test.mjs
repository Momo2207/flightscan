import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../design-system/aircraft-info.js',import.meta.url),'utf8');
const journey=readFileSync(new URL('../design-system/wall-journey.js',import.meta.url),'utf8');
const Info=vm.runInNewContext(journey+'\n'+source.split('const AIRCRAFT_PREF_KEY')[0]+'\nAircraftInfo');
const plain=x=>JSON.parse(JSON.stringify(x));
test('identity fallbacks are labelled accurately and never invented callsigns',()=>{
 assert.deepEqual(plain(Info.identity({flight:' DLH123 ',r:'D-ABCD',hex:'3c1234'})),{value:'DLH123',label:'Callsign'});assert.deepEqual(plain(Info.identity({r:'D-ABCD',hex:'3c1234'})),{value:'D-ABCD',label:'Registration'});assert.deepEqual(plain(Info.identity({hex:'3c1234'})),{value:'3C1234',label:'ICAO identifier'});
});
test('one aviation and metric formatter serves zero, ground, rounded live values and missing slots',()=>{
 assert.equal(Info.altitude({alt_baro:35160}).value,'35,200');assert.equal(Info.altitude({alt_baro:35160},true).value,'10,720');assert.equal(Info.altitude({alt_baro:'ground'}).value,'Ground');assert.equal(Info.speed({gs:0}).value,'0');assert.equal(Info.speed({gs:430},true).value,'796');assert.equal(Info.vertical({baro_rate:1000},true).value,'5.1');assert.equal(Info.speed({gs:null}).value,'Not available');assert.equal(Info.altitude({alt_baro:0}).value,'0');
});
test('distance from departure uses route geography while airborne time keeps its recorded evidence',()=>{
 const p={distanceKm:104,elapsedMinutes:73,distanceLabel:'Observed distance',timeLabel:'Time airborne'},aircraft={lat:0,lon:3},route={from:{lat:0,lon:0}};
 const a=Info.progress(p,false,aircraft,route),m=Info.progress(p,true,aircraft,route);assert.equal(a.distance.value,'180');assert.equal(a.distance.unit,'NM');assert.equal(m.distance.value,'334');assert.equal(a.time.value,'1 h 13 min');assert.equal(a.distance.label,'Distance from departure');assert.equal(a.time.label,'Time airborne');assert.equal(Info.progress(null).time.value,'Not available');assert.equal(Info.duration(0),'0 min');
});
test('missing origin cannot silently fall back to a partial track total',()=>{
 const p={distanceKm:104,elapsedMinutes:31,timeLabel:'Time airborne'};
 for(const route of [null,{}, {from:{lat:null,lon:8}}, {from:{lat:50,lon:'8'}}]){
  const value=Info.progress(p,true,{lat:49,lon:4},route);assert.equal(value.distance.value,'Not available');assert.equal(value.distance.unit,'');assert.equal(value.time.value,'31 min');assert.equal(value.time.label,'Time airborne');
 }
 const value=Info.progress(null,true,{lat:0,lon:3},{from:{lat:0,lon:0}});assert.equal(value.distance.value,'334');assert.equal(value.time.value,'Not available');
});
test('changing origin or displayed position updates the metric without using stored distance or current speed',()=>{
 const p={distanceKm:104,elapsedMinutes:31,timeLabel:'Time observed'},a={lat:0,lon:3,held:true,gs:0};
 assert.equal(Info.progress(p,true,a,{from:{lat:0,lon:3}}).distance.value,'0');
 assert.equal(Info.progress(p,true,a,{from:{lat:0,lon:2}}).distance.value,'111');
 assert.equal(Info.progress(p,true,{...a,lon:4},{from:{lat:0,lon:2}}).distance.value,'222');
 assert.equal(Info.progress(p,true,a,null).distance.value,'Not available');assert.equal(Info.progress(p,true,a,null).time.label,'Time observed');
});
test('all profiles share the same registry and give Follow a dedicated progress band',()=>{
 for(const field of Info.profiles.web)assert.ok(Info.fields[field]);assert.equal(Info.profiles.wallFollow.indexOf('progress')<Info.profiles.wallFollow.indexOf('altitude'),true);assert.equal(Info.profiles.wallArea.includes('progress'),false);assert.equal(Info.profiles.journal.includes('altitude'),false);assert.equal(Info.profiles.minimal[0],'identity');
});
