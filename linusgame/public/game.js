'use strict';
(() => {
const canvas=document.querySelector('canvas'),ctx=canvas.getContext('2d');
const seedLabel=document.querySelector('#seeds'),message=document.querySelector('#message'),toast=document.querySelector('#toast');
const WORLD=3400,GROUND=490,HEIGHT=650;
const MUM_SCALE=1.5;
const gaps=[{x:940,w:95},{x:1670,w:100},{x:2360,w:100}];
const logs=[{x:365,y:454,w:75,h:36},{x:1210,y:452,w:88,h:38},{x:1940,y:450,w:85,h:40},{x:2850,y:454,w:85,h:36}];
const groundPieces=[];let edge=0;for(const gap of gaps){groundPieces.push({x:edge,y:GROUND,w:gap.x-edge,h:180});edge=gap.x+gap.w;}groundPieces.push({x:edge,y:GROUND,w:WORLD-edge,h:180});
let width=1000,height=650,scale=1,camera=0,time=0,last=0,toastTime=0,started=false,won=false,playDate=false,partyTime=0;
const held=new Set(),touchHeld=new Map();let jumpQueued=false,spinQueued=false;
const platforms=[...groundPieces,...logs,{x:470,y:400,w:190,h:23},{x:790,y:330,w:160,h:23},{x:1100,y:405,w:190,h:23},{x:1450,y:345,w:190,h:23},{x:1800,y:400,w:220,h:23},{x:2160,y:330,w:180,h:23},{x:2490,y:400,w:190,h:23}];
const seedPositions=[[290,440],[520,355],[620,355],[835,285],[1150,360],[1510,300],[1600,300],[1850,355],[2220,285],[2540,355],[2800,440],[3090,430]];
let seeds,brambles,particles,player,snakes,friends,trail;
const friendColors=['#b9e6db','#cfccfa','#ffe5ac','#bbd9ff'];
function pose(){return {t:time,x:player.x,y:player.y,face:player.face,ground:player.ground,vx:player.vx,spin:player.spin};}
function resetTrail(){trail=[pose()];for(const friend of friends){friend.released=time;if(!friend.home)Object.assign(friend,pose());}}
function rescueFriend(snake){const friend={...pose(),id:friends.length,color:friendColors[friends.length],released:time,emerge:.8,home:false};friends.push(friend);burst(snake.x,snake.y-30,friend.color,26);document.querySelector('#friends').textContent=`${friends.length}/4 friends freed`;}
function updateFriends(dt){
trail.push(pose());while(trail.length>2&&trail[1].t<time-3)trail.shift();
for(const friend of friends){friend.emerge=Math.max(0,friend.emerge-dt);if(friend.home)continue;
// Replay the actual path and poses, so jumps and spins follow in a little procession.
const target=Math.max(friend.released,time-.38*(friend.id+1));let before=trail[0],after=trail[trail.length-1];
for(let i=1;i<trail.length;i++){if(trail[i].t>=target){before=trail[i-1];after=trail[i];break;}}
const mix=Math.max(0,Math.min(1,(target-before.t)/(after.t-before.t||1)));
friend.x=before.x+(after.x-before.x)*mix;friend.y=before.y+(after.y-before.y)*mix;
for(const key of ['face','ground','vx','spin'])friend[key]=before[key];
if(friend.x>WORLD-230&&friend.y>GROUND-110){friend.home=true;burst(friend.x,friend.y,friend.color,12);}
}
}
let hearts=3,invincible=0,poison=0,checkpoint=160,delivered=0;
const healthLabel=document.querySelector("#health");
function stats(){healthLabel.textContent="♥".repeat(hearts)+"♡".repeat(3-hearts);}
function hurt(fall=false){if(invincible>0&&!fall)return;hearts--;poison=fall?0:2.2;invincible=2.5;burst(player.x,player.y,"#bd8dd3");if(hearts<=0){hearts=3;notify("Mum’s magic gives you three new hearts. Try again!");}else notify(fall?"Mind the crack! Jump across to stay safe.":"Poisonous bite! Spin before the snake gets close.");if(fall||hearts===3){player.x=checkpoint;player.y=GROUND-29;player.vy=0;player.vx=0;player.ground=true;poison=0;resetTrail();}else{player.vy=-240;player.x=Math.max(28,player.x-player.face*45);}stats();}
function reset(){friends=[];trail=[];player={x:160,y:GROUND-29,vx:0,vy:0,face:1,ground:true,spin:0,cooldown:0,coyote:0,buffer:0};seeds=seedPositions.map(([x,y])=>({x,y,taken:false}));brambles=[720,1350,2070,2740].map(x=>({x,y:GROUND-18,hp:true}));snakes=[580,1380,2110,2730].map((x,i)=>({x,home:x,y:GROUND-15,dir:i%2?1:-1,alive:true,carried:false,homeSafe:false,eaten:false,meal:0}));hearts=3;invincible=0;poison=0;checkpoint=160;delivered=0;document.querySelector("#snakes").textContent="0/4 snakes home";stats();resetTrail();document.querySelector("#friends").textContent="0/4 friends freed";particles=[];camera=0;jumpQueued=false;spinQueued=false;won=false;playDate=false;partyTime=0;started=false;message.classList.remove('hidden');seedLabel.textContent='0';toast.classList.remove('visible');held.clear();touchHeld.clear();document.querySelectorAll('.active').forEach(b=>b.classList.remove('active'));}
function resize(){const rect=canvas.getBoundingClientRect();width=rect.width;height=rect.height;const dpr=Math.min(window.devicePixelRatio||1,2);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);scale=height/HEIGHT;ctx.setTransform(dpr,0,0,dpr,0,0);}
window.addEventListener('resize',resize);resize();reset();
const keys={ArrowLeft:'left',KeyA:'left',ArrowRight:'right',KeyD:'right',Space:'jump',ArrowUp:'jump',KeyW:'jump',KeyX:'spin',KeyJ:'spin'};
window.addEventListener('keydown',e=>{if(!keys[e.code])return;e.preventDefault();if(!held.has(e.code)&&!e.repeat){if(keys[e.code]==='jump')jumpQueued=true;if(keys[e.code]==='spin')spinQueued=true;}held.add(e.code);});
window.addEventListener('keyup',e=>held.delete(e.code));
window.addEventListener('blur',()=>{held.clear();touchHeld.clear();document.querySelectorAll('.active').forEach(b=>b.classList.remove('active'));});
for(const button of document.querySelectorAll('[data-control]')){button.addEventListener('pointerdown',e=>{e.preventDefault();button.setPointerCapture(e.pointerId);touchHeld.set(e.pointerId,button.dataset.control);button.classList.add('active');if(button.dataset.control==='jump')jumpQueued=true;if(button.dataset.control==='spin')spinQueued=true;});const release=e=>{touchHeld.delete(e.pointerId);if(![...touchHeld.values()].includes(button.dataset.control))button.classList.remove('active');};button.addEventListener('pointerup',release);button.addEventListener('pointercancel',release);button.addEventListener('lostpointercapture',release);button.addEventListener('contextmenu',e=>e.preventDefault());}
document.querySelector('#restart').addEventListener('click',reset);
function down(action){return [...held].some(code=>keys[code]===action)||[...touchHeld.values()].includes(action);}
function burst(x,y,color,n=14){for(let i=0;i<n;i++){const a=Math.random()*Math.PI*2,s=30+Math.random()*130;particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-50,life:.6+Math.random()*.4,color});}}
function notify(text){toast.textContent=text;toast.classList.add('visible');toastTime=4;}
function update(dt){time+=dt;if(playDate)partyTime+=dt;invincible=Math.max(0,invincible-dt);poison=Math.max(0,poison-dt);toastTime-=dt;if(toastTime<=0)toast.classList.remove('visible');const p=player;const move=Number(down('right'))-Number(down('left'));if((move||jumpQueued||spinQueued)&&!started){started=true;message.classList.add('hidden');}p.vx+=(move*(poison>0?165:245)-p.vx)*Math.min(1,dt*13);if(move)p.face=move;p.cooldown=Math.max(0,p.cooldown-dt);p.spin=Math.max(0,p.spin-dt);p.coyote=p.ground?.12:Math.max(0,p.coyote-dt);p.buffer=jumpQueued?.14:Math.max(0,p.buffer-dt);if(p.buffer>0&&p.coyote>0){p.vy=-530;p.ground=false;p.coyote=0;p.buffer=0;burst(p.x,p.y+26,'#d8e6ba',8);}if(spinQueued&&p.cooldown<=0){p.spin=.48;p.cooldown=.7;burst(p.x,p.y,'#f8d5df',9);}jumpQueued=false;spinQueued=false;
const previousBottom=p.y+29;p.vy+=1350*dt;p.x=Math.max(28,Math.min(WORLD-28,p.x+p.vx*dt));p.y+=p.vy*dt;p.ground=false;for(const platform of platforms){if(p.vy>=0&&previousBottom<=platform.y+1&&p.y+29>=platform.y&&p.x+20>platform.x&&p.x-20<platform.x+platform.w){p.y=platform.y-29;p.vy=0;p.ground=true;}}
// Logs have solid sides as well as jumpable tops.
for(const log of logs){if(p.y+27>log.y+3&&p.y-24<log.y+log.h&&p.x+20>log.x&&p.x-20<log.x+log.w){p.x=p.x<log.x+log.w/2?log.x-20:log.x+log.w+20;p.vx=0;}}
if(p.ground&&p.y===GROUND-29&&!gaps.some(g=>p.x>g.x-60&&p.x<g.x+g.w+60)&&!snakes.some(s=>s.alive&&Math.abs(s.x-p.x)<150))checkpoint=p.x;
if(p.y>HEIGHT+70)hurt(true);
for(const snake of snakes){if(!snake.alive)continue;snake.x+=snake.dir*48*dt;if(snake.x<snake.home-65||snake.x>snake.home+65)snake.dir*=-1;
if(Math.hypot(p.x-snake.x,p.y-snake.y)<(p.spin>0?83:43)){if(p.spin>0){snake.alive=false;snake.carried=true;rescueFriend(snake);burst(snake.x,snake.y,"#e86e69",22);notify("A friend’s soul is free! They’ll copy your moves. Bring everyone to Mum!");}else hurt();}}
for(const b of brambles){if(b.hp&&p.spin>0&&Math.hypot(p.x-b.x,p.y-b.y)<90){b.hp=false;burst(b.x,b.y,'#829858',22);}}
// Brambles are gentle obstacles: push back, without damage or losing progress.
for(const b of brambles){if(b.hp&&p.spin<=0&&Math.abs(p.x-b.x)<39&&Math.abs(p.y-b.y)<42){p.x=b.x+(p.x<b.x?-40:40);p.vx=0;if(toastTime<=0)notify('Press X or tap SPIN to clear the brambles!');}}
for(const s of seeds){if(!s.taken&&Math.hypot(p.x-s.x,p.y-s.y)<42){s.taken=true;burst(s.x,s.y,'#ffdb76');seedLabel.textContent=seeds.filter(s=>s.taken).length;}}
updateFriends(dt);
const inCave=p.x>WORLD-230&&p.y>GROUND-110;
if(inCave){const carrying=snakes.filter(s=>s.carried);if(carrying.length){for(const snake of carrying){snake.carried=false;snake.homeSafe=true;}delivered+=carrying.length;document.querySelector('#snakes').textContent=`${delivered}/4 snakes home`;notify('Welcome home! Wait for your friends, then share a snake supper with Mum.');burst(3230,430,'#ffd3df',26);}
for(const snake of snakes){if(snake.homeSafe&&!snake.eaten&&friends.every(f=>f.home)){snake.meal+=dt;if(snake.meal>=5){snake.eaten=true;burst(3240,475,'#ffe5ac',12);}}}
if(!playDate&&friends.length===4&&friends.every(f=>f.home)&&snakes.every(s=>s.eaten)){playDate=true;partyTime=0;notify('Play-date time! Your friends and all their mums are here. Jump, spin and play together!');toastTime=12;burst(3240,390,'#ffe5ac',45);}
const count=seeds.filter(s=>s.taken).length;if(!won&&count===12&&friends.length===4&&friends.every(f=>f.home)&&snakes.every(s=>s.eaten)){won=true;notify('All bones found, all friends home! Time for a cave play date with everyone’s mums! ♥');toastTime=12;}else if(!won&&!playDate&&toastTime<=0)notify(`Bones ${count}/12 · Friends home ${friends.filter(f=>f.home).length}/4. Mum has a place for everyone.`);
}

for(const q of particles){q.x+=q.vx*dt;q.y+=q.vy*dt;q.vy+=180*dt;q.life-=dt;}particles=particles.filter(q=>q.life>0);
const view=width/scale;camera+=(Math.max(0,Math.min(WORLD-view,p.x-view*.37))-camera)*Math.min(1,dt*5);
}
function ellipse(x,y,rx,ry,color){ctx.fillStyle=color;ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fill();}
function line(x1,y1,x2,y2,color,w=2){ctx.strokeStyle=color;ctx.lineWidth=w;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();}
function hill(x,y,r,color){ellipse(x,y,r,r*.48,color);}
function tree(x,y,size,shade){line(x,y,x-7*size,y-155*size,'#749a79',13*size);line(x,y-80*size,x+45*size,y-155*size,'#749a79',7*size);ellipse(x-20*size,y-180*size,67*size,68*size,shade);ellipse(x+32*size,y-162*size,64*size,57*size,shade);ellipse(x-50*size,y-140*size,53*size,50*size,shade);}
function flower(x,y,s=1){line(x,y,x,y-17*s,'#6f9461',2);ellipse(x+4*s,y-6*s,6*s,2*s,'#85ab6c');for(let i=0;i<5;i++){let a=i*Math.PI*2/5;ellipse(x+Math.cos(a)*5*s,y-20*s+Math.sin(a)*5*s,3*s,3*s,'#fff5da');}ellipse(x,y-20*s,2*s,2*s,'#e4bd5d');}
function axolotl(p=player){ctx.save();ctx.translate(p.x,p.y);if(p.spin>0)ctx.rotate((.48-p.spin)*Math.PI*2/.24);ctx.scale(p.face,1);const bob=p.ground?Math.sin(time*(Math.abs(p.vx)>20?15:3))*1.5:0;ctx.translate(0,bob+(p.eating?Math.sin(time*9)*2:0));
// Soft tail, tiny feet, round body and feathery external gills.
ctx.fillStyle='#eda7b8';ctx.beginPath();ctx.moveTo(-15,5);ctx.quadraticCurveTo(-53,-4,-44,-22);ctx.quadraticCurveTo(-63,15,-21,22);ctx.fill();ellipse(-13,24,8,6,'#e9a4b6');ellipse(14,24,8,6,'#e9a4b6');ellipse(0,10,23,21,p.color||'#f5bfce');
for(const side of [-1,1])for(let i=0;i<3;i++){const x=side*24,y=-17+i*11,tipX=side*(39+(i===1?5:0)),tipY=y+(i-1)*10;line(x,y,tipX,tipY,'#dc859e',4);for(let j=0;j<3;j++){let t=.45+j*.2;let fx=x+(tipX-x)*t,fy=y+(tipY-y)*t;line(fx,fy,fx+side*5,fy-5,'#e99bb0',2);line(fx,fy,fx+side*5,fy+4,'#e99bb0',2);}}
ellipse(0,-7,29,24,p.color||'#ffd5df');ellipse(-14,-1,6,3,'#efa8bb');ellipse(17,-1,6,3,'#efa8bb');ellipse(-10,-9,3,4,'#344f47');ellipse(12,-9,3,4,'#344f47');ellipse(-9,-10,1,1,'#fff');ellipse(13,-10,1,1,'#fff');ctx.strokeStyle='#9f6579';ctx.lineWidth=1.7;ctx.beginPath();ctx.arc(2,-3,5,.15,Math.PI-.15);ctx.stroke();if(p.eating)ellipse(2,0,4,2+Math.sin(time*9),'#9f6579');ctx.restore();
if(p.spin>0){ctx.strokeStyle='#fff4d0';ctx.lineWidth=4;ctx.beginPath();ctx.ellipse(p.x,p.y,57,38,time*12,.1,Math.PI*1.7);ctx.stroke();for(let i=0;i<3;i++){const a=time*15+i*2.1;ellipse(p.x+Math.cos(a)*57,p.y+Math.sin(a)*38,4,4,'#fffbe4');}}
}
function drawBone(x,y){ctx.save();ctx.translate(x,y);ctx.rotate(-.35);line(-9,0,9,0,'#fff4db',6);for(const side of [-1,1]){ellipse(side*10,-3,4,4,'#fff4db');ellipse(side*10,3,4,4,'#fff4db');}ctx.restore();}
function drawSnake(s){ctx.save();ctx.translate(s.x,s.y);ctx.scale(s.dir,1);ctx.strokeStyle='#c74948';ctx.lineWidth=13;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(-34,7);ctx.bezierCurveTo(-20,-14,-7,22,8,2);ctx.stroke();for(let i=0;i<4;i++)ellipse(-27+i*9,5+Math.sin(i*1.6)*4,2,2,'#f39b76');ellipse(16,-2,14,10,'#e35c54');if(s.alive){ellipse(-8,0,7,8,'#d4fff2');ellipse(-10,-1,1,2,'#698f87');ellipse(-6,-1,1,2,'#698f87');}ellipse(20,-5,3,3,'#ffdc78');ellipse(21,-5,1,2,'#3c3a33');line(28,0,36,1,'#a33148',1.5);line(35,1,39,-2,'#a33148',1.5);line(35,1,39,4,'#a33148',1.5);ctx.fillStyle='#fff4de';ctx.beginPath();ctx.moveTo(20,5);ctx.lineTo(24,5);ctx.lineTo(22,10);ctx.fill();ctx.restore();}
function drawPlayDate(){
// A bouncing ball and building blocks keep the cave a playground after supper.
const ballX=3240+Math.sin(partyTime*1.7)*65,ballY=478-Math.abs(Math.sin(partyTime*3))*43;
ellipse(ballX,ballY,11,11,'#efb2bd');line(ballX-7,ballY-6,ballX+7,ballY+6,'#fff3d0',3);
for(let i=0;i<3;i++){ctx.fillStyle=friendColors[i];ctx.fillRect(3130+i*13,481-(i%2)*10,12,12);}
ctx.fillStyle='#fff2d6';ctx.font='600 13px system-ui';ctx.textAlign='center';ctx.fillText('CAVE PLAY DATE! ♥',3240,295);
for(let i=0;i<10;i++){const x=3125+i*24,y=340+((partyTime*24+i*31)%130);ellipse(x+Math.sin(partyTime+i)*5,y,2,3,friendColors[i%4]);}
}
function inSupper(){return player.x>WORLD-230&&player.y>GROUND-110&&friends.length>0&&friends.every(f=>f.home)&&snakes.some(s=>s.homeSafe&&!s.eaten);}
function draw(){ctx.clearRect(0,0,width,height);ctx.save();ctx.scale(scale,scale);const view=width/scale;const sky=ctx.createLinearGradient(0,0,0,HEIGHT);sky.addColorStop(0,'#c2dfd3');sky.addColorStop(.65,'#e8edc9');sky.addColorStop(1,'#b7d09a');ctx.fillStyle=sky;ctx.fillRect(0,0,view,HEIGHT);ellipse(view*.78,105,47,47,'#fff8d5');ellipse(view*.78,105,65,65,'#fff6d330');
for(let i=-1;i<9;i++){const x=i*390-camera*.13;hill(x,400,340,'#a5c8af');hill(x+190,460,240,'#97bda0');}for(let i=-1;i<14;i++)tree(i*280-camera*.33,495,.85+(i%3)*.15,'#8eb59b');for(let i=-1;i<15;i++)tree(i*310+120-camera*.65,510,1.25,'#74a481');
ctx.save();ctx.translate(-camera,0);
for(const p of platforms){if(p.x+p.w<camera-50||p.x>camera+view+50)continue;ctx.fillStyle=p.y===GROUND?'#8b9e66':'#9b8b61';ctx.beginPath();ctx.roundRect(p.x,p.y,p.w,p.h,p.y===GROUND?0:9);ctx.fill();ctx.fillStyle='#acc583';ctx.beginPath();ctx.roundRect(p.x-3,p.y-4,p.w+6,12,6);ctx.fill();ctx.fillStyle='#c4d99a';ctx.fillRect(p.x+5,p.y-4,p.w-10,3);if(p.y!==GROUND){for(let i=12;i<p.w;i+=27){line(p.x+i,p.y+15,p.x+i-3,p.y+28,'#7b9d61',3);ellipse(p.x+i-5,p.y+25,5,3,'#88ab68');}}}
// Deep cracks with jagged rock edges; the collision floor has real gaps here.
for(const gap of gaps){ctx.fillStyle='#354638';ctx.beginPath();ctx.moveTo(gap.x,GROUND);ctx.lineTo(gap.x+gap.w,GROUND);ctx.lineTo(gap.x+gap.w-12,GROUND+45);ctx.lineTo(gap.x+gap.w-5,GROUND+90);ctx.lineTo(gap.x+gap.w-25,HEIGHT);ctx.lineTo(gap.x+18,HEIGHT);ctx.lineTo(gap.x+5,GROUND+90);ctx.lineTo(gap.x+14,GROUND+40);ctx.closePath();ctx.fill();line(gap.x+6,GROUND+18,gap.x+19,GROUND+48,'#718262',3);}
for(const log of logs){ctx.fillStyle='#916342';ctx.beginPath();ctx.roundRect(log.x,log.y,log.w,log.h,10);ctx.fill();for(let i=8;i<log.w-12;i+=17)line(log.x+i,log.y+7,log.x+i+9,log.y+log.h-7,'#b28051',3);ellipse(log.x+log.w-5,log.y+log.h/2,11,log.h/2,'#d8b580');ellipse(log.x+log.w-5,log.y+log.h/2,6,log.h/2-5,'#a47a50');line(log.x+5,log.y,log.x+log.w-14,log.y,'#92b66d',5);}
// Mum's moss-covered cave.
ellipse(3110,446,285,240,'#72846d');ellipse(3110,453,252,213,'#3d574b');ellipse(3110,469,231,193,'#283e37');ellipse(3030,224,105,19,'#9cb47e');ellipse(3290,295,70,18,'#8da876');
ctx.save();ctx.translate(3230,441);ctx.scale(MUM_SCALE,MUM_SCALE);axolotl({x:0,y:0,face:-1,ground:true,vx:0,spin:0,eating:inSupper()});ctx.restore();ctx.fillStyle='#fff2d6';ctx.font='600 12px system-ui';ctx.textAlign='center';ctx.fillText('MUMS’ PLAY-DATE CAVE',3110,255);
// The four friends’ mums wait together, wearing the same colours as their babies.
for(let i=0;i<4;i++){ctx.save();ctx.translate(2915+i*125,365);ctx.scale(MUM_SCALE,MUM_SCALE);axolotl({x:0,y:0,face:i<2?1:-1,ground:true,vx:0,spin:0,color:friendColors[i],eating:inSupper()});ctx.restore();}
// Little flags welcome everyone to the cave.
line(2880,285,3340,285,'#e6d8b0',2);for(let i=0;i<16;i++){ctx.fillStyle=friendColors[i%4];ctx.beginPath();ctx.moveTo(2885+i*29,285);ctx.lineTo(2905+i*29,285);ctx.lineTo(2895+i*29,303);ctx.closePath();ctx.fill();}
// A little pool outside the cave.

ellipse(3095,500,65,14,'#7eaf9e');ellipse(3095,497,55,10,'#acd7c1');line(3160,495,3210,495,'#d7eee0',2);line(3245,501,3280,501,'#d7eee0',2);ellipse(3265,492,17,5,'#6e9f76');flower(3270,490,.7);
for(let i=0;i<85;i++){const x=i*43+12;if(x<camera-30||x>camera+view+30||gaps.some(g=>x>g.x-10&&x<g.x+g.w+10))continue;const y=GROUND-4;line(x,y,x-4,y-10-(i%4)*3,'#719958',2);line(x,y,x+5,y-8,'#719958',2);if(i%4===0)flower(x+12,y,.7+(i%3)*.15);}
for(const b of brambles)if(b.hp){ellipse(b.x,b.y+14,28,7,'#647e4d30');for(let i=0;i<5;i++){const a=i*1.7;line(b.x-22,b.y+13,b.x+Math.cos(a)*20,b.y-17,'#688353',4);line(b.x+20,b.y+12,b.x+Math.sin(a)*20,b.y-14,'#829355',3);}for(let i=0;i<4;i++)ellipse(b.x-18+i*12,b.y-8+(i%2)*8,7,4,'#9ba66a');}
for(const s of seeds)if(!s.taken){const y=s.y+Math.sin(time*2.5+s.x)*5;ellipse(s.x,y,15,15,'#fff3a52a');ellipse(s.x,y,10,10,'#ffe4a14a');drawBone(s.x,y);}
for(const snake of snakes)if(snake.alive)drawSnake(snake);
const cargo=snakes.filter(s=>s.carried);if(cargo.length){ctx.save();ctx.translate(player.x-player.face*32,player.y+3);ctx.rotate(-.12);ctx.fillStyle='#b28a5b';ctx.beginPath();ctx.roundRect(-14,-6,28,29,5);ctx.fill();for(let i=0;i<cargo.length;i++){ctx.save();ctx.translate(-8+(i%2)*13,-8-Math.floor(i/2)*12);ctx.scale(.36,.36);drawSnake({x:0,y:0,dir:1});ctx.restore();}ctx.restore();}
// A shared supper, with portions disappearing as everyone eats.
if(delivered){ellipse(3240,491,63,12,'#cfb887');ellipse(3240,488,57,9,'#f5e4bd');}
let dish=0;for(const snake of snakes)if(snake.homeSafe&&!snake.eaten){ctx.save();ctx.translate(3205+dish*23,483);const size=.38*(1-snake.meal/6);ctx.scale(size,size);drawSnake({x:0,y:0,dir:-1});ctx.restore();dish++;}
for(const friend of friends){let actor=friend;if(friend.home){const places=[{x:3174,y:458},{x:3208,y:435},{x:3274,y:439},{x:3313,y:461}];actor={...friend,...places[friend.id],face:friend.id<2?1:-1,spin:0,vx:0,ground:true};actor.eating=inSupper();if(playDate){const phase=partyTime*2+friend.id*Math.PI/2;actor.x=3235+Math.cos(phase)*91;actor.y=459-Math.abs(Math.sin(phase*1.5))*32;actor.face=Math.sin(phase)>0?-1:1;actor.ground=false;actor.spin=Math.sin(partyTime*2+friend.id)>0.8?.24+Math.sin(partyTime*8)*.2:0;}}
ctx.save();ctx.globalAlpha=friend.emerge>0?.65:1;if(friend.emerge>0){ellipse(actor.x,actor.y,39,43,friend.color+'55');}axolotl(actor);ctx.restore();
if(friend.home&&inSupper()){ellipse(actor.x+actor.face*14,actor.y+2,3,2,'#fff2cc');}
}
if(playDate)drawPlayDate();
if(inSupper()){ctx.fillStyle='#fff2d6';ctx.font='600 12px system-ui';ctx.textAlign='center';ctx.fillText('SNAKE SUPPER WITH MUM ♥',3240,297);}

ellipse(player.x,GROUND+1,26,6,'#466d4923');ctx.save();if(invincible>0)ctx.globalAlpha=.45+Math.sin(time*25)*.25;axolotl({...player,eating:inSupper()});ctx.restore();if(poison>0){ellipse(player.x-25,player.y-40,4,4,'#a47ccc');ellipse(player.x+16,player.y-48,3,3,'#a47ccc');}for(const q of particles){ctx.globalAlpha=Math.min(1,q.life*2);ellipse(q.x,q.y,3,3,q.color);}ctx.globalAlpha=1;
// Near-ground foliage adds depth without hiding the path.
for(let i=0;i<40;i++){const x=i*100+25;ellipse(x,555+(i%3)*14,58,20,'#76975e');ellipse(x+30,572,55,24,'#648b57');}ctx.restore();
for(let i=0;i<18;i++){const x=((i*113+Math.sin(time*.4+i)*20-camera*.2)%(view+40)+view+40)%(view+40);ellipse(x,180+(i*47)%310+Math.sin(time+i)*12,1.8,1.8,'#fff8c1a0');}ctx.restore();}
function frame(now){const dt=Math.min((now-last)/1000||0,.033);last=now;update(dt);draw();requestAnimationFrame(frame);}requestAnimationFrame(frame);
})();
