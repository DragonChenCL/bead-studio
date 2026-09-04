import type { Inventory, Pattern, ProjectRecord } from './types';

const INV='bead-studio:inventory:v3';
const PROJECT='bead-studio:project:v3';
const LIBRARY='bead-studio:library:v3';
const LEGACY_INV='bead-studio:inventory:v2';
const LEGACY_PROJECT='bead-studio:project:v2';

function uid(){
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `bead-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
}

export function normalizePattern(input:Pattern):Pattern {
  const now=Date.now();
  return {
    ...input,
    id: input.id || uid(),
    createdAt: input.createdAt || now,
    updatedAt: now,
  };
}

export function loadInventory():Inventory {
  try {
    const raw=localStorage.getItem(INV) ?? localStorage.getItem(LEGACY_INV) ?? '{}';
    return JSON.parse(raw) || {};
  } catch { return {}; }
}
export function saveInventory(v:Inventory){ localStorage.setItem(INV, JSON.stringify(v)); }

export function loadProject():Pattern|null {
  try {
    const raw=localStorage.getItem(PROJECT) ?? localStorage.getItem(LEGACY_PROJECT) ?? 'null';
    const parsed=JSON.parse(raw);
    return parsed ? normalizePattern(parsed) : null;
  } catch { return null; }
}

function readLibrary():ProjectRecord[]{
  try {
    const data=JSON.parse(localStorage.getItem(LIBRARY)||'[]');
    return Array.isArray(data)?data:[];
  } catch { return []; }
}
function writeLibrary(records:ProjectRecord[]){
  localStorage.setItem(LIBRARY,JSON.stringify(records.slice(0,80)));
}

export function loadProjectLibrary():ProjectRecord[]{
  return readLibrary().sort((a,b)=>b.updatedAt-a.updatedAt);
}

export function saveProject(v:Pattern|null, completed:number[]=[]){
  if(!v){ localStorage.removeItem(PROJECT); return; }
  const p=normalizePattern(v);
  localStorage.setItem(PROJECT,JSON.stringify(p));
  const records=readLibrary();
  const idx=records.findIndex(r=>r.pattern?.id===p.id);
  const record={pattern:p,completed:[...new Set(completed)].sort((a,b)=>a-b),updatedAt:Date.now()};
  if(idx>=0) records[idx]=record; else records.unshift(record);
  writeLibrary(records);
}

export function saveProgress(pattern:Pattern|null, completed:number[]){
  if(!pattern?.id)return;
  const records=readLibrary();
  const idx=records.findIndex(r=>r.pattern?.id===pattern.id);
  if(idx<0){ saveProject(pattern,completed); return; }
  records[idx]={...records[idx],completed:[...new Set(completed)].sort((a,b)=>a-b),updatedAt:Date.now()};
  writeLibrary(records);
}

export function loadProgressFor(pattern:Pattern|null):number[]{
  if(!pattern?.id)return [];
  const rec=readLibrary().find(r=>r.pattern?.id===pattern.id);
  return rec?.completed || [];
}

export function deleteProjectRecord(id:string){
  writeLibrary(readLibrary().filter(r=>r.pattern?.id!==id));
  const current=loadProject();
  if(current?.id===id)localStorage.removeItem(PROJECT);
}

export function duplicateProjectRecord(record:ProjectRecord):ProjectRecord{
  const now=Date.now();
  const p=normalizePattern({...record.pattern,id:uid(),name:`${record.pattern.name} 副本`,createdAt:now,updatedAt:now,inventoryDeductedAt:undefined});
  const copy={pattern:p,completed:[],updatedAt:now};
  const records=readLibrary();records.unshift(copy);writeLibrary(records);return copy;
}
