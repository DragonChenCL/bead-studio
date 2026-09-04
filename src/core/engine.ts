// @ts-nocheck
import { MARD_PALETTE } from './palette';

export const palette = MARD_PALETTE;
export const paletteByCode = new Map(palette.map(c => [c.code, c]));
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const rad=d=>d*Math.PI/180, deg=r=>r*180/Math.PI;

function srgb(v){v/=255;return v<=.04045?v/12.92:Math.pow(hv+.055)/1.055,2.4)}
export function rgbToLab([R,G,B]){
  const r=srgb(R),g=srgb(G),b=srgb(B);
  let x=(r*.4124564+g*.3575761+b*.1804375)/.95047;
  let y=(r*.2126729+g*.7151522+b*.0721750);
  let z=(r*.0193339+g*.1191920+b*.9503041)/1.08883;
  const f=t=>t>.008856?Math.cbrt(t):7.787*t+16/116;
  x=f(x);y=f(y);z=f(z);return [116*y-16,500*(x-y),200*(y-z)];
}
export function deltaE00(a,b){
  const [L1,a1,b1]=a,[L2,a2,b2]=b,avgL=(L1+L2)/2;
  const C1=Math.hypot(a1,b1),C2=Math.hypot(a2,b2),avgC=(C1+C2)/2;
  const G=.5*(1-Math.sqrt(avgC**7/(avgC**7+25**7)));
  const A1=(1+G)*a1,A2=(1+G)*a2,CP1=Math.hypot(A1,b1),CP2=Math.hypot(A2,b2),avgCP=(CP1+CP2)/2;
  const hp=(x,y)=>{if(!x&&!y)return 0;const h=deg(Math.atan2(y,x));return h<0?h+360:h};
  const h1=hp(A1,b1),h2=hp(A2,b2),dL=L2-L1,dC=CP2-CP1;
  let dh=CP1*CP2===0?0:h2-h1;if(dh>180)dh-=360;if(dh<-180)dh+=360;
  const dH=2*Math.sqrt(CP1*CP2)*Math.sin(rad(dh/2));
  let avgH;if(CP1*CP2===0)avgH=h1+h2;else if(Math.abs(h1-h2)<=180)avgH=(h1+h2)/2;else avgH=(h1+h2+(h1+h2<360?360:-360))/2;
  const T=1-.17*Math.cos(rad(avgH-30))+.24*Math.cos(rad(2*avgH))+.32*Math.cos(rad(3*avgH+6))-.2*Math.cos(rad(4*avgH-63));
  const dTheta=30*Math.exp(-Math.pow((avgH-275)/25,2)),Rc=2*Math.sqrt(avgCP**7/(avgCP**7+25**7));
  const Sl=1+.015*(avgL-50)**2/Math.sqrt(20+(avgL-50)**2),Sc=1+.045*avgCP,Sh=1+.015*avgCP*T,Rt=-Math.sin(rad(2*dTheta))*Rc;
  return Math.sqrt((dL/Sl)**2+(dC/Sc)**2+(dH/Sh)**2+Rt*(dC/Sc)*(dH/Sh));
}
palette.forEach(c=>c.lab=rgbToLab(c.rgb));
export function nearestColor(rgb,candidates=palette){
  const lab=rgbToLab(rgb);let best=candidates[0],distance=Infinity;
  for(const c of candidates){const d=deltaE00(lab,c.lab);if(d<distance){best=c;distance=d}}
  return {color:best,deltaE:distance};
}
export function summarizeUsage(cells=[]){
  const m=new Map();for(const code of cells)if(code)m.set(code,(m.get(code)||0)+1);
  return [...m].map(([code,count])=>({code,count,color:paletteByCode.get(code)})).sort((a,b)=>b.count-a.count);
}

class Edge{constructor(to,rev,cap,cost){this.to=to;this.rev=rev;this.cap=cap;this.cost=cost;this.orig=cap}}
function addEdge(g,a,b,cap,cost){const f=new Edge(b,g[b].length,cap,cost),r=new Edge(a,g[a].length,0,-cost);g[a].push(f);g[b].push(r);return f}
function minCostFlow(demands,supplies,costFn){
  const D=demands.length,S=supplies.length,N=D+S+2,src=N-2,sink=N-1,g=Array.from({length:N},()=>[]),pairs=Array.from({length:D},()=>Array(S));
  demands.forEach((d,i)=>addEdge(g,src,i,d.count,0));
  for(let i=0;i<D;i++)for(let j=0;j<S;j++)pairs[i][j]=addEdge(g,i,D+j,demands[i].count,Math.round(costFn(demands[i],supplies[j])*100)+(demands[i].code===supplies[j].code?0:1));
  supplies.forEach((s,j)=>addEdge(g,D+j,sink,s.count,0));
  const need=demands.reduce((n,d)=>n+d.count,0);let flow=0;
  while(flow<need){
    const dist=Array(N).fill(Infinity),pv=Array(N).fill(-1),pe=Array(N).fill(-1),inq=Array(N).fill(false),q=[src];dist[src]=0;inq[src]=true;
    for(let h=0;h<q.length;h++){const v=q[h];inq[v]=false;for(let k=0;k<g[v].length;k++){const e=g[v][k];if(e.cap<=0||dist[e.to]<=dist[v]+e.cost)continue;dist[e.to]=dist[v]+e.cost;pv[e.to]=v;pe[e.to]=k;if(!inq[e.to]){inq[e.to]=true;q.push(e.to)}}}
    if(!Number.isFinite(dist[sink]))break;let add=need-flow;for(let v=sink;v!==src;v=pv[v])add=Math.min(add,g[pv[v]][pe[v]].cap);
    for(let v=sink;v!==src;v=pv[v]){const e=g[pv[v]][pe[v]];e.cap-=add;g[v][e.rev].cap+=add}flow+=add;
  }
  const allocations=new Map();for(let i=0;i<D;i++){const a=[];for(let j=0;j<S;j++){const e=pairs[i][j],used=e.orig-e.cap;if(used)a.push({target:supplies[j].code,count:used,deltaE:costFn(demands[i],supplies[j])})}allocations.set(demands[i].code,a)}
  return {flow,need,allocations};
}
function componentOrder(cells,w,h,code){
  const seen=new Uint8Array(cells.length),all=[],dirs=[[1,0],[-1,0],[0,1],[0,-1]];
  for(let i=0;i<cells.length;i++){if(seen[i]||cells[i]!==code)continue;const comp=[],q=[i];seen[i]=1;for(let p=0;p<q.length;p++){const cur=q[p],x=cur%w,y=Math.floor(cur/w);comp.push(cur);for(const[dX,dY]of dirs){const nx=x+dX,ny=y+dY;if(nx<0||ny<0||nx>=w||ny>=h)continue;const ni=ny*w+nx;if(!seen[ni]&&cells[ni]===code){seen[ni]=1;q.push(ni)}}}all.push(comp)}
  all.sort((a,b)=>b.length-a.length);return all.flat();
}
export function optimizeToInventory(pattern,inventory){
  const cells=pattern.cells.slice(),usage=summarizeUsage(cells),need=usage.reduce((n,u)=>n+u.count,0);
  const supplies=palette.map(color=>({code:color.code,color,count:Math.max(0,Math.floor(Number(inventory[color.code])||0))})).filter(x=>x.count);
  const supply=supplies.reduce((n,s)=>n+s.count,0);if(supply<need)return {ok:false,reason:'TOTAL_INVENTORY_SHORT',totalNeed:need,totalSupply:supply,missing:need-supply};
  const demands=usage.map(u=>({code:u.code,count:u.count,color:u.color})),r=minCostFlow(demands,supplies,(d,s)=>deltaE00(d.color.lab,s.color.lab));
  if(r.flow<need)return {ok:false,reason:'NO_FEASIBLE_ASSIGNMENT'};
  const out=cells.slice(),mapping=[];let changed=0,weighted=0,maxDeltaE=0;
  for(const d of demands){let pos=0;const order=componentOrder(cells,pattern.width,pattern.height,d.code);const alloc=(r.allocations.get(d.code)||[]).sort((a,b)=>(a.target===d.code?-1:0)-(b.target===d.code?-1:0)||b.count-a.count);for(const a of alloc){for(let k=0;k<a.count;k++)out[order[pos++]]=a.target;if(a.target!==d.code){changed+=a.count;weighted+=a.count*a.deltaE;maxDeltaE=Math.max(maxDeltaE,a.deltaE);mapping.push({from:d.code,to:a.target,count:a.count,deltaE:a.deltaE})}}}
  const optimizedUsage=summarizeUsage(out),remaining={};supplies.forEach(s=>remaining[s.code]=s.count);optimizedUsage.forEach(u=>remaining[u.code]=(remaining[u.code]||0)-u.count);
  return {ok:true,pattern:{...pattern,cells:out},mapping:mapping.sort((a,b)=>b.count-a.count),changed,totalNeed:need,avgDeltaEChanged:changed?weighted/changed:0,maxDeltaE,remaining,optimizedUsage};
}
export function optimizeBalanced(pattern,inventory,opt={}){
  const maxDeltaE=Math.max(0,Number(opt.maxDeltaE)||15),packSize=Math.max(1,Math.floor(Number(opt.packSize)||1000)),base={};palette.forEach(c=>base[c.code]=Math.max(0,Math.floor(Number(inventory[c.code])||0)));
  const usage=summarizeUsage(pattern.cells),virtual={...base};let gap=Math.max(0,usage.reduce((n,u)=>n+u.count,0)-Object.values(base).reduce((n,v)=>n+v,0));
  for(const u of usage.sort((a,b)=>b.count-a.count)){if(!gap)break;const add=Math.min(gap,Math.max(0,u.count-(virtual[u.code]||0)));virtual[u.code]=(virtual[u.code]||0)+add;gap-=add}
  let result=optimizeToInventory(pattern,virtual);if(!result.ok)return result;
  for(let round=0;round<10;round++){const bad=(result.mapping||[]).filter(m=>m.deltaE>maxDeltaE);if(!bad.length)break;let added=0;for(const m of bad){const demand=usage.find(u=>u.code===m.from)?.count||0,cap=Math.max(0,demand-(virtual[m.from]||0)),add=Math.min(cap,m.count);if(add){virtual[m.from]=(virtual[m.from]||0)+add;added+=add}}if(!added)break;result=optimizeToInventory(pattern,virtual);if(!result.ok)break}
  if(!result.ok)return result;const purchase=[];let missing=0;for(const u of summarizeUsage(result.pattern.cells)){const count=Math.max(0,u.count-(base[u.code]||0));if(count){purchase.push({code:u.code,count,packs:Math.ceil(count/packSize)});missing+=count}}
  return {...result,mode:'balanced',maxDeltaE,purchase,purchaseBeads:missing,purchasePacks:purchase.reduce((n,p)=>n+p.packs,0),missing};
}

function solve(A,b){const n=b.length,M=A.map((r,i)=>[...r,b[i]]);for(let c=0;c<n;c++){let p=c;for(let r=c+1;r<n;r++)if(Math.abs(M[r][c])>Math.abs(M[p][c]))p=r;if(Math.abs(M[p][c])<1e-12)throw Error('singular');[M[c],M[p]]=[M[p],M[c]];const d=M[c][c];for(let j=c;j<=n;j++)M[c][j]/=d;for(let r=0;r<n;r++){if(r===c)continue;const f=M[r][c];for(let j=c;j<=n;j++)M[r][j]-=f*M[c][j]}}return M.map(r=>r[n])}
export function homographyFromRectToQuad(w,h,q){const s=[[0,0],[w,0],[w,h],[0,h]],A=[],b=[];for(let i=0;i<4;i++){const[x,y]=s[i],u=q[i].x,v=q[i].y;A.push([x,y,1,0,0,0,-u*x,-u*y]);b.push(u);A.push([0,0,0,x,y,1,-v*x,-v*y]);b.push(v)}const z=solve(A,b);return [z[0],z[1],z[2],z[3],z[4],z[5],z[6],z[7],1]}
function mapPoint(H,x,y){const d=H[6]*x+H[7]*y+1;return[(H[0]*x+H[1]*y+H[2])/d,(H[3]*x+H[4]*y+H[5])/d]}
function px(img,x,y){x=clamp(Math.round(x),0,img.width-1);y=clamp(Math.round(y),0,img.height-1);const i=(y*img.width+x)*4;return[img.data[i],img.data[i+1],img.data[i+2]]}
export function rectifyImageData(img,quad,w,h){const H=homographyFromRectToQuad(w-1,h-1,quad),data=new Uint8ClampedArray(w*h*4);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const[sx,sy]=mapPoint(H,x,y),p=px(img,sx,sy),i=(y*w+x)*4;data[i]=p[0];data[i+1]=p[1];data[i+2]=p[2];data[i+3]=255}return{data,width:w,height:h}}
function sampleRing(img,cx,cy,r,n=20){const a=[0,0,0];for(let i=0;i<n;i++){const p=px(img,cx+Math.cos(i*2*Math.PI/n)*r,cy+Math.sin(i*2*Math.PI/n)*r);a[0]+=p[0];a[1]+=p[1];a[2]+=p[2]}return a.map(v=>v/n)}
function sampleCenter(img,cx,cy,r){const a=[0,0,0];let n=0;for(let y=-3;y<=3;y++)for(let x=-3;x<=3;x++){if(x*x+y*y>9)continue;const p=px(img,cx+x*r/3,cy+y*r/3);a[0]+=p[0];a[1]+=p[1];a[2]+=p[2];n++}return a.map(v=>v/n)}
export function inspectPatternPhoto(pattern,img,opt={}){
  const cw=img.width/pattern.width,ch=img.height/pattern.height,t=Number(opt.deltaEThreshold)||13,occT=Number(opt.occupancyDeltaEThreshold)||4.2,results=[];let correct=0,wrong=0,uncertain=0,missing=0;
  for(let y=0;y<pattern.height;y++)for(let x=0;x<pattern.width;x++){const index=y*pattern.width+x,target=pattern.cells[index];if(!target)continue;const s=Math.min(cw,ch),ring=sampleRing(img,(x+.5)*cw,(y+.5)*ch,s*.28,24),center=sampleCenter(img,(x+.5)*cw,(y+.5)*ch,s*.085),occ=deltaE00(rgbToLab(ring),rgbToLab(center)),tc=paletteByCode.get(target),de=deltaE00(rgbToLab(ring),tc.lab),pred=nearestColor(ring).color.code;let status='ok';if(occ<occT){status='missing';missing++}else if(de>t*1.6){status='wrong';wrong++}else if(de>t){status='uncertain';uncertain++}else correct++;results.push({x,y,index,target,predicted:pred,deltaE:de,status,occupancyDeltaE:occ})}
  return{results,correct,wrong,uncertain,missing,total:correct+wrong+uncertain+missing,calibration:{gain:[1,1,1]}};
}
const lum=(r,g,b)=>.2126*r+.7152*g+.0722*b;
export function inspectIroningBacklight(pattern,img,opt={}){
  const cw=img.width/pattern.width,ch=img.height/pattern.height,underRatio=Number(opt.underRatio)||.58,overRatio=Number(opt.overRatio)||.12,results=[];let under=0,over=0,normal=0;
  for(let y=0;y<pattern.height;y++)for(let x=0;x<pattern.width;x++){const index=y*pattern.width+x;if(!pattern.cells[index])continue;const s=Math.min(cw,ch),cx=(x+.5)*cw,cy=(y+.5)*ch,ring=sampleRing(img,cx,cy,s*.34),rl=lum(...ring);let bright=0,total=0;for(let yy=-3;yy<=3;yy++)for(let xx=-3;xx<=3;xx++){if(xx*xx+yy*yy>9)continue;const p=px(img,cx+xx*s*.06,cy+yy*s*.06);if(lum(...p)>rl+22)bright++;total++}const ratio=bright/total;let status='normal';if(ratio>underRatio){status='under';under++}else if(ratio<overRatio){status='over';over++}else normal++;results.push({x,y,index,ratio,status})}
  const total=under+over+normal;return{results,under,over,normal,total,score:total?Math.max(0,100-Math.round((under+over)*100/total)):0};
}
export function buildPatternFromImageElement(img,width,opt={}){
  const height=Math.max(1,Math.min(Number(opt.maxHeight)||160,Math.round(width*img.naturalHeight/img.naturalWidth))),c=document.createElement('canvas');c.width=width;c.height=height;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.imageSmoothingEnabled=true;ctx.drawImage(img,0,0,width,height);const d=ctx.getImageData(0,0,width,height).data,cells=[];for(let i=0;i<width*height;i++)cells.push(d[i*4+3]<24?null:nearestColor([d[i*4],d[i*4+1],d[i*4+2]]).color.code);return{width,height,cells,name:opt.name||'新作品'};
}
