import { useState, useEffect, useRef } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, AreaChart, Area } from "recharts";
import Papa from "papaparse";
import { parseCSV, processCSVRows, dbRowsToCSVFormat, generateContentHash, parseDatetime, parseTemplateName, humanizeTemplateName } from "./csvParser";
import { supabase } from "./supabase";
import { DEFAULT_MEETINGS as _RAW_MEETINGS } from "./defaultData";

var font="'Source Sans 3', sans-serif";
var mono="'JetBrains Mono', monospace";
var C={bg:"#FAFBFC",card:"#FFF",border:"#E5E7EB",text:"#111827",sub:"#374151",muted:"#6B7280",accent:"#2563EB",green:"#059669",red:"#DC2626",yellow:"#D97706",purple:"#7C3AED",cyan:"#0891B2",orange:"#EA580C",pink:"#EC4899",lBlue:"#EFF6FF",lGreen:"#ECFDF5",lRed:"#FEF2F2",lPurple:"#F5F3FF"};

// Filter default meetings to only those that received MSG1, and compute ml/igL/igA flags
var DEFAULT_MEETINGS=_RAW_MEETINGS.filter(function(m){return m.tr.indexOf("MSG1")>=0;}).map(function(m){var hasMl=false,hasIgL=false,hasIgA=false;for(var i=0;i<m.c.length;i++){if(m.c[i][0]===2&&m.c[i][1]&&m.c[i][1].indexOf("meetings.hubspot.com/")>=0)hasMl=true;if(m.c[i][0]===1&&m.c[i][1]){if(/instagram\.com/i.test(m.c[i][1]))hasIgL=true;if(/@\w+|ig\s*:/i.test(m.c[i][1]))hasIgA=true;}}return Object.assign({},m,{ml:hasMl,igL:hasIgL,igA:hasIgA});});
var _dIgL=DEFAULT_MEETINGS.filter(function(m){return m.igL;}).length;
var _dIgA=DEFAULT_MEETINGS.filter(function(m){return m.igA&&!m.igL;}).length;

var DEFAULT_TOPICS=[{"t": "Automatizaci\u00f3n", "e": "\u{1F916}", "n": 113, "p": 96.6}, {"t": "Ventas", "e": "\u{1F4CA}", "n": 99, "p": 84.6}, {"t": "Soporte", "e": "\u{1F527}", "n": 96, "p": 82.1}, {"t": "Configuraci\u00f3n", "e": "\u2699\uFE0F", "n": 93, "p": 79.5}, {"t": "Whatsapp", "e": "\u{1F4AC}", "n": 85, "p": 72.6}, {"t": "Precios", "e": "\u{1F4B0}", "n": 58, "p": 49.6}];

var DEFAULT_D={
  all:{resp:117,rate:"25.9%",topics:DEFAULT_TOPICS,ig:32,igR:"27.4%",igLink:_dIgL,igLinkR:(_dIgL/117*100).toFixed(1)+"%",igAt:_dIgA,igAtR:(_dIgA/117*100).toFixed(1)+"%",mc:6,mR:"5.1%",tool:67,tR:"57.3%",eng:{alto:{v:2,p:"1.7%"},medio:{v:15,p:"12.8%"},bajo:{v:53,p:"45.3%"},minimo:{v:47,p:"40.2%"}},hours:[48,74,40,17,108,45,32,11,22,22,18,39,138,118,40,118,121,82,105,60,67,51,67,70],
    tpl:[
      {name:"MSG 1 \u2014 Yago SDR",day:"D+0",sent:452,resp:41,rate:"9.1%"},
      {name:"MSG 2a \u2014 Sin WA",day:"D+1",sent:356,resp:30,rate:"8.4%"},
      {name:"MSG 2b \u2014 Caso de \u00C9xito",day:"D+1",sent:15,resp:4,rate:"26.7%"},
      {name:"MSG 3 \u2014 Value Nudge",day:"D+3",sent:232,resp:23,rate:"9.9%"},
      {name:"MSG 4 \u2014 Quick Audit",day:"D+5",sent:109,resp:17,rate:"15.6%"},
    ],
    bcast:[{name:"Emprende Show",day:"Bcast",sent:123,resp:2,rate:"1.6%"}]},
  real:{resp:103,rate:"22.8%",topics:DEFAULT_TOPICS,ig:32,igR:"31.1%",igLink:_dIgL,igLinkR:(_dIgL/103*100).toFixed(1)+"%",igAt:_dIgA,igAtR:(_dIgA/103*100).toFixed(1)+"%",mc:6,mR:"5.8%",tool:67,tR:"65.0%",eng:{alto:{v:2,p:"1.7%"},medio:{v:15,p:"12.8%"},bajo:{v:53,p:"45.3%"},minimo:{v:47,p:"40.2%"}},hours:[48,74,40,17,108,45,32,11,22,22,18,39,138,118,40,118,121,82,105,60,67,51,67,70],
    tpl:[
      {name:"MSG 1 \u2014 Yago SDR",day:"D+0",sent:452,resp:41,rate:"9.1%"},
      {name:"MSG 2a \u2014 Sin WA",day:"D+1",sent:356,resp:30,rate:"8.4%"},
      {name:"MSG 2b \u2014 Caso de \u00C9xito",day:"D+1",sent:15,resp:4,rate:"26.7%"},
      {name:"MSG 3 \u2014 Value Nudge",day:"D+3",sent:232,resp:23,rate:"9.9%"},
      {name:"MSG 4 \u2014 Quick Audit",day:"D+5",sent:109,resp:17,rate:"15.6%"},
    ],
    bcast:[{name:"Emprende Show",day:"Bcast",sent:123,resp:2,rate:"1.6%"}]}
};

var DEFAULT_FUNNEL_ALL=[{n:"Contactados",v:452,c:C.accent},{n:"Respondieron",v:117,c:C.purple},{n:"Config. Plataf.",v:67,c:C.green},{n:"Enviaron IG",v:32,c:C.orange},{n:"Oferta Reuni\u00F3n",v:6,c:C.pink}];
var DEFAULT_FUNNEL_REAL=[{n:"Contactados",v:452,c:C.accent},{n:"Resp. Reales",v:103,c:C.cyan},{n:"Config. Plataf.",v:67,c:C.green},{n:"Enviaron IG",v:32,c:C.orange},{n:"Oferta Reuni\u00F3n",v:6,c:C.pink}];
var DEFAULT_CH_BENCH=[{ch:"WA Warm*",r:45,y:0},{ch:"Yago (todas)",r:25.9,y:1},{ch:"Yago (reales)",r:22.8,y:1},{ch:"LinkedIn Cold*",r:18,y:0},{ch:"WA Cold*",r:15,y:0},{ch:"SMS Mktg*",r:12,y:0},{ch:"Email Cold*",r:8.5,y:0}];
var DEFAULT_DAILY=[{d:"04/02",l:11},{d:"05/02",l:67},{d:"06/02",l:39},{d:"07/02",l:60},{d:"08/02",l:63},{d:"09/02",l:60},{d:"10/02",l:82},{d:"11/02",l:70}];
var DEFAULT_BTABLE=[{m:"Respuesta (todas)",y:"25.9%",b:"40-60%",d:"-14 a -34pp",s:0},{m:"Respuesta (reales)",y:"22.8%",b:"40-60%",d:"-17 a -37pp",s:0},{m:"Env\u00EDo de Instagram",y:"27.4%",b:"35-50%",d:"~-8pp",s:0},{m:"Oferta Reuni\u00F3n",y:"5.1%",b:"20-30%",d:"~-15pp",s:0},{m:"Tiempo 1a Resp.",y:"~3 min",b:"<15 min",d:"5x mejor",s:1},{m:"Msgs/Conv.",y:"13.0",b:"10-20",d:"Normal",s:1}];
var DEFAULT_MEET_BY_TPL_ALL=[{l:"MSG1",v:41,c:C.accent},{l:"MSG2a",v:30,c:C.purple},{l:"MSG3",v:23,c:C.cyan},{l:"MSG4",v:17,c:C.orange},{l:"MSG2b",v:4,c:C.purple},{l:"MSG2c",v:2,c:C.yellow}];
var DEFAULT_MEET_BY_TPL_REAL=[{l:"MSG1",v:37,c:C.accent},{l:"MSG2a",v:27,c:C.purple},{l:"MSG3",v:20,c:C.cyan},{l:"MSG4",v:14,c:C.orange},{l:"MSG2b",v:3,c:C.purple},{l:"MSG2c",v:2,c:C.yellow}];
var DEFAULT_HEADER={totalContactados:452,leadsPerDay:57,dateRange:"04/02 \u2013 11/02",autoReplyCount:14,realesCount:103,esRate:"27.8",esResp:105,esTotal:378,ptRate:"16.2",ptResp:12,ptTotal:74};
// Note: ES/PT counts based on MSG1 template language detection

var tplCol={MSG1:"#2563EB",MSG2a:"#7C3AED",MSG2b:"#7C3AED",MSG2c:"#D97706",MSG3:"#0891B2",MSG4:"#EA580C"};
var tplNm={MSG1:"MSG 1 \u2014 Yago SDR (D+0)",MSG2a:"MSG 2a \u2014 Sin WA (D+1)",MSG2b:"MSG 2b \u2014 Caso de \u00C9xito (D+1)",MSG2c:"Emprende Show (Broadcast)",MSG3:"MSG 3 \u2014 Value Nudge (D+3)",MSG4:"MSG 4 \u2014 Quick Audit (D+5)"};

function Bd({children,color}){return <span style={{background:color+"15",color:color,padding:"4px 12px",borderRadius:6,fontSize:12,fontWeight:700}}>{children}</span>;}
function Sec({children}){return <div style={{fontSize:13,color:C.muted,textTransform:"uppercase",letterSpacing:1.5,fontWeight:700,marginBottom:14}}>{children}</div>;}
function Cd({children,style,onClick}){return <div onClick={onClick} style={{background:C.card,border:"1px solid "+C.border,borderRadius:14,padding:20,boxShadow:"0 1px 3px #0000000a",...style}}>{children}</div>;}

function qualLabel(q){if(!q)return{t:"Sin calificaci\u00F3n",c:C.muted};var lo=q.toLowerCase();if(lo==="alta")return{t:"Alta",c:C.green};if(lo==="media"||lo==="m\u00E9dia")return{t:"Media",c:C.accent};if(lo==="baja"||lo==="baixa")return{t:"Baja",c:C.yellow};return{t:q,c:C.muted};}

function ConvView({lead,onBack}){
  var eC={alto:C.green,medio:C.accent,bajo:C.yellow,minimo:C.red};
  var ql=qualLabel(lead.q);
  return (<div style={{maxHeight:"78vh",overflowY:"auto"}}>
    <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:0,position:"sticky",top:0,background:C.card,padding:"12px 0",zIndex:2,borderBottom:"1px solid "+C.border}}>
      <button onClick={onBack} style={{background:"#F3F4F6",border:"none",borderRadius:8,padding:"8px 14px",fontSize:13,cursor:"pointer",fontWeight:700,color:C.muted}}>{"\u2190 Volver"}</button>
      <div style={{flex:1}}>
        <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
          <span style={{fontSize:18}}>{lead.co}</span>
          <span style={{fontSize:17,fontWeight:800,fontFamily:mono}}>{lead.p}</span>
          <Bd color={eC[lead.e]||C.muted}>{lead.e}</Bd>
          <Bd color={ql.c}>{ql.t}</Bd>
          {lead.au && <Bd color={C.red}>AUTO-REPLY</Bd>}
        </div>
        <div style={{fontSize:12,color:C.muted,marginTop:2}}>
          {lead.ms} msgs humanas {"\u00B7"} {lead.w.toLocaleString()} palabras {"\u00B7"} Templates: {lead.tr.join(", ")} {"\u00B7"} 1a resp: <strong>{lead.fr||"N/A"}</strong>
        </div>
      </div>
    </div>
    <div style={{display:"flex",flexDirection:"column",gap:6,paddingTop:14}}>
      {lead.c.map(function(m,i){
        var dt=m[2]||"";
        if(m[0]===0){
          var tc=tplCol[m[1]]||(m[1]&&m[1].startsWith("pt_")?C.green:m[1]&&m[1].startsWith("es_")?C.accent:C.accent);
          var tn=tplNm[m[1]]||m[1];
          return (<div key={i} style={{alignSelf:"center",background:tc+"0C",border:"2px dashed "+tc+"55",borderRadius:12,padding:"10px 20px",margin:"10px 0",maxWidth:"88%",textAlign:"center"}}>
            <div style={{fontSize:11,fontWeight:800,color:tc,textTransform:"uppercase",letterSpacing:1}}>{"\u{1F4CB} TEMPLATE ENVIADO"}</div>
            <div style={{fontSize:15,fontWeight:700,color:tc,marginTop:3}}>{tn}</div>
            {dt && <div style={{fontSize:11,color:C.muted,marginTop:3}}>{dt}</div>}
          </div>);
        }
        if(m[0]===1) return (<div key={i} style={{alignSelf:"flex-end",background:"#DCF8C6",borderRadius:"16px 16px 4px 16px",padding:"10px 14px",fontSize:14,color:"#111",maxWidth:"72%",lineHeight:1.6,whiteSpace:"pre-wrap"}}>
          {m[1]}{dt && <div style={{fontSize:10,color:"#6B7280",marginTop:4,textAlign:"right"}}>{dt}</div>}
        </div>);
        if(m[0]===2){
          var txt=m[1];
          if(!txt||txt.trim()==="") return null;
          return (<div key={i} style={{alignSelf:"flex-start",background:C.lBlue,borderRadius:"16px 16px 16px 4px",padding:"10px 14px",fontSize:14,color:"#111",maxWidth:"72%",lineHeight:1.6,whiteSpace:"pre-wrap"}}>
            <div style={{fontSize:10,fontWeight:700,color:C.accent,marginBottom:4}}>{"\u{1F916} YAGO"}</div>
            {txt}{dt && <div style={{fontSize:10,color:"#6B7280",marginTop:4}}>{dt}</div>}
          </div>);
        }
        return null;
      })}
      {lead.c.length>=80 && <div style={{textAlign:"center",fontSize:13,color:C.muted,padding:16,background:"#F9FAFB",borderRadius:8,margin:"8px 0"}}>{"\u26A0 Conversaci\u00F3n truncada (primeros 80 mensajes)"}</div>}
    </div>
  </div>);
}

function MeetModal({leads,onClose,mode,title}){
  const [sel,setSel]=useState(null);
  var eC={alto:C.green,medio:C.accent,bajo:C.yellow,minimo:C.red};
  var filtered=mode===1?leads.filter(function(l){return !l.au;}):leads;

  return (<div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"#00000055",zIndex:999,display:"flex",alignItems:"center",justifyContent:"center",padding:20}} onClick={onClose}>
    <div style={{background:C.card,borderRadius:16,padding:24,maxWidth:880,width:"100%",maxHeight:"92vh",boxShadow:"0 25px 60px #00000025"}} onClick={function(e){e.stopPropagation();}}>
      {sel!==null ? (
        <ConvView lead={filtered[sel]} onBack={function(){setSel(null);}} />
      ) : (<div style={{maxHeight:"82vh",overflowY:"auto"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
          <div>
            <div style={{fontSize:19,fontWeight:900}}>{title||"\u{1F4C5} Leads con Oferta de Reuni\u00F3n"}</div>
            <div style={{fontSize:14,color:C.muted,marginTop:2}}>{filtered.length} leads {"\u00B7"} Click en un contacto para ver la conversaci\u00F3n</div>
          </div>
          <button onClick={onClose} style={{background:"#F3F4F6",border:"none",borderRadius:8,width:36,height:36,fontSize:18,cursor:"pointer",color:C.muted,fontWeight:700}}>{"\u2715"}</button>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {filtered.map(function(l,i){
            var ql=qualLabel(l.q);
            return (<div key={i} onClick={function(){setSel(i);}} style={{display:"flex",alignItems:"center",gap:14,padding:"14px 16px",background:"#F9FAFB",borderRadius:12,cursor:"pointer",border:"2px solid transparent"}}>
              <span style={{fontSize:20}}>{l.co}</span>
              <div style={{flex:1}}>
                <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                  <span style={{fontFamily:mono,fontWeight:700,fontSize:16}}>{l.p}</span>
                  <Bd color={eC[l.e]||C.muted}>{l.e}</Bd>
                  <Bd color={ql.c}>{ql.t}</Bd>
                  {l.au && <Bd color={C.red}>AUTO</Bd>}
                </div>
                <div style={{fontSize:12,color:C.muted,marginTop:3}}>
                  {l.ms} msgs {"\u00B7"} {l.w.toLocaleString()} pal. {"\u00B7"} Tpls: <strong>{l.tr.join(", ")}</strong> {"\u00B7"} 1a resp: <strong style={{color:C.text}}>{l.fr||"N/A"}</strong>
                </div>
              </div>
              <div style={{color:C.accent,fontSize:18,fontWeight:700}}>{"\u2192"}</div>
            </div>);
          })}
        </div>
        <div style={{marginTop:16,display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8}}>
          {[{l:"Alto",c:C.green,v:filtered.filter(function(x){return x.e==="alto";}).length},{l:"Medio",c:C.accent,v:filtered.filter(function(x){return x.e==="medio";}).length},{l:"Bajo",c:C.yellow,v:filtered.filter(function(x){return x.e==="bajo";}).length},{l:"M\u00EDnimo",c:C.red,v:filtered.filter(function(x){return x.e==="minimo";}).length}].map(function(s,i){
            return (<div key={i} style={{background:s.c+"08",borderRadius:8,padding:"8px 12px",textAlign:"center",border:"1px solid "+s.c+"20"}}>
              <div style={{fontSize:10,color:C.muted,fontWeight:600}}>{s.l}</div>
              <div style={{fontSize:22,fontWeight:800,fontFamily:mono,color:s.c}}>{s.v}</div>
            </div>);
          })}
        </div>
      </div>)}
    </div>
  </div>);
}

function TplModal({tpl,leads,mode,onClose}){
  const [sel,setSel]=useState(null);
  var eC={alto:C.green,medio:C.accent,bajo:C.yellow,minimo:C.red};
  var filtered=leads.filter(function(l){
    if(mode===1&&l.au) return false;
    return l.fr===tpl.key;
  });
  var cleanContent=tpl.content;
  if(cleanContent){
    cleanContent=cleanContent.replace(/\[Este mensaje fue enviado automáticamente[^\]]*\]/gi,"").replace(/\[Esta mensagem foi enviada automaticamente[^\]]*\]/gi,"").trim();
  }
  var rn=parseFloat(tpl.rate);var sc=rn>=20?C.green:rn>=12?C.yellow:C.red;

  return (<div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"#00000055",zIndex:999,display:"flex",alignItems:"center",justifyContent:"center",padding:20}} onClick={onClose}>
    <div style={{background:C.card,borderRadius:16,padding:24,maxWidth:880,width:"100%",maxHeight:"92vh",boxShadow:"0 25px 60px #00000025"}} onClick={function(e){e.stopPropagation();}}>
      {sel!==null ? (
        <ConvView lead={filtered[sel]} onBack={function(){setSel(null);}} />
      ) : (<div style={{maxHeight:"82vh",overflowY:"auto"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
          <div>
            <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
              <span style={{fontSize:19,fontWeight:900}}>{tpl.name}</span>
              <span style={{fontSize:12,color:C.muted,background:"#F3F4F6",padding:"2px 8px",borderRadius:4}}>{tpl.day}</span>
              <Bd color={sc}>{tpl.rate}</Bd>
            </div>
            <div style={{fontSize:13,color:C.muted,marginTop:4}}>{filtered.length} leads respondieron a este template</div>
          </div>
          <button onClick={onClose} style={{background:"#F3F4F6",border:"none",borderRadius:8,width:36,height:36,fontSize:18,cursor:"pointer",color:C.muted,fontWeight:700}}>{"\u2715"}</button>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:18}}>
          {[{l:"Enviados",v:tpl.sent,c:C.accent},{l:"Respondieron",v:tpl.resp,c:C.purple},{l:"Tasa",v:tpl.rate,c:sc}].map(function(s,i){return (<div key={i} style={{background:s.c+"08",borderRadius:10,padding:"10px 14px",textAlign:"center",border:"1px solid "+s.c+"18"}}>
            <div style={{fontSize:11,color:C.muted,fontWeight:600}}>{s.l}</div>
            <div style={{fontSize:24,fontWeight:800,fontFamily:mono,color:s.c}}>{s.v}</div>
          </div>);})}
        </div>
        {cleanContent && <div style={{marginBottom:18}}>
          <div style={{fontSize:12,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>Contenido del template</div>
          <div style={{background:"#F9FAFB",border:"1px solid "+C.border,borderRadius:12,padding:"14px 18px",fontSize:14,color:C.sub,lineHeight:1.7,whiteSpace:"pre-wrap",maxHeight:200,overflowY:"auto"}}>{cleanContent}</div>
        </div>}
        {filtered.length>0 && <div>
          <div style={{fontSize:12,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>Leads que respondieron ({filtered.length})</div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {filtered.map(function(l,i){
              var ql=qualLabel(l.q);
              return (<div key={i} onClick={function(){setSel(i);}} style={{display:"flex",alignItems:"center",gap:14,padding:"14px 16px",background:"#F9FAFB",borderRadius:12,cursor:"pointer",border:"2px solid transparent"}}>
                <span style={{fontSize:20}}>{l.co}</span>
                <div style={{flex:1}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                    <span style={{fontFamily:mono,fontWeight:700,fontSize:16}}>{l.p}</span>
                    <Bd color={eC[l.e]||C.muted}>{l.e}</Bd>
                    <Bd color={ql.c}>{ql.t}</Bd>
                    {l.au && <Bd color={C.red}>AUTO</Bd>}
                  </div>
                  <div style={{fontSize:12,color:C.muted,marginTop:3}}>
                    {l.ms} msgs {"\u00B7"} {l.w.toLocaleString()} pal. {"\u00B7"} Tpls: <strong>{l.tr.join(", ")}</strong>
                  </div>
                </div>
                <div style={{color:C.accent,fontSize:18,fontWeight:700}}>{"\u2192"}</div>
              </div>);
            })}
          </div>
        </div>}
        {filtered.length===0 && <div style={{textAlign:"center",padding:30,color:C.muted,fontSize:14}}>Ning\u00FAn lead respondi\u00F3 a este template{mode===1?" (filtro reales activo)":""}.</div>}
      </div>)}
    </div>
  </div>);
}

function Delta({current,previous,suffix,invert}){
  if(previous===null||previous===undefined) return null;
  var cv=typeof current==="string"?parseFloat(current):current;
  var pv=typeof previous==="string"?parseFloat(previous):previous;
  if(isNaN(cv)||isNaN(pv)) return null;
  var diff=cv-pv;
  if(Math.abs(diff)<0.05) return null;
  var positive=invert?diff<0:diff>0;
  return <span style={{fontSize:12,fontWeight:700,color:positive?C.green:C.red,marginLeft:6}}>{diff>0?"\u25B2":"\u25BC"} {Math.abs(diff).toFixed(1)}{suffix||"pp"}</span>;
}

var EMPTY_ENG={alto:{v:0,p:"0%"},medio:{v:0,p:"0%"},bajo:{v:0,p:"0%"},minimo:{v:0,p:"0%"}};
var EMPTY_D={
  all:{resp:0,rate:"0%",topics:[],ig:0,igR:"0%",igLink:0,igLinkR:"0%",igAt:0,igAtR:"0%",mc:0,mR:"0%",tool:0,tR:"0%",eng:EMPTY_ENG,hours:new Array(24).fill(0),tpl:[],bcast:[],tplByStep:null},
  real:{resp:0,rate:"0%",topics:[],ig:0,igR:"0%",igLink:0,igLinkR:"0%",igAt:0,igAtR:"0%",mc:0,mR:"0%",tool:0,tR:"0%",eng:EMPTY_ENG,hours:new Array(24).fill(0),tpl:[],bcast:[],tplByStep:null}
};
var EMPTY_HEADER={totalContactados:0,leadsPerDay:0,dateRange:"",autoReplyCount:0,realesCount:0,esRate:"0",esResp:0,esTotal:0,ptRate:"0",ptResp:0,ptTotal:0};

export default function Dashboard(){
  const [tab,setTab]=useState("overview");
  const [mode,setMode]=useState(0);
  const [showM,setShowM]=useState(false);
  const [showA,setShowA]=useState(false);
  const [csvLoading,setCsvLoading]=useState(false);
  const [csvName,setCsvName]=useState(null);
  const [dbLoading,setDbLoading]=useState(true);
  const [toolsOpen,setToolsOpen]=useState(false);
  const toolsRef=useRef(null);

  const [meetings,setMeetings]=useState([]);
  const [topicsAll,setTopicsAll]=useState([]);
  const [dataD,setDataD]=useState(EMPTY_D);
  const [funnelAll,setFunnelAll]=useState([]);
  const [funnelReal,setFunnelReal]=useState([]);
  const [chBench,setChBench]=useState([]);
  const [daily,setDaily]=useState([]);
  const [bTable,setBTable]=useState([]);
  const [meetByTplAll,setMeetByTplAll]=useState([]);
  const [meetByTplReal,setMeetByTplReal]=useState([]);
  const [headerInfo,setHeaderInfo]=useState(EMPTY_HEADER);
  const [selTpl,setSelTpl]=useState(null);
  const [searchQuery,setSearchQuery]=useState("");
  const [searchResults,setSearchResults]=useState(null);
  const [searchLoading,setSearchLoading]=useState(false);
  const [searchSel,setSearchSel]=useState(null);
  const [searchThreadData,setSearchThreadData]=useState(null);
  const [rawRows,setRawRows]=useState(null);
  const [dateFrom,setDateFrom]=useState("");
  const [dateTo,setDateTo]=useState("");
  const [imports,setImports]=useState([]);
  const [selectedImportId,setSelectedImportId]=useState(null);
  const [compareImportId,setCompareImportId]=useState(null);
  const [compareData,setCompareData]=useState(null);
  const [comparing,setComparing]=useState(false);

  async function loadMessagesForImport(importId){
    if(!importId) return;
    var allRows=[];
    var PAGE=5000;
    var offset=0;
    while(true){
      var {data:rows,error}=await supabase.from("messages").select("thread_id,phone_number,template_sent_at,message_type,message_datetime,message_content,lead_qualification,template_name,step_order").eq("import_id",importId).range(offset,offset+PAGE-1);
      if(error){console.error("Load messages error:",error);break;}
      if(!rows||rows.length===0) break;
      allRows=allRows.concat(rows);
      if(rows.length<PAGE) break;
      offset+=PAGE;
    }
    if(allRows.length>0){
      var csvRows=dbRowsToCSVFormat(allRows);
      setRawRows(csvRows);
      var result=processCSVRows(csvRows);
      var hi={totalContactados:result.totalContactados,leadsPerDay:result.leadsPerDay,dateRange:result.dateRange,autoReplyCount:result.autoReplyCount,realesCount:result.realesCount,esRate:result.esRate,esResp:result.esResp,esTotal:result.esTotal,ptRate:result.ptRate,ptResp:result.ptResp,ptTotal:result.ptTotal};
      setMeetings(result.MEETINGS);setTopicsAll(result.topicsAll);setDataD(result.D);setFunnelAll(result.funnelAll);setFunnelReal(result.funnelReal);setChBench(result.chBench);setDaily(result.daily);setBTable(result.bTable);setMeetByTplAll(result.meetByTplAll);setMeetByTplReal(result.meetByTplReal);setHeaderInfo(hi);
    } else {
      setRawRows(null);setMeetings([]);setTopicsAll([]);setDataD(EMPTY_D);setFunnelAll([]);setFunnelReal([]);setChBench([]);setDaily([]);setBTable([]);setMeetByTplAll([]);setMeetByTplReal([]);setHeaderInfo(EMPTY_HEADER);
    }
    setDateFrom("");setDateTo("");
  }

  async function loadCompareData(importId){
    if(!importId){setCompareData(null);return;}
    var allRows=[];
    var PAGE=5000;
    var offset=0;
    while(true){
      var {data:rows,error}=await supabase.from("messages").select("thread_id,phone_number,template_sent_at,message_type,message_datetime,message_content,lead_qualification,template_name,step_order").eq("import_id",importId).range(offset,offset+PAGE-1);
      if(error){console.error("Load compare error:",error);setCompareData(null);return;}
      if(!rows||rows.length===0) break;
      allRows=allRows.concat(rows);
      if(rows.length<PAGE) break;
      offset+=PAGE;
    }
    if(allRows.length>0){
      var csvRows=dbRowsToCSVFormat(allRows);
      var result=processCSVRows(csvRows);
      setCompareData({D:result.D,totalContactados:result.totalContactados,realesCount:result.realesCount,autoReplyCount:result.autoReplyCount});
    } else { setCompareData(null); }
  }

  useEffect(function(){
    async function loadFixedCSV(){
      try{
        var resp=await fetch("/026-02-16T14_01_.csv");
        var text=await resp.text();
        var parsed=Papa.parse(text,{header:true,skipEmptyLines:true});
        var csvRows=parsed.data;
        setRawRows(csvRows);
        var result=processCSVRows(csvRows);
        var hi={totalContactados:result.totalContactados,leadsPerDay:result.leadsPerDay,dateRange:result.dateRange,autoReplyCount:result.autoReplyCount,realesCount:result.realesCount,esRate:result.esRate,esResp:result.esResp,esTotal:result.esTotal,ptRate:result.ptRate,ptResp:result.ptResp,ptTotal:result.ptTotal};
        setMeetings(result.MEETINGS);setTopicsAll(result.topicsAll);setDataD(result.D);setFunnelAll(result.funnelAll);setFunnelReal(result.funnelReal);setChBench(result.chBench);setDaily(result.daily);setBTable(result.bTable);setMeetByTplAll(result.meetByTplAll);setMeetByTplReal(result.meetByTplReal);setHeaderInfo(hi);
        setCsvName("026-02-16T14_01_");
      }catch(e){console.error("Load fixed CSV error:",e);}
      setDbLoading(false);
    }
    loadFixedCSV();
  },[]);

  useEffect(function(){
    function handleClick(e){
      if(toolsRef.current && !toolsRef.current.contains(e.target)) setToolsOpen(false);
    }
    document.addEventListener("mousedown",handleClick);
    return function(){document.removeEventListener("mousedown",handleClick);};
  },[]);

  async function handleCSV(e){
    var file=e.target.files[0];
    if(!file) return;
    setCsvLoading(true);
    try{
      var result=await parseCSV(file);
      setRawRows(result.rawRows);
      var hi={totalContactados:result.totalContactados,leadsPerDay:result.leadsPerDay,dateRange:result.dateRange,autoReplyCount:result.autoReplyCount,realesCount:result.realesCount,esRate:result.esRate,esResp:result.esResp,esTotal:result.esTotal,ptRate:result.ptRate,ptResp:result.ptResp,ptTotal:result.ptTotal};
      setMeetings(result.MEETINGS);setTopicsAll(result.topicsAll);setDataD(result.D);setFunnelAll(result.funnelAll);setFunnelReal(result.funnelReal);setChBench(result.chBench);setDaily(result.daily);setBTable(result.bTable);setMeetByTplAll(result.meetByTplAll);setMeetByTplReal(result.meetByTplReal);setHeaderInfo(hi);

      // Create import record with label (filename without extension)
      var label=file.name.replace(/\.[^.]+$/,"");
      var rawRows=result.rawRows;
      var threadSet=new Set(rawRows.map(function(r){return r.thread_id;}).filter(Boolean));
      var {data:impData,error:impErr}=await supabase.from("imports").insert({filename:file.name,label:label,total_messages:rawRows.length,total_threads:threadSet.size,new_threads:threadSet.size}).select("id").single();
      if(impErr){console.error("Import insert error:",impErr);setCsvLoading(false);return;}
      var importId=impData.id;

      // Batch insert messages (500 per batch)
      var BATCH=500;
      for(var i=0;i<rawRows.length;i+=BATCH){
        var batch=rawRows.slice(i,i+BATCH);
        var inserts=[];
        for(var j=0;j<batch.length;j++){
          var r=batch[j];
          if(!r.thread_id) continue;
          var tsa=parseDatetime(r.template_sent_at);
          var mdt=parseDatetime(r.message_datetime);
          var hash=await generateContentHash(r.thread_id,r.message_type,r.message_content,mdt?mdt.toISOString():r.message_datetime);
          inserts.push({
            thread_id:r.thread_id,
            phone_number:r.phone_number||null,
            template_sent_at:tsa?tsa.toISOString():null,
            message_type:r.message_type,
            message_datetime:mdt?mdt.toISOString():null,
            message_content:r.message_content||null,
            lead_qualification:r.lead_qualification||null,
            content_hash:hash,
            import_id:importId,
            template_name:r.template_name||null,
            step_order:r.step_order?parseInt(r.step_order):null,
          });
        }
        if(inserts.length>0){
          var {error:bErr}=await supabase.from("messages").insert(inserts);
          if(bErr) console.error("Batch insert error at offset "+i+":",bErr);
        }
      }

      // Update imports list and select the new one
      var {data:allImports}=await supabase.from("imports").select("*").order("imported_at",{ascending:false});
      if(allImports) setImports(allImports);
      setSelectedImportId(importId);
      setCsvName(label);
      setCompareImportId(null);setCompareData(null);setComparing(false);
      setCsvLoading(false);
    }catch(err){
      console.error("Error parsing CSV:",err);
      setCsvLoading(false);
      alert("Error al parsear CSV: "+err.message);
    }
    e.target.value="";
  }


  function resetDashboard(){
    setMeetings([]);setTopicsAll([]);setDataD(EMPTY_D);setFunnelAll([]);setFunnelReal([]);setChBench([]);setDaily([]);setBTable([]);setMeetByTplAll([]);setMeetByTplReal([]);setHeaderInfo(EMPTY_HEADER);setCsvName(null);setRawRows(null);setDateFrom("");setDateTo("");setImports([]);setSelectedImportId(null);setCompareImportId(null);setCompareData(null);setComparing(false);
  }

  function clearAll(){
    resetDashboard();
    supabase.from("messages").delete().neq("id",0).then(function(){
      supabase.from("imports").delete().neq("id",0);
    });
  }

  async function deleteImport(importId){
    if(!importId) return;
    // CASCADE will delete messages
    await supabase.from("imports").delete().eq("id",importId);
    var {data:allImports}=await supabase.from("imports").select("*").order("imported_at",{ascending:false});
    if(allImports && allImports.length>0){
      setImports(allImports);
      var nextId=allImports[0].id;
      setSelectedImportId(nextId);
      setCsvName(allImports[0].label||allImports[0].filename);
      setCompareImportId(null);setCompareData(null);setComparing(false);
      await loadMessagesForImport(nextId);
    } else {
      resetDashboard();
    }
  }

  async function handleSearch(q){
    if(!q||!q.trim()){setSearchResults(null);return;}
    setSearchLoading(true);setSearchResults(null);setSearchSel(null);setSearchThreadData(null);
    var query=q.trim();
    var results=[];
    var seenPhones=new Set();

    // 1. In-memory search by phone
    for(var i=0;i<meetings.length;i++){
      var m=meetings[i];
      if(m.p&&m.p.indexOf(query)>=0){
        results.push({lead:m,source:"memory",threadId:null});
        seenPhones.add(m.p);
      }
    }

    // 2. DB search by thread_id (exact) or phone_number (partial)
    try{
      var isThreadId=query.startsWith("thread_");
      var dbRows=[];
      if(isThreadId){
        var {data:r1,error:e1}=await supabase.from("messages").select("thread_id,phone_number,template_sent_at,message_type,message_datetime,message_content,lead_qualification,template_name,step_order").eq("thread_id",query).limit(5000);
        if(!e1&&r1) dbRows=r1;
      }else{
        var {data:r2,error:e2}=await supabase.from("messages").select("thread_id,phone_number,template_sent_at,message_type,message_datetime,message_content,lead_qualification,template_name,step_order").ilike("phone_number","%"+query+"%").limit(5000);
        if(!e2&&r2) dbRows=r2;
      }

      if(dbRows.length>0){
        // Group by thread_id and reconstruct conversations
        var grouped={};
        for(var j=0;j<dbRows.length;j++){
          var tid=dbRows[j].thread_id;
          if(!grouped[tid]) grouped[tid]=[];
          grouped[tid].push(dbRows[j]);
        }
        var tids=Object.keys(grouped);
        for(var k=0;k<tids.length;k++){
          var threadMsgs=grouped[tids[k]];
          var phone=null;
          for(var pi=0;pi<threadMsgs.length;pi++){if(threadMsgs[pi].phone_number){phone=threadMsgs[pi].phone_number;break;}}
          // Skip if already found in memory
          if(phone&&seenPhones.has(phone)) continue;
          // Reconstruct lead data
          var csvRows=dbRowsToCSVFormat(threadMsgs);
          var processed=processCSVRows(csvRows);
          if(processed.MEETINGS&&processed.MEETINGS.length>0){
            for(var mi=0;mi<processed.MEETINGS.length;mi++){
              results.push({lead:processed.MEETINGS[mi],source:"db",threadId:tids[k]});
            }
          }else{
            // Thread had no human response — build minimal view from raw messages
            var conv=[];
            for(var ri=0;ri<csvRows.length;ri++){
              var row=csvRows[ri];
              var dt=row.message_datetime||"";
              if(row.message_type==="ai") conv.push([2,row.message_content||"",dt]);
              else if(row.message_type==="human") conv.push([1,row.message_content||"",dt]);
            }
            results.push({lead:{p:phone||"?",ms:0,w:0,au:false,e:"minimo",q:"",co:"\u{1F30E}",tr:[],fr:null,c:conv,ml:false},source:"db",threadId:tids[k]});
          }
        }
      }
    }catch(err){console.error("Search DB error:",err);}

    setSearchResults(results);
    setSearchLoading(false);
  }

  async function selectSearchResult(idx){
    setSearchSel(idx);setSearchThreadData(null);
    var item=searchResults[idx];
    // Fetch thread analytics from threads table
    var threadId=item.threadId;
    if(!threadId&&item.lead&&item.lead.p){
      // Try to find thread by phone
      var {data:tRows}=await supabase.from("threads").select("*").eq("phone_number",item.lead.p).limit(1);
      if(tRows&&tRows.length>0) setSearchThreadData(tRows[0]);
    }else if(threadId){
      var {data:tRows2}=await supabase.from("threads").select("*").eq("thread_id",threadId).limit(1);
      if(tRows2&&tRows2.length>0) setSearchThreadData(tRows2[0]);
    }
  }

  function filterRowsByDate(rows,from,to){
    if(!from&&!to) return rows;
    var fromD=from?new Date(from+"T00:00:00"):null;
    var toD=to?new Date(to+"T23:59:59"):null;
    var threads={};
    for(var i=0;i<rows.length;i++){
      var tid=rows[i].thread_id;
      if(!tid) continue;
      if(!threads[tid]) threads[tid]={rows:[],sentAt:null};
      threads[tid].rows.push(rows[i]);
      if(!threads[tid].sentAt){
        // Try template_sent_at first, then message_datetime as fallback
        var src=rows[i].template_sent_at||rows[i].message_datetime;
        if(src){
          var dd=parseDatetime(src);
          if(dd&&!isNaN(dd.getTime())) threads[tid].sentAt=dd;
        }
      }
    }
    var out=[];
    var tids=Object.keys(threads);
    for(var j=0;j<tids.length;j++){
      var th=threads[tids[j]];
      if(!th.sentAt) continue;
      if(fromD&&th.sentAt<fromD) continue;
      if(toD&&th.sentAt>toD) continue;
      out=out.concat(th.rows);
    }
    return out;
  }

  function applyDateFilter(from,to){
    if(!rawRows) return;
    var filtered=filterRowsByDate(rawRows,from,to);
    var result=processCSVRows(filtered);
    var hi={totalContactados:result.totalContactados,leadsPerDay:result.leadsPerDay,dateRange:result.dateRange,autoReplyCount:result.autoReplyCount,realesCount:result.realesCount,esRate:result.esRate,esResp:result.esResp,esTotal:result.esTotal,ptRate:result.ptRate,ptResp:result.ptResp,ptTotal:result.ptTotal};
    setMeetings(result.MEETINGS);setTopicsAll(result.topicsAll);setDataD(result.D);setFunnelAll(result.funnelAll);setFunnelReal(result.funnelReal);setChBench(result.chBench);setDaily(result.daily);setBTable(result.bTable);setMeetByTplAll(result.meetByTplAll);setMeetByTplReal(result.meetByTplReal);setHeaderInfo(hi);
  }

  function onDateFromChange(e){var v=e.target.value;setDateFrom(v);applyDateFilter(v,dateTo);}
  function onDateToChange(e){var v=e.target.value;setDateTo(v);applyDateFilter(dateFrom,v);}
  function clearDateFilter(){setDateFrom("");setDateTo("");applyDateFilter("","");}

  var mk=mode===0?"all":"real";var d=dataD[mk];var funnel=mode===0?funnelAll:funnelReal;var mbt=mode===0?meetByTplAll:meetByTplReal;
  var tc=headerInfo.totalContactados;
  var lpd=headerInfo.leadsPerDay;

  if(dbLoading) return (<div style={{background:C.bg,minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:font}}>
    <div style={{textAlign:"center"}}>
      <div style={{fontSize:36,marginBottom:12}}>{"..."}</div>
      <div style={{fontSize:16,color:C.muted,fontWeight:600}}>Cargando datos...</div>
    </div>
  </div>);

  return (<div style={{background:C.bg,minHeight:"100vh",color:C.text,fontFamily:font,fontSize:15}}>
    <link href="https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@400;600;700;800;900&family=JetBrains+Mono:wght@400;700;800&display=swap" rel="stylesheet"/>
    {showM && <MeetModal leads={meetings.filter(function(l){return l.ml;})} mode={mode} onClose={function(){setShowM(false);}} title={"\u{1F4C5} Leads con Oferta de Reuni\u00F3n"}/>}
    {showA && <MeetModal leads={meetings} mode={mode} onClose={function(){setShowA(false);}} title={"\u{1F4AC} Todas las Conversaciones"}/>}
    {selTpl && <TplModal tpl={selTpl} leads={meetings} mode={mode} onClose={function(){setSelTpl(null);}}/>}

    <div style={{background:C.card,borderBottom:"1px solid "+C.border,padding:"16px 28px",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:12}}>
      <div style={{display:"flex",alignItems:"center",gap:14}}>
        <h1 style={{margin:0,fontSize:22,fontWeight:900}}><span style={{color:C.accent}}>YAGO</span> <span style={{color:C.muted,fontWeight:400}}>SDR</span></h1>
        <span style={{fontSize:13,color:C.muted,background:"#F3F4F6",padding:"4px 10px",borderRadius:6,fontWeight:600}}>{headerInfo.dateRange} {"\u00B7"} {tc} leads</span>
        {imports.length>0 && <select value={selectedImportId||""} onChange={function(ev){var newId=Number(ev.target.value);setSelectedImportId(newId);var imp=imports.find(function(i){return i.id===newId;});setCsvName(imp?imp.label||imp.filename:"");setCompareImportId(null);setCompareData(null);setComparing(false);loadMessagesForImport(newId);}} style={{fontSize:12,fontWeight:600,padding:"4px 8px",borderRadius:6,border:"1px solid "+C.border,background:"#F9FAFB",color:C.text,fontFamily:font,cursor:"pointer",maxWidth:180,overflow:"hidden",textOverflow:"ellipsis"}}>
          {imports.map(function(imp){var d=imp.imported_at?new Date(imp.imported_at):null;var ds=d?String(d.getDate()).padStart(2,"0")+"/"+String(d.getMonth()+1).padStart(2,"0"):"";var lbl=(imp.label||imp.filename);if(lbl.length>18)lbl=lbl.substring(0,18)+"\u2026";return <option key={imp.id} value={imp.id}>{lbl+(ds?" ("+ds+")":"")}</option>;})}
        </select>}
        {imports.length>1 && <button onClick={function(){setComparing(!comparing);if(comparing){setCompareImportId(null);setCompareData(null);}}} style={{fontSize:11,fontWeight:700,padding:"4px 10px",borderRadius:6,border:"1px solid "+(comparing?C.purple+"55":C.border),background:comparing?C.lPurple:"#F9FAFB",color:comparing?C.purple:C.muted,cursor:"pointer",fontFamily:font}}>{comparing?"Cerrar":"Comparar"}</button>}
        {comparing && <select value={compareImportId||""} onChange={function(ev){var cid=Number(ev.target.value);setCompareImportId(cid);loadCompareData(cid);}} style={{fontSize:12,fontWeight:600,padding:"4px 8px",borderRadius:6,border:"1px solid "+C.purple+"44",background:C.lPurple,color:C.purple,fontFamily:font,cursor:"pointer"}}>
          <option value="">-- comparar con --</option>
          {imports.filter(function(i){return i.id!==selectedImportId;}).map(function(imp){var d=imp.imported_at?new Date(imp.imported_at):null;var ds=d?String(d.getDate()).padStart(2,"0")+"/"+String(d.getMonth()+1).padStart(2,"0"):"";return <option key={imp.id} value={imp.id}>{(imp.label||imp.filename)+(ds?" ("+ds+")":"")}</option>;})}
        </select>}
      </div>
      <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
        <div ref={toolsRef} style={{position:"relative"}}>
          <button onClick={function(){setToolsOpen(!toolsOpen);}} style={{background:toolsOpen?"#374151":"#F3F4F6",color:toolsOpen?"#fff":C.muted,border:"none",borderRadius:8,padding:"7px 12px",fontSize:16,cursor:"pointer",fontFamily:font,lineHeight:1}}>{"\u2699\uFE0F"}</button>
          {toolsOpen && <div style={{position:"absolute",top:"calc(100% + 6px)",right:0,background:C.card,border:"1px solid "+C.border,borderRadius:10,boxShadow:"0 8px 24px #00000015",zIndex:50,minWidth:190,padding:6}}>
            <label style={{display:"flex",alignItems:"center",gap:8,padding:"9px 14px",borderRadius:8,cursor:csvLoading?"wait":"pointer",fontSize:13,fontWeight:600,color:C.text,background:"transparent"}} onMouseEnter={function(e){e.currentTarget.style.background="#F3F4F6";}} onMouseLeave={function(e){e.currentTarget.style.background="transparent";}}>
              {csvLoading ? "Procesando..." : "\u{1F4C2} Importar CSV"}
              <input type="file" accept=".csv" onChange={function(e){setToolsOpen(false);handleCSV(e);}} style={{display:"none"}} disabled={csvLoading}/>
            </label>
            {selectedImportId && <button onClick={function(){setToolsOpen(false);if(confirm("Eliminar esta campa\u00F1a? Los datos se borrar\u00E1n permanentemente."))deleteImport(selectedImportId);}} style={{display:"flex",alignItems:"center",gap:8,width:"100%",padding:"9px 14px",borderRadius:8,border:"none",background:"transparent",fontSize:13,fontWeight:600,color:C.orange,cursor:"pointer",fontFamily:font,textAlign:"left"}} onMouseEnter={function(e){e.currentTarget.style.background="#FFF7ED";}} onMouseLeave={function(e){e.currentTarget.style.background="transparent";}}>
              {"\u{1F5D1} Eliminar esta campa\u00F1a"}
            </button>}
            <button onClick={function(){setToolsOpen(false);if(confirm("Limpiar TODOS los datos?"))clearAll();}} style={{display:"flex",alignItems:"center",gap:8,width:"100%",padding:"9px 14px",borderRadius:8,border:"none",background:"transparent",fontSize:13,fontWeight:600,color:C.red,cursor:"pointer",fontFamily:font,textAlign:"left"}} onMouseEnter={function(e){e.currentTarget.style.background=C.lRed;}} onMouseLeave={function(e){e.currentTarget.style.background="transparent";}}>
              {"\u{1F5D1} Limpiar todo"}
            </button>
          </div>}
        </div>
        <div style={{display:"flex",background:"#F3F4F6",borderRadius:10,padding:3,gap:2}}>
          {["\u{1F4CA} Todas","\u2705 Reales"].map(function(l,i){var a=mode===i;return <button key={i} onClick={function(){setMode(i);}} style={{background:a?(i===0?C.accent:C.green):"transparent",color:a?"#fff":C.muted,border:"none",borderRadius:8,padding:"7px 14px",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:font}}>{l}</button>;})}
        </div>
        <div style={{display:"flex",gap:2,background:"#F3F4F6",borderRadius:10,padding:3}}>
          {[{id:"overview",l:"Resumen"},{id:"engagement",l:"Engagement"},{id:"templates",l:"Templates"},{id:"benchmarks",l:"Benchmarks"},{id:"lookup",l:"Buscar"}].map(function(t){
            return <button key={t.id} onClick={function(){setTab(t.id);}} style={{background:tab===t.id?"#374151":"transparent",color:tab===t.id?"#fff":C.muted,border:"none",borderRadius:8,padding:"7px 14px",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:font}}>{t.l}</button>;
          })}
        </div>
      </div>
    </div>

    {rawRows && <div style={{background:C.card,borderBottom:"1px solid "+C.border,padding:"10px 28px",display:"flex",alignItems:"center",gap:14,flexWrap:"wrap"}}>
      <span style={{fontSize:13,color:C.muted,fontWeight:700}}>Filtrar por fecha:</span>
      <div style={{display:"flex",alignItems:"center",gap:6}}>
        <span style={{fontSize:12,color:C.muted}}>De</span>
        <input type="date" value={dateFrom} onChange={onDateFromChange} style={{padding:"5px 10px",border:"1px solid "+C.border,borderRadius:8,fontSize:13,fontFamily:mono,color:C.text,background:"#F9FAFB",outline:"none"}}/>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:6}}>
        <span style={{fontSize:12,color:C.muted}}>Hasta</span>
        <input type="date" value={dateTo} onChange={onDateToChange} style={{padding:"5px 10px",border:"1px solid "+C.border,borderRadius:8,fontSize:13,fontFamily:mono,color:C.text,background:"#F9FAFB",outline:"none"}}/>
      </div>
      {(dateFrom||dateTo) && <button onClick={clearDateFilter} style={{background:"#FEF2F2",color:C.red,border:"1px solid #FECACA",borderRadius:8,padding:"5px 12px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:font}}>Limpiar</button>}
      {(dateFrom||dateTo) && <span style={{fontSize:12,color:C.accent,fontWeight:700,background:C.lBlue,padding:"4px 10px",borderRadius:6}}>{tc} leads en per\u00EDodo</span>}
    </div>}

    <div style={{padding:"24px 28px",maxWidth:1300,margin:"0 auto"}}>
      {mode===1 && <div style={{background:C.lGreen,border:"1px solid "+C.green+"25",borderRadius:12,padding:"12px 18px",marginBottom:20,display:"flex",gap:12,alignItems:"center"}}><span style={{fontSize:24}}>{"\u2705"}</span><div><strong style={{color:C.green}}>Filtro activo:</strong> <span style={{color:C.sub}}>{headerInfo.autoReplyCount} auto-replies excluidos. <strong>{headerInfo.realesCount} leads</strong> reales.</span></div></div>}

      {comparing&&compareData && (function(){var cImp=imports.find(function(i){return i.id===compareImportId;});var sImp=imports.find(function(i){return i.id===selectedImportId;});return <div style={{background:C.lPurple,border:"1px solid "+C.purple+"25",borderRadius:12,padding:"12px 18px",marginBottom:20,display:"flex",gap:12,alignItems:"center"}}><span style={{fontSize:24}}>{"\u{1F504}"}</span><div><strong style={{color:C.purple}}>Comparando:</strong> <span style={{color:C.sub}}><strong>{sImp?sImp.label||sImp.filename:"actual"}</strong> vs <strong>{cImp?cImp.label||cImp.filename:"anterior"}</strong></span></div></div>;})()}

      {tab==="overview" && (function(){var cd=comparing&&compareData?compareData.D[mk]:null; return (<>
        <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:12,marginBottom:22}}>
          {[{l:"Contactados",v:String(tc),s:lpd+"/d\u00EDa",cv:cd?String(cd.resp!==undefined?compareData.totalContactados:""):null},{l:"Respuesta",v:d.rate,s:d.resp+" leads",b:45,ck:2,cv:cd?cd.rate:null},{l:"Instagram",v:d.igLinkR,s:d.igLink+" leads con link",ig2:d.igAt,cv:cd?cd.igLinkR:null},{l:"Config. Plataf.",v:d.tR,s:d.tool+" leads",cv:cd?cd.tR:null},{l:"Oferta Reuni\u00F3n",v:d.mR,s:d.mc+" leads",ck:1,cv:cd?cd.mR:null}].map(function(k,i){
            var diff=k.b?(parseFloat(k.v)-k.b).toFixed(1):null;
            return (<Cd key={i} onClick={k.ck===1?function(){setShowM(true);}:k.ck===2?function(){setShowA(true);}:undefined} style={k.ck===1?{cursor:"pointer",border:"2px solid "+C.pink+"44"}:k.ck===2?{cursor:"pointer",border:"2px solid "+C.purple+"44"}:{}}>
              <div style={{fontSize:13,color:C.muted,fontWeight:600}}>{k.l}</div>
              <div style={{fontSize:32,fontWeight:800,fontFamily:mono,marginTop:6,lineHeight:1}}>{k.v}<Delta current={k.v} previous={k.cv}/></div>
              <div style={{fontSize:13,color:C.muted,marginTop:4}}>{k.s}</div>
              {diff && <div style={{marginTop:6,fontSize:12,fontWeight:700,color:diff>0?C.green:C.red}}>{diff>0?"\u25B2":"\u25BC"} {Math.abs(diff)}pp vs WA Warm</div>}
              {k.cv && <div style={{marginTop:4,fontSize:11,color:C.purple,fontWeight:600}}>Anterior: {k.cv}</div>}
              {k.ig2!==undefined && <div style={{marginTop:6,fontSize:12,color:C.orange,fontWeight:600,borderTop:"1px solid "+C.border,paddingTop:6}}>{"Solo @: "+k.ig2+" leads"}</div>}
              {k.ck===1 && <div style={{fontSize:11,color:C.pink,fontWeight:700,marginTop:6}}>{"\u{1F4C5} Ver contactos y conversaciones \u2192"}</div>}
              {k.ck===2 && <div style={{fontSize:11,color:C.purple,fontWeight:700,marginTop:6}}>{"\u{1F4AC} Ver todas las conversaciones \u2192"}</div>}
            </Cd>);
          })}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:22}}>
          <Cd><Sec>Embudo de Conversi\u00F3n</Sec>
            {funnel.map(function(f,i){var w=Math.max((f.v/tc)*100,4);var prev=i>0?((f.v/funnel[i-1].v)*100).toFixed(0):null;
              return (<div key={i} style={{marginBottom:10}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}><span style={{fontSize:14,color:C.sub,fontWeight:500}}>{f.n}</span><div><span style={{fontSize:17,fontWeight:800,fontFamily:mono}}>{f.v}</span><span style={{fontSize:13,color:C.muted,marginLeft:6}}>{(f.v/tc*100).toFixed(1)}%</span>{prev && <span style={{fontSize:12,color:C.red,marginLeft:6}}>({prev}%{"\u2193"})</span>}</div></div><div style={{height:22,background:"#F3F4F6",borderRadius:6,overflow:"hidden"}}><div style={{height:"100%",width:w+"%",background:f.c,borderRadius:6,opacity:0.8}}/></div></div>);})}
          </Cd>
          <Cd><Sec>Yago vs Mercado</Sec>
            {chBench.map(function(b,i){return (<div key={i} style={{marginBottom:9}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}><span style={{fontSize:14,color:b.y?C.text:C.muted,fontWeight:b.y?700:400}}>{b.ch}</span><span style={{fontSize:15,fontWeight:800,color:b.y?C.accent:C.muted,fontFamily:mono}}>{b.r}%</span></div><div style={{height:8,background:"#F3F4F6",borderRadius:4}}><div style={{height:"100%",width:(b.r/45)*100+"%",background:b.y?C.accent:C.muted,borderRadius:4,opacity:b.y?0.8:0.3}}/></div></div>);})}
          </Cd>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
          <Cd><Sec>{"\u{1F1EA}\u{1F1F8} vs \u{1F1E7}\u{1F1F7}"}</Sec><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}><div style={{background:C.lBlue,borderRadius:12,padding:16,textAlign:"center"}}><div style={{fontSize:12,color:C.accent,fontWeight:700}}>{"\u{1F1EA}\u{1F1F8} ESPA\u00D1OL"}</div><div style={{fontSize:34,fontWeight:900,color:C.accent,fontFamily:mono}}>{headerInfo.esRate}%</div><div style={{fontSize:13,color:C.muted}}>{headerInfo.esResp} de {headerInfo.esTotal}</div></div><div style={{background:C.lGreen,borderRadius:12,padding:16,textAlign:"center"}}><div style={{fontSize:12,color:C.green,fontWeight:700}}>{"\u{1F1E7}\u{1F1F7} PORTUGU\u00C9S"}</div><div style={{fontSize:34,fontWeight:900,color:C.green,fontFamily:mono}}>{headerInfo.ptRate}%</div><div style={{fontSize:13,color:C.muted}}>{headerInfo.ptResp} de {headerInfo.ptTotal}</div></div></div></Cd>
          <Cd><Sec>Leads por D\u00EDa</Sec><ResponsiveContainer width="100%" height={160}><AreaChart data={daily} margin={{left:-15,right:5,top:5,bottom:0}}><defs><linearGradient id="ag" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.accent} stopOpacity={0.2}/><stop offset="100%" stopColor={C.accent} stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" stroke={C.border}/><XAxis dataKey="d" tick={{fontSize:12,fill:C.muted}}/><YAxis tick={{fontSize:12,fill:C.muted}}/><Tooltip contentStyle={{background:C.card,border:"1px solid "+C.border,borderRadius:8,fontSize:13}}/><Area type="monotone" dataKey="l" stroke={C.accent} fill="url(#ag)" strokeWidth={2}/></AreaChart></ResponsiveContainer></Cd>
        </div>
      </>);})()}

      {tab==="engagement" && (function(){
        var totalResp=headerInfo.realesCount+headerInfo.autoReplyCount;
        var autoP=totalResp>0?((headerInfo.autoReplyCount/totalResp)*100).toFixed(1):"0";
        var realP=totalResp>0?((headerInfo.realesCount/totalResp)*100).toFixed(1):"0";
        var engIcons={alto:"\u{1F525}",medio:"\u{1F44D}",bajo:"\u{1F610}",minimo:"\u{1F4A4}"};
        var engLabels={alto:"Alto",medio:"Medio",bajo:"Bajo",minimo:"M\u00EDnimo"};
        var peakH=0;var peakV=0;for(var hi=0;hi<d.hours.length;hi++){if(d.hours[hi]>peakV){peakV=d.hours[hi];peakH=hi;}}
        var topicColors=["#3B82F6","#8B5CF6","#06B6D4","#F59E0B","#10B981","#EF4444"];
        return (<>
        {/* Hero KPIs */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:22}}>
          {[
            {l:"Total Respuestas",v:totalResp,ic:"\u{1F4AC}",c:C.purple,sub:dataD.all.rate+" tasa"},
            {l:"Tasa de Respuesta",v:d.rate,ic:"\u{1F4CA}",c:C.accent,sub:d.resp+" leads respondieron"},
            {l:mode===1?"Auto-replies excl.":"Auto-replies",v:headerInfo.autoReplyCount,ic:"\u{1F916}",c:mode===1?C.green:C.red,sub:mode===1?"Excluidos del an\u00E1lisis":autoP+"% del total"},
            {l:"Leads Reales",v:headerInfo.realesCount,ic:"\u2705",c:C.green,sub:realP+"% son humanos reales"}
          ].map(function(k,i){return (
            <Cd key={i} style={{position:"relative",overflow:"hidden"}}>
              <div style={{position:"absolute",top:-8,right:-8,fontSize:48,opacity:0.06}}>{k.ic}</div>
              <div style={{fontSize:12,color:C.muted,fontWeight:700,textTransform:"uppercase",letterSpacing:1}}>{k.l}</div>
              <div style={{fontSize:34,fontWeight:900,fontFamily:mono,color:k.c,marginTop:8,lineHeight:1}}>{k.v}</div>
              <div style={{fontSize:13,color:C.muted,marginTop:6}}>{k.sub}</div>
            </Cd>
          );})
          }
        </div>

        {/* Engagement Distribution */}
        <Cd style={{marginBottom:22}}>
          <Sec>{"Distribuci\u00F3n de Engagement ("+d.resp+" leads)"}</Sec>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:16,marginBottom:18}}>
            {[
              {k:"alto",n:"Alto",c:C.green,bg:"#ECFDF5"},
              {k:"medio",n:"Medio",c:C.accent,bg:"#EFF6FF"},
              {k:"bajo",n:"Bajo",c:C.yellow,bg:"#FFFBEB"},
              {k:"minimo",n:"M\u00EDnimo",c:C.red,bg:"#FEF2F2"}
            ].map(function(e,i){var eng=d.eng[e.k];return (
              <div key={i} style={{background:e.bg,borderRadius:12,padding:"16px 14px",textAlign:"center",border:"1px solid "+e.c+"20"}}>
                <div style={{fontSize:28,marginBottom:4}}>{engIcons[e.k]}</div>
                <div style={{fontSize:13,fontWeight:700,color:e.c}}>{e.n}</div>
                <div style={{fontSize:32,fontWeight:900,fontFamily:mono,color:e.c,margin:"6px 0"}}>{eng.v}</div>
                <div style={{fontSize:14,fontWeight:700,color:e.c}}>{eng.p}</div>
              </div>
            );})
            }
          </div>
          <div style={{display:"flex",gap:0,height:14,borderRadius:7,overflow:"hidden",background:"#F3F4F6"}}>
            {[
              {k:"alto",c:C.green},{k:"medio",c:C.accent},{k:"bajo",c:C.yellow},{k:"minimo",c:C.red}
            ].map(function(e,i){var w=parseFloat(d.eng[e.k].p)||0;return w>0?<div key={i} style={{width:w+"%",background:e.c,height:"100%",transition:"width 0.3s"}} title={engLabels[e.k]+": "+w+"%"}/>:null;})
            }
          </div>
        </Cd>

        {/* Topics as card grid */}
        <Cd style={{marginBottom:22}}>
          <Sec>{"Temas Abordados ("+d.resp+" leads)"}</Sec>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12}}>
            {d.topics.map(function(tp,i){
              var bC=topicColors[i%topicColors.length];
              return (
                <div key={i} style={{background:bC+"08",borderRadius:12,padding:"16px 14px",border:"1px solid "+bC+"18"}}>
                  <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                    <span style={{fontSize:28}}>{tp.e}</span>
                    <div>
                      <div style={{fontSize:15,fontWeight:800,color:C.text}}>{tp.t}</div>
                      <div style={{fontSize:13,color:C.muted}}>{tp.n} leads</div>
                    </div>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:10}}>
                    <div style={{flex:1,height:8,background:"#F3F4F6",borderRadius:4,overflow:"hidden"}}>
                      <div style={{height:"100%",width:tp.p+"%",background:bC,borderRadius:4,opacity:0.8}}/>
                    </div>
                    <span style={{fontSize:15,fontWeight:800,fontFamily:mono,color:bC,minWidth:48,textAlign:"right"}}>{tp.p}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </Cd>

        {/* Hour chart with peak indicator */}
        <Cd>
          <Sec>Horario de Respuestas</Sec>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={d.hours.map(function(v,i){return{h:String(i).padStart(2,"0")+"h",v:v};})} margin={{left:-10,right:5}}>
              <defs>
                <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={C.accent} stopOpacity={0.9}/>
                  <stop offset="100%" stopColor={C.accent} stopOpacity={0.5}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border}/>
              <XAxis dataKey="h" tick={{fontSize:11,fill:C.muted}}/>
              <YAxis tick={{fontSize:11,fill:C.muted}}/>
              <Tooltip contentStyle={{background:C.card,border:"1px solid "+C.border,borderRadius:8,fontSize:13}} formatter={function(v){return[v,"Respuestas"];}}/>
              <Bar dataKey="v" radius={[4,4,0,0]} barSize={22}>
                {d.hours.map(function(v,i){return <Cell key={i} fill={i===peakH?"#1D4ED8":v>=10?"url(#barGrad)":v>=5?C.accent+"77":C.accent+"33"}/>;})
                }
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,marginTop:12,padding:"8px 16px",background:C.lBlue,borderRadius:8}}>
            <span style={{fontSize:18}}>{"\u{1F551}"}</span>
            <span style={{fontSize:14,color:C.accent,fontWeight:700}}>Horario pico: {String(peakH).padStart(2,"0")}:00h</span>
            <span style={{fontSize:13,color:C.muted}}>({peakV} respuestas)</span>
          </div>
        </Cd>
      </>);
      })()}

      {tab==="templates" && (<>
        {d.tplByStep ? (function(){
          var stepKeys=Object.keys(d.tplByStep).sort(function(a,b){return parseInt(a)-parseInt(b);});
          return (<>
            <Cd style={{marginBottom:18}}><Sec>Cadencia</Sec>
              <div style={{display:"flex",alignItems:"center",gap:0}}>{stepKeys.map(function(sk,i){var sg=d.tplByStep[sk];var items=[];if(i>0)items.push(<div key={"sep"+i} style={{width:36,height:2,background:C.border,flexShrink:0}}/>);items.push(<div key={sk} style={{flex:1,background:sg.color+"08",border:"1px solid "+sg.color+"22",borderRadius:12,padding:"12px 8px",textAlign:"center"}}><div style={{fontSize:11,color:C.muted}}>{sg.day}</div><div style={{fontSize:17,fontWeight:800,color:sg.color,marginTop:4}}>{sg.label}</div><div style={{fontSize:12,color:C.muted}}>{sg.totalSent} enviados {"\u00B7"} {sg.templates.length} variante{sg.templates.length!==1?"s":""}</div></div>);return items;}).flat()}</div>
            </Cd>
            <Sec>Performance por Step</Sec>
            {stepKeys.map(function(sk){var sg=d.tplByStep[sk];var rn=parseFloat(sg.totalRate);var sc=rn>=20?C.green:rn>=12?C.yellow:C.red;
              return (<div key={sk} style={{marginBottom:22}}>
                <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:12,padding:"10px 16px",background:sg.color+"08",borderRadius:10,border:"1px solid "+sg.color+"22"}}>
                  <div style={{flex:1}}>
                    <div style={{fontSize:11,color:C.muted,fontWeight:600}}>{sg.day}</div>
                    <div style={{fontSize:18,fontWeight:800,color:sg.color}}>{sg.label}</div>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontSize:28,fontWeight:800,color:sc,fontFamily:mono}}>{sg.totalRate}</div>
                    <div style={{fontSize:13,color:C.muted}}>{sg.totalResp} de {sg.totalSent}</div>
                  </div>
                </div>
                <div style={{display:"grid",gridTemplateColumns:sg.templates.length===1?"1fr":"1fr 1fr",gap:12}}>
                  {sg.templates.map(function(t,i){var trn=parseFloat(t.rate);var tsc=trn>=20?C.green:trn>=12?C.yellow:C.red;
                    var tplItem=d.tpl.find(function(x){return x.key===t.name;});
                    return (<Cd key={i} onClick={tplItem?function(){setSelTpl(tplItem);}:undefined} style={tplItem?{cursor:"pointer"}:{}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}><div><div style={{fontWeight:800,fontSize:15}}>{t.displayName}</div><div style={{display:"flex",gap:6,marginTop:4}}><span style={{fontSize:11,color:C.muted,background:"#F3F4F6",padding:"2px 8px",borderRadius:4}}>{sg.day}</span><span style={{fontSize:11,fontWeight:700,padding:"2px 8px",borderRadius:4,background:t.lang==="pt"?C.green+"15":C.accent+"15",color:t.lang==="pt"?C.green:C.accent}}>{t.lang==="pt"?"PT":"ES"}</span></div></div><div style={{textAlign:"right"}}><div style={{fontSize:24,fontWeight:800,color:tsc,fontFamily:mono}}>{t.rate}</div><div style={{fontSize:12,color:C.muted}}>{t.resp} de {t.sent}</div></div></div>{tplItem && <div style={{fontSize:11,color:C.accent,fontWeight:600,marginTop:8}}>Click para ver detalles {"\u2192"}</div>}</Cd>);
                  })}
                </div>
              </div>);
            })}
          </>);
        })() : (<>
          <Cd style={{marginBottom:18}}><Sec>Cadencia</Sec>
            <div style={{display:"flex",alignItems:"center",gap:0}}>{[{l:"MSG 1",s:"Yago SDR",d:"D+0",c:C.accent},0,{l:"MSG 2",s:"Sin WA / Caso \u00C9xito",d:"D+1",c:C.purple},0,{l:"MSG 3",s:"Value Nudge",d:"D+3",c:C.cyan},0,{l:"MSG 4",s:"Quick Audit",d:"D+5",c:C.orange}].map(function(s,i){if(!s)return <div key={i} style={{width:36,height:2,background:C.border,flexShrink:0}}/>;return(<div key={i} style={{flex:1,background:s.c+"08",border:"1px solid "+s.c+"22",borderRadius:12,padding:"12px 8px",textAlign:"center"}}><div style={{fontSize:11,color:C.muted}}>{s.d}</div><div style={{fontSize:17,fontWeight:800,color:s.c,marginTop:4}}>{s.l}</div><div style={{fontSize:12,color:C.muted}}>{s.s}</div></div>);})}</div>
          </Cd>
          <Sec>Performance por Template</Sec>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:22}}>
            {d.tpl.map(function(t,i){var rn=parseFloat(t.rate);var sc=rn>=20?C.green:rn>=12?C.yellow:C.red;
              return (<Cd key={i} onClick={function(){setSelTpl(t);}} style={{cursor:"pointer"}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}><div><div style={{fontWeight:800,fontSize:16}}>{t.name}</div><span style={{fontSize:12,color:C.muted,background:"#F3F4F6",padding:"2px 8px",borderRadius:4}}>{t.day}</span></div><div style={{textAlign:"right"}}><div style={{fontSize:28,fontWeight:800,color:sc,fontFamily:mono}}>{t.rate}</div><div style={{fontSize:13,color:C.muted}}>{t.resp} de {t.sent}</div></div></div><div style={{fontSize:11,color:C.accent,fontWeight:600,marginTop:8}}>Click para ver detalles {"\u2192"}</div></Cd>);
            })}
          </div>
        </>)}
        {d.bcast&&d.bcast.length>0&&(<div style={{marginTop:10,marginBottom:22}}><div style={{fontSize:12,fontWeight:700,color:C.muted,textTransform:"uppercase",marginBottom:8,letterSpacing:1}}>Disparos Puntuais (fora do lifecycle)</div><div style={{display:"grid",gridTemplateColumns:"1fr",gap:10}}>{d.bcast.map(function(t,i){var rn=parseFloat(t.rate);var sc=rn>=20?C.green:rn>=12?C.yellow:C.red;return(<Cd key={i} onClick={function(){setSelTpl(t);}} style={{background:"#FEFCE8",border:"1px dashed "+C.yellow+"55",cursor:"pointer"}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><div><div style={{fontWeight:800,fontSize:16}}>{t.name}</div><span style={{fontSize:12,color:C.muted,background:"#FEF9C3",padding:"2px 8px",borderRadius:4}}>Broadcast</span></div><div style={{textAlign:"right"}}><div style={{fontSize:28,fontWeight:800,color:sc,fontFamily:mono}}>{t.rate}</div><div style={{fontSize:13,color:C.muted}}>{t.resp+" de "+t.sent}</div></div></div><div style={{fontSize:11,color:C.yellow,fontWeight:600,marginTop:8}}>Click para ver detalles {"\u2192"}</div></Cd>);})}</div></div>)}
        <Cd style={{marginBottom:18,background:C.lPurple,border:"1px solid "+C.purple+"20"}}>
          <Sec>{"\u{1F4C5} \u00BFEn qu\u00E9 template respondieron los que llegaron a reuni\u00F3n?"}</Sec>
          <div style={{fontSize:14,color:C.sub,marginBottom:14}}>De {d.mc} leads, este fue el <strong>template donde respondieron por primera vez</strong>:</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat("+Math.min(mbt.length,6)+",1fr)",gap:10}}>
            {mbt.map(function(m,i){return (<div key={i} style={{textAlign:"center",padding:"12px 8px",background:C.card,borderRadius:10,border:m.v?"2px solid "+m.c+"33":"1px solid "+C.border}}><div style={{fontSize:13,fontWeight:700,color:m.v?m.c:C.muted}}>{m.l}</div><div style={{fontSize:30,fontWeight:900,fontFamily:mono,color:m.v?m.c:C.muted,marginTop:4}}>{m.v}</div></div>);})}
          </div>
        </Cd>
        <div onClick={function(){setShowM(true);}} style={{background:C.card,border:"2px solid "+C.pink+"44",borderRadius:14,padding:"16px 20px",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"space-between"}} onMouseEnter={function(e){e.currentTarget.style.borderColor=C.pink;}} onMouseLeave={function(e){e.currentTarget.style.borderColor=C.pink+"44";}}>
          <div style={{display:"flex",alignItems:"center",gap:12}}><span style={{fontSize:28}}>{"\u{1F4C5}"}</span><div><div style={{fontSize:16,fontWeight:800,color:C.pink}}>{"Ver los "+d.mc+" leads con oferta de reuni\u00F3n"}</div><div style={{fontSize:13,color:C.muted}}>Click para ver contactos y conversaciones completas</div></div></div>
          <div style={{fontSize:22,color:C.pink}}>{"\u2192"}</div>
        </div>
      </>)}

      {tab==="benchmarks" && (<>
        <Cd style={{marginBottom:22,overflowX:"auto"}}><Sec>{"Comparaci\u00F3n vs Benchmarks (Warm Leads)"}</Sec>
          <div style={{fontSize:13,color:C.muted,marginBottom:14}}>{"Leads que se registraron en la plataforma = warm/opt-in. Benchmarks: Twilio, Meta, Respond.io, ChatArchitect (2024-2025)."}</div>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:14}}><thead><tr style={{borderBottom:"2px solid "+C.border}}>{["M\u00E9trica","Yago","Benchmark","\u0394",""].map(function(h,i){return <th key={i} style={{padding:"10px 14px",textAlign:"left",color:C.muted,fontWeight:700,fontSize:12,textTransform:"uppercase"}}>{h}</th>;})}</tr></thead>
          <tbody>{bTable.map(function(r,i){return(<tr key={i} style={{borderBottom:"1px solid "+C.border+"44"}}><td style={{padding:"12px 14px",fontWeight:600}}>{r.m}</td><td style={{padding:"12px 14px",fontWeight:800,fontFamily:mono,fontSize:15}}>{r.y}</td><td style={{padding:"12px 14px",color:C.muted}}>{r.b}</td><td style={{padding:"12px 14px",fontWeight:700,fontFamily:mono,color:r.s?C.green:C.red}}>{r.d}</td><td style={{padding:"12px 14px"}}><Bd color={r.s?C.green:C.red}>{r.s?"\u2713 ARRIBA":"\u2717 ABAJO"}</Bd></td></tr>);})}</tbody></table>
        </Cd>
        <Cd><div style={{fontSize:18,fontWeight:900,marginBottom:18}}>{"\u{1F4CB} Veredicto"}</div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:20}}>
          {[{t:"\u2713 FORTALEZAS",c:C.green,i:["Resp. <6 min \u2014 2.5x mejor que benchmark","75% engagement medio o alto","28 msgs/conv \u2014 conversaciones profundas","Cada template captura leads nuevos"]},{t:"\u2717 GAPS",c:C.red,i:["23.6% real vs 40-60% warm benchmark","24.6% auto-replies inflando m\u00E9tricas","Caso \u00C9xito solo 4% de la base","Solo 3% llega a reuni\u00F3n (bench: 20-30%)"]},{t:"\u2192 ACCIONES",c:C.yellow,i:["Filtrar auto-replies","Escalar Caso de \u00C9xito","Mover CTA reuni\u00F3n a MSG 3","Enviar 14-18h"]}].map(function(col,i){return(<div key={i}><div style={{fontSize:14,color:col.c,fontWeight:800,marginBottom:10}}>{col.t}</div>{col.i.map(function(item,j){return <div key={j} style={{fontSize:14,color:C.sub,lineHeight:2,paddingLeft:12,borderLeft:"3px solid "+col.c+"33"}}>{item}</div>;})}</div>);})}
        </div></Cd>
      </>)}

      {tab==="lookup" && (<>
        <Cd style={{marginBottom:22}}>
          <Sec>Buscar Conversaci&oacute;n</Sec>
          <form onSubmit={function(e){e.preventDefault();handleSearch(searchQuery);}} style={{display:"flex",gap:10}}>
            <input value={searchQuery} onChange={function(e){setSearchQuery(e.target.value);}} placeholder="Tel\u00E9fono o Thread ID..." style={{flex:1,padding:"12px 16px",border:"1px solid "+C.border,borderRadius:10,fontSize:15,fontFamily:mono,outline:"none",background:"#F9FAFB"}}/>
            <button type="submit" disabled={searchLoading} style={{background:C.accent,color:"#fff",border:"none",borderRadius:10,padding:"12px 24px",fontSize:14,fontWeight:700,cursor:searchLoading?"wait":"pointer",fontFamily:font,opacity:searchLoading?0.6:1}}>{searchLoading?"Buscando...":"Buscar"}</button>
          </form>
          <div style={{fontSize:12,color:C.muted,marginTop:8}}>Busca por n&uacute;mero de tel&eacute;fono (parcial) o thread_id exacto. Busca en memoria y en la base de datos.</div>
        </Cd>

        {searchLoading && <div style={{textAlign:"center",padding:40,color:C.muted,fontSize:15}}>Buscando...</div>}

        {searchResults!==null&&!searchLoading&&searchResults.length===0 && (
          <Cd style={{textAlign:"center",padding:40}}>
            <div style={{fontSize:36,marginBottom:8}}>{"?"}</div>
            <div style={{fontSize:16,fontWeight:700,color:C.muted}}>No se encontraron resultados</div>
            <div style={{fontSize:13,color:C.muted,marginTop:4}}>Intenta con otro n&uacute;mero o thread ID</div>
          </Cd>
        )}

        {searchResults!==null&&searchResults.length>0&&searchSel===null && (
          <Cd>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
              <div style={{fontSize:16,fontWeight:800}}>{searchResults.length} resultado{searchResults.length!==1?"s":""}</div>
              <div style={{fontSize:12,color:C.muted}}>Click en un resultado para ver detalles</div>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {searchResults.map(function(r,i){
                var l=r.lead;var eC={alto:C.green,medio:C.accent,bajo:C.yellow,minimo:C.red};var ql=qualLabel(l.q);
                return (<div key={i} onClick={function(){selectSearchResult(i);}} style={{display:"flex",alignItems:"center",gap:14,padding:"14px 16px",background:"#F9FAFB",borderRadius:12,cursor:"pointer",border:"2px solid transparent"}}>
                  <span style={{fontSize:20}}>{l.co}</span>
                  <div style={{flex:1}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                      <span style={{fontFamily:mono,fontWeight:700,fontSize:16}}>{l.p}</span>
                      <Bd color={eC[l.e]||C.muted}>{l.e}</Bd>
                      <Bd color={ql.c}>{ql.t}</Bd>
                      {l.au && <Bd color={C.red}>AUTO</Bd>}
                      <Bd color={r.source==="memory"?C.green:C.cyan}>{r.source==="memory"?"memoria":"BD"}</Bd>
                    </div>
                    <div style={{fontSize:12,color:C.muted,marginTop:3}}>
                      {l.ms} msgs {"\u00B7"} {l.w.toLocaleString()} pal. {"\u00B7"} Tpls: <strong>{l.tr.join(", ")||"N/A"}</strong>
                      {r.threadId && <span> {"\u00B7"} <span style={{fontFamily:mono,fontSize:11}}>{r.threadId}</span></span>}
                    </div>
                  </div>
                  <div style={{color:C.accent,fontSize:18,fontWeight:700}}>{"\u2192"}</div>
                </div>);
              })}
            </div>
          </Cd>
        )}

        {searchSel!==null&&searchResults&&searchResults[searchSel] && (function(){
          var item=searchResults[searchSel];var lead=item.lead;var td=searchThreadData;
          return (<>
            {td && <Cd style={{marginBottom:16}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                <Sec style={{marginBottom:0}}>Analytics del Thread</Sec>
                {td.thread_id && <span style={{fontFamily:mono,fontSize:11,color:C.muted,background:"#F3F4F6",padding:"3px 8px",borderRadius:5}}>{td.thread_id}</span>}
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:14}}>
                {[
                  {l:"Total Msgs",v:td.total_messages||0,c:C.accent},
                  {l:"Msgs Humanas",v:td.total_human_messages||0,c:C.purple},
                  {l:"Msgs IA",v:td.total_ai_messages||0,c:C.cyan},
                  {l:"Tool Calls",v:td.total_tool_calls||0,c:C.orange}
                ].map(function(s,i){return (<div key={i} style={{background:s.c+"08",borderRadius:10,padding:"10px 12px",textAlign:"center",border:"1px solid "+s.c+"18"}}>
                  <div style={{fontSize:11,color:C.muted,fontWeight:600}}>{s.l}</div>
                  <div style={{fontSize:24,fontWeight:800,fontFamily:mono,color:s.c}}>{s.v}</div>
                </div>);})}
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}}>
                {[
                  {l:"Idioma",v:(td.detected_language||"?").toUpperCase()},
                  {l:"Stage",v:td.auto_stage||"?"},
                  {l:"Templates",v:td.templates_received||0}
                ].map(function(s,i){return (<div key={i} style={{background:"#F9FAFB",borderRadius:8,padding:"8px 12px"}}>
                  <div style={{fontSize:11,color:C.muted,fontWeight:600}}>{s.l}</div>
                  <div style={{fontSize:15,fontWeight:700,color:C.text}}>{s.v}</div>
                </div>);})}
                {td.sent_instagram && <div style={{background:C.lPurple,borderRadius:8,padding:"8px 12px"}}>
                  <div style={{fontSize:11,color:C.purple,fontWeight:600}}>Instagram</div>
                  <div style={{fontSize:13,fontWeight:700,color:C.purple}}>{td.instagram_url||"Enviado"}</div>
                </div>}
                {td.received_meeting_offer && <div style={{background:C.lGreen,borderRadius:8,padding:"8px 12px"}}>
                  <div style={{fontSize:11,color:C.green,fontWeight:600}}>Reuni&oacute;n</div>
                  <div style={{fontSize:13,fontWeight:700,color:C.green}}>Oferta enviada ({td.meeting_offer_count||1}x)</div>
                </div>}
                {td.detected_rejection && <div style={{background:C.lRed,borderRadius:8,padding:"8px 12px"}}>
                  <div style={{fontSize:11,color:C.red,fontWeight:600}}>Rechazo</div>
                  <div style={{fontSize:13,fontWeight:700,color:C.red}}>Detectado</div>
                </div>}
              </div>
            </Cd>}
            <Cd>
              <ConvView lead={lead} onBack={function(){setSearchSel(null);setSearchThreadData(null);}}/>
            </Cd>
          </>);
        })()}
      </>)}
    </div>
  </div>);
}
