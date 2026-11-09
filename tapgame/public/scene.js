import * as T from './vendor/three.module.js';
import {stations,shelves} from './world.js';
const palette={cream:0xe9e7df,green:0x365e4c,steel:0x9da8aa,wood:0x9b7d58};
export function createShop(canvas){
 const renderer=new T.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
 renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.02;
 const scene=new T.Scene();scene.background=new T.Color(0xb9c3bf);scene.fog=new T.Fog(0xb9c3bf,35,72);
 const camera=new T.PerspectiveCamera(47,1,.1,120);
 const env=new T.Scene();env.background=new T.Color(0x879ca3);
 for(const [x,y,z,w,h,color] of [[0,8,0,18,10,0xffffff],[-9,3,0,3,12,0xf0e2c9],[9,4,0,4,16,0xe3f4ff],[0,3,-12,15,6,0x404f49]]){const panel=new T.Mesh(new T.PlaneGeometry(w,h),new T.MeshBasicMaterial({color,side:T.DoubleSide}));panel.position.set(x,y,z);panel.lookAt(0,1,0);env.add(panel)}
 const pmrem=new T.PMREMGenerator(renderer),envTarget=pmrem.fromScene(env,.04);scene.environment=envTarget.texture;pmrem.dispose();
 scene.add(new T.HemisphereLight(0xe9f3ff,0x7a705e,1.5));
 const sun=new T.DirectionalLight(0xffefd8,2.4);sun.position.set(-10,19,9);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-19,right:19,top:19,bottom:-19,near:1,far:55});sun.shadow.bias=-.00035;sun.shadow.normalBias=.035;scene.add(sun);
 const fill=new T.DirectionalLight(0xd8eaff,1.1);fill.position.set(8,8,-10);scene.add(fill);
 const mats=new Map();
 function mat(color,metalness=0,roughness=.65){const key=[color,metalness,roughness].join();if(!mats.has(key))mats.set(key,new T.MeshStandardMaterial({color,metalness,roughness}));return mats.get(key)}
 const chrome=mat(0xd3dce0,.94,.19),rubber=mat(0x243733,.05,.65),wood=mat(palette.wood,0,.67),white=mat(0xeeeee7,.05,.45);
 function mesh(geo,material,parent,x=0,y=0,z=0){const m=new T.Mesh(geo,material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m}
 function box(w,h,d,color,parent,x=0,y=0,z=0,metal=0,rough=.6){return mesh(new T.BoxGeometry(w,h,d),typeof color==='number'?mat(color,metal,rough):color,parent,x,y,z)}
 function ball(r,color,parent,x,y,z,sx=1,sy=1,sz=1){const m=mesh(new T.SphereGeometry(r,20,14),typeof color==='number'?mat(color):color,parent,x,y,z);m.scale.set(sx,sy,sz);return m}
 function cyl(r,h,color,parent,x=0,y=0,z=0,r2=r){return mesh(new T.CylinderGeometry(r,r2,h,24),typeof color==='number'?mat(color):color,parent,x,y,z)}
 function tube(points,r,material,parent){return mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),32,r,12,false),material,parent)}
 const signMaterials=new Map();
 function sign(label,w,h,parent,x,y,z,size=60,bg='#f4f1e8',fg='#355342'){
  const key=[label,w,h,size,bg,fg].join('|');
  if(!signMaterials.has(key)){
   const c=document.createElement('canvas');c.width=512;c.height=Math.round(512*h/w);const g=c.getContext('2d');g.fillStyle=bg;g.fillRect(0,0,c.width,c.height);g.font=`600 ${size/2}px sans-serif`;g.textAlign='center';g.textBaseline='middle';g.fillStyle=fg;g.fillText(label,256,c.height/2,480);
   const texture=new T.CanvasTexture(c);texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=4;signMaterials.set(key,new T.MeshStandardMaterial({map:texture,roughness:.8,side:T.DoubleSide}));
  }
  return mesh(new T.PlaneGeometry(w,h),signMaterials.get(key),parent,x,y,z);

 }
 // Individual porcelain tiles, grout lines, low skirting and shopfront glazing.
 box(24,.25,25,0x989b92,scene,0,-.2,0);
 const tileGeo=new T.BoxGeometry(.98,.055,.98),tileA=mat(0xd6d4c9,0,.3),tileB=mat(0xc9c9bf,0,.38);
 const tiles=new T.InstancedMesh(tileGeo,tileA,575),tiles2=new T.InstancedMesh(tileGeo,tileB,575);let a=0,b=0;const matrix=new T.Matrix4();
 for(let x=-11;x<=11;x++)for(let z=-12;z<=12;z++){matrix.makeTranslation(x,-.03,z);if((x+z)%3)tiles.setMatrixAt(a++,matrix);else tiles2.setMatrixAt(b++,matrix)}tiles.count=a;tiles2.count=b;tiles.receiveShadow=tiles2.receiveShadow=true;scene.add(tiles,tiles2);
 box(24,4.7,.22,0xdadcd2,scene,0,2.2,-11.5);box(.22,4.7,24,0xd2d8d1,scene,-11.6,2.2,0);box(.22,.24,24,palette.green,scene,-11.45,.12,0);box(24,.24,.22,palette.green,scene,0,.12,-11.3);
 sign('TAPPY’S  /  WASH & CARE',10,.9,scene,0,3.25,-11.35,66,'#325846','#f7f1dc');sign('STATIONERY  •  SOUND  •  SERVICE',8,.4,scene,0,2.5,-11.34,40,'#dadcd2','#5b6b5b');
 // Right-hand glass windows; mullions and daylight strips.
 const glass=new T.MeshPhysicalMaterial({color:0xc7e3e7,metalness:.1,roughness:.15,transparent:true,opacity:.15,side:T.DoubleSide});
 for(let z=-8;z<=8;z+=4){box(.06,3.9,3.8,glass,scene,11.7,2.1,z);box(.12,4.3,.08,palette.green,scene,11.7,2.1,z-2);box(.12,.09,4,palette.green,scene,11.7,1.3,z)}
 for(let x=-8;x<10;x+=6){box(3.6,.06,.22,0xfff5df,scene,x,4.6,-1);const light=new T.PointLight(0xffefcf,8,10,2);light.position.set(x,4,-1);scene.add(light)}
 function product(kind,parent,color=0x80998c){
  const g=new T.Group();parent.add(g);
  if(kind==='notebook'){
   box(.72,.10,.94,color,g,0,.05,0);box(.64,.055,.88,0xf4edda,g,.025,.08,0);box(.72,.025,.94,color,g,0,.12,0);box(.055,.03,.94,0x3c5146,g,-.29,.14,0);for(let z=-.34;z<.4;z+=.13){const ring=new T.Mesh(new T.TorusGeometry(.048,.008,5,10),chrome);ring.rotation.y=Math.PI/2;ring.position.set(-.36,.11,z);g.add(ring)}
   const lbl=sign('NOTES',.42,.24,g,.05,.141,.04,100,'#bac4ac','#334c42');lbl.rotation.x=-Math.PI/2;
  }else if(kind==='pencil'||kind==='pen'){
   for(let i=0;i<3;i++){const pen=new T.Group();g.add(pen);pen.position.set((i-1)*.16,.08,(i%2)*.07);pen.rotation.z=Math.PI/2;
    cyl(.033,.78,kind==='pencil'?0xd2a341:0x244e69,pen,0,0,0);cyl(.035,.09,kind==='pencil'?0xdd9d94:chrome,pen,0,.43,0);cyl(0,.12,kind==='pencil'?0xcab28e:chrome,pen,0,-.45,0,.033);if(kind==='pencil')cyl(0,.045,0x353633,pen,0,-.518,0,.012);else box(.018,.18,.014,chrome,pen,.03,.29,0);
   }
  }else{
   const band=mesh(new T.TorusGeometry(.34,.045,10,40,Math.PI),rubber,g,0,.4,0);band.rotation.z=0;
   for(const x of [-.34,.34]){cyl(.08,.19,chrome,g,x,.31,0);const cup=ball(.18,rubber,g,x,.19,0,.65,1,1);ball(.15,mat(0x64757b,.45,.4),g,x+(x>0?.035:-.035),.19,0,.5,1,1);box(.045,.06,.10,0xc2cfcc,g,x,.16,.13)}
  }
  return g;
 }
 // Gondola shelving with real geometry for notebooks, writing tools and boxed headphones.
 shelves.forEach((s,index)=>{
  const shelf=new T.Group();scene.add(shelf);shelf.position.set(s.x,0,s.z);
  box(s.w,.25,s.d,0x7a837d,shelf,0,.14,0,.35);box(.11,2.1,s.d,0xa4aaa2,shelf,0,1.1,0,.5);
  for(const z of [-s.d/2+.1,s.d/2-.1])box(s.w,2.15,.12,0xd4d7cd,shelf,0,1.1,z,.15);
  for(let level=0;level<3;level++){const y=.42+level*.67;box(s.w,.06,s.d-.15,0xe0e0d6,shelf,0,y,0,.25);
   for(const side of [-1,1])for(let z=-2.8;z<=2.9;z+=.8){
    const g=new T.Group();shelf.add(g);g.position.set(side*.57,y+.04,z);
    if(index===0){const item=product('notebook',g,[0x4c7562,0x9e735a,0x738e9d][(level+Math.round(z+3))%3]);item.scale.set(.7,.7,.7)}
    else if(index===1){box(.56,.36,.55,[0xdbc893,0x668a94,0x96aa86][level],g,0,.18,0);sign(level===0?'PENCILS':'PENS',.4,.13,g,0,.2,.28,95,'#e9e7d4','#395346')}
    else{box(.54,.48,.53,0x3d4d52,g,0,.24,0);sign('SOUND',.43,.15,g,0,.29,.27,90,'#3d4d52','#e7e6da');const loop=mesh(new T.TorusGeometry(.11,.012,5,16,Math.PI),chrome,g,0,.12,.28)}
    const tag=sign(index===2?'£29.99':index===0?'£3.50':'£1.20',.36,.12,shelf,side*1.01,y-.01,z,105,'#f6eed8','#333d32');tag.rotation.y=side*Math.PI/2;
   }
  }
  sign(['NOTEBOOKS','PENS & PENCILS','HEADPHONES'][index],2,.38,shelf,0,2.42,3.58,65,'#3e5c4a','#f7f1df');
 });
 const jobs=[];
 stations.forEach((s,i)=>{
  const table=new T.Group();table.position.set(s.x,0,s.z);scene.add(table);
  for(const x of [-.58,.58])for(const z of [-.4,.4])cyl(.045,1,chrome,table,x,.5,z);
  box(1.55,.12,1.15,wood,table,0,.96,0);box(1.32,.035,1,chrome,table,0,1.04,0);box(1.15,.03,.86,0xc6d6cd,table,0,1.07,0);
  const item=product(s.kind,table,s.color);item.position.y=1.10;
  sign(`${s.customer.toUpperCase()} / ${s.name.toUpperCase()}`,1.5,.23,table,0,.75,.59,61,'#eeeada','#3a5945');
  const dirtMaterial=new T.MeshStandardMaterial({color:0x71604d,roughness:1,transparent:true,opacity:.85});
  const dirt=new T.Group();table.add(dirt);for(let j=0;j<9;j++){const x=Math.sin(j*9+i)*.28,z=Math.cos(j*8)*.28;const d=ball(.07,dirtMaterial,dirt,x,s.kind==='headphones'?1.42:1.26,z,1,.17,1.2);if(s.kind==='headphones')d.position.x=(j%2?1:-1)*.34}
  const halo=mesh(new T.RingGeometry(.83,.88,48),new T.MeshBasicMaterial({color:0xb8d8c4,transparent:true,opacity:.75,side:T.DoubleSide}),table,0,.025,0);halo.rotation.x=-Math.PI/2;
  const label=sign(`${i+1}  /  ${s.name.toUpperCase()}`,1.85,.33,table,0,2.55,0,65,'#f1ede0','#3d5947');
  jobs.push({table,item,dirt,dirtMaterial,halo,label});
 });
 // Service desk, card terminal, paper bag, waiting mat and shop details.
 box(3.9,1.05,1.1,palette.green,scene,0,.53,11.2);box(4.1,.13,1.35,wood,scene,0,1.12,11.2);sign('WASH & CARE  /  THANK YOU',3.2,.27,scene,0,.62,11.77,61,'#365e4c','#f1e9d2');
 const terminal=box(.34,.11,.48,0x333e3b,scene,1.2,1.25,11.1);terminal.rotation.x=.2;const screen=box(.26,.02,.22,0x9fbba7,scene,1.2,1.32,11.02);
 box(3,.025,1.7,0x5f8b71,scene,0,.018,9.3);const matLabel=sign('FINISH HERE',2,.45,scene,0,.04,9.4,70,'#5f8b71','#e9efdd');matLabel.rotation.x=-Math.PI/2;
 for(const x of [-10,10]){cyl(.4,.7,0xb4a08a,scene,x,.35,9,.28);for(let i=0;i<7;i++){const leaf=ball(.4,mat(0x4f7655),scene,x+Math.sin(i)*.25,1+Math.cos(i*2)*.25,9+Math.cos(i)*.2,.5,1.4,.35);leaf.rotation.z=Math.sin(i)*.6}}
 function human(color,skin,hair,staff=false){const g=new T.Group();
  for(const x of [-.13,.13]){const leg=cyl(.08,.66,0x394542,g,x,.39,0);box(.17,.13,.32,0x27332e,g,x,.08,.06)}
  const body=cyl(.22,.55,color,g,0,.98,0,.18);for(const x of [-.3,.3]){const arm=cyl(.065,.53,color,g,x,1.0,.02);arm.rotation.z=x>0?-.12:.12;ball(.065,skin,g,x,.7,.02)}
  cyl(.07,.13,skin,g,0,1.32,0);ball(.18,skin,g,0,1.55,0,.83,1.15,.9);ball(.18,hair,g,0,1.66,-.025,.88,.65,.91);
  for(const x of [-.055,.055])ball(.012,0x333c36,g,x,1.56,.153);
  if(staff){box(.30,.48,.04,0xd4cbb2,g,0,.95,.19);box(.10,.05,.02,0xf4f3e6,g,.08,1.13,.22);cyl(.19,.07,palette.green,g,0,1.8,0)}else{box(.28,.33,.13,0xad9872,g,.35,.60,.07);tube([[.25,.74,.07],[.36,.91,.07],[.48,.74,.07]],.015,wood,g)}
  scene.add(g);return g;
 }
 const customers=stations.map((s,i)=>{const person=human([0x8c6f5b,0x526d7d,0xb3a07d,0x697767][i],[0xc89673,0x9c6c4e,0xd1aa8c,0xc9a07c][i],[0x473c32,0x272d28,0x695342,0x695d50][i]);person.position.set(s.x,0,s.z-1.3);return person});
 const keeper=human(palette.green,0xb78d69,0x554b3c,true);
 // Tappy: an actual curved chrome faucet with a friendly face and tiny boots.
 const tap=new T.Group();scene.add(tap);const body=new T.Group();tap.add(body);
 cyl(.26,.64,chrome,body,0,.73,0,.29);cyl(.32,.09,chrome,body,0,.39,0);cyl(.23,.13,chrome,body,0,1.09,0);
 tube([[0,.92,0],[.1,1.22,0],[.47,1.24,0],[.68,1.08,0],[.68,.94,0]],.105,chrome,body);cyl(.12,.07,chrome,body,.68,.91,0);cyl(.09,.01,rubber,body,.68,.869,0);
 cyl(.055,.18,chrome,body,0,1.24,0);box(.60,.07,.10,chrome,body,0,1.34,0);box(.10,.07,.42,chrome,body,0,1.34,0);
 ball(.037,0xc87f6c,body,-.28,1.345,0);ball(.037,0x729bb2,body,.28,1.345,0);
 for(const x of [-.095,.095]){ball(.052,0x1a3532,body,x,.82,.248,1,1.2,.4);ball(.015,0xf6fff8,body,x-.012,.84,.27)}
 for(const x of [-.17,.17])ball(.045,mat(0xe4a39b,.1,.5),body,x,.72,.22,1,.55,.2);
 tube([[-.07,.715,.26],[0,.68,.285],[.07,.715,.26]],.012,rubber,body);
 for(const x of [-.16,.16]){cyl(.055,.23,chrome,tap,x,.26,0);box(.20,.13,.31,rubber,tap,x,.12,.06);tube([[x*1.5,.85,0],[x*2,.68,.01],[x*2.2,.74,.1]],.035,chrome,body)}
 const shadow=mesh(new T.CircleGeometry(.52,32),new T.MeshBasicMaterial({color:0x234e40,transparent:true,opacity:.16,depthWrite:false}),tap,0,.018,0);shadow.rotation.x=-Math.PI/2;
 // Reused transparent droplets and a curved water jet (no allocations each frame).
 const waterMat=new T.MeshStandardMaterial({color:0x9fdde2,metalness:.18,roughness:.1,transparent:true,opacity:.7,emissive:0x173b42});
 const droplets=new T.InstancedMesh(new T.SphereGeometry(.028,6,5),waterMat,90);droplets.instanceMatrix.setUsage(T.DynamicDrawUsage);scene.add(droplets);const dummy=new T.Object3D();
 // Instance repeated static stock and fittings so the detailed shop stays affordable on phones.
 scene.updateMatrixWorld(true);
 const dynamic=new Set([tap,keeper,customers[0],customers[1],customers[2],customers[3],...jobs.map(j=>j.table)]),batches=new Map();
 scene.traverse(object=>{
  if(!object.isMesh||object.isInstancedMesh)return;
  for(let p=object;p;p=p.parent)if(dynamic.has(p))return;
  const key=object.geometry.type+JSON.stringify(object.geometry.parameters)+object.material.uuid;
  if(!batches.has(key))batches.set(key,[]);batches.get(key).push(object);
 });
 for(const objects of batches.values()){
  if(objects.length<3)continue;
  const first=objects[0],instances=new T.InstancedMesh(first.geometry,first.material,objects.length);
  instances.castShadow=first.castShadow;instances.receiveShadow=first.receiveShadow;
  objects.forEach((object,i)=>{instances.setMatrixAt(i,object.matrixWorld);object.parent.remove(object)});scene.add(instances);
 }
 let wide=false;const cameraTarget=new T.Vector3(),desired=new T.Vector3();
 function resize(){const w=canvas.clientWidth,h=canvas.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix()}
 const observer=new ResizeObserver(resize);observer.observe(canvas);resize();
 camera.position.set(0,16,23);camera.lookAt(0,0,0);
 function render(w,dt){
  tap.position.set(w.player.x,0,w.player.z);tap.rotation.y=w.player.angle;body.position.y=w.moving?Math.sin(w.time*13)*.045:Math.sin(w.time*2)*.018;
  jobs.forEach((job,i)=>{const j=w.jobs[i];job.dirtMaterial.opacity=(1-j.clean)*.85;job.dirt.visible=j.clean<1;job.halo.material.color.setHex(j.clean===1?0x65c68d:w.active===i?0x9cdee3:0xb8d8c4);job.halo.rotation.z=w.time*.15;job.label.visible=j.clean<1;
   const c=customers[i];if(j.clean===1){c.position.x=T.MathUtils.damp(c.position.x,j.x,3,dt);c.position.z=T.MathUtils.damp(c.position.z,-8,1.5,dt);c.rotation.y=Math.PI}else{c.rotation.y=Math.sin(w.time*.4+i)*.15;c.position.y=Math.sin(w.time*1.5+i)*.008}
  });
  keeper.rotation.y=Math.atan2(w.keeper.x-keeper.position.x,w.keeper.z-keeper.position.z);keeper.position.set(w.keeper.x,0,w.keeper.z);
  const origin=new T.Vector3(.68,.91,0).applyAxisAngle(new T.Vector3(0,1,0),w.player.angle).add(tap.position);
  const destination=w.active>=0?new T.Vector3(w.jobs[w.active].x,1.2,w.jobs[w.active].z):new T.Vector3(Math.sin(w.player.angle)*1.7,.1,Math.cos(w.player.angle)*1.7).add(tap.position);
  droplets.visible=w.spraying&&w.phase==='playing';if(droplets.visible){for(let i=0;i<90;i++){const t=(i/90+w.time*1.7)%1;dummy.position.lerpVectors(origin,destination,t);dummy.position.y+=Math.sin(t*Math.PI)*.45;dummy.position.x+=Math.sin(i*13+w.time*9)*.06*t;dummy.position.z+=Math.cos(i*7)*.07*t;dummy.scale.set(1,1.7,1);dummy.updateMatrix();droplets.setMatrixAt(i,dummy.matrix)}droplets.instanceMatrix.needsUpdate=true}
  const isWide=wide||w.phase==='intro';
  if(isWide){const height=camera.aspect<1?35:23;desired.set(0,height,24);cameraTarget.set(0,0,0)}
  else{desired.set(w.player.x*.85,9.5+(camera.aspect<.85?2:0),w.player.z+11.5);cameraTarget.set(w.player.x*.85,.3,w.player.z-1.9)}
  camera.position.lerp(desired,1-Math.exp(-dt*3));camera.lookAt(cameraTarget);renderer.render(scene,camera);
 }
 return {render,toggleView(){wide=!wide;return wide},renderer,scene,camera};
}
