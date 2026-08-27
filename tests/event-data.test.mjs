import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source=await readFile(new URL("../app/event-data.ts",import.meta.url),"utf8");
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText;
const {buildEventsCsv,removeEventById}=await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

function parseCsv(text){
  const rows=[];let row=[],cell="",quoted=false;
  for(let index=0;index<text.length;index++){
    const char=text[index];
    if(quoted&&char==='"'&&text[index+1]==='"'){cell+='"';index++;continue}
    if(char==='"'){quoted=!quoted;continue}
    if(!quoted&&char===","){row.push(cell);cell="";continue}
    if(!quoted&&(char==="\n"||char==="\r")){if(char==="\r"&&text[index+1]==="\n")index++;row.push(cell);rows.push(row);row=[];cell="";continue}
    cell+=char;
  }
  row.push(cell);rows.push(row);return rows;
}

test("removes only the selected event without mutating the source list",()=>{
  const sourceEvents=[{id:1,action:"Pass"},{id:2,action:"Shot"},{id:3,action:"Recovery"}];
  const result=removeEventById(sourceEvents,2);
  assert.deepEqual(result.map(event=>event.id),[1,3]);
  assert.deepEqual(sourceEvents.map(event=>event.id),[1,2,3]);
});

test("exports one analysis-ready CSV row per event with normalized dimensions",()=>{
  const teams=[{id:"river",name:'River, "Plate"',players:[{id:"p1",name:"M. Lanzini",number:10,position:"AM"}]}];
  const session={id:"match-1",matchName:"River vs Boca",competition:"Friendly",clock:2528,homeTeamId:"river",awayTeamId:"boca",events:[{
    id:7,minute:"42:08",team:"RIV",player:"10 M. Lanzini",action:"Pass",outcome:"Successful",phase:"Build-up",
    x:10,y:20,endX:30,endY:20,color:"#10a37f",marker:"circle",
  }]};
  const rows=parseCsv(buildEventsCsv(session,teams));
  assert.equal(rows.length,2);
  const record=Object.fromEntries(rows[0].map((column,index)=>[column,rows[1][index]]));
  assert.equal(record.event_id,"7");
  assert.equal(record.period,"1H");
  assert.equal(record.minute,"42");
  assert.equal(record.second,"8");
  assert.equal(record.match_seconds,"2528");
  assert.equal(record.team_side,"home");
  assert.equal(record.team_name,'River, "Plate"');
  assert.equal(record.player_id,"p1");
  assert.equal(record.player_number,"10");
  assert.equal(record.player_name,"M. Lanzini");
  assert.equal(record.player_position,"AM");
  assert.equal(record.action,"Pass");
  assert.equal(record.outcome,"Successful");
  assert.equal(record.phase,"Build-up");
  assert.equal(record.origin_x_pct,"10");
  assert.equal(record.destination_x_pct,"30");
  assert.equal(record.distance_m,"21");
});
