import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../design-system/aircraft-info.js',import.meta.url),'utf8');
const Info=vm.runInNewContext(source.split('const AIRCRAFT_PREF_KEY')[0]+'\nAircraftInfo');
const plain=x=>JSON.parse(JSON.stringify(x));
test('identity fallbacks are labelled accurately and never invented callsigns',()=>{
 assert.deepEqual(plain(Info.identity({flight:' DLH123 ',r:'D-ABCD',hex:'3c1234'})),{value:'DLH123',label:'Callsign'});assert.deepEqual(plain(Info.identity({r:'D-ABCD',hex:'3c1234'})),{value:'D-ABCD',label:'Registration'});assert.deepEqual(plain(Info.identity({hex:'3c1234'})),{value:'3C1234',label:'ICAO identifier'});
});
test('one aviation and metric formatter serves zero, ground, rounded live values and missing slots',()=>{
 assert.equal(Info.altitude({alt_baro:35160}).value,'35,200');assert.equal(Info.altitude({alt_baro:35160},true).value,'10,720');assert.equal(Info.altitude({alt_baro:'ground'}).value,'Ground');assert.equal(Info.speed({gs:0}).value,'0');assert.equal(Info.speed({gs:430},true).value,'796');assert.equal(Info.vertical({baro_rate:1000},true).value,'5.1');assert.equal(Info.speed({gs:null}).value,'Not available');assert.equal(Info.altitude({alt_baro:0}).value,'0');
});
test('progress preserves full and partial labels independently and uses whole minutes and distance units',()=>{
 const p={distanceKm:100,elapsedMinutes:73,distanceLabel:'Observed distance',timeLabel:'Time airborne'};const a=Info.progress(p),m=Info.progress(p,true);assert.equal(a.distance.value,'54');assert.equal(a.distance.unit,'NM');assert.equal(m.distance.value,'100');assert.equal(a.time.value,'1 h 13 min');assert.equal(a.distance.label,'Observed distance');assert.equal(a.time.label,'Time airborne');assert.equal(Info.progress(null).time.value,'Not available');assert.equal(Info.duration(0),'0 min');
});
test('all profiles share the same registry and give Follow a dedicated progress band',()=>{
 for(const field of Info.profiles.web)assert.ok(Info.fields[field]);assert.equal(Info.profiles.wallFollow.indexOf('progress')<Info.profiles.wallFollow.indexOf('altitude'),true);assert.equal(Info.profiles.wallArea.includes('progress'),false);assert.equal(Info.profiles.journal.includes('altitude'),false);assert.equal(Info.profiles.minimal[0],'identity');
});
