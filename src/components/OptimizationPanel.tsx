// @ts-nocheck
import { useMemo, useState } from 'react';
import { optimizeBalanced, optimizeToInventory } from '../core/engine';

function failureText(result){
  if(!result) return '无法生成方案';
  if(result.reason==='TOTAL_INVENTORY_SHORT'){
    return `0 元版无法生成：当前图纸需要 ${Number(result.totalNeed||0).toLocaleString()} 颗，但豆库只有 ${Number(result.totalSupply||0).toLocaleString()} 颗，还差 ${Number(result.missing||0).toLocaleString()} 颗。请先补库存，或切到「平衡版」生成最少补豆方案。`;
  }
  if(result.reason==='NO_FEASIBLE_ASSIGNMENT') return '当前库存虽然总数够，但颜色组合无法完成整张图。可以切到「平衡版」允许少量补豆。';
  return '当前库存无法生成可用方案。';
}

export default function OptimizationPanel({pattern,inventory,onApply,onToast}){
 const [result,setResult]=useState(null),[busy,setBusy]=useState(false),[mode,setMode]=useState('zero'),[maxDeltaE,setMaxDeltaE]=useState(15);
 const total=useMemo(()=>pattern?.cells?.filter(Boolean).length||0,[pattern]);
 function run(){if(!pattern)return onToast?.('先创建图纸','bad');setBusy(true);setTimeout(()=>{try{const r=mode==='zero'?optimizeToInventory(pattern,inventory):optimizeBalanced(pattern,inventory,{maxDeltaE:Number(maxDeltaE)||15});setResult(r);if(!r.ok)onToast?.(failureText(r),'bad');else onToast?.('优化完成','ok')}catch(e){console.error(e);onToast?.('优化失败','bad')}finally{setBusy(false)}},20)}
 return <div className="card"><div className="card-hd"><div><h2>库存约束改图</h2><p>优先用你手上的豆</p></div><span className="badge">ΔE00</span></div><div className="card-bd">
   <div className="seg"><button className={mode==='zero'?'active':''} onClick={()=>{setMode('zero');setResult(null)}}>0元版</button><button className={mode==='balanced'?'active':''} onClick={()=>{setMode('balanced');setResult(null)}}>平衡版</button></div>
   {mode==='balanced'&&<label className="range-line"><span>最大替代 ΔE</span><input type="range" min="4" max="35" step="1" value={maxDeltaE} onChange={e=>setMaxDeltaE(e.target.value)}/><b>{maxDeltaE}</b></label>}
   <button className="primary full" disabled={!pattern||busy} onClick={run}>{busy?'计算中…':mode==='zero'?'按现有库存自动改图':'计算平衡方案'}</button>
   {!pattern&&<p className="muted">先上传图片生成图纸。</p>}
   {result?.ok&&<div className="opt-result"><div className="metrics small"><div><strong>{result.changed}</strong><span>替换颗数</span></div><div><strong>{Number(result.avgDeltaEChanged||0).toFixed(1)}</strong><span>平均ΔE</span></div><div><strong>{Number(result.missing||0)}</strong><span>需补买</span></div></div>{result.mapping?.length>0&&<div className="mapping-list">{result.mapping.slice(0,8).map((m,i)=><div key={i}><span>{m.from} → {m.to}</span><b>{m.count}颗 · ΔE {m.deltaE.toFixed(1)}</b></div>)}</div>}<button className="full" onClick={()=>onApply(result.pattern)}>应用这个方案</button></div>}
   {result&&!result.ok&&<div className="callout danger"><b>{failureText(result)}</b>{result.reason==='TOTAL_INVENTORY_SHORT'&&mode==='zero'&&<button className="full" style={{marginTop:10}} onClick={()=>{setMode('balanced');setResult(null)}}>切到平衡版</button>}</div>}
   {pattern&&<div className="mini-note">当前作品 {total.toLocaleString()} 颗。0元版要求总库存颗数至少覆盖整张图；平衡版允许少量补豆来保护明显色差。</div>}
 </div></div>
}
