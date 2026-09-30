import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
const script=html.split('/* UI_APPEARANCE_START */')[1].split('/* UI_APPEARANCE_END */')[0];
function boot({saved=null,light=false,wall=false,wallTheme='night',blocked=false}={}){
 const values=new Map(saved===null?[]:[['flightscan-appearance-v1',saved]]),elements=new Map(),listeners=new Map();
 const el=id=>{if(!elements.has(id))elements.set(id,{value:'',textContent:'',disabled:false,dataset:{},attrs:{},setAttribute(k,v){this.attrs[k]=v}});return elements.get(id)};
 const root={dataset:{}},body={dataset:{}},meta={content:''};
 const context=vm.createContext({wallActive:wall,wallSettings:{theme:wallTheme,followHex:'3c4002',registration:'D-AIBQ',followZoom:10},wall:{themeRevision:0},window:{matchMedia:()=>({matches:light}),addEventListener:(name,fn)=>listeners.set(name,fn)},document:{documentElement:root,body,querySelector:()=>meta,querySelectorAll:()=>[]},localStorage:{getItem:k=>{if(blocked)throw Error('blocked');return values.get(k)||null},setItem:(k,v)=>{if(blocked)throw Error('blocked');values.set(k,v)}},$:el,draw(){},wallPaint(){},wallReduced:()=>false,wallPersist(){},wallApplyAppearance(){context.uiApplyAppearance()},console});
 vm.runInContext(script,context);
 return {context,root,values,el,listeners,run:s=>vm.runInContext(s,context)};
}
test('first visit follows device light preference and an explicit choice survives reload',()=>{
 const first=boot({light:true});assert.equal(first.root.dataset.theme,'paper');first.run("uiChooseTheme('night')");
 const next=boot({light:true,saved:first.values.get('flightscan-appearance-v1')});assert.equal(next.root.dataset.theme,'night');
});
test('corrupt or unavailable preference storage cannot prevent the UI starting',()=>{
 for(const saved of ['{broken','null','[]','{"theme":"javascript:alert(1)","effects":"oops"}']){const app=boot({saved});assert.equal(app.root.dataset.theme,'night');assert.equal(app.root.dataset.effects,'full')}
 const blocked=boot({blocked:true});blocked.run("uiChooseTheme('paper')");assert.equal(blocked.root.dataset.theme,'paper');assert.equal(blocked.run('uiPersistAppearance()'),false);
});
test('wall theme temporarily overrides the tracker and preserves tracked identity and zoom',()=>{
 const app=boot({wall:true,wallTheme:'night',saved:'{"theme":"paper"}'});assert.equal(app.root.dataset.theme,'night');
 app.run("uiChooseTheme('paper')");assert.equal(app.context.wallSettings.theme,'paper');assert.equal(app.context.wallSettings.followHex,'3c4002');assert.equal(app.context.wallSettings.followZoom,10);
 app.run("wallActive=false;uiApplyAppearance()");assert.equal(app.root.dataset.theme,'paper');assert.equal(app.run('uiSettings.theme'),'paper');
});
test('a wall theme change cannot replace a different saved tracker theme',()=>{
 const app=boot({wall:true,saved:'{"theme":"night"}'});app.run("uiChooseTheme('paper');wallActive=false;uiApplyAppearance()");assert.equal(app.root.dataset.theme,'night');assert.equal(app.run('uiSettings.theme'),'night');
});
test('reduced effects suppress flow without losing the stored background choice',()=>{
 const app=boot({saved:'{"theme":"night","effects":"reduced","ambient":"flow"}'});assert.equal(app.root.dataset.effects,'reduced');assert.equal(app.el('uiAmbient').disabled,true);assert.equal(app.run('document.body.dataset.ambient'),'static');assert.equal(app.run('uiSettings.ambient'),'flow');
 app.el('uiEffects').value='full';app.el('uiEffects').onchange();assert.equal(app.run('document.body.dataset.ambient'),'flow');assert.equal(app.el('uiAmbient').disabled,false);
});
test('cross-tab preference changes update appearance and ignore unrelated storage',()=>{
 const app=boot();app.listeners.get('storage')({key:'other',newValue:'{"theme":"paper"}'});assert.equal(app.root.dataset.theme,'night');
 app.listeners.get('storage')({key:'flightscan-appearance-v1',newValue:'{"theme":"paper","effects":"reduced"}'});assert.equal(app.root.dataset.theme,'paper');assert.equal(app.root.dataset.effects,'reduced');
 app.listeners.get('storage')({key:'flightscan-appearance-v1',newValue:'invalid'});assert.equal(app.root.dataset.theme,'paper');
});
const luminance=hex=>{const rgb=hex.slice(1,7).match(/../g).map(c=>parseInt(c,16)/255).map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4);return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722};
const contrast=(a,b)=>{const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)};
test('canvas text and warnings have readable contrast on their opaque theme surfaces',()=>{
 const app=boot();for(const theme of ['night','paper']){const p=app.run(`uiCanvasPalette('${theme}')`);for(const key of ['ink','muted','warn'])assert.ok(contrast(p[key],p.label)>=4.5,`${theme} ${key}`);assert.ok(contrast(p.selectedLine,p.label)>=3)}
});
test('genuine font weights are embedded without a font CDN',()=>{
 for(const weight of [100,300,400,500,700,900])assert.match(html,new RegExp('font-weight:'+weight+';font-display:swap;src:url\\(data:font/woff2;base64,'));
 assert.doesNotMatch(html,/fonts\.(googleapis|gstatic)\.com/);assert.doesNotMatch(html,/<link[^>]+href=["']https:[^"']+\.(?:woff2|ttf)/);
});
