import * as THREE from 'three';

export function createFood(scene, levels, trailPoint, surfaceHeight, poolAt, canMove) {
  const apples=[];
  const fruitMaterial=new THREE.MeshStandardMaterial({color:'#ed3343',roughness:.38});
  const stemMaterial=new THREE.MeshStandardMaterial({color:'#6d4425'});
  const leafMaterial=new THREE.MeshStandardMaterial({color:'#73c43f',side:THREE.DoubleSide});
  const fruitGeometry=new THREE.SphereGeometry(.21,16,12);
  const progressPoints=[.035,.085,.145,.235,.325,.415,.505,.595,.675,.735,.805,.865];
  for(const route of levels)for(const progress of progressPoints) {
    const point=trailPoint(progress,0,route);
    if(poolAt(point.x,point.z)||!canMove(point.x,point.z,route))continue;
    const apple=new THREE.Group();apple.name='Collectible apple';
    for(const side of [-1,1]) {
      const lobe=new THREE.Mesh(fruitGeometry,fruitMaterial);lobe.position.x=side*.075;lobe.scale.set(.9,1,.95);lobe.castShadow=true;apple.add(lobe);
    }
    const stem=new THREE.Mesh(new THREE.CylinderGeometry(.025,.035,.18,6),stemMaterial);stem.position.y=.24;stem.rotation.z=-.25;apple.add(stem);
    const leaf=new THREE.Mesh(new THREE.CircleGeometry(.12,8),leafMaterial);leaf.position.set(.1,.28,0);leaf.scale.set(1,.45,1);leaf.rotation.x=-.5;apple.add(leaf);
    apple.position.set(point.x,surfaceHeight(point.x,point.z)+.45,point.z);scene.add(apple);
    apples.push({route,mesh:apple,...point,baseY:apple.position.y,eaten:false});
  }
  function reset(route){for(const apple of apples)if(apple.route===route){apple.eaten=false;apple.mesh.visible=true;}}
  function collect(position,route){
    let count=0;
    for(const apple of apples)if(!apple.eaten&&apple.route===route&&Math.hypot(position.x-apple.x,position.z-apple.z)<.6){apple.eaten=true;apple.mesh.visible=false;count++;}
    return count;
  }
  function update(time){for(const apple of apples)if(!apple.eaten){apple.mesh.position.y=apple.baseY+Math.sin(time*2+apple.x)*.07;apple.mesh.rotation.y=time*.7;}}
  return {apples,reset,collect,update};
}
