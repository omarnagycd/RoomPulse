const QS=(()=>{
const F=m=>440*Math.pow(2,(m-69)/12);
function tone(c,d,type,f,t,dur,vol,f2){const o=c.createOscillator(),g=c.createGain();o.type=type;o.frequency.setValueAtTime(f,t);if(f2)o.frequency.exponentialRampToValueAtTime(f2,t+dur);g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(vol,t+Math.min(0.012,dur/3));g.gain.exponentialRampToValueAtTime(0.0001,t+dur);o.connect(g);g.connect(d);o.start(t);o.stop(t+dur+0.05)}
let nb=null;function noiseBuf(c){if(!nb||nb.sampleRate!==c.sampleRate){nb=c.createBuffer(1,c.sampleRate*2,c.sampleRate);const a=nb.getChannelData(0);for(let i=0;i<a.length;i++)a[i]=Math.random()*2-1}return nb}
function noise(c,d,t,dur,vol,type,freq,q){const s=c.createBufferSource();s.buffer=noiseBuf(c);const f=c.createBiquadFilter();f.type=type;f.frequency.value=freq;if(q)f.Q.value=q;const g=c.createGain();g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(0.0001,t+dur);s.connect(f);f.connect(g);g.connect(d);s.start(t,Math.random());s.stop(t+dur+0.05)}
function kick(c,d,t,v){tone(c,d,'sine',150,t,0.18,v,45)}

const rv=new WeakMap();
function reverb(c,d){if(rv.has(c))return rv.get(c);const len=c.sampleRate*1.6,b=c.createBuffer(2,len,c.sampleRate);for(let ch=0;ch<2;ch++){const a=b.getChannelData(ch);for(let i=0;i<len;i++)a[i]=(Math.random()*2-1)*Math.pow(1-i/len,2.6)}const cv=c.createConvolver();cv.buffer=b;const g=c.createGain();g.gain.value=0.5;cv.connect(g);g.connect(d);rv.set(c,cv);return cv}
function voice(c,d,type,f,t,dur,vol,lp,det,f2){const g=c.createGain(),fl=c.createBiquadFilter();fl.type='lowpass';fl.frequency.value=lp||8000;g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(vol,t+0.012);g.gain.setValueAtTime(vol,t+Math.max(0.013,dur*0.6));g.gain.exponentialRampToValueAtTime(0.0001,t+dur);fl.connect(g);g.connect(d);for(const dt of (det||[0])){const o=c.createOscillator();o.type=type;o.frequency.setValueAtTime(f,t);if(f2)o.frequency.exponentialRampToValueAtTime(f2,t+dur);o.detune.value=dt;o.connect(fl);o.start(t);o.stop(t+dur+0.05)}}
function snare(c,d,t,v){noise(c,d,t,0.16,v,'bandpass',2200,0.7);tone(c,d,'triangle',210,t,0.1,v*0.5,150)}
function echo(c,d){const dl=c.createDelay(1),fb=c.createGain(),wet=c.createGain();dl.delayTime.value=0.38;fb.gain.value=0.3;wet.gain.value=0.3;dl.connect(fb);fb.connect(dl);dl.connect(wet);wet.connect(d);return dl}
const CH={arcade:{bpm:116,bars:8,chords:[[57,60,64,45],[53,57,60,41],[55,60,64,48],[55,59,62,43],[57,60,64,45],[53,57,60,41],[55,59,62,43],[55,60,64,48]],
 mel:[[76,0,72,0,76,79,0,76],[77,0,76,0,72,0,69,0],[79,0,76,0,72,0,76,79],[81,0,79,0,76,0,74,0],[76,0,72,0,76,79,0,81],[84,0,81,0,77,0,76,0],[79,0,0,74,79,0,83,0],[84,0,0,0,79,0,0,0]]},
 calm:{bpm:88,bars:6,chords:[[60,64,67,36],[57,60,64,33],[53,57,60,29],[55,59,62,31],[60,64,67,36],[55,59,62,31]]}};
function music(c,d,style,t0){const S=CH[style]||CH.arcade,b=60/S.bpm,bar=4*b;
 if(style==='calm'){for(let k=0;k<S.bars;k++){const ch=S.chords[k%S.chords.length],t=t0+k*bar;
   for(const n of ch.slice(0,3)){tone(c,d,'triangle',F(n),t,bar*1.05,0.05);tone(c,d,'sine',F(n-12),t,bar*1.05,0.05)}
   tone(c,d,'sine',F(ch[3]),t,bar*0.98,0.16);
   for(let i=0;i<8;i++){const n=ch[[0,1,2,1,0,2,1,2][i]]+12;tone(c,d,'sine',F(n),t+i*b/2,b*1.1,0.07);tone(c,d,'triangle',F(n+12),t+i*b/2,b*0.5,0.025)}
   kick(c,d,t,0.28);kick(c,d,t+2*b,0.2);noise(c,d,t+b,0.12,0.05,'bandpass',2500,1);noise(c,d,t+3*b,0.12,0.05,'bandpass',2500,1)}
  return S.bars*bar}
 const R=reverb(c,d),E=echo(c,d);const lead=c.createGain();lead.gain.value=1;lead.connect(d);lead.connect(E);lead.connect(R);
 for(let k=0;k<S.bars;k++){const ch=S.chords[k],t=t0+k*bar,m=S.mel[k];
  // drums
  for(let i=0;i<4;i++){kick(c,d,t+i*b,0.5);}
  snare(c,d,t+b,0.22);snare(c,d,t+3*b,0.22);
  for(let i=0;i<8;i++){noise(c,d,t+i*b/2+(i%2?0:0),i%2?0.09:0.04,i%2?0.07:0.05,'highpass',8000)}
  // bass (saw, lowpassed, eighths with octave)
  for(let i=0;i<8;i++)voice(c,d,'sawtooth',F(ch[3]+(i%4===3?12:0)),t+i*b/2,b/2*0.85,0.22,500);
  // chord stabs (detuned saws), syncopated
  for(const off of [0,1.5,2.5]){for(const n of ch.slice(0,3))voice(c,R,'sawtooth',F(n),t+off*b,b*0.45,0.035,2200,[-9,9]);voice(c,d,'sawtooth',F(ch[2]),t+off*b,b*0.4,0.02,1800,[-6,6])}
  // lead melody (detuned saw + sine octave, filtered), echo and reverb
  for(let i=0;i<8;i++)if(m[i])voice(c,lead,'sawtooth',F(m[i]),t+i*b/2,b*0.55,0.07,3200,[-7,7]),voice(c,lead,'sine',F(m[i]-12),t+i*b/2,b*0.55,0.05,3000)}
 return S.bars*bar}
function ting(c,d,t){tone(c,d,'sine',1319,t,0.5,0.32);tone(c,d,'sine',1760,t+0.09,0.7,0.3);tone(c,d,'triangle',2637,t+0.09,0.4,0.06);tone(c,d,'sine',3520,t+0.09,0.5,0.05)}

function buzz(c,d,t){const R=reverb(c,d);voice(c,d,'sine',392,t,0.28,0.16,2000);voice(c,d,'sine',293.7,t+0.2,0.45,0.15,2000);voice(c,R,'triangle',293.7,t+0.2,0.45,0.05,1500)}
function cheer(c,d,t){const R=reverb(c,d);
 const bed=c.createBufferSource();bed.buffer=noiseBuf(c);const bf=c.createBiquadFilter();bf.type='bandpass';bf.frequency.value=900;bf.Q.value=0.6;const bg=c.createGain();bg.gain.setValueAtTime(0.0001,t);bg.gain.exponentialRampToValueAtTime(0.06,t+0.8);bg.gain.setValueAtTime(0.06,t+3.2);bg.gain.exponentialRampToValueAtTime(0.0001,t+5);bed.connect(bf);bf.connect(bg);bg.connect(d);bg.connect(R);bed.start(t);bed.stop(t+5.1);
 for(let i=0;i<700;i++){const x=Math.pow(Math.random(),0.9),at=t+x*4.6,env=Math.sin(Math.PI*Math.min(1,x*1.05));const v=(0.05+Math.random()*0.17)*(0.25+env);const dst=Math.random()<0.45?R:d;noise(c,dst,at,0.012+Math.random()*0.03,v,'bandpass',900+Math.random()*3800,0.9+Math.random()*1.2)}
 const w=c.createOscillator(),wg=c.createGain(),lf=c.createOscillator(),lg=c.createGain();w.type='sine';w.frequency.setValueAtTime(1900,t+1.0);w.frequency.exponentialRampToValueAtTime(2500,t+1.5);w.frequency.exponentialRampToValueAtTime(2300,t+2.0);lf.frequency.value=6;lg.gain.value=22;lf.connect(lg);lg.connect(w.frequency);wg.gain.setValueAtTime(0.0001,t+1.0);wg.gain.exponentialRampToValueAtTime(0.05,t+1.1);wg.gain.exponentialRampToValueAtTime(0.0001,t+2.0);w.connect(wg);wg.connect(d);wg.connect(R);w.start(t+1.0);lf.start(t+1.0);w.stop(t+2.05);lf.stop(t+2.05);
 for(let i=0;i<6;i++){const at=t+0.15+i*0.22;noise(c,d,at,0.1,0.1,'lowpass',2500);tone(c,R,'sine',500+Math.random()*500,at,0.08,0.03,250)}
 return 5}
return {music,ting,buzz,cheer,CH}})();
