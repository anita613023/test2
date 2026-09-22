// Screen-space hand positions account for the camera's cover crop and mirror.
window.createHandNext=function(video,button){
 const hands=[15,16].map(()=>{const dot=document.createElement('div');dot.className='hand-pointer';dot.hidden=true;document.body.append(dot);return dot});
 let active=-1,since=0,previous=0,fired=false,lastFrame=0;
 const clear=()=>{active=-1;since=0;button.style.setProperty('--hold','0');hands.forEach(h=>h.hidden=true)};
 const timer=setInterval(()=>{if(performance.now()-lastFrame>300)clear()},150);
 addEventListener('pagehide',()=>clearInterval(timer));
 return function(landmarks){const now=performance.now();lastFrame=now;
 if(button.hidden||!button.getClientRects().length){clear();fired=false;previous=now;return}
 if(now-previous>300)clear();previous=now;
 const frame=video.getBoundingClientRect(),box=button.getBoundingClientRect();
 const vw=video.videoWidth||frame.width,vh=video.videoHeight||frame.height,scale=Math.max(frame.width/vw,frame.height/vh);
 let hit=-1;
 [15,16].forEach((id,i)=>{const p=landmarks?.[id];if(!p||(p.visibility??0)<.6){hands[i].hidden=true;return}
 const x=frame.left+frame.width-(p.x*vw*scale-(vw*scale-frame.width)/2),y=frame.top+p.y*vh*scale-(vh*scale-frame.height)/2;
 const visible=x>=frame.left&&x<=frame.right&&y>=frame.top&&y<=frame.bottom;hands[i].hidden=!visible;hands[i].style.left=x+'px';hands[i].style.top=y+'px';
 if(visible&&x>=box.left&&x<=box.right&&y>=box.top&&y<=box.bottom)hit=i;
 });
 if(hit<0){active=-1;since=0;button.style.setProperty('--hold','0');return}
 if(hit!==active){active=hit;since=now}
 const progress=Math.min(1,(now-since)/1000);button.style.setProperty('--hold',progress);
 if(progress>=1&&!fired){fired=true;clear();button.click()}
 }
};
