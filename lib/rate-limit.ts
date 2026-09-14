import { NextRequest, NextResponse } from "next/server";

type Counter={count:number;resetAt:number};
const counters=new Map<string,Counter>();

export function enforceRateLimit(request:NextRequest,bucket:string,limit=30,windowMs=60_000):NextResponse|null{
  const forwarded=request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip=forwarded||request.headers.get("x-real-ip")||"unknown";
  const key=`${bucket}:${ip}`;const now=Date.now();const current=counters.get(key);
  if(!current||current.resetAt<=now){counters.set(key,{count:1,resetAt:now+windowMs});return null}
  if(current.count>=limit){const retryAfter=Math.max(1,Math.ceil((current.resetAt-now)/1000));return NextResponse.json({error:"Terlalu banyak permintaan. Silakan tunggu sebentar lalu coba kembali."},{status:429,headers:{"Retry-After":String(retryAfter)}})}
  current.count+=1;return null;
}
