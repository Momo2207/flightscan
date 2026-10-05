import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const css=readFileSync(new URL('../design-system/wall-concept.css',import.meta.url),'utf8');
const build=readFileSync(new URL('../scripts/build-design.mjs',import.meta.url),'utf8');
test('approved wall concept is compiled last and uses a full-canvas shell',()=>{
 assert.match(build,/wall-compact\.css','wall-concept\.css'/);
 assert.match(css,/grid-template-rows:clamp\(38px,4\.2vh,52px\) minmax\(0,1fr\)/);
 assert.match(css,/\.wall-bottom\{display:none!important\}/);
 assert.match(css,/height:100%;min-height:0/);
 assert.match(css,/grid-template-columns:minmax\(0,1fr\) clamp\(300px,25vw,470px\)/);
});
test('10-inch concept has dedicated 1280x800 and 1024x600 geometry',()=>{
 assert.match(css,/data-profile=compact10/);
 assert.match(css,/grid-template-columns:minmax\(0,1fr\) clamp\(245px,30vw,310px\)/);
 assert.match(css,/@media\(max-height:650px\) and \(orientation:landscape\)/);
 assert.match(css,/grid-template-columns:minmax\(0,1fr\) minmax\(228px,28vw\)/);
 assert.match(css,/\.wall-feature-foot\{display:none\}/);
});
test('Follow card removes the decorative silhouette and gives all six metrics fixed bands',()=>{
 assert.match(css,/data-mode=follow.*\.wall-plane-art\{display:none!important\}/s);
 assert.match(css,/\.wall-progress\{grid-column:1\/-1;grid-row:4/);
 assert.match(css,/\.wall-metrics\{grid-column:1\/-1;grid-row:5!important\}/);
 assert.match(css,/\.wall-journey\{grid-column:1\/-1;grid-row:6!important\}/);
});
