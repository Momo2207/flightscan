import {readFile,writeFile} from 'node:fs/promises';
const root=new URL('../',import.meta.url);
export async function refreshDesign(){
 const index=new URL('index.html',root);let html=await readFile(index,'utf8');
 const files=['ui-tokens.css','ui-components.css','ui-modes.css','wall-display.css','aircraft-symbols.css','wall-log.css','wall-camera.css','routes.css','wall-colours.css','ui-wall.css','wall-gallery.css','aircraft-info.css','liquid-glass.css','wall-compact.css'];
 const fonts=await Promise.all([100,300,400,500,700,900].map(async weight=>{
  const bytes=await readFile(new URL(`assets/fonts/FlightscanSans-${weight}.woff2`,root));
  return `@font-face{font-family:"Flightscan Sans";font-style:normal;font-weight:${weight};font-display:swap;src:url(data:font/woff2;base64,${bytes.toString('base64')}) format("woff2");}`;
 }));
 const styles=await Promise.all(files.map(name=>readFile(new URL('design-system/'+name,root),'utf8')));
 const css=[...fonts,...styles,'#freshness[hidden],#wallDelayLabel[hidden],#wallObservation[hidden],#wallFeedStatus[hidden],#wallLogStatus[hidden],#wallLogHistory[hidden]{display:none!important}'].join('\n');
 const style=/<style id="flightscanDesignSystem">[\s\S]*?<\/style>/;
 const ui=/\/\* UI_APPEARANCE_START \*\/[\s\S]*?\/\* UI_APPEARANCE_END \*\//;
 if(!style.test(html)||!ui.test(html))throw Error('Use build 17 or later index.html with the bundled design sources.');
 html=html.replace(style,()=>'<style id="flightscanDesignSystem">\n'+css+'\n</style>');
 html=html.replace(ui,()=>readUI);
 const routeScript=(await readFile(new URL('design-system/wall-routes.js',root),'utf8')).trim();
 const routeMarker=/\/\* WALL_ROUTE_PRESENTATION_START \*\/[\s\S]*?\/\* WALL_ROUTE_PRESENTATION_END \*\//;
 if(routeMarker.test(html))html=html.replace(routeMarker,()=>routeScript);
  else html=html.replace('/* UI_APPEARANCE_START */',()=>routeScript+'\n/* UI_APPEARANCE_START */');
 const journeyScript=(await readFile(new URL('design-system/wall-journey.js',root),'utf8')).trim();
 const journeyMarker=/\/\* WALL_JOURNEY_START \*\/[\s\S]*?\/\* WALL_JOURNEY_END \*\//;
 if(journeyMarker.test(html))html=html.replace(journeyMarker,()=>journeyScript);
 else html=html.replace('/* UI_APPEARANCE_START */',()=>journeyScript+'\n/* UI_APPEARANCE_START */');
 const galleryScript=(await readFile(new URL('design-system/wall-gallery.js',root),'utf8')).trim();
 const galleryMarker=/\/\* WALL_GALLERY_START \*\/[\s\S]*?\/\* WALL_GALLERY_END \*\//;
 if(galleryMarker.test(html))html=html.replace(galleryMarker,()=>galleryScript);
 else html=html.replace('/* UI_APPEARANCE_START */',()=>galleryScript+'\n/* UI_APPEARANCE_START */');
 const minimalScript=(await readFile(new URL('design-system/wall-minimal.js',root),'utf8')).trim();
 const minimalMarker=/\/\* WALL_MINIMALIST_START:[\s\S]*?\/\* WALL_MINIMALIST_END \*\//;
 if(!minimalMarker.test(html))throw Error('Missing wall aircraft-only presentation marker.');
 html=html.replace(minimalMarker,()=>minimalScript);
 for(const [file,name]of [['flight-progress.js','FLIGHT_PROGRESS'],['aircraft-info.js','AIRCRAFT_INFO']]){
  const script=(await readFile(new URL('design-system/'+file,root),'utf8')).trim();
  const marker=new RegExp('/\\* '+name+'_START \\*/[\\s\\S]*?/\\* '+name+'_END \\*/');
  if(marker.test(html))html=html.replace(marker,()=>script);
  else html=html.replace('/* UI_APPEARANCE_START */',()=>script+'\n/* UI_APPEARANCE_START */');
 }
 // Keep a single self-contained HTML for GitHub Pages and Vercel.
 await writeFile(index,html);
}
const readUI=(await readFile(new URL('design-system/ui-theme.js',root),'utf8')).trim();
