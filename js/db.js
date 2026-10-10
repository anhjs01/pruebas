import{CONFIG}from"./config.js";let p;export function openDB(){if(p)return p;p=new Promise((res,rej)=>{const r=indexedDB.open(CONFIG.dbName,CONFIG.dbVersion);r.onupgradeneeded=()=>{const d=r.result;if(!d.objectStoreNames.contains(CONFIG.store)){const s=d.createObjectStore(CONFIG.store,{keyPath:"id"});s.createIndex("lotId","lotId")}if(!d.objectStoreNames.contains(CONFIG.lots))d.createObjectStore(CONFIG.lots,{keyPath:"id"});if(!d.objectStoreNames.contains(CONFIG.meta))d.createObjectStore(CONFIG.meta,{keyPath:"key"})};r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)});return p}export async function getAll(store){const d=await openDB();return new Promise((res,rej)=>{const r=d.transaction(store).objectStore(store).getAll();r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}export async function getByKey(store,key){const d=await openDB();return new Promise((res,rej)=>{const r=d.transaction(store).objectStore(store).get(key);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}export async function put(store,v){const d=await openDB();return new Promise((res,rej)=>{const r=d.transaction(store,"readwrite").objectStore(store).put(v);r.onsuccess=()=>res(v);r.onerror=()=>rej(r.error)})}export async function del(store,key){const d=await openDB();return new Promise((res,rej)=>{const r=d.transaction(store,"readwrite").objectStore(store).delete(key);r.onsuccess=()=>res();r.onerror=()=>rej(r.error)})}export async function clearStore(store){for(const x of await getAll(store))await del(store,x.id??x.key)}export async function nextSequence(){const m=await getByKey(CONFIG.meta,"lastSequence"),n=Number(m?.value||0)+1;await put(CONFIG.meta,{key:"lastSequence",value:n});return n}
/**
 * Reemplaza varios almacenes en una sola transacción.
 * Si una escritura falla, IndexedDB aborta la transacción completa.
 */
export async function replaceStoresAtomically(replacements){
  const allowed=[CONFIG.store,CONFIG.lots,CONFIG.meta];
  if(!replacements||typeof replacements!=="object"||Array.isArray(replacements)){
    throw new Error("No se recibieron datos válidos para guardar.");
  }
  const names=Object.keys(replacements);
  if(!names.length||names.some(name=>!allowed.includes(name))||
    names.some(name=>!Array.isArray(replacements[name]))){
    throw new Error("Los almacenes o registros de sincronización no son válidos.");
  }
  const d=await openDB();
  return new Promise((resolve,reject)=>{
    let tx;
    try{
      tx=d.transaction(names,"readwrite");
      tx.oncomplete=()=>resolve();
      tx.onerror=()=>reject(tx.error||new Error("No se pudieron guardar los datos sincronizados."));
      tx.onabort=()=>reject(tx.error||new Error("La transacción de sincronización fue cancelada."));
      for(const name of names){
        const store=tx.objectStore(name);
        store.clear();
        for(const item of replacements[name]){
          if(!item||typeof item!=="object"||Array.isArray(item)){
            tx.abort();
            return;
          }
          store.put(item);
        }
      }
    }catch(error){
      try{tx?.abort()}catch{}
      reject(error);
    }
  });
}


/**
 * Guarda lotes de registros en varios almacenes dentro de una transacción.
 * No borra registros existentes; si una escritura falla, la operación se revierte.
 */
export async function putManyAtomically(entries){
  const allowed=[CONFIG.store,CONFIG.lots,CONFIG.meta];
  if(!Array.isArray(entries)||!entries.length||
    entries.some(entry=>!entry||!allowed.includes(entry.store)||!Array.isArray(entry.records))){
    throw new Error("Los registros para guardar no son válidos.");
  }
  const names=[...new Set(entries.map(entry=>entry.store))];
  const d=await openDB();
  return new Promise((resolve,reject)=>{
    let tx;
    try{
      tx=d.transaction(names,"readwrite");
      tx.oncomplete=()=>resolve();
      tx.onerror=()=>reject(tx.error||new Error("No se pudieron guardar los registros."));
      tx.onabort=()=>reject(tx.error||new Error("La operación de guardado fue cancelada."));
      for(const entry of entries){
        const store=tx.objectStore(entry.store);
        for(const record of entry.records){
          if(!record||typeof record!=="object"||Array.isArray(record)){
            tx.abort();
            return;
          }
          store.put(record);
        }
      }
    }catch(error){
      try{tx?.abort()}catch{}
      reject(error);
    }
  });
}
