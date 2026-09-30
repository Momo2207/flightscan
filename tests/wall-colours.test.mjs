import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const source=html.match(/\/\* FLIGHT_COLOUR_ENGINE_START[\s\S]*?\/\* FLIGHT_COLOUR_ENGINE_END \*\//)[0];
const Colours=vm.runInNewContext(source+'\nAircraftColours');
const row=(patch={})=>({hex:'3c4b31',alt_baro:20000,baro_rate:1000,...patch}),fallback='#8db3a6';
const rgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
const difference=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));

test('OKLab round trips black, white and both spectrum palettes',()=>{
 for(const hex of ['#000000','#ffffff',...Colours.PALETTES.night,...Colours.PALETTES.paper])assert.ok(difference(Colours.rgb(Colours.lab(hex)),rgb(hex))<=1,hex);
});
test('climb height and descent height follow separate continuous spectrum branches',()=>{
 const p=Colours.PALETTES.night;
 for(const [height,index]of [[0,0],[20000,1],[40000,2]])assert.ok(difference(Colours.rgb(Colours.target(row({alt_baro:height})).lab),rgb(p[index]))<=1);
 for(const [height,index]of [[0,5],[12000,4],[26000,3],[40000,2]])assert.ok(difference(Colours.rgb(Colours.target(row({alt_baro:height,baro_rate:-900})).lab),rgb(p[index]))<=1);
 assert.ok(difference(Colours.rgb(Colours.target(row({alt_baro:12000,baro_rate:-900})).lab),Colours.rgb(Colours.target(row({alt_baro:12001,baro_rate:-900})).lab))<=1);
});
test('level flight is green at any altitude and low altitude does not imply touchdown',()=>{
 const green=rgb(Colours.PALETTES.night[2]);
 for(const alt_baro of [0,500,12000,42000])assert.ok(difference(Colours.rgb(Colours.target(row({alt_baro,baro_rate:0})).lab),green)<=1);
 assert.equal(Colours.target(row({alt_baro:0,baro_rate:-800})).phase,'descent');
 assert.equal(Colours.target(row({alt_baro:'ground',baro_rate:null})).phase,'ground');
});
test('phase hysteresis prevents vertical-rate noise flipping a climb or descent',()=>{
 assert.equal(Colours.phase(201),'climb');assert.equal(Colours.phase(150,'climb'),'climb');assert.equal(Colours.phase(100,'climb'),'level');
 assert.equal(Colours.phase(-201),'descent');assert.equal(Colours.phase(-150,'descent'),'descent');assert.equal(Colours.phase(-100,'descent'),'level');
 for(const rate of [-150,0,150])assert.equal(Colours.phase(rate),'level');
});
test('landing blends over eight seconds instead of jumping from red to blue',()=>{
 const c=new Colours(),a=row({alt_baro:0,baro_rate:-1000}),start=c.sample(a,0,fallback),ground=row({alt_baro:'ground'});
 assert.equal(c.sample(ground,0,fallback),start);
 c.sample(ground,100,fallback);const early=c.tracks.get(a.hex).lab.slice(),red=Colours.lab(Colours.PALETTES.night[5]),blue=Colours.lab(Colours.PALETTES.night[0]);
 assert.ok(difference(early,red)<difference(early,blue));
 c.sample(ground,8000,fallback);assert.ok(difference(c.tracks.get(a.hex).lab,blue)<=difference(red,blue)*.051);
});
test('colour smoothing is frame-rate independent and repeated paints do not advance it',()=>{
 const one=new Colours(),many=new Colours(),a=row(),b=row({baro_rate:0});one.sample(a,0,fallback);many.sample(a,0,fallback);
 for(let t=100;t<=8000;t+=100)many.sample(b,t,fallback);
 one.sample(b,8000,fallback);assert.ok(difference(one.tracks.get(a.hex).lab,many.tracks.get(a.hex).lab)<1e-12);
 const before=one.sample(b,8000,fallback);assert.equal(one.sample(row({alt_baro:'ground'}),8000,fallback),before);
});
test('held aircraft freeze their colour even while the playback clock advances',()=>{
 const c=new Colours(),a=row(),before=c.sample(a,1000,fallback);
 assert.equal(c.sample({...a,held:true,alt_baro:'ground'},41000,fallback),before);
 assert.equal(c.sample({...a,held:true},42000,fallback),before);
 assert.equal(new Colours().sample({...a,held:true},42000,fallback),fallback);
});
test('missing telemetry fades to classic and geometric telemetry is supported',()=>{
 const c=new Colours(),a=row();c.sample(a,0,fallback);c.sample({...a,alt_baro:null,baro_rate:null},8000,fallback);
 assert.ok(difference(c.tracks.get(a.hex).lab,Colours.lab(fallback))<.02);
 assert.equal(Colours.target(row({alt_baro:null,alt_geom:15000,baro_rate:NaN,geom_rate:-600})).phase,'descent');
 assert.equal(Colours.target(row({baro_rate:null})),null);
});
test('backward clock changes cannot rewind colours',()=>{
 const c=new Colours(),a=row();c.sample(a,10000,fallback);const before=c.sample(row({baro_rate:0}),15000,fallback);
 assert.equal(c.sample(row({alt_baro:'ground'}),11000,fallback),before);assert.equal(c.tracks.get(a.hex).time,15000);
});
test('aircraft colour state is isolated by ICAO identity and bounded by retention',()=>{
 const c=new Colours({maxTracks:2,retention:10000});c.sample(row(),0,fallback);const other=row({hex:'abcdef',baro_rate:-900});c.sample(other,1000,fallback);
 assert.notEqual(c.sample(row(),2000,fallback),c.sample(other,2000,fallback));c.sample(row({hex:'123456'}),3000,fallback);assert.equal(c.tracks.size,2);
 c.prune(14000);assert.equal(c.tracks.size,0);assert.equal(c.sample(row({hex:'not-an-aircraft'}),15000,fallback),fallback);
});
test('theme palettes keep the same semantics and finite colours across their full ramps',()=>{
 for(const theme of ['night','paper'])for(let alt_baro=-1000;alt_baro<=60000;alt_baro+=50)for(const baro_rate of [-2500,0,2500]){
  const t=Colours.target(row({alt_baro,baro_rate}),undefined,theme);assert.ok(Colours.rgb(t.lab).every(v=>Number.isFinite(v)&&v>=0&&v<=255));
 }
});
