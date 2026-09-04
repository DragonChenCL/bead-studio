export function downloadJson(data:unknown,name:string){ const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),500); }
export function downloadCsv(rows:(string|number)[][],name:string){
  const esc=(v:string|number)=>`"${String(v??'').replace(/"/g,'""')}"`;
  const text='\ufeff'+rows.map(r=>r.map(esc).join(',')).join('\n');
  const blob=new Blob([text],{type:'text/csv;charset=utf-8'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500);
}
