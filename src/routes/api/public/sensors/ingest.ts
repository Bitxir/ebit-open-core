import { createFileRoute } from "@tanstack/react-router";
import { normalizeReadings, hashDeviceKey } from "@/modules/sensors/timeseries";
import type { Json } from "@/integrations/supabase/types";

export const Route=createFileRoute("/api/public/sensors/ingest")({server:{handlers:{POST:async({request})=>{
  const headers={"Cache-Control":"no-store"};
  const key=request.headers.get("Authorization")?.match(/^Bearer (ebit_sensor_[a-f0-9]{64})$/)?.[1];
  if(!key) return Response.json({error:"A valid device bearer key is required."},{status:401,headers});
  if(!request.headers.get("Content-Type")?.includes("application/json")) return Response.json({error:"JSON content required."},{status:415,headers});
  if(Number(request.headers.get("Content-Length"))>262144) return Response.json({error:"Request exceeds 256 KiB."},{status:413,headers});
  let text="";
  const reader=request.body?.getReader();
  if(!reader) return Response.json({error:"Missing body."},{status:400,headers});
  let size=0;const decoder=new TextDecoder();
  while(true){const chunk=await reader.read();if(chunk.done) break;size+=chunk.value.byteLength;if(size>262144){await reader.cancel();return Response.json({error:"Request exceeds 256 KiB."},{status:413,headers});}text+=decoder.decode(chunk.value,{stream:true});}
  text+=decoder.decode();
  let rows;
  try{const body=JSON.parse(text);if(!body||!Array.isArray(body.measurements)) throw new Error();rows=normalizeReadings(body.measurements);}catch{return Response.json({error:"Supply 1–1000 finite timestamp/value measurements with explicit timezones."},{status:400,headers});}
  const {supabaseAdmin}=await import("@/integrations/supabase/client.server");
  const {data,error}=await supabaseAdmin.rpc("ingest_sensor_key",{_hash:await hashDeviceKey(key),_rows:rows as unknown as Json});
  if(error) return Response.json({error:error.code==="28000"?"Invalid or revoked device key.":"Batch rejected. No changes saved."},{status:error.code==="28000"?401:409,headers});
  return Response.json(data,{status:200,headers});
}}}});