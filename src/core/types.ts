export type Pattern = {
  id?: string;
  width:number;
  height:number;
  cells:(string|null)[];
  name:string;
  createdAt?:number;
  updatedAt?:number;
  inventoryDeductedAt?:number;
};
export type Inventory = Record<string, number>;
export type Point = { x:number; y:number };
export type ProjectRecord = { pattern: Pattern; completed: number[]; updatedAt: number };
export type OptimizationResult = { ok:boolean; reason?:string; missing?:number; changed?:number; avgDeltaEChanged?:number; maxDeltaE?:number; pattern?:Pattern; mapping?:Array<{from:string;to:string;count:number;deltaE:number}>; remaining?:Record<string,number> };
