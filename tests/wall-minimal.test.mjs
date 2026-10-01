import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const source='/* WALL_MINIMALIST_START:'+html.split('/* WALL_MINIMALIST_START:')[1].split('/* WALL_MINIMALIST_END */')[0]+'/* WALL_MINIMALIST_END */';
const editable=readFileSync(new URL('../design-system/wall-minimal.js',import.meta.url),'utf8');
const routes=readFileSync(new URL('../design-system/wall-routes.js',import.meta.url),'utf8');
function boot(reduced=false){
 const c=vm.createContext({Date,num:v=>typeof v==='number'&&Number.isFinite(v),wallReduced:()=>reduced,uiCanvasFont:(size,weight)=>weight+' '+size+'px sans-serif',typeFor:a=>({code:a.t||'',name:a.desc||(a.t==='A320'?'Airbus A320-200':a.t? a.t+' · aircraft type':'Aircraft type unavailable')})});
 vm.runInContext(routes+'\n'+source+'\nthis.Model=WallInfoPresentation;',c);return c;
}
const plane={hex:'3c1234',flight:'DLH123',alt_baro:35160,gs:430,t:'A320'};
const route={from:{code:'FRA',city:'Frankfurt'},to:{code:'LIS',city:'Lisbon'}};
const plain=x=>JSON.parse(JSON.stringify(x));
test('embedded aircraft-only implementation matches editable source without extra timers or requests',()=>{
 assert.equal(source,editable.trim());assert.doesNotMatch(source,/\b(?:fetch|setInterval|setTimeout|requestAnimationFrame)\s*\(/);
});
test('info cards cycle available altitude, speed, type and both route aliases with fixed callsign',()=>{
 const c=boot(),entries=c.wallAircraftInfo(plane,false,route),model=new c.Model();
 assert.deepEqual(plain(entries.map(e=>e.id)),['altitude','speed','type','route-codes','route-names']);
 assert.deepEqual(plain(entries.map(e=>e.text)),['35,200 ft','430 kt','Airbus A320-200','FRA → LIS','Frankfurt → Lisbon']);
 for(let step=0;step<=10;step++){const view=model.view(plane,entries,1000+step*8000);assert.equal(view.entries[view.index].id,entries[step%5].id);assert.equal(c.wallAircraftLabel(plane).callsign,'DLH123')}
 assert.equal(model.view(plane,entries,1000+87999).index,0);
});
test('missing values are skipped; zero, ground, geometric altitude and metric units remain usable',()=>{
 const c=boot();assert.deepEqual(plain(c.wallAircraftInfo({...plane,alt_baro:null,gs:null,t:''},false,null).map(e=>e.id)),['unavailable']);
 assert.deepEqual(plain(c.wallAircraftInfo({alt_baro:'ground',gs:0})).map(e=>e.text),['Ground','0 kt']);
 assert.deepEqual(plain(c.wallAircraftInfo({alt_geom:10000,gs:100,t:'ZZZZ'},true)).map(e=>e.text),['3,050 m','185 km/h','ZZZZ']);
 assert.deepEqual(plain(c.wallAircraftInfo({alt_baro:-200,gs:-1})).map(e=>e.text),['-200 ft']);
 assert.equal(c.wallAircraftInfo({held:true})[0].text,'Position held');assert.ok(c.wallAircraftInfo({...plane,held:true}).every(e=>e.text.endsWith(' · held')));
});
test('telemetry updates do not restart cycles, while changed callsigns and removed routes clear stale pages',()=>{
 const c=boot(),model=new c.Model(),entries=c.wallAircraftInfo(plane,false,route);model.view(plane,entries,1000);
 const changed={...plane,alt_baro:20000,gs:350};assert.equal(model.view(changed,c.wallAircraftInfo(changed,false,route),17500).index,2);
 assert.equal(model.view(changed,c.wallAircraftInfo(changed,false,null),18000).index,0);
 assert.ok(model.view(changed,c.wallAircraftInfo(changed,false,null),42000).entries.every(e=>!e.id.startsWith('route')));
 const next={...changed,flight:'DLH456'};assert.equal(model.view(next,c.wallAircraftInfo(next),43000).index,0);
});
test('cycle storage is bounded, expires absent aircraft and handles clock reversal',()=>{
 const c=boot(),model=new c.Model(),entries=c.wallAircraftInfo(plane);model.view(plane,entries,1000);assert.equal(model.view(plane,entries,500).elapsed,0);
 for(let i=0;i<1600;i++)model.view({...plane,hex:String(i)},entries,1000+i);assert.equal(model.states.size,1500);
 model.prune(483000);assert.equal(model.states.size,0);model.clear();assert.equal(model.states.size,0);
});
test('all phases reserve the same dimensions and preserve full route/type strings with thin orange routes',()=>{
 const c=boot(),model=new c.Model(),entries=c.wallAircraftInfo({...plane,desc:'Airbus A320-200 with a long supplied name'},false,{from:{code:'CAG',city:'Cagliari Elmas Airport'},to:{code:'FKB',city:'Karlsruhe/Baden-Baden Airport'}});
 const context={measureText:t=>({width:[...t].length*7})},layout=c.wallInfoLayout(context,'DLH123',entries,13,154);
 assert.ok(layout.width<=166);assert.ok(layout.height>=50);
 for(const [i,page]of layout.pages.entries()){assert.equal(page.lines.join('').replace(/\s/g,''),entries[i].text.replace(/\s/g,''));assert.ok(page.lines.every(t=>context.measureText(t).width<=154))}
 const first=model.view(plane,entries,1000);for(let step=1;step<5;step++){const view=model.view(plane,entries,1000+step*8000),next=c.wallInfoLayout(context,'DLH123',view.entries,13,154);assert.equal(next.width,layout.width);assert.equal(next.height,layout.height)}
 assert.equal(first.index,0);
});
test('detail crossfade leaves callsign outside animation and reduced motion swaps immediately',()=>{
 for(const reduced of [false,true]){
  const c=boot(reduced),model=new c.Model(),entries=c.wallAircraftInfo(plane,false,route),paints=[],context={measureText:t=>({width:t.length*7}),fillText(text){paints.push({text,alpha:this.globalAlpha,colour:this.fillStyle,font:this.font})}};
  model.view(plane,entries,1000);const view=model.view(plane,entries,25250),layout=c.wallInfoLayout(context,'DLH123',entries,13,154);
  c.wallInfoPaint(context,view,layout,0,0,154,.8,'grey','orange');
  assert.ok(paints.some(p=>p.text==='FRA → LIS'&&p.colour==='orange'&&p.font.startsWith('300 ')));
  assert.equal(paints.some(p=>p.text==='Airbus A320-200'),!reduced);assert.ok(paints.every(p=>p.text!=='DLH123'));assert.equal(context.globalAlpha,.8);
 }
});
const length=rows=>rows.reduce((sum,[a,b])=>sum+Math.hypot(a.x-b.x,a.y-b.y),0);
test('cards prefer an adjacent position outside their own arrow for every heading, including stable-slot changes',()=>{
 const c=boot(),p={x:500,y:500};
 for(let heading=0;heading<360;heading+=5){const vectors=c.wallDirectionSegments(p,heading,1.5),box=c.wallLabelBox(p,160,74,1000,1000,[],[],26,0,vectors);assert.ok(Math.abs(length(vectors)-length(c.wallClipVectors(vectors,[box])))<.1,JSON.stringify({heading,box}));const dx=Math.max(box.x-p.x,0,p.x-box.x-box.w),dy=Math.max(box.y-p.y,0,p.y-box.y-box.h);assert.ok(Math.hypot(dx,dy)<=27)}
});
test('arrows are clipped outside the union of overlapping cards with safe clearance',()=>{
 const c=boot(),vectors=[[{x:0,y:20},{x:100,y:20}]],boxes=[{x:20,y:10,w:30,h:20},{x:40,y:5,w:30,h:30}];
 assert.deepEqual(plain(c.wallClipVectors(vectors,boxes)),[[{x:0,y:20},{x:16,y:20}],[{x:74,y:20},{x:100,y:20}]]);
 assert.deepEqual(plain(c.wallClipVectors([[{x:20,y:20},{x:50,y:20}]],boxes)),[]);
 assert.deepEqual(plain(c.wallClipVectors([[{x:0,y:0},{x:100,y:0}]],boxes)),[[{x:0,y:0},{x:100,y:0}]]);
});
test('clipped arrows stay outside every card at screen edges and during dense overlap',()=>{
 const c=boot();
 for(const scale of [.9,1.5,2.08])for(let heading=0;heading<360;heading+=5){
  const p={x:318,y:2},vectors=c.wallDirectionSegments(p,heading,scale),boxes=[c.wallLabelBox(p,150,60,320,740,[],[],18,0,vectors),{x:270,y:5,w:40,h:80},{x:265,y:20,w:50,h:35}];
  const clipped=c.wallClipVectors(vectors,boxes);
  for(const [a,b]of clipped)for(let f=0;f<=1;f+=.1){const x=a.x+(b.x-a.x)*f,y=a.y+(b.y-a.y)*f;assert.ok(boxes.every(box=>x<=box.x-3.9||x>=box.x+box.w+3.9||y<=box.y-3.9||y>=box.y+box.h+3.9))}
 }
});
