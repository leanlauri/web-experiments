const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
// Keep a passing side until clear; never choose a fresh left/right turn every frame.
export function avoidObstacle(state,desired,dt,time,blocked){
 const speed=Math.hypot(desired.x,desired.z);if(speed<.08)return {x:0,z:0};
 const angle=Math.atan2(desired.x,desired.z),hit=blocked(desired);
 if(!hit){
  state.clearFor=(state.clearFor||0)+dt;
  if(state.heading!==undefined&&state.clearFor<.25)return {x:Math.sin(state.heading)*speed,z:Math.cos(state.heading)*speed};
  state.heading=undefined;return desired;
 }
 state.clearFor=0;
 if(state.heading!==undefined&&time<(state.nextChoice||0)){
  const held={x:Math.sin(state.heading)*speed,z:Math.cos(state.heading)*speed};
  return blocked(held)?{x:0,z:0}:held;
 }
 const turns=[.5,.9,1.3,Math.PI/2,2,2.5];
 function candidate(side){for(const turn of turns){const heading=angle+side*turn,v={x:Math.sin(heading)*speed,z:Math.cos(heading)*speed};if(!blocked(v))return {heading,v,turn};}return null;}
 const left=candidate(-1),right=candidate(1);
 let choice;
 if(state.side&&time<(state.commitUntil||0))choice=state.side<0?left:right;
 else {choice=left&&right?(left.turn<right.turn?left:right):left||right;if(choice){state.side=choice===left?-1:1;state.commitUntil=time+1.2;}}
 state.nextChoice=time+.18;
 if(!choice)return {x:0,z:0};
 state.heading=choice.heading;return choice.v;
}
export function turnToward(current,target,dt){const change=wrap(target-current);return current+Math.max(-3.5*dt,Math.min(3.5*dt,change));}
