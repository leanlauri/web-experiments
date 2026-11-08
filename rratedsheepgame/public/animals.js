// Species-specific routines use independent phases and deterministic destinations.
export const ANIMAL_PROFILES={
 cow:{radius:.88,height:1.5,speed:.48,range:6,period:22,rest:.62},
 pig:{radius:.58,height:1.05,speed:.8,range:5,period:15,rest:.35},
 deer:{radius:.62,height:1.7,speed:1.65,range:10,period:19,rest:.48},
 rabbit:{radius:.4,height:.9,speed:1.9,range:6,period:7,rest:.45},
 duck:{radius:.34,height:.5,speed:.65,range:4,period:17,rest:.12},
 person:{radius:.3,height:1.8,speed:.8,range:3,period:16,rest:.25},
};
export function animalIntent(type,time,phase,home,position,player){
 const p=ANIMAL_PROFILES[type],clock=time+phase*7,cycle=Math.floor(clock/p.period),fraction=clock/p.period-cycle;
 const angle=cycle*2.399+phase,reach=p.range*(.45+.4*Math.sin(cycle*1.73+phase)**2);
 let dx=home.x+Math.cos(angle)*reach-position.x,dz=home.z+Math.sin(angle)*reach-position.z;
 let state=fraction<p.rest?'rest':'wander',speed=state==='rest'?0:p.speed;
 const distance=Math.hypot(position.x-player.x,position.z-player.z);
 if((type==='deer'||type==='rabbit')&&distance<6){dx=position.x-player.x;dz=position.z-player.z;speed=p.speed*1.6;state='flee';}
 if(type==='cow'&&state==='rest')state='graze';if(type==='pig'&&state==='rest')state='root';
 if(type==='duck')state='swim';
 const length=Math.hypot(dx,dz);if(length<.25)speed=0;
 return {x:length?dx/length*speed:0,z:length?dz/length*speed:0,state};
}
export const SHEEP_HOP_SPEED=5.2;
export function sheepCanHop(c,v){return c?.kind==='log'&&c.h-(c.base??0)<=.65&&Math.abs(v.z)>Math.abs(v.x)*.7;}
