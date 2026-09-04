// @ts-nocheck
import { useState } from 'react';
import PalettePicker from './PalettePicker';
import OptimizationPanel from './OptimizationPanel';

export default function ToolDock({selectedCode,onSelect,pattern,inventory,onApply,onToast,usage}){
  const [tab,setTab]=useState('palette');
  const tabs=[['palette','选色','选择画笔要使用的拼豆颜色'],['opt','改图','按现有库存重新分配颜色，减少补豆'],['usage','用量','查看当前图纸最常使用的色号和数量']];
  return <div className="tool-dock card">
    <div className="tool-dock-head">
      <div><span>WORKBENCH</span><h2>右侧工具台</h2></div>
      <b>{pattern?`${pattern.width}×${pattern.height}`:'未创建'}</b>
    </div>
    <div className="tool-dock-tabs">{tabs.map(([key,name,help])=><button key={key} className={tab===key?'active':''} onClick={()=>setTab(key)} data-help={help}>{name}</button>)}</div>
    <div className="tool-dock-body">
      {tab==='palette'&&<PalettePicker selected={selectedCode} onSelect={onSelect}/>} 
      {tab==='opt'&&<OptimizationPanel pattern={pattern} inventory={inventory} onApply={onApply} onToast={onToast}/>} 
      {tab==='usage'&&<div className="dock-usage"><div className="dock-section-copy"><b>当前图纸用量</b><span>优先看高频色，备豆和施工都会更快。</span></div>{usage?.length?<div className="usage-bars">{usage.slice(0,12).map((row,i)=>{const max=usage[0]?.count||1;return <div key={row.code}><span><i className="swatch" style={{background:row.color?.hex}}/><b>{row.code}</b></span><div className="usage-meter"><i style={{width:`${Math.max(8,row.count/max*100)}%`}}/></div><strong>{row.count}</strong></div>})}</div>:<div className="dock-empty">上传图片后，这里会显示各个色号的实际用量。</div>}</div>}
    </div>
    <div className="tool-dock-foot"><span>提示</span><p>{tab==='palette'?'选中色卡后，画笔会立刻切换到该颜色。':tab==='opt'?'0 元版严格不买新豆；平衡版会为了保真允许少量补豆。':'施工时可以优先从用量最多的颜色开始。'}</p></div>
  </div>
}
