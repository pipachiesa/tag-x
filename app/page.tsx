"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type TeamCode = "RIV" | "BOC";
type View = "tagging" | "illustrator";
type PanelKey = "video" | "tagger" | "pitch" | "events";
type PanelRect = { x: number; y: number; w: number; h: number; z: number };
type Point = { x:number; y:number };
type MarkerShape = "circle" | "square" | "diamond" | "triangle";
type EventRecord = { id:number; minute:string; team:TeamCode; player:string; action:string; outcome:string; x:number; y:number; endX?:number; endY?:number; goalX?:number; goalY?:number; color?:string; marker?:MarkerShape };
type MatchSession = { id:string; matchName:string; competition:string; clock:number; events:EventRecord[] };

const COLS = 12;
const ROW = 62;
const playbackSpeeds = [0.25,0.5,1,1.5,2];
const actions = ["Pass","Shot","Cross","Carry","Recovery","Tackle","Interception","Clearance","Aerial duel","Foul"];
const routedActions = new Set(["Pass","Cross","Carry","Clearance"]);
const outcomes = ["Successful","Unsuccessful","Goal","Blocked","Saved","Off target","Won","Lost"];
const markerColors = ["#5b8def","#10a37f","#f4c95d","#ef6c75","#c084fc","#f3f3f3"];
const markerShapes:MarkerShape[] = ["circle","square","diamond","triangle"];
const PANEL_LAYOUT_STORAGE_KEY = "tagx-panel-layout-v2";
const players = ["01 F. Armani","02 S. Boselli","03 R. Funes Mori","05 M. Kranevitter","08 N. Fernández","10 M. Lanzini","11 F. Colidio","19 C. Echeverri"];
const seededEvents:EventRecord[] = [
  {id:128,minute:"42:08",team:"RIV",player:"10 M. Lanzini",action:"Pass",outcome:"Successful",x:32,y:61,endX:55,endY:43,color:"#5b8def",marker:"circle"},
  {id:127,minute:"41:54",team:"RIV",player:"11 F. Colidio",action:"Shot",outcome:"Blocked",x:84,y:42,goalX:63,goalY:44,color:"#ef6c75",marker:"diamond"},
  {id:126,minute:"41:31",team:"BOC",player:"09 M. Merentiel",action:"Recovery",outcome:"Won",x:57,y:72,color:"#f4c95d",marker:"square"},
  {id:125,minute:"40:48",team:"RIV",player:"08 N. Fernández",action:"Cross",outcome:"Successful",x:92,y:18,endX:79,endY:48,color:"#10a37f",marker:"triangle"},
];
const seededSessions:MatchSession[] = [
  {id:"river-boca",matchName:"River Plate vs Boca Juniors",competition:"Friendly · El Monumental",clock:2531,events:seededEvents},
  {id:"racing-independiente",matchName:"Racing Club vs Independiente",competition:"Liga Profesional · El Cilindro",clock:0,events:[]},
];
const defaultPanels:Record<PanelKey,PanelRect> = {
  video:{x:0,y:0,w:6,h:7,z:1},
  pitch:{x:6,y:0,w:6,h:7,z:2},
  tagger:{x:0,y:7,w:8,h:11,z:3},
  events:{x:8,y:7,w:4,h:11,z:4},
};
const panelOptions = [
  {id:"phase",label:"Phase analysis",detail:"Build-up, press, transition and block"},
  {id:"goal",label:"Goal frame",detail:"Shot placement and goalkeeper outcome"},
  {id:"note",label:"Quick note",detail:"Context without leaving the tagging flow"},
  {id:"clip",label:"Clip controls",detail:"Pre-roll, post-roll and playlist"},
];

function Mark(){return <div className="tx-mark"><b>T</b><span>X</span></div>}
function MiniPitch(){return <div className="mini-pitch" aria-hidden="true"><i className="halfway"/><i className="circle"/><i className="center-spot"/><i className="box left"/><i className="box right"/><i className="six left"/><i className="six right"/><i className="goal left"/><i className="goal right"/><i className="penalty-spot left"/><i className="penalty-spot right"/><i className="penalty-arc left"/><i className="penalty-arc right"/><i className="corner tl"/><i className="corner tr"/><i className="corner bl"/><i className="corner br"/></div>}
function routeDistance(event:EventRecord){if(event.endX===undefined||event.endY===undefined)return null;return Math.round(Math.hypot((event.endX-event.x)*1.05,(event.endY-event.y)*.68))}
function RouteArrow({event}:{event:EventRecord}){
  if(event.endX===undefined||event.endY===undefined)return null;
  const distance=routeDistance(event);
  const color=event.color||(event.team==="RIV"?"#5b8def":"#f4c95d");
  return <><svg className="route-arrow" style={{color}} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><defs><marker id={`head-${event.id}`} markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L5,2.5 L0,5 Z"/></marker></defs><line x1={event.x} y1={event.y} x2={event.endX} y2={event.endY} markerEnd={`url(#head-${event.id})`}/></svg><b className="route-distance" style={{left:`${(event.x+event.endX)/2}%`,top:`${(event.y+event.endY)/2}%`,borderColor:color,color}}>{distance} m</b></>
}

function PanelWindow({id,title,meta,rect,locked,onPointerDown,children}:{id:PanelKey;title:string;meta:string;rect:PanelRect;locked:boolean;onPointerDown:(e:React.PointerEvent,id:PanelKey,mode:"move"|"resize")=>void;children:React.ReactNode}){
  return <section className={`desk-panel desk-${id}`} style={{left:`calc(${rect.x / COLS * 100}% + 4px)`,top:rect.y*ROW+4,width:`calc(${rect.w / COLS * 100}% - 8px)`,height:rect.h*ROW-8,zIndex:rect.z}} onPointerDown={e=>e.currentTarget.parentElement&&void 0}>
    <header className="panel-bar" onPointerDown={e=>!locked&&onPointerDown(e,id,"move")}>
      <div className="drag-dots" aria-hidden="true">⠿</div><strong>{title}</strong><span>{meta}</span><div className="panel-tools"><i/><i/></div>
    </header>
    <div className="panel-body">{children}</div>
    {!locked&&<button className="resize-handle" aria-label={`Resize ${title}`} onPointerDown={e=>onPointerDown(e,id,"resize")}/>} 
  </section>
}

export default function Home(){
  const [view,setView] = useState<View>("tagging");
  const [playing,setPlaying] = useState(false);
  const [playbackRate,setPlaybackRate] = useState(1);
  const [sessions,setSessions] = useState<MatchSession[]>(seededSessions);
  const [activeSessionId,setActiveSessionId] = useState(seededSessions[0].id);
  const [sessionsReady,setSessionsReady] = useState(false);
  const [activeAction,setActiveAction] = useState("Pass");
  const [activeOutcome,setActiveOutcome] = useState("Successful");
  const [activePlayer,setActivePlayer] = useState(players[5]);
  const [activeTeam,setActiveTeam] = useState<TeamCode>("RIV");
  const [editingEventId,setEditingEventId] = useState<number|null>(null);
  const [routeDraft,setRouteDraft] = useState<{start:Point;current:Point}|null>(null);
  const [shotOrigin,setShotOrigin] = useState<Point|null>(null);
  const markerColor = markerColors[0];
  const markerShape:MarkerShape = "circle";
  const [enabledPanels,setEnabledPanels] = useState(["phase","goal","clip"]);
  const [configOpen,setConfigOpen] = useState(false);
  const [rosterOpen,setRosterOpen] = useState(false);
  const [importOpen,setImportOpen] = useState(false);
  const [toast,setToast] = useState("");
  const [tool,setTool] = useState("Arrow");
  const [locked,setLocked] = useState(true);
  const [panels,setPanels] = useState(defaultPanels);
  const [videoUrl,setVideoUrl] = useState("");
  const [videoName,setVideoName] = useState("");
  const [draftMatchName,setDraftMatchName] = useState("");
  const [draftCompetition,setDraftCompetition] = useState("");
  const boardRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const activeSession = sessions.find(session=>session.id===activeSessionId) || sessions[0];
  const {clock,events,matchName,competition} = activeSession;

  useEffect(()=>{try{const saved=window.localStorage.getItem(PANEL_LAYOUT_STORAGE_KEY);if(saved){const parsed=JSON.parse(saved) as Record<PanelKey,PanelRect>;if(parsed.video&&parsed.tagger&&parsed.pitch&&parsed.events)window.setTimeout(()=>setPanels(parsed),0)}}catch{window.localStorage.removeItem(PANEL_LAYOUT_STORAGE_KEY)}},[]);
  useEffect(()=>{try{window.localStorage.setItem(PANEL_LAYOUT_STORAGE_KEY,JSON.stringify(panels))}catch{/* Storage can be unavailable without breaking the workspace. */}},[panels]);
  useEffect(()=>{window.setTimeout(()=>{try{const saved=window.localStorage.getItem("tagx-match-sessions");const selected=window.localStorage.getItem("tagx-active-session");if(saved){const parsed=JSON.parse(saved) as MatchSession[];if(Array.isArray(parsed)&&parsed.length){setSessions(parsed);setActiveSessionId(selected&&parsed.some(session=>session.id===selected)?selected:parsed[0].id)}}}catch{window.localStorage.removeItem("tagx-match-sessions");window.localStorage.removeItem("tagx-active-session")}finally{setSessionsReady(true)}},0)},[]);
  useEffect(()=>{if(!sessionsReady)return;try{window.localStorage.setItem("tagx-match-sessions",JSON.stringify(sessions));window.localStorage.setItem("tagx-active-session",activeSessionId)}catch{/* Sessions continue in memory if storage is full. */}},[sessions,activeSessionId,sessionsReady]);
  useEffect(()=>{if(videoUrl||!playing)return;const timer=window.setInterval(()=>setSessions(current=>current.map(session=>session.id===activeSessionId?{...session,clock:session.clock+1}:session)),1000);return()=>window.clearInterval(timer)},[playing,videoUrl,activeSessionId]);
  useEffect(()=>{const handler=(e:KeyboardEvent)=>{const target=e.target;if(target instanceof HTMLInputElement||target instanceof HTMLSelectElement||target instanceof HTMLTextAreaElement||(target instanceof HTMLElement&&target.isContentEditable))return;if(e.code==="Space"){e.preventDefault();togglePlay()}if(e.key==="ArrowLeft"){e.preventDefault();seek(-5)}if(e.key==="ArrowRight"){e.preventDefault();seek(5)}const i=Number(e.key)-1;if(i>=0&&i<actions.length)chooseAction(actions[i]);if(e.key==="Escape"){setConfigOpen(false);setRosterOpen(false);setImportOpen(false);setRouteDraft(null);setShotOrigin(null)}};window.addEventListener("keydown",handler);return()=>window.removeEventListener("keydown",handler)});
  useEffect(()=>()=>{if(videoUrl)URL.revokeObjectURL(videoUrl)},[videoUrl]);

  const formattedClock = useMemo(()=>`${String(Math.floor(clock/60)).padStart(2,"0")}:${String(clock%60).padStart(2,"0")}`,[clock]);
  function setClock(update:number|((value:number)=>number)){setSessions(current=>current.map(session=>session.id===activeSessionId?{...session,clock:typeof update==="function"?update(session.clock):update}:session))}
  function setEvents(update:EventRecord[]|((value:EventRecord[])=>EventRecord[])){setSessions(current=>current.map(session=>session.id===activeSessionId?{...session,events:typeof update==="function"?update(session.events):update}:session))}
  function notify(message:string){setToast(message);window.setTimeout(()=>setToast(""),2200)}
  function togglePlay(){if(videoRef.current){if(videoRef.current.paused)videoRef.current.play();else videoRef.current.pause();return}setPlaying(p=>!p)}
  function seek(seconds:number){if(videoRef.current){videoRef.current.currentTime=Math.max(0,videoRef.current.currentTime+seconds);return}setClock(c=>Math.max(0,c+seconds))}
  function changeSpeed(rate:number){setPlaybackRate(rate);if(videoRef.current)videoRef.current.playbackRate=rate}
  function chooseAction(action:string){setActiveAction(action);setRouteDraft(null);setShotOrigin(null)}
  function chooseVideo(file?:File){if(!file)return; if(videoUrl)URL.revokeObjectURL(videoUrl);setVideoUrl(URL.createObjectURL(file));setVideoName(file.name)}
  function openImportModal(){setDraftMatchName("");setDraftCompetition("");setImportOpen(true)}
  function startSession(){const id=`match-${Date.now()}`;const session:MatchSession={id,matchName:draftMatchName.trim()||"Untitled match",competition:draftCompetition.trim()||"Match session",clock:0,events:[]};setSessions(current=>[session,...current]);setActiveSessionId(id);setImportOpen(false);setPlaying(false);setEditingEventId(null);notify("New match session ready")}
  function switchSession(id:string){setActiveSessionId(id);setPlaying(false);setEditingEventId(null);setRouteDraft(null);setShotOrigin(null);notify("Match session changed")}
  function recordEvent(x:number,y:number,end?:Point,goal?:Point,outcome=activeOutcome){setEvents(current=>[{id:Math.max(0,...current.map(event=>event.id))+1,minute:formattedClock,team:activeTeam,player:activePlayer,action:activeAction,outcome,x,y,endX:end?.x,endY:end?.y,goalX:goal?.x,goalY:goal?.y,color:markerColor,marker:markerShape},...current]);notify(`${activeAction} recorded · ${outcome}${end?` · ${routeDistance({id:0,minute:"",team:activeTeam,player:"",action:activeAction,outcome,x,y,endX:end.x,endY:end.y})} m`:""}`)}
  function updateEventStyle(id:number,patch:Pick<EventRecord,"color"|"marker">){setEvents(current=>current.map(event=>event.id===id?{...event,...patch}:event))}
  function captureLocation(point:Point){
    if(activeAction==="Shot"){setShotOrigin(point);notify("Shot origin set · now choose the target on goal");return}
    recordEvent(point.x,point.y);
  }
  function pointFromPointer(e:React.PointerEvent<HTMLDivElement>):Point{const r=e.currentTarget.getBoundingClientRect();return{x:Math.max(0,Math.min(100,Math.round((e.clientX-r.left)/r.width*1000)/10)),y:Math.max(0,Math.min(100,Math.round((e.clientY-r.top)/r.height*1000)/10))}}
  function beginPitchGesture(e:React.PointerEvent<HTMLDivElement>){
    if(!routedActions.has(activeAction))return;
    e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);
    const start=pointFromPointer(e);setRouteDraft({start,current:start});
  }
  function movePitchGesture(e:React.PointerEvent<HTMLDivElement>){if(!routeDraft||!routedActions.has(activeAction))return;setRouteDraft(draft=>draft?{...draft,current:pointFromPointer(e)}:null)}
  function endPitchGesture(e:React.PointerEvent<HTMLDivElement>){
    const point=pointFromPointer(e);
    if(routedActions.has(activeAction)&&routeDraft){const distance=Math.hypot(point.x-routeDraft.start.x,point.y-routeDraft.start.y);if(distance>1.5)recordEvent(routeDraft.start.x,routeDraft.start.y,point);else notify("Hold and drag to draw the route");setRouteDraft(null);return}
    captureLocation(point);
  }
  function addGoalTarget(e:React.MouseEvent<HTMLDivElement>){
    if(!shotOrigin){notify("First mark where the shot was taken on the pitch");return}
    const r=e.currentTarget.getBoundingClientRect(),goal={x:Math.round((e.clientX-r.left)/r.width*100),y:Math.round((e.clientY-r.top)/r.height*100)};
    const inside=goal.x>=12&&goal.x<=88&&goal.y>=14&&goal.y<=86;
    const outcome=inside?activeOutcome:"Off target";
    recordEvent(shotOrigin.x,shotOrigin.y,undefined,goal,outcome);setShotOrigin(null);if(!inside)setActiveOutcome("Off target");
  }
  function togglePanel(id:string){setEnabledPanels(current=>current.includes(id)?current.filter(item=>item!==id):[...current,id])}
  function resetLayout(){setPanels(defaultPanels);notify("Workspace layout restored")}
  function beginPanelInteraction(e:React.PointerEvent,id:PanelKey,mode:"move"|"resize"){
    if(locked||!boardRef.current)return;
    e.preventDefault();e.stopPropagation();
    const startX=e.clientX,startY=e.clientY,start=panels[id],cell=boardRef.current.clientWidth/COLS;
    const topZ=Math.max(...Object.values(panels).map(p=>p.z))+1;
    setPanels(current=>({...current,[id]:{...current[id],z:topZ}}));
    const move=(event:PointerEvent)=>{
      const dx=Math.round((event.clientX-startX)/cell),dy=Math.round((event.clientY-startY)/ROW);
      setPanels(current=>{
        const active=current[id];
        if(mode==="move")return {...current,[id]:{...active,x:Math.max(0,Math.min(COLS-start.w,start.x+dx)),y:Math.max(0,start.y+dy)}};
        return {...current,[id]:{...active,w:Math.max(id==="tagger"?3:4,Math.min(COLS-start.x,start.w+dx)),h:Math.max(id==="video"?5:4,start.h+dy)}};
      });
    };
    const up=()=>{window.removeEventListener("pointermove",move);window.removeEventListener("pointerup",up)};
    window.addEventListener("pointermove",move);window.addEventListener("pointerup",up,{once:true});
  }

  return <main className="app-shell">
    <header className="global-bar">
      <div className="history-buttons"><button aria-label="Back">‹</button><button aria-label="Forward">›</button></div>
      <div className="brand"><Mark/><div><b>TAG X</b><small>VIDEO INTELLIGENCE</small></div></div>
      <div className="workspace-title"><b>{matchName}</b><small>{sessions.length} match sessions</small></div>
      <div className="global-actions"><div className="date-box"><small>17/8/2026</small><b>{formattedClock}</b></div><button className="continue" onClick={()=>notify("Session saved")}>SAVE</button></div>
    </header>

    <div className="product-shell">
      <aside className="module-rail">
        <div className="match-card"><span>MATCH SESSIONS</span><select aria-label="Active match session" value={activeSessionId} onChange={e=>switchSession(e.target.value)}>{sessions.map(session=><option key={session.id} value={session.id}>{session.matchName}</option>)}</select><small>{competition}</small><strong>{events.length} <i>EVENTS</i></strong><button className="new-session" onClick={openImportModal}>＋ New match</button></div>
        <nav><button className={view==="tagging"?"active":""} onClick={()=>setView("tagging")}><span>⌾</span><b>Match Tagging</b><small>Collect events</small></button><button className={view==="illustrator"?"active":""} onClick={()=>setView("illustrator")}><span>✎</span><b>Illustrator</b><small>Build sequences</small></button></nav>
        <div className="rail-bottom"><button onClick={()=>setRosterOpen(true)}>♙ <span>Team library</span></button><button onClick={()=>setConfigOpen(true)}>⚙ <span>Controls</span></button><div className="analyst"><i>FC</i><span><b>Felipe Chiesa</b><small>Lead analyst</small></span></div></div>
      </aside>

      <section className="main-area">
        <div className="section-tabs"><div className="session-heading"><b>{matchName}</b><small>{competition}</small></div><div className="layout-actions"><button onClick={()=>setConfigOpen(true)}>LAYOUT & CONTROLS</button><button className="import-match" onClick={openImportModal}>＋ NEW MATCH</button></div></div>
        {view==="tagging" ? <div className="workspace-board" ref={boardRef}>
          <PanelWindow id="video" title="MATCH VIDEO" meta={videoName||"No source imported"} rect={panels.video} locked={locked} onPointerDown={beginPanelInteraction}>
            <div className={`video-stage ${videoUrl?"has-video":""}`}>
              {videoUrl?<video ref={videoRef} src={videoUrl} controls onLoadedMetadata={e=>{e.currentTarget.playbackRate=playbackRate}} onPlay={()=>setPlaying(true)} onPause={()=>setPlaying(false)} onTimeUpdate={e=>setClock(Math.floor(e.currentTarget.currentTime))}><track kind="captions" srcLang="en" label="English"/></video>:<button className="import-empty" onClick={openImportModal}><span className="video-grid"><MiniPitch/></span><span className="upload-icon">⇧</span><h2>Import match video</h2><span className="import-copy">Add the fixture, teams and an MP4/WebM source.</span><span className="choose-button">CHOOSE MATCH</span></button>}
              {videoUrl&&<div className="scorebug"><b>RIV</b><strong>2 — 1</strong><b>BOC</b><span>2ND HALF</span></div>}
            </div>
            <div className="transport"><button className="play" onClick={togglePlay}>{playing?"Ⅱ PAUSE":"▶ PLAY"}</button><div className="speed-controls" aria-label="Playback speed">{playbackSpeeds.map(rate=><button key={rate} className={playbackRate===rate?"selected":""} aria-pressed={playbackRate===rate} title={`Play at ${rate}× speed`} onClick={()=>changeSpeed(rate)}>{rate}×</button>)}</div></div>
          </PanelWindow>

          <PanelWindow id="tagger" title="QUICK TAG" meta="Professional preset" rect={panels.tagger} locked={locked} onPointerDown={beginPanelInteraction}>
            <div className="tagger-scroll">
              <div className="step"><span>01</span><b>TEAM IN POSSESSION</b></div><div className="team-switch"><button className={activeTeam==="RIV"?"selected":""} onClick={()=>setActiveTeam("RIV")}>□ RIVER PLATE</button><button className={activeTeam==="BOC"?"selected":""} onClick={()=>setActiveTeam("BOC")}>■ BOCA JUNIORS</button></div>
              <div className="step"><span>02</span><b>PLAYER</b><button onClick={()=>setRosterOpen(true)}>EDIT SQUAD</button></div><select value={activePlayer} onChange={e=>setActivePlayer(e.target.value)}>{players.map(p=><option key={p}>{p}</option>)}</select>
              <div className="step"><span>03</span><b>ACTION</b></div><div className="action-grid">{actions.map((a,i)=><button key={a} className={activeAction===a?"selected":""} onClick={()=>chooseAction(a)}><span>{a}</span><kbd>{i+1}</kbd></button>)}</div>
              <div className="step"><span>04</span><b>OUTCOME</b></div><div className="outcomes">{outcomes.map(o=><button key={o} className={activeOutcome===o?"selected":""} onClick={()=>setActiveOutcome(o)}><i/>{o}</button>)}</div>
              {enabledPanels.includes("goal")&&<div className={`goal-control ${activeAction==="Shot"?"active":""}`}><div className="goal-heading"><b>SHOT PLACEMENT · SHOTS / SAVES</b><small>{activeAction!=="Shot"?"SELECT SHOT":shotOrigin?"CHOOSE PLACEMENT":"MARK SHOT ORIGIN"}</small></div><div className="goal-target" role="button" tabIndex={0} aria-label="Choose shot or save location on goal" onClick={addGoalTarget} onKeyDown={e=>{if((e.key==="Enter"||e.key===" ")&&shotOrigin){e.preventDefault();recordEvent(shotOrigin.x,shotOrigin.y,undefined,{x:50,y:50});setShotOrigin(null)}}}><div className="goal-depth"/><div className="goal-mouth"><i/><i/><i/><span/><span/></div><div className="goal-ground"/>{events.filter(event=>event.goalX!==undefined&&event.goalY!==undefined).slice(0,12).map(event=><i key={event.id} className={`goal-point ${event.outcome.toLowerCase().replace(" ","-")}`} style={{left:`${event.goalX}%`,top:`${event.goalY}%`,backgroundColor:event.color}} title={`${event.action} · ${event.outcome}`}/>)}</div><p>Inside the posts = on target · outside = off target</p></div>}
              {enabledPanels.includes("phase")&&<div className="optional-control"><div><b>PHASE ANALYSIS</b><small>OPTIONAL POP-UP CONTROL</small></div><select defaultValue="Build-up"><option>Build-up</option><option>High press</option><option>Counter attack</option><option>Low block</option><option>Transition</option></select></div>}
              <button className="next" onClick={()=>notify("Choose a location on the pitch")}>NEXT: CHOOSE LOCATION <span>→</span></button>
            </div>
          </PanelWindow>

          <PanelWindow id="pitch" title="EVENT LOCATION" meta={`${activeAction} · ${activeAction==="Shot"?shotOrigin?"choose goal target":"origin":routedActions.has(activeAction)?"hold & drag":"single point"}`} rect={panels.pitch} locked={locked} onPointerDown={beginPanelInteraction}>
            <div className="pitch-wrap"><div className="field-stage" role="button" tabIndex={0} aria-label={routedActions.has(activeAction)?"Hold and drag to draw the event route":"Tag event location on pitch"} onPointerDown={beginPitchGesture} onPointerMove={movePitchGesture} onPointerUp={endPitchGesture} onPointerCancel={()=>setRouteDraft(null)} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();captureLocation({x:50,y:50})}}}><MiniPitch/><div className="route-layer-copy">{events.slice(0,8).map(event=><RouteArrow key={event.id} event={event}/>)}{routeDraft&&<RouteArrow event={{id:-1,minute:"",team:activeTeam,player:"",action:activeAction,outcome:activeOutcome,x:routeDraft.start.x,y:routeDraft.start.y,endX:routeDraft.current.x,endY:routeDraft.current.y,color:markerColor,marker:markerShape}}/>}</div>{events.slice(0,8).map(event=>{const color=event.color||(event.team==="RIV"?"#5b8def":"#f4c95d");return <i key={event.id} className={`event-marker ${event.marker||"circle"}`} style={{left:`${event.x}%`,top:`${event.y}%`,backgroundColor:color,"--shape-color":color} as React.CSSProperties}/>})}{shotOrigin&&<i className={`route-origin shot ${activeTeam.toLowerCase()}`} style={{left:`${shotOrigin.x}%`,top:`${shotOrigin.y}%`}}/>}<div className={`route-prompt ${routeDraft||shotOrigin?"destination":""}`}>{activeAction==="Shot"?shotOrigin?"2 · CHOOSE PLACEMENT ON GOAL":"CLICK SHOT ORIGIN":routedActions.has(activeAction)?routeDraft?"DRAG TO DESTINATION · RELEASE TO SAVE":"HOLD & DRAG TO DRAW ROUTE":"CLICK LOCATION"}</div><small>ATTACKING DIRECTION →</small></div><p className="pitch-help">{routedActions.has(activeAction)?"Press at the origin, drag the route and release at the destination.":"Click once to place the event."}</p></div>
          </PanelWindow>

          <PanelWindow id="events" title="LIVE EVENT LOG" meta={`${events.length} records`} rect={panels.events} locked={locked} onPointerDown={beginPanelInteraction}>
            <div className="event-list">{events.slice(0,8).map(event=><div className={`event-entry ${editingEventId===event.id?"editing":""}`} key={event.id}><button onClick={()=>{setClock(Number(event.minute.split(":")[0])*60+Number(event.minute.split(":")[1]));setEditingEventId(current=>current===event.id?null:event.id)}}><time>{event.minute}</time><i style={{backgroundColor:event.color}}>{event.action[0]}</i><span><b>{event.action}</b><small>{event.player} · {event.outcome}{routeDistance(event)!==null?` · ${routeDistance(event)} m`:""}</small></span><strong>{editingEventId===event.id?"×":"›"}</strong></button>{editingEventId===event.id&&<div className="event-style-editor"><small>MAP MARKER</small><div className="color-options">{markerColors.map(color=><button key={color} aria-label={`Change event color to ${color}`} className={event.color===color?"selected":""} style={{backgroundColor:color}} onClick={()=>updateEventStyle(event.id,{color,marker:event.marker||"circle"})}/>)}</div><div className="shape-options">{markerShapes.map(shape=><button key={shape} aria-label={`Change event shape to ${shape}`} className={event.marker===shape?"selected":""} onClick={()=>updateEventStyle(event.id,{color:event.color||markerColors[0],marker:shape})}><i className={`marker-sample ${shape}`}/></button>)}</div></div>}</div>)}</div>
          </PanelWindow>
        </div> : <div className="illustrator-layout">
          <section className="fm-panel canvas-panel"><header><div><span>TACTICAL CANVAS</span><h1>Counter-press after loss</h1></div><button className="fm-primary" onClick={()=>notify("Render queued")}>EXPORT TACTICAL VIDEO »</button></header><div className="illustrator-canvas"><div className="video-grid"><MiniPitch/></div><div className="draw-ring one"/><div className="draw-ring two"/><div className="draw-zone"/><div className="draw-arrow a1">➜</div><div className="draw-arrow a2">➜</div></div><footer><button>▶ PLAY SEQUENCE</button><div><span/></div><b>00:08.0</b></footer></section>
          <section className="fm-panel tool-panel"><header><div><span>CUSTOMIZE TOOL</span><h1>Annotate the play</h1></div></header><div className="tool-grid">{["Select","Player ring","Spotlight","Arrow","Curved arrow","Link line","Distance","Area","Text"].map(t=><button key={t} className={tool===t?"selected":""} onClick={()=>setTool(t)}><i>{t==="Arrow"?"↗":t==="Text"?"T":"○"}</i>{t}</button>)}</div><div className="style-row"><label>LINE <input type="color" defaultValue="#5784e6"/></label><label>FILL <input type="color" defaultValue="#d1e8ff"/></label><label>OPACITY <input type="range" defaultValue="70"/></label></div><div className="frames"><span>SEQUENCE & TIMELINE</span>{["41:52.0","41:54.2","41:57.8"].map((t,i)=><button key={t} className={i===1?"selected":""}><b>{i+1}</b><span>{t}<small>{i===1?"Current frame":"Match clip"}</small></span><strong>⋮</strong></button>)}</div></section>
        </div>}
      </section>
    </div>

    {/* eslint-disable jsx-a11y/no-noninteractive-element-interactions */}
    {importOpen&&<dialog open className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setImportOpen(false)}}><section className="modal import-modal"><header><div><span>NEW MATCH SESSION</span><h2>Import a match</h2><p>Every match is saved as a separate session.</p></div><button onClick={()=>setImportOpen(false)}>×</button></header><div className="import-form"><label>Match name<input value={draftMatchName} placeholder="River Plate vs Boca Juniors" onChange={e=>setDraftMatchName(e.target.value)}/></label><label>Competition<input value={draftCompetition} placeholder="Liga Profesional · El Monumental" onChange={e=>setDraftCompetition(e.target.value)}/></label><button className="file-drop" onClick={()=>fileRef.current?.click()}><span>⇧</span><b>{videoName||"Choose MP4 or WebM"}</b><small>{videoName?"Video attached":"The file remains on this device"}</small></button><input ref={fileRef} hidden type="file" accept="video/*" onChange={e=>chooseVideo(e.target.files?.[0])}/></div><footer><button onClick={()=>setImportOpen(false)}>CANCEL</button><button className="fm-primary" onClick={startSession}>CREATE SESSION »</button></footer></section></dialog>}
    {configOpen&&<dialog open className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setConfigOpen(false)}}><section className="modal"><header><div><span>WORKSPACE CONTROLS</span><h2>Layout and optional panels</h2><p>Keep only the controls you need while tagging.</p></div><button onClick={()=>setConfigOpen(false)}>×</button></header><div className="compact-layout-controls"><button onClick={()=>setLocked(value=>!value)}>{locked?"Unlock windows":"Lock windows"}</button><button onClick={resetLayout}>Reset layout</button></div><div className="option-list">{panelOptions.map(p=><button key={p.id} onClick={()=>togglePanel(p.id)}><span className={enabledPanels.includes(p.id)?"toggle on":"toggle"}><i/></span><span><b>{p.label}</b><small>{p.detail}</small></span></button>)}</div><footer><button onClick={()=>setEnabledPanels([])}>HIDE ALL</button><button className="fm-primary" onClick={()=>setConfigOpen(false)}>DONE</button></footer></section></dialog>}
    {rosterOpen&&<dialog open className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setRosterOpen(false)}}><section className="modal roster-modal"><header><div><span>TEAM LIBRARY</span><h2>River Plate · First team</h2><p>Save this roster once and import it into future matches.</p></div><button onClick={()=>setRosterOpen(false)}>×</button></header><div className="roster-actions"><button className="fm-primary" onClick={()=>notify("Team saved to library")}>SAVE TEAM</button><button>IMPORT SAVED TEAM</button><button>＋ PLAYER</button></div><div className="roster-table">{players.map((p,i)=><div key={p}><span>{String(i+1).padStart(2,"0")}</span><b>{p.slice(3)}</b><small>{i<3?"DEF":i<5?"MID":"ATT"}</small><button>•••</button></div>)}</div></section></dialog>}
    {toast&&<div className="toast"><i/>{toast}</div>}
  </main>
}
