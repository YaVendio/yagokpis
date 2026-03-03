import { useState, useEffect, useRef } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, AreaChart, Area } from "recharts";
import { processCSVRows, processInboundRows, parseDatetime, TOPIC_KEYWORDS } from "./csvParser";
import { fetchThreadsFromPostHog, expandThreadMessages, fetchInboundThreadsFromPostHog, expandInboundThreadMessages, fetchLifecyclePhones, queryMetabase } from "./posthogApi";
import { DEFAULT_MEETINGS as _RAW_MEETINGS } from "./defaultData";
import { supabase } from "./supabase";
import InfoTip from "./components/InfoTip";
import TIPS from "./tooltips";
import { fetchCampaigns, fetchCampaignGroups, fetchCampaignLeads, formatDateForApi } from "./gruposApi";
import { fetchAllContacts, fetchAllMeetings, fetchAllDeals, fetchDealPipelines, extractHubSpotPhones } from "./hubspotApi";

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

function Bd({children,color}){return <span style={{background:color+"15",color:color,padding:"4px 12px",borderRadius:9999,fontSize:12,fontWeight:700,border:"1px solid "+color+"20",letterSpacing:0.3}}>{children}</span>;}
function Sec({children,tipKey}){return <div style={{fontSize:13,color:C.muted,textTransform:"uppercase",letterSpacing:1.5,fontWeight:700,marginBottom:14,paddingBottom:10,borderBottom:"1px solid "+C.border+"66",display:"flex",alignItems:"center"}}>{children}{tipKey && <InfoTip data={TIPS[tipKey]}/>}</div>;}
function Cd({children,style,onClick}){var _h=useState(false),hov=_h[0],sH=_h[1];return <div onClick={onClick} onMouseEnter={function(){sH(true);}} onMouseLeave={function(){sH(false);}} style={{background:C.card,border:"1px solid "+(hov?C.accent+"44":C.border),borderRadius:16,padding:20,boxShadow:hov?"0 8px 25px #0000000f":"0 1px 3px #0000000a",transform:hov?"translateY(-1px)":"none",transition:"box-shadow 0.2s ease, border-color 0.2s ease, transform 0.2s ease",...style}}>{children}</div>;}

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

  return (<div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"#00000044",backdropFilter:"blur(4px)",WebkitBackdropFilter:"blur(4px)",zIndex:999,display:"flex",alignItems:"center",justifyContent:"center",padding:20,animation:"fadeInModal 0.2s ease-out"}} onClick={onClose}>
    <div style={{background:C.card,borderRadius:20,padding:28,maxWidth:880,width:"100%",maxHeight:"92vh",boxShadow:"0 25px 60px #00000025",animation:"scaleInModal 0.2s ease-out"}} onClick={function(e){e.stopPropagation();}}>
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

  return (<div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"#00000044",backdropFilter:"blur(4px)",WebkitBackdropFilter:"blur(4px)",zIndex:999,display:"flex",alignItems:"center",justifyContent:"center",padding:20,animation:"fadeInModal 0.2s ease-out"}} onClick={onClose}>
    <div style={{background:C.card,borderRadius:20,padding:28,maxWidth:880,width:"100%",maxHeight:"92vh",boxShadow:"0 25px 60px #00000025",animation:"scaleInModal 0.2s ease-out"}} onClick={function(e){e.stopPropagation();}}>
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
  const [isAuthenticated,setIsAuthenticated]=useState(function(){return !!sessionStorage.getItem("dashboard_password");});
  const [loginPassword,setLoginPassword]=useState("");
  const [loginError,setLoginError]=useState("");
  const [loginLoading,setLoginLoading]=useState(false);

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
  const [abSelectMode,setAbSelectMode]=useState(false);
  const [abSelected,setAbSelected]=useState([]);

  // Grupos tab state
  const [gruposLoading,setGruposLoading]=useState(false);
  const [gruposCampaigns,setGruposCampaigns]=useState([]);
  const [gruposSelectedCampaign,setGruposSelectedCampaign]=useState(null);
  const [gruposGroups,setGruposGroups]=useState([]);
  const [gruposEntryLeads,setGruposEntryLeads]=useState([]);
  const [gruposExitLeads,setGruposExitLeads]=useState([]);
  const [gruposDailyData,setGruposDailyData]=useState([]);
  const [gruposCrossRef,setGruposCrossRef]=useState(null);
  const [gruposDateFrom,setGruposDateFrom]=useState("");
  const [gruposDateTo,setGruposDateTo]=useState("");
  const [gruposError,setGruposError]=useState(null);

  // CRM (HubSpot) tab state
  const [crmLoading,setCrmLoading]=useState(false);
  const [crmError,setCrmError]=useState(null);
  const [crmContacts,setCrmContacts]=useState([]);
  const [crmMeetings,setCrmMeetings]=useState([]);
  const [crmDeals,setCrmDeals]=useState([]);
  const [crmPipelines,setCrmPipelines]=useState(null);
  const [crmCrossRef,setCrmCrossRef]=useState(null);
  const [crmCrossLoading,setCrmCrossLoading]=useState(false);
  const [crmInited,setCrmInited]=useState(false);

  useEffect(function(){
    function onAuthRequired(){sessionStorage.removeItem("dashboard_password");setIsAuthenticated(false);setLoginError("Sesión expirada. Ingrese de nuevo.");}
    window.addEventListener("auth-required",onAuthRequired);
    return function(){window.removeEventListener("auth-required",onAuthRequired);};
  },[]);

  // Auto-init Grupos tab when selected for the first time
  useEffect(function(){
    if(tab==="grupos"&&gruposCampaigns.length===0&&!gruposLoading&&!gruposError){initGrupos();}
  },[tab]);

  // Auto-init CRM tab when selected for the first time
  useEffect(function(){
    if(tab==="crm"&&!crmInited&&!crmLoading&&!crmError){initCrm();}
  },[tab]);

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
    supabase.from("template_config").select("template_name,category,region,ab_group,sort_order,hidden")
      .then(function(res){
        if(res.data){
          var cfg={};
          for(var i=0;i<res.data.length;i++){
            var r=res.data[i];
            cfg[r.template_name]={category:r.category||"sin_categoria",region:r.region||"",ab_group:r.ab_group||null,sort_order:r.sort_order||0,hidden:r.hidden||false};
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
              autoConfig[tn]={category:stepCatMap[step],region:"",ab_group:null,sort_order:0,hidden:false};
              upsertRows.push({template_name:tn,category:stepCatMap[step],region:"",ab_group:null,sort_order:0,hidden:false,updated_at:new Date().toISOString()});
            }
          }
          if(Object.keys(autoConfig).length>0){
            setTemplateConfig(autoConfig);
            supabase.from("template_config").upsert(upsertRows).then(function(){});
          }
        }
      }catch(e){
        console.error("Metabase load error:",e);
        setLoadError(e.message||"Error al cargar datos de Metabase");
      }
      setDbLoading(false);
    }
    loadFromPostHog();
  },[stepFilter,configLoaded]);

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

  async function handleLogin(e){
    e.preventDefault();
    setLoginLoading(true);setLoginError("");
    sessionStorage.setItem("dashboard_password",loginPassword);
    try{
      var resp=await fetch("/api/metabase",{method:"POST",headers:{"Content-Type":"application/json","x-dashboard-password":loginPassword},body:JSON.stringify({sql:"SELECT 1"})});
      if(resp.status===401){sessionStorage.removeItem("dashboard_password");setLoginError("Contraseña incorrecta");setLoginLoading(false);return;}
      setIsAuthenticated(true);
    }catch(err){sessionStorage.removeItem("dashboard_password");setLoginError("Error de conexión");
    }finally{setLoginLoading(false);}
  }

  if(!isAuthenticated) return (
    <div style={{background:C.bg,minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:font}}>
      <link href="https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@400;600;700;800;900&family=JetBrains+Mono:wght@400;700;800&display=swap" rel="stylesheet"/>
      <form onSubmit={handleLogin} style={{background:C.card,border:"1px solid "+C.border,borderRadius:14,padding:40,boxShadow:"0 1px 3px #0000000a",width:360,textAlign:"center"}}>
        <div style={{fontSize:32,marginBottom:8}}>{"🔒"}</div>
        <div style={{fontSize:20,fontWeight:800,color:C.text,marginBottom:4}}>Yago SDR Analytics</div>
        <div style={{fontSize:13,color:C.muted,marginBottom:24}}>Ingrese la contraseña para acceder</div>
        <input type="password" value={loginPassword} onChange={function(ev){setLoginPassword(ev.target.value);}} placeholder="Contraseña" style={{width:"100%",padding:"12px 14px",fontSize:15,border:"1px solid "+C.border,borderRadius:8,fontFamily:font,marginBottom:12,boxSizing:"border-box",outline:"none"}}/>
        {loginError && <div style={{color:C.red,fontSize:13,fontWeight:600,marginBottom:12}}>{loginError}</div>}
        <button type="submit" disabled={loginLoading||!loginPassword} style={{width:"100%",padding:"12px 0",fontSize:15,fontWeight:700,color:"#fff",background:loginLoading?"#93C5FD":C.accent,border:"none",borderRadius:8,cursor:loginLoading?"wait":"pointer",fontFamily:font}}>{loginLoading?"Verificando...":"Entrar"}</button>
      </form>
    </div>
  );

  function updateTemplateConfig(tplName,field,value){
    setTemplateConfig(function(prev){
      var entry=prev[tplName]||{category:"sin_categoria",region:"",ab_group:null,sort_order:0,hidden:false};
      var next=Object.assign({},prev);
      next[tplName]=Object.assign({},entry);
      next[tplName][field]=value;
      supabase.from("template_config").upsert({
        template_name:tplName,
        category:next[tplName].category,
        region:next[tplName].region,
        ab_group:next[tplName].ab_group||null,
        sort_order:next[tplName].sort_order||0,
        hidden:next[tplName].hidden||false,
        updated_at:new Date().toISOString()
      }).then(function(){});
      return next;
    });
  }

  function resetConfig(){
    setTemplateConfig({});
    supabase.from("template_config").delete().neq("template_name","").then(function(){});
  }

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

  // --- Grupos tab functions ---
  // Parse MeuGrupoVip date format "dd/mm/YYYY HH:mm:ss" to "YYYY-MM-DD"
  function parseMgvDate(str){
    if(!str)return "";
    // Format: "03/03/2026 15:34:38"
    var parts=str.split(" ")[0].split("/");
    if(parts.length===3) return parts[2]+"-"+parts[1]+"-"+parts[0];
    return str.slice(0,10);
  }

  async function initGrupos(){
    setGruposLoading(true);setGruposError(null);
    try{
      var data=await fetchCampaigns();
      var campaigns=data.data||data||[];
      if(!Array.isArray(campaigns)) campaigns=[];
      setGruposCampaigns(campaigns);
      if(campaigns.length>0){
        var first=campaigns[0];
        var cid=first.campaign_id||first.id;
        setGruposSelectedCampaign(cid);
        // Set default dates: last 30 days
        var now=new Date();var from=new Date();from.setDate(now.getDate()-30);
        var fromStr=from.toISOString().slice(0,10);var toStr=now.toISOString().slice(0,10);
        setGruposDateFrom(fromStr);setGruposDateTo(toStr);
        await loadGruposData(cid,fromStr,toStr);
      }
    }catch(e){setGruposError(e.message);}
    finally{setGruposLoading(false);}
  }

  async function loadGruposData(campaignId,from,to){
    setGruposLoading(true);setGruposError(null);setGruposCrossRef(null);
    try{
      var fromApi=from?formatDateForApi(from):undefined;
      var toApi=to?formatDateForApi(to):undefined;
      var [entryData,exitData,groupsData]=await Promise.all([
        fetchCampaignLeads(campaignId,fromApi,toApi,"entry"),
        fetchCampaignLeads(campaignId,fromApi,toApi,"exit"),
        fetchCampaignGroups(campaignId),
      ]);
      // API returns {data:{leads:[...]}} or {data:{groups:[...]}}
      var entryLeads=(entryData.data&&entryData.data.leads)||entryData.leads||[];
      var exitLeads=(exitData.data&&exitData.data.leads)||exitData.leads||[];
      var groups=(groupsData.data&&groupsData.data.groups)||groupsData.groups||[];
      if(!Array.isArray(entryLeads))entryLeads=[];
      if(!Array.isArray(exitLeads))exitLeads=[];
      if(!Array.isArray(groups))groups=[];
      setGruposEntryLeads(entryLeads);setGruposExitLeads(exitLeads);setGruposGroups(groups);
      // Build daily data for chart
      var dayMap={};
      for(var i=0;i<entryLeads.length;i++){
        var dk=parseMgvDate(entryLeads[i].entry_date);
        if(!dk)continue;
        if(!dayMap[dk])dayMap[dk]={d:dk,entries:0,exits:0};
        dayMap[dk].entries++;
      }
      for(var j=0;j<exitLeads.length;j++){
        var dk2=parseMgvDate(exitLeads[j].departure_date||exitLeads[j].entry_date);
        if(!dk2)continue;
        if(!dayMap[dk2])dayMap[dk2]={d:dk2,entries:0,exits:0};
        dayMap[dk2].exits++;
      }
      var dailyArr=Object.values(dayMap).sort(function(a,b){return a.d<b.d?-1:1;});
      setGruposDailyData(dailyArr);
    }catch(e){setGruposError(e.message);}
    finally{setGruposLoading(false);}
  }

  async function loadGruposCrossReference(campaignId,from,to){
    setGruposLoading(true);setGruposError(null);
    try{
      // 1. Get phones from MeuGrupoVip entry leads
      var fromApi=from?formatDateForApi(from):undefined;
      var toApi=to?formatDateForApi(to):undefined;
      var entryData=await fetchCampaignLeads(campaignId,fromApi,toApi,"entry");
      var entryLeads=(entryData.data&&entryData.data.leads)||entryData.leads||[];
      if(!Array.isArray(entryLeads))entryLeads=[];
      var grupoPhones={};
      for(var i=0;i<entryLeads.length;i++){
        var ph=(entryLeads[i].contact||"").replace(/\D/g,"");
        if(ph)grupoPhones[ph]=true;
      }
      var grupoPhoneSet=Object.keys(grupoPhones);

      // 2. Get phones from Yago (lifecycle_executions + thread metadata)
      var yagoResult=await queryMetabase(
        "SELECT phone FROM (\n"+
        "  SELECT DISTINCT phone_number AS phone FROM lifecycle_executions WHERE phone_number IS NOT NULL\n"+
        "  UNION\n"+
        "  SELECT DISTINCT metadata->>'phone_number' AS phone FROM thread WHERE metadata->>'phone_number' IS NOT NULL\n"+
        ") sub WHERE phone IS NOT NULL AND phone != ''"
      );
      var yagoPhones={};
      if(yagoResult&&yagoResult.results){
        for(var j=0;j<yagoResult.results.length;j++){
          var yp=(yagoResult.results[j][0]||"").replace(/\D/g,"");
          if(yp)yagoPhones[yp]=true;
        }
      }

      // 3. Calculate intersection
      var overlap=0;
      for(var k=0;k<grupoPhoneSet.length;k++){
        if(yagoPhones[grupoPhoneSet[k]])overlap++;
      }
      var yagoTotal=Object.keys(yagoPhones).length;
      setGruposCrossRef({grupoTotal:grupoPhoneSet.length,yagoTotal:yagoTotal,overlap:overlap,rate:grupoPhoneSet.length>0?(overlap/grupoPhoneSet.length*100).toFixed(1):"0"});
    }catch(e){setGruposError(e.message);}
    finally{setGruposLoading(false);}
  }

  // --- CRM (HubSpot) tab functions ---
  async function initCrm(){
    setCrmLoading(true);setCrmError(null);
    try{
      var [contacts,meetings,deals,pipelines]=await Promise.all([
        fetchAllContacts(),fetchAllMeetings(),fetchAllDeals(),fetchDealPipelines()
      ]);
      setCrmContacts(contacts);setCrmMeetings(meetings);setCrmDeals(deals);setCrmPipelines(pipelines);setCrmInited(true);
    }catch(e){setCrmError(e.message);}
    finally{setCrmLoading(false);}
  }

  async function loadCrmCrossReference(){
    setCrmCrossLoading(true);setCrmError(null);
    try{
      // 1. HubSpot phones
      var hsPhones=extractHubSpotPhones(crmContacts);

      // 2. MeuGrupoVip phones — reuse gruposEntryLeads if available
      var grupoPhones={};
      if(gruposEntryLeads&&gruposEntryLeads.length>0){
        for(var i=0;i<gruposEntryLeads.length;i++){
          var gp=(gruposEntryLeads[i].contact||"").replace(/\D/g,"");
          if(gp)grupoPhones[gp]=true;
        }
      }else{
        try{
          var campaigns=gruposCampaigns.length>0?gruposCampaigns:((await fetchCampaigns()).data||[]);
          if(campaigns.length>0){
            var cid=campaigns[0].campaign_id||campaigns[0].id;
            var entryData=await fetchCampaignLeads(cid);
            var entryLeads=(entryData.data&&entryData.data.leads)||entryData.leads||[];
            for(var gi=0;gi<entryLeads.length;gi++){
              var gph=(entryLeads[gi].contact||"").replace(/\D/g,"");
              if(gph)grupoPhones[gph]=true;
            }
          }
        }catch(e){console.warn("Could not fetch MeuGrupoVip phones for cross-ref:",e);}
      }

      // 3. Yago phones — same SQL as Grupos cross-reference
      var yagoPhones={};
      try{
        var yagoResult=await queryMetabase(
          "SELECT phone FROM (\n"+
          "  SELECT DISTINCT phone_number AS phone FROM lifecycle_executions WHERE phone_number IS NOT NULL\n"+
          "  UNION\n"+
          "  SELECT DISTINCT metadata->>'phone_number' AS phone FROM thread WHERE metadata->>'phone_number' IS NOT NULL\n"+
          ") sub WHERE phone IS NOT NULL AND phone != ''"
        );
        if(yagoResult&&yagoResult.results){
          for(var j=0;j<yagoResult.results.length;j++){
            var yp=(yagoResult.results[j][0]||"").replace(/\D/g,"");
            if(yp)yagoPhones[yp]=true;
          }
        }
      }catch(e){console.warn("Could not fetch Yago phones for cross-ref:",e);}

      // 4. Calculate 6 intersection metrics
      var grupoSet=Object.keys(grupoPhones);
      var yagoSet=Object.keys(yagoPhones);
      var hsSet=Object.keys(hsPhones);

      var gruposYago=0,gruposHS=0,yagoHS=0,allThree=0;
      // Build lookup sets for speed
      var yagoLookup=yagoPhones;var hsLookup=hsPhones;var grupoLookup=grupoPhones;

      for(var gi2=0;gi2<grupoSet.length;gi2++){
        var p=grupoSet[gi2];
        var inYago=!!yagoLookup[p];var inHS=!!hsLookup[p];
        if(inYago)gruposYago++;
        if(inHS)gruposHS++;
        if(inYago&&inHS)allThree++;
      }
      for(var yi=0;yi<yagoSet.length;yi++){
        if(hsLookup[yagoSet[yi]])yagoHS++;
      }

      setCrmCrossRef({
        grupoTotal:grupoSet.length,yagoTotal:yagoSet.length,hsTotal:hsSet.length,
        gruposYago:gruposYago,gruposHS:gruposHS,yagoHS:yagoHS,allThree:allThree
      });
    }catch(e){setCrmError(e.message);}
    finally{setCrmCrossLoading(false);}
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
    <link href="https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@400;600;700;800;900&family=JetBrains+Mono:wght@400;700;800&display=swap" rel="stylesheet"/>
    <div style={{textAlign:"center"}}>
      <div style={{width:40,height:40,border:"3px solid "+C.border,borderTopColor:C.accent,borderRadius:"50%",animation:"spin 0.8s linear infinite",margin:"0 auto 16px"}}/>
      <div style={{fontSize:18,fontWeight:700,color:C.text,marginBottom:4}}>Cargando datos</div>
      <div style={{fontSize:14,color:C.muted}}>Conectando con Metabase...</div>
    </div>
  </div>);

  if(loadError) return (<div style={{background:C.bg,minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:font}}>
    <link href="https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@400;600;700;800;900&family=JetBrains+Mono:wght@400;700;800&display=swap" rel="stylesheet"/>
    <div style={{textAlign:"center",maxWidth:500}}>
      <div style={{width:48,height:48,borderRadius:"50%",background:"#FEF2F2",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px"}}><span style={{fontSize:24,color:C.red}}>!</span></div>
      <div style={{fontSize:18,fontWeight:700,color:C.text,marginBottom:6}}>Error al cargar datos</div>
      <div style={{fontSize:14,color:C.muted,lineHeight:1.6,marginBottom:16}}>{loadError}</div>
      <button onClick={function(){setLoadError(null);setDbLoading(true);fetchThreadsFromPostHog(stepFilter).then(function(threads){var csvRows=expandThreadMessages(threads);setRawRows(csvRows);var result=processCSVRows(csvRows,templateConfig,regionFilter);applyResult(result);setDbLoading(false);}).catch(function(e){setLoadError(e.message||"Error");setDbLoading(false);});}} style={{background:C.accent,color:"#fff",border:"none",borderRadius:10,padding:"10px 24px",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:font}}>Reintentar</button>
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

    <div style={{background:"linear-gradient(135deg, #FFF 0%, #F8FAFF 100%)",borderBottom:"1px solid "+C.border,padding:"16px 28px",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:12}}>
      <div style={{display:"flex",alignItems:"center",gap:14}}>
        <h1 style={{margin:0,fontSize:22,fontWeight:900}}><span style={{background:"linear-gradient(135deg, #2563EB, #7C3AED)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>YAGO</span> <span style={{color:C.muted,fontWeight:400}}>SDR</span></h1>
        <div style={{width:1,height:24,background:C.border}}/>
        <span style={{fontSize:13,color:C.muted,background:"#F3F4F6",padding:"4px 10px",borderRadius:6,fontWeight:600}}>{headerInfo.dateRange} {"\u00B7"} {tc} leads</span>
      </div>
      <div style={{display:"flex",gap:2,background:"#F3F4F6",borderRadius:10,padding:3,boxShadow:"inset 0 1px 2px #00000008"}}>
        {[{id:"overview",l:"Resumen"},{id:"engagement",l:"Engagement"},{id:"templates",l:"Templates",ib:true},{id:"benchmarks",l:"Benchmarks",ib:true},{id:"grupos",l:"Grupos"},{id:"crm",l:"CRM"},{id:"lookup",l:"Buscar"},{id:"config",l:"Config",ib:true}].map(function(t){
          var disabled=t.ib&&panel==="inbound";
          var active=tab===t.id&&!disabled;
          return <button key={t.id} onClick={disabled?undefined:function(){setTab(t.id);}} style={{background:active?C.card:"transparent",color:disabled?C.border:active?C.text:C.muted,border:"none",borderRadius:8,padding:"7px 14px",fontSize:13,fontWeight:700,cursor:disabled?"default":"pointer",fontFamily:font,boxShadow:active?"0 1px 3px #0000000f":"none"}}>{t.l}</button>;
        })}
      </div>
    </div>

    <div style={{background:C.card,borderBottom:"1px solid "+C.border,padding:"10px 28px",display:"flex",alignItems:"center",gap:16,flexWrap:"wrap"}}>
      <div style={{display:"flex",background:"#F3F4F6",borderRadius:10,padding:3,gap:2,boxShadow:"inset 0 1px 2px #00000008"}}>
        {[{id:"outbound",l:"Outbound",c:C.accent},{id:"inbound",l:"Inbound",c:"#7C3AED"}].map(function(p){var a=panel===p.id;return <button key={p.id} onClick={function(){switchPanel(p.id);}} style={{background:a?p.c:"transparent",color:a?"#fff":C.muted,border:"none",borderRadius:8,padding:"6px 14px",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:font}}>{p.l}</button>;})}
      </div>
      {panel==="outbound" && <div style={{display:"flex",background:"#F3F4F6",borderRadius:10,padding:3,gap:2,boxShadow:"inset 0 1px 2px #00000008"}}>
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
      {inboundLoading && <div style={{background:C.lPurple,border:"1px solid "+C.purple+"25",borderRadius:12,padding:"12px 18px",marginBottom:20,display:"flex",gap:12,alignItems:"center"}}><div style={{width:20,height:20,border:"2px solid "+C.purple+"33",borderTopColor:C.purple,borderRadius:"50%",animation:"spin 0.8s linear infinite",flexShrink:0}}/><div><strong style={{color:C.purple}}>Cargando datos inbound...</strong></div></div>}

      {tab==="overview" && (function(){var cd=null;var isInb=panel==="inbound";var ix=inboundExtra; return (<>
        {isInb && ix ? (<>
          {/* Inbound: 3 KPI cards */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(200px, 1fr))",gap:14,marginBottom:22}}>
            <Cd onClick={function(){setShowA(true);}} style={{cursor:"pointer",border:"2px solid "+C.purple+"44",position:"relative",overflow:"hidden"}}>
              <div style={{position:"absolute",top:-8,right:-8,fontSize:48,opacity:0.04}}>{"\u{1F4AC}"}</div>
              <div style={{display:"flex",alignItems:"center",gap:6}}><div style={{width:32,height:32,borderRadius:10,background:C.purple+"15",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>{"\u{1F4AC}"}</div><span style={{fontSize:13,color:C.muted,fontWeight:600}}>Leads Inbound</span><InfoTip data={TIPS.contactados}/></div>
              <div style={{fontSize:36,fontWeight:900,fontFamily:mono,marginTop:6,lineHeight:1}}>{ix.uniqueLeadCount}</div>
              <div style={{fontSize:13,color:C.muted,marginTop:4}}>{lpd}/d{"\u00ED"}a {"\u00B7"} {tc} conversaciones</div>
              <div style={{fontSize:11,color:C.purple,fontWeight:700,marginTop:6}}>{"\u{1F4AC} Ver conversaciones \u2192"}</div>
            </Cd>
            <Cd style={{position:"relative",overflow:"hidden"}}>
              <div style={{position:"absolute",top:-8,right:-8,fontSize:48,opacity:0.04}}>{"\u{1F4CA}"}</div>
              <div style={{display:"flex",alignItems:"center",gap:6}}><div style={{width:32,height:32,borderRadius:10,background:C.accent+"15",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>{"\u{1F4CA}"}</div><span style={{fontSize:13,color:C.muted,fontWeight:600}}>Engagement</span><InfoTip data={TIPS.engagementDistribucion}/></div>
              <div style={{fontSize:36,fontWeight:900,fontFamily:mono,color:C.accent,marginTop:6,lineHeight:1}}>{d.resp>0?((ix.engagedTotal/d.resp)*100).toFixed(1):"0"}%</div>
              <div style={{fontSize:13,color:C.muted,marginTop:4}}>{ix.engagedTotal} con 2+ msgs</div>
              <div style={{fontSize:12,fontWeight:600,marginTop:6,borderTop:"1px solid "+C.border,paddingTop:6}}><span style={{color:C.red}}>{ix.depthCounts.rebote} rebotes</span> {"\u00B7"} <span style={{color:C.accent}}>{ix.avgDepth} msgs/conv</span></div>
            </Cd>
            <Cd style={{position:"relative",overflow:"hidden"}}>
              <div style={{position:"absolute",top:-8,right:-8,fontSize:48,opacity:0.04}}>{"\u2705"}</div>
              <div style={{display:"flex",alignItems:"center",gap:6}}><div style={{width:32,height:32,borderRadius:10,background:C.green+"15",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>{"\u2705"}</div><span style={{fontSize:13,color:C.muted,fontWeight:600}}>Conversi{"\u00F3"}n Signup</span><InfoTip data={TIPS.conversionSignup}/></div>
              <div style={{fontSize:36,fontWeight:900,fontFamily:mono,color:C.green,marginTop:6,lineHeight:1}}>{ix.signupLinkCount}</div>
              <div style={{fontSize:13,color:C.muted,marginTop:4}}>recibieron link crear cuenta</div>
              <div style={{fontSize:12,color:C.green,fontWeight:600,marginTop:6,borderTop:"1px solid "+C.border,paddingTop:6}}>{ix.signupCount} recibieron Step 1 ({ix.uniqueLeadCount>0?((ix.signupCount/ix.uniqueLeadCount)*100).toFixed(1):"0"}%)</div>
            </Cd>
          </div>

          {/* Inbound: Funnel */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:22}}>
            <Cd><Sec tipKey="funnel">Embudo de Conversi&oacute;n</Sec>
              {funnel.map(function(f,i){var base=funnel[0].v||1;var w=Math.max((f.v/base)*100,3);var prev=i>0?((f.v/(funnel[i-1].v||1))*100).toFixed(0):null;
                return (<div key={i} style={{marginBottom:10}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}><span style={{fontSize:14,color:C.sub,fontWeight:500}}><span style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:20,height:20,borderRadius:6,background:f.c+"18",color:f.c,fontSize:11,fontWeight:800,marginRight:6}}>{i+1}</span>{f.n}</span><div><span style={{fontSize:17,fontWeight:800,fontFamily:mono}}>{f.v}</span><span style={{fontSize:13,color:C.muted,marginLeft:6}}>{(f.v/base*100).toFixed(1)}%</span>{prev && <span style={{fontSize:12,color:parseFloat(prev)>=50?C.green:parseFloat(prev)>=20?C.yellow:C.red,marginLeft:6}}>({prev}%{"\u2193"})</span>}</div></div><div style={{height:24,background:"#F3F4F6",borderRadius:6,overflow:"hidden"}}><div style={{height:"100%",width:w+"%",background:"linear-gradient(90deg, "+f.c+" 0%, "+f.c+"CC 100%)",borderRadius:6,transition:"width 0.5s ease"}}/></div></div>);})}
            </Cd>

            {/* Topics ranking */}
            <Cd><Sec tipKey="temasAbordados">{"\u00BF"}Qu{"\u00E9"} buscan?</Sec>
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
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(200px, 1fr))",gap:12,marginBottom:22}}>
            {[{l:"Contactados",v:String(tc),s:lpd+"/d\u00EDa",cv:cd?String(cd.resp!==undefined?cd.totalContactados:""):null,ic:"\u{1F4E9}",icC:C.accent,tip:"contactados"},{l:"Respuesta",v:d.rate,s:d.resp+" leads",b:45,ck:2,cv:cd?cd.rate:null,ic:"\u{1F4CA}",icC:C.purple,tip:"respuestaRate"},{l:"Instagram",v:d.igLinkR,s:d.igLink+" leads con link",ig2:d.igAt,cv:cd?cd.igLinkR:null,ic:"\u{1F4F8}",icC:C.orange,tip:"instagram"},{l:"Config. Plataf.",v:d.tR,s:d.tool+" leads",cv:cd?cd.tR:null,ic:"\u2699\uFE0F",icC:C.cyan,tip:"configPlataforma"},{l:"Oferta Reuni\u00F3n",v:d.mR,s:d.mc+" leads",ck:1,cv:cd?cd.mR:null,ic:"\u{1F4C5}",icC:C.pink,tip:"ofertaReunion"}].map(function(k,i){
              var diff=k.b?(parseFloat(k.v)-k.b).toFixed(1):null;
              return (<Cd key={i} onClick={k.ck===1?function(){setShowM(true);}:k.ck===2?function(){setShowA(true);}:undefined} style={Object.assign({position:"relative",overflow:"hidden"},k.ck===1?{cursor:"pointer",border:"2px solid "+C.pink+"44",background:"linear-gradient(135deg, #FFF 0%, #FFF5F7 100%)"}:k.ck===2?{cursor:"pointer",border:"2px solid "+C.purple+"44",background:"linear-gradient(135deg, #FFF 0%, #F5F3FF 100%)"}:{})}>
                <div style={{position:"absolute",top:-8,right:-8,fontSize:48,opacity:0.04}}>{k.ic}</div>
                <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}>
                  <div style={{width:32,height:32,borderRadius:10,background:k.icC+"15",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>{k.ic}</div>
                  <span style={{fontSize:13,color:C.muted,fontWeight:600}}>{k.l}</span>
                  <InfoTip data={TIPS[k.tip]}/>
                </div>
                <div style={{fontSize:32,fontWeight:800,fontFamily:mono,lineHeight:1}}>{k.v}<Delta current={k.v} previous={k.cv}/></div>
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
            <Cd><Sec tipKey="funnel">Embudo de Conversi&oacute;n</Sec>
              {funnel.map(function(f,i){var w=Math.max((f.v/(tc||1))*100,4);var prev=i>0?((f.v/(funnel[i-1].v||1))*100).toFixed(0):null;
                return (<div key={i} style={{marginBottom:10}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}><span style={{fontSize:14,color:C.sub,fontWeight:500}}><span style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:20,height:20,borderRadius:6,background:f.c+"18",color:f.c,fontSize:11,fontWeight:800,marginRight:6}}>{i+1}</span>{f.n}</span><div><span style={{fontSize:17,fontWeight:800,fontFamily:mono}}>{f.v}</span><span style={{fontSize:13,color:C.muted,marginLeft:6}}>{(f.v/(tc||1)*100).toFixed(1)}%</span>{prev && <span style={{fontSize:12,color:C.red,marginLeft:6}}>({prev}%{"\u2193"})</span>}</div></div><div style={{height:24,background:"#F3F4F6",borderRadius:6,overflow:"hidden"}}><div style={{height:"100%",width:w+"%",background:"linear-gradient(90deg, "+f.c+" 0%, "+f.c+"CC 100%)",borderRadius:6,transition:"width 0.5s ease"}}/></div></div>);})}
            </Cd>
            <Cd><Sec tipKey="yagoVsMercado">Yago vs Mercado</Sec>
              {chBench.map(function(b,i){return (<div key={i} style={{marginBottom:9}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}><span style={{fontSize:14,color:b.y?C.text:C.muted,fontWeight:b.y?700:400}}>{b.ch}</span><span style={{fontSize:15,fontWeight:800,color:b.y?C.accent:C.muted,fontFamily:mono}}>{b.r}%</span></div><div style={{height:8,background:"#F3F4F6",borderRadius:4}}><div style={{height:"100%",width:(b.r/45)*100+"%",background:b.y?C.accent:C.muted,borderRadius:4,opacity:b.y?0.8:0.3}}/></div></div>);})}
            </Cd>
          </div>
        </>)}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
          <Cd><Sec tipKey="esVsPt">{"\u{1F1EA}\u{1F1F8} vs \u{1F1E7}\u{1F1F7}"}</Sec><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}><div style={{background:C.lBlue,borderRadius:12,padding:16,textAlign:"center"}}><div style={{fontSize:12,color:C.accent,fontWeight:700}}>{"\u{1F1EA}\u{1F1F8} ESPA\u00D1OL"}</div><div style={{fontSize:34,fontWeight:900,color:C.accent,fontFamily:mono}}>{headerInfo.esRate}%</div><div style={{fontSize:13,color:C.muted}}>{headerInfo.esResp} de {headerInfo.esTotal}</div></div><div style={{background:C.lGreen,borderRadius:12,padding:16,textAlign:"center"}}><div style={{fontSize:12,color:C.green,fontWeight:700}}>{"\u{1F1E7}\u{1F1F7} PORTUGU\u00C9S"}</div><div style={{fontSize:34,fontWeight:900,color:C.green,fontFamily:mono}}>{headerInfo.ptRate}%</div><div style={{fontSize:13,color:C.muted}}>{headerInfo.ptResp} de {headerInfo.ptTotal}</div></div></div></Cd>
          <Cd><Sec tipKey="leadsPorDia">Leads por D{"\u00ED"}a</Sec><ResponsiveContainer width="100%" height={160}><AreaChart data={daily} margin={{left:-15,right:5,top:5,bottom:0}}><defs><linearGradient id="ag" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.accent} stopOpacity={0.2}/><stop offset="100%" stopColor={C.accent} stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" stroke={C.border}/><XAxis dataKey="d" tick={{fontSize:12,fill:C.muted}}/><YAxis tick={{fontSize:12,fill:C.muted}}/><Tooltip contentStyle={{background:C.card,border:"1px solid "+C.border,borderRadius:8,fontSize:13}}/><Area type="monotone" dataKey="l" stroke={C.accent} fill="url(#ag)" strokeWidth={2}/></AreaChart></ResponsiveContainer></Cd>
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
              <Sec tipKey="jornadaConversionInbound">Jornada de Conversi{"\u00F3"}n Inbound</Sec>
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
                <Sec tipKey="profundidadConversacion">{"Profundidad de Conversaci\u00F3n"}</Sec>
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
                  <div style={{fontSize:11,color:C.muted,fontWeight:700,textTransform:"uppercase",letterSpacing:1,display:"flex",alignItems:"center"}}>Leads Recurrentes<InfoTip data={TIPS.leadsRecurrentes}/></div>
                  <div style={{display:"flex",alignItems:"baseline",gap:6,marginTop:4}}>
                    <span style={{fontSize:32,fontWeight:900,fontFamily:mono,color:C.accent}}>{ix.multiDayCount}</span>
                    <span style={{fontSize:14,fontWeight:700,color:C.accent}}>({d.resp>0?((ix.multiDayCount/d.resp)*100).toFixed(1):"0"}%)</span>
                  </div>
                  <div style={{fontSize:12,color:C.sub,marginTop:4}}>volvieron otro d{"\u00ED"}a</div>
                </Cd>
                <Cd style={{background:C.lGreen,border:"1px solid "+C.green+"20",flex:1}}>
                  <div style={{fontSize:40,marginBottom:6,opacity:0.8}}>{"\u{1F3AF}"}</div>
                  <div style={{fontSize:11,color:C.muted,fontWeight:700,textTransform:"uppercase",letterSpacing:1,display:"flex",alignItems:"center"}}>Con Resultado<InfoTip data={TIPS.conResultado}/></div>
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
              <Sec tipKey="outcomePorTopico">Outcomes por T{"\u00F3"}pico</Sec>
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
              <Sec tipKey="horarioRespuestas">Horario de Mensajes Inbound</Sec>
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
            {l:"Total Respuestas",v:totalResp,ic:"\u{1F4AC}",c:C.purple,sub:dataD.all.rate+" tasa",tip:"respuestaRate"},
            {l:"Tasa de Respuesta",v:d.rate,ic:"\u{1F4CA}",c:C.accent,sub:d.resp+" leads respondieron",tip:"respuestaRate"},
            {l:mode===1?"Auto-replies excl.":"Auto-replies",v:headerInfo.autoReplyCount,ic:"\u{1F916}",c:mode===1?C.green:C.red,sub:mode===1?"Excluidos del an\u00E1lisis":autoP+"% del total",tip:"autoReply"},
            {l:"Leads Reales",v:headerInfo.realesCount,ic:"\u2705",c:C.green,sub:realP+"% son humanos reales",tip:"respuestaReales"}
          ].map(function(k,i){return (
            <Cd key={i} style={{position:"relative",overflow:"hidden"}}>
              <div style={{position:"absolute",top:-8,right:-8,fontSize:48,opacity:0.06}}>{k.ic}</div>
              <div style={{fontSize:12,color:C.muted,fontWeight:700,textTransform:"uppercase",letterSpacing:1,display:"flex",alignItems:"center"}}>{k.l}{k.tip && <InfoTip data={TIPS[k.tip]}/>}</div>
              <div style={{fontSize:34,fontWeight:900,fontFamily:mono,color:k.c,marginTop:8,lineHeight:1}}>{k.v}</div>
              <div style={{fontSize:13,color:C.muted,marginTop:6}}>{k.sub}</div>
            </Cd>
          );})
          }
        </div>

        {/* Engagement Distribution */}
        <Cd style={{marginBottom:22}}>
          <Sec tipKey="engagementDistribucion">{"Distribuci\u00F3n de Engagement ("+d.resp+" leads)"}</Sec>
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
          <Sec tipKey="temasAbordados">{"Temas Abordados ("+d.resp+" leads)"}</Sec>
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
          <Sec tipKey="horarioRespuestas">Horario de Respuestas</Sec>
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

      {tab==="templates" && (function(){
        var _mk=mode===0?"all":"real";var _abD=dataD[_mk];
        var _abGrp={};var _ck=Object.keys(templateConfig);
        for(var _i=0;_i<_ck.length;_i++){var _k=_ck[_i];var _v=templateConfig[_k];if(_v&&_v.ab_group){if(!_abGrp[_v.ab_group])_abGrp[_v.ab_group]=[];_abGrp[_v.ab_group].push(_k);}}
        function _gts(name){if(!_abD||!_abD.tpl)return{sent:0,resp:0,rate:"0.0%"};for(var i=0;i<_abD.tpl.length;i++){if(_abD.tpl[i].name===name||_abD.tpl[i].key===name)return _abD.tpl[i];}return{sent:0,resp:0,rate:"0.0%"};}
        function _isH(n){var e=templateConfig[n];return e&&e.hidden;}
        function _so(n){var e=templateConfig[n];return(e&&e.sort_order)||0;}
        function _abCard(gId){
          var pair=_abGrp[gId];var stA=_gts(pair[0]);var stB=_gts(pair[1]);
          var rA=parseFloat(stA.rate)||0;var rB=parseFloat(stB.rate)||0;
          var diff=Math.abs(rA-rB).toFixed(1);var w=rA>rB?0:(rB>rA?1:-1);var mx=Math.max(rA,rB,1);
          return (<div key={gId} style={{background:"#FFF",border:"1px solid "+C.purple+"33",borderRadius:14,padding:0,overflow:"hidden"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 20px",background:C.lPurple,borderBottom:"1px solid "+C.purple+"22"}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:15,fontWeight:800,color:C.purple}}>Test A/B</span>
                {w>=0 && <span style={{fontSize:12,fontWeight:700,color:C.green,background:C.lGreen,padding:"2px 10px",borderRadius:6}}>+{diff}pp</span>}
              </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:0}}>
              {[0,1].map(function(idx){
                var st=idx===0?stA:stB;var rate=idx===0?rA:rB;var isW=w===idx;var lb=idx===0?"A":"B";
                return (<div key={idx} style={{padding:"16px 20px",borderRight:idx===0?"1px solid "+C.purple+"15":"none",position:"relative"}}>
                  {isW && <div style={{position:"absolute",top:8,right:12,background:C.green,color:"#FFF",fontSize:10,fontWeight:800,padding:"2px 8px",borderRadius:6,letterSpacing:0.5}}>GANADOR</div>}
                  <div style={{fontSize:11,fontWeight:800,color:C.purple,textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>{lb}</div>
                  <div style={{fontSize:13,fontWeight:700,fontFamily:mono,color:C.text,marginBottom:12,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{pair[idx]}</div>
                  <div style={{display:"flex",gap:16,marginBottom:10}}>
                    <div><div style={{fontSize:11,color:C.muted,fontWeight:600}}>Enviados</div><div style={{fontSize:18,fontWeight:800,color:C.text,fontFamily:mono}}>{st.sent||0}</div></div>
                    <div><div style={{fontSize:11,color:C.muted,fontWeight:600}}>Respuestas</div><div style={{fontSize:18,fontWeight:800,color:C.text,fontFamily:mono}}>{st.resp||0}</div></div>
                    <div><div style={{fontSize:11,color:C.muted,fontWeight:600}}>Tasa</div><div style={{fontSize:18,fontWeight:800,color:isW?C.green:C.text,fontFamily:mono}}>{st.rate||"0.0%"}</div></div>
                  </div>
                  <div style={{background:"#F3F4F6",borderRadius:6,height:8,overflow:"hidden"}}>
                    <div style={{height:"100%",borderRadius:6,background:isW?C.green:C.accent,width:(mx>0?(rate/mx*100):0)+"%",transition:"width 0.3s ease"}}></div>
                  </div>
                </div>);
              })}
            </div>
          </div>);
        }
        var _allAbKeys=Object.keys(_abGrp).filter(function(g){return _abGrp[g].length>=2;});
        return (<>
        {d.tplByStep ? (function(){
          var stepKeys=Object.keys(d.tplByStep).sort(function(a,b){return (d.tplByStep[a].order||99)-(d.tplByStep[b].order||99);});
          return (<>
            <Cd style={{marginBottom:18}}><Sec tipKey="cadencia">Cadencia</Sec>
              <div style={{display:"flex",alignItems:"center",gap:0}}>{stepKeys.map(function(sk,i){var sg=d.tplByStep[sk];var items=[];if(i>0)items.push(<div key={"sep"+i} style={{width:36,height:2,background:C.border,flexShrink:0}}/>);items.push(<div key={sk} style={{flex:1,background:sg.color+"08",border:"1px solid "+sg.color+"22",borderRadius:12,padding:"12px 8px",textAlign:"center"}}><div style={{fontSize:11,color:C.muted}}>{sg.day}</div><div style={{fontSize:17,fontWeight:800,color:sg.color,marginTop:4}}>{sg.label}</div><div style={{fontSize:12,color:C.muted}}>{sg.totalSent} enviados {"\u00B7"} {sg.templates.length} variante{sg.templates.length!==1?"s":""}</div></div>);return items;}).flat()}</div>
            </Cd>
            <Sec tipKey="templatePerformance">Performance por Step</Sec>
            {stepKeys.map(function(sk){var sg=d.tplByStep[sk];var visTpls=sg.templates.filter(function(t){return !_isH(t.name);}).sort(function(a,b){var sa=_so(a.name);var sb=_so(b.name);if(sa!==sb)return sa-sb;return a.name.localeCompare(b.name);});if(visTpls.length===0)return null;var rn=parseFloat(sg.totalRate);var sc=rn>=20?C.green:rn>=12?C.yellow:C.red;
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
                <div style={{display:"grid",gridTemplateColumns:visTpls.length===1?"1fr":"1fr 1fr",gap:12}}>
                  {visTpls.map(function(t,i){var trn=parseFloat(t.rate);var tsc=trn>=20?C.green:trn>=12?C.yellow:C.red;
                    var tplItem=d.tpl.find(function(x){return x.key===t.name;});
                    return (<Cd key={i} onClick={tplItem?function(){setSelTpl(tplItem);}:undefined} style={tplItem?{cursor:"pointer"}:{}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}><div><div style={{display:"flex",alignItems:"center",gap:6}}><span style={{fontWeight:800,fontSize:15}}>{t.displayName}</span><button onClick={function(e){e.stopPropagation();updateTemplateConfig(t.name,"hidden",true);}} title="Ocultar template" style={{background:"none",border:"none",fontSize:14,cursor:"pointer",padding:"2px 4px",color:C.muted,opacity:0.5,flexShrink:0}}>{"\uD83D\uDC41"}</button></div><div style={{display:"flex",gap:6,marginTop:4}}><span style={{fontSize:11,color:C.muted,background:"#F3F4F6",padding:"2px 8px",borderRadius:4}}>{sg.day}</span><span style={{fontSize:11,fontWeight:700,padding:"2px 8px",borderRadius:4,background:t.lang==="pt"?C.green+"15":C.accent+"15",color:t.lang==="pt"?C.green:C.accent}}>{t.lang==="pt"?"PT":"ES"}</span>{t.region && <span style={{fontSize:11,fontWeight:700,padding:"2px 8px",borderRadius:4,background:t.region==="br"?"#ECFDF5":"#EFF6FF",color:t.region==="br"?"#059669":"#2563EB"}}>{t.region==="br"?"BR":"LATAM"}</span>}</div></div><div style={{textAlign:"right"}}><div style={{fontSize:24,fontWeight:800,color:tsc,fontFamily:mono}}>{t.rate}</div><div style={{fontSize:12,color:C.muted}}>{t.resp} de {t.sent}</div></div></div>{tplItem && <div style={{fontSize:11,color:C.accent,fontWeight:600,marginTop:8}}>Click para ver detalles {"\u2192"}</div>}</Cd>);
                  })}
                </div>
              </div>);
            })}
          </>);
        })() : (<>
          <Cd style={{marginBottom:18}}><Sec tipKey="cadencia">Cadencia</Sec>
            <div style={{display:"flex",alignItems:"center",gap:0}}>{[{l:"MSG 1",s:"Yago SDR",d:"D+0",c:C.accent},0,{l:"MSG 2",s:"Sin WA / Caso \u00C9xito",d:"D+1",c:C.purple},0,{l:"MSG 3",s:"Value Nudge",d:"D+3",c:C.cyan},0,{l:"MSG 4",s:"Quick Audit",d:"D+5",c:C.orange}].map(function(s,i){if(!s)return <div key={i} style={{width:36,height:2,background:C.border,flexShrink:0}}/>;return(<div key={i} style={{flex:1,background:s.c+"08",border:"1px solid "+s.c+"22",borderRadius:12,padding:"12px 8px",textAlign:"center"}}><div style={{fontSize:11,color:C.muted}}>{s.d}</div><div style={{fontSize:17,fontWeight:800,color:s.c,marginTop:4}}>{s.l}</div><div style={{fontSize:12,color:C.muted}}>{s.s}</div></div>);})}</div>
          </Cd>
          <Sec tipKey="templatePerformance">Performance por Template</Sec>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:22}}>
            {d.tpl.slice().filter(function(t){return !_isH(t.key||t.name);}).sort(function(a,b){var sa=_so(a.key||a.name);var sb=_so(b.key||b.name);if(sa!==sb)return sa-sb;return(a.name||"").localeCompare(b.name||"");}).map(function(t,i){var rn=parseFloat(t.rate);var sc=rn>=20?C.green:rn>=12?C.yellow:C.red;
              return (<Cd key={i} onClick={function(){setSelTpl(t);}} style={{cursor:"pointer"}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}><div><div style={{display:"flex",alignItems:"center",gap:6}}><span style={{fontWeight:800,fontSize:16}}>{t.name}</span><button onClick={function(e){e.stopPropagation();updateTemplateConfig(t.key||t.name,"hidden",true);}} title="Ocultar template" style={{background:"none",border:"none",fontSize:14,cursor:"pointer",padding:"2px 4px",color:C.muted,opacity:0.5,flexShrink:0}}>{"\uD83D\uDC41"}</button></div><span style={{fontSize:12,color:C.muted,background:"#F3F4F6",padding:"2px 8px",borderRadius:4}}>{t.day}</span></div><div style={{textAlign:"right"}}><div style={{fontSize:28,fontWeight:800,color:sc,fontFamily:mono}}>{t.rate}</div><div style={{fontSize:13,color:C.muted}}>{t.resp} de {t.sent}</div></div></div><div style={{fontSize:11,color:C.accent,fontWeight:600,marginTop:8}}>Click para ver detalles {"\u2192"}</div></Cd>);
            })}
          </div>
        </>)}
        {_allAbKeys.length>0 && (<div style={{marginBottom:22}}>
          <Sec>Tests A/B</Sec>
          <div style={{display:"flex",flexDirection:"column",gap:16}}>
            {_allAbKeys.map(function(gId){return _abCard(gId);})}
          </div>
        </div>)}
        {d.bcast&&d.bcast.length>0&&(<div style={{marginTop:10,marginBottom:22}}><div style={{fontSize:12,fontWeight:700,color:C.muted,textTransform:"uppercase",marginBottom:8,letterSpacing:1}}>Disparos Puntuais (fora do lifecycle)</div><div style={{display:"grid",gridTemplateColumns:"1fr",gap:10}}>{d.bcast.map(function(t,i){var rn=parseFloat(t.rate);var sc=rn>=20?C.green:rn>=12?C.yellow:C.red;return(<Cd key={i} onClick={function(){setSelTpl(t);}} style={{background:"#FEFCE8",border:"1px dashed "+C.yellow+"55",cursor:"pointer"}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><div><div style={{fontWeight:800,fontSize:16}}>{t.name}</div><span style={{fontSize:12,color:C.muted,background:"#FEF9C3",padding:"2px 8px",borderRadius:4}}>Broadcast</span></div><div style={{textAlign:"right"}}><div style={{fontSize:28,fontWeight:800,color:sc,fontFamily:mono}}>{t.rate}</div><div style={{fontSize:13,color:C.muted}}>{t.resp+" de "+t.sent}</div></div></div><div style={{fontSize:11,color:C.yellow,fontWeight:600,marginTop:8}}>Click para ver detalles {"\u2192"}</div></Cd>);})}</div></div>)}
        <Cd style={{marginBottom:18,background:C.lPurple,border:"1px solid "+C.purple+"20"}}>
          <Sec tipKey="meetByTemplate">{"\u{1F4C5} \u00BFEn qu\u00E9 template respondieron los que llegaron a reuni\u00F3n?"}</Sec>
          <div style={{fontSize:14,color:C.sub,marginBottom:14}}>De {d.mc} leads, este fue el <strong>template donde respondieron por primera vez</strong>:</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat("+Math.min(mbt.length,6)+",1fr)",gap:10}}>
            {mbt.map(function(m,i){return (<div key={i} style={{textAlign:"center",padding:"12px 8px",background:C.card,borderRadius:10,border:m.v?"2px solid "+m.c+"33":"1px solid "+C.border}}><div style={{fontSize:13,fontWeight:700,color:m.v?m.c:C.muted}}>{m.l}</div><div style={{fontSize:30,fontWeight:900,fontFamily:mono,color:m.v?m.c:C.muted,marginTop:4}}>{m.v}</div></div>);})}
          </div>
        </Cd>
        <div onClick={function(){setShowM(true);}} style={{background:C.card,border:"2px solid "+C.pink+"44",borderRadius:14,padding:"16px 20px",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"space-between"}} onMouseEnter={function(e){e.currentTarget.style.borderColor=C.pink;}} onMouseLeave={function(e){e.currentTarget.style.borderColor=C.pink+"44";}}>
          <div style={{display:"flex",alignItems:"center",gap:12}}><span style={{fontSize:28}}>{"\u{1F4C5}"}</span><div><div style={{fontSize:16,fontWeight:800,color:C.pink}}>{"Ver los "+d.mc+" leads con oferta de reuni\u00F3n"}</div><div style={{fontSize:13,color:C.muted}}>Click para ver contactos y conversaciones completas</div></div></div>
          <div style={{fontSize:22,color:C.pink}}>{"\u2192"}</div>
        </div>
      </>);})()}

      {tab==="benchmarks" && (<>
        <Cd style={{marginBottom:22,overflowX:"auto"}}><Sec tipKey="benchmarkComparacion">{"Comparaci\u00F3n vs Benchmarks (Warm Leads)"}</Sec>
          <div style={{fontSize:13,color:C.muted,marginBottom:14}}>{"Leads que se registraron en la plataforma = warm/opt-in. Benchmarks: Twilio, Meta, Respond.io, ChatArchitect (2024-2025)."}</div>
          <table style={{width:"100%",borderCollapse:"separate",borderSpacing:"0 4px",fontSize:14}}><thead><tr>{["M\u00E9trica","Yago","Benchmark","\u0394",""].map(function(h,i){return <th key={i} style={{padding:"10px 14px",textAlign:"left",color:C.muted,fontWeight:700,fontSize:12,textTransform:"uppercase",borderBottom:"2px solid "+C.border}}>{h}</th>;})}</tr></thead>
          <tbody>{bTable.map(function(r,i){return(<tr key={i} style={{background:i%2===0?"#F9FAFB":"transparent"}}><td style={{padding:"12px 14px",fontWeight:600,borderRadius:"8px 0 0 8px"}}>{r.m}</td><td style={{padding:"12px 14px",fontWeight:800,fontFamily:mono,fontSize:15}}>{r.y}</td><td style={{padding:"12px 14px",color:C.muted}}>{r.b}</td><td style={{padding:"12px 14px",fontWeight:700,fontFamily:mono,color:r.s?C.green:C.red}}>{r.d}</td><td style={{padding:"12px 14px",borderRadius:"0 8px 8px 0"}}><Bd color={r.s?C.green:C.red}>{r.s?"\u2713 ARRIBA":"\u2717 ABAJO"}</Bd></td></tr>);})}</tbody></table>
        </Cd>
        <Cd><div style={{fontSize:18,fontWeight:900,marginBottom:18,display:"flex",alignItems:"center"}}>{"\u{1F4CB} Veredicto"}<InfoTip data={TIPS.veredicto}/></div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:20}}>
          {[{t:"\u2713 FORTALEZAS",c:C.green,i:["Resp. <6 min \u2014 2.5x mejor que benchmark","75% engagement medio o alto","28 msgs/conv \u2014 conversaciones profundas","Cada template captura leads nuevos"]},{t:"\u2717 GAPS",c:C.red,i:["23.6% real vs 40-60% warm benchmark","24.6% auto-replies inflando m\u00E9tricas","Caso \u00C9xito solo 4% de la base","Solo 3% llega a reuni\u00F3n (bench: 20-30%)"]},{t:"\u2192 ACCIONES",c:C.yellow,i:["Filtrar auto-replies","Escalar Caso de \u00C9xito","Mover CTA reuni\u00F3n a MSG 3","Enviar 14-18h"]}].map(function(col,i){return(<div key={i}><div style={{fontSize:14,color:col.c,fontWeight:800,marginBottom:10}}>{col.t}</div>{col.i.map(function(item,j){return <div key={j} style={{fontSize:14,color:C.sub,lineHeight:2,paddingLeft:12,borderLeft:"3px solid "+col.c+"33"}}>{item}</div>;})}</div>);})}
        </div></Cd>
      </>)}

      {tab==="grupos" && (<>
        {/* Selector + Filtros */}
        <Cd style={{marginBottom:22}}>
          <Sec>Grupos WhatsApp — MeuGrupoVip</Sec>
          <div style={{display:"flex",gap:12,alignItems:"center",flexWrap:"wrap"}}>
            <select value={gruposSelectedCampaign||""} onChange={function(e){var v=e.target.value;setGruposSelectedCampaign(v);loadGruposData(v,gruposDateFrom,gruposDateTo);}} style={{fontSize:13,fontWeight:600,padding:"8px 12px",borderRadius:10,border:"1px solid "+C.border,background:"#F9FAFB",color:C.text,fontFamily:font,cursor:"pointer",minWidth:200}}>
              {gruposCampaigns.map(function(c){var cid=c.campaign_id||c.id;return <option key={cid} value={cid}>{c.name||c.title||("Campa\u00F1a "+cid)}</option>;})}
            </select>
            <input type="date" value={gruposDateFrom} onChange={function(e){setGruposDateFrom(e.target.value);}} style={{fontSize:13,padding:"8px 10px",borderRadius:10,border:"1px solid "+C.border,background:"#F9FAFB",fontFamily:font}}/>
            <span style={{color:C.muted,fontSize:13}}>a</span>
            <input type="date" value={gruposDateTo} onChange={function(e){setGruposDateTo(e.target.value);}} style={{fontSize:13,padding:"8px 10px",borderRadius:10,border:"1px solid "+C.border,background:"#F9FAFB",fontFamily:font}}/>
            <button onClick={function(){if(gruposSelectedCampaign)loadGruposData(gruposSelectedCampaign,gruposDateFrom,gruposDateTo);}} style={{background:C.accent,color:"#fff",border:"none",borderRadius:10,padding:"8px 18px",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:font}}>Filtrar</button>
            <button onClick={function(){if(gruposSelectedCampaign)loadGruposCrossReference(gruposSelectedCampaign,gruposDateFrom,gruposDateTo);}} style={{background:C.purple,color:"#fff",border:"none",borderRadius:10,padding:"8px 18px",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:font}}>Cruzar con Yago</button>
          </div>
          {gruposError && <div style={{color:C.red,fontSize:13,marginTop:10,fontWeight:600}}>Error: {gruposError}</div>}
        </Cd>

        {gruposLoading && <div style={{textAlign:"center",padding:40,color:C.muted,fontSize:15}}>Cargando datos de grupos...</div>}

        {!gruposLoading && gruposSelectedCampaign && (<>
          {/* KPI Cards */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:16,marginBottom:22}}>
            <Cd>
              <div style={{fontSize:12,color:C.muted,fontWeight:700,textTransform:"uppercase",letterSpacing:1}}>Grupos</div>
              <div style={{fontSize:28,fontWeight:900,color:C.accent,fontFamily:mono,marginTop:6}}>{gruposGroups.length}</div>
              <div style={{fontSize:12,color:C.muted,marginTop:2}}>total activos</div>
            </Cd>
            <Cd>
              <div style={{fontSize:12,color:C.muted,fontWeight:700,textTransform:"uppercase",letterSpacing:1}}>Miembros Totales</div>
              <div style={{fontSize:28,fontWeight:900,color:C.green,fontFamily:mono,marginTop:6}}>{gruposGroups.reduce(function(s,g){return s+(g.active_members||0);},0).toLocaleString()}</div>
              <div style={{fontSize:12,color:C.muted,marginTop:2}}>l&iacute;mite: {gruposGroups.reduce(function(s,g){return s+(g.limit||0);},0).toLocaleString()}</div>
            </Cd>
            <Cd>
              <div style={{fontSize:12,color:C.muted,fontWeight:700,textTransform:"uppercase",letterSpacing:1}}>Entradas</div>
              <div style={{fontSize:28,fontWeight:900,color:C.green,fontFamily:mono,marginTop:6}}>{gruposEntryLeads.length.toLocaleString()}</div>
              <div style={{fontSize:12,color:C.muted,marginTop:2}}>en el per&iacute;odo</div>
            </Cd>
            <Cd>
              <div style={{fontSize:12,color:C.muted,fontWeight:700,textTransform:"uppercase",letterSpacing:1}}>Salidas</div>
              <div style={{fontSize:28,fontWeight:900,color:C.red,fontFamily:mono,marginTop:6}}>{gruposExitLeads.length.toLocaleString()}</div>
              <div style={{fontSize:12,color:gruposEntryLeads.length-gruposExitLeads.length>=0?C.green:C.red,marginTop:2,fontWeight:700}}>Net: {gruposEntryLeads.length-gruposExitLeads.length>=0?"+":""}{gruposEntryLeads.length-gruposExitLeads.length}</div>
            </Cd>
          </div>

          {/* Daily Chart */}
          {gruposDailyData.length>0 && (
            <Cd style={{marginBottom:22}}>
              <Sec>Entradas / Salidas Diarias</Sec>
              <div style={{height:280}}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={gruposDailyData} margin={{top:10,right:20,left:0,bottom:0}}>
                    <CartesianGrid strokeDasharray="3 3" stroke={C.border}/>
                    <XAxis dataKey="d" tick={{fontSize:11,fill:C.muted}} tickFormatter={function(v){return v.slice(5);}}/>
                    <YAxis tick={{fontSize:11,fill:C.muted}}/>
                    <Tooltip contentStyle={{borderRadius:10,border:"1px solid "+C.border,fontSize:13}}/>
                    <Area type="monotone" dataKey="entries" name="Entradas" stroke={C.green} fill={C.green+"33"} strokeWidth={2}/>
                    <Area type="monotone" dataKey="exits" name="Salidas" stroke={C.red} fill={C.red+"33"} strokeWidth={2}/>
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Cd>
          )}

          {/* Groups Cards */}
          {gruposGroups.length>0 && (
            <Cd style={{marginBottom:22}}>
              <Sec>Detalle por Grupo</Sec>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))",gap:16}}>
                {gruposGroups.map(function(g,idx){
                  var activeM=g.active_members||0;
                  var maxM=g.limit||0;
                  var occ=maxM>0?(activeM/maxM*100):0;
                  var retRate=g.retention_rate!=null?(typeof g.retention_rate==="number"?g.retention_rate.toFixed(1):g.retention_rate):"—";
                  var exitRate=g.exit_rate!=null?(typeof g.exit_rate==="number"?g.exit_rate.toFixed(1):g.exit_rate):"—";
                  var occRate=g.occupancy_rate!=null?(typeof g.occupancy_rate==="number"?g.occupancy_rate.toFixed(1):g.occupancy_rate):occ.toFixed(1);
                  var entries=g.total_entries||0;
                  var exits=g.total_exits||0;
                  var available=g.available_slots||(maxM>0?(maxM-activeM):0);
                  return (<Cd key={g.group_id||idx} style={{padding:16}}>
                    <div style={{fontSize:15,fontWeight:800,color:C.text,marginBottom:8,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{g.name||("Grupo "+(idx+1))}</div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,fontSize:12,color:C.sub,marginBottom:10}}>
                      <div>Miembros: <strong style={{color:C.text}}>{activeM}</strong>{maxM>0&&<span>/{maxM}</span>}</div>
                      <div>Retenci&oacute;n: <strong style={{color:C.green}}>{retRate}%</strong></div>
                      <div>Tasa Salida: <strong style={{color:C.red}}>{exitRate}%</strong></div>
                      <div>Ocupaci&oacute;n: <strong style={{color:C.accent}}>{occRate}%</strong></div>
                    </div>
                    {/* Occupancy bar */}
                    <div style={{background:"#F3F4F6",borderRadius:6,height:8,overflow:"hidden",marginBottom:8}}>
                      <div style={{background:occ>90?C.red:occ>70?C.yellow:C.green,height:"100%",width:Math.min(occ,100)+"%",borderRadius:6,transition:"width 0.3s"}}/>
                    </div>
                    <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:C.muted}}>
                      <span style={{color:C.green,fontWeight:700}}>+{entries} entradas</span>
                      <span style={{color:C.red,fontWeight:700}}>-{exits} salidas</span>
                      <span>{available} vagas</span>
                    </div>
                  </Cd>);
                })}
              </div>
            </Cd>
          )}

          {/* Cross-reference panel */}
          {gruposCrossRef && (
            <Cd style={{marginBottom:22}}>
              <Sec>Cruce Grupos &times; Yago</Sec>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:16,marginBottom:16}}>
                <Cd style={{textAlign:"center",background:C.lBlue}}>
                  <div style={{fontSize:12,color:C.muted,fontWeight:700,textTransform:"uppercase",letterSpacing:1}}>En Grupos</div>
                  <div style={{fontSize:28,fontWeight:900,color:C.accent,fontFamily:mono,marginTop:6}}>{gruposCrossRef.grupoTotal.toLocaleString()}</div>
                  <div style={{fontSize:12,color:C.muted}}>tel&eacute;fonos &uacute;nicos</div>
                </Cd>
                <Cd style={{textAlign:"center",background:C.lPurple}}>
                  <div style={{fontSize:12,color:C.muted,fontWeight:700,textTransform:"uppercase",letterSpacing:1}}>Conversaron c/ Yago</div>
                  <div style={{fontSize:28,fontWeight:900,color:C.purple,fontFamily:mono,marginTop:6}}>{gruposCrossRef.overlap.toLocaleString()}</div>
                  <div style={{fontSize:12,color:C.muted}}>en ambos conjuntos</div>
                </Cd>
                <Cd style={{textAlign:"center",background:C.lGreen}}>
                  <div style={{fontSize:12,color:C.muted,fontWeight:700,textTransform:"uppercase",letterSpacing:1}}>Tasa Overlap</div>
                  <div style={{fontSize:28,fontWeight:900,color:C.green,fontFamily:mono,marginTop:6}}>{gruposCrossRef.rate}%</div>
                  <div style={{fontSize:12,color:C.muted}}>de los miembros del grupo</div>
                </Cd>
              </div>
              {/* Progress bar */}
              <div style={{position:"relative",background:"#F3F4F6",borderRadius:10,height:24,overflow:"hidden"}}>
                <div style={{background:"linear-gradient(90deg, "+C.accent+", "+C.purple+")",height:"100%",width:gruposCrossRef.rate+"%",borderRadius:10,transition:"width 0.5s ease"}}/>
                <div style={{position:"absolute",top:0,left:0,right:0,bottom:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:800,color:Number(gruposCrossRef.rate)>50?"#fff":C.text}}>{gruposCrossRef.overlap} / {gruposCrossRef.grupoTotal} miembros tambi&eacute;n hablaron con Yago</div>
              </div>
            </Cd>
          )}
        </>)}
      </>)}

      {tab==="crm" && (function(){
        // Build pipeline stage map
        var stageMap={};
        if(crmPipelines&&crmPipelines.results){
          for(var pi=0;pi<crmPipelines.results.length;pi++){
            var pl=crmPipelines.results[pi];
            if(pl.stages){
              for(var si=0;si<pl.stages.length;si++){
                stageMap[pl.stages[si].id]=pl.stages[si].label;
              }
            }
          }
        }

        // Meeting stats
        var meetOutcomes={};
        for(var mi=0;mi<crmMeetings.length;mi++){
          var mo=crmMeetings[mi].properties&&crmMeetings[mi].properties.hs_meeting_outcome||"UNKNOWN";
          if(!meetOutcomes[mo])meetOutcomes[mo]=0;
          meetOutcomes[mo]++;
        }

        // Deal pipeline stats
        var dealsByStage={};var totalPipelineValue=0;
        for(var di=0;di<crmDeals.length;di++){
          var ds=crmDeals[di].properties&&crmDeals[di].properties.dealstage||"unknown";
          var amt=parseFloat(crmDeals[di].properties&&crmDeals[di].properties.amount)||0;
          if(!dealsByStage[ds])dealsByStage[ds]={count:0,value:0,label:stageMap[ds]||ds};
          dealsByStage[ds].count++;
          dealsByStage[ds].value+=amt;
          totalPipelineValue+=amt;
        }
        var pipelineData=Object.keys(dealsByStage).map(function(k){return{stage:dealsByStage[k].label,count:dealsByStage[k].count,value:dealsByStage[k].value};});

        // Recent meetings sorted by date
        var sortedMeetings=crmMeetings.slice().sort(function(a,b){
          var da=a.properties&&a.properties.hs_meeting_start_time||"";
          var db=b.properties&&b.properties.hs_meeting_start_time||"";
          return da>db?-1:da<db?1:0;
        }).slice(0,20);

        var outcomeColor={COMPLETED:C.green,SCHEDULED:C.accent,NO_SHOW:C.red,CANCELED:C.yellow,RESCHEDULED:C.orange,UNKNOWN:C.muted};

        return (<>
          {crmLoading && <div style={{textAlign:"center",padding:40,color:C.muted,fontSize:15}}><div style={{width:30,height:30,border:"3px solid "+C.border,borderTopColor:C.accent,borderRadius:"50%",animation:"spin 0.8s linear infinite",margin:"0 auto 12px"}}/>Cargando datos de HubSpot...</div>}
          {crmError && <div style={{color:C.red,fontSize:13,fontWeight:600,marginBottom:16,background:"#FEF2F2",padding:"12px 18px",borderRadius:10,border:"1px solid #FECACA"}}>Error: {crmError} <button onClick={function(){setCrmError(null);setCrmInited(false);}} style={{marginLeft:12,background:C.accent,color:"#fff",border:"none",borderRadius:6,padding:"4px 12px",fontSize:12,fontWeight:700,cursor:"pointer"}}>Reintentar</button></div>}

          {!crmLoading && crmInited && (<>
            {/* KPI Cards */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:16,marginBottom:22}}>
              <Cd>
                <div style={{fontSize:12,color:C.muted,fontWeight:700,textTransform:"uppercase",letterSpacing:1}}>Contactos HubSpot</div>
                <div style={{fontSize:28,fontWeight:900,color:C.accent,fontFamily:mono,marginTop:6}}>{crmContacts.length.toLocaleString()}</div>
                <div style={{fontSize:12,color:C.muted,marginTop:2}}>total en CRM</div>
              </Cd>
              <Cd>
                <div style={{fontSize:12,color:C.muted,fontWeight:700,textTransform:"uppercase",letterSpacing:1}}>Reuniones</div>
                <div style={{fontSize:28,fontWeight:900,color:C.green,fontFamily:mono,marginTop:6}}>{crmMeetings.length.toLocaleString()}</div>
                <div style={{fontSize:12,color:C.muted,marginTop:2}}>{meetOutcomes.COMPLETED||0} completadas {"\u00B7"} {meetOutcomes.SCHEDULED||0} agendadas</div>
              </Cd>
              <Cd>
                <div style={{fontSize:12,color:C.muted,fontWeight:700,textTransform:"uppercase",letterSpacing:1}}>Deals</div>
                <div style={{fontSize:28,fontWeight:900,color:C.purple,fontFamily:mono,marginTop:6}}>{crmDeals.length.toLocaleString()}</div>
                <div style={{fontSize:12,color:C.muted,marginTop:2}}>{pipelineData.length} stages activos</div>
              </Cd>
              <Cd>
                <div style={{fontSize:12,color:C.muted,fontWeight:700,textTransform:"uppercase",letterSpacing:1}}>Valor Pipeline</div>
                <div style={{fontSize:28,fontWeight:900,color:C.green,fontFamily:mono,marginTop:6}}>${totalPipelineValue.toLocaleString()}</div>
                <div style={{fontSize:12,color:C.muted,marginTop:2}}>valor total de deals</div>
              </Cd>
            </div>

            {/* Reuniones Recientes */}
            {sortedMeetings.length>0 && (
              <Cd style={{marginBottom:22}}>
                <Sec>Reuniones Recientes</Sec>
                <div style={{overflowX:"auto"}}>
                  <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
                    <thead>
                      <tr style={{borderBottom:"2px solid "+C.border}}>
                        <th style={{textAlign:"left",padding:"8px 12px",color:C.muted,fontWeight:700,fontSize:11,textTransform:"uppercase",letterSpacing:1}}>T&iacute;tulo</th>
                        <th style={{textAlign:"left",padding:"8px 12px",color:C.muted,fontWeight:700,fontSize:11,textTransform:"uppercase",letterSpacing:1}}>Fecha</th>
                        <th style={{textAlign:"left",padding:"8px 12px",color:C.muted,fontWeight:700,fontSize:11,textTransform:"uppercase",letterSpacing:1}}>Resultado</th>
                        <th style={{textAlign:"right",padding:"8px 12px",color:C.muted,fontWeight:700,fontSize:11,textTransform:"uppercase",letterSpacing:1}}>Duraci&oacute;n</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedMeetings.map(function(m,idx){
                        var props=m.properties||{};
                        var title=props.hs_meeting_title||"Sin t\u00EDtulo";
                        var start=props.hs_meeting_start_time?new Date(props.hs_meeting_start_time):null;
                        var end=props.hs_meeting_end_time?new Date(props.hs_meeting_end_time):null;
                        var outcome=props.hs_meeting_outcome||"UNKNOWN";
                        var dur=start&&end?Math.round((end-start)/60000):null;
                        var oc=outcomeColor[outcome]||C.muted;
                        return (<tr key={m.id||idx} style={{borderBottom:"1px solid "+C.border+"66"}}>
                          <td style={{padding:"10px 12px",fontWeight:600}}>{title}</td>
                          <td style={{padding:"10px 12px",color:C.sub,fontFamily:mono,fontSize:12}}>{start?start.toLocaleDateString("es",{day:"2-digit",month:"short",year:"numeric"})+" "+start.toLocaleTimeString("es",{hour:"2-digit",minute:"2-digit"}):"—"}</td>
                          <td style={{padding:"10px 12px"}}><Bd color={oc}>{outcome}</Bd></td>
                          <td style={{padding:"10px 12px",textAlign:"right",fontFamily:mono,fontSize:12}}>{dur!==null?dur+" min":"—"}</td>
                        </tr>);
                      })}
                    </tbody>
                  </table>
                </div>
              </Cd>
            )}

            {/* Pipeline de Deals */}
            {pipelineData.length>0 && (
              <Cd style={{marginBottom:22}}>
                <Sec>Pipeline de Deals</Sec>
                <div style={{height:Math.max(200,pipelineData.length*50)}}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={pipelineData} layout="vertical" margin={{top:5,right:30,left:20,bottom:5}}>
                      <CartesianGrid strokeDasharray="3 3" stroke={C.border}/>
                      <XAxis type="number" tick={{fontSize:11,fill:C.muted}}/>
                      <YAxis type="category" dataKey="stage" tick={{fontSize:11,fill:C.sub}} width={120}/>
                      <Tooltip contentStyle={{borderRadius:10,border:"1px solid "+C.border,fontSize:13}} formatter={function(v,name){return name==="value"?"$"+v.toLocaleString():v;}}/>
                      <Bar dataKey="count" name="Deals" fill={C.purple} radius={[0,6,6,0]}/>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:12,marginTop:16}}>
                  {pipelineData.map(function(s,i){
                    return (<div key={i} style={{background:C.lPurple,borderRadius:10,padding:"12px 16px",border:"1px solid "+C.purple+"18"}}>
                      <div style={{fontSize:11,color:C.muted,fontWeight:700,textTransform:"uppercase",letterSpacing:0.5}}>{s.stage}</div>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginTop:4}}>
                        <span style={{fontSize:22,fontWeight:800,fontFamily:mono,color:C.purple}}>{s.count}</span>
                        <span style={{fontSize:14,fontWeight:700,color:C.green,fontFamily:mono}}>${s.value.toLocaleString()}</span>
                      </div>
                    </div>);
                  })}
                </div>
              </Cd>
            )}

            {/* Outcome de Reuniones */}
            {Object.keys(meetOutcomes).length>0 && (
              <Cd style={{marginBottom:22}}>
                <Sec>Outcome de Reuniones</Sec>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",gap:12}}>
                  {Object.keys(meetOutcomes).map(function(o){
                    var cnt=meetOutcomes[o];
                    var pct=crmMeetings.length>0?(cnt/crmMeetings.length*100).toFixed(1):"0";
                    var oc=outcomeColor[o]||C.muted;
                    return (<div key={o} style={{background:oc+"08",borderRadius:10,padding:"14px 16px",border:"1px solid "+oc+"20",textAlign:"center"}}>
                      <div style={{fontSize:11,fontWeight:700,color:oc,textTransform:"uppercase",letterSpacing:0.5}}>{o}</div>
                      <div style={{fontSize:26,fontWeight:900,fontFamily:mono,color:oc,marginTop:4}}>{cnt}</div>
                      <div style={{fontSize:12,color:C.muted,marginTop:2}}>{pct}%</div>
                    </div>);
                  })}
                </div>
              </Cd>
            )}

            {/* Cruce 3 Canales */}
            <Cd style={{marginBottom:22}}>
              <Sec>Cruce 3 Canales</Sec>
              {!crmCrossRef && (
                <div style={{textAlign:"center",padding:20}}>
                  <button onClick={loadCrmCrossReference} disabled={crmCrossLoading} style={{background:"linear-gradient(135deg, "+C.accent+", "+C.purple+")",color:"#fff",border:"none",borderRadius:12,padding:"12px 28px",fontSize:14,fontWeight:700,cursor:crmCrossLoading?"wait":"pointer",fontFamily:font,opacity:crmCrossLoading?0.6:1}}>{crmCrossLoading?"Calculando...":"Calcular Cruce 3 Canales"}</button>
                  <div style={{fontSize:12,color:C.muted,marginTop:8}}>Cruza tel&eacute;fonos entre MeuGrupoVip, Yago y HubSpot</div>
                </div>
              )}
              {crmCrossRef && (<>
                {/* Totals row */}
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:14,marginBottom:16}}>
                  <div style={{background:C.lBlue,borderRadius:12,padding:"16px 20px",textAlign:"center"}}>
                    <div style={{fontSize:11,color:C.muted,fontWeight:700,textTransform:"uppercase",letterSpacing:1}}>En Grupos</div>
                    <div style={{fontSize:28,fontWeight:900,fontFamily:mono,color:C.accent,marginTop:4}}>{crmCrossRef.grupoTotal.toLocaleString()}</div>
                  </div>
                  <div style={{background:C.lPurple,borderRadius:12,padding:"16px 20px",textAlign:"center"}}>
                    <div style={{fontSize:11,color:C.muted,fontWeight:700,textTransform:"uppercase",letterSpacing:1}}>Hablaron con Yago</div>
                    <div style={{fontSize:28,fontWeight:900,fontFamily:mono,color:C.purple,marginTop:4}}>{crmCrossRef.yagoTotal.toLocaleString()}</div>
                  </div>
                  <div style={{background:"#FFF7ED",borderRadius:12,padding:"16px 20px",textAlign:"center"}}>
                    <div style={{fontSize:11,color:C.muted,fontWeight:700,textTransform:"uppercase",letterSpacing:1}}>En HubSpot</div>
                    <div style={{fontSize:28,fontWeight:900,fontFamily:mono,color:C.orange,marginTop:4}}>{crmCrossRef.hsTotal.toLocaleString()}</div>
                  </div>
                </div>
                {/* Pairwise row */}
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:14,marginBottom:16}}>
                  <div style={{background:"#F9FAFB",borderRadius:12,padding:"14px 16px",textAlign:"center",border:"1px solid "+C.border}}>
                    <div style={{fontSize:11,color:C.muted,fontWeight:700}}>Grupos + Yago</div>
                    <div style={{fontSize:24,fontWeight:900,fontFamily:mono,color:C.cyan,marginTop:4}}>{crmCrossRef.gruposYago}</div>
                  </div>
                  <div style={{background:"#F9FAFB",borderRadius:12,padding:"14px 16px",textAlign:"center",border:"1px solid "+C.border}}>
                    <div style={{fontSize:11,color:C.muted,fontWeight:700}}>Grupos + HubSpot</div>
                    <div style={{fontSize:24,fontWeight:900,fontFamily:mono,color:C.cyan,marginTop:4}}>{crmCrossRef.gruposHS}</div>
                  </div>
                  <div style={{background:"#F9FAFB",borderRadius:12,padding:"14px 16px",textAlign:"center",border:"1px solid "+C.border}}>
                    <div style={{fontSize:11,color:C.muted,fontWeight:700}}>Yago + HubSpot</div>
                    <div style={{fontSize:24,fontWeight:900,fontFamily:mono,color:C.cyan,marginTop:4}}>{crmCrossRef.yagoHS}</div>
                  </div>
                </div>
                {/* Highlight card: all 3 */}
                <div style={{background:"linear-gradient(135deg, "+C.accent+"12, "+C.purple+"12, "+C.green+"12)",borderRadius:14,padding:"24px 20px",textAlign:"center",border:"2px solid "+C.purple+"33"}}>
                  <div style={{fontSize:13,color:C.purple,fontWeight:800,textTransform:"uppercase",letterSpacing:1.5}}>En Los 3 Canales</div>
                  <div style={{fontSize:48,fontWeight:900,fontFamily:mono,background:"linear-gradient(135deg, "+C.accent+", "+C.purple+")",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",marginTop:8}}>{crmCrossRef.allThree}</div>
                  <div style={{fontSize:13,color:C.muted,marginTop:6}}>presentes en Grupos + Yago + HubSpot</div>
                </div>
                <div style={{marginTop:12,textAlign:"center"}}>
                  <button onClick={function(){setCrmCrossRef(null);}} style={{background:"#F3F4F6",color:C.muted,border:"none",borderRadius:8,padding:"8px 16px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:font}}>Recalcular</button>
                </div>
              </>)}
            </Cd>
          </>)}
        </>);
      })()}

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

      {tab==="config" && (function(){
        var mk=mode===0?"all":"real";var abD=dataD[mk];
        // Collect A/B groups
        var abGroups={};
        var cfgKeys=Object.keys(templateConfig);
        for(var gi=0;gi<cfgKeys.length;gi++){
          var gk=cfgKeys[gi];
          var gv=templateConfig[gk];
          if(gv&&gv.ab_group){
            if(!abGroups[gv.ab_group]) abGroups[gv.ab_group]=[];
            abGroups[gv.ab_group].push(gk);
          }
        }
        function handleAbToggle(tplName){
          if(!abSelectMode) return;
          setAbSelected(function(prev){
            if(prev.indexOf(tplName)>=0) return prev.filter(function(x){return x!==tplName;});
            if(prev.length>=2) return prev;
            var next=prev.concat([tplName]);
            if(next.length===2){
              var groupId="ab_"+Date.now();
              updateTemplateConfig(next[0],"ab_group",groupId);
              updateTemplateConfig(next[1],"ab_group",groupId);
              setTimeout(function(){setAbSelectMode(false);setAbSelected([]);},100);
            }
            return next;
          });
        }
        function removeAbGroup(groupId){
          var keys=abGroups[groupId]||[];
          for(var ri=0;ri<keys.length;ri++){
            updateTemplateConfig(keys[ri],"ab_group",null);
          }
        }
        function getTplStats(name){
          if(!abD||!abD.tpl) return {sent:0,resp:0,rate:"0.0%"};
          for(var si=0;si<abD.tpl.length;si++){
            if(abD.tpl[si].name===name||abD.tpl[si].key===name) return abD.tpl[si];
          }
          return {sent:0,resp:0,rate:"0.0%"};
        }
        return (<>
        <Cd style={{marginBottom:22}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:0}}>
            <Sec>Configuraci&oacute;n de Templates</Sec>
            {allTemplateNames.length>0 && (
              abSelectMode
                ? <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <span style={{fontSize:13,color:C.accent,fontWeight:600}}>Selecciona 2 templates para comparar</span>
                    <button onClick={function(){setAbSelectMode(false);setAbSelected([]);}} style={{background:"#F3F4F6",border:"1px solid "+C.border,borderRadius:8,padding:"6px 14px",fontSize:12,fontWeight:700,cursor:"pointer",color:C.muted,fontFamily:font}}>Cancelar</button>
                  </div>
                : <button onClick={function(){setAbSelectMode(true);setAbSelected([]);}} style={{background:C.lPurple,color:C.purple,border:"1px solid "+C.purple+"33",borderRadius:8,padding:"8px 16px",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:font,whiteSpace:"nowrap"}}>+ Crear Test A/B</button>
            )}
          </div>
          <div style={{fontSize:14,color:C.sub,marginBottom:18,lineHeight:1.6}}>Asigna cada template a una categor&iacute;a para agruparlos en la pesta&ntilde;a Templates. Templates marcados como <strong>Autom&aacute;tico</strong> o <strong>Campa&ntilde;a</strong> ser&aacute;n excluidos de los indicadores de Resumen.</div>
          {allTemplateNames.length===0 && <div style={{textAlign:"center",padding:30,color:C.muted,fontSize:14}}>No hay templates cargados a&uacute;n. Carga datos primero.</div>}
          {allTemplateNames.length>0 && (<>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {allTemplateNames.slice().sort(function(a,b){var sa=(templateConfig[a]&&templateConfig[a].sort_order)||0;var sb=(templateConfig[b]&&templateConfig[b].sort_order)||0;if(sa!==sb)return sa-sb;return a.localeCompare(b);}).map(function(tplName){
                var currentEntry=templateConfig[tplName]||{};
                var currentCat=typeof currentEntry==="string"?currentEntry:(currentEntry.category||"sin_categoria");
                var currentRegion=typeof currentEntry==="string"?"":(currentEntry.region||"");
                var hasAbGroup=currentEntry.ab_group;
                var isAbSel=abSelected.indexOf(tplName)>=0;
                var isHidden=currentEntry.hidden||false;
                return (<div key={tplName} onClick={abSelectMode?function(){handleAbToggle(tplName);}:undefined} style={{display:"flex",alignItems:"center",gap:14,padding:"12px 16px",background:isAbSel?"#EDE9FE":hasAbGroup?"#FAFAFE":"#F9FAFB",borderRadius:10,border:"1px solid "+(isAbSel?C.purple+"66":hasAbGroup?C.purple+"33":C.border),cursor:abSelectMode?"pointer":"default",transition:"all 0.15s ease",opacity:isHidden?0.5:1}}>
                  {abSelectMode && (
                    <div style={{width:20,height:20,borderRadius:6,border:"2px solid "+(isAbSel?C.purple:C.border),background:isAbSel?C.purple:"#FFF",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all 0.15s ease"}}>
                      {isAbSel && <span style={{color:"#FFF",fontSize:12,fontWeight:800}}>{"\u2713"}</span>}
                    </div>
                  )}
                  <div style={{display:"flex",flexDirection:"column",gap:2,flexShrink:0}}>
                    <button onClick={function(e){e.stopPropagation();updateTemplateConfig(tplName,"sort_order",(currentEntry.sort_order||0)-1);}} style={{background:"none",border:"1px solid "+C.border,borderRadius:4,width:22,height:18,fontSize:10,cursor:"pointer",color:C.muted,display:"flex",alignItems:"center",justifyContent:"center",padding:0,lineHeight:1}}>{"\u25B2"}</button>
                    <button onClick={function(e){e.stopPropagation();updateTemplateConfig(tplName,"sort_order",(currentEntry.sort_order||0)+1);}} style={{background:"none",border:"1px solid "+C.border,borderRadius:4,width:22,height:18,fontSize:10,cursor:"pointer",color:C.muted,display:"flex",alignItems:"center",justifyContent:"center",padding:0,lineHeight:1}}>{"\u25BC"}</button>
                  </div>
                  <button onClick={function(e){e.stopPropagation();updateTemplateConfig(tplName,"hidden",!isHidden);}} title={isHidden?"Mostrar template":"Ocultar template"} style={{background:"none",border:"none",fontSize:16,cursor:"pointer",padding:"2px 4px",color:isHidden?C.muted:C.accent,flexShrink:0,opacity:isHidden?0.5:0.8}}>{isHidden?"\uD83D\uDE48":"\uD83D\uDC41"}</button>
                  <div style={{flex:1,fontWeight:700,fontSize:14,fontFamily:mono,display:"flex",alignItems:"center",gap:8}}>
                    {tplName}
                    {hasAbGroup && <span style={{background:C.purple+"18",color:C.purple,padding:"2px 8px",borderRadius:6,fontSize:11,fontWeight:800,letterSpacing:0.5}}>A/B</span>}
                    {isHidden && <span style={{background:C.red+"15",color:C.red,padding:"2px 8px",borderRadius:6,fontSize:11,fontWeight:800,letterSpacing:0.5}}>Oculto</span>}
                  </div>
                  <select value={currentCat} onClick={function(e){e.stopPropagation();}} onChange={function(e){updateTemplateConfig(tplName,"category",e.target.value);}} style={{padding:"6px 12px",border:"1px solid "+C.border,borderRadius:8,fontSize:13,fontFamily:font,background:"#FFF",color:C.text,cursor:"pointer",minWidth:200}}>
                    <option value="sin_categoria">Sin categor&iacute;a</option>
                    <option value="d0">D+0 — Contacto Inicial</option>
                    <option value="d1">D+1 — Seguimiento</option>
                    <option value="d3">D+3 — Value Nudge</option>
                    <option value="d5">D+5 — Quick Audit</option>
                    <option value="automatico">Autom&aacute;tico</option>
                    <option value="campanha">Campa&ntilde;a</option>
                  </select>
                  <select value={currentRegion} onClick={function(e){e.stopPropagation();}} onChange={function(e){updateTemplateConfig(tplName,"region",e.target.value);}} style={{padding:"6px 12px",border:"1px solid "+C.border,borderRadius:8,fontSize:13,fontFamily:font,background:"#FFF",color:C.text,cursor:"pointer",minWidth:130}}>
                    <option value="">Sin regi&oacute;n</option>
                    <option value="br">BR</option>
                    <option value="latam">LATAM</option>
                  </select>
                </div>);
              })}
            </div>

            {/* A/B Comparison Cards */}
            {Object.keys(abGroups).length>0 && (
              <div style={{marginTop:24}}>
                <Sec>Tests A/B Activos</Sec>
                <div style={{display:"flex",flexDirection:"column",gap:16}}>
                  {Object.keys(abGroups).map(function(gId){
                    var pair=abGroups[gId];
                    if(pair.length<2) return null;
                    var stA=getTplStats(pair[0]);
                    var stB=getTplStats(pair[1]);
                    var rateA=parseFloat(stA.rate)||0;
                    var rateB=parseFloat(stB.rate)||0;
                    var diff=Math.abs(rateA-rateB).toFixed(1);
                    var winner=rateA>rateB?0:(rateB>rateA?1:-1);
                    var maxRate=Math.max(rateA,rateB,1);
                    return (<div key={gId} style={{background:"#FFF",border:"1px solid "+C.purple+"33",borderRadius:14,padding:0,overflow:"hidden"}}>
                      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 20px",background:C.lPurple,borderBottom:"1px solid "+C.purple+"22"}}>
                        <div style={{display:"flex",alignItems:"center",gap:8}}>
                          <span style={{fontSize:15,fontWeight:800,color:C.purple}}>Test A/B</span>
                          {winner>=0 && <span style={{fontSize:12,fontWeight:700,color:C.green,background:C.lGreen,padding:"2px 10px",borderRadius:6}}>+{diff}pp</span>}
                        </div>
                        <button onClick={function(){removeAbGroup(gId);}} style={{background:"none",border:"none",fontSize:18,color:C.muted,cursor:"pointer",padding:"2px 6px",borderRadius:6,lineHeight:1}} title="Eliminar test A/B">{"\u00D7"}</button>
                      </div>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:0}}>
                        {[0,1].map(function(idx){
                          var st=idx===0?stA:stB;
                          var rate=idx===0?rateA:rateB;
                          var isWinner=winner===idx;
                          var label=idx===0?"A":"B";
                          return (<div key={idx} style={{padding:"16px 20px",borderRight:idx===0?"1px solid "+C.purple+"15":"none",position:"relative"}}>
                            {isWinner && <div style={{position:"absolute",top:8,right:12,background:C.green,color:"#FFF",fontSize:10,fontWeight:800,padding:"2px 8px",borderRadius:6,letterSpacing:0.5}}>GANADOR</div>}
                            <div style={{fontSize:11,fontWeight:800,color:C.purple,textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>{label}</div>
                            <div style={{fontSize:13,fontWeight:700,fontFamily:mono,color:C.text,marginBottom:12,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{pair[idx]}</div>
                            <div style={{display:"flex",gap:16,marginBottom:10}}>
                              <div><div style={{fontSize:11,color:C.muted,fontWeight:600}}>Enviados</div><div style={{fontSize:18,fontWeight:800,color:C.text,fontFamily:mono}}>{st.sent||0}</div></div>
                              <div><div style={{fontSize:11,color:C.muted,fontWeight:600}}>Respuestas</div><div style={{fontSize:18,fontWeight:800,color:C.text,fontFamily:mono}}>{st.resp||0}</div></div>
                              <div><div style={{fontSize:11,color:C.muted,fontWeight:600}}>Tasa</div><div style={{fontSize:18,fontWeight:800,color:isWinner?C.green:C.text,fontFamily:mono}}>{st.rate||"0.0%"}</div></div>
                            </div>
                            <div style={{background:"#F3F4F6",borderRadius:6,height:8,overflow:"hidden"}}>
                              <div style={{height:"100%",borderRadius:6,background:isWinner?C.green:C.accent,width:(maxRate>0?(rate/maxRate*100):0)+"%",transition:"width 0.3s ease"}}></div>
                            </div>
                          </div>);
                        })}
                      </div>
                    </div>);
                  })}
                </div>
              </div>
            )}

            <div style={{marginTop:18,display:"flex",gap:12}}>
              <button onClick={resetConfig} style={{background:"#FEF2F2",color:C.red,border:"1px solid #FECACA",borderRadius:8,padding:"10px 20px",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:font}}>Resetear config</button>
              <span style={{fontSize:12,color:C.muted,alignSelf:"center"}}>Resetear volver&aacute; al auto-detect por step_order en la pr&oacute;xima carga.</span>
            </div>
          </>)}
        </Cd>
      </>);
      })()}
    </div>
  </div>);
}
