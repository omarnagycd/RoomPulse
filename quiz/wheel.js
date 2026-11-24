function drawWheel(){const canvas=$('wheelCanvas');if(!canvas)return;const ctx=canvas.getContext('2d'),size=720,c=size/2,R=316,dark=theme==='dark';canvas.width=size;canvas.height=size;ctx.clearRect(0,0,size,size);const n=wheelItems.length,items=n?wheelItems:[t('أضف العناصر')],step=Math.PI*2/items.length;
 ctx.save();ctx.translate(c,c);ctx.beginPath();ctx.arc(0,0,352,0,7);ctx.fillStyle=dark?'#1b1013':'#2a171b';ctx.fill();for(let i=0;i<48;i++){ctx.beginPath();ctx.arc(Math.cos(i*Math.PI/24)*335,Math.sin(i*Math.PI/24)*335,3.2,0,7);ctx.fillStyle=i%6?'#ffffff55':'#ff4a55';ctx.fill()}
 const PAL=['#e60000','#c4001a','#a80018','#d8101c','#b50016','#ee2a2a','#9c0014','#cf0a1c'];
 ctx.rotate(wheelRotation-Math.PI/2);items.forEach((item,i)=>{const a=i*step;ctx.beginPath();ctx.moveTo(0,0);ctx.arc(0,0,R,a,a+step);ctx.closePath();if(n){const g=ctx.createRadialGradient(0,0,40,0,0,R);g.addColorStop(0,'#7d0012');g.addColorStop(1,PAL[i%PAL.length]);ctx.fillStyle=g}else ctx.fillStyle=dark?'#3a2227':'#fbe4e4';ctx.fill();ctx.lineWidth=n?3:2;ctx.strokeStyle=n?'#ffffff90':(dark?'#ffffff25':'#f0b7bd');ctx.stroke()});ctx.restore();
 if(items.length<=40){const fs=items.length>20?17:items.length>12?22:28,maxw=R*.66;items.forEach((item,i)=>{const th=wheelRotation-Math.PI/2+i*step+step/2,flip=Math.cos(th)<0;ctx.save();ctx.translate(c,c);ctx.rotate(th);if(flip){ctx.rotate(Math.PI);ctx.textAlign='left';ctx.translate(-R*.94,0)}else{ctx.textAlign='right';ctx.translate(R*.94,0)}ctx.textBaseline='middle';ctx.font='700 '+fs+'px Arial, sans-serif';ctx.fillStyle=n?'#fff':(dark?'#f6edf0':'#6b5960');let label=item;while(ctx.measureText(label).width>maxw&&label.length>1)label=label.slice(0,-2);if(label!==item)label+='…';ctx.fillText(label,0,0);ctx.restore()})}
 ctx.save();ctx.translate(c,c);ctx.beginPath();ctx.arc(0,0,46,0,7);ctx.fillStyle=dark?'#201317':'#fff';ctx.shadowColor='#0004';ctx.shadowBlur=16;ctx.shadowOffsetY=5;ctx.fill();ctx.shadowColor='transparent';ctx.lineWidth=6;ctx.strokeStyle='#E60000';ctx.stroke();ctx.fillStyle='#E60000';ctx.font='900 22px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('RP',0,1);ctx.restore();
 ctx.save();ctx.translate(c,6);ctx.beginPath();ctx.moveTo(-22,0);ctx.quadraticCurveTo(-22,24,0,60);ctx.quadraticCurveTo(22,24,22,0);ctx.quadraticCurveTo(0,-12,-22,0);ctx.closePath();ctx.fillStyle='#fff';ctx.shadowColor='#0005';ctx.shadowBlur=10;ctx.shadowOffsetY=4;ctx.fill();ctx.shadowColor='transparent';ctx.lineWidth=4;ctx.strokeStyle='#E60000';ctx.stroke();ctx.restore();
 canvas.setAttribute('aria-label',t('عجلة اختيار عشوائي')+' · '+wheelItems.length+' '+t('عنصر'))}
(function(){const od=drawWheel;let lk=null,lt=0,lr=0;
drawWheel=function(){od.apply(this,arguments);try{const X=(typeof QX!=='undefined')?QX:null;if(!X||!X.ready)return;const n=wheelItems.length;if(n<2)return;const step=Math.PI*2/n,now=performance.now();
 if(wheelSpinning){const k=Math.floor(wheelRotation/step);
  if(lk===null){lk=k;lt=now;lr=wheelRotation;X.wstart();return}
  const dt=Math.max(1,now-lt),w=(wheelRotation-lr)/dt*1000,cr=k-lk;X.wspeed(w);
  if(cr>0){const slow=w<7,v=slow?.75+.25*Math.min(1,(7-w)/7):Math.max(.25,.7-w/60),m=Math.min(cr,5),aw=X.wnow();for(let i=1;i<=m;i++){const fr=(lk+i)*step,fi=Math.max(0,Math.min(1,(fr-lr)/Math.max(1e-6,wheelRotation-lr)));X.wtick(aw+(fi*dt)/1000+.02,v/(1+(m>3?.25*m:0)),slow&&w<2.5)}}
  lk=k;lt=now;lr=wheelRotation}
 else if(lk!==null){const k=Math.floor(wheelRotation/step);if(k>lk)X.wtick(X.wnow()+.02,.8,true);lk=null;X.wstop()}
}catch(e){}};})();

