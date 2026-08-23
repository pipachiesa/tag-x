import { NextResponse } from "next/server";

export const runtime="edge";

export async function GET(){
  const url=process.env.SUPABASE_URL?.replace(/\/$/,"");
  const anonKey=process.env.SUPABASE_ANON_KEY;
  if(!url||!anonKey)return NextResponse.json({error:"Authentication is not configured"},{status:503});
  return NextResponse.json({url,anonKey},{headers:{"Cache-Control":"no-store"}});
}
