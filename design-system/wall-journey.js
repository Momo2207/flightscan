/* WALL_JOURNEY_START */
// Route geography and whole-flight estimates. No schedules or taxi-speed ETAs.
class WallJourney{
  static CRUISE_KT={wide:490,narrow:450,regional:440,business:450,jet:450};
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
  static estimate(aircraft,route,kind){
    const distanceKm=this.separation(route?.from,route?.to);
    if(distanceKm===null)return null;
    if(distanceKm<1)return null;
    const speedKt=String(aircraft?.t||'').trim().toUpperCase()==='B738'?460:Object.hasOwn(this.CRUISE_KT,kind)?this.CRUISE_KT[kind]:null;
    // A decorative journey estimate with a fixed climb/descent allowance.
    // Round to five minutes, deliberately avoiding false minute-level precision.
    const durationMinutes=speedKt?Math.max(5,Math.round((distanceKm/(speedKt*1.852)*60+20)/5)*5):null;
    return {distanceKm,speedKt,durationMinutes};
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
  const info=WallJourney.estimate(aircraft,route,aircraftSymbolFor(aircraft).key),metric=wallSettings.units==='metric',follow=wallMode()==='follow';
  const distance=follow?WallJourney.remaining(aircraft,route):info;
  root.hidden=(!distance&&!info?.durationMinutes)||wallSettings.journeyDisplay==='off';
  $('wallJourneyDistance').hidden=!distance;
  $('wallRouteDistanceLabel').textContent=follow?'Distance to destination':'Route distance';
  $('wallRouteDistance').textContent=WallJourney.distance(distance,metric);
  $('wallRouteDistanceUnit').textContent=distance?(metric?'km':'NM'):'';
  $('wallEstimatedTime').textContent=WallJourney.duration(info);
  $('wallJourneyTime').hidden=!info?.durationMinutes;
  root.dataset.single=String(!distance||!info?.durationMinutes);
}
/* WALL_JOURNEY_END */
