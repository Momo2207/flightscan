/* WALL_JOURNEY_START */
// Route geography and whole-flight estimates. No schedules or taxi-speed ETAs.
class WallJourney{
  static CRUISE_KT={wide:480,narrow:450,regional:430,business:460,jet:450};
  static point(p){return p&&typeof p.lat==='number'&&Number.isFinite(p.lat)&&Math.abs(p.lat)<=90&&typeof p.lon==='number'&&Number.isFinite(p.lon)&&Math.abs(p.lon)<=180}
  static separation(a,b){
    if(!this.point(a)||!this.point(b))return null;
    const rad=v=>v*Math.PI/180;
    const hav=Math.sin(rad(b.lat-a.lat)/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(rad(b.lon-a.lon)/2)**2;
    return 12742.0176*Math.asin(Math.sqrt(Math.min(1,Math.max(0,hav))));
  }
  static remaining(aircraft,route){
    // The caller supplies the displayed sample, including delayed or held positions.
    const distanceKm=this.separation(aircraft,route?.to);
    return distanceKm===null?null:{distanceKm};
  }
  static fromDeparture(aircraft,route){
    const distanceKm=this.separation(route?.from,aircraft);
    return distanceKm===null?null:{distanceKm};
  }
  static performance(distanceKm,kind,aircraft){
    if(!Object.hasOwn(this.CRUISE_KT,kind))return null;
    // Effective airborne speed is deliberately lower on short sectors where climb/descent
    // consume a larger share of the flight. Long-haul widebodies use a higher cruise model.
    let speedKt,overhead;
    if(distanceKm<300){speedKt=kind==='regional'?270:300;overhead=15}
    else if(distanceKm<800){speedKt=kind==='regional'?325:350;overhead=20}
    else if(distanceKm<2000){speedKt=kind==='regional'?390:kind==='wide'?430:420;overhead=25}
    else{speedKt=this.CRUISE_KT[kind];overhead=30}
    if(String(aircraft?.t||'').trim().toUpperCase()==='B738'&&distanceKm>=2000)speedKt=460;
    return {speedKt,overhead};
  }
  static estimate(aircraft,route,kind){
    const distanceKm=this.separation(route?.from,route?.to);
    if(distanceKm===null||distanceKm<1)return null;
    const performance=this.performance(distanceKm,kind,aircraft),speedKt=performance?.speedKt??null;
    // Total airborne-time model. It never uses current groundspeed, so climb, approach,
    // taxi and held telemetry cannot collapse a long flight into an implausibly short ETA.
    const durationMinutes=speedKt?Math.max(10,Math.round((distanceKm/(speedKt*1.852)*60+performance.overhead)/5)*5):null;
    return {distanceKm,speedKt,durationMinutes,overheadMinutes:performance?.overhead??null};
  }
  static progress(aircraft,route){
    const total=this.separation(route?.from,route?.to),from=this.separation(route?.from,aircraft),to=this.separation(aircraft,route?.to);
    if(!Number.isFinite(total)||total<1||!Number.isFinite(from)||!Number.isFinite(to))return null;
    // Elliptic route-progress proxy: stable when the aircraft is off the great-circle path
    // and bounded at the airports. Better behaved than origin-distance / route-distance.
    const ratio=Math.max(0,Math.min(1,(from+total-to)/(2*total)));
    return {ratio,totalKm:total,fromKm:from,toKm:to};
  }
  static airborneMinutes(aircraft,route,kind,observed){
    if(Number.isFinite(observed?.takeoff)&&Number.isFinite(observed?.elapsedMinutes))return Math.max(0,observed.elapsedMinutes);
    const estimate=this.estimate(aircraft,route,kind),progress=this.progress(aircraft,route);
    if(!estimate?.durationMinutes||!progress)return null;
    const reconstructed=Math.round(estimate.durationMinutes*progress.ratio/5)*5;
    // Observation time is a hard lower bound even when takeoff itself was not seen.
    return Math.max(reconstructed,Number.isFinite(observed?.elapsedMinutes)?observed.elapsedMinutes:0);
  }
  static distance(info,metric){
    if(!Number.isFinite(info?.distanceKm))return '';
    const value=info.distanceKm/(metric?1:1.852),rounded=value>=100?Math.round(value/10)*10:Math.round(value);
    return Math.max(0,rounded).toLocaleString('en-GB');
  }
  static duration(info){
    if(!info?.durationMinutes)return '';
    const hours=Math.floor(info.durationMinutes/60),minutes=info.durationMinutes%60;
    return hours?hours+' h'+(minutes?' '+minutes+' m':''):minutes+' min';
  }
}
function wallJourneyUpdate(aircraft,route){
  const root=$('wallJourney');if(!root)return;
  const info=WallJourney.estimate(aircraft,route,aircraftSymbolFor(aircraft).key),metric=wallSettings.units==='metric',mode=wallMode(),follow=mode==='follow',area=mode==='area';
  const remaining=(follow||area)?WallJourney.remaining(aircraft,route):null,distance=(follow||area)?remaining:info;
  const remainingDuration=info;
  root.hidden=(!distance&&!remainingDuration?.durationMinutes)||wallSettings.journeyDisplay==='off';
  $('wallJourneyDistance').hidden=!distance;
  $('wallRouteDistanceLabel').textContent=(follow||area)?'Distance to destination':'Route distance';
  $('wallRouteDistance').textContent=WallJourney.distance(distance,metric);
  $('wallRouteDistanceUnit').textContent=distance?(metric?'km':'NM'):'';
  $('wallEstimatedTime').textContent=WallJourney.duration(remainingDuration);
  $('wallJourneyTime').hidden=!remainingDuration?.durationMinutes;
  root.dataset.single=String(!distance||!info?.durationMinutes);
}
/* WALL_JOURNEY_END */
