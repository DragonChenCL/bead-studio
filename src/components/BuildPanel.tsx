// @ts-nocheck
import { useMemo, useState } from 'react';
import { paletteByCode, summarizeUsage } from '../core/engine';

export default function BuildPanel({pattern,completed,onChange,onFocusCode,onToast,inventoryDeductedAt,onSettleInventory,onRestoreInventory}){
  const [focusCode,setFocusCode]=useState('');
  const done=useMemo(()=>new Set(completed||[]),[completed]);
  const usage=useMemo(()=>summarizeUsage(pattern?.cells||[]),[pattern]);
  const total=usage.reduce((s,u)=>s+u.count,0);
  const validDone=[...done].filter(i=>pattern?.cells?.[i]).length;
  const percent=total?Math.round(validDone*100/total):0;
  const rows=usage.map(u=>{
    let finished=0;
    pattern?.cells?.forEach((c,i)=>{if(c===u.code&&done.has(i))finished++});
    return {...u,finished,remaining:u.count-finished};
  });
  function select(code){setFocusCode(code);onFocusCode?.(code)}
  function markColor(code){if(!pattern)return;const next=new Set(done);pattern.cells.forEach((c,i)=>{if(c===code)next.add(i)});onChange([...next]);onToast?.(`${code} 已标记完成`,'ok')}
  function clear(){if(inventoryDeductedAt)return onToast?.('先撤销库存扣减再修改施工进度','bad');if(confirm('清空当前作品的施工进度？'))onChange([])}
  return <div className="card"><div className="card-hd"><div><h2>施工模式</h2><p>点画布逐颗打勾，也可以按色号分批完成</p></div><button onClick={clear}>清空进度</button></div><div className="card-bd">
    {!pattern?<div className="callout">先创建一个作品。</div>:<>
      <div className="build-summary"><div className="build-percent"><strong>{percent}%</strong><span>{validDone.toLocaleString()} / {total.toLocaleString()} 颗</span></div><div className="progress-line big"><span style={{width:`${percent}%`}}/></div></div>
      {inventoryDeductedAt?<div className="settlement-box done"><b>✓ 已完成并扣减豆库</b><span>库存已按这张图纸的实际用量扣除，图纸现在处于锁定状态。</span><button onClick={onRestoreInventory}>撤销扣库并解锁</button></div>:percent===100?<div className="settlement-box ready"><b>作品已经拼完</b><span>确认实物完成后，把本作品用掉的豆一次性从“我的豆库”扣除。</span><button className="primary" onClick={onSettleInventory}>完成作品并扣减豆库</button></div>:<div className="build-hint">进入“施工”页后直接点击图纸即可切换完成状态。选择某个色号后，其他颜色会淡化。达到 100% 后可一键扣减库存。</div>}
      <div className="build-color-list">{rows.slice(0,30).map(r=><div key={r.code} className={`build-color-row ${focusCode===r.code?'active':''}`}><button className="color-focus" onClick={()=>select(focusCode===r.code?'':r.code)}><i className="swatch" style={{background:paletteByCode.get(r.code)?.hex}}/><b>{r.code}</b></button><span>{r.finished}/{r.count}</span><button disabled={r.remaining===0||inventoryDeductedAt} onClick={()=>markColor(r.code)}>本色完成</button></div>)}</div>
    </>}
  </div></div>
}
