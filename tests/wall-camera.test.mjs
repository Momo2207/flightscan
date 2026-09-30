import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const block=name=>'/* '+name+'_START:'+html.split('/* '+name+'_START:')[1].split('/* '+name+'_END */')[0];
const helpers=html.split('\n').filter(l=>/^(const rad=|function (distance|project|unproject|containsBounds)\()/.test(l)).join('\n');
const f=vm.runInNewContext('const num=v=>typeof v==="number"&&Number.isFinite(v);\n'+helpers+'\n'+['WALL_COVERAGE','WALL_CAMERA','WALL_MINIMALIST'].map(block).join('\n')+'\n({width:wallWidthAtZoom,coverage:wallCoverageFor,clean:wallCleanZoom,label:wallAircraftLabel,place:wallLabelBox,contains:containsBounds})');
for(const [lat,lon,w,h] of [[48.47,7.94,1920,1080],[50,8,3840,2160],[50,8,1080,1920],[0,179.9,1400,900],[75,20,1200,800]])test(`custom zoom preserves projected viewport at ${lat},${lon} ${w}x${h}`,()=>{
 for(const z of [9,10.5,13,15]){
  const r=f.coverage({lat,lon},f.width(lat,z,w),w,h,90);
  if(r.limited){assert.ok(r.zoom>=z);assert.ok(r.collection.km<=449.9)}else assert.ok(Math.abs(r.zoom-z)<.00001);
  const b=r.visible.bounds;
  for(const p of [{lat:b.north,lon:b.west},{lat:b.south,lon:b.east}])assert.equal(f.contains(p,r.collection.bounds),true);
 }
});
test('extreme zoom-out respects feed limits while keeping viewport corners',()=>{
 for(const [w,h]of [[3840,2160],[1080,1920]]){
  const r=f.coverage({lat:50,lon:8},f.width(50,4,w),w,h,120);
  assert.ok(r.zoom>4);assert.equal(r.limited,true);assert.ok(r.collection.km<=449.9);
  assert.equal(f.contains({lat:r.visible.bounds.north,lon:r.visible.bounds.east},r.collection.bounds),true);
 }
});
test('corrupt zoom settings cannot reach the renderer',()=>{
 for(const v of [null,undefined,'9',NaN,Infinity,-1,0,3.5,15.5,99]){assert.equal(f.clean(v),null);assert.equal(f.clean(v,9),9)}
 for(const v of [4,8.5,15])assert.equal(f.clean(v),v);
});
test('labels format reported callsign and barometric altitude with honest unknown states',()=>{
 const a={flight:' DLH123 ',alt_baro:35160,track:90,gs:400};
 assert.equal(f.label(a).callsign,'DLH123');assert.equal(f.label(a).altitude,'35,200 ft');assert.equal(f.label(a,true).altitude,'10,720 m');assert.equal(f.label(a).arrow,true);
 assert.equal(f.label({r:'D-ABCD'}).callsign,'No callsign');assert.equal(f.label({alt_baro:null}).altitude,'Altitude unknown');
 assert.equal(f.label({alt_baro:0}).altitude,'0 ft');assert.equal(f.label({alt_baro:-120}).altitude,'-100 ft');
 assert.equal(f.label({alt_baro:'ground',track:90}).altitude,'Ground');
});
test('held, ground, stationary and unknown-heading aircraft do not get movement arrows',()=>{
 for(const a of [{held:true,alt_baro:10000,track:90},{alt_baro:'ground',track:10},{alt_baro:10000,track:null},{alt_baro:10000,track:50,gs:0}])assert.equal(f.label(a).arrow,false);
 assert.match(f.label({held:true,alt_baro:10000,track:0}).altitude,/held$/);
 assert.equal(f.label({alt_baro:10000,track:0,gs:300}).arrow,true);
});
test('label boxes stay within portrait and landscape edges and find free alternatives',()=>{
 for(const [width,height]of [[1920,1080],[320,740],[1080,1920]]){
  for(const point of [{x:1,y:1},{x:width-1,y:height-1},{x:width-1,y:1},{x:1,y:height-1}]){
   const b=f.place(point,160,64,width,height,[],[]);assert.ok(b.x>=6&&b.y>=6);assert.ok(b.x+b.w<=width-6&&b.y+b.h<=height-6);
  }
 }
 const p={x:500,y:500},first=f.place(p,160,64,1920,1080,[],[]),second=f.place(p,160,64,1920,1080,[first],[]);
 assert.ok(first.x!==second.x||first.y!==second.y);
 assert.ok(first.x+first.w<=second.x||second.x+second.w<=first.x||first.y+first.h<=second.y||second.y+second.h<=first.y);
});
test('taller route labels use available space around a dense aircraft cluster',()=>{
 const overlaps=(a,b)=>Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y));
 for(const [width,height]of [[1920,1080],[1080,1920]]){
  const points=Array.from({length:12},(_,i)=>({x:width/2+(Math.floor(i/4)-1)*80,y:height/2+(i%4-1.5)*38}));
  const icons=points.map(p=>({x:p.x-21,y:p.y-24,w:42,h:48})),occupied=[];
  for(const point of points){
   const box=f.place(point,160,90,width,height,occupied,icons);
   assert.ok(occupied.every(other=>overlaps(box,other)===0),'route callsigns must not cover one another when space is available');
   assert.ok(icons.every(icon=>overlaps(box,icon)===0));occupied.push(box);
  }
  const moved=f.place(points[0],160,90,width,height,occupied.slice(1),icons,28,occupied[0].slot);
  assert.equal(moved.slot,occupied[0].slot,'a free previous placement stays stable');
 }
});
