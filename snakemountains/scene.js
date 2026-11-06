import * as THREE from 'three';
import { OrbitControls } from './vendor/OrbitControls.js';
import { createSound } from './sound.js?v=apple-growth-v17';
import { createFood } from './food.js?v=apple-growth-v17';
import { createObstacles } from './obstacles.js?v=rainforest-obstacles-v16';
import { addScenery } from './scenery.js?v=birds-more-sounds-v15';

const container = document.querySelector('#scene');
const titlePanel = document.querySelector('#title-panel');
document.querySelector('#close-title').addEventListener('click', event => { titlePanel.hidden = true; event.currentTarget.blur(); });
try {
  const sound=createSound(document.querySelector('#sound-toggle'));
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#9bb7a5');
  scene.fog = new THREE.Fog('#9bb7a5', 45, 160);
  const camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.1, 260);
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  container.append(renderer.domElement);
  renderer.domElement.setAttribute('aria-label', 'Pink and red patterned snake exploring a climbable mountain. Drag to rotate and scroll or pinch to zoom.');
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.minDistance = 5;
  controls.maxDistance = 65;
  controls.maxPolarAngle = Math.PI / 3;
  let cameraAnchor = new THREE.Vector3(0, 0.9, 0);
  function resetView() {
    controls.target.copy(cameraAnchor);
    camera.position.copy(cameraAnchor).add(new THREE.Vector3(-10, 17, 15));
    controls.update();
  }
  resetView();
  document.querySelector('#reset').addEventListener('click', resetView);
  scene.add(new THREE.HemisphereLight('#e8eee0', '#69715b', 2.5));
  const sunlight = new THREE.DirectionalLight('#fff0ce', 3.5);
  sunlight.position.set(-35, 85, 25);
  sunlight.castShadow = true;
  sunlight.shadow.mapSize.set(2048, 2048);
  Object.assign(sunlight.shadow.camera, { left: -85, right: 85, top: 85, bottom: -85, near: 0.5, far: 240 });
  sunlight.shadow.normalBias = 0.04;
  sunlight.shadow.bias = -0.0001;
  scene.add(sunlight);
  const levels = [
    { name: 'Fern Foothills', difficulty: 'Easy', x: 65, z: 12, radius: 22, height: 14, turns: Math.PI * 2, width: 2.4, thirst: 0.65, completed: false },
    { name: 'Emerald Mountain', difficulty: 'Medium', x: -25, z: -40, radius: 40, height: 34, turns: Math.PI * 3.2, width: 1.6, thirst: 0.9, completed: false },
    { name: 'Stormspire', difficulty: 'Hard', x: 65, z: -65, radius: 30, height: 48, turns: Math.PI * 4, width: 0.85, thirst: 1.25, completed: false },
  ];
  let mountain = levels[0];
  function mountainHeight(x, z) {
    let height = 0;
    for (const peak of levels) {
      const dx = x - peak.x, dz = z - peak.z;
      const radius = Math.hypot(dx, dz);
      const t = THREE.MathUtils.clamp((radius - 1) / (peak.radius - 1), 0, 1);
      const ridge = Math.sin(Math.atan2(dz, dx) * 5 + radius * 0.5) * 0.35 * Math.sin(Math.PI * t) ** 2;
      height = Math.max(height, peak.height * (1 - t * t * (3 - 2 * t)) + ridge);
    }
    return height;
  }
  function trailPoint(progress, offset = 0, route = mountain) {
    const angle = 0.7 + progress * route.turns;
    const radius = Math.max(0, route.radius * (1 - progress) + offset);
    return { x: route.x + Math.cos(angle) * radius, z: route.z + Math.sin(angle) * radius };
  }
  // Use the same resolution as the visible trails for fair boundary checks.
  for (const route of levels) {
    route.centerline = Array.from({ length: 651 }, (_, i) => trailPoint(i / 650, 0, route));
  }
  function onTrailAt(x, z) {
    const limit = mountain.width / 2 + 0.2;
    const points = mountain.centerline;
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1], b = points[i];
      const dx = b.x - a.x, dz = b.z - a.z;
      const t = THREE.MathUtils.clamp(((x - a.x) * dx + (z - a.z) * dz) / Math.max(dx * dx + dz * dz, 0.000001), 0, 1);
      if ((x - a.x - t * dx) ** 2 + (z - a.z - t * dz) ** 2 <= limit * limit) return true;
    }
    return false;
  }
  const lakes = levels.flatMap((route, routeIndex) => (routeIndex === 0 ? [0.12, 0.48, 0.78] : [0.12, 0.3, 0.48, 0.63, 0.78]).map((progress, index) => {
    const center = trailPoint(progress, 4.5, route);
    return { ...center, approach: trailPoint(progress, 0, route), route, radius: [3.1, 3.3, 3][index % 3], level: mountainHeight(center.x, center.z), visited: false };
  }));
  for (const route of levels) {
    lakes.push({ x: route.x, z: route.z, radius: 5.5, level: route.height, route, summit: true, approach: trailPoint(0.8, 0, route), visited: false });
  }
  // A broad blue lake is visible from the starting clearing as well as the alpine lakes.
  lakes.unshift({ x: 10.8, z: -5, radius: 5, level: mountainHeight(10.8, -5), visited: false });
  function terrainHeight(x, z) {
    let height = mountainHeight(x, z);
    for (const lake of lakes) {
      const distance = Math.hypot(x - lake.x, z - lake.z);
      const edge = lake.radius + 4;
      if (distance >= edge) continue;
      if (distance <= lake.radius) {
        height = lake.level - 0.7 + 0.9 * (distance / lake.radius) ** 4;
      } else {
        const blend = THREE.MathUtils.smoothstep(distance, lake.radius + 1.5, edge);
        height = THREE.MathUtils.lerp(lake.level + 0.2, height, blend);
      }
    }
    return height;
  }
  function poolAt(x, z) {
    return lakes.find(lake => Math.hypot(x-lake.x,z-lake.z) < lake.radius * 0.92);
  }
  function surfaceHeight(x,z) {
    const pool=poolAt(x,z);
    return pool ? Math.max(pool.level,terrainHeight(x,z)) : terrainHeight(x,z);
  }
  function onPoolPath(x,z) {
    return lakes.some(lake => {
      if(lake.route!==mountain || !lake.approach) return false;
      if(lake.summit && Math.hypot(x-lake.x,z-lake.z)<lake.radius+1.5) return true;
      const a=lake.approach,dx=lake.x-a.x,dz=lake.z-a.z;
      const t=THREE.MathUtils.clamp(((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz),0,1);
      return Math.hypot(x-a.x-t*dx,z-a.z-t*dz)<mountain.width/2+.2;
    });
  }
  const terrainGeometry = new THREE.PlaneGeometry(224, 224, 448, 448);
  terrainGeometry.rotateX(-Math.PI / 2);
  const terrainPositions = terrainGeometry.attributes.position;
  const terrainColors = [];
  const lowColor = new THREE.Color('#407b41'), highColor = new THREE.Color('#456b48'), snowColor = new THREE.Color('#8a9c82');
  for (let i = 0; i < terrainPositions.count; i++) {
    const y = terrainHeight(terrainPositions.getX(i), terrainPositions.getZ(i));
    terrainPositions.setY(i, y);
    const color = lowColor.clone().lerp(highColor, Math.min(y / (48 * 0.625), 1));
    if (y > 48 * 0.825) color.lerp(snowColor, (y / 48 - 0.825) / 0.175);
    terrainColors.push(color.r, color.g, color.b);
  }
  terrainGeometry.setAttribute('color', new THREE.Float32BufferAttribute(terrainColors, 3));
  terrainGeometry.computeVertexNormals();
  const ground = new THREE.Mesh(terrainGeometry, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }));
  ground.receiveShadow = true;
  scene.add(ground);
  const horizonGround = new THREE.Mesh(new THREE.PlaneGeometry(320, 320), new THREE.MeshStandardMaterial({ color: '#407b41', roughness: 1 }));
  horizonGround.rotation.x = -Math.PI / 2;
  horizonGround.position.y = -0.02;
  horizonGround.receiveShadow = true;
  scene.add(horizonGround);

  const obstacles=createObstacles(scene,levels,terrainHeight,trailPoint);
  const food=createFood(scene,levels,trailPoint,surfaceHeight,poolAt,(x,z,route)=>obstacles.canMove(x,z,route));
  let applesEaten=0;
  const appleStatus=document.querySelector('#apple-status');
  function growthSize(){return 1+Math.min(applesEaten,12)*.025;}
  function appleDryingRate(){return 1/(1+Math.min(applesEaten,12)*.15);}
  function foodSpeed(){return 1+Math.min(applesEaten,12)*.05;}
  function collectApples(){
    const collected=food.collect(headPosition,mountain);
    if(collected){applesEaten+=collected;sound.effect('eat');}
    const text=`🍎 ${applesEaten} · Size ${growthSize().toFixed(2)}× · Speed +${Math.round((foodSpeed()-1)*100)}% · Drying −${Math.round((1-appleDryingRate())*100)}%`;
    if(appleStatus.textContent!==text)appleStatus.textContent=text;
  }
  let hurtMessageUntil=0;
  const hazardStatus=document.querySelector('#hazard-status');
  const ripples = [];
  const markerCanvas = document.createElement('canvas');
  markerCanvas.width = 512; markerCanvas.height = 128;
  const markerPaint = markerCanvas.getContext('2d');
  markerPaint.fillStyle = '#075974';
  markerPaint.beginPath(); markerPaint.roundRect(0, 0, 512, 128, 32); markerPaint.fill();
  markerPaint.fillStyle = '#ffffff'; markerPaint.font = 'bold 52px system-ui';
  markerPaint.textAlign = 'center'; markerPaint.textBaseline = 'middle';
  markerPaint.fillText('WATER · LAKE', 256, 64);
  const markerTexture = new THREE.CanvasTexture(markerCanvas);
  markerTexture.colorSpace = THREE.SRGBColorSpace;
  for (const lake of lakes) {
    const marker = new THREE.Sprite(new THREE.SpriteMaterial({ map: markerTexture, depthTest: false, depthWrite: false }));
    marker.position.set(lake.x, lake.level + 4, lake.z);
    marker.scale.set(4.5, 1.125, 1);
    marker.renderOrder = 5;
    scene.add(marker);
    const water = new THREE.Mesh(new THREE.CircleGeometry(lake.radius * 0.94, 64), new THREE.MeshBasicMaterial({ color: '#087dff', toneMapped: false, fog: false }));
    water.rotation.x = -Math.PI / 2;
    water.position.set(lake.x, lake.level + 0.025, lake.z);
    scene.add(water);
    for (let i = 0; i < 3; i++) {
      const ripple = new THREE.Mesh(new THREE.RingGeometry(0.96, 1, 48), new THREE.MeshBasicMaterial({ color: '#c9ffff', transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide }));
      ripple.rotation.x = -Math.PI / 2;
      ripple.position.set(lake.x, lake.level + 0.04 + i * 0.002, lake.z);
      scene.add(ripple);
      ripples.push({ mesh: ripple, radius: lake.radius * 0.9, phase: i / 3 });
    }
  }

  for(const lake of lakes) {
    if(!lake.approach || lake.summit) continue;
    const points=[];
    for(let i=0;i<=24;i++) {
      const t=i/24*Math.max(0,(4.5-lake.radius*.9)/4.5),x=THREE.MathUtils.lerp(lake.approach.x,lake.x,t),z=THREE.MathUtils.lerp(lake.approach.z,lake.z,t);
      points.push(new THREE.Vector3(x,surfaceHeight(x,z)+.025,z));
    }
    const entry=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),32,.28,4,false),new THREE.MeshStandardMaterial({color:'#c9b490'}));
    scene.add(entry);
  }
  // A continuous spiral trail gives the climb a visible route to the summit.
  for (const route of levels) {
  const pathVertices = [], pathIndices = [];
  for (let i = 0; i <= 650; i++) {
    const progress = i / 650;
    for (const side of [-1, 1]) {
      const { x, z } = trailPoint(progress, side * route.width / 2, route);
      pathVertices.push(x, terrainHeight(x, z) + 0.045, z);
    }
    if (i < 650) { const a = i * 2; pathIndices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  }
  const pathGeometry = new THREE.BufferGeometry();
  pathGeometry.setAttribute('position', new THREE.Float32BufferAttribute(pathVertices, 3));
  pathGeometry.setIndex(pathIndices);
  pathGeometry.computeVertexNormals();
  const path = new THREE.Mesh(pathGeometry, new THREE.MeshStandardMaterial({ color: '#c9b490', side: THREE.DoubleSide, roughness: 1 }));
  path.receiveShadow = true;
  scene.add(path);
  const summit = new THREE.Group();
  summit.position.set(route.x+6, terrainHeight(route.x+6,route.z), route.z);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 2.2, 8), new THREE.MeshStandardMaterial({ color: '#5a4b47' }));
  pole.position.y = 1.1;
  summit.add(pole);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.55), new THREE.MeshStandardMaterial({ color: '#ef447c', side: THREE.DoubleSide }));
  flag.position.set(0.45, 1.85, 0);
  summit.add(flag);
  scene.add(summit);
  }
  const levelSigns = [];
  levels.forEach((route, index) => {
    const board = document.createElement('canvas');
    board.width = 1024; board.height = 320;
    const paint = board.getContext('2d');
    paint.fillStyle = '#694728';
    paint.beginPath(); paint.roundRect(0,0,1024,320,28); paint.fill();
    paint.strokeStyle = '#bd9460'; paint.lineWidth = 12;
    paint.strokeRect(14,14,996,292);
    paint.textAlign = 'center'; paint.textBaseline = 'middle';
    paint.fillStyle = ['#bce6a1','#ffe18c','#ffb0a0'][index];
    paint.font = 'bold 42px system-ui';
    paint.fillText(`LEVEL ${index+1} · ${route.difficulty.toUpperCase()}`,512,76);
    paint.fillStyle = '#fff9e7'; paint.font = 'bold 64px system-ui';
    paint.fillText(route.name,512,168);
    paint.font = '30px system-ui'; paint.fillText('Follow the sandy trail to the summit',512,249);
    const texture = new THREE.CanvasTexture(board); texture.colorSpace = THREE.SRGBColorSpace;
    for(const progress of [0,.32,.64,.91]) {
      const point = trailPoint(progress,-route.width/2-.7,route);
      const y = terrainHeight(point.x,point.z);
      const post = new THREE.Mesh(new THREE.CylinderGeometry(.09,.12,4,8),new THREE.MeshStandardMaterial({color:'#694728',roughness:1}));
      post.position.set(point.x,y+2,point.z);post.castShadow=true;scene.add(post);
      const sign = new THREE.Sprite(new THREE.SpriteMaterial({map:texture}));
      sign.position.set(point.x,y+4,point.z);sign.scale.set(4.4,1.375,1);
      sign.name=`Level ${index+1}: ${route.name} — ${route.difficulty}`;
      scene.add(sign);levelSigns.push(sign);
    }
  });
  let reachedSummit = false;
  const climbStatus = document.querySelector('#climb-status');

  // A seeded surface keeps the clearing consistent across visits.
  let seed = 417;
  function random() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }
  function rock(scale, x, z, color) {
    const geometry = new THREE.IcosahedronGeometry(1, 1);
    const position = geometry.attributes.position;
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i), y = position.getY(i), z = position.getZ(i);
      // Coordinate-based deformation preserves shared vertices between faces.
      const distortion = 1 + 0.13 * Math.sin(x * 7 + z * 4) * Math.cos(y * 8 - x * 3);
      position.setXYZ(i, x * distortion * 1.2, Math.max(-0.68, y * distortion) + 0.68, z * distortion);
    }
    geometry.computeVertexNormals();
    const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.96 }));
    mesh.scale.setScalar(scale);
    mesh.position.set(x, terrainHeight(x, z) + 0.015, z);
    mesh.rotation.y = random() * Math.PI;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    return mesh;
  }
  rock(1.8, 0, 0, '#7c837a');
  const character = new THREE.Group();
  scene.add(character);

  // A repeating painted pattern follows the snake's skin.
  const pattern = document.createElement('canvas');
  pattern.width = pattern.height = 512;
  const paint = pattern.getContext('2d');
  paint.fillStyle = '#ff8fb9';
  paint.fillRect(0, 0, 512, 512);
  for (let row = -1; row < 5; row++) {
    for (let column = -1; column < 5; column++) {
      const x = column * 128 + (row % 2 ? 64 : 0);
      const y = row * 128;
      paint.fillStyle = '#cf2348';
      paint.beginPath();
      paint.arc(x, y, 29, 0, Math.PI * 2);
      paint.fill();
      paint.strokeStyle = '#ffc5da';
      paint.lineWidth = 6;
      paint.beginPath();
      paint.arc(x, y, 38, 0, Math.PI * 2);
      paint.stroke();
    }
  }
  const texture = new THREE.CanvasTexture(pattern);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 1);
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const skin = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.65 });
  const head = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 24), skin);
  head.scale.set(0.43, 0.32, 0.58);
  head.castShadow = true;
  character.add(head);
  const eyeMaterial = new THREE.MeshStandardMaterial({ color: '#fff8ef', roughness: 0.5 });
  const darkMaterial = new THREE.MeshStandardMaterial({ color: '#3d1025', roughness: 0.55 });
  for (const x of [-0.26, 0.26]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.14, 20, 16), eyeMaterial);
    eye.position.set(x, 0.22, 0.25);
    character.add(eye);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.072, 16, 12), darkMaterial);
    pupil.position.set(x, 0.24, 0.365);
    character.add(pupil);
  }
  const tongue = new THREE.Group();
  const tongueMaterial = new THREE.MeshStandardMaterial({ color: '#db1744' });
  function tonguePart(points) {
    const mesh = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))), 8, 0.023, 6, false), tongueMaterial);
    tongue.add(mesh);
  }
  tonguePart([[0, 0, 0], [0, 0, 0.15], [0, 0, 0.3]]);
  for (const side of [-1, 1]) tonguePart([[0, 0, 0.3], [side * 0.06, 0, 0.39], [side * 0.1, 0, 0.45]]);
  tongue.position.set(0, -0.08, 0.5);
  character.add(tongue);

  // Reuse a single tube mesh; every ring follows the head's earlier path.
  const rings = 100, sides = 12;
  const bodyGeometry = new THREE.BufferGeometry();
  const bodyPositions = new Float32Array((rings + 1) * (sides + 1) * 3);
  const uvs = [], indices = [];
  for (let ring = 0; ring <= rings; ring++) {
    for (let side = 0; side <= sides; side++) {
      uvs.push(ring / rings, side / sides);
      if (ring < rings && side < sides) {
        const a = ring * (sides + 1) + side, b = a + sides + 1;
        indices.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
  }
  bodyGeometry.setAttribute('position', new THREE.BufferAttribute(bodyPositions, 3).setUsage(THREE.DynamicDrawUsage));
  bodyGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  bodyGeometry.setIndex(indices);
  const body = new THREE.Mesh(bodyGeometry, skin);
  body.castShadow = true;
  body.receiveShadow = true;
  body.frustumCulled = false;
  scene.add(body);
  const point = new THREE.Vector3(), ahead = new THREE.Vector3();
  const headPosition = new THREE.Vector3(Math.cos(0.7) * 4.1, 0.36, Math.sin(0.7) * 4.1);
  headPosition.y = terrainHeight(headPosition.x, headPosition.z) + 0.36;
  let heading = -0.7;
  const trail = [];
  for (let i = 0; i <= 200; i++) {
    const angle = 0.7 - i * 0.04 / 4.1;
    const x = Math.cos(angle) * 4.1, z = Math.sin(angle) * 4.1;
    trail.push(new THREE.Vector3(x, terrainHeight(x, z) + 0.36, z));
  }
  let viewingLake = false;
  const findLakeButton = document.querySelector('#find-lake');
  function returnToSnake() {
    viewingLake = false;
    findLakeButton.textContent = 'Show nearest lake';
  }
  findLakeButton.addEventListener('click', () => {
    viewingLake = !viewingLake;
    findLakeButton.textContent = viewingLake ? 'Back to snake' : 'Show nearest lake';
    const lake = nearestLake().lake;
    const target = viewingLake ? new THREE.Vector3(lake.x, lake.level, lake.z) : headPosition.clone();
    controls.target.copy(target);
    camera.position.copy(target).add(new THREE.Vector3(-7, 18, 12));
    controls.update();
  });
  document.querySelector('#reset').addEventListener('click', returnToSnake);
  let boostTime=0, boostCooldown=0;
  const boostButton=document.querySelector('#boost');
  function activateBoost() {
    if(paused || breakingTime>0 || boostCooldown>0 || thirst<10 || hydration<10 || poolAt(headPosition.x,headPosition.z) || document.querySelector('#finish-dialog').open) return;
    boostTime=3;boostCooldown=10;drinkingUntil=0;poolTarget=null;sound.effect('boost');updateBoost(0);
  }
  function updateBoost(delta) {
    boostTime=Math.max(0,boostTime-delta);boostCooldown=Math.max(0,boostCooldown-delta);
    boostButton.disabled=paused || breakingTime>0 || boostCooldown>0 || thirst<10 || hydration<10 || !!poolAt(headPosition.x,headPosition.z) || document.querySelector('#finish-dialog').open;
    const text=boostTime>0?`Turbo! ${Math.ceil(boostTime)}s`:boostCooldown>0?`Turbo recharging · ${Math.ceil(boostCooldown)}s`:'Turbo boost · Space';
    if(boostButton.textContent!==text)boostButton.textContent=text;
    skin.emissive.set(boostTime>0?'#ae2865':'#000000');skin.emissiveIntensity=boostTime>0?.35:0;
  }
  boostButton.addEventListener('click',activateBoost);
  let poolAccess = true, poolTarget = null, breakingTime = 0, wasSoaking = false;
  const shards = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(.14,0),new THREE.MeshStandardMaterial({color:'#ff8fb9'}),28);
  shards.visible=false;shards.frustumCulled=false;scene.add(shards);
  const breakOrigin=new THREE.Vector3(),shardDummy=new THREE.Object3D();
  function updateSkin(delta) {
    if(breakingTime>0) {
      breakingTime+=delta;
      for(let i=0;i<28;i++) {
        const angle=i*2.4,t=breakingTime;
        shardDummy.position.copy(breakOrigin).add(new THREE.Vector3(Math.cos(angle)*t*2,Math.sin(i)*t+1.5*t-2*t*t,Math.sin(angle)*t*2));
        shardDummy.rotation.set(t*i,t*2,0);shardDummy.scale.setScalar(Math.max(.05,1-t/1.6));shardDummy.updateMatrix();shards.setMatrixAt(i,shardDummy.matrix);
      }
      shards.instanceMatrix.needsUpdate=true;
      if(breakingTime>=1.6) startLevel(levels.indexOf(mountain));
      return;
    }
    thirst=Math.max(0,thirst-delta*.12*mountain.thirst);
    const soaking=poolAccess && !!poolAt(headPosition.x,headPosition.z);
    if(soaking&&!wasSoaking)sound.effect('splash');
    wasSoaking=soaking;
    if(soaking) hydration=Math.min(100,hydration+delta*24);
    else hydration=Math.max(0,hydration-delta*.35*mountain.thirst*appleDryingRate());
    skin.color.set('#ffffff').lerp(new THREE.Color('#a48f76'),(1-hydration/100)*.65);
    if(hydration<=0) {
      breakingTime=.001;boostTime=0;sound.effect('break');poolTarget=null;breakOrigin.copy(character.position);
      character.visible=false;body.visible=false;shards.visible=true;clearInput();
    }
  }
  let hydration = 100;
  let thirst = 100;
  let drinkingUntil = 0;
  const drinkButton = document.querySelector('#drink');
  const hydrationMeter = document.querySelector('#hydration');
  const waterHint = document.querySelector('#water-hint');
  const hydrationLabel = document.querySelector('#hydration-label');
  const sipButton = document.querySelector('#drink-water');
  const thirstMeter = document.querySelector('#thirst');
  const thirstLabel = document.querySelector('#thirst-label');
  function nearestLake() {
    return lakes.reduce((nearest, lake) => {
      const distance = Math.hypot(headPosition.x - lake.x, headPosition.z - lake.z) - lake.radius;
      return !nearest || distance < nearest.distance ? { lake, distance } : nearest;
    }, null);
  }
  function updateWaterUI() {
    const nearest = nearestLake();
    thirstMeter.value=thirst;
    thirstMeter.classList.toggle('low',thirst<25);
    thirstLabel.textContent=`Drinking water · ${Math.ceil(thirst)}%`;
    sipButton.disabled=paused || breakingTime>0 || !poolAccess || nearest.distance>1.8 || thirst>=100;
    hydrationMeter.value = hydration;
    hydrationLabel.textContent = `Skin moisture · ${Math.ceil(hydration)}%`;
    const onTrail = onTrailAt(headPosition.x, headPosition.z);
    drinkButton.disabled = paused || breakingTime>0 || !poolAccess || nearest.distance > 1.8 || !!poolAt(headPosition.x,headPosition.z);
    findLakeButton.disabled = false;
    const trailStatus = document.querySelector('#trail-status');
    const trailText = (onTrail || (poolAccess && onPoolPath(headPosition.x,headPosition.z))) ? 'On trail · normal water use' : 'Off trail · pools locked · 3× drying';
    if (trailStatus.textContent !== trailText) trailStatus.textContent = trailText;
    trailStatus.classList.toggle('off-trail', !onTrail);
    const hint = breakingTime>0 ? 'Too dry! Breaking apart… restarting level.' : !poolAccess ? 'Return to the trail to unlock pools.' : poolAt(headPosition.x,headPosition.z) ? 'Soaking in the pool… skin recovering!' : nearest.distance<=1.8 ? 'Drink · R, or enter pool · E' : `${hydration<25?'Skin is cracking! ':''}Pool · ${Math.ceil(nearest.distance)} m`;
    if (waterHint.textContent !== hint) waterHint.textContent = hint;
  }
  function drink() {
    if (paused || breakingTime>0 || !poolAccess || nearestLake().distance>1.8) return;
    poolTarget=nearestLake().lake;
    heading=Math.atan2(poolTarget.x-headPosition.x,poolTarget.z-headPosition.z);
  }

  drinkButton.addEventListener('click', drink);
  function drinkWater() {
    if(paused || breakingTime>0 || !poolAccess || nearestLake().distance>1.8 || thirst>=100) return;
    thirst=100;sound.effect('drink');drinkingUntil=snakeTime+1.2;poolTarget=null;updateWaterUI();
  }
  sipButton.addEventListener('click',drinkWater);
  const keys = new Set();
  const thumbstick = document.querySelector('#thumbstick');
  const stickKnob = thumbstick.querySelector('.stick-knob');
  const stick = { x: 0, y: 0, pointerId: null };
  function resetStick() {
    stick.x = stick.y = 0; stick.pointerId = null;
    stickKnob.style.transform = 'translate(0px, 0px)';
    thumbstick.classList.remove('active');
  }
  function moveStick(event) {
    const bounds = thumbstick.getBoundingClientRect();
    const dx = event.clientX - bounds.left - bounds.width / 2;
    const dy = event.clientY - bounds.top - bounds.height / 2;
    const distance = Math.hypot(dx, dy), travel = 38;
    const factor = distance > travel ? travel / distance : 1;
    stickKnob.style.transform = `translate(${dx * factor}px, ${dy * factor}px)`;
    const strength = Math.max(0, (Math.min(distance / travel, 1) - 0.12) / 0.88);
    stick.x = distance ? dx / distance * strength : 0;
    stick.y = distance ? -dy / distance * strength : 0;
  }
  thumbstick.addEventListener('pointerdown', event => {
    if (stick.pointerId !== null) return;
    event.preventDefault();
    stick.pointerId = event.pointerId;
    thumbstick.setPointerCapture(event.pointerId);
    thumbstick.classList.add('active');
    moveStick(event);
  });
  thumbstick.addEventListener('pointermove', event => {
    if (event.pointerId !== stick.pointerId) return;
    event.preventDefault(); moveStick(event);
  });
  for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    thumbstick.addEventListener(name, event => { if (event.pointerId === stick.pointerId) resetStick(); });
  }
  const keyDirections = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right' };
  addEventListener('keydown', event => {
    if (event.target instanceof HTMLSelectElement) return;
    if (event.code === 'Space' && !event.repeat && !(event.target instanceof HTMLButtonElement)) { event.preventDefault(); activateBoost(); return; }
    if (event.code === 'KeyR' && !event.repeat) { event.preventDefault(); drinkWater(); return; }
    if (event.code === 'KeyE' && !event.repeat) { event.preventDefault(); drink(); return; }
    if (!keyDirections[event.code] || event.ctrlKey || event.metaKey || event.altKey) return;
    event.preventDefault();
    keys.add(event.code);
  });
  addEventListener('keyup', event => keys.delete(event.code));
  function clearInput() { keys.clear(); resetStick(); }
  addEventListener('blur', clearInput);
  document.addEventListener('visibilitychange', clearInput);
  const forward = new THREE.Vector3(), right = new THREE.Vector3(), desired = new THREE.Vector3();
  function steerSnake(delta, time) {
    if (breakingTime>0 || time<drinkingUntil) return;
    const held = new Set([...keys].map(key => keyDirections[key]));
    const horizontal = THREE.MathUtils.clamp(Number(held.has('right')) - Number(held.has('left')) + stick.x, -1, 1);
    const vertical = THREE.MathUtils.clamp(Number(held.has('up')) - Number(held.has('down')) + stick.y, -1, 1);
    if(horizontal || vertical) poolTarget=null;
    if(poolTarget && Math.hypot(headPosition.x-poolTarget.x,headPosition.z-poolTarget.z)<poolTarget.radius*.65) poolTarget=null;
    if (!horizontal && !vertical && !poolTarget && boostTime<=0) return;
    if (viewingLake) returnToSnake();
    camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();
    right.set(-forward.z, 0, forward.x);
    desired.copy(forward).multiplyScalar(vertical).addScaledVector(right, horizontal).normalize();
    if(!horizontal && !vertical && !poolTarget && boostTime>0) desired.set(Math.sin(heading),0,Math.cos(heading));
    if(poolTarget) desired.set(poolTarget.x-headPosition.x,0,poolTarget.z-headPosition.z).normalize();
    const hazards=obstacles.effects(headPosition.x,headPosition.z,mountain,rain.visible);
    const targetHeading = Math.atan2(desired.x, desired.z) + ((horizontal || vertical || poolTarget) ? Math.sin(time * 7) * 0.12 : 0);
    const difference = Math.atan2(Math.sin(targetHeading - heading), Math.cos(targetHeading - heading));
    heading += THREE.MathUtils.clamp(difference, -hazards.turn * delta, hazards.turn * delta);
    const slope = (terrainHeight(headPosition.x + Math.sin(heading) * 0.15, headPosition.z + Math.cos(heading) * 0.15) - terrainHeight(headPosition.x, headPosition.z)) / 0.15;
    const inputStrength = poolTarget || boostTime>0 ? 1 : Math.min(1, Math.hypot(horizontal, vertical));
    const distance = 2.8 * foodSpeed() * hazards.speed * (boostTime>0?hazards.boost:1) * inputStrength * (thirst <= 0 ? 0.65 : 1) * delta / Math.sqrt(1 + slope * slope);
    const steps = Math.max(1, Math.ceil(distance / 0.035));
    for (let step = 0; step < steps; step++) {
      const x = headPosition.x + Math.sin(heading) * distance / steps + hazards.slipX * delta / steps;
      const z = headPosition.z + Math.cos(heading) * distance / steps + hazards.slipZ * delta / steps;
      if(!obstacles.canMove(x,z,mountain)) break;
      const radius = Math.hypot(x, z);
      const onTrail = onTrailAt(x, z);
      const safePath=onTrail || onPoolPath(x,z);
      if(lakes.some(lake=>Math.hypot(x-lake.x,z-lake.z)<lake.radius+.45) && !(poolAccess && safePath)) break;
      if(onTrail) poolAccess=true;
      else if(!safePath) {poolAccess=false;poolTarget=null;}
      // The original boulder remains solid; the mountain itself is walkable.
      if (radius < 2.8 || Math.abs(x) > 108 || Math.abs(z) > 108) break;
      thirst=Math.max(0,thirst-distance/steps*mountain.thirst*.45);
      if(!poolAt(x,z)) hydration = Math.max(0, hydration - distance / steps * mountain.thirst * appleDryingRate() * (boostTime>0?1.4:1) * (safePath ? 1 : 3));
      headPosition.set(x, surfaceHeight(x, z) + 0.36, z);
      collectApples();
      trail.unshift(headPosition.clone());
    }
    // Retain enough distance for the whole body even at high frame rates.
    let length = 0;
    for (let i = 1; i < trail.length; i++) {
      length += trail[i].distanceTo(trail[i - 1]);
      if (length > 6+Math.min(applesEaten,12)*.25) { trail.length = i + 1; break; }
    }
  }
  function moveSnake(time) {
    const size=growthSize();
    character.scale.setScalar(size);
    character.position.copy(headPosition);
    character.position.y = surfaceHeight(headPosition.x, headPosition.z) + 0.48*size;
    const frontHeight = terrainHeight(headPosition.x + Math.sin(heading) * 0.3, headPosition.z + Math.cos(heading) * 0.3);
    const backHeight = terrainHeight(headPosition.x - Math.sin(heading) * 0.3, headPosition.z - Math.cos(heading) * 0.3);
    character.rotation.order = 'YXZ';
    character.rotation.set(-Math.atan2(frontHeight - backHeight, 0.6) + (time < drinkingUntil ? 0.22 + Math.sin(time * 12) * 0.06 : 0), heading, 0);
    const altitude = terrainHeight(headPosition.x, headPosition.z);
    const finishPool = poolAt(headPosition.x, headPosition.z);
    if ((finishPool?.summit && finishPool.route === mountain) || Math.hypot(headPosition.x-mountain.x-6, headPosition.z-mountain.z)<1.4) {
      if (!reachedSummit) {
        reachedSummit=true; mountain.completed=true;sound.effect('finish');boostTime=0;
        clearInput();poolTarget=null;
        document.querySelector('#choose-level').hidden=false;
        document.querySelector('#finish-title').textContent=`${mountain.name} complete!`;
        document.querySelector('#finish-dialog').showModal();
      }
      const option = document.querySelector(`#level-select option[value="${levels.indexOf(mountain)}"]`);
      if (option && !option.textContent.endsWith('✓')) option.textContent += ' ✓';
    }
    for (const lake of lakes) {
      if (Math.hypot(headPosition.x - lake.x, headPosition.z - lake.z) < lake.radius + 2) lake.visited = true;
    }
    const lakeCount = lakes.filter(lake => lake.visited).length;
    const lakeStatus = document.querySelector('#lake-status');
    const lakeText = `Lakes discovered · ${lakeCount} / ${lakes.length}`;
    if (lakeStatus.textContent !== lakeText) lakeStatus.textContent = lakeText;
    const status = reachedSummit ? `${mountain.name} complete! Choose another route ✦` : `Climb to the pink flag · ${Math.round(altitude / mountain.height * 100)}% elevation`;
    if (climbStatus.textContent !== status) climbStatus.textContent = status;
    tongue.scale.z = 0.65 + 0.35 * Math.sin(time * 12);
    tongue.visible = Math.sin(time * 2) > 0.25;
    let trailIndex = 0, covered = 0;
    for (let ring = 0; ring <= rings; ring++) {
      const progress = ring / rings;
      const distance = progress * (5+Math.min(applesEaten,12)*.25);
      while (trailIndex < trail.length - 2 && covered + trail[trailIndex].distanceTo(trail[trailIndex + 1]) < distance) {
        covered += trail[trailIndex].distanceTo(trail[trailIndex + 1]);
        trailIndex++;
      }
      ahead.copy(trail[trailIndex]);
      const behind = trail[trailIndex + 1];
      const segmentLength = Math.max(ahead.distanceTo(behind), 0.00001);
      point.copy(ahead).lerp(behind, THREE.MathUtils.clamp((distance - covered) / segmentLength, 0, 1));
      const dx = ahead.x - behind.x, dz = ahead.z - behind.z;
      const length = Math.max(Math.hypot(dx, dz), 0.00001);
      const radius = (0.29 * Math.pow(1 - progress, 0.55) + 0.008)*size;
      point.y = radius + 0.055;
      for (let side = 0; side <= sides; side++) {
        const angle = side / sides * Math.PI * 2;
        const offset = (ring * (sides + 1) + side) * 3;
        bodyPositions[offset] = point.x + dz / length * Math.cos(angle) * radius;
        bodyPositions[offset + 2] = point.z - dx / length * Math.cos(angle) * radius;
        bodyPositions[offset + 1] = surfaceHeight(bodyPositions[offset], bodyPositions[offset + 2]) + point.y + Math.sin(angle) * radius;
      }
    }
    bodyGeometry.attributes.position.needsUpdate = true;
    bodyGeometry.computeVertexNormals();
  }
  let paused = false;
  const pauseButton = document.querySelector('#pause');
  pauseButton.addEventListener('click', () => {
    paused = !paused;
    pauseButton.textContent = paused ? 'Resume snake' : 'Pause snake';
    pauseButton.setAttribute('aria-pressed', String(paused));
  });
  const clock = new THREE.Clock();
  let snakeTime = 0;
  moveSnake(0);
  updateWaterUI();
  for (let i = 0; i < 28; i++) {
    const angle = random() * Math.PI * 2;
    const radius = 2.8 + random() * 9;
    rock(0.06 + random() * 0.2, Math.cos(angle) * radius, Math.sin(angle) * radius, '#8d9180');
  }
  // Instancing keeps the rainforest dense without hundreds of draw calls.
  const forestPoints = [];
  const routeSamples = levels.flatMap(route => Array.from({ length: 220 }, (_, i) => trailPoint(i / 219, 0, route)));
  for (let attempt = 0; attempt < 5000 && forestPoints.length < 650; attempt++) {
    const x = random() * 210 - 105, z = random() * 210 - 105;
    if (Math.hypot(x, z) < 7 || lakes.some(lake => Math.hypot(x-lake.x,z-lake.z)<lake.radius+2.4)) continue;
    if (routeSamples.some(point => Math.hypot(x-point.x,z-point.z)<3.8)) continue;
    if (levels.some(peak => Math.hypot(x-peak.x,z-peak.z)<3)) continue;
    forestPoints.push({x,z,height:3.5+random()*4});
  }
  const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.16,0.3,1,6),new THREE.MeshStandardMaterial({color:'#584632',roughness:1}),forestPoints.length);
  const crowns = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,1),new THREE.MeshStandardMaterial({color:'#217346',roughness:1,flatShading:true}),forestPoints.length*2);
  const dummy = new THREE.Object3D();
  forestPoints.forEach((tree,i)=>{
    const y=terrainHeight(tree.x,tree.z);
    dummy.position.set(tree.x,y+tree.height/2,tree.z);dummy.scale.set(1,tree.height,1);dummy.updateMatrix();trunks.setMatrixAt(i,dummy.matrix);
    for(let layer=0;layer<2;layer++) {
      dummy.position.set(tree.x+(layer?0.6:0),y+tree.height-0.5+layer,tree.z);
      dummy.scale.set(2.1-layer*.5,1.8,2.1-layer*.4);dummy.updateMatrix();crowns.setMatrixAt(i*2+layer,dummy.matrix);
      crowns.setColorAt(i*2+layer,new THREE.Color().setHSL(.3+random()*.08,.4,.22+random()*.1));
    }
  });
  trunks.castShadow=true;crowns.castShadow=true;crowns.receiveShadow=true;
  scene.add(trunks,crowns);

  // Local rain follows the player and alternates with longer dry spells.
  let weatherTime = 0;
  const rainCount = 650, rainPositions = new Float32Array(rainCount*6);
  const rainSeeds = Array.from({length:rainCount},()=>({x:random()*34-17,z:random()*34-17,y:random()*24}));
  const rainGeometry = new THREE.BufferGeometry();
  rainGeometry.setAttribute('position',new THREE.BufferAttribute(rainPositions,3).setUsage(THREE.DynamicDrawUsage));
  const rain = new THREE.LineSegments(rainGeometry,new THREE.LineBasicMaterial({color:'#c9e7ef',transparent:true,opacity:.65,depthWrite:false}));
  rain.frustumCulled=false;scene.add(rain);
  const weatherLabel=document.querySelector('#weather-status');
  function updateWeather(delta) {
    weatherTime+=delta;
    const cycle=weatherTime%70;
    const raining=cycle>=20 && cycle<38;
    rain.visible=raining;
    const label=raining?'Rain shower · the rainforest is drinking':'Rainforest · clear skies';
    if(weatherLabel.textContent!==label) weatherLabel.textContent=label;
    const strength=raining?Math.min(1,(cycle-20)/2,(38-cycle)/2):0;
    sunlight.intensity=3.5-strength*1.6;
    scene.fog.far=160-strength*65;
    scene.background.set('#9bb7a5').lerp(new THREE.Color('#718c86'),strength);
    scene.fog.color.copy(scene.background);
    rain.material.opacity=.65*strength;
    if(raining) {
      for(let i=0;i<rainCount;i++) {
        const drop=rainSeeds[i],offset=i*6;
        const x=headPosition.x+drop.x,z=headPosition.z+drop.z;
        const y=terrainHeight(x,z)+((drop.y-weatherTime*14)%24+24)%24+0.1;
        rainPositions.set([x,y,z,x-.12,y+.85,z+.08],offset);
      }
      rainGeometry.attributes.position.needsUpdate=true;
    }
  }
  function startLevel(index) {
    document.querySelector('#finish-dialog').close();
    document.querySelector('#choose-level').hidden=true;
    document.querySelector('#level-select').value=String(index);
    applesEaten=0;food.reset(levels[index]);
    obstacles.reset();hurtMessageUntil=0;
    boostTime=0;boostCooldown=0;
    wasSoaking=false;poolAccess=true;poolTarget=null;breakingTime=0;character.visible=true;body.visible=true;shards.visible=false;skin.color.set(0xffffff);
    mountain=levels[index];reachedSummit=false;hydration=100;thirst=100;drinkingUntil=0;
    clearInput();returnToSnake();
    const start=trailPoint(0),next=trailPoint(.005);
    heading=Math.atan2(next.x-start.x,next.z-start.z);
    headPosition.set(start.x,terrainHeight(start.x,start.z)+.36,start.z);
    trail.length=0;
    for(let i=0;i<=220;i++) {
      const point=trailPoint(-i*.0007);
      trail.push(new THREE.Vector3(point.x,terrainHeight(point.x,point.z)+.36,point.z));
    }
    cameraAnchor.copy(headPosition);resetView();moveSnake(snakeTime);collectApples();updateWaterUI();
    document.querySelector('#level-description').textContent=[
      'Easy · 14 m · wide trail with fallen logs',
      'Medium · 34 m · mud patches and thorny vines',
      'Hard · 48 m · falling rocks and rain-slick ledges'
    ][index];
  }
  const finishDialog=document.querySelector('#finish-dialog');
  document.querySelectorAll('[data-next-level]').forEach(button=>button.addEventListener('click',()=>{
    startLevel(Number(button.dataset.nextLevel));titlePanel.hidden=true;
  }));
  document.querySelector('#keep-soaking').addEventListener('click',()=>finishDialog.close());
  document.querySelector('#choose-level').addEventListener('click',()=>finishDialog.showModal());
  document.querySelector('#level-select').addEventListener('change',event=>{ startLevel(Number(event.target.value)); titlePanel.hidden = true; event.target.blur(); });
  startLevel(0);updateWeather(0);
  const grassMaterial = new THREE.MeshStandardMaterial({ color: '#398340', side: THREE.DoubleSide, roughness: 1 });
  const grassGeometry = new THREE.BufferGeometry();
  const vertices = [];
  for (let i = 0; i < 1500; i++) {
    const angle = random() * Math.PI * 2;
    const radius = 2.5 + Math.sqrt(random()) * 12;
    const x = Math.cos(angle) * radius, z = Math.sin(angle) * radius;
    const height = 0.1 + random() * 0.24;
    const width = 0.025 + random() * 0.025;
    const direction = random() * Math.PI;
    const dx = Math.cos(direction) * width, dz = Math.sin(direction) * width;
    const y = terrainHeight(x, z);
    if (y < mountain.height * 0.6875) vertices.push(x - dx, y + 0.01, z - dz, x + dx, y + 0.01, z + dz, x + 0.06, y + height, z);
  }
  grassGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  grassGeometry.computeVertexNormals();
  const grass = new THREE.Mesh(grassGeometry, grassMaterial);
  grass.receiveShadow = true;
  scene.add(grass);
  const animateScenery=addScenery(scene,levels,terrainHeight,lakes);
  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  });
  renderer.setAnimationLoop(() => {
    const delta = Math.min(clock.getDelta(), 0.05);
    if (!paused && !document.querySelector('#finish-dialog').open) { updateWeather(delta);updateBoost(delta);obstacles.update(delta); snakeTime += delta; steerSnake(delta, snakeTime);
      if(!breakingTime){const damage=obstacles.damageAt(headPosition.x,headPosition.z,mountain);if(damage){hydration=Math.max(0,hydration-damage);hurtMessageUntil=snakeTime+1.5;sound.effect('hit');}}
      updateSkin(delta); if(!breakingTime) moveSnake(snakeTime); }
    for (const ripple of ripples) {
      const phase = (snakeTime * 0.22 + ripple.phase) % 1;
      ripple.mesh.scale.setScalar(ripple.radius * (0.15 + phase * 0.85));
      ripple.mesh.material.opacity = (1 - phase) * 0.2;
    }
    const hazardText=snakeTime<hurtMessageUntil?'Ouch! Skin damaged — find a pool':obstacles.effects(headPosition.x,headPosition.z,mountain,rain.visible).message;
    hazardStatus.hidden=!hazardText;
    if(hazardStatus.textContent!==hazardText)hazardStatus.textContent=hazardText;
    updateBoost(0);
    sound.update({raining:rain.visible,nearWater:nearestLake().distance<8,paused:paused||document.querySelector('#finish-dialog').open});
    animateScenery(snakeTime,headPosition);food.update(snakeTime);
    updateWaterUI();
    const followTarget = headPosition.clone().add(new THREE.Vector3(0, 0.7, 0));
    const nearest = nearestLake();
    if (viewingLake) {
      followTarget.set(nearest.lake.x, nearest.lake.level + 0.5, nearest.lake.z);
    } else if (nearest.distance < 12) {
      // Frame both the snake and nearby water instead of cropping the lake on phones.
      const weight = 0.35 * (1 - THREE.MathUtils.smoothstep(nearest.distance, 6, 12));
      followTarget.lerp(new THREE.Vector3(nearest.lake.x, nearest.lake.level + 0.7, nearest.lake.z), weight);
    }
    const oldTarget = controls.target.clone();
    controls.target.lerp(followTarget, 1 - Math.exp(-delta * 4));
    camera.position.add(controls.target.clone().sub(oldTarget));
    cameraAnchor.copy(followTarget);
    // Keep intervening ridges from hiding the snake, not just the camera itself.
    for (let step = 1; step <= 16; step++) {
      const fraction = step / 16;
      const x = THREE.MathUtils.lerp(controls.target.x, camera.position.x, fraction);
      const z = THREE.MathUtils.lerp(controls.target.z, camera.position.z, fraction);
      const requiredHeight = controls.target.y + (terrainHeight(x, z) + 0.6 - controls.target.y) / fraction;
      camera.position.y = Math.max(camera.position.y, requiredHeight);
    }
    camera.position.y = Math.max(camera.position.y, terrainHeight(camera.position.x, camera.position.z) + 1.5);
    controls.update();
    renderer.render(scene, camera);
  });
} catch (error) {
  console.error(error);
  const message = document.querySelector('#error');
  message.hidden = false;
  message.textContent = 'The 3D scene could not start. Please use a browser with WebGL enabled.';
}
