// @ts-nocheck
import { palette, paletteByCode } from '../core/engine';

export default function PalettePicker({selected,onSelect}){
  const current=paletteByCode.get(selected)||palette[0];
  return <div className="card palette-card">
    <div className="card-hd palette-card-head">
      <div><h2>色卡</h2><p>MARD 221 · 点击色块即可换画笔颜色</p></div>
      <div className="selected-color-preview">
        <i style={{background:current?.hex}}/>
        <span><b>{current?.code}</b><small>{current?.hex}</small></span>
      </div>
    </div>
    <div className="palette-grid">
      {palette.map(c=><button
        key={c.code}
        data-help={`选择 ${c.code}（${c.hex}）作为当前画笔颜色。之后用“画笔”点击或拖动图纸即可使用这个颜色。`}
        className={selected===c.code?'active':''}
        onClick={()=>onSelect(c.code)}
      >
        <i style={{background:c.hex}}/>
        <span>{c.code}</span>
        <small>{c.hex}</small>
      </button>)}
    </div>
  </div>
}
