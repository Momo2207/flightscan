import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../design-system/wall-gallery.js',import.meta.url),'utf8');
function boot(){
 const timers=new Map();let seq=0;const c=vm.createContext({Date,TextDecoder,DataView,Uint8Array,AbortController,console,setTimeout(fn,ms){timers.set(++seq,{fn,ms});return seq},clearTimeout(id){timers.delete(id)}});
 vm.runInContext(source+'\nthis.Solar=GallerySolar;this.Focus=GalleryFocus;this.Pbf=GalleryPbf;this.MapModel=GalleryMap;',c);return {...c,timers};
}
const tick=async()=>{for(let i=0;i<12;i++)await new Promise(setImmediate)};
const uint=n=>{const out=[];do{const b=n%128;n=Math.floor(n/128);out.push(b+(n?128:0))}while(n);return out};
const bytesField=(field,data)=>[...uint(field*8+2),...uint(data.length),...data];
const stringField=(field,text)=>bytesField(field,[...new TextEncoder().encode(text)]);
const numberField=(field,n)=>[...uint(field*8),...uint(n)];
const packed=(field,values)=>bytesField(field,values.flatMap(uint));
const feature=(type,tags,geometry)=>[...packed(2,tags),...numberField(3,type),...packed(4,geometry)];
const layer=(name,features,keys,values)=>bytesField(3,[...stringField(1,name),...features.flatMap(f=>bytesField(2,f)),...keys.flatMap(k=>stringField(3,k)),...values.flatMap(v=>bytesField(4,typeof v==='string'?stringField(1,v):numberField(5,v))),...numberField(5,4096),...numberField(15,2)]);
// Small synthetic geographic data, used only for decoding/renderer tests.
const fixture=()=>new Uint8Array([
 ...layer('water',[feature(3,[0,0],[9,0,0,26,8192,0,0,8192,8191,0,15])],['class'],['lake']),
 ...layer('waterway',[feature(2,[0,0],[9,200,200,18,200,400,99,400])],['class'],['river']),
 ...layer('place',[feature(1,[0,0,1,1,2,2],[9,4096,4096])],['class','name','rank'],['city','Example city',3]),
 ...layer('building',[feature(3,[],[9,0,0,15])],[],[])
]);
test('offline solar position follows UTC longitude, seasons and leap years',()=>{
 const {Solar}=boot();const noon=Solar.position(Date.parse('2024-03-20T12:00:00Z'),0,0),midnight=Solar.position(Date.parse('2024-03-20T00:00:00Z'),0,0);
 assert.ok(noon.altitude>87);assert.ok(midnight.altitude< -87);
 assert.ok(Solar.position(Date.parse('2024-03-20T06:00:00Z'),0,90).altitude>87);
 assert.ok(Solar.position(Date.parse('2024-06-21T12:00:00Z'),70,0).altitude>40);
 assert.ok(Solar.position(Date.parse('2024-12-21T12:00:00Z'),70,0).altitude<0);
 for(const d of ['2024-02-29T18:00:00Z','2025-03-01T18:00:00Z'])assert.ok(Number.isFinite(Solar.position(Date.parse(d),48,8).altitude));
 assert.equal(Solar.position(NaN,48,8),null);assert.equal(Solar.position(Date.now(),91,8),null);
});
test('daylight atmosphere is continuous, bounded and warm only at sunset',()=>{
 const {Solar}=boot(),morning=Solar.levels(Date.parse('2026-03-20T06:00:00Z'),0,0),evening=Solar.levels(Date.parse('2026-03-20T18:00:00Z'),0,0);
 assert.equal(morning.warm,0);assert.ok(evening.warm>.8);assert.equal(Solar.levels(Date.parse('2026-03-20T12:00:00Z'),0,0).night,0);assert.equal(Solar.levels(Date.parse('2026-03-20T00:00:00Z'),0,0).night,1);
 let previous;for(let minute=0;minute<1440;minute++){const value=Solar.levels(Date.parse('2026-10-01T00:00:00Z')+minute*60000,48.47377,7.94495);for(const n of Object.values(value))assert.ok(n>=0&&n<=1);if(previous){assert.ok(Math.abs(value.night-previous.night)<.035);assert.ok(Math.abs(value.warm-previous.warm)<.04)}previous=value}
});
test('focus fades between identities without retaining old selection after the transition',()=>{
 const f=new (boot().Focus)();assert.equal(f.change('abc',1000),true);assert.equal(f.change('abc',1100),false);assert.equal(f.weights(1450)[0].weight,.5);
 f.change('def',2000);const halfway=f.weights(2450);assert.deepEqual(Array.from(halfway,a=>[a.hex,a.weight]),[['abc',.5],['def',.5]]);
 assert.deepEqual(Array.from(f.weights(2900),a=>a.hex),['def']);f.change('',3000);assert.deepEqual(Array.from(f.weights(3900)),[]);f.clear();assert.equal(f.current,'');
});
test('reduced motion changes focus immediately, including backwards clock changes',()=>{
 const f=new (boot().Focus)();f.change('abc',1000);f.change('def',2000,true);assert.deepEqual(Array.from(f.weights(2000,true),a=>[a.hex,a.weight]),[['def',1]]);assert.ok(f.weights(0).every(a=>a.weight>=0));
});
test('vector decoder preserves polygon closure, line deltas, point metadata and ignores unneeded layers',()=>{
 const layers=boot().Pbf.decode(fixture());assert.deepEqual(Array.from(layers,l=>l.name),['water','waterway','place']);
 const polygon=layers[0].features[0].paths[0];assert.deepEqual(Array.from(polygon,p=>Array.from(p)),[[0,0],[4096,0],[4096,4096],[0,4096],[0,0]]);
 const river=layers[1].features[0];assert.deepEqual(Array.from(river.paths[0],p=>Array.from(p)),[[100,100],[200,300],[150,500]]);
 assert.equal(layers[2].features[0].properties.name,'Example city');assert.equal(layers[2].features[0].properties.rank,3);
});
test('malformed or oversized vector data fails safely instead of producing fake geography',()=>{
 const {Pbf}=boot();for(const bytes of [new Uint8Array([26,200]),new Uint8Array([26,128]),new Uint8Array(8*1024*1024+1),new Uint8Array(layer('water',[feature(3,[],[9,2])],[],[]))])assert.throws(()=>Pbf.decode(bytes));
});
test('airport tiles retain the supplied runway and taxiway paths and reference tags',()=>{
 const {Pbf}=boot(),bytes=new Uint8Array(layer('aeroway',[
  feature(2,[0,0,1,1],[9,200,400,10,2000,500]),
  feature(2,[0,2],[9,300,600,18,200,100,200,99]),
  feature(3,[0,3],[9,0,0,26,8192,0,0,8192,8191,0,15])
 ],['class','ref'],['runway','07C/25C','taxiway','aerodrome']));
 const [airport]=Pbf.decode(bytes);assert.equal(airport.name,'aeroway');assert.equal(airport.features[0].properties.ref,'07C/25C');
 assert.deepEqual(Array.from(airport.features[0].paths[0],p=>Array.from(p)),[[100,200],[1100,450]]);
 assert.deepEqual(Array.from(airport.features[1].paths[0],p=>Array.from(p)),[[150,300],[250,350],[350,300]]);
});
test('airport styling is limited to runway and taxiway geometry at appropriate zooms',()=>{
 const {MapModel}=boot(),colours=MapModel.colours('night'),f=(kind,type=2)=>({type,properties:{class:kind}});
 for(const kind of ['apron','aerodrome','gate','helipad','heliport','toString','unknown'])assert.equal(MapModel.airfieldStyle(f(kind),14,colours),null);
 assert.equal(MapModel.airfieldStyle(f('runway'),9,colours),null);assert.equal(MapModel.airfieldStyle(f('taxiway'),11,colours),null);
 assert.equal(MapModel.airfieldStyle(f('runway',1),14,colours),null);
 const runway=MapModel.airfieldStyle(f('runway'),12,colours),taxiway=MapModel.airfieldStyle(f('taxiway'),12,colours);
 assert.ok(runway.width>taxiway.width);assert.equal(runway.fill,false);assert.equal(MapModel.airfieldStyle(f('runway',3),14,colours).fill,true);
 assert.notEqual(colours.runway,MapModel.colours('paper').runway);
});
test('airport overlay draws only mapped paths, with runways above taxiways and no glow',()=>{
 const {MapModel}=boot(),model=new MapModel(),events=[],c={beginPath(){events.push(['begin'])},moveTo(x,y){events.push(['move',x,y])},lineTo(x,y){events.push(['line',x,y])},closePath(){events.push(['close'])},fill(){events.push(['fill',this.fillStyle])},stroke(){events.push(['stroke',this.strokeStyle,this.lineWidth])}};
 const path=[[10,20],[20,30],[25,40]],feature=(kind,type=2)=>({type,properties:{class:kind},paths:[path]}),layers=[{name:'aeroway',extent:512,features:[feature('runway'),feature('gate',1),feature('taxiway'),feature('apron',3),feature('aerodrome',3)]}];
 model.drawAirfield(c,layers,MapModel.colours('night'),13);
 assert.deepEqual(events.filter(e=>e[0]==='stroke').map(e=>e[1]),[MapModel.colours('night').taxiway,MapModel.colours('night').runway]);
 assert.deepEqual(events.filter(e=>e[0]==='move'),[['move',10,20],['move',10,20]]);assert.equal(events.filter(e=>e[0]==='line').length,4);assert.equal(events.filter(e=>e[0]==='fill').length,0);assert.equal(c.globalAlpha,1);
});
test('map metadata resolves the versioned public source and rejects unrelated hosts',async()=>{
 for(const [url,expected]of [['https://tiles.openfreemap.org/planet/20260913_164504_pt/{z}/{x}/{y}.pbf','20260913_164504_pt'],['https://evil.example/{z}/{x}/{y}.pbf','latest']]){
  const {MapModel}=boot(),m=new MapModel(async()=>({ok:true,json:async()=>({tiles:[url]})}));await m.resolveSource();assert.ok(m.template.includes('/'+expected+'/'));
 }
});
test('map fetches coalesce visible tiles, limit concurrency and retain normal caching on versioned URLs',async()=>{
 const {MapModel}=boot(),pending=[],m=new MapModel((url,options)=>new Promise(resolve=>pending.push({url,options,resolve})));m.template='https://tiles.openfreemap.org/planet/v1/{z}/{x}/{y}.pbf';
 m.begin();for(let x=0;x<10;x++){m.request(5,x,2);m.request(5,x,2)}m.end();assert.equal(m.tiles.size,10);assert.equal(pending.length,4);assert.equal(m.active,4);
 assert.equal(pending[0].options.credentials,'omit');assert.equal(pending[0].options.cache,'default');
 pending[0].resolve({ok:true,arrayBuffer:async()=>fixture().buffer});await tick();assert.equal(pending.length,5);assert.equal(m.active,4);assert.ok(m.tiles.get('5/0/2').layers);m.clear();assert.ok(pending.slice(1).every(p=>p.options.signal.aborted));
});
test('map timeout covers body reading, keeps a cooldown and rejects late completions',async()=>{
 const {MapModel,timers}=boot();let finish;const m=new MapModel(async()=>({ok:true,arrayBuffer:()=>new Promise(resolve=>finish=resolve)}));m.template='https://tiles.openfreemap.org/planet/v1/{z}/{x}/{y}.pbf';
 const item=m.request(5,1,2);await tick();assert.equal(m.active,1);[...timers.values()].find(t=>t.ms===8000).fn();await tick();assert.equal(item.failed,true);assert.equal(m.active,0);assert.equal(m.request(5,1,2),item);
 finish(fixture().buffer);await tick();assert.equal(item.layers,null);m.clear();assert.equal(m.tiles.size,0);
});
test('vector cache stays bounded as the camera visits new tiles and queued offscreen work is dropped',()=>{
 const {MapModel}=boot(),m=new MapModel(()=>new Promise(()=>{}));m.template='https://tiles.openfreemap.org/planet/v1/{z}/{x}/{y}.pbf';
 for(let x=0;x<220;x++){m.begin();m.request(9,x,2);m.end()}assert.ok(m.tiles.size<=160);assert.equal(m.queue.length,1);assert.equal(m.request(9,0,-1),null);m.clear();
});
test('gallery helpers are embedded before startup without flight requests or extra animation loops',async()=>{
 const html=await readFile(new URL('../index.html',import.meta.url),'utf8');assert.ok(html.includes(source.trim()));assert.ok(html.indexOf('/* WALL_GALLERY_START */')<html.indexOf('initializeModes();render();updateStatus();poll();wallInitialize()'));
 assert.match(html,/<\/html>\s*$/);for(const match of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))assert.doesNotThrow(()=>new vm.Script(match[1]));
 assert.doesNotMatch(source,/api\/relay|routesFetch|requestAnimationFrame|setInterval/);assert.match(html,/id="wallAtmosphere"/);assert.match(html,/id="wallCartography"/);
});
