import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createDeviceKey, hashDeviceKey, parseTimeseries } from "@/modules/sensors/timeseries";
import { sha256Hex, extensionOf } from "@/core/ingest";
import type { Json } from "@/integrations/supabase/types";

const orgSchema=z.object({orgId:z.string().uuid()});
export const getSensors=createServerFn({method:"GET"}).middleware([requireSupabaseAuth])
  .inputValidator((d:{orgId:string})=>orgSchema.parse(d))
  .handler(async({data,context})=>{
    const [sensors,streams,objects,sources,keys]=await Promise.all([
      context.supabase.from("sensors").select("*").eq("org_id",data.orgId).order("created_at"),
      context.supabase.from("datastreams").select("*,rights_records(state)").eq("org_id",data.orgId).order("created_at"),
      context.supabase.from("objects").select("id,name").eq("org_id",data.orgId).limit(100),
      context.supabase.from("assets").select("id,file_name,ebit_id").eq("org_id",data.orgId).eq("adapter","sensor-timeseries").eq("ingestion_status","ready").limit(100),
      context.supabase.from("sensor_keys").select("id,org_id,datastream_id,name,key_prefix,revoked_at,created_at").eq("org_id",data.orgId),
    ]);
    if(sensors.error||streams.error) throw new Error("Could not load sensors.");
    return {sensors:sensors.data??[],streams:streams.data??[],objects:objects.data??[],sources:sources.data??[],keys:keys.data??[]};
  });
export const getMeasurements=createServerFn({method:"GET"}).middleware([requireSupabaseAuth])
  .inputValidator((d:{streamId:string;from?:string;to?:string;page?:number})=>z.object({streamId:z.string().uuid(),from:z.string().datetime({offset:true}).optional(),to:z.string().datetime({offset:true}).optional(),page:z.number().int().min(0).default(0)}).parse(d))
  .handler(async({data,context})=>{
    let query=context.supabase.from("measurements").select("id,observed_at,value,source,verification_status",{count:"exact"}).eq("datastream_id",data.streamId);
    if(data.from) query=query.gte("observed_at",data.from);
    if(data.to) query=query.lte("observed_at",data.to);
    const {data:rows,count,error}=await query.order("observed_at",{ascending:false}).range(data.page*100,data.page*100+99);
    if(error) throw new Error("Could not load readings.");
    return {rows:rows??[],total:count??0};
  });
const sensorSchema=orgSchema.extend({name:z.string().trim().min(1).max(200),description:z.string().max(2000),objectId:z.string().uuid().nullable()});
export const createSensor=createServerFn({method:"POST"}).middleware([requireSupabaseAuth])
  .inputValidator((d:z.input<typeof sensorSchema>)=>sensorSchema.parse(d))
  .handler(async({data,context})=>{
    const {error}=await context.supabase.rpc("register_sensor",{_org:data.orgId,_name:data.name,_description:data.description,...(data.objectId?{_object:data.objectId}:{})});
    if(error) throw new Error("Could not register device. Contributor access and an object in this workspace are required.");
    return {ok:true};
  });
const streamSchema=z.object({sensorId:z.string().uuid(),name:z.string().trim().min(1).max(200),property:z.string().trim().min(1).max(200),unit:z.string().trim().min(1).max(100)});
export const createStream=createServerFn({method:"POST"}).middleware([requireSupabaseAuth])
  .inputValidator((d:z.input<typeof streamSchema>)=>streamSchema.parse(d))
  .handler(async({data,context})=>{
    const {error}=await context.supabase.rpc("register_datastream",{_sensor:data.sensorId,_name:data.name,_property:data.property,_unit:data.unit});
    if(error) throw new Error("Could not create stream. Contributor access is required.");
    return {ok:true};
  });
export const importSensorFile=createServerFn({method:"POST"}).middleware([requireSupabaseAuth])
  .inputValidator((d:{streamId:string;assetId:string})=>z.object({streamId:z.string().uuid(),assetId:z.string().uuid()}).parse(d))
  .handler(async({data,context})=>{
    const {data:stream}=await context.supabase.from("datastreams").select("org_id").eq("id",data.streamId).single();
    if(!stream) throw new Error("Stream not found.");
    const {data:allowed}=await context.supabase.rpc("is_org_member",{_org:stream.org_id,_min:"curator"});
    if(!allowed) throw new Error("Curator access required for original imports.");
    const {data:asset}=await context.supabase.from("assets").select("storage_path,sha256,byte_size,file_name").eq("id",data.assetId).eq("org_id",stream.org_id).eq("adapter","sensor-timeseries").eq("ingestion_status","ready").single();
    if(!asset?.storage_path) throw new Error("Select a processed sensor original in this workspace.");
    const {data:blob}=await context.supabase.storage.from("originals").download(asset.storage_path);
    if(!blob) throw new Error("Could not read original.");
    const bytes=new Uint8Array(await blob.arrayBuffer());
    if(bytes.length!==asset.byte_size||await sha256Hex(bytes)!==asset.sha256) throw new Error("Original fingerprint mismatch.");
    const rows=parseTimeseries(new TextDecoder().decode(bytes),extensionOf(asset.file_name??"")===".json"?"json":"csv");
    const {data:result,error}=await context.supabase.rpc("import_sensor_measurements",{_stream:data.streamId,_asset:data.assetId,_rows:rows as unknown as Json});
    if(error) throw new Error("Import rejected: invalid readings or conflicting values at an existing timestamp. No changes saved.");
    return result as {added:number;skipped:number};
  });
export const issueDeviceKey=createServerFn({method:"POST"}).middleware([requireSupabaseAuth])
  .inputValidator((d:{streamId:string;name:string})=>z.object({streamId:z.string().uuid(),name:z.string().trim().min(1).max(100)}).parse(d))
  .handler(async({data,context})=>{
    const key=createDeviceKey();
    const {error}=await context.supabase.rpc("issue_sensor_key",{_stream:data.streamId,_name:data.name,_hash:await hashDeviceKey(key),_prefix:key.slice(0,20)});
    if(error) throw new Error("Could not issue key. Curator access required.");
    return {key};
  });
export const revokeDeviceKey=createServerFn({method:"POST"}).middleware([requireSupabaseAuth])
  .inputValidator((d:{id:string})=>z.object({id:z.string().uuid()}).parse(d))
  .handler(async({data,context})=>{const {error}=await context.supabase.rpc("revoke_sensor_key",{_key:data.id});if(error) throw new Error("Could not revoke key.");return {ok:true};});