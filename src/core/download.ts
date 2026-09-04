export function downloadText(text:string,name:string,type='text/plain;charset=utf-8'){
  const blob=new Blob([text],{type});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),500);
}
export function downloadJson(data:unknown,name:string){downloadText(JSON.stringify(data,null,2),name,'application/json;charset=utf-8')}
export function downloadCsv(rows:Record<string,unknown>[],name:string){if(!rows.length)return;const headers=Object.keys(rows[0]);const esc=(v:unknown)=>`"${String(v??'').replace(/"/g,'""')}"`;downloadText('\ufeff'+[headers.map(esc).join(','),...rows.map(r=>headers.map(h=>esc(r[h])).join(','))].join('\n'),name,'text/csv;charset=utf-8')}
