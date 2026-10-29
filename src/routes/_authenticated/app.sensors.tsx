import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, type FormEvent } from "react";
import { Plus, KeyRound, Copy, Ban, Download, ChevronLeft, ChevronRight, Radio } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from "recharts";
import { toast } from "sonner";
import { getSensors, getMeasurements, createSensor, createStream, importSensorFile, issueDeviceKey, revokeDeviceKey } from "@/functions/sensors.functions";
import { listWorkspaces } from "@/functions/ingest.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const wsQuery=queryOptions({queryKey:["workspaces"],queryFn:()=>listWorkspaces()});
const sensorsQuery=(orgId:string)=>queryOptions({queryKey:["sensors",orgId],queryFn:()=>getSensors({data:{orgId}})});
const readingQuery=(streamId:string,from:string,to:string,page:number)=>queryOptions({queryKey:["sensor-readings",streamId,from,to,page],queryFn:()=>getMeasurements({data:{streamId,page,...(from?{from:`${from}T00:00:00Z`}:{}),...(to?{to:`${to}T23:59:59Z`}:{})}})});
export const Route=createFileRoute("/_authenticated/app/sensors")({
  loader:async({context})=>{const ws=await context.queryClient.ensureQueryData(wsQuery);if(ws[0]) await context.queryClient.ensureQueryData(sensorsQuery(ws[0].id));},
  head:()=>({meta:[{title:"Sensors & Time Series | EBiT Open Core"},{name:"description",content:"Registered devices, datastreams and original sensor measurements."},{property:"og:title",content:"Sensors & Time Series | EBiT Open Core"},{property:"og:description",content:"Registered devices, datastreams and original sensor measurements."},{property:"og:type",content:"website"},{name:"twitter:card",content:"summary"},{name:"robots",content:"noindex"}]}),
  component:SensorsPage,
});
const selectClass="mt-2 w-full rounded-md border border-input bg-background p-2 text-sm";
function SensorsPage(){const{data:ws}=useSuspenseQuery(wsQuery);if(!ws[0]) return <p>No workspace membership.</p>;return <SensorPanel orgId={ws[0].id} role={ws[0].role}/>;}
function SensorPanel({orgId,role}:{orgId:string;role:string}){
  const{data}=useSuspenseQuery(sensorsQuery(orgId));const qc=useQueryClient();
  const[sensorId,setSensorId]=useState("");const[streamId,setStreamId]=useState("");
  const[dialog,setDialog]=useState<"sensor"|"stream"|"import"|"key"|null>(null);const[busy,setBusy]=useState(false);const[newKey,setNewKey]=useState("");
  const register=useServerFn(createSensor),registerStream=useServerFn(createStream),importFile=useServerFn(importSensorFile),issue=useServerFn(issueDeviceKey),revoke=useServerFn(revokeDeviceKey);
  const canWrite=role!=="viewer",canCurate=["admin","curator"].includes(role);
  const selectedSensor=sensorId||data.sensors[0]?.id||"";const streams=data.streams.filter(s=>s.sensor_id===selectedSensor);const selectedStream=streams.find(s=>s.id===streamId)??streams[0];
  const refresh=async()=>{await qc.invalidateQueries({queryKey:["sensors",orgId]});await qc.invalidateQueries({queryKey:["sensor-readings"]});};
  async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();const f=new FormData(e.currentTarget);const s=(key:string)=>String(f.get(key)??"").trim();setBusy(true);
    try{
      if(dialog==="sensor") await register({data:{orgId,name:s("name"),description:s("description"),objectId:s("objectId")||null}});
      if(dialog==="stream") await registerStream({data:{sensorId:selectedSensor,name:s("name"),property:s("property"),unit:s("unit")}});
      if(dialog==="import"&&selectedStream){const r=await importFile({data:{streamId:selectedStream.id,assetId:s("assetId")}});toast.success(`${r.added} imported · ${r.skipped} already present`);}
      if(dialog==="key"&&selectedStream){const r=await issue({data:{streamId:selectedStream.id,name:s("name")}});setNewKey(r.key);}
      else setDialog(null);
      await refresh();
    }catch(e){toast.error(e instanceof Error?e.message:"Request failed.");}finally{setBusy(false);}
  }
  const open=(d:typeof dialog)=>{setNewKey("");setDialog(d);};
  return <div className="max-w-6xl space-y-6"><header className="flex flex-wrap items-center justify-between gap-4"><div><h1 className="text-3xl font-bold">Sensors</h1><p className="mt-2 text-sm text-muted-foreground">{data.sensors.length} devices · {data.streams.length} datastreams</p></div>{canWrite&&<Button onClick={()=>open("sensor")}><Plus className="h-4 w-4"/>Register device</Button>}</header>
    {!data.sensors.length?<p className="border-y border-border py-12 text-muted-foreground">No devices registered.</p>:<>
      <div className="grid gap-4 sm:grid-cols-2"><div><Label htmlFor="sensor-select">Device</Label><select id="sensor-select" className={selectClass} value={selectedSensor} onChange={e=>{setSensorId(e.target.value);setStreamId("");}}>{data.sensors.map(s=><option key={s.id} value={s.id}>{s.name} · {s.ebit_id}</option>)}</select></div><div><Label htmlFor="stream-select">Datastream</Label><select id="stream-select" className={selectClass} value={selectedStream?.id??""} onChange={e=>setStreamId(e.target.value)}>{!streams.length&&<option value="">No streams</option>}{streams.map(s=><option key={s.id} value={s.id}>{s.name} ({s.unit})</option>)}</select></div></div>
      <div className="flex flex-wrap gap-2">{canWrite&&<Button variant="outline" onClick={()=>open("stream")}><Plus className="h-4 w-4"/>Add datastream</Button>}{canCurate&&selectedStream&&<><Button variant="outline" onClick={()=>open("import")}><Download className="h-4 w-4"/>Import original</Button><Button variant="outline" onClick={()=>open("key")}><KeyRound className="h-4 w-4"/>Issue ingestion key</Button></>}</div>
      {selectedStream?<><div className="border-y border-border py-4"><h2 className="text-xl font-semibold">{selectedStream.observed_property}</h2><p className="mt-1 text-sm text-muted-foreground">{selectedStream.ebit_id} · {selectedStream.unit} · rights: {selectedStream.rights_records?.state.replaceAll("_"," ")??"unknown"}</p></div><Readings streamId={selectedStream.id} unit={selectedStream.unit}/>
        {canCurate&&<section><h2 className="mb-3 text-lg font-semibold">Ingestion keys</h2>{!data.keys.some(k=>k.datastream_id===selectedStream.id)&&<p className="text-sm text-muted-foreground">No ingestion keys.</p>}{data.keys.filter(k=>k.datastream_id===selectedStream.id).map(k=><div key={k.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-border py-3"><div><p className="text-sm">{k.name}</p><p className="font-mono text-xs text-muted-foreground">{k.key_prefix}… · {k.revoked_at?"revoked":"active"}</p></div>{!k.revoked_at&&<Button variant="ghost" size="icon" aria-label={`Revoke ${k.name}`} onClick={async()=>{try{await revoke({data:{id:k.id}});await refresh();toast.success("Key revoked.");}catch(e){toast.error(String(e));}}}><Ban className="h-4 w-4"/></Button>}</div>)}</section>}
      </>:<p className="py-6 text-muted-foreground">No datastreams for this device.</p>}
    </>}
    <Dialog open={dialog!==null} onOpenChange={v=>{if(!v){setDialog(null);setNewKey("");}}}><DialogContent className="max-h-[85vh] overflow-y-auto"><DialogHeader><DialogTitle>{dialog==="sensor"?"Register device":dialog==="stream"?"Add datastream":dialog==="import"?"Import sensor original":"Issue ingestion key"}</DialogTitle></DialogHeader>
      {newKey?<div className="space-y-4"><p className="text-sm text-heritage">Save this key now. It will not be displayed again.</p><code className="block break-all rounded-md bg-muted p-3 text-xs">{newKey}</code><Button variant="outline" onClick={()=>navigator.clipboard.writeText(newKey).then(()=>toast.success("Key copied."))}><Copy className="h-4 w-4"/>Copy key</Button><p className="text-sm text-muted-foreground">POST /api/public/sensors/ingest · Authorization: Bearer &lt;key&gt;</p></div>:<form onSubmit={submit} className="space-y-4">
      {dialog!=="import"&&<div><Label htmlFor="sensor-name">Name</Label><Input id="sensor-name" name="name" required maxLength={dialog==="key"?100:200}/></div>}
      {dialog==="sensor"&&<><div><Label htmlFor="sensor-description">Description</Label><Input id="sensor-description" name="description" maxLength={2000}/></div><div><Label htmlFor="sensor-object">Physical object (optional)</Label><select id="sensor-object" name="objectId" className={selectClass}><option value="">Not linked</option>{data.objects.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select></div></>}
      {dialog==="stream"&&<><div><Label htmlFor="sensor-property">Observed property</Label><Input id="sensor-property" name="property" required maxLength={200}/></div><div><Label htmlFor="sensor-unit">Unit</Label><Input id="sensor-unit" name="unit" required maxLength={100}/></div></>}
      {dialog==="import"&&<><Label htmlFor="sensor-original">Stored original</Label><select id="sensor-original" name="assetId" className={selectClass} required><option value="">Select a sensor file</option>{data.sources.map(s=><option key={s.id} value={s.id}>{s.file_name} · {s.ebit_id}</option>)}</select><Button variant="link" asChild><Link to="/app/ingestion">Upload CSV / JSON</Link></Button></>}
      <Button disabled={busy} className="w-full">{busy?"Saving…":dialog==="import"?"Import readings":dialog==="key"?"Generate key":"Save"}</Button>
    </form>}</DialogContent></Dialog>
  </div>;
}
function Readings({streamId,unit}:{streamId:string;unit:string}){
  const[from,setFrom]=useState("");const[to,setTo]=useState("");const[page,setPage]=useState(0);
  const{data}=useSuspenseQuery(readingQuery(streamId,from,to,page));
  const rows=[...data.rows].reverse().map(r=>({...r,time:new Date(r.observed_at).getTime()}));
  return <section className="space-y-4"><div className="flex flex-wrap items-end gap-4"><div><Label htmlFor="sensor-from">From (UTC)</Label><Input id="sensor-from" type="date" value={from} onChange={e=>{setFrom(e.target.value);setPage(0);}}/></div><div><Label htmlFor="sensor-to">To (UTC)</Label><Input id="sensor-to" type="date" value={to} min={from} onChange={e=>{setTo(e.target.value);setPage(0);}}/></div><span className="pb-2 text-sm text-muted-foreground">{data.total} readings · unverified</span></div>
    {!rows.length?<div className="flex items-center gap-3 border-y border-border py-12 text-muted-foreground"><Radio className="h-5 w-5"/>No readings in this date range.</div>:<>
      <div className="sensor-chart h-72 w-full" role="img" aria-label={`${unit} time-series chart of ${rows.length} readings`}><ResponsiveContainer width="100%" height="100%"><LineChart data={rows} margin={{top:10,right:20,left:0,bottom:10}}><CartesianGrid stroke="var(--border)" strokeDasharray="3 3"/><XAxis dataKey="time" type="number" domain={["dataMin","dataMax"]} tickFormatter={v=>{const span=rows.length>1?Math.abs(rows[rows.length-1]!.time-rows[0]!.time):0;const d=new Date(v);return span>2*86400000?d.toLocaleDateString([],{year:"numeric",month:"short",timeZone:"UTC"}):d.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit",timeZone:"UTC"});}} stroke="var(--muted-foreground)"/><YAxis stroke="var(--muted-foreground)"/><Tooltip labelFormatter={v=>new Date(Number(v)).toISOString()} contentStyle={{background:"var(--popover)",borderColor:"var(--border)",color:"var(--foreground)"}}/><Line type="linear" dataKey="value" name={unit} stroke="var(--water)" dot={{r:3}} isAnimationActive={false}/></LineChart></ResponsiveContainer></div>
      <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b border-border text-muted-foreground"><th className="py-2">Timestamp (UTC)</th><th>Value ({unit})</th><th>Source</th></tr></thead><tbody>{data.rows.map(r=><tr key={r.id} className="border-b border-border"><td className="whitespace-nowrap py-2 font-mono text-xs">{new Date(r.observed_at).toISOString()}</td><td>{r.value}</td><td>{r.source}</td></tr>)}</tbody></table></div>
      <div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">Page {page+1} · chart shows this page</span><div className="flex gap-2"><Button variant="outline" size="icon" aria-label="Previous readings" disabled={!page} onClick={()=>setPage(page-1)}><ChevronLeft className="h-4 w-4"/></Button><Button variant="outline" size="icon" aria-label="Next readings" disabled={(page+1)*100>=data.total} onClick={()=>setPage(page+1)}><ChevronRight className="h-4 w-4"/></Button></div></div>
    </>}
  </section>;
}