"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type TeamCode = "RIV" | "BOC";
type View = "tagging" | "illustrator";
type PanelKey = "video" | "tagger" | "pitch" | "events";
type PanelRect = { x: number; y: number; w: number; h: number; z: number };
type Point = { x:number; y:number };
type EventRecord = { id:number; minute:string; team:TeamCode; player:string; action:string; outcome:string; x:number; y:number; endX?:number; endY?:number };

const COLS = 12;
const ROW = 62;
const playbackSpeeds = [0.25,0.5,1,1.5,2];
const actions = ["Pass","Shot","Cross","Carry","Recovery","Tackle","Interception","Clearance","Aerial duel","Foul"];
const routedActions = new Set(["Pass","Cross","Carry","Clearance"]);
const outcomes = ["Successful","Unsuccessful","Goal","Blocked","Saved","Off target","Won","Lost"];
const players = ["01 F. Armani","02 S. Boselli","03 R. Funes Mori","05 M. Kranevitter","08 N. Fernández","10 M. Lanzini","11 F. Colidio","19 C. Echeverri"];
const seededEvents:EventRecord[] = [
  {id:128,minute:"42:08",team:"RIV",player:"10 M. Lanzini",action:"Pass",outcome:"Successful",x:32,y:61,endX:55,endY:43},
  {id:127,minute:"41:54",team:"RIV",player:"11 F. Colidio",action:"Shot",outcome:"Blocked",x:84,y:42},
  {id:126,minute:"41:31",team:"BOC",player:"09 M. Merentiel",action:"Recovery",outcome:"Won",x:57,y:72},
  {id:125,minute:"40:48",team:"RIV",player:"08 N. Fernández",action:"Cross",outcome:"Successful",x:92,y:18,endX:79,endY:48},
];
const defaultPanels:Record<PanelKey,PanelRect> = {
  video:{x:0,y:0,w:8,h:7,z:1},
  tagger:{x:8,y:0,w:4,h:11,z:2},
  pitch:{x:0,y:7,w:5,h:5,z:3},
  events:{x:5,y:7,w:3,h:5,z:4},
};
const panelOptions = [
  {id:"phase",label:"Phase analysis",detail:"Build-up, press, transition and block"},
  {id:"goal",label:"Goal frame",detail:"Shot placement and goalkeeper outcome"},
  {id:"note",label:"Quick note",detail:"Context without leaving the tagging flow"},
  {id:"clip",label:"Clip controls",detail:"Pre-roll, post-roll and playlist"},
];

function Mark(){return <div className="tx-mark"><b>T</b><span>X</span></div>}
function MiniPitch(){return <div className="mini-pitch"><i className="halfway"/><i className="circle"/><i className="box left"/><i className="box right"/></div>}
function routeDistance(event:EventRecord){if(event.endX===undefined||event.endY===undefined)return null;return Math.round(Math.hypot((event.endX-event.x)*1.05,(event.endY-event.y)*.68))}
function RouteArrow({event}:{event:EventRecord}){
  if(event.endX===undefined||event.endY===undefined)return null;
  const distance=routeDistance(event);
  return <><svg className={`route-arrow ${event.team.toLowerCase()}`} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><defs><marker id={`head-${event.id}`} markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L5,2.5 L0,5 Z"/></marker></defs><line x1={event.x} y1={event.y} x2={event.endX} y2={event.endY} markerEnd={`url(#head-${event.id})`}/><circle cx={event.x} cy={event.y} r="1.35"/></svg><b className={`route-distance ${event.team.toLowerCase()}`} style={{left:`${(event.x+event.endX)/2}%`,top:`${(event.y+event.endY)/2}%`}}>{distance} m</b></>
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
  const [clock,setClock] = useState(2531);
  const [activeAction,setActiveAction] = useState("Pass");
  const [activeOutcome,setActiveOutcome] = useState("Successful");
  const [activePlayer,setActivePlayer] = useState(players[5]);
  const [activeTeam,setActiveTeam] = useState<TeamCode>("RIV");
  const [events,setEvents] = useState(seededEvents);
  const [routeOrigin,setRouteOrigin] = useState<Point|null>(null);
  const [enabledPanels,setEnabledPanels] = useState(["phase","goal","clip"]);
  const [configOpen,setConfigOpen] = useState(false);
  const [rosterOpen,setRosterOpen] = useState(false);
  const [importOpen,setImportOpen] = useState(false);
  const [toast,setToast] = useState("");
  const [tool,setTool] = useState("Arrow");
  const [locked,setLocked] = useState(false);
  const [panels,setPanels] = useState(defaultPanels);
  const [videoUrl,setVideoUrl] = useState("");
  const [videoName,setVideoName] = useState("");
  const [matchName,setMatchName] = useState("River Plate vs Boca Juniors");
  const [competition,setCompetition] = useState("Friendly · El Monumental");
  const boardRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(()=>{const saved=window.localStorage.getItem("tagx-panel-layout");if(saved)window.setTimeout(()=>setPanels(JSON.parse(saved)),0)},[]);
  useEffect(()=>{window.localStorage.setItem("tagx-panel-layout",JSON.stringify(panels))},[panels]);
  useEffect(()=>{if(videoUrl)return; if(!playing)return; const timer=window.setInterval(()=>setClock(c=>c+1),1000);return()=>window.clearInterval(timer)},[playing,videoUrl]);
  useEffect(()=>{const handler=(e:KeyboardEvent)=>{const target=e.target;if(target instanceof HTMLInputElement||target instanceof HTMLSelectElement||target instanceof HTMLTextAreaElement||(target instanceof HTMLElement&&target.isContentEditable))return;if(e.code==="Space"){e.preventDefault();togglePlay()}if(e.key==="ArrowLeft"){e.preventDefault();seek(-5)}if(e.key==="ArrowRight"){e.preventDefault();seek(5)}const i=Number(e.key)-1;if(i>=0&&i<actions.length)chooseAction(actions[i]);if(e.key==="Escape"){setConfigOpen(false);setRosterOpen(false);setImportOpen(false);setRouteOrigin(null)}};window.addEventListener("keydown",handler);return()=>window.removeEventListener("keydown",handler)});
  useEffect(()=>()=>{if(videoUrl)URL.revokeObjectURL(videoUrl)},[videoUrl]);

  const formattedClock = useMemo(()=>`${String(Math.floor(clock/60)).padStart(2,"0")}:${String(clock%60).padStart(2,"0")}`,[clock]);
  function notify(message:string){setToast(message);window.setTimeout(()=>setToast(""),2200)}
  function togglePlay(){if(videoRef.current){if(videoRef.current.paused)videoRef.current.play();else videoRef.current.pause();return}setPlaying(p=>!p)}
  function seek(seconds:number){if(videoRef.current){videoRef.current.currentTime=Math.max(0,videoRef.current.currentTime+seconds);return}setClock(c=>Math.max(0,c+seconds))}
  function changeSpeed(rate:number){setPlaybackRate(rate);if(videoRef.current)videoRef.current.playbackRate=rate}
  function chooseAction(action:string){setActiveAction(action);setRouteOrigin(null)}
  function chooseVideo(file?:File){if(!file)return; if(videoUrl)URL.revokeObjectURL(videoUrl);setVideoUrl(URL.createObjectURL(file));setVideoName(file.name)}
  function startSession(){setImportOpen(false);setClock(0);setPlaying(false);notify("Match ready for tagging")}
  function recordEvent(x:number,y:number,end?:Point){setEvents(current=>[{id:current[0].id+1,minute:formattedClock,team:activeTeam,player:activePlayer,action:activeAction,outcome:activeOutcome,x,y,endX:end?.x,endY:end?.y},...current]);notify(`${activeAction} recorded · ${activePlayer}${end?` · ${routeDistance({id:0,minute:"",team:activeTeam,player:"",action:activeAction,outcome:"",x,y,endX:end.x,endY:end.y})} m`:""}`)}
  function captureLocation(point:Point){
    if(!routedActions.has(activeAction)){recordEvent(point.x,point.y);return}
    if(!routeOrigin){setRouteOrigin(point);notify("Origin set · now click the destination");return}
    recordEvent(routeOrigin.x,routeOrigin.y,point);setRouteOrigin(null);
  }
  function addEvent(e:React.MouseEvent<HTMLDivElement>){const r=e.currentTarget.getBoundingClientRect();captureLocation({x:Math.round((e.clientX-r.left)/r.width*100),y:Math.round((e.clientY-r.top)/r.height*100)})}
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
      <nav className="global-nav"><button className="active">Workspace</button><button>Match</button><button>Teams</button></nav>
      <div className="global-actions"><button aria-label="Search">⌕</button><button aria-label="Settings" onClick={()=>setConfigOpen(true)}>⚙</button><div className="date-box"><small>17/8/2026</small><b>{formattedClock}</b></div><button className="continue" onClick={()=>notify("Session saved")}>SAVE SESSION <span>»</span></button></div>
    </header>

    <div className="product-shell">
      <aside className="module-rail">
        <div className="match-card"><span>ACTIVE MATCH</span><b>{matchName}</b><small>{competition}</small><strong><i>RIV</i> 2 — 1 <i>BOC</i></strong></div>
        <nav><button className={view==="tagging"?"active":""} onClick={()=>setView("tagging")}><span>⌾</span><b>Match Tagging</b><small>Collect events</small></button><button className={view==="illustrator"?"active":""} onClick={()=>setView("illustrator")}><span>✎</span><b>Illustrator</b><small>Build sequences</small></button></nav>
        <div className="rail-bottom"><button onClick={()=>setRosterOpen(true)}>♙ <span>Team library</span></button><button onClick={()=>setConfigOpen(true)}>⚙ <span>Controls</span></button><div className="analyst"><i>FC</i><span><b>Felipe Chiesa</b><small>Lead analyst</small></span></div></div>
      </aside>

      <section className="main-area">
        <div className="section-tabs"><div><button className="active">Overview</button><button>Event setup</button><button>Session history</button></div><div className="layout-actions"><span>LAYOUT</span><button onClick={()=>setLocked(l=>!l)}>{locked?"UNLOCK":"LOCK"}</button><button onClick={resetLayout}>RESET</button><button className="import-match" onClick={()=>setImportOpen(true)}>＋ IMPORT MATCH</button></div></div>
        {view==="tagging" ? <div className="workspace-board" ref={boardRef}>
          <PanelWindow id="video" title="MATCH VIDEO" meta={videoName||"No source imported"} rect={panels.video} locked={locked} onPointerDown={beginPanelInteraction}>
            <div className={`video-stage ${videoUrl?"has-video":""}`}>
              {videoUrl?<video ref={videoRef} src={videoUrl} controls onLoadedMetadata={e=>{e.currentTarget.playbackRate=playbackRate}} onPlay={()=>setPlaying(true)} onPause={()=>setPlaying(false)} onTimeUpdate={e=>setClock(Math.floor(e.currentTarget.currentTime))}><track kind="captions" srcLang="en" label="English"/></video>:<button className="import-empty" onClick={()=>setImportOpen(true)}><span className="video-grid"><MiniPitch/></span><span className="upload-icon">⇧</span><h2>Import match video</h2><span className="import-copy">Add the fixture, teams and an MP4/WebM source.</span><span className="choose-button">CHOOSE MATCH</span></button>}
              {videoUrl&&<div className="scorebug"><b>RIV</b><strong>2 — 1</strong><b>BOC</b><span>2ND HALF</span></div>}
            </div>
            <div className="transport"><button className="play" onClick={togglePlay}>{playing?"Ⅱ PAUSE":"▶ PLAY"}</button><div className="speed-controls" aria-label="Playback speed">{playbackSpeeds.map(rate=><button key={rate} className={playbackRate===rate?"selected":""} aria-pressed={playbackRate===rate} title={`Play at ${rate}× speed`} onClick={()=>changeSpeed(rate)}>{rate}×</button>)}</div></div>
          </PanelWindow>

          <PanelWindow id="tagger" title="QUICK TAG" meta="Professional preset" rect={panels.tagger} locked={locked} onPointerDown={beginPanelInteraction}>
            <div className="tagger-scroll">
              <div className="step"><span>01</span><b>TEAM IN POSSESSION</b></div><div className="team-switch"><button className={activeTeam==="RIV"?"selected":""} onClick={()=>setActiveTeam("RIV")}>□ RIVER PLATE</button><button className={activeTeam==="BOC"?"selected":""} onClick={()=>setActiveTeam("BOC")}>■ BOCA JUNIORS</button></div>
              <div className="step"><span>02</span><b>PLAYER</b><button onClick={()=>setRosterOpen(true)}>EDIT SQUAD</button></div><select value={activePlayer} onChange={e=>setActivePlayer(e.target.value)}>{players.map(p=><option key={p}>{p}</option>)}</select>
              <div className="step"><span>03</span><b>ACTION</b><button onClick={()=>notify("New action ready")}>＋ ADD</button></div><div className="action-grid">{actions.map((a,i)=><button key={a} className={activeAction===a?"selected":""} onClick={()=>chooseAction(a)}><span>{a}</span><kbd>{i+1}</kbd></button>)}</div>
              <div className="step"><span>04</span><b>OUTCOME</b><button onClick={()=>notify("New outcome ready")}>＋ ADD</button></div><div className="outcomes">{outcomes.map(o=><button key={o} className={activeOutcome===o?"selected":""} onClick={()=>setActiveOutcome(o)}><i/>{o}</button>)}</div>
              {enabledPanels.includes("phase")&&<div className="optional-control"><div><b>PHASE ANALYSIS</b><small>OPTIONAL POP-UP CONTROL</small></div><select defaultValue="Build-up"><option>Build-up</option><option>High press</option><option>Counter attack</option><option>Low block</option><option>Transition</option></select></div>}
              <button className="next" onClick={()=>notify("Choose a location on the pitch")}>NEXT: CHOOSE LOCATION <span>→</span></button>
            </div>
          </PanelWindow>

          <PanelWindow id="pitch" title="EVENT LOCATION" meta={`${activeAction} · ${routedActions.has(activeAction)?routeOrigin?"destination":"origin":"single point"}`} rect={panels.pitch} locked={locked} onPointerDown={beginPanelInteraction}>
            <div className="pitch-wrap" role="button" tabIndex={0} aria-label={routedActions.has(activeAction)?routeOrigin?"Choose event destination":"Choose event origin":"Tag event location on pitch"} onClick={addEvent} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();captureLocation({x:50,y:50})}}}><MiniPitch/><div className="route-layer-copy">{events.slice(0,8).map(event=><RouteArrow key={event.id} event={event}/>)}</div>{events.slice(0,8).filter(event=>event.endX===undefined).map(event=><i key={event.id} className={`event-dot ${event.team.toLowerCase()}`} style={{left:`${event.x}%`,top:`${event.y}%`}}/>)}{routeOrigin&&<i className={`route-origin ${activeTeam.toLowerCase()}`} style={{left:`${routeOrigin.x}%`,top:`${routeOrigin.y}%`}}/>}<div className={`route-prompt ${routeOrigin?"destination":""}`}>{routedActions.has(activeAction)?routeOrigin?"2 · CLICK DESTINATION":"1 · CLICK ORIGIN":"CLICK LOCATION"}</div><small>ATTACKING DIRECTION →</small></div>
          </PanelWindow>

          <PanelWindow id="events" title="LIVE EVENT LOG" meta={`${events.length} records`} rect={panels.events} locked={locked} onPointerDown={beginPanelInteraction}>
            <div className="event-list">{events.slice(0,8).map(e=><button key={e.id} onClick={()=>setClock(Number(e.minute.split(":")[0])*60+Number(e.minute.split(":")[1]))}><time>{e.minute}</time><i>{e.action[0]}</i><span><b>{e.action}</b><small>{e.player} · {e.outcome}{routeDistance(e)!==null?` · ${routeDistance(e)} m`:""}</small></span><strong>›</strong></button>)}</div>
          </PanelWindow>
        </div> : <div className="illustrator-layout">
          <section className="fm-panel canvas-panel"><header><div><span>TACTICAL CANVAS</span><h1>Counter-press after loss</h1></div><button className="fm-primary" onClick={()=>notify("Render queued")}>EXPORT TACTICAL VIDEO »</button></header><div className="illustrator-canvas"><div className="video-grid"><MiniPitch/></div><div className="draw-ring one"/><div className="draw-ring two"/><div className="draw-zone"/><div className="draw-arrow a1">➜</div><div className="draw-arrow a2">➜</div></div><footer><button>▶ PLAY SEQUENCE</button><div><span/></div><b>00:08.0</b></footer></section>
          <section className="fm-panel tool-panel"><header><div><span>CUSTOMIZE TOOL</span><h1>Annotate the play</h1></div></header><div className="tool-grid">{["Select","Player ring","Spotlight","Arrow","Curved arrow","Link line","Distance","Area","Text"].map(t=><button key={t} className={tool===t?"selected":""} onClick={()=>setTool(t)}><i>{t==="Arrow"?"↗":t==="Text"?"T":"○"}</i>{t}</button>)}</div><div className="style-row"><label>LINE <input type="color" defaultValue="#5784e6"/></label><label>FILL <input type="color" defaultValue="#d1e8ff"/></label><label>OPACITY <input type="range" defaultValue="70"/></label></div><div className="frames"><span>SEQUENCE & TIMELINE</span>{["41:52.0","41:54.2","41:57.8"].map((t,i)=><button key={t} className={i===1?"selected":""}><b>{i+1}</b><span>{t}<small>{i===1?"Current frame":"Match clip"}</small></span><strong>⋮</strong></button>)}</div></section>
        </div>}
      </section>
    </div>

    {/* eslint-disable jsx-a11y/no-noninteractive-element-interactions */}
    {importOpen&&<dialog open className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setImportOpen(false)}}><section className="modal import-modal"><header><div><span>NEW MATCH SESSION</span><h2>Import a match</h2><p>Set the fixture once, import a saved squad and attach the match video.</p></div><button onClick={()=>setImportOpen(false)}>×</button></header><div className="import-form"><label>Match name<input value={matchName} onChange={e=>setMatchName(e.target.value)}/></label><div><label>Competition<input value={competition} onChange={e=>setCompetition(e.target.value)}/></label><label>Match date<input type="date" defaultValue="2026-08-17"/></label></div><div><label>Home team<select defaultValue="River Plate"><option>River Plate</option><option>Import saved team…</option></select></label><label>Away team<select defaultValue="Boca Juniors"><option>Boca Juniors</option><option>Import saved team…</option></select></label></div><button className="file-drop" onClick={()=>fileRef.current?.click()}><span>⇧</span><b>{videoName||"Choose MP4 or WebM"}</b><small>{videoName?"Video attached":"The file remains on this device"}</small></button><input ref={fileRef} hidden type="file" accept="video/*" onChange={e=>chooseVideo(e.target.files?.[0])}/></div><footer><button onClick={()=>setImportOpen(false)}>CANCEL</button><button className="fm-primary" onClick={startSession}>CREATE & IMPORT MATCH »</button></footer></section></dialog>}
    {configOpen&&<dialog open className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setConfigOpen(false)}}><section className="modal"><header><div><span>WORKSPACE CONTROLS</span><h2>Optional tagging pop-ups</h2><p>Phase analysis and secondary controls stay inside Match Tagging.</p></div><button onClick={()=>setConfigOpen(false)}>×</button></header><div className="option-list">{panelOptions.map(p=><button key={p.id} onClick={()=>togglePanel(p.id)}><span className={enabledPanels.includes(p.id)?"toggle on":"toggle"}><i/></span><span><b>{p.label}</b><small>{p.detail}</small></span></button>)}</div><footer><button onClick={()=>setEnabledPanels([])}>HIDE ALL</button><button className="fm-primary" onClick={()=>setConfigOpen(false)}>APPLY CONTROLS »</button></footer></section></dialog>}
    {rosterOpen&&<dialog open className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setRosterOpen(false)}}><section className="modal roster-modal"><header><div><span>TEAM LIBRARY</span><h2>River Plate · First team</h2><p>Save this roster once and import it into future matches.</p></div><button onClick={()=>setRosterOpen(false)}>×</button></header><div className="roster-actions"><button className="fm-primary" onClick={()=>notify("Team saved to library")}>SAVE TEAM</button><button>IMPORT SAVED TEAM</button><button>＋ PLAYER</button></div><div className="roster-table">{players.map((p,i)=><div key={p}><span>{String(i+1).padStart(2,"0")}</span><b>{p.slice(3)}</b><small>{i<3?"DEF":i<5?"MID":"ATT"}</small><button>•••</button></div>)}</div></section></dialog>}
    {toast&&<div className="toast"><i/>{toast}</div>}
  </main>
}
