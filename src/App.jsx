import { useState, useEffect, useRef } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, AreaChart, Area } from "recharts";
import { processCSVRows, processInboundRows, parseDatetime, TOPIC_KEYWORDS } from "./csvParser";
import { fetchThreadsFromPostHog, expandThreadMessages, fetchInboundThreadsFromPostHog, expandInboundThreadMessages, fetchLifecyclePhones } from "./posthogApi";
import { DEFAULT_MEETINGS as _RAW_MEETINGS } from "./defaultData";
import { supabase } from "./supabase";

var font="'Source Sans 3', sans-serif";
var mono="'JetBrains Mono', monospace";
var C={bg:"#FAFBFC",card:"#FFF",border:"#E5E7EB",text:"#111827",sub:"#374151",muted:"#6B7280",accent:"#2563EB",green:"#059669",red:"#DC2626",yellow:"#D97706",purple:"#7C3AED",cyan:"#0891B2",orange:"#EA580C",pink:"#EC4899",lBlue:"#EFF6FF",lGreen:"#ECFDF5",lRed:"#FEF2F2",lPurple:"#F5F3FF"};

// Filter default meetings to only those that received MSG1, and compute ml/igL/igA flags
var DEFAULT_MEETINGS=_RAW_MEETINGS.filter(function(m){return m.tr.indexOf("MSG1")>=0;}).map(function(m){var hasMl=false,hasIgL=false,hasIgA=false;for(var i=0;i<m.c.length;i++){if(m.c[i][0]===2&&m.c[i][1]&&m.c[i][1].indexOf("meetings.hubspot.com/")>=0)hasMl=true;if(m.c[i][0]===1&&m.c[i][1]){if(/instagram\.com/i.test(m.c[i][1]))hasIgL=true;if(/@\w+|ig\s*:/i.test(m.c[i][1]))hasIgA=true;}}return Object.assign({},m,{ml:hasMl,igL:hasIgL,igA:hasIgA});});
var _dIgL=DEFAULT_MEETINGS.filter(function(m){return m.igL;}).length;
var _dIgA=DEFAULT_MEETINGS.filter(function(m){return m.igA&&!m.igL;}).length;

var DEFAULT_TOPICS=[{"t":"Automatizaci\u00f3n","e":"\u{1F916}","n":192,"p":71.1},{"t":"Whatsapp","e":"\u{1F4AC}","n":116,"p":43},{"t":"Soporte","e":"\u{1F527}","n":106,"p":39.3},{"t":"Configuraci\u00f3n","e":"\u2699\uFE0F","n":88,"p":32.6},{"t":"Precios","e":"\u{1F4B0}","n":87,"p":32.2},{"t":"Ventas","e":"\u{1F4CA}","n":77,"p":28.5}];

var DEFAULT_D={
  all:{resp:270,rate:"24.2%",topics:DEFAULT_TOPICS,ig:73,igR:"27.0%",igLink:_dIgL,igLinkR:(_dIgL/270*100).toFixed(1)+"%",igAt:_dIgA,igAtR:(_dIgA/270*100).toFixed(1)+"%",mc:33,mR:"12.2%",tool:170,tR:"63.0%",eng:{alto:{v:7,p:"2.6%"},medio:{v:43,p:"15.9%"},bajo:{v:123,p:"45.6%"},minimo:{v:97,p:"35.9%"}},hours:[154,90,52,36,149,49,34,13,22,25,27,45,158,138,66,138,191,157,184,93,109,113,163,94],
    tpl:[
      {name:"msg_1_yago_sdr_1",day:"D+0",sent:562,resp:161,rate:"28.6%"},
      {name:"msg_1_yago_sdr",day:"D+0",sent:225,resp:37,rate:"16.4%"},
      {name:"msg_1_yago_sdr_br_1",day:"D+0",sent:153,resp:28,rate:"18.3%"},
      {name:"leads_baja_d0_v1",day:"D+0",sent:74,resp:15,rate:"20.3%"},
      {name:"calificados_d0__v3",day:"D+0",sent:36,resp:14,rate:"38.9%"},
      {name:"es_caso_de_xito",day:"D+1",sent:5,resp:3,rate:"60.0%"},
    ],
    bcast:[]},
  real:{resp:241,rate:"21.6%",topics:DEFAULT_TOPICS,ig:71,igR:"29.5%",igLink:_dIgL,igLinkR:(_dIgL/241*100).toFixed(1)+"%",igAt:_dIgA,igAtR:(_dIgA/241*100).toFixed(1)+"%",mc:30,mR:"12.4%",tool:149,tR:"61.8%",eng:{alto:{v:4,p:"1.7%"},medio:{v:38,p:"15.8%"},bajo:{v:113,p:"46.9%"},minimo:{v:86,p:"35.7%"}},hours:[152,86,47,26,145,49,34,13,22,25,27,45,158,131,60,138,190,153,183,92,109,92,160,92],
    tpl:[
      {name:"msg_1_yago_sdr_1",day:"D+0",sent:562,resp:143,rate:"25.4%"},
      {name:"msg_1_yago_sdr",day:"D+0",sent:225,resp:33,rate:"14.7%"},
      {name:"msg_1_yago_sdr_br_1",day:"D+0",sent:153,resp:28,rate:"18.3%"},
      {name:"calificados_d0__v3",day:"D+0",sent:36,resp:13,rate:"36.1%"},
      {name:"leads_baja_d0_v1",day:"D+0",sent:74,resp:13,rate:"17.6%"},
      {name:"es_caso_de_xito",day:"D+1",sent:5,resp:3,rate:"60.0%"},
    ],
    bcast:[]}
};

var DEFAULT_FUNNEL_ALL=[{n:"Contactados",v:1116,c:C.accent},{n:"Respondieron",v:270,c:C.purple},{n:"Config. Plataf.",v:170,c:C.green},{n:"Enviaron IG",v:73,c:C.orange},{n:"Oferta Reuni\u00F3n",v:33,c:C.pink}];
var DEFAULT_FUNNEL_REAL=[{n:"Contactados",v:1116,c:C.accent},{n:"Resp. Reales",v:241,c:C.cyan},{n:"Config. Plataf.",v:149,c:C.green},{n:"Enviaron IG",v:71,c:C.orange},{n:"Oferta Reuni\u00F3n",v:30,c:C.pink}];
var DEFAULT_CH_BENCH=[{ch:"WA Warm*",r:45,y:0},{ch:"Yago (todas)",r:24.2,y:1},{ch:"Yago (reales)",r:21.6,y:1},{ch:"LinkedIn Cold*",r:18,y:0},{ch:"WA Cold*",r:15,y:0},{ch:"SMS Mktg*",r:12,y:0},{ch:"Email Cold*",r:8.5,y:0}];
var DEFAULT_DAILY=[{d:"02/03",l:88},{d:"02/04",l:56},{d:"02/05",l:69},{d:"02/06",l:39},{d:"02/07",l:60},{d:"02/08",l:63},{d:"02/09",l:60},{d:"02/10",l:82},{d:"02/11",l:79},{d:"02/12",l:99}];
var DEFAULT_BTABLE=[{m:"Respuesta (todas)",y:"24.2%",b:"40-60%",d:"-16 a -36pp",s:0},{m:"Respuesta (reales)",y:"21.6%",b:"40-60%",d:"-18 a -38pp",s:0},{m:"Env\u00EDo de Instagram",y:"27.0%",b:"35-50%",d:"~-8pp",s:0},{m:"Oferta Reuni\u00F3n",y:"12.2%",b:"20-30%",d:"~-8pp",s:0},{m:"Tiempo 1a Resp.",y:"~3 min",b:"<15 min",d:"5x mejor",s:1},{m:"Msgs/Conv.",y:"12.7",b:"10-20",d:"Normal",s:1}];
var DEFAULT_MEET_BY_TPL_ALL=[{l:"msg_1_yago_sdr_1",v:161,c:C.accent},{l:"msg_1_yago_sdr",v:37,c:C.accent},{l:"msg_1_yago_sdr_br_1",v:28,c:C.accent},{l:"leads_baja_d0_v1",v:15,c:C.accent},{l:"calificados_d0__v3",v:14,c:C.accent},{l:"calificados_d0__v4",v:3,c:C.accent},{l:"calificados_d0__v1__br",v:3,c:C.accent},{l:"es_caso_de_xito",v:3,c:C.purple}];
var DEFAULT_MEET_BY_TPL_REAL=[{l:"msg_1_yago_sdr_1",v:143,c:C.accent},{l:"msg_1_yago_sdr",v:33,c:C.accent},{l:"msg_1_yago_sdr_br_1",v:28,c:C.accent},{l:"calificados_d0__v3",v:13,c:C.accent},{l:"leads_baja_d0_v1",v:13,c:C.accent},{l:"calificados_d0__v1__br",v:3,c:C.accent},{l:"es_caso_de_xito",v:3,c:C.purple}];
var DEFAULT_HEADER={totalContactados:1116,leadsPerDay:112,dateRange:"02/03 \u2013 02/12",autoReplyCount:29,realesCount:241,esRate:"25.3",esResp:237,esTotal:935,ptRate:"18.2",ptResp:33,ptTotal:181};
// Note: ES/PT counts based on MSG1 template language detection

var tplCol={MSG1:"#2563EB",MSG2a:"#7C3AED",MSG2b:"#7C3AED",MSG2c:"#D97706",MSG3:"#0891B2",MSG4:"#EA580C"};
var tplNm={MSG1:"MSG 1 \u2014 Yago SDR (D+0)",MSG2a:"MSG 2a \u2014 Sin WA (D+1)",MSG2b:"MSG 2b \u2014 Caso de \u00C9xito (D+1)",MSG2c:"Emprende Show (Broadcast)",MSG3:"MSG 3 \u2014 Value Nudge (D+3)",MSG4:"MSG 4 \u2014 Quick Audit (D+5)"};

function Bd({children,color}){return <span style={{background:color+"15",color:color,padding:"4px 12px",borderRadius:6,fontSize:12,fontWeight:700}}>{children}</span>;}
function Sec({children}){return <div style={{fontSize:13,color:C.muted,textTransform:"uppercase",letterSpacing:1.5,fontWeight:700,marginBottom:14}}>{children}</div>;}
function Cd({children,style,onClick}){return <div onClick={onClick} style={{background:C.card,border:"1px solid "+C.border,borderRadius:14,padding:20,boxShadow:"0 1px 3px #0000000a",...style}}>{children}</div>;}

function qualLabel(q){if(!q)return{t:"Sin calificaci\u00F3n",c:C.muted};var lo=q.toLowerCase();if(lo==="alta")return{t:"Alta",c:C.green};if(lo==="media"||lo==="m\u00E9dia")return{t:"Media",c:C.accent};if(lo==="baja"||lo==="baixa")return{t:"Baja",c:C.yellow};return{t:q,c:C.muted};}

function ConvView({lead,onBack}){
  var eC={alto:C.green,medio:C.accent,bajo:C.yellow,minimo:C.red,profunda:C.green,media:C.accent,corta:C.yellow,rebote:C.red};
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
  var eC={alto:C.green,medio:C.accent,bajo:C.yellow,minimo:C.red,profunda:C.green,media:C.accent,corta:C.yellow,rebote:C.red};
  var filtered=mode===1?leads.filter(function(l){return !l.au;}):leads;

  return (<div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"#00000055",zIndex:999,display:"flex",alignItems:"center",justifyContent:"center",padding:20}} onClick={onClose}>
    <div style={{background:C.card,borderRadius:16,padding:24,maxWidth:880,width:"100%",maxHeight:"92vh",boxShadow:"0 25px 60px #00000025"}} onClick={function(e){e.stopPropagation();}}>
      {sel!==null ? (
        <ConvView lead={filtered[sel]} onBack={function(){setSel(null);}} />
      ) : (<div style={{maxHeight:"82vh",overflowY:"auto"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
          <div>
            <div style={{fontSize:19,fontWeight:900}}>{title||"\u{1F4C5} Leads con Oferta de Reuni\u00F3n"}</div>
            <div style={{fontSize:14,color:C.muted,marginTop:2}}>{filtered.length} leads {"\u00B7"} Click en un contacto para ver la conversación</div>
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
          {(filtered.length>0&&filtered[0].e&&["profunda","media","corta","rebote"].indexOf(filtered[0].e)>=0?[{l:"Profunda",c:C.green,v:filtered.filter(function(x){return x.e==="profunda";}).length},{l:"Media",c:C.accent,v:filtered.filter(function(x){return x.e==="media";}).length},{l:"Corta",c:C.yellow,v:filtered.filter(function(x){return x.e==="corta";}).length},{l:"Rebote",c:C.red,v:filtered.filter(function(x){return x.e==="rebote";}).length}]:[{l:"Alto",c:C.green,v:filtered.filter(function(x){return x.e==="alto";}).length},{l:"Medio",c:C.accent,v:filtered.filter(function(x){return x.e==="medio";}).length},{l:"Bajo",c:C.yellow,v:filtered.filter(function(x){return x.e==="bajo";}).length},{l:"M\u00EDnimo",c:C.red,v:filtered.filter(function(x){return x.e==="minimo";}).length}]).map(function(s,i){
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
  var eC={alto:C.green,medio:C.accent,bajo:C.yellow,minimo:C.red,profunda:C.green,media:C.accent,corta:C.yellow,rebote:C.red};
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
        {filtered.length===0 && <div style={{textAlign:"center",padding:30,color:C.muted,fontSize:14}}>Ningún lead respondió a este template{mode===1?" (filtro reales activo)":""}.</div>}
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
  const [dbLoading,setDbLoading]=useState(true);
  const [loadError,setLoadError]=useState(null);
  const [stepFilter,setStepFilter]=useState(null);
  const [panel,setPanel]=useState("outbound");
  const [inboundLoading,setInboundLoading]=useState(false);
  const [inboundRawRows,setInboundRawRows]=useState(null);
  const [lifecyclePhonesData,setLifecyclePhonesData]=useState(null);

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
  const [templateConfig,setTemplateConfig]=useState({});
  const [configLoaded,setConfigLoaded]=useState(false);
  const [allTemplateNames,setAllTemplateNames]=useState([]);
  const [inboundExtra,setInboundExtra]=useState(null);
  const [topicModal,setTopicModal]=useState(null);
  const [regionFilter,setRegionFilter]=useState("all");

  function applyResult(result){
    var hi={totalContactados:result.totalContactados,leadsPerDay:result.leadsPerDay,dateRange:result.dateRange,autoReplyCount:result.autoReplyCount,realesCount:result.realesCount,esRate:result.esRate,esResp:result.esResp,esTotal:result.esTotal,ptRate:result.ptRate,ptResp:result.ptResp,ptTotal:result.ptTotal};
    setMeetings(result.MEETINGS);setTopicsAll(result.topicsAll);setDataD(result.D);setFunnelAll(result.funnelAll);setFunnelReal(result.funnelReal);setChBench(result.chBench);setDaily(result.daily);setBTable(result.bTable);setMeetByTplAll(result.meetByTplAll);setMeetByTplReal(result.meetByTplReal);setHeaderInfo(hi);
    if(result.allTemplateNames) setAllTemplateNames(result.allTemplateNames);
    if(result.depthCounts){
      setInboundExtra({depthCounts:result.depthCounts,multiDayCount:result.multiDayCount,outcomeCount:result.outcomeCount,topicOutcomes:result.topicOutcomes,topicDepth:result.topicDepth,avgDepth:result.avgDepth,engagedTotal:result.engagedTotal,uniqueLeadCount:result.uniqueLeadCount,signupCount:result.signupCount,signupLinkCount:result.signupLinkCount});
    }else{
      setInboundExtra(null);
    }
  }

  // Load config from Supabase on mount
  useEffect(function(){
    supabase.from("template_config").select("template_name,category,region")
      .then(function(res){
        if(res.data){
          var cfg={};
          for(var i=0;i<res.data.length;i++){
            var r=res.data[i];
            cfg[r.template_name]={category:r.category||"sin_categoria",region:r.region||""};
          }
          setTemplateConfig(cfg);
        }
        setConfigLoaded(true);
      });
  },[]);

  useEffect(function(){
    if(!configLoaded) return;
    async function loadFromPostHog(){
      setDbLoading(true);
      setLoadError(null);
      try{
        var threads=await fetchThreadsFromPostHog(stepFilter);
        var csvRows=expandThreadMessages(threads);
        setRawRows(csvRows);
        var result=processCSVRows(csvRows,templateConfig,regionFilter);
        applyResult(result);
        // Auto-init templateConfig on first load if empty
        if(Object.keys(templateConfig).length===0&&result.tplStepInfo&&result.allTemplateNames){
          var stepCatMap={1:"d0",2:"d1",3:"d3",4:"d5"};
          var autoConfig={};
          var upsertRows=[];
          for(var ai=0;ai<result.allTemplateNames.length;ai++){
            var tn=result.allTemplateNames[ai];
            var step=result.tplStepInfo[tn];
            if(step&&stepCatMap[step]){
              autoConfig[tn]={category:stepCatMap[step],region:""};
              upsertRows.push({template_name:tn,category:stepCatMap[step],region:"",updated_at:new Date().toISOString()});
            }
          }
          if(Object.keys(autoConfig).length>0){
            setTemplateConfig(autoConfig);
            supabase.from("template_config").upsert(upsertRows).then(function(){});
          }
        }
      }catch(e){
        console.error("PostHog load error:",e);
        setLoadError(e.message||"Error al cargar datos de PostHog");
      }
      setDbLoading(false);
    }
    loadFromPostHog();
  },[stepFilter,configLoaded]);

  function updateTemplateConfig(tplName,field,value){
    setTemplateConfig(function(prev){
      var entry=prev[tplName]||{category:"sin_categoria",region:""};
      var next=Object.assign({},prev);
      next[tplName]=Object.assign({},entry);
      next[tplName][field]=value;
      supabase.from("template_config").upsert({
        template_name:tplName,
        category:next[tplName].category,
        region:next[tplName].region,
        updated_at:new Date().toISOString()
      }).then(function(){});
      return next;
    });
  }

  function resetConfig(){
    setTemplateConfig({});
    supabase.from("template_config").delete().neq("template_name","").then(function(){});
  }

  // Reprocess when templateConfig changes (only if rawRows already loaded)
  const templateConfigRef=useRef(templateConfig);
  useEffect(function(){
    if(templateConfigRef.current===templateConfig) return; // skip initial
    templateConfigRef.current=templateConfig;
    if(!rawRows||panel!=="outbound") return;
    var filtered=filterRowsByDate(rawRows,dateFrom,dateTo);
    var result=processCSVRows(filtered,templateConfig,regionFilter);
    applyResult(result);
  },[templateConfig]);

  function handleSearch(q){
    if(!q||!q.trim()){setSearchResults(null);return;}
    setSearchLoading(true);setSearchResults(null);setSearchSel(null);setSearchThreadData(null);
    var query=q.trim();
    var results=[];

    for(var i=0;i<meetings.length;i++){
      var m=meetings[i];
      if(m.p&&m.p.indexOf(query)>=0){
        results.push({lead:m,source:"memory",threadId:null});
      }
    }

    setSearchResults(results);
    setSearchLoading(false);
  }

  function selectSearchResult(idx){
    setSearchSel(idx);setSearchThreadData(null);
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

  function switchPanel(newPanel){
    if(newPanel===panel) return;
    // If switching to inbound and current tab is not supported, reset to overview
    if(newPanel==="inbound"&&(tab==="templates"||tab==="benchmarks"||tab==="config")){
      setTab("overview");
    }
    setPanel(newPanel);
    if(newPanel==="inbound"){
      setMode(0);
      if(inboundRawRows){
        var filtered=filterRowsByDate(inboundRawRows,dateFrom,dateTo);
        var result=processInboundRows(filtered,regionFilter,lifecyclePhonesData);
        applyResult(result);
      }else{
        setInboundLoading(true);
        var spPromise=fetchLifecyclePhones().catch(function(e){console.warn("Lifecycle phones query failed:",e);return {};});
        Promise.all([fetchInboundThreadsFromPostHog(),spPromise]).then(function(res){
          var threads=res[0];var sp=res[1];
          var csvRows=expandInboundThreadMessages(threads);
          setInboundRawRows(csvRows);
          setLifecyclePhonesData(sp);
          var filtered=filterRowsByDate(csvRows,dateFrom,dateTo);
          var result=processInboundRows(filtered,regionFilter,sp);
          applyResult(result);
          setInboundLoading(false);
        }).catch(function(e){
          console.error("Inbound load error:",e);
          setInboundLoading(false);
        });
      }
    }else{
      if(rawRows){
        var filtered2=filterRowsByDate(rawRows,dateFrom,dateTo);
        var result2=processCSVRows(filtered2,templateConfig,regionFilter);
        applyResult(result2);
      }
    }
  }

  function applyDateFilter(from,to){
    if(panel==="inbound"){
      if(!inboundRawRows) return;
      var filtered=filterRowsByDate(inboundRawRows,from,to);
      var result=processInboundRows(filtered,regionFilter,lifecyclePhonesData);
      applyResult(result);
    }else{
      if(!rawRows) return;
      var filtered2=filterRowsByDate(rawRows,from,to);
      var result2=processCSVRows(filtered2,templateConfig,regionFilter);
      applyResult(result2);
    }
  }

  function onDateFromChange(e){var v=e.target.value;setDateFrom(v);applyDateFilter(v,dateTo);}
  function onDateToChange(e){var v=e.target.value;setDateTo(v);applyDateFilter(dateFrom,v);}
  function clearDateFilter(){setDateFrom("");setDateTo("");applyDateFilter("","");}
  function onRegionChange(e){var v=e.target.value;setRegionFilter(v);if(panel==="inbound"&&inboundRawRows){var filtered=filterRowsByDate(inboundRawRows,dateFrom,dateTo);var result=processInboundRows(filtered,v,lifecyclePhonesData);applyResult(result);}else if(panel==="outbound"&&rawRows){var filtered2=filterRowsByDate(rawRows,dateFrom,dateTo);var result2=processCSVRows(filtered2,templateConfig,v);applyResult(result2);}}

  var mk=mode===0?"all":"real";var d=dataD[mk];var funnel=mode===0?funnelAll:funnelReal;var mbt=mode===0?meetByTplAll:meetByTplReal;
  var tc=headerInfo.totalContactados;
  var lpd=headerInfo.leadsPerDay;

  if(dbLoading) return (<div style={{background:C.bg,minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:font}}>
    <div style={{textAlign:"center"}}>
      <div style={{fontSize:36,marginBottom:12}}>{"..."}</div>
      <div style={{fontSize:16,color:C.muted,fontWeight:600}}>Cargando datos de PostHog...</div>
    </div>
  </div>);

  if(loadError) return (<div style={{background:C.bg,minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:font}}>
    <div style={{textAlign:"center",maxWidth:500}}>
      <div style={{fontSize:36,marginBottom:12}}>{"!"}</div>
      <div style={{fontSize:16,color:C.red,fontWeight:600,marginBottom:8}}>Error al cargar datos</div>
      <div style={{fontSize:14,color:C.muted,lineHeight:1.6}}>{loadError}</div>
      <button onClick={function(){setLoadError(null);setDbLoading(true);fetchThreadsFromPostHog(stepFilter).then(function(threads){var csvRows=expandThreadMessages(threads);setRawRows(csvRows);var result=processCSVRows(csvRows,templateConfig,regionFilter);applyResult(result);setDbLoading(false);}).catch(function(e){setLoadError(e.message||"Error");setDbLoading(false);});}} style={{marginTop:16,background:C.accent,color:"#fff",border:"none",borderRadius:8,padding:"10px 20px",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:font}}>Reintentar</button>
    </div>
  </div>);

  return (<div style={{background:C.bg,minHeight:"100vh",color:C.text,fontFamily:font,fontSize:15}}>
    <link href="https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@400;600;700;800;900&family=JetBrains+Mono:wght@400;700;800&display=swap" rel="stylesheet"/>
    {showM && <MeetModal leads={meetings.filter(function(l){return l.ml;})} mode={mode} onClose={function(){setShowM(false);}} title={"\u{1F4C5} Leads con Oferta de Reuni\u00F3n"}/>}
    {showA && <MeetModal leads={meetings} mode={mode} onClose={function(){setShowA(false);}} title={"\u{1F4AC} Todas las Conversaciones"}/>}
    {selTpl && <TplModal tpl={selTpl} leads={meetings} mode={mode} onClose={function(){setSelTpl(null);}}/>}
    {topicModal && (function(){
      var tkw=TOPIC_KEYWORDS[topicModal];
      var useHumanOnly=panel==="inbound";
      var filtered=meetings.filter(function(l){
        var txt="";for(var ci=0;ci<l.c.length;ci++){if(useHumanOnly?l.c[ci][0]===1:(l.c[ci][0]===1||l.c[ci][0]===2))txt+=" "+l.c[ci][1];}
        var lower=txt.toLowerCase();
        if(!tkw)return false;
        for(var ki=0;ki<tkw.kw.length;ki++){if(lower.includes(tkw.kw[ki]))return true;}
        return false;
      });
      return <MeetModal leads={filtered} mode={mode} onClose={function(){setTopicModal(null);}} title={(tkw?tkw.e+" ":"")+"T\u00F3pico: "+topicModal+" ("+filtered.length+" leads)"}/>;
    })()}

    <div style={{background:C.card,borderBottom:"1px solid "+C.border,padding:"16px 28px",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:12}}>
      <div style={{display:"flex",alignItems:"center",gap:14}}>
        <h1 style={{margin:0,fontSize:22,fontWeight:900}}><span style={{color:C.accent}}>YAGO</span> <span style={{color:C.muted,fontWeight:400}}>SDR</span></h1>
        <span style={{fontSize:13,color:C.muted,background:"#F3F4F6",padding:"4px 10px",borderRadius:6,fontWeight:600}}>{headerInfo.dateRange} {"\u00B7"} {tc} leads</span>
      </div>
      <div style={{display:"flex",gap:2,background:"#F3F4F6",borderRadius:10,padding:3}}>
        {[{id:"overview",l:"Resumen"},{id:"engagement",l:"Engagement"},{id:"templates",l:"Templates",ib:true},{id:"benchmarks",l:"Benchmarks",ib:true},{id:"lookup",l:"Buscar"},{id:"config",l:"Config",ib:true}].map(function(t){
          var disabled=t.ib&&panel==="inbound";
          return <button key={t.id} onClick={disabled?undefined:function(){setTab(t.id);}} style={{background:tab===t.id&&!disabled?"#374151":"transparent",color:disabled?C.border:tab===t.id?"#fff":C.muted,border:"none",borderRadius:8,padding:"7px 14px",fontSize:13,fontWeight:700,cursor:disabled?"default":"pointer",fontFamily:font}}>{t.l}</button>;
        })}
      </div>
    </div>

    <div style={{background:C.card,borderBottom:"1px solid "+C.border,padding:"10px 28px",display:"flex",alignItems:"center",gap:16,flexWrap:"wrap"}}>
      <div style={{display:"flex",background:"#F3F4F6",borderRadius:10,padding:3,gap:2}}>
        {[{id:"outbound",l:"Outbound",c:C.accent},{id:"inbound",l:"Inbound",c:"#7C3AED"}].map(function(p){var a=panel===p.id;return <button key={p.id} onClick={function(){switchPanel(p.id);}} style={{background:a?p.c:"transparent",color:a?"#fff":C.muted,border:"none",borderRadius:8,padding:"6px 14px",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:font}}>{p.l}</button>;})}
      </div>
      {panel==="outbound" && <div style={{display:"flex",background:"#F3F4F6",borderRadius:10,padding:3,gap:2}}>
        {[{l:"Todas",c:C.accent},{l:"Reales",c:C.green}].map(function(o,i){var a=mode===i;return <button key={i} onClick={function(){setMode(i);}} style={{background:a?o.c:"transparent",color:a?"#fff":C.muted,border:"none",borderRadius:8,padding:"6px 14px",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:font}}>{o.l}</button>;})}
      </div>}
      <div style={{width:1,height:24,background:C.border}}/>
      {panel==="outbound" && <select value={stepFilter||""} onChange={function(ev){var v=ev.target.value;setStepFilter(v||null);setDateFrom("");setDateTo("");}} style={{fontSize:12,fontWeight:600,padding:"5px 8px",borderRadius:8,border:"1px solid "+C.border,background:"#F9FAFB",color:C.text,fontFamily:font,cursor:"pointer"}}>
        <option value="">Todos los steps</option>
        <option value="1">Step 1 (D+0)</option>
        <option value="2">Step 2 (D+1)</option>
        <option value="3">Step 3 (D+3)</option>
        <option value="4">Step 4 (D+5)</option>
      </select>}
      <select value={regionFilter} onChange={onRegionChange} style={{fontSize:12,fontWeight:600,padding:"5px 8px",borderRadius:8,border:"1px solid "+C.border,background:"#F9FAFB",color:C.text,fontFamily:font,cursor:"pointer"}}>
        <option value="all">LATAM + BR</option>
        <option value="es">LATAM (ES)</option>
        <option value="pt">Brasil (PT)</option>
      </select>
      <div style={{display:"flex",alignItems:"center",gap:6}}>
        <span style={{fontSize:12,color:C.muted}}>De</span>
        <input type="date" value={dateFrom} onChange={onDateFromChange} style={{padding:"5px 10px",border:"1px solid "+C.border,borderRadius:8,fontSize:13,fontFamily:mono,color:C.text,background:"#F9FAFB",outline:"none"}}/>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:6}}>
        <span style={{fontSize:12,color:C.muted}}>Hasta</span>
        <input type="date" value={dateTo} onChange={onDateToChange} style={{padding:"5px 10px",border:"1px solid "+C.border,borderRadius:8,fontSize:13,fontFamily:mono,color:C.text,background:"#F9FAFB",outline:"none"}}/>
      </div>
      {(dateFrom||dateTo) && <button onClick={clearDateFilter} style={{background:"#FEF2F2",color:C.red,border:"1px solid #FECACA",borderRadius:8,padding:"5px 12px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:font}}>Limpiar</button>}
      {(dateFrom||dateTo) && <span style={{fontSize:12,color:C.accent,fontWeight:700,background:C.lBlue,padding:"4px 10px",borderRadius:6}}>{tc} leads en período</span>}
    </div>

    <div style={{padding:"24px 28px",maxWidth:1300,margin:"0 auto"}}>
      {inboundLoading && <div style={{background:C.lPurple,border:"1px solid "+C.purple+"25",borderRadius:12,padding:"12px 18px",marginBottom:20,display:"flex",gap:12,alignItems:"center"}}><span style={{fontSize:24}}>{"..."}</span><div><strong style={{color:C.purple}}>Cargando datos inbound...</strong></div></div>}

      {tab==="overview" && (function(){var cd=null;var isInb=panel==="inbound";var ix=inboundExtra; return (<>
        {isInb && ix ? (<>
          {/* Inbound: 3 KPI cards */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14,marginBottom:22}}>
            <Cd onClick={function(){setShowA(true);}} style={{cursor:"pointer",border:"2px solid "+C.purple+"44"}}>
              <div style={{fontSize:13,color:C.muted,fontWeight:600}}>Leads Inbound</div>
              <div style={{fontSize:36,fontWeight:900,fontFamily:mono,marginTop:6,lineHeight:1}}>{ix.uniqueLeadCount}</div>
              <div style={{fontSize:13,color:C.muted,marginTop:4}}>{lpd}/d{"\u00ED"}a {"\u00B7"} {tc} conversaciones</div>
              <div style={{fontSize:11,color:C.purple,fontWeight:700,marginTop:6}}>{"\u{1F4AC} Ver conversaciones \u2192"}</div>
            </Cd>
            <Cd>
              <div style={{fontSize:13,color:C.muted,fontWeight:600}}>Engagement</div>
              <div style={{fontSize:36,fontWeight:900,fontFamily:mono,color:C.accent,marginTop:6,lineHeight:1}}>{d.resp>0?((ix.engagedTotal/d.resp)*100).toFixed(1):"0"}%</div>
              <div style={{fontSize:13,color:C.muted,marginTop:4}}>{ix.engagedTotal} con 2+ msgs</div>
              <div style={{fontSize:12,fontWeight:600,marginTop:6,borderTop:"1px solid "+C.border,paddingTop:6}}><span style={{color:C.red}}>{ix.depthCounts.rebote} rebotes</span> {"\u00B7"} <span style={{color:C.accent}}>{ix.avgDepth} msgs/conv</span></div>
            </Cd>
            <Cd>
              <div style={{fontSize:13,color:C.muted,fontWeight:600}}>Conversi{"\u00F3"}n Signup</div>
              <div style={{fontSize:36,fontWeight:900,fontFamily:mono,color:C.green,marginTop:6,lineHeight:1}}>{ix.signupLinkCount}</div>
              <div style={{fontSize:13,color:C.muted,marginTop:4}}>recibieron link crear cuenta</div>
              <div style={{fontSize:12,color:C.green,fontWeight:600,marginTop:6,borderTop:"1px solid "+C.border,paddingTop:6}}>{ix.signupCount} recibieron Step 1 ({ix.uniqueLeadCount>0?((ix.signupCount/ix.uniqueLeadCount)*100).toFixed(1):"0"}%)</div>
            </Cd>
          </div>

          {/* Inbound: Funnel */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:22}}>
            <Cd><Sec>Embudo de Conversi&oacute;n</Sec>
              {funnel.map(function(f,i){var base=funnel[0].v||1;var w=Math.max((f.v/base)*100,3);var prev=i>0?((f.v/(funnel[i-1].v||1))*100).toFixed(0):null;
                return (<div key={i} style={{marginBottom:10}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}><span style={{fontSize:14,color:C.sub,fontWeight:500}}>{f.n}</span><div><span style={{fontSize:17,fontWeight:800,fontFamily:mono}}>{f.v}</span><span style={{fontSize:13,color:C.muted,marginLeft:6}}>{(f.v/base*100).toFixed(1)}%</span>{prev && <span style={{fontSize:12,color:parseFloat(prev)>=50?C.green:parseFloat(prev)>=20?C.yellow:C.red,marginLeft:6}}>({prev}%{"\u2193"})</span>}</div></div><div style={{height:22,background:"#F3F4F6",borderRadius:6,overflow:"hidden"}}><div style={{height:"100%",width:w+"%",background:f.c,borderRadius:6,opacity:0.8}}/></div></div>);})}
            </Cd>

            {/* Topics ranking */}
            <Cd><Sec>{"\u00BF"}Qu{"\u00E9"} buscan?</Sec>
              {d.topics.map(function(tp,i){
                var topicColors=["#3B82F6","#8B5CF6","#06B6D4","#F59E0B","#10B981","#EF4444"];
                var bC=topicColors[i%topicColors.length];
                return (
                  <div key={i} onClick={function(){setTopicModal(tp.t);}} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 0",borderBottom:i<d.topics.length-1?"1px solid "+C.border+"44":"none",cursor:"pointer"}}>
                    <span style={{fontSize:22}}>{tp.e}</span>
                    <div style={{flex:1}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                        <span style={{fontSize:14,fontWeight:700}}>{tp.t}</span>
                        <span style={{fontSize:14,fontWeight:800,fontFamily:mono,color:bC}}>{tp.n} <span style={{fontSize:12,fontWeight:600,color:C.muted}}>({tp.p}%)</span></span>
                      </div>
                      <div style={{height:6,background:"#F3F4F6",borderRadius:3,overflow:"hidden"}}>
                        <div style={{height:"100%",width:tp.p+"%",background:bC,borderRadius:3,opacity:0.7}}/>
                      </div>
                    </div>
                  </div>
                );
              })}
            </Cd>
          </div>
        </>) : (<>
          {/* Outbound: original KPI cards */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:12,marginBottom:22}}>
            {[{l:"Contactados",v:String(tc),s:lpd+"/d\u00EDa",cv:cd?String(cd.resp!==undefined?cd.totalContactados:""):null},{l:"Respuesta",v:d.rate,s:d.resp+" leads",b:45,ck:2,cv:cd?cd.rate:null},{l:"Instagram",v:d.igLinkR,s:d.igLink+" leads con link",ig2:d.igAt,cv:cd?cd.igLinkR:null},{l:"Config. Plataf.",v:d.tR,s:d.tool+" leads",cv:cd?cd.tR:null},{l:"Oferta Reuni\u00F3n",v:d.mR,s:d.mc+" leads",ck:1,cv:cd?cd.mR:null}].map(function(k,i){
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
            <Cd><Sec>Embudo de Conversi&oacute;n</Sec>
              {funnel.map(function(f,i){var w=Math.max((f.v/(tc||1))*100,4);var prev=i>0?((f.v/(funnel[i-1].v||1))*100).toFixed(0):null;
                return (<div key={i} style={{marginBottom:10}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}><span style={{fontSize:14,color:C.sub,fontWeight:500}}>{f.n}</span><div><span style={{fontSize:17,fontWeight:800,fontFamily:mono}}>{f.v}</span><span style={{fontSize:13,color:C.muted,marginLeft:6}}>{(f.v/(tc||1)*100).toFixed(1)}%</span>{prev && <span style={{fontSize:12,color:C.red,marginLeft:6}}>({prev}%{"\u2193"})</span>}</div></div><div style={{height:22,background:"#F3F4F6",borderRadius:6,overflow:"hidden"}}><div style={{height:"100%",width:w+"%",background:f.c,borderRadius:6,opacity:0.8}}/></div></div>);})}
            </Cd>
            <Cd><Sec>Yago vs Mercado</Sec>
              {chBench.map(function(b,i){return (<div key={i} style={{marginBottom:9}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}><span style={{fontSize:14,color:b.y?C.text:C.muted,fontWeight:b.y?700:400}}>{b.ch}</span><span style={{fontSize:15,fontWeight:800,color:b.y?C.accent:C.muted,fontFamily:mono}}>{b.r}%</span></div><div style={{height:8,background:"#F3F4F6",borderRadius:4}}><div style={{height:"100%",width:(b.r/45)*100+"%",background:b.y?C.accent:C.muted,borderRadius:4,opacity:b.y?0.8:0.3}}/></div></div>);})}
            </Cd>
          </div>
        </>)}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
          <Cd><Sec>{"\u{1F1EA}\u{1F1F8} vs \u{1F1E7}\u{1F1F7}"}</Sec><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}><div style={{background:C.lBlue,borderRadius:12,padding:16,textAlign:"center"}}><div style={{fontSize:12,color:C.accent,fontWeight:700}}>{"\u{1F1EA}\u{1F1F8} ESPA\u00D1OL"}</div><div style={{fontSize:34,fontWeight:900,color:C.accent,fontFamily:mono}}>{headerInfo.esRate}%</div><div style={{fontSize:13,color:C.muted}}>{headerInfo.esResp} de {headerInfo.esTotal}</div></div><div style={{background:C.lGreen,borderRadius:12,padding:16,textAlign:"center"}}><div style={{fontSize:12,color:C.green,fontWeight:700}}>{"\u{1F1E7}\u{1F1F7} PORTUGU\u00C9S"}</div><div style={{fontSize:34,fontWeight:900,color:C.green,fontFamily:mono}}>{headerInfo.ptRate}%</div><div style={{fontSize:13,color:C.muted}}>{headerInfo.ptResp} de {headerInfo.ptTotal}</div></div></div></Cd>
          <Cd><Sec>Leads por D{"\u00ED"}a</Sec><ResponsiveContainer width="100%" height={160}><AreaChart data={daily} margin={{left:-15,right:5,top:5,bottom:0}}><defs><linearGradient id="ag" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.accent} stopOpacity={0.2}/><stop offset="100%" stopColor={C.accent} stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" stroke={C.border}/><XAxis dataKey="d" tick={{fontSize:12,fill:C.muted}}/><YAxis tick={{fontSize:12,fill:C.muted}}/><Tooltip contentStyle={{background:C.card,border:"1px solid "+C.border,borderRadius:8,fontSize:13}}/><Area type="monotone" dataKey="l" stroke={C.accent} fill="url(#ag)" strokeWidth={2}/></AreaChart></ResponsiveContainer></Cd>
        </div>
      </>);})()}

      {tab==="engagement" && (function(){
        var isInb=panel==="inbound";var ix=inboundExtra;
        var totalResp=headerInfo.realesCount+headerInfo.autoReplyCount;
        var autoP=totalResp>0?((headerInfo.autoReplyCount/totalResp)*100).toFixed(1):"0";
        var realP=totalResp>0?((headerInfo.realesCount/totalResp)*100).toFixed(1):"0";
        var peakH=0;var peakV=0;for(var hi=0;hi<d.hours.length;hi++){if(d.hours[hi]>peakV){peakV=d.hours[hi];peakH=hi;}}
        var topicColors=["#3B82F6","#8B5CF6","#06B6D4","#F59E0B","#10B981","#EF4444"];

        if(isInb&&ix){
          var depthItems=[
            {k:"rebote",n:"Rebote: 1 msg",c:C.red,bg:"#FEF2F2",ic:"\u{1F4A4}"},
            {k:"corta",n:"Corta: 2-4 msgs",c:C.yellow,bg:"#FFFBEB",ic:"\u{1F610}"},
            {k:"media",n:"Media: 5-9 msgs",c:C.accent,bg:"#EFF6FF",ic:"\u{1F44D}"},
            {k:"profunda",n:"Profunda: 10+ msgs",c:C.green,bg:"#ECFDF5",ic:"\u{1F525}"}
          ];
          var depthLabels={profunda:"Profunda (10+)",media:"Media (5-9)",corta:"Corta (2-4)",rebote:"Rebote (1 msg)"};
          /* Conversion step helpers */
          var stLeads=ix.uniqueLeadCount;
          var stEngaged=ix.engagedTotal;
          var stLink=ix.signupLinkCount;
          var stStep1=ix.signupCount;
          var convSteps=[
            {n:"Leads Inbound",v:stLeads,c:C.accent,ic:"\u{1F4F2}"},
            {n:"Engajaron (2+ msgs)",v:stEngaged,c:C.purple,ic:"\u{1F4AC}"},
            {n:"Recibieron Link Cuenta",v:stLink,c:C.cyan,ic:"\u{1F517}"},
            {n:"Recibieron Step 1",v:stStep1,c:C.green,ic:"\u{1F4E9}"}
          ];
          return (<>
            {/* Conversion Journey Detail */}
            <Cd style={{marginBottom:22}}>
              <Sec>Jornada de Conversi{"\u00F3"}n Inbound</Sec>
              <div style={{fontSize:13,color:C.muted,marginBottom:16}}>De lead inbound a signup — tasa de conversi{"\u00F3"}n entre cada paso</div>
              {convSteps.map(function(st,i){
                var w=stLeads>0?Math.max((st.v/stLeads)*100,3):0;
                var prevV=i>0?convSteps[i-1].v:null;
                var stepRate=prevV&&prevV>0?((st.v/prevV)*100).toFixed(1):null;
                var absRate=stLeads>0?((st.v/stLeads)*100).toFixed(1):"0";
                return (<div key={i} style={{marginBottom:i<convSteps.length-1?14:0}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                    <span style={{fontSize:14,fontWeight:600,color:C.sub}}><span style={{marginRight:6}}>{st.ic}</span>{st.n}</span>
                    <div style={{display:"flex",alignItems:"baseline",gap:8}}>
                      <span style={{fontSize:20,fontWeight:900,fontFamily:mono,color:st.c}}>{st.v}</span>
                      <span style={{fontSize:12,color:C.muted}}>({absRate}%)</span>
                      {stepRate && <span style={{fontSize:12,fontWeight:700,color:parseFloat(stepRate)>=50?C.green:parseFloat(stepRate)>=20?C.yellow:C.red,background:parseFloat(stepRate)>=50?"#ECFDF5":parseFloat(stepRate)>=20?"#FFFBEB":"#FEF2F2",padding:"2px 8px",borderRadius:4}}>{stepRate}% del paso anterior</span>}
                    </div>
                  </div>
                  <div style={{height:18,background:"#F3F4F6",borderRadius:6,overflow:"hidden"}}>
                    <div style={{height:"100%",width:w+"%",background:st.c,borderRadius:6,opacity:0.8,transition:"width 0.3s"}}/>
                  </div>
                </div>);
              })}
            </Cd>

            {/* Depth + Multi-day side by side */}
            <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:16,marginBottom:22}}>
              {/* Depth Distribution */}
              <Cd>
                <Sec>{"Profundidad de Conversaci\u00F3n"}</Sec>
                <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:14}}>
                  {depthItems.map(function(e,i){var eng=d.eng[e.k]||{v:0,p:"0%"};return (
                    <div key={i} style={{background:e.bg,borderRadius:10,padding:"12px 10px",textAlign:"center",border:"1px solid "+e.c+"20"}}>
                      <div style={{fontSize:22,marginBottom:2}}>{e.ic}</div>
                      <div style={{fontSize:11,fontWeight:700,color:e.c}}>{e.n}</div>
                      <div style={{fontSize:26,fontWeight:900,fontFamily:mono,color:e.c,margin:"4px 0"}}>{eng.v}</div>
                      <div style={{fontSize:13,fontWeight:700,color:e.c}}>{eng.p}</div>
                    </div>
                  );})
                  }
                </div>
                <div style={{display:"flex",gap:0,height:12,borderRadius:6,overflow:"hidden",background:"#F3F4F6"}}>
                  {depthItems.map(function(e,i){var w=parseFloat((d.eng[e.k]||{p:"0"}).p)||0;return w>0?<div key={i} style={{width:w+"%",background:e.c,height:"100%",transition:"width 0.3s"}} title={depthLabels[e.k]+": "+w+"%"}/>:null;})
                  }
                </div>
                {ix.avgDepth>0 && <div style={{marginTop:12,fontSize:13,color:C.muted,textAlign:"center"}}>Promedio: <strong style={{color:C.accent,fontFamily:mono}}>{ix.avgDepth}</strong> msgs/conv (leads engajados)</div>}
              </Cd>

              {/* Multi-day + quick stats */}
              <div style={{display:"flex",flexDirection:"column",gap:16}}>
                <Cd style={{background:C.lBlue,border:"1px solid "+C.accent+"20",flex:1}}>
                  <div style={{fontSize:40,marginBottom:6,opacity:0.8}}>{"\u{1F504}"}</div>
                  <div style={{fontSize:11,color:C.muted,fontWeight:700,textTransform:"uppercase",letterSpacing:1}}>Leads Recurrentes</div>
                  <div style={{display:"flex",alignItems:"baseline",gap:6,marginTop:4}}>
                    <span style={{fontSize:32,fontWeight:900,fontFamily:mono,color:C.accent}}>{ix.multiDayCount}</span>
                    <span style={{fontSize:14,fontWeight:700,color:C.accent}}>({d.resp>0?((ix.multiDayCount/d.resp)*100).toFixed(1):"0"}%)</span>
                  </div>
                  <div style={{fontSize:12,color:C.sub,marginTop:4}}>volvieron otro d{"\u00ED"}a</div>
                </Cd>
                <Cd style={{background:C.lGreen,border:"1px solid "+C.green+"20",flex:1}}>
                  <div style={{fontSize:40,marginBottom:6,opacity:0.8}}>{"\u{1F3AF}"}</div>
                  <div style={{fontSize:11,color:C.muted,fontWeight:700,textTransform:"uppercase",letterSpacing:1}}>Con Resultado</div>
                  <div style={{display:"flex",alignItems:"baseline",gap:6,marginTop:4}}>
                    <span style={{fontSize:32,fontWeight:900,fontFamily:mono,color:C.green}}>{ix.outcomeCount}</span>
                    <span style={{fontSize:14,fontWeight:700,color:C.green}}>({d.resp>0?((ix.outcomeCount/d.resp)*100).toFixed(1):"0"}%)</span>
                  </div>
                  <div style={{fontSize:12,color:C.sub,marginTop:4}}>tool, IG o reuni{"\u00F3"}n</div>
                </Cd>
              </div>
            </div>

            {/* Outcomes per topic */}
            <Cd style={{marginBottom:22}}>
              <Sec>Outcomes por T{"\u00F3"}pico</Sec>
              <div style={{fontSize:13,color:C.muted,marginBottom:14}}>"Con resultado" = Yago us{"\u00F3"} herramienta, lead envi{"\u00F3"} IG, o se ofreci{"\u00F3"} reuni{"\u00F3"}n</div>
              <div style={{overflowX:"auto"}}>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:14}}>
                  <thead><tr style={{borderBottom:"2px solid "+C.border}}>
                    {["T\u00F3pico","Conversas","Con Resultado","%"].map(function(h,i){return <th key={i} style={{padding:"10px 14px",textAlign:"left",color:C.muted,fontWeight:700,fontSize:12,textTransform:"uppercase"}}>{h}</th>;})}
                  </tr></thead>
                  <tbody>
                    {d.topics.map(function(tp,i){
                      var to=ix.topicOutcomes[tp.t]||{total:0,withOutcome:0};
                      var oRate=to.total>0?((to.withOutcome/to.total)*100).toFixed(1):"0.0";
                      var oColor=parseFloat(oRate)>=30?C.green:parseFloat(oRate)>=15?C.yellow:C.red;
                      return (<tr key={i} onClick={function(){setTopicModal(tp.t);}} style={{borderBottom:"1px solid "+C.border+"44",cursor:"pointer"}}>
                        <td style={{padding:"12px 14px",fontWeight:700}}><span style={{marginRight:8}}>{tp.e}</span>{tp.t} <span style={{fontSize:11,color:C.accent}}>{"\u2192"}</span></td>
                        <td style={{padding:"12px 14px",fontFamily:mono,fontWeight:700}}>{tp.n}</td>
                        <td style={{padding:"12px 14px",fontFamily:mono,fontWeight:700,color:C.green}}>{to.withOutcome}</td>
                        <td style={{padding:"12px 14px"}}><Bd color={oColor}>{oRate}%</Bd></td>
                      </tr>);
                    })}
                    <tr style={{borderTop:"2px solid "+C.border,fontWeight:800}}>
                      <td style={{padding:"12px 14px"}}>Total</td>
                      <td style={{padding:"12px 14px",fontFamily:mono}}>{d.resp}</td>
                      <td style={{padding:"12px 14px",fontFamily:mono,color:C.green}}>{ix.outcomeCount}</td>
                      <td style={{padding:"12px 14px"}}><Bd color={C.accent}>{d.resp>0?((ix.outcomeCount/d.resp)*100).toFixed(1):"0"}%</Bd></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </Cd>

            {/* Hour chart */}
            <Cd>
              <Sec>Horario de Mensajes Inbound</Sec>
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
                  <Tooltip contentStyle={{background:C.card,border:"1px solid "+C.border,borderRadius:8,fontSize:13}} formatter={function(v){return[v,"Mensajes"];}}/>
                  <Bar dataKey="v" radius={[4,4,0,0]} barSize={22}>
                    {d.hours.map(function(v,i){return <Cell key={i} fill={i===peakH?"#1D4ED8":v>=10?"url(#barGrad)":v>=5?C.accent+"77":C.accent+"33"}/>;})
                    }
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,marginTop:12,padding:"8px 16px",background:C.lBlue,borderRadius:8}}>
                <span style={{fontSize:18}}>{"\u{1F551}"}</span>
                <span style={{fontSize:14,color:C.accent,fontWeight:700}}>Horario pico: {String(peakH).padStart(2,"0")}:00h</span>
                <span style={{fontSize:13,color:C.muted}}>({peakV} mensajes)</span>
              </div>
            </Cd>
          </>);
        }

        /* Outbound engagement */
        var engIcons={alto:"\u{1F525}",medio:"\u{1F44D}",bajo:"\u{1F610}",minimo:"\u{1F4A4}"};
        var engLabels={alto:"Alto",medio:"Medio",bajo:"Bajo",minimo:"M\u00EDnimo"};
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
                <div key={i} onClick={function(){setTopicModal(tp.t);}} style={{background:bC+"08",borderRadius:12,padding:"16px 14px",border:"1px solid "+bC+"18",cursor:"pointer"}}>
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
                  <div style={{fontSize:11,color:bC,fontWeight:700,marginTop:8}}>Ver conversaciones {"\u2192"}</div>
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
          var stepKeys=Object.keys(d.tplByStep).sort(function(a,b){return (d.tplByStep[a].order||99)-(d.tplByStep[b].order||99);});
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
                    return (<Cd key={i} onClick={tplItem?function(){setSelTpl(tplItem);}:undefined} style={tplItem?{cursor:"pointer"}:{}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}><div><div style={{fontWeight:800,fontSize:15}}>{t.displayName}</div><div style={{display:"flex",gap:6,marginTop:4}}><span style={{fontSize:11,color:C.muted,background:"#F3F4F6",padding:"2px 8px",borderRadius:4}}>{sg.day}</span><span style={{fontSize:11,fontWeight:700,padding:"2px 8px",borderRadius:4,background:t.lang==="pt"?C.green+"15":C.accent+"15",color:t.lang==="pt"?C.green:C.accent}}>{t.lang==="pt"?"PT":"ES"}</span>{t.region && <span style={{fontSize:11,fontWeight:700,padding:"2px 8px",borderRadius:4,background:t.region==="br"?"#ECFDF5":"#EFF6FF",color:t.region==="br"?"#059669":"#2563EB"}}>{t.region==="br"?"BR":"LATAM"}</span>}</div></div><div style={{textAlign:"right"}}><div style={{fontSize:24,fontWeight:800,color:tsc,fontFamily:mono}}>{t.rate}</div><div style={{fontSize:12,color:C.muted}}>{t.resp} de {t.sent}</div></div></div>{tplItem && <div style={{fontSize:11,color:C.accent,fontWeight:600,marginTop:8}}>Click para ver detalles {"\u2192"}</div>}</Cd>);
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
          <div style={{fontSize:12,color:C.muted,marginTop:8}}>Busca por n&uacute;mero de tel&eacute;fono (parcial). Busca en los datos cargados.</div>
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
                    </div>
                    <div style={{fontSize:12,color:C.muted,marginTop:3}}>
                      {l.ms} msgs {"\u00B7"} {l.w.toLocaleString()} pal. {"\u00B7"} Tpls: <strong>{l.tr.join(", ")||"N/A"}</strong>
                    </div>
                  </div>
                  <div style={{color:C.accent,fontSize:18,fontWeight:700}}>{"\u2192"}</div>
                </div>);
              })}
            </div>
          </Cd>
        )}

        {searchSel!==null&&searchResults&&searchResults[searchSel] && (function(){
          var item=searchResults[searchSel];var lead=item.lead;
          return (<Cd>
            <ConvView lead={lead} onBack={function(){setSearchSel(null);setSearchThreadData(null);}}/>
          </Cd>);
        })()}
      </>)}

      {tab==="config" && (<>
        <Cd style={{marginBottom:22}}>
          <Sec>Configuraci&oacute;n de Templates</Sec>
          <div style={{fontSize:14,color:C.sub,marginBottom:18,lineHeight:1.6}}>Asigna cada template a una categor&iacute;a para agruparlos en la pesta&ntilde;a Templates. Templates marcados como <strong>Autom&aacute;tico</strong> o <strong>Campa&ntilde;a</strong> ser&aacute;n excluidos de los indicadores de Resumen.</div>
          {allTemplateNames.length===0 && <div style={{textAlign:"center",padding:30,color:C.muted,fontSize:14}}>No hay templates cargados a&uacute;n. Carga datos primero.</div>}
          {allTemplateNames.length>0 && (<>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {allTemplateNames.slice().sort().map(function(tplName){
                var currentEntry=templateConfig[tplName]||{};
                var currentCat=typeof currentEntry==="string"?currentEntry:(currentEntry.category||"sin_categoria");
                var currentRegion=typeof currentEntry==="string"?"":(currentEntry.region||"");
                return (<div key={tplName} style={{display:"flex",alignItems:"center",gap:14,padding:"12px 16px",background:"#F9FAFB",borderRadius:10,border:"1px solid "+C.border}}>
                  <div style={{flex:1,fontWeight:700,fontSize:14,fontFamily:mono}}>{tplName}</div>
                  <select value={currentCat} onChange={function(e){updateTemplateConfig(tplName,"category",e.target.value);}} style={{padding:"6px 12px",border:"1px solid "+C.border,borderRadius:8,fontSize:13,fontFamily:font,background:"#FFF",color:C.text,cursor:"pointer",minWidth:200}}>
                    <option value="sin_categoria">Sin categor&iacute;a</option>
                    <option value="d0">D+0 — Contacto Inicial</option>
                    <option value="d1">D+1 — Seguimiento</option>
                    <option value="d3">D+3 — Value Nudge</option>
                    <option value="d5">D+5 — Quick Audit</option>
                    <option value="automatico">Autom&aacute;tico</option>
                    <option value="campanha">Campa&ntilde;a</option>
                  </select>
                  <select value={currentRegion} onChange={function(e){updateTemplateConfig(tplName,"region",e.target.value);}} style={{padding:"6px 12px",border:"1px solid "+C.border,borderRadius:8,fontSize:13,fontFamily:font,background:"#FFF",color:C.text,cursor:"pointer",minWidth:130}}>
                    <option value="">Sin regi&oacute;n</option>
                    <option value="br">BR</option>
                    <option value="latam">LATAM</option>
                  </select>
                </div>);
              })}
            </div>
            <div style={{marginTop:18,display:"flex",gap:12}}>
              <button onClick={resetConfig} style={{background:"#FEF2F2",color:C.red,border:"1px solid #FECACA",borderRadius:8,padding:"10px 20px",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:font}}>Resetear config</button>
              <span style={{fontSize:12,color:C.muted,alignSelf:"center"}}>Resetear volver&aacute; al auto-detect por step_order en la pr&oacute;xima carga.</span>
            </div>
          </>)}
        </Cd>
      </>)}
    </div>
  </div>);
}
