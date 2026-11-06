export function createSound(button) {
  let context, master, rainGain, waterGain, enabled = true, nextBird = 0, nextFrog = 0, nextInsect = 0;
  function start() {
    if (!context) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) { button.textContent = 'Sound unavailable'; button.disabled = true; return; }
      context = new AudioContext();
      master = context.createGain(); master.gain.value = enabled ? .22 : 0; master.connect(context.destination);
      const buffer = context.createBuffer(1, context.sampleRate * 3, context.sampleRate);
      const samples = buffer.getChannelData(0);
      for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
      function noise(frequency, volume) {
        const source = context.createBufferSource(); source.buffer = buffer; source.loop = true;
        const filter = context.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = frequency;
        const gain = context.createGain(); gain.gain.value = volume;
        source.connect(filter).connect(gain).connect(master); source.start(); return gain;
      }
      noise(350, .06); rainGain = noise(4000, 0); waterGain = noise(1400, 0);
    }
    if (context?.state === 'suspended') context.resume().catch(() => {});
  }
  function tone(from, to, duration, volume = .15, delay = 0, type = 'sine') {
    if (!context || !enabled) return;
    const time = context.currentTime + delay;
    const oscillator = context.createOscillator(), gain = context.createGain(); oscillator.type = type;
    oscillator.frequency.setValueAtTime(from, time); oscillator.frequency.exponentialRampToValueAtTime(to, time + duration);
    gain.gain.setValueAtTime(0, time); gain.gain.linearRampToValueAtTime(volume, time + .02); gain.gain.exponentialRampToValueAtTime(.001, time + duration);
    oscillator.connect(gain).connect(master); oscillator.start(time); oscillator.stop(time + duration + .02);
  }
  function effect(name) {
    if (name === 'eat') { tone(400,800,.12,.14,0,'triangle');tone(800,1100,.15,.1,.1); }
    if (name === 'hit') tone(170,65,.2,.13,0,'triangle');
    if (name === 'splash') for(let i=0;i<7;i++) tone(180+Math.random()*650,70+Math.random()*100,.18,.1,i*.035,'triangle');
    if (name === 'boost') tone(110, 700, .45, .18, 0, 'triangle');
    if (name === 'drink') for (let i=0;i<3;i++) tone(330+i*90,170,.13,.16,i*.12);
    if (name === 'finish') [440,554,659,880].forEach((pitch,i)=>tone(pitch,pitch,.35,.14,i*.15));
    if (name === 'break') tone(240,35,.6,.18,0,'triangle');
  }
  button.addEventListener('click', () => {
    enabled = !enabled; start(); button.textContent = enabled ? 'Sound on ♫' : 'Sound off'; button.setAttribute('aria-pressed', String(enabled));
    if (context) master.gain.setTargetAtTime(enabled ? .22 : 0, context.currentTime, .08);
  });
  const unlock = () => start();
  document.addEventListener('pointerdown', unlock, { once: true }); document.addEventListener('keydown', unlock, { once: true });
  function update({ raining, nearWater, paused }) {
    if (!context) return;
    master.gain.setTargetAtTime(enabled && !paused && !document.hidden ? .22 : 0, context.currentTime, .1);
    rainGain.gain.setTargetAtTime(raining ? .35 : 0,context.currentTime,.5);
    waterGain.gain.setTargetAtTime(nearWater ? .18 : 0,context.currentTime,.3);
    if (enabled && !paused && !document.hidden && context.currentTime > nextBird) {
      const species=Math.floor(Math.random()*3);
      if(species===0){tone(1500,2400,.16,.09);tone(2100,1300,.22,.08,.23);}
      if(species===1) for(let i=0;i<4;i++)tone(900+i*130,1500,.12,.07,i*.16);
      if(species===2){tone(650,950,.32,.1,0,'triangle');tone(800,550,.3,.08,.38,'triangle');}
      nextBird=context.currentTime+2+Math.random()*4;
    }
    if(enabled && !paused && !document.hidden && context.currentTime>nextFrog) {
      if(nearWater) for(let i=0;i<3;i++)tone(160,85,.18,.12,i*.23,'triangle');
      nextFrog=context.currentTime+5+Math.random()*5;
    }
    if(enabled && !paused && !document.hidden && context.currentTime>nextInsect) {
      for(let i=0;i<5;i++)tone(3800,3600,.055,.018,i*.09);
      nextInsect=context.currentTime+3+Math.random()*3;
    }
  }
  document.addEventListener('visibilitychange',()=>{ if(context && document.hidden) master.gain.setTargetAtTime(0,context.currentTime,.05); });
  return { update, effect };
}
