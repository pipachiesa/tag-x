export type SupabaseUser={userId:string;email:string;displayName:string};

export async function getSupabaseUser(request:Request):Promise<SupabaseUser|null>{
  const url=process.env.SUPABASE_URL?.replace(/\/$/,"");
  const anonKey=process.env.SUPABASE_ANON_KEY;
  const authorization=request.headers.get("authorization");
  if(!url||!anonKey||!authorization?.startsWith("Bearer "))return null;
  const response=await fetch(`${url}/auth/v1/user`,{headers:{apikey:anonKey,Authorization:authorization},cache:"no-store"});
  if(!response.ok)return null;
  const user=await response.json() as {id?:string;email?:string;user_metadata?:Record<string,unknown>};
  if(!user.id||!user.email)return null;
  const metadata=user.user_metadata||{};
  return {userId:user.id,email:user.email,displayName:String(metadata.full_name||metadata.name||user.email.split("@")[0])};
}
