/* WALL_MINIMALIST_START: label content, cycling and viewport placement. */
function wallMinimalist(){return wallSettings.layout==='minimalist'}
function wallAircraftHeading(a){return num(a.displayTrack)?a.displayTrack:num(a.track)?a.track:null}
function wallAircraftLabel(a,metric=false){
  const callsign=typeof a.flight==='string'&&a.flight.trim()?a.flight.trim().slice(0,16):'No callsign';
  const height=num(a.alt_baro)?a.alt_baro:num(a.alt_geom)?a.alt_geom:null;
  let altitude=a.alt_baro==='ground'?'Ground':height!==null?Math.round(height*(metric ? .3048 : 1)/(metric?10:100))*(metric?10:100):null;
  altitude=typeof altitude==='number'?altitude.toLocaleString('en-GB')+(metric?' m':' ft'):altitude||'Altitude unknown';
  return {callsign,altitude:altitude+(a.held?' · held':''),arrow:num(wallAircraftHeading(a))&&!a.held&&a.alt_baro!=='ground'&&(!num(a.gs)||a.gs>1)};
}
function wallAircraftInfo(a,metric=false,route=null){
  const entries=[],held=a.held?' · held':'',add=(id,text,accent=false)=>entries.push({id,text:text+held,accent});
  if(a.alt_baro==='ground'||num(a.alt_baro)||num(a.alt_geom))add('altitude',wallAircraftLabel({...a,held:false},metric).altitude);
  if(num(a.gs)&&a.gs>=0)add('speed',Math.round(a.gs*(metric?1.852:1)).toLocaleString('en-GB')+(metric?' km/h':' kt'));
  const type=typeFor(a);
  if(type.code||(typeof a.desc==='string'&&a.desc.trim()))add('type',type.name.replace(/ · aircraft type$/,''));
  const labels=WallRoutePresentation.labels(route);
  if(labels){add('route-codes',labels.codes,true);if(labels.names!==labels.codes)add('route-names',labels.names,true)}
  if(!entries.length)entries.push({id:'unavailable',text:a.held?'Position held':'Details unavailable',accent:false});
  return entries;
}
class WallInfoPresentation{
  constructor(){this.states=new Map();this.interval=8000;this.limit=1500}
  view(a,entries,now=Date.now()){
    // Values can change with playback without restarting the reading cycle.
    const identity=entries.map(e=>[e.id,e.id.startsWith('route-')?e.text:'']);
    const key=JSON.stringify([String(a.flight||'').trim().toUpperCase(),identity]);
    let state=this.states.get(a.hex);
    if(!state||state.key!==key||now<state.start){
      state={key,start:now,seen:now};this.states.delete(a.hex);
      if(this.states.size>=this.limit)this.states.delete(this.states.keys().next().value);
      this.states.set(a.hex,state);
    }
    state.seen=now;
    const elapsed=Math.max(0,now-state.start),index=Math.floor(elapsed/this.interval)%entries.length;
    return {entries,index,previous:(index+entries.length-1)%entries.length,phaseMs:elapsed%this.interval,elapsed};
  }
  prune(now){for(const [hex,state]of this.states)if(now-state.seen>480000)this.states.delete(hex)}
  clear(){this.states.clear()}
}
const wallInfoPresentation=new WallInfoPresentation();
function wallInfoLayout(c,callsign,entries,font,maxWidth){
  c.font=uiCanvasFont(font,500);const callWidth=c.measureText(callsign).width;
  const pages=entries.map(entry=>{
    const size=entry.accent?Math.max(10,Math.round(font*.88)):font;
    c.font=uiCanvasFont(size,entry.accent?300:400);
    const lines=wallRouteWrap(c,entry.text,maxWidth),lineHeight=Math.ceil(size*1.22);
    return {...entry,size,lineHeight,lines,width:Math.max(...lines.map(t=>c.measureText(t).width))};
  });
  return {pages,width:Math.min(maxWidth,Math.max(callWidth,...pages.map(p=>p.width)))+12,height:font+13+Math.max(...pages.map(p=>p.lines.length*p.lineHeight))};
}
function wallInfoPaint(c,view,layout,x,y,width,alpha,muted,accent){
  const fade=!wallReduced()&&view.entries.length>1&&view.elapsed>=8000?Math.min(1,view.phaseMs/500):1;
  const paint=(page,opacity)=>{
    if(!opacity)return;c.globalAlpha=alpha*opacity;c.fillStyle=page.accent?accent:muted;c.font=uiCanvasFont(page.size,page.accent?300:400);
    page.lines.forEach((text,i)=>c.fillText(text,x,y+page.size+i*page.lineHeight,width));
  };
  if(fade<1)paint(layout.pages[view.previous],1-fade);
  paint(layout.pages[view.index],fade);c.globalAlpha=alpha;
}
function wallAltitudeOrder(a,b){
  const altitude=p=>p.alt_baro==='ground'?0:num(p.alt_baro)?p.alt_baro:num(p.alt_geom)?p.alt_geom:-Infinity;
  const x=altitude(a),y=altitude(b);
  return (x===y?0:x<y?-1:1)||String(a.hex).localeCompare(String(b.hex));
}
function wallDirectionSegments(point,heading,scale){
  if(!num(heading))return [];
  const angle=heading*Math.PI/180,cos=Math.cos(angle),sin=Math.sin(angle);
  const at=(x,y)=>({x:point.x+(x*cos-y*sin)*scale,y:point.y+(x*sin+y*cos)*scale});
  return [[at(0,-24),at(0,-46)],[at(-4,-40),at(0,-46)],[at(0,-46),at(4,-40)]];
}
function wallClipVectors(segments,boxes,padding=4){
  // Subtract the union of expanded card rectangles from each line. Overlapping
  // cards stay fully protected, unlike an even/odd canvas mask.
  const result=[];
  for(const [a,b]of segments){
    const dx=b.x-a.x,dy=b.y-a.y,cuts=[];
    for(const box of boxes){
      const left=box.x-padding,right=box.x+box.w+padding,top=box.y-padding,bottom=box.y+box.h+padding;
      if(Math.max(a.x,b.x)<left||Math.min(a.x,b.x)>right||Math.max(a.y,b.y)<top||Math.min(a.y,b.y)>bottom)continue;
      let enter=0,leave=1,hit=true;
      for(const [start,delta,low,high]of [[a.x,dx,left,right],[a.y,dy,top,bottom]]){
        if(Math.abs(delta)<1e-9){if(start<low||start>high){hit=false;break}continue}
        const p=(low-start)/delta,q=(high-start)/delta;
        enter=Math.max(enter,Math.min(p,q));leave=Math.min(leave,Math.max(p,q));
        if(enter>leave){hit=false;break}
      }
      if(hit)cuts.push([enter,leave]);
    }
    const at=t=>({x:a.x+dx*t,y:a.y+dy*t});let cursor=0;
    for(const [enter,leave]of cuts.sort((a,b)=>a[0]-b[0])){
      if(enter>cursor+1e-6)result.push([at(cursor),at(enter)]);
      cursor=Math.max(cursor,leave);
    }
    if(cursor<1-1e-6)result.push([at(cursor),at(1)]);
  }
  return result;
}
function wallLabelBox(point,w,h,viewWidth,viewHeight,occupied,icons,gap=18,preferred=-1,vectors=[]){
  const choices=[[point.x+gap,point.y-h/2],[point.x-w-gap,point.y-h/2],[point.x-w/2,point.y+gap],[point.x-w/2,point.y-h-gap],
    [point.x+gap,point.y+gap/2],[point.x-w-gap,point.y+gap/2],[point.x+gap,point.y-h-gap/2],[point.x-w-gap,point.y-h-gap/2]];
  // Only adjacent placements. Altitude determines the order of each complete
  // group. Prefer a card clear of its own arrow without detaching the card.
  const intersection=(a,b)=>Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y));
  const length=rows=>rows.reduce((sum,[a,b])=>sum+Math.hypot(a.x-b.x,a.y-b.y),0),vectorLength=length(vectors);
  let result=null,cost=Infinity;
  choices.forEach(([x,y],i)=>{
    const box={x:Math.max(6,Math.min(viewWidth-w-6,x)),y:Math.max(6,Math.min(viewHeight-h-6,y)),w,h,slot:i};
    const overlaps=occupied.reduce((sum,b)=>sum+intersection(box,b),0)/(w*h);
    const arrowHit=vectorLength-length(wallClipVectors(vectors,[box]))>.1;
    const score=Math.hypot(box.x-x,box.y-y)/Math.max(w,h)+Math.min(1,overlaps)*.08+i*.002-(i===preferred?.18:0)+(arrowHit?4:0);
    if(score<cost){result=box;cost=score}
  });
  return result;
}
function wallPaintAircraftOnly(){
  const c=wallCtx,palette=wallGalleryPalette(),bg=palette.bg,ink=palette.ink,muted=palette.muted,plane=palette.plane,line=palette.line,now=Date.now();
  c.clearRect(0,0,wall.w,wall.h);c.fillStyle=bg;c.fillRect(0,0,wall.w,wall.h);
  const scale=(wallSettings.distance==='far'?1.3:wallSettings.distance==='near'?.9:1.05)*Math.max(.9,Math.min(1.6,wall.w/1450));
  const font=Math.round(Math.max(11,Math.min(15,wall.w/130))*(wallSettings.distance==='far'?1.08:1));
  const points=wall.list.map(a=>({a,...wallScreen(a)})).filter(p=>p.x>=0&&p.x<=wall.w&&p.y>=0&&p.y<=wall.h).sort((a,b)=>wallAltitudeOrder(a.a,b.a));
  const occupied=[],cards=[],slots=wall.labelSlots||new Map(),nextSlots=new Map();
  // Lay out every card before drawing any vectors so all cards are protected.
  for(const p of points){
    const a=p.a,label=wallAircraftLabel(a,wallSettings.units==='metric'),route=wallSettings.showRoutes?routeFor(a):null;
    const view=wallInfoPresentation.view(a,wallAircraftInfo(a,wallSettings.units==='metric',route),now);
    const layout=wallInfoLayout(c,label.callsign,view.entries,font,Math.min(wall.w-24,168,font*11.8));
    const vectors=label.arrow?wallDirectionSegments(p,wallAircraftHeading(a),scale):[];
    const box=wallLabelBox(p,layout.width,layout.height,wall.w,wall.h,occupied,[],Math.min(26,18*scale),slots.get(a.hex),vectors);
    occupied.push(box);nextSlots.set(a.hex,box.slot);cards.push({p,a,label,view,layout,box,vectors,route});
  }
  for(const {p,a,label,view,layout,box,vectors}of cards){
    const w=box.w,h=box.h,alpha=(a.opacity??1)*(a.held?.65:1);c.globalAlpha=alpha;
    const edgeX=Math.max(box.x,Math.min(box.x+w,p.x)),edgeY=Math.max(box.y,Math.min(box.y+h,p.y));
    const dx=edgeX-p.x,dy=edgeY-p.y,length=Math.hypot(dx,dy),start=Math.min(length,20*scale);
    c.strokeStyle=line;c.lineWidth=1;c.beginPath();c.moveTo(p.x+(length?dx/length*start:0),p.y+(length?dy/length*start:0));c.lineTo(edgeX,edgeY);c.stroke();
    c.fillStyle=palette.label;c.strokeStyle=line;c.beginPath();c.roundRect(box.x,box.y,w,h,6);c.fill();c.stroke();
    c.font=uiCanvasFont(font,500);c.fillStyle=ink;c.fillText(label.callsign,box.x+6,box.y+font+5,w-12);
    wallInfoPaint(c,view,layout,box.x+6,box.y+font+9,w-12,alpha,muted,uiRouteAccent(wallSettings.theme));
    // Keep each altitude group together; icons remain above their own labels.
    const heading=wallAircraftHeading(a);
    c.save();c.translate(p.x,p.y);c.rotate(rad(heading??0));c.scale(scale,scale);c.globalAlpha=(a.opacity??1)*(a.held?.6:1);c.lineWidth=1;c.fillStyle=wallAircraftColour(a,plane);c.strokeStyle=bg;paintAircraftSymbol(c,a,1,heading);c.restore();
    const clipped=wallClipVectors(vectors,occupied);
    if(clipped.length){
      c.globalAlpha=a.opacity??1;c.strokeStyle=plane;c.lineWidth=1.35*scale;c.lineCap='round';c.lineJoin='round';c.beginPath();
      for(const [from,to]of clipped){c.moveTo(from.x,from.y);c.lineTo(to.x,to.y)}c.stroke();
    }
  }
  c.globalAlpha=1;wallInfoPresentation.prune(now);
  wall.labelSlots=nextSlots;wall.minimalPaint={aircraft:points.length,labels:cards.length,arrows:cards.filter(p=>p.vectors.length).length,routes:cards.filter(p=>p.route).length};
}
function wallMinimalStatus(now){
  const notice=$('wallMinimalNotice');notice.hidden=!wallMinimalist()||wall.list.length>0;
  if(!notice.hidden){const [title,note]=wallEmptyState(now);notice.textContent=title+' '+note}
  $('wallControlMeta').innerHTML=$('wallSource').innerHTML+(wallSettings.showRoutes?' · Routes: <a href="https://www.adsb.lol/docs/open-data/api/" target="_blank" rel="noopener">ADSB.lol (ODbL)</a>':'');
}
/* WALL_MINIMALIST_END */
