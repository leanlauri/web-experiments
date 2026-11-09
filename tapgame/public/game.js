import {createWorld,tick,stickVector} from './world.js';
import {createShop} from './scene.js';
const $=id=>document.getElementById(id),keys=new Set();
let world=createWorld(),shop,previous=performance.now(),pointerWash=null,stick={x:0,z:0,pointer:null},lastUI='';
const icons=['▤','✎','✒','♬'];
function clearInput(){keys.clear();pointerWash=null;stick={x:0,z:0,pointer:null};$('stick-knob').style.transform='translate(0px,0px)';$('wash').classList.remove('active')}
function overlay(title,copy,button){clearInput();$('overlay').hidden=false;document.querySelector('.welcome h1').textContent=title;$('overlay-copy').textContent=copy;$('start').textContent=button;$('start').disabled=false;$('pause').disabled=true}
function start(){if(world.phase!=='paused')world=createWorld();world.phase='playing';clearInput();$('overlay').hidden=true;$('pause').disabled=false;lastUI='';previous=performance.now()}
function pause(){if(world.phase==='playing'){world.phase='paused';overlay('A little breather.', 'The customers and their things will be here when you’re ready.','Keep washing')}else if(world.phase==='paused')start()}
function updateUI(){
 $('mission').textContent=world.message;const count=world.jobs.filter(j=>j.clean===1).length;$('count').textContent=`${count} / 4 washed`;
 const signature=world.jobs.map(j=>Math.round(j.clean*100)).join();if(signature!==lastUI){$('jobs').innerHTML=world.jobs.map((j,i)=>`<div class="job ${j.clean===1?'done':''}"><span class="job-icon">${icons[i]}</span><span>${j.name}<small>${j.customer}’s ${j.clean===1?'all clean!':'wash station'}</small></span><b>${j.clean===1?'✓':Math.round(j.clean*100)+'%'}</b></div>`).join('');lastUI=signature}
 $('suspicion-label').textContent=`SHOPKEEPER · ${world.suspicion>60?'SUSPICIOUS':world.suspicion>10?'WATCHING':'CALM'}`;$('suspicion-fill').style.width=`${world.suspicion}%`;
 $('target').hidden=world.active<0||world.phase!=='playing';if(world.active>=0){const j=world.jobs[world.active];$('target-label').textContent=`${j.customer}’s ${j.name.toLowerCase()} · ${Math.round(j.clean*100)}%`;$('target-fill').style.width=`${j.clean*100}%`}
 $('wash').classList.toggle('active',world.spraying&&world.phase==='playing');
}
$('start').addEventListener('click',start);$('pause').addEventListener('click',pause);$('view').addEventListener('click',()=>{$('view').textContent=shop.toggleView()?'Follow Tappy':'View shop'});
window.addEventListener('keydown',e=>{const k=e.key.toLowerCase();if(['arrowup','arrowdown','arrowleft','arrowright',' '].includes(k))e.preventDefault();if(!e.repeat&&(k==='p'||k==='escape'))pause();else keys.add(k)});
window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
window.addEventListener('blur',()=>{clearInput();if(world.phase==='playing')pause()});document.addEventListener('visibilitychange',()=>{if(document.hidden){clearInput();if(world.phase==='playing')pause()}});
function moveStick(e){const r=$('thumbstick').getBoundingClientRect(),v=stickVector(e.clientX-r.left-r.width/2,e.clientY-r.top-r.height/2,r.width*.3);Object.assign(stick,{x:v.x,z:v.z});$('stick-knob').style.transform=`translate(${v.px}px,${v.py}px)`}
$('thumbstick').addEventListener('pointerdown',e=>{e.preventDefault();if(world.phase!=='playing'||stick.pointer!==null)return;stick.pointer=e.pointerId;$('thumbstick').setPointerCapture(e.pointerId);moveStick(e)});
$('thumbstick').addEventListener('pointermove',e=>{if(e.pointerId===stick.pointer)moveStick(e)});
for(const event of ['pointerup','pointercancel','lostpointercapture'])$('thumbstick').addEventListener(event,e=>{if(e.pointerId===stick.pointer){stick={x:0,z:0,pointer:null};$('stick-knob').style.transform='translate(0px,0px)'}});
$('wash').addEventListener('pointerdown',e=>{e.preventDefault();if(world.phase!=='playing'||pointerWash!==null)return;pointerWash=e.pointerId;$('wash').setPointerCapture(e.pointerId)});
for(const event of ['pointerup','pointercancel','lostpointercapture'])$('wash').addEventListener(event,e=>{if(pointerWash===e.pointerId)pointerWash=null});
$('game').addEventListener('webglcontextlost',e=>{e.preventDefault();if(world.phase==='playing')pause();overlay('The 3D view stopped.', 'Reload the page to reopen the shop.','Reload shop');$('start').onclick=()=>location.reload()});
function frame(now){const dt=Math.min((now-previous)/1000,.05);previous=now;const before=world.phase;
 const x=stick.pointer!==null?stick.x:Number(keys.has('d')||keys.has('arrowright'))-Number(keys.has('a')||keys.has('arrowleft'));
 const z=stick.pointer!==null?stick.z:Number(keys.has('s')||keys.has('arrowdown'))-Number(keys.has('w')||keys.has('arrowup'));
 tick(world,dt,{x,z,spray:keys.has(' ')||pointerWash!==null});
 if(before==='playing'&&world.phase==='won')overlay('A lovely clean!',world.message,'Wash again');
 if(before==='playing'&&world.phase==='lost')overlay('A little too splashy.',world.message,'Try again');
 updateUI();shop.render(world,dt);requestAnimationFrame(frame);
}
try{shop=createShop($('game'));$('start').disabled=false;$('start').textContent='Open the wash shop →';$('load-status').textContent='Drag the thumbstick or use arrow keys / WASD';updateUI();requestAnimationFrame(frame);document.body.dataset.ready='true'}catch(error){console.error(error);$('load-status').textContent='This shop needs WebGL. Enable graphics acceleration in your browser and reload.';$('start').textContent='3D graphics unavailable'}
