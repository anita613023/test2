/* Typographic prototypes. Gesture coordinates follow the mirrored, cover-cropped video. */
const extraLevels=[
 {word:'看',parts:'手 目',title:'把手放在眼睛上方，向遠處看',easy:'像遮太陽一樣，把一隻手放在眉毛上方，停留一秒。',mid:'太陽好亮，怎樣才能看清楚遠方？',hard:'試著用手幫助眼睛看遠方。',done:'手放在目上方，幫助眼睛看遠處：看。'},
 {word:'明',parts:'日 月',title:'讓太陽和月亮相遇',easy:'先張開雙手，再把日和月帶到中間，靠近並停留一秒。',mid:'一手帶著日，一手帶著月，讓它們靠近。',hard:'把兩個發亮的朋友帶在一起。',done:'日和月都帶來光亮，合起來是明。'},
 {word:'囚',parts:'囗 人',title:'擋住出口，圍住小人',easy:'依序擋住左邊、右邊、上方的出口，最後雙手合攏。',mid:'跟著小人的方向，擋住出口。',hard:'怎樣讓小人留在框框裡？',done:'人被圍在囗裡，不能自由離開，這個字是囚。'},
 {word:'石',parts:'山 石',title:'把上面的山移走',easy:'把一隻手移到「山」上，停一下拿住，再向上搬走。',mid:'移走岩上面的山，看看留下什麼。',hard:'岩少了上面的部件，會變成哪個字？',done:'岩的上面是山，下面是石；移走山，留下石。這是拆字遊戲。'}
];
let extraState={};
function clearExtraVisuals(){document.querySelectorAll('.gesture-dot').forEach(e=>e.remove());$('stage').classList.remove('bright');$('stage').style.removeProperty('--light');$('letters').removeAttribute('style')}
function resetExtra(){clearExtraVisuals();extraState={phase:0,armed:false,grab:null}}
function setupExtra(){
 $('letters').className=['look','light','prison','rock'][level-3];
 if(level===5){$('letters').innerHTML='<span class="cage"><i class="person">人</i></span>';updatePrison()}
 if(level===3)$('letters').innerHTML='<span>手</span><span>目</span>';
 if(level===4)$('stage').classList.add('bright');
 [15,16].forEach(id=>{const dot=document.createElement('div');dot.className='gesture-dot';dot.id='gesture-'+id;dot.hidden=true;$('stage').append(dot)})
}
function updatePrison(){
 const p=extraState.phase;$('letters').dataset.phase=p;
 $('title').textContent=['小人往左跑：用手擋住左邊','小人往右跑：用手擋住右邊','小人往上跳：舉手擋住上方','最後，把雙手合起來'][p];
 $('feedback').textContent=p<3?'把手移到發亮的出口，停留一下。':'雙手在胸前靠近，停留一秒。';
}
function extraAct(){
 if(level===5&&extraState.phase<3){extraState.phase++;amount=0;$('progress').value=0;updatePrison();return}
 finish();if(level===4)$('stage').classList.add('bright');
}
function screenPoint(lm){
 const r=$('stage').getBoundingClientRect(),v=$('video'),w=v.videoWidth||640,h=v.videoHeight||480,k=Math.max(r.width/w,r.height/h);
 return {x:r.width-((lm.x*w*k)-(w*k-r.width)/2),y:lm.y*h*k-(h*k-r.height)/2};
}
function extraResults(lm,dt){
 if(done)return;
 const valid=i=>lm[i]&&(lm[i].visibility??0)>.6;
 const hands=[15,16].filter(valid).map(id=>({id,...screenPoint(lm[id])}));
 [15,16].forEach(id=>{const d=$('gesture-'+id),p=hands.find(h=>h.id===id);if(d){d.hidden=!p;if(p){d.style.left=p.x+'px';d.style.top=p.y+'px'}}});
 const r=$('stage').getBoundingClientRect();
 if(!hands.length){extraState.grab=null;accumulate(false,dt);$('feedback').textContent='請讓手和上半身出現在鏡頭中。';return}
 if(level===3){
  if(!valid(2)||!valid(5)){accumulate(false,dt);$('feedback').textContent='請面向鏡頭，讓眼睛和手都入鏡。';return}
  const eye={x:(lm[2].x+lm[5].x)/2,y:(lm[2].y+lm[5].y)/2};
  const face=Math.max(.05,Math.abs(lm[7]?.x-lm[8]?.x)||.08);
  const near=hands.some(({id})=>Math.abs(lm[id].x-eye.x)<face*1.2&&lm[id].y<eye.y+.03&&lm[id].y>eye.y-face*1.4);
  $('letters').firstChild.style.transform=near?'translateY(.18em) rotate(-10deg)':'';
  $('feedback').textContent=near?'就是這樣，保持一下。':'手像帽簷一樣放在眉毛上方。';accumulate(near,dt);
 }else if(level===4){
  if(hands.length<2){accumulate(false,dt);$('feedback').textContent='讓雙手都出現在鏡頭裡。';return}
  const a=hands[0],b=hands[1],gap=Math.hypot(a.x-b.x,a.y-b.y),unit=Math.min(r.width,r.height);
  if(gap>unit*.38)extraState.armed=true;
  [...$('letters').children].forEach((el,i)=>{const h=hands[i];el.style.transform=`translate(${(h.x-r.width/2)*.65}px,${(h.y-r.height*.42)*.5}px)`});
  $('stage').style.setProperty('--light',String(Math.max(0,1-gap/(unit*.65))*.25));
  $('feedback').textContent=extraState.armed?'把雙手靠近，讓日月相遇。':'先把雙手向兩側張開。';
  accumulate(extraState.armed&&gap<unit*.2,dt);
 }else if(level===5){
  const box=$('letters').getBoundingClientRect(),cx=box.left-r.left+box.width/2,cy=box.top-r.top+box.height/2,p=extraState.phase;
  let hit=false;
  if(p<3){const target=p===0?{x:cx-box.width*.46,y:cy}:p===1?{x:cx+box.width*.46,y:cy}:{x:cx,y:cy-box.height*.46};hit=hands.some(h=>Math.hypot(h.x-target.x,h.y-target.y)<Math.max(42,box.width*.25))}
  else hit=hands.length===2&&Math.hypot(hands[0].x-hands[1].x,hands[0].y-hands[1].y)<Math.min(r.width,r.height)*.2;
  accumulate(hit,dt);
 }else if(level===6){
  const mountain=$('letters').firstChild,box=mountain.getBoundingClientRect();
  if(!extraState.grab){const h=hands.find(h=>h.x>box.left-r.left-25&&h.x<box.right-r.left+25&&h.y>box.top-r.top-25&&h.y<box.bottom-r.top+25);amount=Math.max(0,Math.min(.6,amount+(h?dt:-dt)));$('progress').value=amount;if(h&&amount>=.6){extraState.grab={id:h.id,y:h.y};$('feedback').textContent='拿住了！把手向上抬。'}else $('feedback').textContent='把手放在「山」上，停一下。'}
  else {const h=hands.find(h=>h.id===extraState.grab.id);if(!h){extraState.grab=null;amount=0;mountain.style.transform='';return}const lift=Math.max(0,extraState.grab.y-h.y);mountain.style.transform=`translateY(${-lift}px)`;$('progress').value=.6+.4*Math.min(1,lift/Math.min(100,r.height*.18));if(lift>Math.min(100,r.height*.18))extraAct()}
 }
}
