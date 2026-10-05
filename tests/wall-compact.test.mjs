import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../design-system/wall-compact.css',import.meta.url),'utf8');
test('10-inch wall profile is selectable, persisted, shareable and auto-resolved',()=>{
 assert.match(html,/id="wallProfile"/);assert.match(html,/value="compact10">Compact 10-inch/);
 assert.match(html,/profile:\['auto','compact10','full'\]/);assert.match(html,/profile:'wallProfile'/);
 assert.match(html,/profile:\$\('wallProfile'\)\.value/);assert.match(html,/wp10:settings\.profile/);assert.match(html,/profile:p\.get\('wp10'\)/);
 assert.match(html,/innerWidth<=1400&&innerHeight<=850&&innerWidth>innerHeight\?'compact10':'full'/);
});
test('compact profile prioritizes map and has a short 1024x600 tier',()=>{
 assert.match(css,/data-profile=compact10/);assert.match(css,/grid-template-columns:minmax\(0,1fr\) clamp\(260px,29vw,330px\)/);
 assert.match(css,/\.wall-bottom\{display:none\}/);assert.match(css,/@media\(max-height:650px\) and \(orientation:landscape\)/);
 assert.match(css,/#wallControls\{bottom:14px/);
});
