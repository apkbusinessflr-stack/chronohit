
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const ls={ get:(k,d=null)=>{try{const v=localStorage.getItem(k);return v?JSON.parse(v):d}catch(_){return d}}, set:(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(_){}} };
export const fmtMs=v=>v==null?'—':Math.round(v).toString();
