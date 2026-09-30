import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const geometry=html.split('/* WALL_COVERAGE_START:')[1].split('/* WALL_COVERAGE_END */')[0];
const helpers=html.split('\n').filter(l=>/^(const rad=|function (distance|project|unproject|containsBounds)\()/.test(l)).join('\n');
const {coverage,project,contains,distance}=vm.runInNewContext('const num=v=>typeof v==="number"&&Number.isFinite(v);\n'+helpers+'\n/* WALL_COVERAGE_START:'+geometry+'\n({coverage:wallCoverageFor,project,contains:containsBounds,distance})');
for(const [lat,lon,w,h] of [[48.47377,7.94495,1400,900],[48.47,7.94,900,1500],[0,179.9,1400,700],[75,20,1400,900],[-55,-179.9,1100,800]]){
 test(`viewport corners and collection buffer at ${lat},${lon} (${w}×${h})`,()=>{
  const c={lat,lon},r=coverage(c,200,w,h,90),b=r.visible.bounds,center=project(c,r.zoom),world=256*2**r.zoom;
  for(const point of [{lat:b.north,lon:b.west},{lat:b.north,lon:b.east},{lat:b.south,lon:b.west},{lat:b.south,lon:b.east}]){
   const p=project(point,r.zoom);let dx=p.x-center.x;if(dx>world/2)dx-=world;if(dx< -world/2)dx+=world;
   assert.ok(Math.abs(Math.abs(dx)-w/2)<.001);assert.ok(Math.abs(Math.abs(p.y-center.y)-h/2)<.001);
   assert.equal(contains(point,r.collection.bounds),true);assert.ok(distance(c,point)<r.collection.km);
  }
  assert.ok(r.marginKm>=50);assert.ok(r.collection.km<=449.9);assert.ok(Math.ceil(r.collection.km/1.852)<=243);
  assert.ok(Math.abs(r.widthKm-200)<.01);
 });
}
test('oversized portrait and landscape maps are constrained with no missing corners',()=>{
 for(const [w,h] of [[1920,1000],[700,1700]]){
  const r=coverage({lat:50,lon:8},800,w,h,120);assert.equal(r.limited,true);assert.ok(r.collection.km<=449.9);assert.ok(r.widthKm<800);
 }
});
test('buffer increases with delay while the visible width stays fixed',()=>{
 const c={lat:48,lon:8},a=coverage(c,90,1400,800,30),b=coverage(c,90,1400,800,120);
 assert.ok(b.marginKm>a.marginKm);assert.ok(b.collection.km>a.collection.km);assert.ok(Math.abs(a.widthKm-b.widthKm)<.0001);
});
test('invalid polar centre produces a clear error',()=>assert.throws(()=>coverage({lat:85,lon:0},90,1000,600,90),/85/));
