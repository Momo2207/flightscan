/* AIRCRAFT_INFO_START */
class AircraftInfo {
  static fields={identity:{priority:1},route:{priority:1},progress:{priority:1},airline:{priority:2},model:{priority:2},registration:{priority:2},altitude:{priority:2},speed:{priority:2},journey:{priority:3},telemetry:{priority:3}};
  static profiles={web:['airline','identity','route','model','registration','progress','altitude','speed'],wallArea:['airline','identity','route','model','registration','journey','altitude','speed'],wallFollow:['airline','identity','route','model','registration','progress','altitude','speed','journey'],journal:['airline','identity','route','model','registration','firstSeen','lastSeen','sightings'],minimal:['identity','altitude','speed','model','route']};
  static identity(a){const flight=String(a?.flight||'').trim().toUpperCase(),registration=String(a?.r||'').trim().toUpperCase();return {value:flight||registration||String(a?.hex||'').toUpperCase(),label:flight?'Callsign':registration?'Registration':'ICAO identifier'}}
  static format(value,unit='',round=1){return Number.isFinite(value)?{value:(Math.round(value/round)*round).toLocaleString('en-GB'),unit}:{value:'Not available',unit:''}}
  static altitude(a,metric=false){if(a.alt_baro==='ground')return {value:'Ground',unit:''};const value=Number.isFinite(a.alt_baro)?a.alt_baro:a.alt_geom;return this.format(Number.isFinite(value)?value*(metric?.3048:1):null,metric?'m':'ft',metric?10:100)}
  static speed(a,metric=false){return this.format(Number.isFinite(a.gs)?a.gs*(metric?1.852:1):null,metric?'km/h':'kt')}
  static vertical(a,metric=false){const v=a.baro_rate??a.geom_rate;return this.format(Number.isFinite(v)?v*(metric?.00508:1):null,metric?'m/s':'ft/min',metric?.1:1)}
  static progress(p,metric=false,aircraft=null,route=null){
    const departure=WallJourney.fromDeparture(aircraft,route),kind=aircraft&&typeof aircraftSymbolFor==='function'?aircraftSymbolFor(aircraft).key:'jet';
    const airborne=aircraft&&route?WallJourney.airborneMinutes(aircraft,route,kind,p):(Number.isFinite(p?.takeoff)?p.elapsedMinutes:null);
    return {distance:{...this.format(departure?departure.distanceKm/(metric?1:1.852):null,metric?'km':'NM'),label:'Distance from departure'},time:{value:Number.isFinite(airborne)?this.duration(airborne):'Not available',unit:'',label:'Time airborne'}};
  }
  static duration(minutes){if(!Number.isFinite(minutes))return 'Not available';const m=Math.floor(Math.max(0,minutes)),h=Math.floor(m/60);return h?h+' h'+(m%60?' '+m%60+' min':''):m+' min'}
  static snapshot(a,options={}){
    const metric=options.units==='metric',operator=airlineFor(a),type=typeFor(a),identity=this.identity(a),route=options.route===undefined?routeFor(a):options.route;
    return {aircraft:a,identity,airline:operator,model:type.code||String(a.desc||'').trim()?type.name:'',registration:a.r||'',route,routeCodes:route?routeCodes(route):'',routeNames:route?routeTitle(route):'',altitude:this.altitude(a,metric),speed:this.speed(a,metric),vertical:this.vertical(a,metric),progress:this.progress(flightProgress.forAircraft(a,options.sceneTime??a.positionTime),metric,a,route),journey:WallJourney.estimate(a,route,aircraftSymbolFor(a).key)};
  }
}
const AIRCRAFT_PREF_KEY='flightscan-aircraft-preferences-v1';
function aircraftPrefsLoad(){
  let value=null,legacy=null;try{value=JSON.parse(localStorage.getItem(AIRCRAFT_PREF_KEY)||'null');legacy=JSON.parse(localStorage.getItem('airspace-wall-v1')||'null')}catch{}
  const saved=value||legacy||{},zone=typeof saved.zone==='string'&&saved.zone&&wallZoneValid(saved.zone)?saved.zone:Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC';
  return {units:saved.units==='metric'?'metric':'aviation',zone,vertical:value?.vertical===true,freshness:value?.freshness===true};
}
const aircraftPrefs=aircraftPrefsLoad();
function aircraftPrefsApply(){
  wallSettings.units=aircraftPrefs.units;wallSettings.zone=aircraftPrefs.zone;wallPersist();
  for(const [id,key]of [['uiUnits','units'],['uiZone','zone'],['wallUnits','units'],['wallZone','zone']])$(id).value=aircraftPrefs[key];
  $('tableVertical').checked=aircraftPrefs.vertical;$('tableFreshness').checked=aircraftPrefs.freshness;
  document.body.classList.toggle('table-vertical',aircraftPrefs.vertical);document.body.classList.toggle('table-freshness',aircraftPrefs.freshness);
  const palette=uiCanvasPalette(uiSettings.theme),metric=aircraftPrefs.units==='metric';
  document.querySelector('.map-legend').innerHTML=`<span data-altitude="low" style="color:${palette.low}">●</span> ${metric?'&lt;3,050 m':'&lt;10k ft'}　<span data-altitude="middle" style="color:${palette.middle}">●</span> ${metric?'3,050–7,620 m':'10–25k ft'}　<span data-altitude="high" style="color:${palette.high}">●</span> ${metric?'≥7,620 m':'≥25k ft'}　<span data-altitude="ground" style="color:${palette.ground}">●</span> Ground`;
  wall.lastCard='';wall.lastSecond=-1;wallLog.slotKeys=[];wallInfoPresentation.clear();
  if(wallActive){wallApplyAppearance();wallUpdate(Date.now());wallPaint()}else{render();updateStatus()}
}
function aircraftPrefsSave(){try{localStorage.setItem(AIRCRAFT_PREF_KEY,JSON.stringify(aircraftPrefs))}catch{}aircraftPrefsApply()}
for(const id of ['uiUnits','uiZone'])$(id).onchange=()=>{const zone=$('uiZone').value.trim();if(!wallZoneValid(zone)){$('uiZone').setCustomValidity('Use a valid time zone, for example Europe/Berlin or UTC.');$('uiZone').reportValidity();return}$('uiZone').setCustomValidity('');aircraftPrefs.units=$('uiUnits').value;aircraftPrefs.zone=zone;aircraftPrefsSave()};
for(const [id,key]of [['tableVertical','vertical'],['tableFreshness','freshness']])$(id).onchange=()=>{aircraftPrefs[key]=$(id).checked;aircraftPrefsSave()};
window.addEventListener('storage',event=>{if(event.key===AIRCRAFT_PREF_KEY){Object.assign(aircraftPrefs,aircraftPrefsLoad());aircraftPrefsApply()}});
function infoMetric(label,data){return `<div><small>${esc(label)}</small><strong${data.value==='Not available'?' class="metric-unknown"':''}>${esc(data.value)}</strong>${data.unit?`<span class="metric-unit">${esc(data.unit)}</span>`:''}</div>`}
function infoText(data){return data.value+(data.unit?' '+data.unit:'')}
/* AIRCRAFT_INFO_END */
