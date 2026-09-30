/* UI_APPEARANCE_START */
const UI_KEY='flightscan-appearance-v1';
function uiCleanAppearance(value={}){
  return {theme:value.theme==='paper'?'paper':'night',effects:value.effects==='reduced'?'reduced':'full',ambient:value.ambient==='flow'?'flow':'static'};
}
function uiLoadAppearance(){
  try{const saved=JSON.parse(localStorage.getItem(UI_KEY)||'null');if(saved&&typeof saved==='object')return uiCleanAppearance(saved)}catch{}
  return uiCleanAppearance({theme:window.matchMedia?.('(prefers-color-scheme: light)')?.matches?'paper':'night'});
}
const uiSettings=uiLoadAppearance();
const UI_PALETTES={
  night:{bg:'#05080f',map:'#0d192b',ink:'#f2f7ff',muted:'#b4c4d8',accent:'#70c5ff',plane:'#b4daff',line:'#88afd55c',label:'#0c1424f2',selectedLabel:'#172a43f7',selectedLine:'#b4daff',selectedFill:'#b4daff12',trail:'#b4daff99',scope:'#70c5ff99',scopeSoft:'#70c5ff30',scopeFill:'#70c5ff0a',warn:'#ffc491',tileTint:'#173b642a',tileFilter:'grayscale(1) invert(1) brightness(.52) contrast(.86)',ground:'#adbed0',low:'#a4d5ff',middle:'#81d5e1',high:'#c4b4ff'},
  paper:{bg:'#f5ebdd',map:'#eadfce',ink:'#302219',muted:'#725e50',accent:'#9f4e23',plane:'#714224',line:'#88634266',label:'#fff7ecf5',selectedLabel:'#fffaf2fa',selectedLine:'#714224',selectedFill:'#71422412',trail:'#71422499',scope:'#9f4e2399',scopeSoft:'#9f4e2330',scopeFill:'#9f4e2309',warn:'#844012',tileTint:'#e8b98738',tileFilter:'grayscale(1) contrast(.82) brightness(1.01)',ground:'#716961',low:'#23557c',middle:'#16676f',high:'#684696'}
};
function uiCanvasPalette(theme){return UI_PALETTES[theme||(wallActive?wallSettings.theme:uiSettings.theme)]||UI_PALETTES.night}
function uiStyledTile(item,theme){
  if(item.style===theme&&item.canvas)return item.canvas;
  const palette=uiCanvasPalette(theme),canvas=document.createElement('canvas');canvas.width=canvas.height=256;
  const c=canvas.getContext('2d');c.filter=palette.tileFilter;c.drawImage(item.img,0,0,256,256);c.filter='none';c.globalCompositeOperation='source-atop';c.fillStyle=palette.tileTint;c.fillRect(0,0,256,256);
  item.canvas=canvas;item.style=theme;return canvas;
}
function uiCanvasFont(size,weight=500){return weight+' '+size+'px "Flightscan Sans",system-ui,sans-serif'}
function uiPersistAppearance(){try{localStorage.setItem(UI_KEY,JSON.stringify(uiSettings));return true}catch{return false}}
function uiApplyAppearance(){
  const theme=wallActive?wallSettings.theme:uiSettings.theme,root=document.documentElement;
  root.dataset.theme=theme;root.dataset.effects=uiSettings.effects;root.dataset.motion=wallActive&&wallReduced()?'reduced':'system';
  document.body.dataset.ambient=uiSettings.effects==='reduced'?'static':uiSettings.ambient;$('wallDisplay').dataset.ambient=document.body.dataset.ambient;
  const meta=document.querySelector('meta[name="theme-color"]');if(meta)meta.content=UI_PALETTES[theme].bg;
  $('appearance').textContent=theme==='paper'?'☀ Sunset':'◐ Midnight';$('appearance').setAttribute('aria-label','Appearance settings, '+(theme==='paper'?'Sunset':'Midnight'));
  document.querySelectorAll('[data-ui-theme]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.uiTheme===theme)));
  $('uiEffects').value=uiSettings.effects;$('uiAmbient').value=uiSettings.ambient;$('uiAmbient').disabled=uiSettings.effects==='reduced';
  document.querySelectorAll('.map-legend [data-altitude]').forEach(el=>el.style.color=uiCanvasPalette(theme)[el.dataset.altitude]);
  if(wallActive){wall.themeRevision++;wallPaint()}else draw();
}
function uiChooseTheme(theme){
  theme=theme==='paper'?'paper':'night';
  if(wallActive){wallSettings.theme=theme;wallPersist();wallApplyAppearance()}
  else{uiSettings.theme=theme;uiPersistAppearance();uiApplyAppearance()}
}
function uiOpenAppearance(){uiApplyAppearance();$('appearanceDialog').showModal()}
$('appearance').onclick=uiOpenAppearance;$('closeAppearance').onclick=()=>$('appearanceDialog').close();
document.querySelectorAll('[data-ui-theme]').forEach(button=>button.onclick=()=>uiChooseTheme(button.dataset.uiTheme));
for(const [id,key]of [['uiEffects','effects'],['uiAmbient','ambient']])$(id).onchange=()=>{uiSettings[key]=$(id).value;uiPersistAppearance();uiApplyAppearance()};
window.addEventListener('storage',event=>{
  if(event.key!==UI_KEY)return;
  try{Object.assign(uiSettings,event.newValue?uiCleanAppearance(JSON.parse(event.newValue)):uiLoadAppearance());uiApplyAppearance()}catch{}
});
// Font arrival changes canvas text measurements as well as the DOM layout.
document.fonts?.ready?.then(()=>{if(wallActive){wall.lastCard='';wall.lastSecond=-1;wallUpdate(Date.now());wallResize();wallPaint()}else{resize();draw()}});
uiApplyAppearance();
/* UI_APPEARANCE_END */
