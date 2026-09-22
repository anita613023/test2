window.forestPlayer={ready:false,busy:false};
(async()=>{
 const host=document.getElementById('stage'),notice=document.getElementById('model-loading'),P=window.forestPlayer;
 try{
 if(!window.PIXI?.live2d||!window.Live2DCubismCore)throw Error('模型播放器未載入');
 const app=new PIXI.Application({resizeTo:host,backgroundAlpha:0,antialias:true,resolution:Math.min(devicePixelRatio,2),autoDensity:true});
 app.view.id='live-forest';host.insertBefore(app.view,document.getElementById('overlay'));
 const model=await PIXI.live2d.Live2DModel.from('models/forest/forest.model3.json',{autoInteract:false,autoFocus:false,motionPreload:'ALL'});
 const internal=model.internalModel,core=internal.coreModel;
 // Cubism 5.3 Core moved renderOrders from drawables to the model.
 // This adapter is limited to this model's standard, non-offscreen meshes.
 const raw=core.getModel();
 if(!raw.drawables.renderOrders){
  if(raw.offscreens?.count||!raw.renderOrders||raw.renderOrders.length!==raw.drawables.count)throw Error('模型需要新版繪圖功能');
  Object.defineProperty(raw.drawables,'renderOrders',{get:()=>raw.renderOrders});
 }
 app.stage.addChild(model);
 const values={Param:0,Param2:0,Param5:0,Param6:0};let transition=null,revision=0;
 const expressions={};await Promise.all(['cut_top','cut_left','forestmove1','forestmove2'].map(async name=>{const r=await fetch('models/forest/'+name+'.exp3.json');if(!r.ok)throw Error('缺少 '+name);expressions[name]=await r.json()}));
 internal.on('beforeModelUpdate',()=>{if(transition){const t=Math.min(1,(performance.now()-transition.start)/transition.ms),e=t*t*(3-2*t);for(const id of Object.keys(transition.to))values[id]=transition.from[id]+(transition.to[id]-transition.from[id])*e;if(t===1){const end=transition.resolve;transition=null;end()}}for(const [id,value] of Object.entries(values))core.setParameterValueById(id,value)});
 const expression=name=>new Promise(resolve=>{const e=expressions[name],to={},from={};for(const p of e.Parameters){from[p.Id]=values[p.Id]??0;to[p.Id]=p.Value}transition={from,to,resolve,start:performance.now(),ms:(e.FadeInTime??1)*1000}});
 // Drawable bounds follow the actual moving model, including its regrouping expressions.
 const parts=[];for(let i=0;i<core.getDrawableCount();i++){const b=internal.getDrawableBounds(i);parts.push({i,cx:b.x+b.width/2,cy:b.y+b.height/2,area:b.width*b.height})}
 const trees=parts.slice().sort((a,b)=>b.area-a.area).slice(0,3);
 const top=trees.reduce((a,b)=>a.cy<b.cy?a:b),lower=trees.filter(p=>p!==top),left=lower.reduce((a,b)=>a.cx<b.cx?a:b,lower[0]||top);
 function layout(){const size=Math.min(host.clientWidth*.72,host.clientHeight*.72,470);model.scale.set(size/Math.max(internal.width,internal.height));model.position.set((host.clientWidth-model.width)/2,host.clientHeight*.43-model.height/2)}
 new ResizeObserver(layout).observe(host);layout();
 P.bounds=step=>{const b=internal.getDrawableBounds((step===0?top:left).i),a=model.toGlobal(new PIXI.Point(b.x,b.y)),z=model.toGlobal(new PIXI.Point(b.x+b.width,b.y+b.height));return {left:Math.min(a.x,z.x)-12,right:Math.max(a.x,z.x)+12,top:Math.min(a.y,z.y)-12,bottom:Math.max(a.y,z.y)+12}};
 P.cut=async step=>{if(P.busy||!P.ready)return false;P.busy=true;const rev=revision;await expression(step===0?'cut_top':'cut_left');if(rev!==revision)return false;await expression(step===0?'forestmove1':'forestmove2');if(rev!==revision)return false;P.busy=false;return true};
 P.reset=()=>{revision++;if(transition){const end=transition.resolve;transition=null;end()}for(const id of Object.keys(values))values[id]=0;P.busy=false};
 P.debug=()=>({parts,values:{...values},bounds:[P.bounds(0),P.bounds(1)],parameters:core._model.parameters.ids,canvas:[internal.width,internal.height]});
 P.ready=true;notice.hidden=true;document.querySelector('.word').hidden=true;document.getElementById('demo').disabled=false;
 }catch(e){console.error(e);notice.textContent='模型載入失敗，請重新整理再試。';}
})();
