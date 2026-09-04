// @ts-nocheck
import { palette } from '../core/engine';
export default function PalettePicker({selected,onSelect}){
 return <div className="card"><div className="card-hd"><div><h2>色卡</h2><p>MARD 221</p></div><b>{selected}</b></div><div className="palette-grid">{palette.map(c=><button key={c.code} title={`${c.code} ${c.hex}`} className={selected===c.code?'active':''} onClick={()=>onSelect(c.code)}><i style={{background:c.hex}}/><span>{c.code}</span></button>)}</div></div>
}
