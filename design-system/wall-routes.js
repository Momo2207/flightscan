/* WALL_ROUTE_PRESENTATION_START */
// Presentation only: the existing route store decides which flight a route belongs to.
class WallRoutePresentation{
  constructor(){this.states=new Map();this.interval=8000;this.limit=512}
  static labels(route){
    if(!route?.from||!route?.to)return null;
    const code=p=>String(p.code||p.iata||p.icao||'').trim();
    const location=p=>String(p.city||p.name||code(p)).trim()||code(p);
    const from=code(route.from),to=code(route.to);
    if(!from||!to)return null;
    return {codes:from+' → '+to,names:location(route.from)+' → '+location(route.to)};
  }
  view(slot,aircraft,route,now=Date.now()){
    const labels=WallRoutePresentation.labels(route);
    if(!labels){this.states.delete(slot);return null}
    const key=JSON.stringify([aircraft?.hex||'',String(aircraft?.flight||route.callsign||'').trim().toUpperCase(),labels.codes,labels.names]);
    let state=this.states.get(slot);
    if(!state||state.key!==key||now<state.start){
      state={key,start:now};this.states.delete(slot);
      if(this.states.size>=this.limit)this.states.delete(this.states.keys().next().value);
      this.states.set(slot,state);
    }
    const elapsed=Math.max(0,now-state.start),alternates=labels.codes!==labels.names;
    return {...labels,key,elapsed,phaseMs:elapsed%this.interval,mode:alternates&&Math.floor(elapsed/this.interval)%2?'names':'codes',alternates};
  }
  clear(){this.states.clear()}
}
const wallRoutePresentation=new WallRoutePresentation();
function wallRouteMarkup(view){
  return '<span class="wall-route-line wall-route-codes" aria-hidden="true">'+esc(view.codes)+'</span><span class="wall-route-line wall-route-names" aria-hidden="true">'+esc(view.names)+'</span>';
}
function wallRouteFitNames(root){
  const width=root.clientWidth,names=root.querySelector('.wall-route-names');
  if(!width||!names||root.dataset.routeWidth===String(width))return;
  names.style.fontSize='';
  const style=getComputedStyle(names),base=parseFloat(style.fontSize),minimum=root.classList.contains('wall-log-route')?12:14;
  const ratio=parseFloat(style.lineHeight)/base||1.2;
  // Retain the entire location name. Fit two lines when possible, never ellipsize it.
  for(let size=base;size>minimum&&names.getBoundingClientRect().height>size*ratio*2.05;){
    size=Math.max(minimum,size-1);names.style.fontSize=size+'px';
  }
  root.dataset.routeWidth=String(width);
}
function wallRouteUpdate(root,aircraft,route,now=Date.now(),channel='card'){
  const slot=channel==='card'?'card':channel+':'+aircraft?.hex;
  const view=wallRoutePresentation.view(slot,aircraft,route,now);
  if(!root)return;
  if(!view){root.replaceChildren();delete root.dataset.routeKey;delete root.dataset.routeView;delete root.dataset.routeWidth;root.removeAttribute('aria-label');root.removeAttribute('role');root.removeAttribute('title');return}
  root.classList.add('wall-route');
  if(root.dataset.routeKey!==view.key){
    root.innerHTML=wallRouteMarkup(view);root.dataset.routeKey=view.key;delete root.dataset.routeWidth;
    const description=view.codes===view.names?view.codes:view.codes+' · '+view.names;
    root.setAttribute('role','img');root.setAttribute('aria-label',description);root.title=description;
  }
  // Both strings stay in a shared grid cell, keeping card/list geometry steady.
  if(root.dataset.routeView!==view.mode)root.dataset.routeView=view.mode;
  wallRouteFitNames(root);
}
function wallRouteWrap(context,text,width){
  const lines=[];let line='';
  for(const word of text.split(/\s+/)){
    const candidate=line?line+' '+word:word;
    if(context.measureText(candidate).width<=width){line=candidate;continue}
    if(line){lines.push(line);line=''}
    for(const char of word){
      if(line&&context.measureText(line+char).width>width){lines.push(line);line=''}
      line+=char;
    }
  }
  if(line)lines.push(line);return lines;
}
function wallRouteCanvasLayout(context,view,font,width){
  if(!view)return null;
  const size=Math.max(12,Math.round(font*.88));context.font=uiCanvasFont(size,300);
  const maxWidth=Math.max(1,width),codes=wallRouteWrap(context,view.codes,maxWidth),names=wallRouteWrap(context,view.names,maxWidth);
  return {size,codes,names,lineHeight:Math.ceil(size*1.22),width:Math.max(...codes.concat(names).map(text=>context.measureText(text).width)),count:Math.max(codes.length,names.length)};
}
function wallRouteCanvasPaint(context,view,layout,x,y,width,alpha,colour){
  if(!view||!layout)return;
  context.font=uiCanvasFont(layout.size,300);context.fillStyle=colour;
  const fade=!wallReduced()&&view.alternates&&view.elapsed>=8000?Math.min(1,view.phaseMs/500):1;
  const paint=(lines,opacity)=>{if(!opacity)return;context.globalAlpha=alpha*opacity;lines.forEach((text,i)=>context.fillText(text,x,y+i*layout.lineHeight,width))};
  if(fade<1)paint(view.mode==='codes'?layout.names:layout.codes,1-fade);
  paint(view.mode==='codes'?layout.codes:layout.names,fade);context.globalAlpha=alpha;
}
/* WALL_ROUTE_PRESENTATION_END */
