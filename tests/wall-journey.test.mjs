import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../design-system/wall-journey.js',import.meta.url),'utf8');
const Journey=vm.runInNewContext(source+'\nWallJourney');
const route={from:{lat:50.033,lon:8.57},to:{lat:38.775,lon:-9.135}};
test('airport distance is a whole-route great-circle distance, independent of aircraft position',()=>{
 const value=Journey.estimate({t:'A320',lat:50.03,lon:8.57},route,'narrow');
 assert.ok(value.distanceKm>1850&&value.distanceKm<1900);assert.equal(value.durationMinutes,170);
 assert.equal(Journey.estimate({t:'A320',lat:39,lon:-9},route,'narrow').distanceKm,value.distanceKm);
});
test('ground, slow approach and held telemetry cannot turn the duration into a taxi-speed estimate',()=>{
 for(const state of [{alt_baro:'ground',gs:0},{gs:11},{gs:450},{held:true,gs:20}])assert.equal(Journey.estimate({t:'A320',...state},route,'narrow').durationMinutes,170);
});
test('malformed, missing or identical airport coordinates produce no journey figures',()=>{
 for(const bad of [null,{}, {...route,from:{lat:null,lon:8}}, {...route,to:{lat:'38',lon:-9}}, {...route,to:{lat:91,lon:0}}, {...route,to:{lat:20,lon:181}}, {...route,to:{lat:NaN,lon:0}}, {...route,to:route.from}])assert.equal(Journey.estimate({},bad,'narrow'),null);
});
test('longitude wrap uses the short path across the date line',()=>{
 const value=Journey.estimate({}, {from:{lat:0,lon:179},to:{lat:0,lon:-179}},'wide');
 assert.ok(value.distanceKm>222&&value.distanceKm<223);
});
test('near-antipodal airports remain finite despite floating-point rounding',()=>{
 const value=Journey.estimate({}, {from:{lat:51.23,lon:8.123},to:{lat:-51.23,lon:-171.877}},'wide');
 assert.ok(Number.isFinite(value.distanceKm)&&value.distanceKm>20000);
});
test('known jet classes get rounded estimates and unmodelled categories get distance only',()=>{
 for(const kind of ['wide','narrow','regional','business','jet'])assert.equal(Journey.estimate({},route,kind).durationMinutes%5,0);
 for(const kind of ['generic','light','helicopter','military','transport','glider','turboprop','toString','__proto__']){
  const info=Journey.estimate({},route,kind);assert.ok(info.distanceKm>0);assert.equal(info.durationMinutes,null);assert.equal(Journey.duration(info),'');
 }
 assert.equal(Journey.estimate({t:' b738 '},route,'narrow').speedKt,420);
});
test('distance respects aviation and metric units without excessive precision',()=>{
 const info=Journey.estimate({t:'A320'},route,'narrow');assert.equal(Journey.distance(info,true),'1,870');assert.equal(Journey.distance(info,false),'1,010');
 assert.equal(Journey.distance(null,true),'');assert.equal(Journey.distance({distanceKm:28},true),'28');
});
test('duration labels use readable hours and minutes without clock-time or ETA formatting',()=>{
 assert.equal(Journey.duration({durationMinutes:155}),'2 h 35 m');assert.equal(Journey.duration({durationMinutes:120}),'2 h');assert.equal(Journey.duration({durationMinutes:35}),'35 min');assert.equal(Journey.duration(null),'');
});
test('destination distance uses the supplied displayed position and works without departure coordinates',()=>{
 const early=Journey.remaining({lat:50.033,lon:8.57},route),near=Journey.remaining({lat:38.8,lon:-9.1},{to:route.to});
 assert.equal(early.distanceKm,Journey.estimate({},route,'narrow').distanceKm);
 assert.ok(near.distanceKm<5&&near.distanceKm>0);
 assert.equal(Journey.remaining(route.to,route).distanceKm,0);assert.equal(Journey.distance({distanceKm:0},true),'0');
 assert.equal(Journey.distance(near,false),String(Math.round(near.distanceKm/1.852)));
});
test('departure distance measures origin to displayed position without requiring a destination or flight history',()=>{
 const origin=route.from;
 assert.equal(Journey.fromDeparture(origin,{from:origin}).distanceKm,0);
 const near=Journey.fromDeparture({lat:50.033,lon:8.6},route),far=Journey.fromDeparture({lat:49.5,lon:5.5},{from:origin});
 assert.ok(near.distanceKm<3);assert.ok(far.distanceKm>220&&far.distanceKm<240);
 assert.equal(Journey.fromDeparture(route.to,route).distanceKm,Journey.estimate({},route,'wide').distanceKm);
});
test('departure distance rejects invalid origins and takes the short path across the date line',()=>{
 for(const from of [null,{}, {lat:'50',lon:8}, {lat:91,lon:8}, {lat:50,lon:181}])assert.equal(Journey.fromDeparture(route.to,{from}),null);
 assert.equal(Journey.fromDeparture(null,route),null);assert.equal(Journey.fromDeparture(route.to,null),null);
 assert.ok(Journey.fromDeparture({lat:0,lon:-179},{from:{lat:0,lon:179}}).distanceKm<223);
});
test('missing and malformed destination or aircraft positions never fabricate remaining distance',()=>{
 for(const aircraft of [null,{}, {lat:null,lon:0}, {lat:'50',lon:8}, {lat:91,lon:8}, {lat:50,lon:Infinity}])assert.equal(Journey.remaining(aircraft,route),null);
 for(const to of [null,{}, {lat:50,lon:181}, {lat:50,lon:NaN}])assert.equal(Journey.remaining(route.from,{to}),null);
 assert.equal(Journey.remaining(route.from,null),null);
 assert.equal(Journey.distance({distanceKm:null},true),'');
 assert.ok(Journey.remaining({lat:0,lon:179},{to:{lat:0,lon:-179}}).distanceKm<223);
});
test('Follow restores both route metrics by default, retains full-flight estimates and clears old routes',()=>{
 const nodes=new Map(),node=id=>{if(!nodes.has(id))nodes.set(id,{textContent:'',hidden:false,dataset:{}});return nodes.get(id)};
 const env={$:node,wallSettings:{units:'metric',journeyDisplay:'auto'},wallMode:()=> 'follow',aircraftSymbolFor:()=>({key:'narrow'})};
 const update=vm.runInNewContext(source+'\nwallJourneyUpdate',env);
 const a={t:'A320',lat:38.8,lon:-9.1,gs:0};update(a,route);
 assert.equal(node('wallJourney').hidden,false);assert.equal(node('wallJourneyTime').hidden,false);assert.equal(node('wallJourneyDistance').hidden,false);
 assert.equal(node('wallRouteDistanceLabel').textContent,'Distance to destination');assert.equal(node('wallRouteDistance').textContent,Journey.distance(Journey.remaining(a,route),true));assert.equal(node('wallEstimatedTime').textContent,'2 h 50 m');
 env.wallSettings.units='aviation';update(a,route);assert.equal(node('wallRouteDistanceUnit').textContent,'NM');
 update(a,null);assert.equal(node('wallJourney').hidden,true);assert.equal(node('wallRouteDistance').textContent,'');assert.equal(node('wallEstimatedTime').textContent,'');assert.equal(node('wallRouteDistanceUnit').textContent,'');
 update(a,route);env.wallSettings.journeyDisplay='off';update(a,route);assert.equal(node('wallJourney').hidden,true);
});
test('Follow independently hides unavailable destination distance or an unmodelled duration',()=>{
 const nodes=new Map(),node=id=>{if(!nodes.has(id))nodes.set(id,{textContent:'',hidden:false,dataset:{}});return nodes.get(id)};
 const env={$:node,wallSettings:{units:'metric',journeyDisplay:'auto'},wallMode:()=> 'follow',aircraftSymbolFor:()=>({key:'helicopter'})};
 const update=vm.runInNewContext(source+'\nwallJourneyUpdate',env);
 update({lat:38.8,lon:-9.1},route);assert.equal(node('wallJourney').hidden,false);assert.equal(node('wallJourneyTime').hidden,true);assert.equal(node('wallJourneyDistance').hidden,false);assert.equal(node('wallJourney').dataset.single,'true');
 env.aircraftSymbolFor=()=>({key:'narrow'});update({},route);assert.equal(node('wallJourney').hidden,false);assert.equal(node('wallJourneyTime').hidden,false);assert.equal(node('wallJourneyDistance').hidden,true);
 env.wallMode=()=> 'area';update({lat:38.8,lon:-9.1},route);assert.equal(node('wallRouteDistanceLabel').textContent,'Distance to destination');assert.equal(node('wallRouteDistance').textContent,Journey.distance(Journey.remaining({lat:38.8,lon:-9.1},route),true));
});

test('long-haul widebody estimates remain plausible and never shrink with aircraft position',()=>{
 const long={from:{lat:50.033,lon:8.57},to:{lat:18.567,lon:-68.363}},a={t:'A332',lat:49,lon:5};
 const total=Journey.estimate(a,long,'wide');assert.ok(total.distanceKm>7400&&total.distanceKm<7800);assert.ok(total.durationMinutes>=530&&total.durationMinutes<=555);
 const nearDestination={...a,lat:20,lon:-65};assert.equal(Journey.estimate(nearDestination,long,'wide').durationMinutes,total.durationMinutes);
});
test('route progress is bounded and reconstructed airborne time respects observed lower bound',()=>{
 const a={lat:44,lon:0},p=Journey.progress(a,route);assert.ok(p.ratio>0&&p.ratio<1);
 const estimated=Journey.airborneMinutes(a,route,'narrow',{elapsedMinutes:31,takeoff:null});assert.ok(estimated>=31);
 assert.equal(Journey.airborneMinutes(a,route,'narrow',{elapsedMinutes:73,takeoff:1}),73);
});
