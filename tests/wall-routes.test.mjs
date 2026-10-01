import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../design-system/wall-routes.js',import.meta.url),'utf8');
const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
const style=await readFile(new URL('../design-system/routes.css',import.meta.url),'utf8');
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function boot(reduced=false){
 const context=vm.createContext({Date,esc,wallReduced:()=>reduced,uiCanvasFont:(size,weight)=>weight+' '+size+'px sans-serif'});
 vm.runInContext(source+'\nthis.Model=WallRoutePresentation;',context);return context;
}
const a={hex:'4ca225',flight:'RYR13GN'};
const route={callsign:a.flight,from:{code:'CAG',city:'Cagliari',name:'Cagliari Elmas Airport'},to:{code:'FKB',city:'Karlsruhe/Baden-Baden',name:'Karlsruhe/Baden-Baden Airport'}};
test('codes show first, names at eight seconds, codes again at sixteen',()=>{
 const model=new (boot().Model)();
 for(const [time,mode]of [[1000,'codes'],[8999,'codes'],[9000,'names'],[16999,'names'],[17000,'codes'],[25000,'names']])assert.equal(model.view('card',a,route,time).mode,mode);
});
test('new position or refreshed route response does not restart the reading interval',()=>{
 const model=new (boot().Model)();model.view('card',a,route,1000);
 const view=model.view('card',{...a,lat:48.5,positionTime:9000},{...route,checkedAt:9000},9500);
 assert.equal(view.mode,'names');assert.equal(view.elapsed,8500);
});
test('changing aircraft, callsign or endpoints starts with the new route codes',()=>{
 for(const [aircraft,next]of [[{...a,hex:'abcdef'},route],[{...a,flight:'RYR999'},route],[a,{...route,to:{code:'FRA',city:'Frankfurt'}}]]){
  const model=new (boot().Model)();model.view('card',a,route,1000);assert.equal(model.view('card',a,route,9500).mode,'names');
  const view=model.view('card',aircraft,next,9600);assert.equal(view.mode,'codes');assert.equal(view.elapsed,0);
 }
});
test('missing routes clear their cycle and no location name is invented',()=>{
 const model=new (boot().Model)();model.view('card',a,route,1000);assert.equal(model.view('card',a,null,9500),null);assert.equal(model.view('card',a,route,10000).mode,'codes');
 const view=model.view('unknown',a,{from:{iata:'CAG',name:'Cagliari Elmas'},to:{icao:'EDSB'}},1000);
 assert.equal(view.codes,'CAG → EDSB');assert.equal(view.names,'Cagliari Elmas → EDSB');
 assert.equal(model.view('bad',a,{from:{name:'Unknown'},to:{code:'FKB'}},1000),null);
});
test('names identical to codes remain static, including after long idle periods',()=>{
 const model=new (boot().Model)(),r={from:{code:'CAG'},to:{code:'FKB'}};
 model.view('card',a,r,1000);const view=model.view('card',a,r,999000);
 assert.equal(view.mode,'codes');assert.equal(view.alternates,false);
});
test('24-hour rows and card presentation clocks are independent and bounded',()=>{
 const model=new (boot().Model)();model.view('card',a,route,1000);assert.equal(model.view('log:'+a.hex,a,route,9500).mode,'codes');assert.equal(model.view('card',a,route,9500).mode,'names');
 for(let i=0;i<700;i++)model.view('log:'+i,{...a,hex:String(i)},route,10000+i);
 assert.ok(model.states.size<=512);model.clear();assert.equal(model.states.size,0);
});
test('clock reversal resets cleanly and large forward jumps do not create extra work',()=>{
 const model=new (boot().Model)();model.view('card',a,route,1000);assert.equal(model.view('card',a,route,500).elapsed,0);
 assert.equal(model.view('card',a,route,500+8000*101).mode,'names');assert.equal(model.states.size,1);
});
test('route strings are escaped for markup and both views stay present for steady geometry',()=>{
 const c=boot(),view=new c.Model().view('card',a,{...route,from:{code:'CAG',city:'<img src=x onerror=alert(1)>'}},1000);
 const markup=c.wallRouteMarkup(view);assert.ok(markup.includes('&lt;img'));assert.ok(!markup.includes('<img'));assert.match(markup,/wall-route-codes/);assert.match(markup,/wall-route-names/);
});
test('canvas full locations wrap instead of shrinking or truncating text, and preserve height',()=>{
 const c=boot(),model=new c.Model(),context={measureText:t=>({width:[...t].length*8})},view=model.view('minimal',a,route,1000);
 const first=c.wallRouteCanvasLayout(context,view,18,140),next=c.wallRouteCanvasLayout(context,model.view('minimal',a,route,9500),18,140);
 assert.equal(first.count,next.count);assert.equal(first.width,next.width);assert.equal(first.names.join(' ').replace(/\s/g,''),view.names.replace(/\s/g,''));assert.ok([...first.codes,...first.names].every(t=>context.measureText(t).width<=140));assert.match(context.font,/^300 /);
});
test('canvas fades between aliases but reduced motion swaps immediately without losing names',()=>{
 for(const reduced of [false,true]){
  const c=boot(reduced),model=new c.Model(),paints=[],context={measureText:t=>({width:t.length*8}),fillText(text){paints.push({text,alpha:this.globalAlpha,colour:this.fillStyle})}};
  model.view('minimal',a,route,1000);const view=model.view('minimal',a,route,9250),layout=c.wallRouteCanvasLayout(context,view,18,400);
  c.wallRouteCanvasPaint(context,view,layout,0,0,400,.8,'#ffb376');
  assert.ok(paints.some(p=>p.text.includes('Cagliari')));assert.equal(paints.some(p=>p.text==='CAG → FKB'),!reduced);assert.ok(paints.every(p=>p.colour==='#ffb376'));assert.equal(context.globalAlpha,.8);
  if(reduced)assert.ok(paints.every(p=>p.alpha===.8));else assert.ok(paints.every(p=>p.alpha===.4));
 }
});
test('compiled HTML includes the editable route presentation before startup and no extra polling',()=>{
 assert.ok(html.includes(source.trim()));assert.ok(html.indexOf('/* WALL_ROUTE_PRESENTATION_START */')<html.indexOf('initializeModes();render();updateStatus();poll();wallInitialize()'));
 assert.doesNotMatch(source,/\b(?:fetch|setTimeout|setInterval|requestAnimationFrame)\s*\(/);assert.match(style,/font-weight:300/);assert.match(style,/prefers-reduced-motion/);
});
