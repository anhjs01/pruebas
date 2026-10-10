import{CONFIG}from"./config.js";import{getAll,getByKey,put,del}from"./db.js";const localISODate=(date=new Date())=>[date.getFullYear(),String(date.getMonth()+1).padStart(2,"0"),String(date.getDate()).padStart(2,"0")].join("-");export async function activeLot(){const m=await getByKey(CONFIG.meta,"activeLot");return m?.value?getByKey(CONFIG.lots,m.value):null}export async function ensureLot(){let l=await activeLot();if(l)return l;const d=new Date(),x={id:"lot-"+crypto.randomUUID(),name:"Lote "+d.toLocaleDateString("es-CO"),date:localISODate(d),createdAt:d.toISOString(),status:"active",observations:""};await put(CONFIG.lots,x);await put(CONFIG.meta,{key:"activeLot",value:x.id});return x}export const listLots=()=>getAll(CONFIG.lots);export async function selectLot(id){if(await getByKey(CONFIG.lots,id))await put(CONFIG.meta,{key:"activeLot",value:id})}export async function createLot(name,date,observations=""){const d=new Date(),x={id:"lot-"+crypto.randomUUID(),name:name||"Lote "+d.toLocaleDateString("es-CO"),date:date||localISODate(d),createdAt:d.toISOString(),status:"active",observations};await put(CONFIG.lots,x);await selectLot(x.id);return x}export async function updateLot(x){await put(CONFIG.lots,x);return x}export async function deleteLot(id){
  const [units, lots, meta] = await Promise.all([
    getAll(CONFIG.store),
    getAll(CONFIG.lots),
    getAll(CONFIG.meta)
  ]);
  const lot = lots.find(item => item.id === id);
  if (!lot) return;

  const unitIds = units
    .filter(unit => unit.lotId === id)
    .map(unit => String(unit.unitId || "").trim())
    .filter(Boolean);

  const metaMap = new Map(meta.map(item => [item.key, item]));
  const deletedIds = Array.isArray(metaMap.get("deletedIds")?.value)
    ? [...metaMap.get("deletedIds").value]
    : [];
  const seenUnitIds = new Set(deletedIds.map(value => String(value).trim().toLowerCase()));
  for (const unitId of unitIds) {
    const normalized = unitId.toLowerCase();
    if (!seenUnitIds.has(normalized)) {
      deletedIds.push(unitId);
      seenUnitIds.add(normalized);
    }
  }

  const deletedLots = Array.isArray(metaMap.get("deletedLots")?.value)
    ? [...metaMap.get("deletedLots").value]
    : [];
  if (!deletedLots.includes(id)) deletedLots.push(id);

  metaMap.set("deletedIds", { key: "deletedIds", value: deletedIds });
  metaMap.set("deletedLots", { key: "deletedLots", value: deletedLots });

  const active = metaMap.get("activeLot");
  if (active?.value === id) metaMap.delete("activeLot");

  // El borrado, sus tombstones y la selección activa se guardan en una
  // única transacción para no dejar un lote parcialmente eliminado.
  await replaceStoresAtomically({
    [CONFIG.store]: units.filter(unit => unit.lotId !== id),
    [CONFIG.lots]: lots.filter(item => item.id !== id),
    [CONFIG.meta]: [...metaMap.values()]
  });
}
