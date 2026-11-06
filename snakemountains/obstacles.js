import * as THREE from 'three';

export function createObstacles(scene, levels, terrainHeight, trailPoint) {
  const items = [];
  let elapsed = 0, hurtUntil = 0;
  function site(route, progress, type) {
    const center = trailPoint(progress, 0, route), next = trailPoint(progress + .0001, 0, route);
    const tangent = new THREE.Vector2(next.x-center.x,next.z-center.z).normalize();
    const normal = new THREE.Vector2(-tangent.y,tangent.x);
    const item = {route,type,...center,tangent,normal,width:route.width,phase:0}; items.push(item); return item;
  }
  function coordinates(item,x,z) {
    const dx=x-item.x,dz=z-item.z;
    return {u:dx*item.normal.x+dz*item.normal.y,v:dx*item.tangent.x+dz*item.tangent.y};
  }
  function patch(item,color,halfLength,halfWidth) {
    const vertices=[item.x,terrainHeight(item.x,item.z)+.06,item.z],indices=[];
    for(let i=0;i<=40;i++) {
      const angle=i/40*Math.PI*2,u=Math.cos(angle)*halfWidth,v=Math.sin(angle)*halfLength;
      const x=item.x+item.normal.x*u+item.tangent.x*v,z=item.z+item.normal.y*u+item.tangent.y*v;
      vertices.push(x,terrainHeight(x,z)+.065,z);
      if(i<40)indices.push(0,i+1,i+2);
    }
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setIndex(indices);geometry.computeVertexNormals();
    const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color,roughness:.95,side:THREE.DoubleSide}));mesh.receiveShadow=true;scene.add(mesh);return mesh;
  }
  // Logs cover one side of the wide beginner trail, leaving a safe passage.
  for(const progress of [.18,.42,.68]) {
    const item=site(levels[0],progress,'log');
    item.min=-item.width*.1;item.max=item.width*.65;
    const endpoints=[item.min,item.max].map(u=>{
      const x=item.x+item.normal.x*u,z=item.z+item.normal.y*u;
      return new THREE.Vector3(x,terrainHeight(x,z)+.23,z);
    });
    const axis=endpoints[1].clone().sub(endpoints[0]);
    const mesh=new THREE.Mesh(new THREE.CylinderGeometry(.2,.24,axis.length(),10),new THREE.MeshStandardMaterial({color:'#704629',roughness:1}));
    mesh.position.copy(endpoints[0]).add(endpoints[1]).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),axis.normalize());mesh.castShadow=true;scene.add(mesh);
    const cap=new THREE.Mesh(new THREE.CircleGeometry(.18,10),new THREE.MeshStandardMaterial({color:'#d0a06b',side:THREE.DoubleSide}));
    cap.position.copy(endpoints[0]);cap.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),axis);scene.add(cap);
  }
  for(const progress of [.22,.55]) {const item=site(levels[1],progress,'mud');patch(item,'#5b3d2c',2.2,item.width*.7);}
  for(const progress of [.39,.70]) {
    const item=site(levels[1],progress,'thorns');item.gap=.34;
    for(const side of [-1,1]) {
      const points=[];
      for(let i=0;i<12;i++) {
        const u=side*(item.gap+.15+i*.055),v=Math.sin(i)*.08;
        const x=item.x+item.normal.x*u+item.tangent.x*v,z=item.z+item.normal.y*u+item.tangent.y*v;
        points.push(new THREE.Vector3(x,terrainHeight(x,z)+.25+Math.sin(i*.7)*.1,z));
      }
      const vine=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),20,.09,6,false),new THREE.MeshStandardMaterial({color:'#3e6032'}));scene.add(vine);
      for(let i=0;i<points.length;i+=2) {
        const thorn=new THREE.Mesh(new THREE.ConeGeometry(.09,.25,5),new THREE.MeshStandardMaterial({color:'#bd6471'}));thorn.position.copy(points[i]);thorn.position.y+=.15;thorn.rotation.z=side*.5;scene.add(thorn);
      }
    }
  }
  for(const progress of [.2,.43,.69]) {
    const item=site(levels[2],progress,'rockfall');
    item.warning=patch(item,'#ffc74f',1.0,1.0);item.warning.material.transparent=true;
    item.rock=new THREE.Mesh(new THREE.IcosahedronGeometry(.63,0),new THREE.MeshStandardMaterial({color:'#77776b',flatShading:true}));
    item.rock.castShadow=true;scene.add(item.rock);item.offset=items.filter(i=>i.type==='rockfall').length*1.9;
    item.lastHit=-1;
  }
  for(const progress of [.35,.57,.74]) {const item=site(levels[2],progress,'ledge');patch(item,'#748e91',2.6,item.width*.75);}
  function effects(x,z,route,raining) {
    const result={speed:1,boost:2.3,turn:3.5,slipX:0,slipZ:0,message:''};
    for(const item of items) {
      if(item.route!==route)continue;
      const {u,v}=coordinates(item,x,z);
      if(item.type==='mud'&&(u/(item.width*.7+.18))**2+(v/2.3)**2<1) {
        result.speed=.45;result.boost=1.1;result.message='Mud slows you down — save your turbo';
      }
      if(item.type==='ledge'&&(u/(item.width*.75+.18))**2+(v/2.7)**2<1) {
        result.message=raining?'Wet ledge! Counter-steer against the slide':'Rock ledge — slippery when rain falls';
        if(raining){result.turn=2;const dx=x-route.x,dz=z-route.z,length=Math.hypot(dx,dz)||1;result.slipX=dx/length*.65;result.slipZ=dz/length*.65;}
      }
      if(item.type==='log'&&Math.hypot(x-item.x,z-item.z)<3)result.message='Fallen log — use the clear side of the trail';
      if(item.type==='thorns'&&Math.hypot(x-item.x,z-item.z)<2)result.message='Thorny vines — aim for the gap';
      if(item.type==='rockfall'&&Math.hypot(x-item.x,z-item.z)<4)result.message=item.phase<2?'Falling rock warning! Wait or dodge the yellow shadow':'Watch for falling rocks';
    }
    return result;
  }
  function canMove(x,z,route) {
    return !items.some(item=>{
      if(item.route!==route)return false;
      const {u,v}=coordinates(item,x,z);
      if(item.type==='log')return u>item.min-.23&&u<item.max+.23&&Math.abs(v)<.4;
      return item.type==='rockfall'&&item.phase>=3&&item.phase<4&&Math.hypot(x-item.x,z-item.z)<.85;
    });
  }
  function damageAt(x,z,route) {
    if(elapsed<hurtUntil)return 0;
    for(const item of items) {
      if(item.route!==route)continue;
      const {u,v}=coordinates(item,x,z);
      if(item.type==='thorns'&&Math.abs(u)>item.gap&&Math.abs(u)<item.width*.8&&Math.abs(v)<.4){hurtUntil=elapsed+1.2;return 16;}
      if(item.type==='rockfall'&&item.phase>=2.8&&item.phase<3.2&&item.lastHit!==item.cycle&&Math.hypot(x-item.x,z-item.z)<.9){item.lastHit=item.cycle;hurtUntil=elapsed+1.2;return 25;}
    }
    return 0;
  }
  function update(delta) {
    elapsed+=delta;
    for(const item of items.filter(item=>item.type==='rockfall')) {
      const time=elapsed+item.offset;item.phase=time%8;item.cycle=Math.floor(time/8);
      item.warning.visible=item.phase<3.3;item.warning.material.opacity=.35+.3*Math.sin(elapsed*9)**2;
      item.rock.visible=item.phase>=2&&item.phase<4.5;
      const height=item.phase<3?(3-item.phase)*9:.65;
      item.rock.position.set(item.x,terrainHeight(item.x,item.z)+Math.max(.65,height),item.z);
      item.rock.rotation.set(elapsed,elapsed*.7,0);
      item.rock.scale.setScalar(item.phase>4?Math.max(.05,1-(item.phase-4)*2):1);
    }
  }
  function reset(){elapsed=0;hurtUntil=0;for(const item of items)item.lastHit=-1;update(0);}
  reset();return {items,effects,canMove,damageAt,update,reset};
}
