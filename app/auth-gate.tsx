"use client";

import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useRef, useState } from "react";
import Workspace from "./workspace";

type PublicAuthConfig={url:string;anonKey:string};

function Mark(){return <div className="tx-mark"><b>T</b><span>X</span></div>}
function displayName(session:Session){const metadata=session.user.user_metadata;return String(metadata.full_name||metadata.name||session.user.email?.split("@")[0]||"Tag X user")}

export default function AuthGate(){
  const clientRef=useRef<SupabaseClient|null>(null);
  const [session,setSession]=useState<Session|null>(null);
  const [ready,setReady]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");

  useEffect(()=>{
    let active=true;
    let unsubscribe:(()=>void)|undefined;
    void (async()=>{
      try{
        const response=await fetch("/api/auth/config",{cache:"no-store"});
        if(!response.ok)throw new Error("Google sign-in is not configured yet.");
        const config=await response.json() as PublicAuthConfig;
        const client=createClient(config.url,config.anonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
        clientRef.current=client;
        const {data,error:sessionError}=await client.auth.getSession();
        if(sessionError)throw sessionError;
        if(active)setSession(data.session);
        const listener=client.auth.onAuthStateChange((_event,nextSession)=>{if(active)setSession(nextSession)});
        unsubscribe=()=>listener.data.subscription.unsubscribe();
      }catch(cause){if(active)setError(cause instanceof Error?cause.message:"Google sign-in could not be loaded.")}
      finally{if(active)setReady(true)}
    })();
    return()=>{active=false;unsubscribe?.()};
  },[]);

  async function signIn(){
    const client=clientRef.current;if(!client)return;
    setBusy(true);setError("");
    const {error:signInError}=await client.auth.signInWithOAuth({provider:"google",options:{redirectTo:window.location.origin,queryParams:{prompt:"select_account"}}});
    if(signInError){setError(signInError.message);setBusy(false)}
  }
  async function signOut(){
    const client=clientRef.current;
    if(client){const {error:signOutError}=await client.auth.signOut();if(signOutError){setError(signOutError.message);return}}
    setSession(null);
  }

  if(session?.access_token&&session.user.email)return <Workspace accessToken={session.access_token} onSignOut={signOut} user={{displayName:displayName(session),email:session.user.email}}/>;
  return <main className="login-screen"><section className="login-card"><Mark/><span>TAG X</span><h1>Football video intelligence</h1><p>Sign in directly with Google to manage your matches, teams and analysis.</p><button className="google-login" disabled={!ready||busy||Boolean(error)} onClick={()=>void signIn()}><i>G</i>{busy?"Opening Google…":"Continue with Google"}</button><small>Personal Gmail and Google Workspace accounts</small>{error&&<p className="login-error" role="alert">{error}</p>}</section></main>;
}
