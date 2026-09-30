import {readFile,writeFile} from 'node:fs/promises';
const root=new URL('../',import.meta.url);
export async function refreshDesign(){
 const index=new URL('index.html',root);let html=await readFile(index,'utf8');
 const files=['ui-tokens.css','ui-components.css','ui-modes.css','wall-display.css','aircraft-symbols.css','wall-log.css','wall-camera.css','routes.css','wall-colours.css','ui-wall.css'];
 const fonts=await Promise.all([100,300,400,500,700,900].map(async weight=>{
  const bytes=await readFile(new URL(`assets/fonts/FlightscanSans-${weight}.woff2`,root));
  return `@font-face{font-family:"Flightscan Sans";font-style:normal;font-weight:${weight};font-display:swap;src:url(data:font/woff2;base64,${bytes.toString('base64')}) format("woff2");}`;
 }));
 const styles=await Promise.all(files.map(name=>readFile(new URL('design-system/'+name,root),'utf8')));
 const css=[...fonts,...styles,'#freshness[hidden],#wallDelayLabel[hidden],#wallObservation[hidden],#wallFeedStatus[hidden],#wallLogStatus[hidden],#wallLogHistory[hidden]{display:none!important}'].join('\n');
 const style=/<style id="flightscanDesignSystem">[\s\S]*?<\/style>/;
 const ui=/\/\* UI_APPEARANCE_START \*\/[\s\S]*?\/\* UI_APPEARANCE_END \*\//;
 if(!style.test(html)||!ui.test(html))throw Error('Use build 17 index.html with the bundled design sources.');
 html=html.replace(style,()=>'<style id="flightscanDesignSystem">\n'+css+'\n</style>');
 html=html.replace(ui,()=>readUI);
 // Keep a single self-contained HTML for GitHub Pages and Vercel.
 await writeFile(index,html);
}
const readUI=(await readFile(new URL('design-system/ui-theme.js',root),'utf8')).trim();
