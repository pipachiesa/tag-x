export type CsvEvent = {
  id:number; minute:string; team:string; player:string; action:string; outcome:string;
  x:number; y:number; endX?:number; endY?:number; goalX?:number; goalY?:number;
  color?:string; marker?:string; shotDetail?:string; phase?:string; setPiece?:string;
};

export type CsvSession = {
  id:string; matchName:string; competition:string; clock:number; events:CsvEvent[];
  homeTeamId?:string; awayTeamId?:string;
};

export type CsvTeam = {
  id:string; name:string; players:Array<{id:string; name:string; number:number; position:string}>;
};

export function removeEventById<T extends {id:number}>(events:T[],id:number):T[]{
  return events.filter(event=>event.id!==id);
}

function secondsFromTime(value:string){
  const parts=value.split(":").map(Number);
  if(parts.some(part=>!Number.isFinite(part)))return 0;
  if(parts.length===3)return parts[0]*3600+parts[1]*60+parts[2];
  return (parts[0]||0)*60+(parts[1]||0);
}

function periodFor(seconds:number){
  if(seconds<45*60)return "1H";
  if(seconds<90*60)return "2H";
  if(seconds<105*60)return "ET1";
  return "ET2";
}

function routeDistance(event:CsvEvent){
  if(event.endX===undefined||event.endY===undefined)return "";
  return Math.round(Math.hypot((event.endX-event.x)*1.05,(event.endY-event.y)*.68));
}

function safeCell(value:unknown){
  let text=value===undefined||value===null?"":String(value);
  if(/^[=+@]/.test(text)||/^-[^\d]/.test(text))text=`'${text}`;
  return /[",\r\n]/.test(text)?`"${text.replaceAll('"','""')}"`:text;
}

export function buildEventsCsv(session:CsvSession,teams:CsvTeam[]){
  const columns = [
    "event_id","session_id","match_name","competition","period","minute","second","match_time","match_seconds",
    "team_side","team_code","team_id","team_name","player_id","player_number","player_name","player_position",
    "action","outcome","phase","set_piece","shot_detail","origin_x_pct","origin_y_pct","destination_x_pct",
    "destination_y_pct","distance_m","goal_x_pct","goal_y_pct","marker_color","marker_shape",
  ];
  const rows=session.events.map(event=>{
    const matchSeconds=secondsFromTime(event.minute);
    const isHome=event.team==="RIV";
    const teamId=isHome?session.homeTeamId:session.awayTeamId;
    const team=teams.find(item=>item.id===teamId);
    const player=team?.players.find(item=>`${String(item.number).padStart(2,"0")} ${item.name}`===event.player);
    const fallback=event.player.match(/^(\d+)\s+(.+)$/);
    return [
      event.id,session.id,session.matchName,session.competition,periodFor(matchSeconds),Math.floor(matchSeconds/60),matchSeconds%60,
      event.minute,matchSeconds,isHome?"home":"away",event.team,teamId||"",team?.name||event.team,player?.id||"",
      player?.number??fallback?.[1]??"",player?.name??fallback?.[2]??event.player,player?.position||"",event.action,event.outcome,
      event.phase||"",event.setPiece||"",event.shotDetail||"",event.x,event.y,event.endX??"",event.endY??"",routeDistance(event),
      event.goalX??"",event.goalY??"",event.color||"",event.marker||"",
    ].map(safeCell).join(",");
  });
  return [columns.join(","),...rows].join("\r\n");
}
