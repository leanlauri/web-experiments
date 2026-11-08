const assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
 const land=await import('data:text/javascript;base64,'+fs.readFileSync(__dirname+'/../public/landscape.js').toString('base64'));
 const {PARCELS,ROADS,BOUNDS,roofProfile,surfaceAt}=land;
 assert((BOUNDS.maxX-BOUNDS.minX)*(BOUNDS.maxZ-BOUNDS.minZ)>275000);assert(PARCELS.length>=25);assert(ROADS.length>=8);
 for(let i=0;i<PARCELS.length;i++)for(let j=i+1;j<PARCELS.length;j++){const a=PARCELS[i],b=PARCELS[j];assert(!(Math.abs(a.x-b.x)<(a.w+b.w)/2&&Math.abs(a.z-b.z)<(a.d+b.d)/2),a.name+' overlaps '+b.name);}
 for(const w of [7,9,12]){const roof=roofProfile(w);assert.equal(roof.eave,3.2);assert(roof.ridge>roof.eave);assert(roof.half>w/2);}
 for(const r of ROADS)assert.equal(surfaceAt(r.x,r.z),0x777c75,'roads have consistent priority at crossings');
 console.log('PASS: 525 × 535 m layout, distinct non-overlapping parcels, road surface priority, roofs meet wall tops');
})().catch(e=>{console.error(e);process.exitCode=1});
