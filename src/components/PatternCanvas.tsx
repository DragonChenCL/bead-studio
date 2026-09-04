// @ts-nocheck
import { useEffect, useRef } from 'react';
import { paletteByCode } from '../core/engine';
export default function PatternCanvas({pattern,onPaint,completed=[],onToggleCompleted,focusCode='',mode='paint'}){
 const ref=useRef(null);const done=new Set(completed);
 useEffect(()=>{const c=ref.current;if(!c||!pattern)return;const size=16;c.width=pattern.width*size;c.height=pattern.height*size;const ctx=c.getContext('2d');ctx.clearRect(0,0,c.width,c.height);for(let i=0;i<pattern.cells.length;i++){const code=pattern.cells[i],x=i%pattern.width,y=Math.floor(i/pattern.width);if(!code)continue;const col=paletteByCode.get(code);ctx.globalAlpha=focusCode&&code!==focusCode?.35:1;ctx.fillStyle=col?.hex||'#ddd';ctx.beginPath();ctx.arc(x*size+size/2,y*size+size/2,size*.43,0,Math.PI*2);ctx.fill();ctx.fillStyle='rgba(255,255,255,.55)';ctx.beginPath();ctx.arc(x*size+size/2,y*size+size/2,size*.13,0,Math.PI*2);ctx.fill();if(done.has(i)){ctx.globalAlpha=1;ctx.strokeStyle='#193b31';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x*size+4,y*size+8);ctx.lineTo(x*size+7,y*size+11);ctx.lineTo(x*size+12,y*size+5);ctx.stroke()}}ctx.globalAlpha=1},[pattern,completed,focusCode]);
 function click(e){if(!pattern)return;const c=ref.current,r=c.getBoundingClientRect();const x=Math.floor((e.clientX-r.left)*c.width/r.width/16),y=Math.floor((e.clientY-r.top)*c.height/r.height/16);if(x<0||y<0||x>=pattern.width||y>=pattern.height)return;const i=y*pattern.width+x;if(mode==='build')onToggleCompleted?.(i);else onPaint?.(i)}
 return <div className="legacy-pattern"><canvas ref={ref} onClick={click}/></div>
}
