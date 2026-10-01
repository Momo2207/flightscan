/* FLIGHT_PROGRESS_START */
// Position evidence only: route estimates never enter this store.
class FlightProgressStore {
  constructor(options={}){this.records=new Map();this.latest=new Map();this.dirty=new Set();this.deleted=new Set();this.retention=options.retention??172800000;this.maxPoints=options.maxPoints??10000;this.budget=options.budget??33554432;this.maxGap=120000;this.sessionGap=1800000}
  static point(a){return a&&/^[a-f0-9]{6}$/i.test(a.hex||'')&&['lat','lon','positionTime'].every(k=>typeof a[k]==='number'&&Number.isFinite(a[k]))&&Math.abs(a.lat)<=90&&Math.abs(a.lon)<=180}
  static km(a,b){const r=Math.PI/180,h=Math.sin((b.lat-a.lat)*r/2)**2+Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin((b.lon-a.lon)*r/2)**2;return 12742.0176*Math.asin(Math.sqrt(Math.min(1,Math.max(0,h))))}
  start(a){const hex=a.hex.toLowerCase(),id=hex+':'+a.positionTime;const f={id,hex,registration:String(a.r||'').trim().toUpperCase().slice(0,20),callsign:String(a.flight||'').slice(0,16),first:a.positionTime,last:a.positionTime,takeoff:null,takeoffWindow:null,landing:null,completed:false,points:[],airRun:0,groundRun:0,candidate:null,groundBefore:null};this.records.set(id,f);this.latest.set(hex,id);this.dirty.add(id);return f}
  ingest(rows,now=Date.now()){
    this.prune(now);
    let changed=false;
    for(const a of rows){
      if(!FlightProgressStore.point(a)||a.positionTime>now+2000||a.positionTime<now-this.retention)continue;
      const hex=a.hex.toLowerCase(),registration=String(a.r||'').trim().toUpperCase().slice(0,20);let f=this.records.get(this.latest.get(hex));
      if(f&&a.positionTime<=f.last)continue; // Duplicate or late provider response.
      const ground=a.alt_baro==='ground',air=typeof a.alt_baro==='number'&&Number.isFinite(a.alt_baro);
      if(!f||a.positionTime-f.last>this.sessionGap||registration&&f.registration&&registration!==f.registration)f=this.start(a);
      else if(f.completed&&air){
        const groundPoint=f.lastGround;
        f=this.start(groundPoint&&a.positionTime-groundPoint.time<=this.maxGap?{...a,positionTime:groundPoint.time}:a);
        if(groundPoint&&a.positionTime-groundPoint.time<=this.maxGap){f.points.push({...groundPoint,air:false,ground:true,km:0,segments:0,valid:false,broken:false});f.groundBefore=groundPoint.time;f.groundRun=1}
      }
      if(f.completed){f.last=a.positionTime;if(ground)f.lastGround={time:a.positionTime,lat:a.lat,lon:a.lon};this.dirty.add(f.id);changed=true;continue} // Taxi cannot increase flight totals.
      const previous=f.points.at(-1),dt=previous?a.positionTime-previous.time:0,km=previous?FlightProgressStore.km(previous,a):0;
      if(previous&&dt<=this.maxGap&&km>650*dt/1000000+1)continue; // Implausible position jump; do not move the anchor.
      const continuous=!!previous&&dt<=this.maxGap,valid=continuous&&air&&previous.air,segment=valid?km:0;
      const p={time:a.positionTime,lat:a.lat,lon:a.lon,air,ground,km:(previous?.km||0)+segment,segments:(previous?.segments||0)+(valid?1:0),valid,broken:!!previous&&(previous.broken||!continuous||!air&&!ground||air&&previous.ground&&f.firstAir!==undefined)};
      if(air&&previous?.ground&&continuous&&f.firstAir===undefined)p.broken=false; // Pre-departure taxi gaps do not reduce airborne coverage.
      if(ground){
        if(!f.groundRun)f.groundCandidate=p.time;
        f.groundRun++;f.airRun=0;f.groundBefore=p.time;f.lastGround={time:p.time,lat:p.lat,lon:p.lon};
        if(f.groundRun>=2&&continuous&&f.firstAir!==undefined){f.landing=f.groundCandidate;f.completed=true}
      }else if(air){
        if(!continuous)f.airRun=0;
        if(!f.airRun){f.candidate=p.time;f.candidateGround=f.groundBefore;f.candidateContinuous=continuous&&previous?.ground===true&&!f.points.some(q=>q.air)}
        f.airRun++;f.groundRun=0;
        if(f.airRun>=2&&!f.takeoff&&f.candidateContinuous&&f.candidateGround!==null){f.takeoff=f.candidate;f.takeoffWindow=[f.candidateGround,f.candidate]}
      }else{f.airRun=0;f.groundRun=0}
      if(air&&f.firstAir===undefined)f.firstAir=p.time;
      f.registration=f.registration||registration;f.callsign=String(a.flight||f.callsign).slice(0,16);f.last=p.time;f.points.push(p);
      if(f.points.length>this.maxPoints)f.points.splice(0,f.points.length-this.maxPoints);
      this.dirty.add(f.id);changed=true;
    }
    this.prune(now);return changed;
  }
  prune(now=Date.now()){
    const remove=f=>{this.records.delete(f.id);this.dirty.delete(f.id);this.deleted.add(f.id);if(this.latest.get(f.hex)===f.id)this.latest.delete(f.hex)};
    for(const f of this.records.values()){if((f.completed?f.landing:f.last)<now-this.retention)remove(f);else if(f.points.length>1){const first=f.points.findIndex(p=>p.time>=now-this.retention);if(first>1){f.points.splice(0,first-1);this.dirty.add(f.id)}}}
    let size=[...this.records.values()].reduce((n,f)=>n+1024+f.points.length*512,0);
    const oldest=[...this.records.values()].sort((a,b)=>Number(b.completed)-Number(a.completed)||a.last-b.last);
    for(const f of oldest){if(size<=this.budget)break;size-=1024+f.points.length*512;remove(f)}
  }
  restore(values,now=Date.now()){
    for(const value of values){
      if(!value||!/^([a-f0-9]{6}):\d+(\.\d+)?$/.test(value.id||'')||!Array.isArray(value.points)||!Number.isFinite(value.last)||value.last<now-this.retention)continue;
      const old=this.records.get(value.id);if(old&&old.last>=value.last)continue;
      const f={...value,points:value.points.filter(p=>Number.isFinite(p.time)&&Number.isFinite(p.km)&&Number.isFinite(p.lat)&&Number.isFinite(p.lon)).slice(-this.maxPoints)};
      this.records.set(f.id,f);const current=this.records.get(this.latest.get(f.hex));if(!current||current.last<f.last)this.latest.set(f.hex,f.id);
    }
    this.prune(now);
  }
  progressAt(flightId,sceneTime){
    const f=this.records.get(flightId);if(!f||!Number.isFinite(sceneTime)||!f.points.length||sceneTime<f.points[0].time)return null;
    // Never advance a missing/held signal from the computer clock.
    const groundHold=f.groundRun>0&&f.firstAir!==undefined?f.groundCandidate:Infinity;
    const time=Math.min(sceneTime,f.points.at(-1).time,f.landing??groundHold),points=f.points;let lo=0,hi=points.length-1;
    while(lo<hi){const mid=Math.ceil((lo+hi)/2);if(points[mid].time<=time)lo=mid;else hi=mid-1}
    const p=points[lo],next=points[lo+1],fraction=next&&time>p.time&&next.valid?Math.min(1,(time-p.time)/(next.time-p.time)):0;
    const segments=p.segments+(fraction>0?1:0),distanceKm=segments?p.km+(next?fraction*(next.km-p.km):0):null;
    const knownTakeoff=Number.isFinite(f.takeoff)&&f.takeoff<=time;
    const start=knownTakeoff?f.takeoff:f.first;
    const elapsedMinutes=Math.floor(Math.max(0,time-start)/60000);
    const completeDistance=knownTakeoff&&!p.broken;
    return {flightId:f.id,sceneTime:time,distanceKm,elapsedMinutes,distanceLabel:completeDistance?'Distance covered':'Observed distance',timeLabel:knownTakeoff?'Time airborne':'Time observed',takeoff:f.takeoff,takeoffWindow:f.takeoffWindow,landing:f.landing,source:'position observations',coverage:completeDistance?'from takeoff':'partial',completed:f.completed&&time>=f.landing};
  }
  forAircraft(a,sceneTime){
    if(!a?.hex)return null;const hex=a.hex.toLowerCase(),registration=String(a.r||'').trim().toUpperCase();
    const latest=this.records.get(this.latest.get(hex));if(latest&&latest.first<=sceneTime&&(!registration||!latest.registration||registration===latest.registration))return this.progressAt(latest.id,sceneTime);
    const candidates=[...this.records.values()].filter(f=>f.hex===hex&&f.first<=sceneTime&&(!registration||!f.registration||registration===f.registration)).sort((a,b)=>b.first-a.first);
    return candidates.length?this.progressAt(candidates[0].id,sceneTime):null;
  }
}
const flightProgress=new FlightProgressStore(),flightProgressPending=[];
function flightProgressObserve(rows,now=Date.now()){
  if(!sightingsLoaded){if(flightProgressPending.length<32)flightProgressPending.push({rows,now});return}
  if(!sightingsOwner){sightingChannel?.postMessage({type:'flight-observations',rows,now});if(flightProgressPending.length<32)flightProgressPending.push({rows,now});return}
  if(flightProgress.ingest(rows,now)||flightProgress.dirty.size||flightProgress.deleted.size)sightingsScheduleSave();
}
function flightProgressDrain(){for(const batch of flightProgressPending.splice(0))flightProgressObserve(batch.rows,batch.now)}
let flightProgressSeeded=false;
function flightProgressSeedSightings(now=Date.now()){
  if(flightProgressSeeded)return;flightProgressSeeded=true;
  const rows=[];
  for(const area of sightings.areas.values())for(const visit of area.visits.values()){
    if(flightProgress.latest.has(visit.hex))continue;
    for(const segment of visit.segments)for(const p of segment.points)rows.push({hex:visit.hex,r:segment.r,flight:segment.flight,lat:p[1],lon:p[2],positionTime:p[0]});
  }
  // Older journal coordinates have no ground/altitude evidence: they can only
  // anchor partial observation time, never a takeoff or airborne distance.
  flightProgress.ingest(rows.sort((a,b)=>a.positionTime-b.positionTime),now);
}
function aircraftSceneTime(a,wallView=false){return wallView?(a?.held?a.observationTime:a?.displayTime??a?.positionTime):a?.positionTime}
/* FLIGHT_PROGRESS_END */
