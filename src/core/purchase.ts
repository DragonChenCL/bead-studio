import type { Inventory, Pattern } from './types';
import { paletteByCode, summarizeUsage } from './engine';

export type PurchaseRow={code:string;need:number;stock:number;shortage:number;packs:number;buyQty:number;surplus:number;hex?:string};
export function buildPurchasePlan(pattern:Pattern|null,inventory:Inventory,packSize=1000):PurchaseRow[]{
  if(!pattern)return [];
  const size=Math.max(1,Math.floor(Number(packSize)||1000));
  return summarizeUsage(pattern.cells).map(u=>{
    const stock=Math.max(0,Math.floor(Number(inventory[u.code])||0));
    const shortage=Math.max(0,u.count-stock);
    const packs=shortage?Math.ceil(shortage/size):0;
    const buyQty=packs*size;
    return {code:u.code,need:u.count,stock,shortage,packs,buyQty,surplus:stock+buyQty-u.count,hex:paletteByCode.get(u.code)?.hex};
  }).filter(r=>r.shortage>0).sort((a,b)=>b.shortage-a.shortage);
}
export function applyPurchasePlan(inventory:Inventory,rows:PurchaseRow[]):Inventory{
  const next={...inventory};
  rows.forEach(r=>{next[r.code]=(Number(next[r.code])||0)+r.buyQty});
  return next;
}
