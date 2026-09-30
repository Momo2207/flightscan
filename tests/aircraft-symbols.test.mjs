import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const metadata=html.match(/^const AIRFRAME_META=.*;$/m)[0];
const source=html.split('/* AIRCRAFT_SYMBOLS_START:')[1].split('/* AIRCRAFT_SYMBOLS_END */')[0];
const classify=vm.runInNewContext(metadata+'\n/* AIRCRAFT_SYMBOLS_START:'+source+'\naircraftSymbolFor');
for(const [key,types] of Object.entries({wide:['A359','A388','B789','B77W'],narrow:['A320','A20N','B738','BCS3'],regional:['E190','E295','CRJ9'],business:['C56X','GLF6','FA7X'],military:['EUFI','F16','F35'],transport:['C17','K35R'],turboprop:['B350','AT76','DH8D','PC12'],light:['C172','CH7B'],helicopter:['EC35','EC45','R44'],glider:['GLID']})){
 test(key+' uses reported types',()=>{for(const t of types)assert.equal(classify({t}).key,key,t)});
}
test('callsign, registration, altitude and military flag alone do not invent an airframe category',()=>{
 for(const a of [{flight:'DLH123'},{flight:'RCH1',dbFlags:1},{r:'D-ERRD'},{alt_baro:42000,gs:550},{t:'UNKNOWN'},{t:'__proto__'},{}])assert.equal(classify(a).key,'generic');
 assert.equal(classify({t:'B350',dbFlags:1,flight:'VM205'}).key,'turboprop');
});
test('type normalization and default jet fallback are conservative',()=>{
 assert.equal(classify({t:' a320 '}).key,'narrow');
 assert.equal(classify({t:'IL62'}).key,'jet');
 assert.equal(classify({t:'A002'}).key,'generic','Gyroplanes must not be mislabelled gliders');
});
test('requested categories have distinct vector silhouettes and sensible map sizes',()=>{
 const icons=['A359','A320','E190','C56X','EUFI','B350','C172','EC35'].map(t=>classify({t}));
 assert.equal(new Set(icons.map(v=>v.path)).size,icons.length);
 for(const icon of icons){assert.ok(icon.size>=26&&icon.size<=38);assert.ok(icon.path.startsWith('M'))}
});
