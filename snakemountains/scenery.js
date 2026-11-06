import * as THREE from 'three';
export function addScenery(scene, levels, terrainHeight, lakes) {
  let seed=819;
  const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  const dummy=new THREE.Object3D();
  const fernGeometry=new THREE.ConeGeometry(.45,1,4);fernGeometry.translate(0,.5,0);
  const ferns=new THREE.InstancedMesh(fernGeometry,new THREE.MeshStandardMaterial({color:'#46a566',roughness:1}),600);
  const flowers=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(.16,0),new THREE.MeshStandardMaterial({color:'#ff63b4',emissive:'#792043',emissiveIntensity:.2}),180);
  for(let i=0;i<600;i++) {
    const peak=levels[i%levels.length],angle=random()*Math.PI*2,radius=random()*(peak.radius+12);
    const x=peak.x+Math.cos(angle)*radius,z=peak.z+Math.sin(angle)*radius;
    const wet=lakes.some(lake=>Math.hypot(x-lake.x,z-lake.z)<lake.radius+1);
    const y=terrainHeight(x,z),scale=wet?0:.4+random()*.7;
    dummy.position.set(x,y,z);dummy.rotation.set(.2,random()*6.28,.45);dummy.scale.set(scale,scale,scale);dummy.updateMatrix();ferns.setMatrixAt(i,dummy.matrix);
    if(i<180){dummy.position.y+=scale*.6;dummy.scale.setScalar(scale);dummy.updateMatrix();flowers.setMatrixAt(i,dummy.matrix);flowers.setColorAt(i,new THREE.Color().setHSL(random()>.5?.9:.13,.8,.65));}
  }
  scene.add(ferns,flowers);
  // Bright cascades follow the real slopes below the lakes.
  for(const lake of lakes.filter(lake=>lake.route&&!lake.summit)) {
    const route=lake.route,dx=lake.x-route.x,dz=lake.z-route.z,length=Math.hypot(dx,dz);
    const vertices=[],indices=[];
    for(let i=0;i<=32;i++) {
      const travel=lake.radius*.9+i/32*7;
      const x=lake.x+dx/length*travel,z=lake.z+dz/length*travel;
      for(const side of [-1,1]) {
        const sx=x+dz/length*side*.23,sz=z-dx/length*side*.23;
        vertices.push(sx,terrainHeight(sx,sz)+.12,sz);
      }
      if(i<32){const a=i*2;indices.push(a,a+1,a+2,a+1,a+3,a+2);}
    }
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setIndex(indices);geometry.computeVertexNormals();
    scene.add(new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color:'#54cfff',side:THREE.DoubleSide,transparent:true,opacity:.85})));
  }
  const butterflies=[];
  for(let i=0;i<22;i++) {
    const butterfly=new THREE.Group(),color=['#64dfff','#ffb45c','#f58bdb'][i%3];
    const material=new THREE.MeshBasicMaterial({color,side:THREE.DoubleSide});
    const wings=[];
    for(const side of [-1,1]){
      const wing=new THREE.Mesh(new THREE.CircleGeometry(.15,6),material);wing.position.x=side*.13;butterfly.add(wing);wings.push(wing);
    }
    scene.add(butterfly);butterflies.push({group:butterfly,wings,phase:random()*6.28,radius:2+random()*10});
  }
  const birds=[];
  for(let i=0;i<9;i++) {
    const bird=new THREE.Group();bird.name='Rainforest bird';
    const plumage=new THREE.MeshStandardMaterial({color:['#ec4f48','#379ddb','#f3c448'][i%3],roughness:.65});
    const body=new THREE.Mesh(new THREE.SphereGeometry(.22,10,8),plumage);body.scale.set(.85,1,1.7);bird.add(body);
    const head=new THREE.Mesh(new THREE.SphereGeometry(.16,10,8),plumage);head.position.set(0,.16,.3);bird.add(head);
    const beak=new THREE.Mesh(new THREE.ConeGeometry(.09,.25,5),new THREE.MeshStandardMaterial({color:'#ffd77c'}));beak.rotation.x=Math.PI/2;beak.position.set(0,.14,.52);bird.add(beak);
    const wings=[];
    for(const side of [-1,1]) {
      const pivot=new THREE.Group();pivot.position.x=side*.12;
      const wing=new THREE.Mesh(new THREE.BoxGeometry(.8,.045,.28),plumage);wing.position.set(side*.4,0,-.04);pivot.add(wing);bird.add(pivot);wings.push(pivot);
    }
    scene.add(bird);birds.push({bird,wings,phase:i*.7,radius:5+i*1.2});
  }
  const mist=new THREE.Color('#d1ece0');
  for(let i=0;i<14;i++) {
    const angle=i/14*Math.PI*2;
    const peak=new THREE.Mesh(new THREE.ConeGeometry(14+random()*12,25+random()*35,6),new THREE.MeshStandardMaterial({color:mist,flatShading:true,roughness:1}));
    peak.position.set(Math.cos(angle)*135,10,Math.sin(angle)*135);scene.add(peak);
  }
  return function update(time,position) {
    birds.forEach(({bird,wings,phase,radius},i)=>{
      const angle=phase+time*(.22+i*.01),x=position.x+Math.cos(angle)*radius,z=position.z+Math.sin(angle)*radius;
      bird.position.set(x,Math.max(position.y+3,terrainHeight(x,z)+4)+Math.sin(time+phase)*.7,z);
      bird.rotation.y=-angle;
      wings.forEach((wing,side)=>wing.rotation.z=Math.sin(time*8+phase)*(side?1:-1)*.7);
    });
    butterflies.forEach((butterfly,i)=>{
      const angle=butterfly.phase+time*.16;
      const x=position.x+Math.cos(angle)*butterfly.radius,z=position.z+Math.sin(angle)*butterfly.radius;
      butterfly.group.position.set(x,terrainHeight(x,z)+1.3+Math.sin(time*2+butterfly.phase)*.3,z);
      butterfly.group.rotation.y=-angle;
      butterfly.wings.forEach((wing,index)=>wing.rotation.y=Math.sin(time*12+i)*(index?1:-1));
    });
  };
}
