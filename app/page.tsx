"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type TeamCode = "RIV" | "BOC";
type View = "tagging" | "illustrator";
type PanelKey = "video" | "tagger" | "pitch" | "events";
type PanelRect = { x: number; y: number; w: number; h: number; z: number };
type Point = { x:number; y:number };
type MarkerShape = "circle" | "square" | "diamond" | "triangle";
type SetPieceType = "Free kick" | "Corner" | "Goal kick" | "Indirect" | "Penalty" | "Throw-in";
type TacticalPlayer = { id:number; team:"own"|"opponent"; x:number; y:number };
type IllustratorTool = "Select" | "Player ring" | "Spotlight" | "Arrow" | "Curved arrow" | "Link line" | "Distance" | "Area" | "Text";
type Illustration = { id:number; tool:IllustratorTool; start:Point; end?:Point; points?:Point[]; color:string; fill:string; opacity:number; size:number; text?:string };
type EventRecord = { id:number; minute:string; team:TeamCode; player:string; action:string; outcome:string; x:number; y:number; endX?:number; endY?:number; goalX?:number; goalY?:number; color?:string; marker?:MarkerShape; shotDetail?:"Woodwork"; phase?:string; setPiece?:SetPieceType };
type MatchSession = { id:string; matchName:string; competition:string; clock:number; events:EventRecord[] };
type ClipRecord = { id:number; sessionId:string; eventId:number; title:string; start:number; end:number; playlistIds:number[] };
type PlaylistRecord = { id:number; name:string };
type CloudUser = { displayName:string; email:string };
type CloudWorkspace = {
  version:1;
  sessions:MatchSession[];
  activeSessionId:string;
  panels:Record<PanelKey,PanelRect>;
  enabledPanels:string[];
  clips:ClipRecord[];
  playlists:PlaylistRecord[];
  illustrations:Illustration[];
};

const COLS = 12;
const ROW = 62;
const playbackSpeeds = [0.25,0.5,1,1.5,2];
const actions = ["Pass","Shot","Cross","Dribble","Carry","Recovery","Tackle","Interception","Clearance","Aerial duel","Foul","Goalkeeper","Penalty"];
const routedActions = new Set(["Pass","Cross","Dribble","Carry","Clearance"]);
const outcomesByAction:Record<string,string[]> = {
  Pass:["Successful","Unsuccessful","Key pass","Assist","Progressive pass"],
  Shot:["Goal","Saved","Off target","Blocked"],
  Cross:["Successful","Unsuccessful","Key cross","Assist","Blocked"],
  Dribble:["Successful","Unsuccessful","Foul gained"],
  Carry:["Successful","Unsuccessful","Progressive carry","Dispossessed"],
  Recovery:["Won","Lost"],
  Tackle:["Won","Lost","Foul committed"],
  Interception:["Won","Unsuccessful"],
  Clearance:["Successful","Blocked"],
  "Aerial duel":["Won","Lost"],
  Foul:["Committed","Won","Yellow card","Red card"],
  Goalkeeper:["Save","Catch","Punch","Claim","Smother","Kick","Throw","Goal conceded"],
  Penalty:["Goal","Saved","Off target"],
};
const phaseOptions = ["Build-up","High press","Counter attack","Low block","Transition","Set piece"];
const setPieceTypes:SetPieceType[] = ["Free kick","Corner","Goal kick","Indirect","Penalty","Throw-in"];
const markerColors = ["#10a37f","#ef6c75","#5b8def","#f4c95d","#c084fc","#f38b4a","#a7a7a7","#f3f3f3"];
const markerShapes:MarkerShape[] = ["circle","square","diamond","triangle"];
const illustratorTools:IllustratorTool[] = ["Select","Player ring","Spotlight","Arrow","Curved arrow","Link line","Distance","Area","Text"];
const illustratorToolGlyphs:Record<IllustratorTool,string> = {Select:"↖", "Player ring":"◉", Spotlight:"◌", Arrow:"↗", "Curved arrow":"⌁", "Link line":"⌯", Distance:"↔", Area:"⬡", Text:"T"};
const PANEL_LAYOUT_STORAGE_KEY = "tagx-panel-layout-v2";
const MATCH_SESSIONS_STORAGE_KEY = "tagx-match-sessions-v2";
const ACTIVE_SESSION_STORAGE_KEY = "tagx-active-session-v2";
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
function usesRoute(action:string,outcome:string){return routedActions.has(action)||(action==="Goalkeeper"&&(outcome==="Kick"||outcome==="Throw"))}
function usesGoalTarget(action:string,outcome:string){return action==="Shot"||action==="Penalty"||(action==="Goalkeeper"&&["Save","Catch","Punch","Claim","Smother","Goal conceded"].includes(outcome))}
function outcomeStyle(outcome:string):{color:string;marker:MarkerShape}{
  if(outcome==="Successful"||outcome==="Won"||outcome==="Goal")return {color:"#10a37f",marker:"circle"};
  if(outcome==="Unsuccessful"||outcome==="Lost"||outcome==="Dispossessed"||outcome==="Red card")return {color:"#ef6c75",marker:"square"};
  if(outcome.startsWith("Key")||outcome==="Saved")return {color:"#5b8def",marker:"diamond"};
  if(outcome.startsWith("Progressive")||outcome==="Yellow card")return {color:"#f4c95d",marker:"triangle"};
  if(outcome==="Assist")return {color:"#c084fc",marker:"triangle"};
  if(outcome==="Blocked")return {color:"#c084fc",marker:"diamond"};
  if(outcome==="Off target")return {color:"#a7a7a7",marker:"triangle"};
  if(outcome.includes("Foul")||outcome==="Committed"||outcome==="Foul gained")return {color:"#f38b4a",marker:"diamond"};
  if(outcome==="Save"||outcome==="Catch"||outcome==="Claim"||outcome==="Smother")return {color:"#5b8def",marker:"diamond"};
  if(outcome==="Punch"||outcome==="Kick"||outcome==="Throw")return {color:"#f4c95d",marker:"triangle"};
  if(outcome==="Goal conceded")return {color:"#ef6c75",marker:"square"};
  return {color:"#f3f3f3",marker:"circle"};
}
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
  const [cloudReady,setCloudReady] = useState(false);
  const [cloudConfigured,setCloudConfigured] = useState(false);
  const [cloudSaving,setCloudSaving] = useState(false);
  const [cloudUser,setCloudUser] = useState<CloudUser>({displayName:"Felipe Chiesa",email:""});
  const [activeAction,setActiveAction] = useState("Pass");
  const [activeOutcome,setActiveOutcome] = useState("Successful");
  const [activePlayer,setActivePlayer] = useState(players[5]);
  const [activeTeam,setActiveTeam] = useState<TeamCode>("RIV");
  const [editingEventId,setEditingEventId] = useState<number|null>(null);
  const [routeDraft,setRouteDraft] = useState<{start:Point;current:Point}|null>(null);
  const [shotOrigin,setShotOrigin] = useState<Point|null>(null);
  const [markerColor,setMarkerColor] = useState("#10a37f");
  const [markerShape,setMarkerShape] = useState<MarkerShape>("circle");
  const [activePhase,setActivePhase] = useState("Build-up");
  const [setPieceType,setSetPieceType] = useState<SetPieceType>("Free kick");
  const [placementTeam,setPlacementTeam] = useState<"own"|"opponent">("own");
  const [tacticalPlayers,setTacticalPlayers] = useState<TacticalPlayer[]>([]);
  const [enabledPanels,setEnabledPanels] = useState(["phase","goal","clip"]);
  const [configOpen,setConfigOpen] = useState(false);
  const [rosterOpen,setRosterOpen] = useState(false);
  const [importOpen,setImportOpen] = useState(false);
  const [toast,setToast] = useState("");
  const [tool,setTool] = useState<IllustratorTool>("Arrow");
  const [illustratorPanel,setIllustratorPanel] = useState<"actions"|"playlists">("actions");
  const [illustrations,setIllustrations] = useState<Illustration[]>([]);
  const [illustrationDraft,setIllustrationDraft] = useState<{start:Point;current:Point}|null>(null);
  const [polygonDraft,setPolygonDraft] = useState<Point[]>([]);
  const [selectedIllustration,setSelectedIllustration] = useState<number|null>(null);
  const [illustrationMove,setIllustrationMove] = useState<{id:number;pointer:Point;original:Illustration}|null>(null);
  const [illustrationLine,setIllustrationLine] = useState("#6f95ed");
  const [illustrationFill,setIllustrationFill] = useState("#d1e8ff");
  const [illustrationOpacity,setIllustrationOpacity] = useState(70);
  const [illustrationSize,setIllustrationSize] = useState(100);
  const [selectedEventId,setSelectedEventId] = useState<number|null>(seededEvents[0]?.id||null);
  const [clipPreRoll,setClipPreRoll] = useState(5);
  const [clipPostRoll,setClipPostRoll] = useState(5);
  const [clips,setClips] = useState<ClipRecord[]>([]);
  const [playlists,setPlaylists] = useState<PlaylistRecord[]>([{id:1,name:"Set pieces"},{id:2,name:"Build-ups"},{id:3,name:"Goals"},{id:4,name:"Big chances"}]);
  const [newPlaylistName,setNewPlaylistName] = useState("");
  const [exporting,setExporting] = useState(false);
  const [locked,setLocked] = useState(true);
  const [panels,setPanels] = useState(defaultPanels);
  const [videoUrl,setVideoUrl] = useState("");
  const [videoName,setVideoName] = useState("");
  const [draftMatchName,setDraftMatchName] = useState("");
  const [draftCompetition,setDraftCompetition] = useState("");
  const boardRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const illustratorRef = useRef<HTMLDivElement>(null);

  const activeSession = sessions.find(session=>session.id===activeSessionId) || sessions[0];
  const {clock,events,matchName,competition} = activeSession;
  const selectedDrawing = illustrations.find(item=>item.id===selectedIllustration);
  const sessionClips = clips.filter(clip=>clip.sessionId===activeSessionId);

  const workspaceSnapshot = useCallback(():CloudWorkspace=>({version:1,sessions,activeSessionId,panels,enabledPanels,clips,playlists,illustrations}),[sessions,activeSessionId,panels,enabledPanels,clips,playlists,illustrations]);

  const applyCloudWorkspace = useCallback((state:CloudWorkspace)=>{
    if(state.version!==1||!Array.isArray(state.sessions)||!state.sessions.length)return;
    setSessions(state.sessions);
    setActiveSessionId(state.sessions.some(session=>session.id===state.activeSessionId)?state.activeSessionId:state.sessions[0].id);
    if(state.panels?.video&&state.panels?.tagger&&state.panels?.pitch&&state.panels?.events)setPanels(state.panels);
    if(Array.isArray(state.enabledPanels))setEnabledPanels(state.enabledPanels);
    if(Array.isArray(state.clips))setClips(state.clips);
    if(Array.isArray(state.playlists))setPlaylists(state.playlists);
    if(Array.isArray(state.illustrations))setIllustrations(state.illustrations);
  },[]);

  const saveToCloud = useCallback(async(silent=false)=>{
    if(!cloudConfigured){if(!silent)notify("Saved on this device · Supabase project pending");return false}
    setCloudSaving(true);
    try{
      const response=await fetch("/api/workspace",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(workspaceSnapshot())});
      if(!response.ok)throw new Error(`Save failed (${response.status})`);
      if(!silent)notify("Session saved to Supabase");
      return true;
    }catch(error){console.error(error);if(!silent)notify("Cloud save failed · local copy is safe");return false}
    finally{setCloudSaving(false)}
  },[cloudConfigured,workspaceSnapshot]);

  useEffect(()=>{try{const saved=window.localStorage.getItem(PANEL_LAYOUT_STORAGE_KEY);if(saved){const parsed=JSON.parse(saved) as Record<PanelKey,PanelRect>;if(parsed.video&&parsed.tagger&&parsed.pitch&&parsed.events)window.setTimeout(()=>setPanels(parsed),0)}}catch{window.localStorage.removeItem(PANEL_LAYOUT_STORAGE_KEY)}},[]);
  useEffect(()=>{try{window.localStorage.setItem(PANEL_LAYOUT_STORAGE_KEY,JSON.stringify(panels))}catch{/* Storage can be unavailable without breaking the workspace. */}},[panels]);
  useEffect(()=>{window.setTimeout(()=>{try{const saved=window.localStorage.getItem(MATCH_SESSIONS_STORAGE_KEY);const selected=window.localStorage.getItem(ACTIVE_SESSION_STORAGE_KEY);if(saved&&saved.length<2_000_000){const parsed=JSON.parse(saved) as MatchSession[];const valid=Array.isArray(parsed)&&parsed.length>0&&parsed.length<=100&&parsed.every(session=>typeof session?.id==="string"&&typeof session.matchName==="string"&&typeof session.competition==="string"&&Number.isFinite(session.clock)&&Array.isArray(session.events)&&session.events.length<=5000);if(valid){setSessions(parsed);setActiveSessionId(selected&&parsed.some(session=>session.id===selected)?selected:parsed[0].id)}else{window.localStorage.removeItem(MATCH_SESSIONS_STORAGE_KEY);window.localStorage.removeItem(ACTIVE_SESSION_STORAGE_KEY)}}}catch{window.localStorage.removeItem(MATCH_SESSIONS_STORAGE_KEY);window.localStorage.removeItem(ACTIVE_SESSION_STORAGE_KEY)}finally{setSessionsReady(true)}},0)},[]);
  useEffect(()=>{if(!sessionsReady)return;try{window.localStorage.setItem(MATCH_SESSIONS_STORAGE_KEY,JSON.stringify(sessions));window.localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY,activeSessionId)}catch{/* Sessions continue in memory if storage is full. */}},[sessions,activeSessionId,sessionsReady]);
  useEffect(()=>{let cancelled=false;(async()=>{try{const response=await fetch("/api/workspace",{cache:"no-store"});if(response.status===503){if(!cancelled){setCloudConfigured(false);setCloudReady(true)}return}if(!response.ok)throw new Error(`Cloud load failed (${response.status})`);const payload=await response.json() as {configured:boolean;state:CloudWorkspace|null;user?:CloudUser};if(cancelled)return;setCloudConfigured(payload.configured);if(payload.user)setCloudUser(payload.user);if(payload.state)applyCloudWorkspace(payload.state)}catch(error){console.error(error);if(!cancelled)setCloudConfigured(false)}finally{if(!cancelled)setCloudReady(true)}})();return()=>{cancelled=true}},[applyCloudWorkspace]);
  useEffect(()=>{if(!sessionsReady||!cloudReady||!cloudConfigured)return;const timer=window.setTimeout(()=>void saveToCloud(true),900);return()=>window.clearTimeout(timer)},[sessionsReady,cloudReady,cloudConfigured,sessions,activeSessionId,panels,enabledPanels,clips,playlists,illustrations,saveToCloud]);
  useEffect(()=>{if(videoUrl||!playing)return;const timer=window.setInterval(()=>setSessions(current=>current.map(session=>session.id===activeSessionId?{...session,clock:session.clock+1}:session)),1000);return()=>window.clearInterval(timer)},[playing,videoUrl,activeSessionId]);
  useEffect(()=>{const handler=(e:KeyboardEvent)=>{const target=e.target;if(target instanceof HTMLInputElement||target instanceof HTMLSelectElement||target instanceof HTMLTextAreaElement||(target instanceof HTMLElement&&target.isContentEditable))return;if(e.code==="Space"){e.preventDefault();togglePlay()}if(e.key==="ArrowLeft"){e.preventDefault();seek(-5)}if(e.key==="ArrowRight"){e.preventDefault();seek(5)}const i=Number(e.key)-1;if(i>=0&&i<actions.length)chooseAction(actions[i]);if((e.key==="Delete"||e.key==="Backspace")&&view==="illustrator")deleteSelectedIllustration();if(e.key==="Escape"){setConfigOpen(false);setRosterOpen(false);setImportOpen(false);setRouteDraft(null);setShotOrigin(null);setPolygonDraft([])}};window.addEventListener("keydown",handler);return()=>window.removeEventListener("keydown",handler)});
  useEffect(()=>()=>{if(videoUrl)URL.revokeObjectURL(videoUrl)},[videoUrl]);

  const formattedClock = useMemo(()=>`${String(Math.floor(clock/60)).padStart(2,"0")}:${String(clock%60).padStart(2,"0")}`,[clock]);
  function setClock(update:number|((value:number)=>number)){setSessions(current=>current.map(session=>session.id===activeSessionId?{...session,clock:typeof update==="function"?update(session.clock):update}:session))}
  function setEvents(update:EventRecord[]|((value:EventRecord[])=>EventRecord[])){setSessions(current=>current.map(session=>session.id===activeSessionId?{...session,events:typeof update==="function"?update(session.events):update}:session))}
  function notify(message:string){setToast(message);window.setTimeout(()=>setToast(""),2200)}
  function togglePlay(){if(videoRef.current){if(videoRef.current.paused)videoRef.current.play();else videoRef.current.pause();return}setPlaying(p=>!p)}
  function seek(seconds:number){if(videoRef.current){videoRef.current.currentTime=Math.max(0,videoRef.current.currentTime+seconds);return}setClock(c=>Math.max(0,c+seconds))}
  function changeSpeed(rate:number){setPlaybackRate(rate);if(videoRef.current)videoRef.current.playbackRate=rate}
  function selectOutcome(outcome:string){const style=outcomeStyle(outcome);setActiveOutcome(outcome);setMarkerColor(style.color);setMarkerShape(style.marker)}
  function chooseAction(action:string){const outcome=outcomesByAction[action][0],style=outcomeStyle(outcome);setActiveAction(action);setActiveOutcome(outcome);setMarkerColor(style.color);setMarkerShape(style.marker);setRouteDraft(null);setShotOrigin(null);if(action==="Penalty"){setActivePhase("Set piece");setSetPieceType("Penalty")}}
  function chooseVideo(file?:File){if(!file)return; if(videoUrl)URL.revokeObjectURL(videoUrl);setVideoUrl(URL.createObjectURL(file));setVideoName(file.name)}
  function openImportModal(){setDraftMatchName("");setDraftCompetition("");setImportOpen(true)}
  function startSession(){const id=`match-${Date.now()}`;const session:MatchSession={id,matchName:draftMatchName.trim()||"Untitled match",competition:draftCompetition.trim()||"Match session",clock:0,events:[]};setSessions(current=>[session,...current]);setActiveSessionId(id);setImportOpen(false);setPlaying(false);setEditingEventId(null);notify("New match session ready")}
  function switchSession(id:string){setActiveSessionId(id);setPlaying(false);setEditingEventId(null);setRouteDraft(null);setShotOrigin(null);notify("Match session changed")}
  function recordEvent(x:number,y:number,end?:Point,goal?:Point,outcome=activeOutcome,shotDetail?:"Woodwork"){const style=outcome===activeOutcome?{color:markerColor,marker:markerShape}:outcomeStyle(outcome);setEvents(current=>[{id:Math.max(0,...current.map(event=>event.id))+1,minute:formattedClock,team:activeTeam,player:activePlayer,action:activeAction,outcome,x,y,endX:end?.x,endY:end?.y,goalX:goal?.x,goalY:goal?.y,color:style.color,marker:style.marker,shotDetail,phase:activePhase,setPiece:activePhase==="Set piece"?setPieceType:undefined},...current]);notify(`${activeAction} recorded · ${outcome}${shotDetail?` · ${shotDetail}`:""}${end?` · ${routeDistance({id:0,minute:"",team:activeTeam,player:"",action:activeAction,outcome,x,y,endX:end.x,endY:end.y})} m`:""}`)}
  function updateEventStyle(id:number,patch:Pick<EventRecord,"color"|"marker">){setEvents(current=>current.map(event=>event.id===id?{...event,...patch}:event))}
  function captureLocation(point:Point){
    if(usesGoalTarget(activeAction,activeOutcome)){setShotOrigin(point);notify("Origin set · now choose the target on goal");return}
    recordEvent(point.x,point.y);
  }
  function pointFromPointer(e:React.PointerEvent<HTMLDivElement>):Point{const r=e.currentTarget.getBoundingClientRect();return{x:Math.max(0,Math.min(100,Math.round((e.clientX-r.left)/r.width*1000)/10)),y:Math.max(0,Math.min(100,Math.round((e.clientY-r.top)/r.height*1000)/10))}}
  function beginPitchGesture(e:React.PointerEvent<HTMLDivElement>){
    e.currentTarget.setPointerCapture(e.pointerId);
    if(!usesRoute(activeAction,activeOutcome))return;
    e.preventDefault();
    const start=pointFromPointer(e);setRouteDraft({start,current:start});
  }
  function movePitchGesture(e:React.PointerEvent<HTMLDivElement>){
    if(!routeDraft||!usesRoute(activeAction,activeOutcome))return;
    // React clears currentTarget after the handler returns. Capture the point
    // synchronously so the state updater never reads from a released event.
    const point=pointFromPointer(e);
    setRouteDraft(draft=>draft?{...draft,current:point}:null);
  }
  function endPitchGesture(e:React.PointerEvent<HTMLDivElement>){
    const point=pointFromPointer(e);
    if(usesRoute(activeAction,activeOutcome)&&routeDraft){const distance=Math.hypot(point.x-routeDraft.start.x,point.y-routeDraft.start.y);if(distance>1.5)recordEvent(routeDraft.start.x,routeDraft.start.y,point);else notify("Hold and drag to draw the route");setRouteDraft(null);return}
    captureLocation(point);
  }
  function addGoalTarget(e:React.MouseEvent<HTMLDivElement>){
    if(!shotOrigin){notify("First mark where the shot was taken on the pitch");return}
    const r=e.currentTarget.getBoundingClientRect(),goal={x:Math.round((e.clientX-r.left)/r.width*100),y:Math.round((e.clientY-r.top)/r.height*100)};
    const left=18,right=82,top=18,bottom=78,tolerance=3.5;
    const woodwork=((Math.abs(goal.x-left)<=tolerance||Math.abs(goal.x-right)<=tolerance)&&goal.y>=top-tolerance&&goal.y<=bottom+tolerance)||(Math.abs(goal.y-top)<=tolerance&&goal.x>=left-tolerance&&goal.x<=right+tolerance);
    const inside=goal.x>left+tolerance&&goal.x<right-tolerance&&goal.y>top+tolerance&&goal.y<bottom;
    const outcome=woodwork?"Off target":inside?activeOutcome:"Off target";
    recordEvent(shotOrigin.x,shotOrigin.y,undefined,goal,outcome,woodwork?"Woodwork":undefined);setShotOrigin(null);if(!inside)selectOutcome("Off target");
  }
  function addTacticalPlayer(e:React.PointerEvent<HTMLDivElement>){const r=e.currentTarget.getBoundingClientRect();const player={id:Date.now(),team:placementTeam,x:Math.max(2,Math.min(98,(e.clientX-r.left)/r.width*100)),y:Math.max(2,Math.min(98,(e.clientY-r.top)/r.height*100))};setTacticalPlayers(current=>[...current,player])}
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
  function illustrationPoint(e:React.PointerEvent<HTMLDivElement>):Point{const r=e.currentTarget.getBoundingClientRect();return{x:Math.max(0,Math.min(100,(e.clientX-r.left)/r.width*100)),y:Math.max(0,Math.min(100,(e.clientY-r.top)/r.height*100))}}
  function beginIllustration(e:React.PointerEvent<HTMLDivElement>){
    if(e.button!==0)return;
    const point=illustrationPoint(e);
    if(tool==="Select"){setSelectedIllustration(null);return}
    if(tool==="Area"){
      const next=[...polygonDraft,point];
      if(next.length===4){const item:Illustration={id:Date.now(),tool,start:next[0],points:next,color:illustrationLine,fill:illustrationFill,opacity:illustrationOpacity,size:illustrationSize};setIllustrations(current=>[...current,item]);setSelectedIllustration(item.id);setPolygonDraft([]);setTool("Select");notify("Area created · select it to resize or remove")}else setPolygonDraft(next);
      return;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    if(tool==="Player ring"||tool==="Spotlight"||tool==="Text"){
      const item:Illustration={id:Date.now(),tool,start:point,color:illustrationLine,fill:illustrationFill,opacity:illustrationOpacity,size:illustrationSize,text:tool==="Text"?"Tactical note":undefined};
      setIllustrations(current=>[...current,item]);setSelectedIllustration(item.id);return;
    }
    setIllustrationDraft({start:point,current:point});
  }
  function moveIllustration(e:React.PointerEvent<HTMLDivElement>){
    const point=illustrationPoint(e);
    if(illustrationMove){const dx=point.x-illustrationMove.pointer.x,dy=point.y-illustrationMove.pointer.y,shift=(p:Point)=>({x:Math.max(0,Math.min(100,p.x+dx)),y:Math.max(0,Math.min(100,p.y+dy))});setIllustrations(current=>current.map(item=>item.id===illustrationMove.id?{...item,start:shift(illustrationMove.original.start),end:illustrationMove.original.end?shift(illustrationMove.original.end):undefined,points:illustrationMove.original.points?.map(shift)}:item));return}
    if(illustrationDraft)setIllustrationDraft(draft=>draft?{...draft,current:point}:null);
  }
  function finishIllustration(e:React.PointerEvent<HTMLDivElement>){
    if(illustrationMove){setIllustrationMove(null);return}
    if(!illustrationDraft)return;
    const end=illustrationPoint(e),distance=Math.hypot(end.x-illustrationDraft.start.x,end.y-illustrationDraft.start.y);
    if(distance<1.5){setIllustrationDraft(null);notify("Drag on the canvas to draw");return}
    const item:Illustration={id:Date.now(),tool,start:illustrationDraft.start,end,color:illustrationLine,fill:illustrationFill,opacity:illustrationOpacity,size:illustrationSize};
    setIllustrations(current=>[...current,item]);setSelectedIllustration(item.id);setIllustrationDraft(null);
  }
  function finishPolygon(){if(polygonDraft.length<3){notify("Add at least 3 vertices");return}const item:Illustration={id:Date.now(),tool:"Area",start:polygonDraft[0],points:polygonDraft,color:illustrationLine,fill:illustrationFill,opacity:illustrationOpacity,size:illustrationSize};setIllustrations(current=>[...current,item]);setSelectedIllustration(item.id);setPolygonDraft([]);setTool("Select");notify("Area created")}
  function beginMoveIllustration(e:React.PointerEvent<SVGElement>,item:Illustration){e.stopPropagation();setSelectedIllustration(item.id);if(tool!=="Select")return;e.currentTarget.setPointerCapture(e.pointerId);const canvas=illustratorRef.current;if(!canvas)return;const r=canvas.getBoundingClientRect(),pointer={x:(e.clientX-r.left)/r.width*100,y:(e.clientY-r.top)/r.height*100};setIllustrationMove({id:item.id,pointer,original:item})}
  function deleteSelectedIllustration(){if(selectedIllustration===null)return;setIllustrations(current=>current.filter(item=>item.id!==selectedIllustration));setSelectedIllustration(null)}
  function updateSelectedIllustration(patch:Partial<Pick<Illustration,"color"|"fill"|"opacity"|"size"|"text">>){if(selectedIllustration===null)return;setIllustrations(current=>current.map(item=>item.id===selectedIllustration?{...item,...patch}:item))}
  function eventSeconds(event:EventRecord){const [minutes,seconds]=event.minute.split(":").map(Number);return minutes*60+seconds}
  function seekToEvent(event:EventRecord){const requested=eventSeconds(event),video=videoRef.current,limit=video&&Number.isFinite(video.duration)?Math.max(0,video.duration-.05):requested,next=Math.min(requested,limit);if(video)video.currentTime=next;setClock(Math.floor(next));setSelectedEventId(event.id);notify(`${event.action} · ${event.minute}`)}
  function createClip(){const event=events.find(item=>item.id===selectedEventId);if(!event){notify("Select an event first");return}const video=videoRef.current,limit=video&&Number.isFinite(video.duration)?video.duration:eventSeconds(event)+clipPostRoll,time=Math.min(eventSeconds(event),limit);const clip:ClipRecord={id:Date.now(),sessionId:activeSessionId,eventId:event.id,title:`${event.action} · ${event.minute}`,start:Math.max(0,time-clipPreRoll),end:Math.min(limit,time+clipPostRoll),playlistIds:[]};setClips(current=>[clip,...current]);notify("Clip created")}
  function createPlaylist(){const name=newPlaylistName.trim();if(!name)return;setPlaylists(current=>[...current,{id:Date.now(),name}]);setNewPlaylistName("");notify("Playlist created")}
  function toggleClipPlaylist(clipId:number,playlistId:number){setClips(current=>current.map(clip=>clip.id===clipId?{...clip,playlistIds:clip.playlistIds.includes(playlistId)?clip.playlistIds.filter(id=>id!==playlistId):[...clip.playlistIds,playlistId]}:clip))}
  function drawAnnotation(ctx:CanvasRenderingContext2D,item:Illustration,width:number,height:number){const sx=width/100,sy=height/100,a={x:item.start.x*sx,y:item.start.y*sy},b={x:(item.end||item.start).x*sx,y:(item.end||item.start).y*sy},scale=item.size/100;ctx.save();ctx.globalAlpha=item.opacity/100;ctx.strokeStyle=item.color;ctx.fillStyle=item.fill;ctx.lineWidth=Math.max(2,width*.004*scale);ctx.lineCap="round";ctx.lineJoin="round";if(item.tool==="Player ring"||item.tool==="Spotlight"){ctx.beginPath();ctx.ellipse(a.x,a.y,width*.038*scale,height*(item.tool==="Spotlight"?.021:.016)*scale,0,0,Math.PI*2);if(item.tool==="Spotlight")ctx.fill();ctx.stroke()}else if(item.tool==="Text"){ctx.fillStyle=item.color;ctx.font=`700 ${Math.round(width*.028*scale)}px Arial`;ctx.fillText(item.text||"Tactical note",a.x,a.y)}else if(item.tool==="Area"&&item.points?.length){ctx.beginPath();item.points.forEach((point,index)=>index?ctx.lineTo(point.x*sx,point.y*sy):ctx.moveTo(point.x*sx,point.y*sy));ctx.closePath();ctx.fill();ctx.stroke()}else{ctx.beginPath();ctx.moveTo(a.x,a.y);if(item.tool==="Curved arrow"){const cx=(a.x+b.x)/2,cy=Math.min(a.y,b.y)-Math.abs(b.x-a.x)*.18;ctx.quadraticCurveTo(cx,cy,b.x,b.y)}else ctx.lineTo(b.x,b.y);if(item.tool==="Distance")ctx.setLineDash([12,8]);ctx.stroke();if(item.tool==="Arrow"||item.tool==="Curved arrow"){const angle=Math.atan2(b.y-a.y,b.x-a.x),head=14*scale;ctx.setLineDash([]);ctx.beginPath();ctx.moveTo(b.x,b.y);ctx.lineTo(b.x-Math.cos(angle-.55)*head,b.y-Math.sin(angle-.55)*head);ctx.lineTo(b.x-Math.cos(angle+.55)*head,b.y-Math.sin(angle+.55)*head);ctx.closePath();ctx.fillStyle=item.color;ctx.fill()}}ctx.restore()}
  async function exportAnnotatedVideo(clip=sessionClips[0]){
    const video=videoRef.current;
    if(!video||!videoUrl){notify("Import a match video first");return}
    if(!clip){notify("Create a clip first");return}
    if(typeof MediaRecorder==="undefined"){notify("This browser cannot export video");return}
    setExporting(true);
    const wasPaused=video.paused,previousTime=video.currentTime,previousRate=video.playbackRate;
    try{
      if(video.readyState<1)await new Promise<void>((resolve,reject)=>{const timer=window.setTimeout(()=>reject(new Error("Video metadata timeout")),5000);video.addEventListener("loadedmetadata",()=>{window.clearTimeout(timer);resolve()},{once:true})});
      const start=Math.max(0,Math.min(clip.start,Math.max(0,video.duration-.05))),end=Math.max(start+.12,Math.min(clip.end,video.duration));
      const width=1280,height=720,canvas=document.createElement("canvas");canvas.width=width;canvas.height=height;
      const ctx=canvas.getContext("2d");if(!ctx)throw new Error("Canvas unavailable");
      const stream=canvas.captureStream(30),source=(video as HTMLVideoElement&{captureStream?:()=>MediaStream}).captureStream?.();
      source?.getAudioTracks().forEach(track=>stream.addTrack(track));
      const mime=MediaRecorder.isTypeSupported("video/webm;codecs=vp9")?"video/webm;codecs=vp9":"video/webm",recorder=new MediaRecorder(stream,{mimeType:mime}),chunks:BlobPart[]=[];
      recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};
      const stopped=new Promise<void>((resolve,reject)=>{recorder.onstop=()=>resolve();recorder.onerror=()=>reject(new Error("Recorder failed"))});
      video.pause();video.currentTime=start;
      await new Promise<void>((resolve,reject)=>{if(Math.abs(video.currentTime-start)<.05){resolve();return}const timer=window.setTimeout(()=>reject(new Error("Video seek timeout")),5000);video.addEventListener("seeked",()=>{window.clearTimeout(timer);resolve()},{once:true})});
      video.playbackRate=1;recorder.start(100);await video.play();
      await new Promise<void>(resolve=>{const startedAt=performance.now(),maxMs=(end-start)*1000+2500;const frame=()=>{ctx.drawImage(video,0,0,width,height);illustrations.forEach(item=>drawAnnotation(ctx,item,width,height));if(video.currentTime>=end||video.ended||performance.now()-startedAt>=maxMs){resolve();return}requestAnimationFrame(frame)};frame()});
      video.pause();if(recorder.state!=="inactive")recorder.stop();await stopped;
      if(!chunks.length)throw new Error("Empty recording");
      const url=URL.createObjectURL(new Blob(chunks,{type:"video/webm"})),link=document.createElement("a");link.href=url;link.download=`tag-x-${clip.title.toLowerCase().replace(/[^a-z0-9]+/g,"-")}.webm`;document.body.appendChild(link);link.click();link.remove();window.setTimeout(()=>URL.revokeObjectURL(url),5000);notify("Annotated video exported");
    }catch(error){console.error(error);notify("Video export failed · try Chrome")}
    finally{video.pause();video.currentTime=Math.min(previousTime,Math.max(0,video.duration||previousTime));video.playbackRate=previousRate;if(!wasPaused)void video.play();setExporting(false)}
  }
  function illustrationSvg(item:Illustration){
    const a=item.start,b=item.end||item.start,selected=item.id===selectedIllustration,scale=item.size/100,common={stroke:item.color,opacity:item.opacity/100,onPointerDown:(e:React.PointerEvent<SVGElement>)=>beginMoveIllustration(e,item),style:{cursor:tool==="Select"?"move":"pointer",pointerEvents:"all" as const}};
    if(item.tool==="Player ring")return <ellipse {...common} cx={a.x} cy={a.y} rx={3.8*scale} ry={1.6*scale} fill="none" strokeWidth={(selected?1.05:.65)*scale}/>;
    if(item.tool==="Spotlight")return <ellipse {...common} cx={a.x} cy={a.y} rx={4*scale} ry={2.1*scale} fill={item.fill} strokeWidth={(selected?1:.55)*scale}/>;
    if(item.tool==="Text")return <text {...common} x={a.x} y={a.y} fill={item.color} stroke="none" fontSize={3.2*scale} fontWeight="700">{item.text}</text>;
    if(item.tool==="Area"&&item.points)return <polygon {...common} points={item.points.map(point=>`${point.x},${point.y}`).join(" ")} fill={item.fill} strokeWidth={(selected?1.05:.6)*scale}/>;
    const arrowMarkerId=`illustrator-head-${item.id}`;
    const arrowMarker=<defs><marker id={arrowMarkerId} markerWidth="4" markerHeight="4" refX="3.6" refY="2" orient="auto" markerUnits="userSpaceOnUse" viewBox="0 0 4 4"><path d="M0,0 L4,2 L0,4 Z" fill={item.color}/></marker></defs>;
    if(item.tool==="Curved arrow"){const cx=(a.x+b.x)/2,cy=Math.min(a.y,b.y)-Math.abs(b.x-a.x)*.18;return <g {...common}>{arrowMarker}<path d={`M ${a.x} ${a.y} Q ${cx} ${cy} ${b.x} ${b.y}`} fill="none" strokeWidth={(selected?1.2:.8)*scale} markerEnd={`url(#${arrowMarkerId})`}/></g>}
    const dash=item.tool==="Distance"?"2 1":undefined,angle=Math.atan2(b.y-a.y,b.x-a.x),headLength=3.4,headWidth=1.7,baseX=b.x-Math.cos(angle)*headLength,baseY=b.y-Math.sin(angle)*headLength,perpX=-Math.sin(angle)*headWidth,perpY=Math.cos(angle)*headWidth;
    return <g {...common}><line x1={a.x} y1={a.y} x2={b.x} y2={b.y} strokeWidth={(selected?1.2:.8)*scale} strokeDasharray={dash}/>{item.tool==="Arrow"&&<polygon points={`${b.x},${b.y} ${baseX+perpX*scale},${baseY+perpY*scale} ${baseX-perpX*scale},${baseY-perpY*scale}`} fill={item.color} stroke="none"/>}{item.tool==="Distance"&&<text x={(a.x+b.x)/2} y={(a.y+b.y)/2-1} fill={item.color} stroke="none" fontSize={2.8*scale} textAnchor="middle">{Math.round(Math.hypot((b.x-a.x)*1.05,(b.y-a.y)*.68))} m</text>}</g>
  }

  return <main className={`app-shell ${view==="illustrator"?"illustrator-mode":""}`}>
    <header className="global-bar">
      <div className="history-buttons"><button aria-label="Back">‹</button><button aria-label="Forward">›</button></div>
      <div className="brand"><Mark/><div><b>TAG X</b><small>VIDEO INTELLIGENCE</small></div></div>
      <div className="workspace-title"><b>{matchName}</b><small>{sessions.length} match sessions</small></div>
      <div className="global-actions"><div className="date-box"><small>{cloudConfigured?"SUPABASE":"LOCAL"}</small><b>{formattedClock}</b></div><button className="continue" disabled={cloudSaving} onClick={()=>void saveToCloud()}>{cloudSaving?"SAVING…":"SAVE"}</button></div>
    </header>

    <div className="product-shell">
      <aside className="module-rail">
        <div className="match-card"><span>MATCH SESSIONS</span><select aria-label="Active match session" value={activeSessionId} onChange={e=>switchSession(e.target.value)}>{sessions.map(session=><option key={session.id} value={session.id}>{session.matchName}</option>)}</select><small>{competition}</small><strong>{events.length} <i>EVENTS</i></strong><button className="new-session" onClick={openImportModal}>＋ New match</button></div>
        <nav><button className={view==="tagging"?"active":""} onClick={()=>setView("tagging")}><span>⌾</span><b>Match Tagging</b><small>Collect events</small></button><button className={view==="illustrator"?"active":""} onClick={()=>setView("illustrator")}><span>✎</span><b>Illustrator</b><small>Build sequences</small></button></nav>
        <div className="rail-bottom"><button onClick={()=>setRosterOpen(true)}>♙ <span>Team library</span></button><button onClick={()=>setConfigOpen(true)}>⚙ <span>Controls</span></button><div className="analyst"><i>{cloudUser.displayName.split(/\s+/).slice(0,2).map(part=>part[0]).join("").toUpperCase()||"TX"}</i><span><b>{cloudUser.displayName}</b><small>{cloudConfigured?"Cloud workspace":"Local workspace"}</small></span></div></div>
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
              <div className="step"><span>04</span><b>{activeAction.toUpperCase()} OUTCOME</b></div><div className="outcomes">{outcomesByAction[activeAction].map(o=>{const style=outcomeStyle(o);return <button key={o} className={activeOutcome===o?"selected":""} onClick={()=>selectOutcome(o)}><i className={style.marker} style={{backgroundColor:style.color,"--outcome-color":style.color} as React.CSSProperties}/>{o}</button>})}</div>
              <div className="marker-control"><div className="marker-heading"><b>MAP STYLE</b><small>{activeAction} · {activeOutcome}</small></div><div className="marker-options"><div className="color-options">{markerColors.map(color=><button key={color} aria-label={`Use ${color} for the next event`} className={markerColor===color?"selected":""} style={{backgroundColor:color}} onClick={()=>setMarkerColor(color)}/>)}</div><div className="shape-options">{markerShapes.map(shape=><button key={shape} aria-label={`Use ${shape} for the next event`} className={markerShape===shape?"selected":""} onClick={()=>setMarkerShape(shape)}><i className={`marker-sample ${shape}`}/></button>)}</div></div></div>
              {enabledPanels.includes("goal")&&<div className={`goal-control ${usesGoalTarget(activeAction,activeOutcome)?"active":""}`}><div className="goal-heading"><b>GOAL PLACEMENT · SHOTS / SAVES</b><small>{!usesGoalTarget(activeAction,activeOutcome)?"SELECT SHOT OR KEEPER ACTION":shotOrigin?"CHOOSE PLACEMENT":"MARK ORIGIN"}</small></div><div className="goal-target" role="button" tabIndex={0} aria-label="Choose shot or save location on goal" onClick={addGoalTarget} onKeyDown={e=>{if((e.key==="Enter"||e.key===" ")&&shotOrigin){e.preventDefault();recordEvent(shotOrigin.x,shotOrigin.y,undefined,{x:50,y:50});setShotOrigin(null)}}}><div className="goal-net-depth"/><div className="goal-mouth"><i/><i/><i/><span/><span/></div><div className="goal-ground"/><span className="left-post-label">POST</span><span className="crossbar-label">CROSSBAR</span>{events.filter(event=>event.goalX!==undefined&&event.goalY!==undefined).slice(0,12).map(event=><i key={event.id} className={`goal-point ${event.outcome.toLowerCase().replace(" ","-")}`} style={{left:`${event.goalX}%`,top:`${event.goalY}%`,backgroundColor:event.color}} title={`${event.action} · ${event.outcome}${event.shotDetail?` · ${event.shotDetail}`:""}`}/>)}</div><p>Inside = on target · post/crossbar = Woodwork (counts as Off target)</p></div>}
              {enabledPanels.includes("phase")&&<div className="optional-control"><div><b>PHASE ANALYSIS</b><small>OPTIONAL POP-UP CONTROL</small></div><select value={activePhase} onChange={e=>setActivePhase(e.target.value)}>{phaseOptions.map(phase=><option key={phase}>{phase}</option>)}</select>{activePhase==="Set piece"&&<div className="set-piece-control"><small>SET PIECE TYPE</small><div>{setPieceTypes.map(type=><button key={type} className={setPieceType===type?"selected":""} onClick={()=>{setSetPieceType(type);if(type==="Penalty")chooseAction("Penalty")}}>{type}</button>)}</div></div>}</div>}
            </div>
          </PanelWindow>

          <PanelWindow id="pitch" title="EVENT LOCATION" meta={`${activeAction} · ${usesGoalTarget(activeAction,activeOutcome)?shotOrigin?"choose goal target":"origin":usesRoute(activeAction,activeOutcome)?"hold & drag":"single point"}`} rect={panels.pitch} locked={locked} onPointerDown={beginPanelInteraction}>
            <div className={`pitch-panel-layout ${activePhase==="Set piece"?"with-set-piece":""}`}><div className="pitch-wrap"><div className="field-stage" role="button" tabIndex={0} aria-label={usesRoute(activeAction,activeOutcome)?"Hold and drag to draw the event route":"Tag event location on pitch"} onPointerDown={beginPitchGesture} onPointerMove={movePitchGesture} onPointerUp={endPitchGesture} onPointerCancel={()=>setRouteDraft(null)} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();captureLocation({x:50,y:50})}}}><MiniPitch/><div className="route-layer-copy">{events.slice(0,8).map(event=><RouteArrow key={event.id} event={event}/>)}{routeDraft&&<RouteArrow event={{id:-1,minute:"",team:activeTeam,player:"",action:activeAction,outcome:activeOutcome,x:routeDraft.start.x,y:routeDraft.start.y,endX:routeDraft.current.x,endY:routeDraft.current.y,color:markerColor,marker:markerShape}}/>}</div>{events.slice(0,8).map(event=>{const color=event.color||(event.team==="RIV"?"#5b8def":"#f4c95d");return <i key={event.id} className={`event-marker ${event.marker||"circle"}`} style={{left:`${event.x}%`,top:`${event.y}%`,backgroundColor:color,"--shape-color":color} as React.CSSProperties}/>})}{shotOrigin&&<i className={`route-origin shot ${activeTeam.toLowerCase()}`} style={{left:`${shotOrigin.x}%`,top:`${shotOrigin.y}%`}}/>}<div className={`route-prompt ${routeDraft||shotOrigin?"destination":""}`}>{usesGoalTarget(activeAction,activeOutcome)?shotOrigin?"CHOOSE PLACEMENT ON GOAL":"CLICK ORIGIN":usesRoute(activeAction,activeOutcome)?routeDraft?"DRAG TO DESTINATION · RELEASE TO SAVE":"HOLD & DRAG TO DRAW ROUTE":"CLICK LOCATION"}</div><small>ATTACKING DIRECTION →</small></div><p className="pitch-help">{usesRoute(activeAction,activeOutcome)?"Press at the origin, drag the route and release at the destination.":"Click once to place the event."}</p></div>{activePhase==="Set piece"&&<section className="set-piece-board"><header><div><b>{setPieceType.toUpperCase()} SETUP</b><small>Place players</small></div><span><button className={placementTeam==="own"?"selected own":"own"} onClick={()=>setPlacementTeam("own")}>OWN</button><button className={placementTeam==="opponent"?"selected opponent":"opponent"} onClick={()=>setPlacementTeam("opponent")}>RIVAL</button><button onClick={()=>setTacticalPlayers([])}>CLEAR</button></span></header><div className={`set-piece-surface layout-${setPieceType.toLowerCase().replace(" ","-")}`} role="button" tabIndex={0} aria-label={`Place ${placementTeam} player for ${setPieceType}`} onPointerUp={addTacticalPlayer}><MiniPitch/>{tacticalPlayers.map(player=><button key={player.id} className={`tactical-player ${player.team}`} style={{left:`${player.x}%`,top:`${player.y}%`}} title="Click to remove player" onPointerUp={e=>e.stopPropagation()} onClick={()=>setTacticalPlayers(current=>current.filter(item=>item.id!==player.id))}>{player.team==="own"?activeTeam:"R"}</button>)}</div><p>Choose OWN or RIVAL, then click to place players. Click a player to remove it.</p></section>}</div>
          </PanelWindow>

          <PanelWindow id="events" title="LIVE EVENT LOG" meta={`${events.length} records`} rect={panels.events} locked={locked} onPointerDown={beginPanelInteraction}>
            <div className="event-list">{events.slice(0,8).map(event=><div className={`event-entry ${editingEventId===event.id?"editing":""}`} key={event.id}><button onClick={()=>{setClock(Number(event.minute.split(":")[0])*60+Number(event.minute.split(":")[1]));setEditingEventId(current=>current===event.id?null:event.id)}}><time>{event.minute}</time><i style={{backgroundColor:event.color}}>{event.action[0]}</i><span><b>{event.action}</b><small>{event.player} · {event.outcome}{event.shotDetail?` · ${event.shotDetail}`:""}{event.setPiece?` · ${event.setPiece}`:""}{routeDistance(event)!==null?` · ${routeDistance(event)} m`:""}</small></span><strong>{editingEventId===event.id?"×":"›"}</strong></button>{editingEventId===event.id&&<div className="event-style-editor"><small>MAP MARKER</small><div className="color-options">{markerColors.map(color=><button key={color} aria-label={`Change event color to ${color}`} className={event.color===color?"selected":""} style={{backgroundColor:color}} onClick={()=>updateEventStyle(event.id,{color,marker:event.marker||"circle"})}/>)}</div><div className="shape-options">{markerShapes.map(shape=><button key={shape} aria-label={`Change event shape to ${shape}`} className={event.marker===shape?"selected":""} onClick={()=>updateEventStyle(event.id,{color:event.color||markerColors[0],marker:shape})}><i className={`marker-sample ${shape}`}/></button>)}</div></div>}</div>)}</div>
          </PanelWindow>
        </div> : <div className="illustrator-studio">
          <header className="studio-toolbar" aria-label="Illustrator tools">
            <div className="studio-home">
              <button title="Back to match tagging" aria-label="Back to match tagging" onClick={()=>setView("tagging")}>←</button>
              <span className="studio-mark">T<small>X</small></span>
              <div><b>TAG X</b><small>{matchName}</small></div>
            </div>
            <div className="studio-toolset">
              {illustratorTools.map(t=><button key={t} title={t} aria-label={t} className={tool===t?"selected":""} onClick={()=>{setTool(t);if(t!=="Area")setPolygonDraft([])}}><i>{illustratorToolGlyphs[t]}</i><span>{t}</span></button>)}
            </div>
            <div className="studio-style-controls">
              <label title="Line color"><span>LINE</span><input aria-label="Line color" type="color" value={selectedDrawing?.color||illustrationLine} onChange={e=>{setIllustrationLine(e.target.value);updateSelectedIllustration({color:e.target.value})}}/></label>
              <label title="Fill color"><span>FILL</span><input aria-label="Fill color" type="color" value={selectedDrawing?.fill||illustrationFill} onChange={e=>{setIllustrationFill(e.target.value);updateSelectedIllustration({fill:e.target.value})}}/></label>
              <label className="studio-range" title="Object size"><span>SIZE</span><input aria-label="Annotation size" type="range" min="35" max="190" value={selectedDrawing?.size||illustrationSize} onChange={e=>{const value=Number(e.target.value);setIllustrationSize(value);updateSelectedIllustration({size:value})}}/></label>
              <label className="studio-range" title="Object opacity"><span>OPACITY</span><input aria-label="Annotation opacity" type="range" min="10" max="100" value={selectedDrawing?.opacity||illustrationOpacity} onChange={e=>{const value=Number(e.target.value);setIllustrationOpacity(value);updateSelectedIllustration({opacity:value})}}/></label>
              {selectedDrawing?.tool==="Text"&&<input aria-label="Annotation text" className="studio-text-input" value={selectedDrawing.text||""} onChange={e=>updateSelectedIllustration({text:e.target.value})}/>}
            </div>
            <div className="studio-history">
              <button title="Undo last" aria-label="Undo last annotation" onClick={()=>{setIllustrations(current=>current.slice(0,-1));setSelectedIllustration(null)}} disabled={!illustrations.length}>↶</button>
              <button title="Delete selected" aria-label="Delete selected annotation" onClick={deleteSelectedIllustration} disabled={selectedIllustration===null}>⌫</button>
              <button className="studio-export" onClick={()=>void exportAnnotatedVideo()} disabled={exporting||!videoUrl||!sessionClips.length}>{exporting?"EXPORTING…":"EXPORT VIDEO"}</button>
            </div>
          </header>

          <aside className="studio-quick-rail" aria-label="Quick drawing tools">
            {["Player ring","Spotlight","Arrow","Link line","Area","Text"].map(name=>{const t=name as IllustratorTool;return <button key={t} title={t} aria-label={t} className={tool===t?"selected":""} onClick={()=>{setTool(t);if(t!=="Area")setPolygonDraft([])}}><i>{illustratorToolGlyphs[t]}</i></button>})}
            <span/>
            <button title="Clear all annotations" aria-label="Clear all annotations" onClick={()=>{setIllustrations([]);setSelectedIllustration(null)}} disabled={!illustrations.length}>⌫</button>
          </aside>

          <section className="studio-stage">
            <div className="stage-title"><div><b>{matchName}</b><small>{tool==="Area"?`${polygonDraft.length}/4 vertices · click 3 or 4 points`:selectedDrawing?`${selectedDrawing.tool} selected · drag to move, use Size to resize`:`${tool} · ${tool==="Player ring"||tool==="Spotlight"||tool==="Text"?"click a player":"press and drag"}`}</small></div>{tool==="Area"&&polygonDraft.length>=3&&<button onClick={finishPolygon}>FINISH AREA</button>}</div>
            <div ref={illustratorRef} className={`illustrator-canvas studio-canvas tool-${tool.toLowerCase().replaceAll(" ","-")}`} onPointerDown={beginIllustration} onPointerMove={moveIllustration} onPointerUp={finishIllustration} onPointerCancel={()=>{setIllustrationDraft(null);setIllustrationMove(null)}}>
              {videoUrl?<video ref={videoRef} className="illustrator-video" src={videoUrl} muted playsInline onLoadedMetadata={e=>{e.currentTarget.playbackRate=playbackRate}} onPlay={()=>setPlaying(true)} onPause={()=>setPlaying(false)} onTimeUpdate={e=>setClock(Math.floor(e.currentTarget.currentTime))}/>:<div className="video-grid"><MiniPitch/></div>}
              <svg className="illustration-layer" viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="Tactical drawing canvas">{illustrations.map(item=><g key={item.id} className={item.id===selectedIllustration?"selected-illustration":""}>{illustrationSvg(item)}</g>)}{illustrationDraft&&illustrationSvg({id:-1,tool,start:illustrationDraft.start,end:illustrationDraft.current,color:illustrationLine,fill:illustrationFill,opacity:illustrationOpacity,size:illustrationSize})}{polygonDraft.length>0&&<g className="polygon-draft"><polyline points={polygonDraft.map(point=>`${point.x},${point.y}`).join(" ")} fill="none" stroke={illustrationLine}/>{polygonDraft.map((point,index)=><circle key={index} cx={point.x} cy={point.y} r=".8" fill={illustrationLine}/>)}</g>}</svg>
              {selectedDrawing&&<div className="selection-badge" style={{left:`${selectedDrawing.start.x}%`,top:`${selectedDrawing.start.y}%`}} onPointerDown={e=>e.stopPropagation()}><button onClick={()=>setTool("Select")} title="Move selected">✥</button><button onClick={deleteSelectedIllustration} title="Delete selected">⌫</button></div>}
              {!videoUrl&&!illustrations.length&&!illustrationDraft&&!polygonDraft.length&&<div className="canvas-empty"><b>Import a match video</b><small>Then choose a tool and draw directly over the play.</small></div>}
            </div>
            <footer className="studio-transport">
              <button className="studio-play" onClick={togglePlay}>{playing?"Ⅱ":"▶"}</button>
              <button onClick={()=>seek(-5)} title="Back 5 seconds">−5</button>
              <div className="studio-scrub"><span style={{width:`${videoRef.current?.duration?Math.min(100,clock/videoRef.current.duration*100):0}%`}}/></div>
              <b>{formattedClock}</b>
              <button onClick={()=>seek(5)} title="Forward 5 seconds">+5</button>
              <div className="studio-speeds">{playbackSpeeds.map(rate=><button key={rate} className={playbackRate===rate?"selected":""} onClick={()=>changeSpeed(rate)}>{rate}×</button>)}</div>
            </footer>
          </section>

          <aside className="studio-library">
            <div className="studio-library-tabs"><button className={illustratorPanel==="actions"?"selected":""} onClick={()=>setIllustratorPanel("actions")}>▣ ACTIONS <small>{events.length}</small></button><button className={illustratorPanel==="playlists"?"selected":""} onClick={()=>setIllustratorPanel("playlists")}>▤ PLAYLISTS <small>{playlists.length}</small></button></div>
            {illustratorPanel==="actions"?<>
              <div className="studio-event-filter"><span>LIVE EVENT LOG</span><small>Click an event to seek the video</small></div>
              <div className="studio-event-list">{events.map(event=><button key={event.id} className={selectedEventId===event.id?"selected":""} onClick={()=>seekToEvent(event)}><i style={{background:event.color}}>{event.action[0]}</i><span><b>{event.action}</b><small>{event.minute} · {event.player}</small><em>{event.outcome}</em></span><strong>›</strong></button>)}</div>
              <div className="studio-clip-maker"><div><label>PRE <input aria-label="Clip pre-roll seconds" type="number" min="0" max="30" value={clipPreRoll} onChange={e=>setClipPreRoll(Number(e.target.value))}/></label><label>POST <input aria-label="Clip post-roll seconds" type="number" min="0" max="30" value={clipPostRoll} onChange={e=>setClipPostRoll(Number(e.target.value))}/></label></div><button onClick={createClip} disabled={selectedEventId===null}>✂ CREATE CLIP</button></div>
            </>:<>
              <div className="studio-new-playlist"><input aria-label="New playlist name" value={newPlaylistName} placeholder="New playlist" onChange={e=>setNewPlaylistName(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")createPlaylist()}}/><button onClick={createPlaylist}>＋</button></div>
              <div className="studio-playlist-list">{playlists.map(list=><section key={list.id}><header><b>{list.name}</b><small>{sessionClips.filter(clip=>clip.playlistIds.includes(list.id)).length}</small></header>{sessionClips.filter(clip=>clip.playlistIds.includes(list.id)).map(clip=><button key={clip.id} onClick={()=>{const video=videoRef.current;if(video)video.currentTime=clip.start;setClock(Math.floor(clip.start))}}><span>{clip.title}</span><small>{Math.max(0,clip.end-clip.start).toFixed(1)}s</small></button>)}</section>)}</div>
              {sessionClips.length>0&&<div className="studio-clip-library"><b>CLIPS</b>{sessionClips.map(clip=><article key={clip.id}><header><button onClick={()=>{const video=videoRef.current;if(video)video.currentTime=clip.start;setClock(Math.floor(clip.start))}}>▶ {clip.title}</button><button aria-label={`Delete ${clip.title}`} onClick={()=>setClips(current=>current.filter(item=>item.id!==clip.id))}>×</button></header><div>{playlists.map(list=><label key={list.id}><input type="checkbox" checked={clip.playlistIds.includes(list.id)} onChange={()=>toggleClipPlaylist(clip.id,list.id)}/>{list.name}</label>)}</div><button className="clip-export" onClick={()=>void exportAnnotatedVideo(clip)}>EXPORT WITH DRAWINGS</button></article>)}</div>}
            </>}
          </aside>
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
