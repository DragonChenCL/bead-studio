// @ts-nocheck
import { useMemo, useState } from 'react';
import { palette, paletteByCode, summarizeUsage } from '../core/engine';
import { applyPurchasePlan, buildPurchasePlan } from '../core/purchase';
import { downloadCsv } from '../core/download';

export default function InventoryPanel({pattern,inventory,onChange,onToast}){
  const [query,setQuery]=useState(''),[packSize,setPackSize]=useState(1000);
  const usage=useMemo(()=>summarizeUsage(pattern?.cells||[]),[pattern]);
  const needs=useMemo(()=>new Map(usage.map(x=>[x.code,x.count])),[usage]);
  const purchase=useMemo(()=>buildPurchasePlan(pattern,inventory,packSize),[pattern,inventory,packSize]);
  const filtered=palette.filter(c=>!query||c.code.toLowerCase().includes(query.toLowerCase())).slice(0,221);
  function setStock(code,v){onChange({...inventory,[code]:Math.max(0,Math.floor(Number(v)||0))})}
  function fillNeeds(){const next={...inventory};usage.forEach(u=>{next[u.code]=u.count});onChange(next);onToast?.('已按当前图纸需求填满库存','ok')}
  function clearInventory(){if(confirm('清空全部豆库数量？'))onChange({})}
  function buyAll(){if(!purchase.length)return;onChange(applyPurchasePlan(inventory,purchase));onToast?.(`已将 ${purchase.reduce((s,r)=>s+r.buyQty,0).toLocaleString()} 颗采购量入库`,'ok')}
  function exportPlan(){if(!purchase.length)return onToast?.('当前无需采购');downloadCsv(purchase.map(r=>({色号:r.code,需要:r.need,库存:r.stock,缺口:r.shortage,购买包数:r.packs,购买颗数:r.buyQty,买后余量:r.surplus})),`拼豆采购清单-${new Date().toISOString().slice(0,10)}.csv`)}
  return <div className="inventory-layout"><div className="card"><div className="card-hd"><div><h2>我的豆库</h2><p>库存只保存在这个浏览器</p></div><div className="toolbar"><button onClick={fillNeeds}>按图纸填满</button><button onClick={clearInventory}>清空</button></div></div><div className="card-bd"><input className="search" placeholder="搜索色号，例如 C4" value={query} onChange={e=>setQuery(e.target.value)}/><div className="inventory-grid">{filtered.map(c=>{const need=needs.get(c.code)||0,stock=Number(inventory[c.code])||0;return <div className={`inv-item ${need>stock?'short':''}`} key={c.code}><i className="swatch big" style={{background:c.hex}}/><b>{c.code}</b><input type="number" min="0" value={stock} onChange={e=>setStock(c.code,e.target.value)}/>{need>0&&<span>需 {need}{need>stock?` · 缺 ${need-stock}`:''}</span>}</div>})}</div></div></div>
  <div className="card"><div className="card-hd"><div><h2>缺豆采购计划</h2><p>按包计算需要购买多少</p></div><label className="inline-field">每包 <input type="number" min="1" value={packSize} onChange={e=>setPackSize(Number(e.target.value)||1000)}/> 颗</label></div><div className="card-bd">{!pattern?<div className="callout">先创建图纸后才能计算采购计划。</div>:purchase.length===0?<div className="callout success">当前库存已经覆盖整张图纸，不需要采购。</div>:<><div className="metrics"><div><strong>{purchase.length}</strong><span>缺少色号</span></div><div><strong>{purchase.reduce((s,r)=>s+r.shortage,0).toLocaleString()}</strong><span>实际缺豆</span></div><div><strong>{purchase.reduce((s,r)=>s+r.packs,0)}</strong><span>需要购买包</span></div><div><strong>{purchase.reduce((s,r)=>s+r.buyQty,0).toLocaleString()}</strong><span>计划采购颗数</span></div></div><div className="toolbar plan-actions"><button className="primary" onClick={buyAll}>买完了，一键入库</button><button onClick={exportPlan}>导出 CSV</button></div><div className="table-wrap"><table><thead><tr><th>色号</th><th>需求</th><th>库存</th><th>缺口</th><th>购买</th><th>买后余量</th></tr></thead><tbody>{purchase.map(r=><tr key={r.code}><td><span className="with-swatch"><i className="swatch" style={{background:paletteByCode.get(r.code)?.hex}}/>{r.code}</span></td><td>{r.need}</td><td>{r.stock}</td><td className="danger">-{r.shortage}</td><td>{r.packs}包 / {r.buyQty}</td><td>{r.surplus}</td></tr>)}</tbody></table></div></>}</div></div></div>
}
