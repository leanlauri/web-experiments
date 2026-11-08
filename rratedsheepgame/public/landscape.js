// Plan first, decorate second. Every parcel has a use and all travel lanes stay clear.
export const HOME={x:0,z:-394,doorZ:-389.8};
export const BOUNDS={minX:-255,maxX:270,minZ:-470,maxZ:65};
export const ROADS=[
 {x:26,z:-210,w:7,d:540}, {x:123,z:-88,w:201,d:7},
 {x:132,z:-260,w:219,d:7}, {x:-92,z:-190,w:243,d:6},
 {x:220,z:-174,w:6,d:179}, {x:-210,z:-300,w:6,d:226},
 {x:-92,z:-410,w:243,d:6}, {x:105,z:-450,w:165,d:6},
];
export const PATHS=[{x:0,z:-190,w:4,d:400},{x:13,z:-372,w:26,d:3},
 {x:-60,z:-130,w:120,d:2.5},{x:-120,z:-158,w:2.5,d:58},
 {x:135,z:-345,w:168,d:2.5},{x:52,z:-305,w:2.5,d:82}];
export function roofProfile(width,wallHeight=3.2){const half=width/2+.45,rise=width*.27;return {half,eave:wallHeight,ridge:wallHeight+rise};}
export function reserved(x,z,margin=0){return [...ROADS,...PATHS].some(r=>inRect(x,z,r,margin));}
// Unified ground: roads win over paths, which win over parcel land use.
export const LAND_COLORS={pasture:0x9dbc74,forest:0x789963,pond:0x7ea685,crops:0xb9b475,flowers:0xc0bc77,farm:0xa6ad75,town:0xc6bb9c,residential:0xabb986,home:0xb4bc85,animals:0x9fb77a};
export function surfaceAt(x,z){if(ROADS.some(r=>inRect(x,z,r)))return 0x777c75;if(PATHS.some(r=>inRect(x,z,r)))return 0xcaba91;const p=PARCELS.find(p=>inRect(x,z,p));return LAND_COLORS[p?.use]||0x91b76c;}
export const PARCELS=[
 {name:'Clover Meadow',use:'pasture',x:0,z:0,w:44,d:44},
 {name:'Willow Wood',use:'forest',x:-55,z:-65,w:58,d:78},
 {name:'Mill Pond',use:'pond',x:-51,z:11,w:26,d:20},
 {name:'Barley Fields',use:'crops',x:1,z:-62,w:36,d:42},
 {name:'Sunflower Fields',use:'flowers',x:2,z:-119,w:34,d:40},
 {name:'Apple Farm',use:'farm',x:57,z:-39,w:38,d:36},
 {name:'Brook Village',use:'town',x:62,z:-107,w:52,d:26},
 {name:'Orchard Lane',use:'residential',x:64,z:-69,w:50,d:22},
 {name:'Evening Farm',use:'home',x:0,z:-386,w:42,d:36},
 {name:'Deer Copse',use:'forest',x:-55,z:-150,w:58,d:56},
 {name:'Cow Pasture',use:'animals',x:58,z:-160,w:48,d:42},
 {name:'Hazel Woods',use:'forest',x:-150,z:-65,w:100,d:124},
 {name:'Westmere Hamlet',use:'town',x:-150,z:-211,w:86,d:26},
 {name:'Westmere Gardens',use:'residential',x:-150,z:-168,w:86,d:26},
 {name:'Willow Lake',use:'pond',x:-139,z:-288,w:58,d:46},
 {name:'Long Acre',use:'crops',x:-61,z:-244,w:62,d:64},
 {name:'Buttercup Field',use:'flowers',x:-60,z:-320,w:64,d:58},
 {name:'North Copse',use:'forest',x:-151,z:-367,w:90,d:64},
 {name:'Stonebridge Farm',use:'farm',x:-48,z:-380,w:52,d:42},
 {name:'Market Green',use:'town',x:148,z:-110,w:100,d:27},
 {name:'East Cottages',use:'residential',x:160,z:-65,w:90,d:26},
 {name:'East Orchard',use:'farm',x:157,z:-179,w:80,d:68},
 {name:'Hill Pasture',use:'animals',x:154,z:-231,w:96,d:36},
 {name:'Oak Forest',use:'forest',x:140,z:-310,w:118,d:66},
 {name:'Southmere Farm',use:'farm',x:65,z:-367,w:48,d:40},
 {name:'Golden Acres',use:'crops',x:128,z:-398,w:68,d:80},
 {name:'Poppy Meadow',use:'flowers',x:53,z:-300,w:36,d:54},
 {name:'Moorland Pond',use:'pond',x:206,z:-370,w:40,d:28},
 {name:'Far Wood',use:'forest',x:211,z:-425,w:70,d:54},

];
export function randomSource(seed=8751){return ()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};}
export function inRect(x,z,p,margin=0){return Math.abs(x-p.x)<p.w/2+margin&&Math.abs(z-p.z)<p.d/2+margin;}
export function weatherAt(seconds){const phase=seconds%180;return phase<55?'Sunny':phase<85?'Cloudy':phase<125?'Rain':phase<150?'Clearing':'Sunny';}
export function canShelter(s){return s.following&&Math.abs(s.x-HOME.x)<1.65&&s.z<HOME.doorZ-1&&s.z>HOME.z-3;}
