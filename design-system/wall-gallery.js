/* WALL_GALLERY_START */
// Presentation helpers only. No flight requests or inferred geographic features.
class GallerySolar {
  static position(time,lat,lon){
    const d=new Date(time),year=d.getUTCFullYear(),day=(Date.UTC(year,d.getUTCMonth(),d.getUTCDate())-Date.UTC(year,0,1))/86400000+1;
    if(!Number.isFinite(d.getTime())||!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180)return null;
    const days=(Date.UTC(year+1,0,1)-Date.UTC(year,0,1))/86400000,h=d.getUTCHours()+d.getUTCMinutes()/60+d.getUTCSeconds()/3600;
    const g=2*Math.PI/days*(day-1+(h-12)/24),eq=229.18*(.000075+.001868*Math.cos(g)-.032077*Math.sin(g)-.014615*Math.cos(2*g)-.040849*Math.sin(2*g));
    const decl=.006918-.399912*Math.cos(g)+.070257*Math.sin(g)-.006758*Math.cos(2*g)+.000907*Math.sin(2*g)-.002697*Math.cos(3*g)+.00148*Math.sin(3*g);
    const minutes=((h*60+eq+4*lon)%1440+1440)%1440,angle=(minutes/4-180)*Math.PI/180,latitude=lat*Math.PI/180;
    const altitude=Math.asin(Math.max(-1,Math.min(1,Math.sin(latitude)*Math.sin(decl)+Math.cos(latitude)*Math.cos(decl)*Math.cos(angle))))*180/Math.PI;
    return {altitude,evening:angle>0};
  }
  static levels(time,lat,lon){
    const sun=this.position(time,lat,lon);if(!sun)return {night:0,warm:0};
    const x=Math.max(0,Math.min(1,(6-sun.altitude)/12)),night=x*x*(3-2*x);
    const warm=sun.evening?Math.exp(-(((sun.altitude-1)/7)**2)):0;
    return {night,warm};
  }
}
class GalleryFocus {
  constructor(){this.clear()}
  clear(){this.current='';this.previous='';this.started=0}
  change(hex,now,reduced=false){
    hex=hex||'';if(hex===this.current)return false;
    this.previous=reduced?'':this.current;this.current=hex;this.started=now;return true;
  }
  weights(now,reduced=false){
    const t=reduced?1:Math.max(0,Math.min(1,(now-this.started)/900)),ease=t*t*(3-2*t);
    return [{hex:this.previous,weight:1-ease},{hex:this.current,weight:ease}].filter(a=>a.hex&&a.weight>0);
  }
}
// Minimal bounded protobuf reader for the selected OpenMapTiles layers.
class GalleryPbf {
  constructor(bytes){this.bytes=bytes;this.p=0;this.end=bytes.length;this.view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength)}
  uint(){let value=0,factor=1;for(let i=0;i<10;i++){if(this.p>=this.end)throw Error('Truncated vector tile');const b=this.bytes[this.p++];value+=(b&127)*factor;if(b<128)return value;factor*=128}throw Error('Invalid vector integer')}
  block(){const n=this.uint(),end=this.p+n;if(!Number.isSafeInteger(n)||end>this.end)throw Error('Invalid vector length');const b=this.bytes.subarray(this.p,end);this.p=end;return b}
  string(){return new TextDecoder().decode(this.block())}
  skip(wire){if(wire===0)this.uint();else if(wire===2)this.block();else if(wire===1||wire===5){this.p+=wire===1?8:4;if(this.p>this.end)throw Error('Truncated vector field')}else throw Error('Unsupported vector field')}
  static value(bytes){const p=new GalleryPbf(bytes);let value;while(p.p<p.end){const tag=p.uint(),field=Math.floor(tag/8),wire=tag&7;
    if(field===1&&wire===2)value=p.string();else if((field===2&&wire===5)||(field===3&&wire===1)){const width=field===2?4:8;if(p.p+width>p.end)throw Error('Truncated vector number');value=width===4?p.view.getFloat32(p.p,true):p.view.getFloat64(p.p,true);p.p+=width}
    else if([4,5,6,7].includes(field)&&wire===0){const n=p.uint();value=field===6?(n%2?-(n+1)/2:n/2):field===7?!!n:n}else p.skip(wire);
  }return value}
  static packed(bytes){const p=new GalleryPbf(bytes),out=[];while(p.p<p.end)out.push(p.uint());return out}
  static geometry(commands,type,budget){
    let x=0,y=0,i=0,path=null;const paths=[];
    while(i<commands.length){const command=commands[i++],id=command&7,count=Math.floor(command/8);if(!count)throw Error('Invalid vector geometry');
      if(id===1||id===2){if(i+count*2>commands.length)throw Error('Truncated vector geometry');
        for(let j=0;j<count;j++){const dx=commands[i++],dy=commands[i++];x+=dx%2?-(dx+1)/2:dx/2;y+=dy%2?-(dy+1)/2:dy/2;
          if(++budget.points>300000)throw Error('Vector geometry limit');
          if(id===1){path=[];paths.push(path)}if(!path)throw Error('Invalid vector path');path.push([x,y]);
        }
      }else if(id===7&&type===3&&path){for(let j=0;j<count;j++)if(path.length)path.push(path[0])}
      else throw Error('Unsupported vector geometry');
    }return paths;
  }
  static decode(buffer){
    const bytes=buffer instanceof Uint8Array?buffer:new Uint8Array(buffer);if(bytes.byteLength>8*1024*1024)throw Error('Vector tile too large');
    const p=new GalleryPbf(bytes),layers=[],budget={points:0,features:0},wanted=new Set(['landcover','landuse','water','waterway','transportation','place']);
    while(p.p<p.end){const tag=p.uint();if(tag!==26){p.skip(tag&7);continue}const layer=new GalleryPbf(p.block()),features=[],keys=[],values=[];let name='',extent=4096;
      while(layer.p<layer.end){const t=layer.uint(),f=Math.floor(t/8),w=t&7;if(f===1&&w===2)name=layer.string();else if(f===2&&w===2)features.push(layer.block());else if(f===3&&w===2)keys.push(layer.string());else if(f===4&&w===2)values.push(GalleryPbf.value(layer.block()));else if(f===5&&w===0)extent=layer.uint();else layer.skip(w)}
      if(!wanted.has(name))continue;if(!extent||extent>65536)throw Error('Invalid vector extent');const decoded=[];
      for(const bytes of features){if(++budget.features>40000)throw Error('Vector feature limit');const feature=new GalleryPbf(bytes);let tags=[],commands=[],type=0;
        while(feature.p<feature.end){const t=feature.uint(),f=Math.floor(t/8),w=t&7;if(f===2&&w===2)tags=GalleryPbf.packed(feature.block());else if(f===3&&w===0)type=feature.uint();else if(f===4&&w===2)commands=GalleryPbf.packed(feature.block());else feature.skip(w)}
        const properties=Object.create(null);for(let i=0;i+1<tags.length;i+=2)if(tags[i]<keys.length&&tags[i+1]<values.length)properties[keys[tags[i]]]=values[tags[i+1]];
        if(type>=1&&type<=3&&commands.length)decoded.push({type,properties,paths:GalleryPbf.geometry(commands,type,budget)});
      }layers.push({name,extent,features:decoded});
    }return layers;
  }
}
class GalleryMap {
  constructor(fetcher=(...args)=>fetch(...args)){this.fetcher=fetcher;this.tiles=new Map();this.queue=[];this.active=0;this.revision=0;this.epoch=0;this.visible=new Set();this.template='';this.metadata=null}
  resolveSource(){
    if(this.metadata)return this.metadata;const controller=new AbortController();let timer;
    const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Error('Map source timeout'))},5000)});
    const operation=(async()=>{const response=await this.fetcher('https://tiles.openfreemap.org/planet/latest',{signal:controller.signal,credentials:'omit',referrerPolicy:'no-referrer',cache:'no-cache'});if(!response.ok)throw Error('Map source unavailable');const data=await response.json(),url=data.tiles?.[0];
      if(typeof url!=='string'||!/^https:\/\/tiles\.openfreemap\.org\/planet\/[a-zA-Z0-9_-]+\/\{z\}\/\{x\}\/\{y\}\.pbf$/.test(url))throw Error('Invalid map source');return url})();
    this.metadata=Promise.race([operation,timeout]).catch(()=>'https://tiles.openfreemap.org/planet/latest/{z}/{x}/{y}.pbf').then(template=>{this.template=template}).finally(()=>{clearTimeout(timer);this.pump()});return this.metadata;
  }
  request(z,x,y){
    const n=2**z;if(y<0||y>=n)return null;x=((x%n)+n)%n;const key=z+'/'+x+'/'+y;this.visible.add(key);
    let item=this.tiles.get(key);if(item){item.used=Date.now();if(item.failed&&Date.now()-item.failedAt>120000){this.tiles.delete(key);item=null}else return item}
    if(this.tiles.size>=160){this.prune(159);if(this.tiles.size>=160)return null}
    item={key,z,x,y,used:Date.now(),layers:null,failed:false,pending:true,controller:null,canvas:null,style:''};this.tiles.set(key,item);this.queue.push(item);this.pump();this.prune();return item;
  }
  pump(){
    if(!this.template){if(this.queue.length)this.resolveSource();return}
    while(this.active<4&&this.queue.length){const item=this.queue.shift();if(!this.tiles.has(item.key))continue;this.active++;const epoch=this.epoch,controller=new AbortController();item.controller=controller;
      let timer;const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Error('Map timeout'))},8000)});
      const url=this.template.replace('{z}',item.z).replace('{x}',item.x).replace('{y}',item.y);
      const operation=(async()=>{const response=await this.fetcher(url,{signal:controller.signal,credentials:'omit',referrerPolicy:'no-referrer',cache:this.template.includes('/latest/')?'no-cache':'default'});
        if(!response.ok)throw Error('Map HTTP '+response.status);const data=await response.arrayBuffer();return GalleryPbf.decode(data)})();
      Promise.race([operation,timeout]).then(layers=>{if(epoch===this.epoch&&this.tiles.get(item.key)===item){item.layers=layers;this.revision++}}).catch(()=>{if(epoch===this.epoch&&this.tiles.get(item.key)===item){item.failed=true;item.failedAt=Date.now();this.revision++}}).finally(()=>{clearTimeout(timer);item.pending=false;item.controller=null;this.active--;this.pump()});
    }
  }
  prune(limit=160){if(this.tiles.size<=limit)return;const oldest=[...this.tiles.values()].filter(a=>!this.visible.has(a.key)).sort((a,b)=>a.used-b.used);for(const item of oldest){if(this.tiles.size<=limit)break;item.controller?.abort();this.tiles.delete(item.key)}this.queue=this.queue.filter(a=>this.tiles.has(a.key))}
  begin(){this.visible.clear()}
  end(){this.queue=this.queue.filter(a=>{if(this.visible.has(a.key))return true;this.tiles.delete(a.key);return false});this.prune()}
  clear(){this.epoch++;for(const a of this.tiles.values())a.controller?.abort();this.queue=[];this.tiles.clear();this.visible.clear();this.revision++}
  static colours(theme){return theme==='paper'?{ground:'#ece1d1',forest:'#d6d3bd',urban:'#e4d4c2',water:'#c0d2c9',river:'#9bbfb8',road:'#b7a18b',text:'#716354',halo:'#ece1d1'}:{ground:'#0b1721',forest:'#102526',urban:'#152332',water:'#173b4b',river:'#235364',road:'#344553',text:'#7c929e',halo:'#0b1721'}}
  tileCanvas(item,theme,z){
    if(!item.layers)return null;const style=theme+':'+z;if(item.canvas&&item.style===style)return item.canvas;
    const canvas=document.createElement('canvas');canvas.width=canvas.height=512;const c=canvas.getContext('2d'),colours=GalleryMap.colours(theme);
    c.fillStyle=colours.ground;c.fillRect(0,0,512,512);c.lineJoin='round';c.lineCap='round';
    for(const name of ['landcover','landuse','water','waterway','transportation'])for(const layer of item.layers.filter(l=>l.name===name)){
      const scale=512/layer.extent;for(const f of layer.features){const kind=f.properties.class;let fill='',stroke='',alpha=1,width=1;
        if(name==='landcover'){if(['wood','forest','grass','wetland','scrub'].includes(kind)){fill=colours.forest;alpha=kind==='wood'||kind==='forest'?.72:.38}else continue}
        else if(name==='landuse'){if(['residential','suburb','commercial','industrial'].includes(kind)){fill=colours.urban;alpha=.7}else if(['park','forest'].includes(kind)){fill=colours.forest;alpha=.5}else continue}
        else if(name==='water'){fill=colours.water}
        else if(name==='waterway'){if(!['river','canal','stream'].includes(kind)||kind==='stream'&&z<11)continue;stroke=colours.river;width=kind==='river'?2.4:1.3;alpha=.9}
        else if(name==='transportation'){if(!['motorway','trunk','primary','secondary'].includes(kind)&&!(z>=11&&['tertiary','minor'].includes(kind)))continue;stroke=colours.road;width=['motorway','trunk'].includes(kind)?1.4:1;alpha=['motorway','trunk'].includes(kind)?.64:.32}
        c.globalAlpha=alpha;c.beginPath();for(const path of f.paths){path.forEach((p,i)=>i?c.lineTo(p[0]*scale,p[1]*scale):c.moveTo(p[0]*scale,p[1]*scale));if(f.type===3)c.closePath()}
        if(fill&&f.type===3){c.fillStyle=fill;c.fill('nonzero')}if(stroke){c.strokeStyle=stroke;c.lineWidth=width;c.stroke()}
      }
    }c.globalAlpha=1;item.canvas=canvas;item.style=style;return canvas;
  }
}
const wallGalleryMap=new GalleryMap(),wallGalleryFocus=new GalleryFocus();
const wallGalleryAtmosphere={key:'',last:0,levels:{night:0,warm:0}};
function wallGalleryAtmosphereUpdate(now=Date.now(),force=false){
  const center=wallCenter(),key=[wallSettings.theme,wallSettings.atmosphere,center.lat,center.lon].join(':');
  if(!force&&key===wallGalleryAtmosphere.key&&now-wallGalleryAtmosphere.last<20000&&now>=wallGalleryAtmosphere.last)return;
  wallGalleryAtmosphere.key=key;wallGalleryAtmosphere.last=now;
  const levels=wallSettings.atmosphere==='solar'?GallerySolar.levels(now,center.lat,center.lon):{night:0,warm:0};wallGalleryAtmosphere.levels=levels;
  const el=$('wallDisplay');el.dataset.atmosphere=wallSettings.atmosphere||'fixed';el.style.setProperty('--gallery-night',levels.night.toFixed(4));el.style.setProperty('--gallery-warm',levels.warm.toFixed(4));
}
function wallGalleryPalette(){
  const p={...uiCanvasPalette(wallSettings.theme)},levels=wallGalleryAtmosphere.levels;
  const mix=(a,b,t)=>'#'+a.slice(1,7).match(/../g).map((c,i)=>Math.round(parseInt(c,16)*(1-t)+parseInt(b.slice(1+2*i,3+2*i),16)*t).toString(16).padStart(2,'0')).join('');
  const paper=wallSettings.theme==='paper',base=GalleryMap.colours(wallSettings.theme).ground;
  p.map=mix(mix(base,paper?'#d5b18c':'#261d22',levels.warm*(paper?.12:.16)),paper?'#c7b8a4':'#060d15',levels.night*(paper?.24:.35));
  p.bg=mix(mix(p.bg,paper?'#d5b18c':'#261d22',levels.warm*(paper?.08:.10)),paper?'#c7b8a4':'#02060b',levels.night*(paper?.14:.2));return p;
}
function wallGalleryDrawMap(c){
  if(wallSettings.cartography==='street')return null;
  const z=Math.min(14,Math.max(0,Math.floor(wall.zoom))),scale=2**(wall.zoom-z),size=256*scale,center=project(wall.camera,wall.zoom),left=center.x-wall.w/2,top=center.y-wall.h/2;
  const visible=[],labels=[];let loaded=0,pending=0,failed=0;wallGalleryMap.begin();
  for(let x=Math.floor(left/size);x<=Math.floor((left+wall.w)/size);x++)for(let y=Math.floor(top/size);y<=Math.floor((top+wall.h)/size);y++){
    const item=wallGalleryMap.request(z,x,y);if(!item)continue;const dx=x*size-left,dy=y*size-top;visible.push({item,dx,dy});
    if(item.layers){const canvas=wallGalleryMap.tileCanvas(item,wallSettings.theme,z);c.drawImage(canvas,dx,dy,size+.5,size+.5);loaded++;
      for(const layer of item.layers.filter(l=>l.name==='place'))for(const feature of layer.features){const p=feature.properties,name=String(p['name:latin']||p.name||p.name_en||'');
        if(!['city','town'].includes(p.class)||!name||name.length>60)continue;
        const point=feature.paths[0]?.[0];if(!point)continue;const px=dx+point[0]*size/layer.extent,py=dy+point[1]*size/layer.extent;
        if(px>25&&px<wall.w-25&&py>25&&py<wall.h-36)labels.push({name,x:px,y:py,rank:Number.isFinite(Number(p.rank))?Number(p.rank):20});
      }
    }else if(item.failed){failed++;const raster=wallTile(z,x,y);if(raster?.loaded)c.drawImage(wallStyledTile(raster),dx,dy,size+.5,size+.5)}else pending++;
  }wallGalleryMap.end();
  const colours=GalleryMap.colours(wallSettings.theme),occupied=[],names=new Set(),aircraft=wall.list.map(wallScreen),font=Math.round(Math.max(11,Math.min(20,wall.w/105)));
  c.font=uiCanvasFont(font,400);c.textAlign='center';c.textBaseline='middle';c.lineJoin='round';
  for(const label of labels.sort((a,b)=>a.rank-b.rank||(a.x-wall.w/2)**2+(a.y-wall.h/2)**2-((b.x-wall.w/2)**2+(b.y-wall.h/2)**2))){
    if(names.has(label.name)||occupied.length>=8)continue;const width=c.measureText(label.name).width,box={x:label.x-width/2-16,y:label.y-20,w:width+32,h:40};
    if(box.x<8||box.x+box.w>wall.w-8||occupied.some(b=>box.x<b.x+b.w&&box.x+box.w>b.x&&box.y<b.y+b.h&&box.y+box.h>b.y)||aircraft.some(p=>Math.abs(p.x-label.x)<width/2+26&&Math.abs(p.y-label.y)<30))continue;
    names.add(label.name);occupied.push(box);c.strokeStyle=colours.halo;c.lineWidth=4;c.strokeText(label.name,label.x,label.y);c.fillStyle=colours.text;c.fillText(label.name,label.x,label.y);
  }c.textAlign='start';c.textBaseline='alphabetic';
  const {night,warm}=wallGalleryAtmosphere.levels;if(night){c.fillStyle=wallSettings.theme==='paper'?'#735137':'#020812';c.globalAlpha=night*(wallSettings.theme==='paper'?.07:.18);c.fillRect(0,0,wall.w,wall.h)}
  if(warm){c.fillStyle='#dd8549';c.globalAlpha=warm*.025;c.fillRect(0,0,wall.w,wall.h)}c.globalAlpha=1;
  return {loaded,pending,failed};
}
function wallGalleryHalo(c,x,y,size,weight,colour){
  if(weight<=0)return;const radius=42*size;c.save();c.translate(x,y);c.globalAlpha=weight*.24;
  const gradient=c.createRadialGradient(0,0,3*size,0,0,radius);if(gradient?.addColorStop){gradient.addColorStop(0,colour);gradient.addColorStop(1,colour+'00');c.fillStyle=gradient;c.beginPath();c.arc(0,0,radius,0,Math.PI*2);c.fill()}c.restore();
}
function wallGalleryFitCardText(){
  const card=$('wallCard');if(!card?.isConnected)return;
  const rows=getComputedStyle(card).gridTemplateRows.split(/\s+/).map(parseFloat);if(!rows.length||rows.some(n=>!Number.isFinite(n)))return;
  const available=node=>{const row=Number(getComputedStyle(node).gridRowStart);return rows[row-1]||0};
  const fit=(node,height,minimum)=>{if(!node||height<1)return;node.style.fontSize='';let size=parseFloat(getComputedStyle(node).fontSize);while(node.scrollHeight>height+1&&size>minimum){size=Math.max(minimum,size-1);node.style.fontSize=size+'px'}};
  const carrier=$('wallCarrier'),identity=$('wallType')?.parentElement,registration=$('wallRegistration');
  fit(carrier?.querySelector('strong'),available(carrier),16);
  if(identity&&registration){const height=registration.offsetHeight+parseFloat(getComputedStyle(registration).marginTop||0);fit($('wallType'),available(identity)-height,wall.w<600?14:18)}
  const heading=$('wallCallsign')?.parentElement,route=$('wallRoute');if(heading&&route)fit($('wallCallsign'),available(heading)-(route.offsetHeight+parseFloat(getComputedStyle(route).marginTop||0)),24);
}
function wallGalleryClear(){wallGalleryMap.clear();wallGalleryFocus.clear();wallGalleryAtmosphere.key=''}
/* WALL_GALLERY_END */
