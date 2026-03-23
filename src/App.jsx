import { useState, useEffect, useRef } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, AreaChart, Area, Legend, PieChart, Pie, Sankey } from "recharts";
import { processCSVRows, processInboundRows, parseDatetime, TOPIC_KEYWORDS } from "./csvParser";
import { fetchThreads, expandThreadMessages, fetchInboundThreads, expandInboundThreadMessages, fetchLifecyclePhones, fetchInboundThreadsFiltered, queryMetabase, fetchResponseStats, fetchAdsThreads, fetchInboundCached, fetchLifecyclePhonesCached } from "./metabaseApi";
import { DEFAULT_MEETINGS as _RAW_MEETINGS } from "./defaultData";
import { supabase } from "./supabase";
import InfoTip from "./components/InfoTip";
import TIPS from "./tooltips";
import { fetchCampaigns, fetchCampaignGroups, fetchCampaignLeads, formatDateForApi, formatEndDateForApi } from "./gruposApi";
import { fetchAllContacts, fetchAllContactsWithPhone, fetchAllMeetings, fetchAllDeals, fetchDealPipelines, extractHubSpotPhones, getMeetingContactPhones, getMeetingContactIds, fetchMeetingsSince, fetchContactsByIds, fetchDealsSince, fetchLeadsSince, fetchGrowthLeads, fetchOwnersByIds } from "./hubspotApi";
import { fetchAutomationDiagnostic, aggregateWorkflowStats, calculateMetrics } from "./brevoApi.js";
import { resetAuthGuard } from "./authGuard";
import { fetchPostHogSources } from "./posthogApi";

function getFirstOfMonth(){var d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-01";}

var font="'Source Sans 3', sans-serif";
var mono="'JetBrains Mono', monospace";
var _CLight={bg:"#FAFBFC",card:"#FFF",border:"#E5E7EB",text:"#111827",sub:"#374151",muted:"#6B7280",accent:"#2563EB",green:"#059669",red:"#DC2626",yellow:"#D97706",purple:"#7C3AED",cyan:"#0891B2",orange:"#EA580C",pink:"#EC4899",lBlue:"#EFF6FF",lGreen:"#ECFDF5",lRed:"#FEF2F2",lPurple:"#F5F3FF",lYellow:"#FFFBEB",lOrange:"#FFF7ED",inputBg:"#FFF",rowBg:"#F9FAFB",rowAlt:"#F3F4F6",bubbleOut:"#DCF8C6",gradFrom:"#FFF",gradTo:"#F8FAFF",abSelBg:"#EDE9FE",abRowBg:"#FAFAFE",barTrack:"#F3F4F6",redBorder:"#FECACA",white:"#FFF"};
var _CDark={bg:"#0F1117",card:"#1A1D27",border:"#2D3140",text:"#E5E7EB",sub:"#B0B5C3",muted:"#808696",accent:"#3B82F6",green:"#10B981",red:"#EF4444",yellow:"#F59E0B",purple:"#8B5CF6",cyan:"#06B6D4",orange:"#F97316",pink:"#F472B6",lBlue:"#1E2A40",lGreen:"#122B25",lRed:"#2D1B1B",lPurple:"#221F33",lYellow:"#2B2714",lOrange:"#2B2114",inputBg:"#252836",rowBg:"#1E2029",rowAlt:"#252836",bubbleOut:"#1A3A2A",gradFrom:"#13151D",gradTo:"#181B25",abSelBg:"#2A2540",abRowBg:"#1F1E2A",barTrack:"#252836",redBorder:"#5C2020",white:"#E5E7EB"};
var C=_CLight;
var _isDark=false;

// Filter default meetings to only those that received MSG1, and compute ml/igL/igA flags
var DEFAULT_MEETINGS=_RAW_MEETINGS.filter(function(m){return m.tr.indexOf("MSG1")>=0;}).map(function(m){var hasMl=false,hasIgL=false,hasIgA=false;for(var i=0;i<m.c.length;i++){if(m.c[i][0]===2&&m.c[i][1]&&(/meetings\.hubspot\.com\//.test(m.c[i][1])||/yavendio\.com\/[^\s]*meetings/.test(m.c[i][1])))hasMl=true;if(m.c[i][0]===1&&m.c[i][1]){if(/instagram\.com/i.test(m.c[i][1]))hasIgL=true;if(/@\w+|ig\s*:/i.test(m.c[i][1]))hasIgA=true;}}return Object.assign({},m,{ml:hasMl,igL:hasIgL,igA:hasIgA});});
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

var DEFAULT_FUNNEL_ALL=[{n:"Contactados",v:1116,c:C.accent},{n:"Respondieron",v:270,c:C.purple},{n:"Oferta Reuni\u00F3n",v:33,c:C.pink}];
var DEFAULT_FUNNEL_REAL=[{n:"Contactados",v:1116,c:C.accent},{n:"Resp. Reales",v:241,c:C.cyan},{n:"Oferta Reuni\u00F3n",v:30,c:C.pink}];
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
function Sec({children,tipKey}){return <div style={{fontSize:13,color:C.muted,textTransform:"uppercase",letterSpacing:1.5,fontWeight:700,marginBottom:14,paddingBottom:10,borderBottom:"1px solid "+C.border+"66",display:"flex",alignItems:"center"}}>{children}{tipKey && <InfoTip dark={_isDark} data={TIPS[tipKey]}/>}</div>;}
function Cd({children,style,onClick,draggable,onDragStart,onDragOver,onDragLeave,onDrop,onDragEnd}){var _h=useState(false),hov=_h[0],sH=_h[1];return <div onClick={onClick} draggable={draggable} onDragStart={onDragStart} onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop} onDragEnd={onDragEnd} onMouseEnter={function(){sH(true);}} onMouseLeave={function(){sH(false);}} style={{background:C.card,border:"1px solid "+(hov?C.accent+"44":C.border),borderRadius:16,padding:20,boxShadow:hov?"0 8px 25px #0000000f":"0 1px 3px #0000000a",transform:hov?"translateY(-1px)":"none",transition:"box-shadow 0.2s ease, border-color 0.2s ease, transform 0.2s ease",...style}}>{children}</div>;}

function SideBtn({children,label,onClick,active,style}){var _h=useState(false),hov=_h[0],sH=_h[1];return <button onClick={onClick} onMouseEnter={function(){sH(true);}} onMouseLeave={function(){sH(false);}} style={{width:40,height:40,borderRadius:10,border:"none",background:active?(C.accent+"18"):hov?(C.border+"55"):"transparent",color:active?C.accent:C.muted,fontSize:18,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",position:"relative",transition:"all 0.15s ease",...style}}>{children}{hov&&<div style={{position:"absolute",left:"100%",top:"50%",transform:"translateY(-50%)",marginLeft:8,background:C.card,border:"1px solid "+C.border,borderRadius:6,padding:"4px 10px",fontSize:12,fontWeight:700,color:C.text,whiteSpace:"nowrap",boxShadow:"0 4px 12px #00000015",pointerEvents:"none",zIndex:20}}>{label}</div>}</button>;}

function qualLabel(q){if(!q)return{t:"Sin calificaci\u00F3n",c:C.muted};var lo=q.toLowerCase();if(lo==="alta")return{t:"Alta",c:C.green};if(lo==="media"||lo==="m\u00E9dia")return{t:"Media",c:C.accent};if(lo==="baja"||lo==="baixa")return{t:"Baja",c:C.yellow};return{t:q,c:C.muted};}

function ConvView({lead,onBack,crmContacts}){
  var ql=qualLabel(lead.q);
  var phoneMap=buildPhoneContactMap(crmContacts);
  var ct=findContact(phoneMap,lead.p);
  var props=ct&&ct.properties||{};
  var name=(props.firstname||"")+(props.lastname?(" "+props.lastname):"");
  var company=props.company||"";
  var email=props.email||"";
  var hsId=ct?ct.id:"";
  return (<div style={{maxHeight:"78vh",overflowY:"auto"}}>
    <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:0,position:"sticky",top:0,background:C.card,padding:"12px 0",zIndex:2,borderBottom:"1px solid "+C.border}}>
      <button onClick={onBack} style={{background:C.rowAlt,border:"none",borderRadius:8,padding:"8px 14px",fontSize:13,cursor:"pointer",fontWeight:700,color:C.muted}}>{"\u2190 Volver"}</button>
      <div style={{flex:1}}>
        <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
          <span style={{fontSize:18}}>{lead.co}</span>
          <span style={{fontSize:17,fontWeight:800}}>{name||lead.p}</span>
          {company && <span style={{fontSize:14,color:C.muted,fontWeight:600}}>{"\u00B7 "+company}</span>}
          <Bd color={ql.c}>{ql.t}</Bd>
          {lead._src && <Bd color={lead._src==="outbound"?C.green:lead._src==="inbound"?C.cyan:C.purple}>{lead._src==="outbound"?"OUTBOUND":lead._src==="inbound"?"INBOUND":"AMBOS"}</Bd>}
          {lead.ml && <Bd color={C.pink}>{"\uD83D\uDCC5"} Reuni\u00F3n Ofertada</Bd>}
          {lead._confirmed!==undefined && <Bd color={lead._confirmed?C.green:C.red}>{lead._confirmed?"\u2705 Reuni\u00F3n Agendada":"\u274C No agend\u00F3"}</Bd>}
          {lead.au && <Bd color={C.red}>AUTO-REPLY</Bd>}
        </div>
        <div style={{fontSize:12,color:C.muted,marginTop:2}}>
          {email && <span>{email} {"\u00B7"} </span>}
          {hsId && <span style={{color:C.accent,fontWeight:600}}>HS #{hsId} {"\u00B7"} </span>}
          {!hsId && lead.hid && <span style={{color:C.accent,fontWeight:600}}>HS #{lead.hid} {"\u00B7"} </span>}
          <span style={{fontFamily:mono}}>{lead.p}</span> {"\u00B7"} {lead.ms} msgs humanas {"\u00B7"} {lead.w.toLocaleString()} palabras {"\u00B7"} Templates: {lead.tr.join(", ")} {"\u00B7"} 1a resp: <strong>{lead.fr||"N/A"}</strong>
        </div>
      </div>
    </div>
    <div style={{display:"flex",flexDirection:"column",gap:6,paddingTop:14}}>
      {lead.c.map(function(m,i){
        var dt=m[2]||"";
        if(m[0]===0){
          var tc=tplCol[m[1]]||(m[1]&&m[1].startsWith("pt_")?C.green:m[1]&&m[1].startsWith("es_")?C.accent:C.accent);
          var tn=tplNm[m[1]]||m[1];
          var tplBody=m[3]||"";
          return (<div key={i} style={{alignSelf:"center",background:tc+"0C",border:"2px dashed "+tc+"55",borderRadius:12,padding:"10px 20px",margin:"10px 0",maxWidth:"88%",textAlign:"center"}}>
            <div style={{fontSize:11,fontWeight:800,color:tc,textTransform:"uppercase",letterSpacing:1}}>{"\u{1F4CB} TEMPLATE ENVIADO"}</div>
            <div style={{fontSize:15,fontWeight:700,color:tc,marginTop:3}}>{tn}</div>
            {dt && <div style={{fontSize:11,color:C.muted,marginTop:3}}>{dt}</div>}
            {tplBody && <div style={{fontSize:13,color:C.sub,marginTop:8,textAlign:"left",lineHeight:1.5,whiteSpace:"pre-wrap",background:C.card,borderRadius:8,padding:"10px 14px",border:"1px solid "+tc+"20"}}>{tplBody}</div>}
          </div>);
        }
        if(m[0]===1) return (<div key={i} style={{alignSelf:"flex-end",background:C.bubbleOut,borderRadius:"16px 16px 4px 16px",padding:"10px 14px",fontSize:14,color:C.text,maxWidth:"72%",lineHeight:1.6,whiteSpace:"pre-wrap"}}>
          {m[1]}{dt && <div style={{fontSize:10,color:C.muted,marginTop:4,textAlign:"right"}}>{dt}</div>}
        </div>);
        if(m[0]===2){
          var txt=m[1];
          if(!txt||txt.trim()==="") return null;
          return (<div key={i} style={{alignSelf:"flex-start",background:C.lBlue,borderRadius:"16px 16px 16px 4px",padding:"10px 14px",fontSize:14,color:C.text,maxWidth:"72%",lineHeight:1.6,whiteSpace:"pre-wrap"}}>
            <div style={{fontSize:10,fontWeight:700,color:C.accent,marginBottom:4}}>{"\u{1F916} YAGO"}</div>
            {txt}{dt && <div style={{fontSize:10,color:C.muted,marginTop:4}}>{dt}</div>}
          </div>);
        }
        return null;
      })}
      {lead.c.length>=80 && <div style={{textAlign:"center",fontSize:13,color:C.muted,padding:16,background:C.rowBg,borderRadius:8,margin:"8px 0"}}>{"\u26A0 Conversaci\u00F3n truncada (primeros 80 mensajes)"}</div>}
    </div>
  </div>);
}

function buildPhoneContactMap(crmContacts){
  var map={};
  if(!crmContacts)return map;
  function addToMap(ct,ph){
    if(!ph)return;
    var d=ph.replace(/\D/g,"");
    if(!d)return;
    if(!map[d])map[d]=ct;
    if(d.length>11&&!map[d.slice(-11)])map[d.slice(-11)]=ct;
    if(d.length>10&&!map[d.slice(-10)])map[d.slice(-10)]=ct;
  }
  for(var i=0;i<crmContacts.length;i++){
    var ct=crmContacts[i];
    var props=ct.properties;
    if(!props)continue;
    addToMap(ct,props.phone);
    addToMap(ct,props.mobilephone);
    addToMap(ct,props.hs_whatsapp_phone_number);
  }
  return map;
}

function findContact(phoneMap,leadPhone){
  if(!leadPhone)return null;
  var d=leadPhone.replace(/\D/g,"");
  if(!d)return null;
  if(phoneMap[d])return phoneMap[d];
  if(d.length>11&&phoneMap[d.slice(-11)])return phoneMap[d.slice(-11)];
  if(d.length>10&&phoneMap[d.slice(-10)])return phoneMap[d.slice(-10)];
  return null;
}

function timeAgo(ts){
  if(!ts)return "";
  var d=typeof ts==="number"?new Date(ts):new Date(ts);
  if(isNaN(d.getTime()))return "";
  var diff=Date.now()-d.getTime();
  if(diff<0)diff=0;
  var mins=Math.floor(diff/60000);
  if(mins<1)return "Ahora";
  if(mins<60)return "Hace "+mins+"m";
  var hrs=Math.floor(mins/60);
  if(hrs<24)return "Hace "+hrs+"h";
  var days=Math.floor(hrs/24);
  return "Hace "+days+"d";
}

function getLastMsgTs(lead){
  if(!lead.c||lead.c.length===0)return 0;
  var last=lead.c[lead.c.length-1];
  var ts=last[2];
  if(!ts)return 0;
  var d=new Date(ts);
  return isNaN(d.getTime())?0:d.getTime();
}

function MeetModal({leads,onClose,mode,title,crmContacts}){
  const [sel,setSel]=useState(null);
  var phoneMap=buildPhoneContactMap(crmContacts);
  var filtered=mode===1?leads.filter(function(l){return !l.au;}):leads;

  // Sort by last message timestamp descending
  filtered=filtered.slice().sort(function(a,b){return getLastMsgTs(b)-getLastMsgTs(a);});

  return (<div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"#00000044",backdropFilter:"blur(4px)",WebkitBackdropFilter:"blur(4px)",zIndex:999,display:"flex",alignItems:"center",justifyContent:"center",padding:20,animation:"fadeInModal 0.2s ease-out"}} onClick={onClose}>
    <div style={{background:C.card,borderRadius:20,padding:28,maxWidth:880,width:"100%",maxHeight:"92vh",boxShadow:"0 25px 60px #00000025",animation:"scaleInModal 0.2s ease-out"}} onClick={function(e){e.stopPropagation();}}>
      {sel!==null ? (
        <ConvView lead={filtered[sel]} onBack={function(){setSel(null);}} crmContacts={crmContacts} />
      ) : (<div style={{maxHeight:"82vh",overflowY:"auto"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
          <div>
            <div style={{fontSize:19,fontWeight:900}}>{title||"\u{1F4C5} Leads con Oferta de Reuni\u00F3n"}</div>
            <div style={{fontSize:14,color:C.muted,marginTop:2}}>{filtered.length} leads {"\u00B7"} Click en un contacto para ver la conversaci\u00F3n</div>
          </div>
          <button onClick={onClose} style={{background:C.rowAlt,border:"none",borderRadius:8,width:36,height:36,fontSize:18,cursor:"pointer",color:C.muted,fontWeight:700}}>{"\u2715"}</button>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {filtered.map(function(l,i){
            var ql=qualLabel(l.q);
            var ct=findContact(phoneMap,l.p);
            var props=ct&&ct.properties||{};
            var name=(props.firstname||"")+(props.lastname?(" "+props.lastname):"");
            var company=props.company||"";
            var email=props.email||"";
            var hsId=ct?ct.id:"";
            var lastTs=getLastMsgTs(l);
            return (<div key={i} onClick={function(){setSel(i);}} style={{display:"flex",alignItems:"center",gap:14,padding:"14px 16px",background:C.rowBg,borderRadius:12,cursor:"pointer",border:"2px solid transparent",transition:"border-color 0.15s ease"}} onMouseEnter={function(e){e.currentTarget.style.borderColor=C.accent+"44";}} onMouseLeave={function(e){e.currentTarget.style.borderColor="transparent";}}>
              <span style={{fontSize:20}}>{l.co}</span>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                  <span style={{fontWeight:800,fontSize:15,color:C.text}}>{name||l.p}</span>
                  {company && <span style={{fontSize:13,color:C.muted,fontWeight:600}}>{"\u00B7 "+company}</span>}
                  <Bd color={ql.c}>{ql.t}</Bd>
                  {l._src && <Bd color={l._src==="outbound"?C.green:l._src==="inbound"?C.cyan:C.purple}>{l._src==="outbound"?"OUTBOUND":l._src==="inbound"?"INBOUND":"AMBOS"}</Bd>}
                  {l.ml && <Bd color={C.pink}>{"\uD83D\uDCC5"} Ofertada</Bd>}
                  {l._confirmed!==undefined && <Bd color={l._confirmed?C.green:C.red}>{l._confirmed?"\u2705 Agendada":"\u274C No agend\u00F3"}</Bd>}
                  {l.au && <Bd color={C.red}>AUTO</Bd>}
                </div>
                <div style={{fontSize:12,color:C.muted,marginTop:3,display:"flex",flexWrap:"wrap",gap:4}}>
                  {email && <span>{email} {"\u00B7"} </span>}
                  {hsId && <span style={{color:C.accent,fontWeight:600}}>HS #{hsId} {"\u00B7"} </span>}
                  {!hsId && l.hid && <span style={{color:C.accent,fontWeight:600}}>HS #{l.hid} {"\u00B7"} </span>}
                  {!name && !email && <span style={{fontFamily:mono,fontSize:12}}>{l.p} {"\u00B7"} </span>}
                  {name && <span style={{fontFamily:mono,fontSize:12}}>{l.p} {"\u00B7"} </span>}
                  <span>{l.ms} msgs {"\u00B7"} {l.w.toLocaleString()} pal.</span>
                  {lastTs>0 && <span> {"\u00B7"} {timeAgo(lastTs)}</span>}
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

function GrowthContactsModal({contacts,onClose,title}){
  var pqlColors={"ALTA":C.green,"MEDIA":C.accent,"M\u00C9DIA":C.accent,"BAJA":C.yellow,"BAIXA":C.yellow};
  var srcColors={"PAID_SOCIAL":"#2563EB","DIRECT_TRAFFIC":"#7C3AED","ORGANIC_SEARCH":"#059669","REFERRALS":"#0891B2","OFFLINE":"#EA580C","OTHER_CAMPAIGNS":"#EC4899","EMAIL_MARKETING":"#D97706","ORGANIC_SOCIAL":"#DC2626","PAID_SEARCH":"#6366F1"};
  // Sort by lead createdate descending
  var sorted=contacts.slice().sort(function(a,b){
    var pa=a.properties||{};var pb=b.properties||{};
    var da=new Date(pa.createdate||pa.hs_createdate||a.createdAt||0);
    var db=new Date(pb.createdate||pb.hs_createdate||b.createdAt||0);
    return db-da;
  });

  return (<div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"#00000044",backdropFilter:"blur(4px)",WebkitBackdropFilter:"blur(4px)",zIndex:999,display:"flex",alignItems:"center",justifyContent:"center",padding:20,animation:"fadeInModal 0.2s ease-out"}} onClick={onClose}>
    <div style={{background:C.card,borderRadius:20,padding:28,maxWidth:1060,width:"100%",maxHeight:"92vh",boxShadow:"0 25px 60px #00000025",animation:"scaleInModal 0.2s ease-out"}} onClick={function(e){e.stopPropagation();}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
        <div>
          <div style={{fontSize:19,fontWeight:900}}>{title}</div>
          <div style={{fontSize:14,color:C.muted,marginTop:2}}>{sorted.length} leads</div>
        </div>
        <button onClick={onClose} style={{background:C.rowAlt,border:"none",borderRadius:8,width:36,height:36,fontSize:18,cursor:"pointer",color:C.muted,fontWeight:700}}>{"\u2715"}</button>
      </div>
      <div style={{maxHeight:"74vh",overflowY:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:13,fontFamily:font}}>
          <thead>
            <tr style={{borderBottom:"2px solid "+C.border,position:"sticky",top:0,background:C.card,zIndex:1}}>
              {["Lead","Stage","Email","Tel\u00E9fono","Prioridad","Fuente","Detalle fuente","Campa\u00F1a UTM","Industria","Fecha"].map(function(h){
                return <th key={h} style={{textAlign:"left",padding:"10px 8px",fontSize:11,color:C.muted,fontWeight:700,textTransform:"uppercase",letterSpacing:0.5}}>{h}</th>;
              })}
            </tr>
          </thead>
          <tbody>
            {sorted.map(function(lead,idx){
              var lp=lead.properties||{};
              var cp=lead._contactProps||{};
              var prio=(cp.prioridad_plg||"").toUpperCase();
              var prioColor=pqlColors[prio]||C.muted;
              var src=cp.hs_analytics_source||"";
              var srcColor=srcColors[src]||C.muted;
              var cd=lp.createdate||lp.hs_createdate||lead.createdAt;
              var dt=cd?new Date(cd):null;
              var dateStr=dt?String(dt.getDate()).padStart(2,"0")+"/"+String(dt.getMonth()+1).padStart(2,"0")+" "+String(dt.getHours()).padStart(2,"0")+":"+String(dt.getMinutes()).padStart(2,"0"):"";
              return <tr key={lead.id||idx} style={{borderBottom:"1px solid "+C.border,background:idx%2===0?"transparent":C.rowAlt}}>
                <td style={{padding:"10px 8px",fontWeight:600,maxWidth:180,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{lp.hs_lead_name||"Lead #"+lead.id}</td>
                <td style={{padding:"10px 8px",fontSize:12,color:C.sub}}>{lp.hs_pipeline_stage||"-"}</td>
                <td style={{padding:"10px 8px",maxWidth:180,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{cp.email||"-"}</td>
                <td style={{padding:"10px 8px",fontFamily:mono,fontSize:12}}>{cp.phone||"-"}</td>
                <td style={{padding:"10px 8px"}}>{prio?<span style={{background:prioColor+"15",color:prioColor,padding:"2px 8px",borderRadius:6,fontSize:11,fontWeight:700,border:"1px solid "+prioColor+"30"}}>{prio}</span>:<span style={{color:C.muted}}>-</span>}</td>
                <td style={{padding:"10px 8px"}}><span style={{background:srcColor+"15",color:srcColor,padding:"2px 8px",borderRadius:6,fontSize:11,fontWeight:700,border:"1px solid "+srcColor+"30"}}>{src||"-"}</span></td>
                <td style={{padding:"10px 8px",fontSize:12,maxWidth:140,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",color:C.sub}}>{cp.hs_analytics_source_data_1||"-"}</td>
                <td style={{padding:"10px 8px",fontSize:12,maxWidth:140,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",color:C.sub}}>{cp.initial_utm_campaign||"-"}</td>
                <td style={{padding:"10px 8px",fontSize:12,color:C.sub}}>{cp.industria||"-"}</td>
                <td style={{padding:"10px 8px",fontSize:12,fontFamily:mono,color:C.muted,whiteSpace:"nowrap"}}>{dateStr}</td>
              </tr>;
            })}
            {sorted.length===0 && <tr><td colSpan={10} style={{textAlign:"center",padding:30,color:C.muted}}>No hay leads para mostrar</td></tr>}
          </tbody>
        </table>
      </div>
      {/* Summary stats at bottom */}
      <div style={{display:"flex",gap:12,marginTop:16,flexWrap:"wrap"}}>
        {(function(){
          var pqlCount=0;var srcMap={};
          for(var i=0;i<sorted.length;i++){
            var pr=(sorted[i]._contactProps&&sorted[i]._contactProps.prioridad_plg||"").toLowerCase();
            if(pr==="alta"||pr==="media"||pr==="m\u00E9dia")pqlCount++;
            var sr=sorted[i]._contactProps&&sorted[i]._contactProps.hs_analytics_source||"UNKNOWN";
            if(!srcMap[sr])srcMap[sr]=0;srcMap[sr]++;
          }
          var topSources=Object.keys(srcMap).map(function(k){return{s:k,n:srcMap[k]};}).sort(function(a,b){return b.n-a.n;}).slice(0,4);
          return <>
            <div style={{background:C.lPurple,borderRadius:8,padding:"6px 12px",fontSize:12,fontWeight:700,color:C.purple}}>PQLs: {pqlCount} ({sorted.length>0?(pqlCount/sorted.length*100).toFixed(1):0}%)</div>
            {topSources.map(function(ts){return <div key={ts.s} style={{background:C.rowAlt,borderRadius:8,padding:"6px 12px",fontSize:12,fontWeight:600,color:C.sub}}>{ts.s}: {ts.n}</div>;})}
          </>;
        })()}
      </div>
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
              <span style={{fontSize:12,color:C.muted,background:C.rowAlt,padding:"2px 8px",borderRadius:4}}>{tpl.day}</span>
              <Bd color={sc}>{tpl.rate}</Bd>
            </div>
            <div style={{fontSize:13,color:C.muted,marginTop:4}}>{filtered.length} leads respondieron a este template</div>
          </div>
          <button onClick={onClose} style={{background:C.rowAlt,border:"none",borderRadius:8,width:36,height:36,fontSize:18,cursor:"pointer",color:C.muted,fontWeight:700}}>{"\u2715"}</button>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:18}}>
          {[{l:"Enviados",v:tpl.sent,c:C.accent},{l:"Respondieron",v:tpl.resp,c:C.purple},{l:"Tasa",v:tpl.rate,c:sc}].map(function(s,i){return (<div key={i} style={{background:s.c+"08",borderRadius:10,padding:"10px 14px",textAlign:"center",border:"1px solid "+s.c+"18"}}>
            <div style={{fontSize:11,color:C.muted,fontWeight:600}}>{s.l}</div>
            <div style={{fontSize:24,fontWeight:800,fontFamily:mono,color:s.c}}>{s.v}</div>
          </div>);})}
        </div>
        {cleanContent && <div style={{marginBottom:18}}>
          <div style={{fontSize:12,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>Contenido del template</div>
          <div style={{background:C.rowBg,border:"1px solid "+C.border,borderRadius:12,padding:"14px 18px",fontSize:14,color:C.sub,lineHeight:1.7,whiteSpace:"pre-wrap",maxHeight:200,overflowY:"auto"}}>{cleanContent}</div>
        </div>}
        {filtered.length>0 && <div>
          <div style={{fontSize:12,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>Leads que respondieron ({filtered.length})</div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {filtered.map(function(l,i){
              var ql=qualLabel(l.q);
              return (<div key={i} onClick={function(){setSel(i);}} style={{display:"flex",alignItems:"center",gap:14,padding:"14px 16px",background:C.rowBg,borderRadius:12,cursor:"pointer",border:"2px solid transparent"}}>
                <span style={{fontSize:20}}>{l.co}</span>
                <div style={{flex:1}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                    <span style={{fontFamily:mono,fontWeight:700,fontSize:16}}>{l.p}</span>
                    {l.hid && <span style={{color:C.accent,fontWeight:600,fontSize:12,marginLeft:4}}>HS #{l.hid}</span>}
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
var EMPTY_HEADER={totalContactados:0,leadsPerDay:0,dateRange:"",autoReplyCount:0,realesCount:0,esRate:"0",esResp:0,esRespReal:0,esTotal:0,ptRate:"0",ptResp:0,ptRespReal:0,ptTotal:0,esRateReal:"0",ptRateReal:"0"};

export default function Dashboard(){
  const [darkMode,setDarkMode]=useState(function(){try{return localStorage.getItem("yago_dark")==="1";}catch(e){return false;}});
  C=darkMode?_CDark:_CLight;
  _isDark=darkMode;
  useEffect(function(){document.body.style.background=C.bg;if(darkMode){document.body.classList.add("dark-mode");}else{document.body.classList.remove("dark-mode");}},[darkMode]);

  const [isAuthenticated,setIsAuthenticated]=useState(function(){return !!sessionStorage.getItem("dashboard_password");});
  const [loginPassword,setLoginPassword]=useState("");
  const [loginError,setLoginError]=useState("");
  const [loginLoading,setLoginLoading]=useState(false);

  var _brevoIcon=<svg width="18" height="18" viewBox="0 0 24 24" fill="#0B996E"><path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zM7.2 4.8h5.747c2.34 0 3.895 1.406 3.895 3.516 0 1.022-.348 1.862-1.09 2.588C17.189 11.812 18 13.22 18 14.785c0 2.86-2.64 5.016-6.164 5.016H7.199v-15zm2.085 1.952v5.537h.07c.233-.432.858-.796 2.249-1.226 2.039-.659 3.037-1.52 3.037-2.655 0-.998-.766-1.656-1.924-1.656H9.285zm4.87 5.266c-.766.385-1.67.748-2.76 1.11-1.229.387-2.11 1.386-2.11 2.407v2.315h2.365c2.387 0 4.149-1.34 4.149-3.155 0-1.067-.625-2.087-1.645-2.677z"/></svg>;
  var _hubspotIcon=<svg width="18" height="18" viewBox="0 0 24 24" fill="#FF7A59"><path d="M18.164 7.93V5.084a2.198 2.198 0 001.267-1.978v-.067A2.2 2.2 0 0017.238.845h-.067a2.2 2.2 0 00-2.193 2.193v.067a2.196 2.196 0 001.252 1.973l.013.006v2.852a6.22 6.22 0 00-2.969 1.31l.012-.01-7.828-6.095A2.497 2.497 0 104.3 4.656l-.012.006 7.697 5.991a6.176 6.176 0 00-1.038 3.446c0 1.343.425 2.588 1.147 3.607l-.013-.02-2.342 2.343a1.968 1.968 0 00-.58-.095h-.002a2.033 2.033 0 102.033 2.033 1.978 1.978 0 00-.1-.595l.005.014 2.317-2.317a6.247 6.247 0 104.782-11.134l-.036-.005zm-.964 9.378a3.206 3.206 0 113.215-3.207v.002a3.206 3.206 0 01-3.207 3.207z"/></svg>;
  const SECTIONS={resumen:{label:"Resumen",icon:"\uD83D\uDCCA",subTabs:[]},outbound:{label:"Outbound",icon:"\uD83C\uDFAF",subTabs:["resumen","engagement","templates"]},inbound:{label:"Inbound",icon:"\uD83D\uDCE5",subTabs:["resumen","engagement","ads"]},canales:{label:"Canales",icon:"\uD83D\uDCE1",subTabs:["grupos"]},hubspot:{label:"HubSpot",icon:_hubspotIcon,subTabs:["analytics","reuniones"]},brevo:{label:"Brevo",icon:_brevoIcon,subTabs:[]},growth:{label:"Marketing",icon:"\uD83D\uDCC8",subTabs:["resumen"]}};
  const [section,setSection]=useState("outbound");
  const [subTab,setSubTab]=useState("resumen");
  const [searchOpen,setSearchOpen]=useState(false);
  const [mode,setMode]=useState(0);
  const [showM,setShowM]=useState(false);
  const [showA,setShowA]=useState(false);
  const [showConfirmed,setShowConfirmed]=useState(false);
  const [qualModalLeads,setQualModalLeads]=useState(null);
  const [qualModalTitle,setQualModalTitle]=useState("");
  const [confirmedLeads,setConfirmedLeads]=useState([]);
  const [chartDayModalData,setChartDayModalData]=useState(null);
  const [chartHiddenBars,setChartHiddenBars]=useState({});
  const [dbLoading,setDbLoading]=useState(true);
  const [loadError,setLoadError]=useState(null);
  const [inboundLoading,setInboundLoading]=useState(false);
  const [inboundRawRows,setInboundRawRows]=useState(null);
  const [lifecyclePhonesData,setLifecyclePhonesData]=useState(null);

  const [meetings,setMeetings]=useState([]);
  const [totalContactadosByQual,setTotalContactadosByQual]=useState({});
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
  const [allContactedPhones,setAllContactedPhones]=useState({});
  const [responseStats,setResponseStats]=useState(null);
  const [selTpl,setSelTpl]=useState(null);
  const [searchQuery,setSearchQuery]=useState("");
  const [searchResults,setSearchResults]=useState(null);
  const [searchLoading,setSearchLoading]=useState(false);
  const [searchSel,setSearchSel]=useState(null);
  const [searchThreadData,setSearchThreadData]=useState(null);
  const [rawRows,setRawRows]=useState(null);
  const [dateFrom,setDateFrom]=useState(getFirstOfMonth());
  const [dateTo,setDateTo]=useState(new Date().toISOString().slice(0,10));
  const [templateConfig,setTemplateConfig]=useState({});
  const [configLoaded,setConfigLoaded]=useState(false);
  const [allTemplateNames,setAllTemplateNames]=useState([]);
  const [templateLastSent,setTemplateLastSent]=useState({});
  const [inboundExtra,setInboundExtra]=useState(null);
  const [inboundHsPhones,setInboundHsPhones]=useState(null);
  const [topicModal,setTopicModal]=useState(null);
  const [regionFilter,setRegionFilter]=useState("all");
  const [resumenPreset,setResumenPreset]=useState("este_mes");
  const [abSelectMode,setAbSelectMode]=useState(false);
  const [abSelected,setAbSelected]=useState([]);
  const [showTplConfig,setShowTplConfig]=useState(false);
  const [openArchivedStep,setOpenArchivedStep]=useState(null);
  const [dragTpl,setDragTpl]=useState(null);

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
  const [crmRefreshing,setCrmRefreshing]=useState(false);
  const [crmMeetingPhones,setCrmMeetingPhones]=useState(null);
  const [crmLeads,setCrmLeads]=useState([]);
  const [crmOwnerMap,setCrmOwnerMap]=useState({});
  const [hsReunionOwnerFilter,setHsReunionOwnerFilter]=useState([]);
  const [hsReunionDateFrom,setHsReunionDateFrom]=useState("");
  const [hsReunionDateTo,setHsReunionDateTo]=useState("");
  const [hsReunionTypeFilter,setHsReunionTypeFilter]=useState([]);
  const [hsReunionOutcomeFilter,setHsReunionOutcomeFilter]=useState("");
  const [hsDetailDay,setHsDetailDay]=useState(null);
  const [hsDealPipelineFilter,setHsDealPipelineFilter]=useState("all");
  const [hsDealOwnerFilter,setHsDealOwnerFilter]=useState([]);

  // Email (Brevo) tab state
  const [emailLoading,setEmailLoading]=useState(false);
  const [emailError,setEmailError]=useState(null);
  const [emailData,setEmailData]=useState(null);
  const [emailInited,setEmailInited]=useState(false);
  const [emailDetail,setEmailDetail]=useState(null);

  // Growth tab state
  const [growthLoading,setGrowthLoading]=useState(false);
  const [growthError,setGrowthError]=useState(null);
  const [growthData,setGrowthData]=useState(null);
  const [growthInited,setGrowthInited]=useState(false);
  const [growthGoals,setGrowthGoals]=useState({latam:{signups:0,pqls:0},brasil:{signups:0,pqls:0}});
  const [growthMonth,setGrowthMonth]=useState(function(){var d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0");});
  const [showGoalsEditor,setShowGoalsEditor]=useState(false);
  const [growthModal,setGrowthModal]=useState(null);
  const [posthogSources,setPosthogSources]=useState(null);
  const [posthogSourcesLoading,setPosthogSourcesLoading]=useState(false);
  const [posthogSourcesError,setPosthogSourcesError]=useState(null);

  // Ads tab state
  const [adsLoading,setAdsLoading]=useState(false);
  const [adsError,setAdsError]=useState(null);
  const [adsData,setAdsData]=useState(null);
  const [adsInited,setAdsInited]=useState(false);
  const [adsModal,setAdsModal]=useState(null);

  useEffect(function(){
    function onAuthRequired(){sessionStorage.removeItem("dashboard_password");setIsAuthenticated(false);setLoginError("Sesión expirada. Ingrese de nuevo.");setLoadError(null);}
    window.addEventListener("auth-required",onAuthRequired);
    return function(){window.removeEventListener("auth-required",onAuthRequired);};
  },[]);

  // Auto-init Grupos when selected for the first time
  useEffect(function(){
    if(section==="canales"&&subTab==="grupos"&&gruposCampaigns.length===0&&!gruposLoading&&!gruposError){initGrupos();}
  },[section,subTab]);

  // Auto-init Brevo (Email) when selected for the first time
  useEffect(function(){
    if(section==="brevo"&&!emailInited&&!emailLoading&&!emailError){initEmail();}
  },[section]);

  // Auto-init Growth when selected for the first time
  useEffect(function(){
    if(section==="growth"&&subTab==="resumen"&&!growthInited&&!growthLoading&&!growthError){initGrowth();}
    if(section==="inbound"&&subTab==="ads"&&!adsInited&&!adsLoading&&!adsError){initAds();}
  },[section,subTab]);

  // Auto-load inbound data when navigating to inbound, resumen, or hubspot analytics
  useEffect(function(){
    if((section==="inbound"||section==="resumen"||(section==="hubspot"&&subTab==="analytics"))&&!inboundRawRows&&!inboundLoading) loadInboundData();
  },[section,subTab,dateFrom,dateTo]);

  // Auto-load CRM data once authenticated (used by both overview and CRM tab)
  useEffect(function(){
    if(isAuthenticated&&!crmInited&&!crmLoading&&!crmError){initCrm();}
  },[isAuthenticated]);

  // Compute meeting phones when CRM data is loaded
  useEffect(function(){
    if(crmMeetings.length>0&&crmContacts.length>0){
      var phones=getMeetingContactPhones(crmMeetings,crmContacts);
      setCrmMeetingPhones(phones);
    }
  },[crmMeetings,crmContacts]);

  // Re-process inbound data when crmContacts arrives after inbound was already loaded
  useEffect(function(){
    if((section==="inbound"||section==="resumen")&&inboundRawRows&&crmContacts.length>0){
      var merged=Object.assign({},inboundHsPhones||{},extractHubSpotPhones(crmContacts));
      if(Object.keys(merged).length>0){
        var filtered=filterRowsByDate(inboundRawRows,dateFrom,dateTo);
        var result=processInboundRows(filtered,regionFilter,lifecyclePhonesData,merged);
        if(section!=="resumen") applyResult(result);
      }
    }
  },[crmContacts,dateFrom,dateTo]);

  // Merge HubSpot lead-pipeline deals per day into daily chart data
  const [dailyWithHs,setDailyWithHs]=useState([]);
  useEffect(function(){
    if(daily.length===0){setDailyWithHs([]);return;}
    // Build HubSpot daily map from leads in pipeline 808581652
    var hsMap={};
    for(var i=0;i<crmLeads.length;i++){
      var lead=crmLeads[i];
      var props=lead.properties||{};
      var cd=props.createdate||props.hs_createdate||lead.createdAt;
      if(!cd)continue;
      var dt=new Date(cd);
      if(isNaN(dt.getTime()))continue;
      var key=String(dt.getDate()).padStart(2,"0")+"/"+String(dt.getMonth()+1).padStart(2,"0");
      if(!hsMap[key])hsMap[key]=0;
      hsMap[key]++;
    }
    // Merge into daily array
    var merged=daily.map(function(item){return{d:item.d,l:item.l,hs:hsMap[item.d]||0};});
    // Add any HubSpot days not present in daily
    var dailyKeys={};
    for(var j=0;j<daily.length;j++)dailyKeys[daily[j].d]=true;
    var extraKeys=Object.keys(hsMap).filter(function(k){return!dailyKeys[k];});
    if(extraKeys.length>0){
      extraKeys.sort(function(a,b){var pa=a.split("/"),pb=b.split("/");return(parseInt(pa[1])*100+parseInt(pa[0]))-(parseInt(pb[1])*100+parseInt(pb[0]));});
      for(var k=0;k<extraKeys.length;k++){merged.push({d:extraKeys[k],l:0,hs:hsMap[extraKeys[k]]});}
      merged.sort(function(a,b){var pa=a.d.split("/"),pb=b.d.split("/");return(parseInt(pa[1])*100+parseInt(pa[0]))-(parseInt(pb[1])*100+parseInt(pb[0]));});
    }
    setDailyWithHs(merged);
  },[daily,crmLeads]);

  function applyResult(result){
    var hi={totalContactados:result.totalContactados,leadsPerDay:result.leadsPerDay,dateRange:result.dateRange,autoReplyCount:result.autoReplyCount,realesCount:result.realesCount,esRate:result.esRate,esResp:result.esResp,esRespReal:result.esRespReal,esTotal:result.esTotal,ptRate:result.ptRate,ptResp:result.ptResp,ptRespReal:result.ptRespReal,ptTotal:result.ptTotal,esRateReal:result.esRateReal,ptRateReal:result.ptRateReal};
    setMeetings(result.MEETINGS);setTopicsAll(result.topicsAll);setDataD(result.D);setFunnelAll(result.funnelAll);setFunnelReal(result.funnelReal);setChBench(result.chBench);setDaily(result.daily);setBTable(result.bTable);setMeetByTplAll(result.meetByTplAll);setMeetByTplReal(result.meetByTplReal);setHeaderInfo(hi);
    if(result.allContactedPhones) setAllContactedPhones(result.allContactedPhones);
    if(result.totalContactadosByQual) setTotalContactadosByQual(result.totalContactadosByQual);
    if(result.allTemplateNames) setAllTemplateNames(result.allTemplateNames);
    if(result.templateLastSent) setTemplateLastSent(result.templateLastSent);
    if(result.depthCounts){
      setInboundExtra({depthCounts:result.depthCounts,multiDayCount:result.multiDayCount,outcomeCount:result.outcomeCount,topicOutcomes:result.topicOutcomes,topicDepth:result.topicDepth,avgDepth:result.avgDepth,engagedTotal:result.engagedTotal,uniqueLeadCount:result.uniqueLeadCount,signupCount:result.signupCount,signupLinkCount:result.signupLinkCount,hubspotMatchCount:result.hubspotMatchCount});
    }else{
      setInboundExtra(null);
    }
  }

  // Load config from Supabase on mount
  useEffect(function(){
    supabase.from("template_config").select("template_name,category,region,ab_group,sort_order,hidden,qualification")
      .then(function(res){
        if(res.data){
          var cfg={};
          for(var i=0;i<res.data.length;i++){
            var r=res.data[i];
            cfg[r.template_name]={category:r.category||"sin_categoria",region:r.region||"",ab_group:r.ab_group||null,sort_order:r.sort_order||0,hidden:r.hidden||false,qualification:r.qualification||"general"};
          }
          setTemplateConfig(cfg);
        }
        setConfigLoaded(true);
      });
  },[]);

  useEffect(function(){
    if(!configLoaded) return;
    async function loadThreads(){
      setDbLoading(true);
      setLoadError(null);
      try{
        var since=getFirstOfMonth();
        var [threads,stats]=await Promise.all([fetchThreads(null,since),fetchResponseStats(since)]);
        setResponseStats(stats);
        var csvRows=expandThreadMessages(threads);
        setRawRows(csvRows);
        var filtered=filterRowsByDate(csvRows,since,new Date().toISOString().slice(0,10));
        var result=processCSVRows(filtered,templateConfig,regionFilter);
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
              var _q=_deduceQual(tn);
              autoConfig[tn]={category:stepCatMap[step],region:"",ab_group:null,sort_order:0,hidden:false,qualification:_q};
              upsertRows.push({template_name:tn,category:stepCatMap[step],region:"",ab_group:null,sort_order:0,hidden:false,qualification:_q,updated_at:new Date().toISOString()});
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
    loadThreads();
  },[configLoaded]);

  // Reprocess when templateConfig changes (only if rawRows already loaded)
  const templateConfigRef=useRef(templateConfig);
  useEffect(function(){
    if(templateConfigRef.current===templateConfig) return; // skip initial
    templateConfigRef.current=templateConfig;
    if(!rawRows||section!=="outbound") return;
    var filtered=filterRowsByDate(rawRows,dateFrom,dateTo);
    var result=processCSVRows(filtered,templateConfig,regionFilter);
    applyResult(result);
  },[templateConfig]);

  async function handleLogin(e){
    e.preventDefault();
    setLoginLoading(true);setLoginError("");
    sessionStorage.setItem("dashboard_password",loginPassword);
    try{
      await queryMetabase("SELECT 1");
      resetAuthGuard();
      setLoadError(null);
      setDbLoading(true);
      setCrmInited(false);
      setIsAuthenticated(true);
      setConfigLoaded(false);
      setTimeout(function(){setConfigLoaded(true);},0);
    }catch(err){
      sessionStorage.removeItem("dashboard_password");
      if(err.message==="Unauthorized") setLoginError("Contraseña incorrecta");
      else setLoginError("Error de conexión");
    }finally{setLoginLoading(false);}
  }

  if(!isAuthenticated) return (
    <div style={{background:C.bg,minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:font}}>
      <link href="https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@400;600;700;800;900&family=JetBrains+Mono:wght@400;700;800&display=swap" rel="stylesheet"/>
      <form onSubmit={handleLogin} style={{background:C.card,border:"1px solid "+C.border,borderRadius:14,padding:40,boxShadow:"0 1px 3px #0000000a",width:360,textAlign:"center"}}>
        <div style={{fontSize:32,marginBottom:8}}>{"🔒"}</div>
        <div style={{fontSize:20,fontWeight:800,color:C.text,marginBottom:4}}>Yago SDR Analytics</div>
        <div style={{fontSize:13,color:C.muted,marginBottom:24}}>Ingrese la contraseña para acceder</div>
        <input type="password" value={loginPassword} onChange={function(ev){setLoginPassword(ev.target.value);}} placeholder="Contraseña" style={{width:"100%",padding:"12px 14px",fontSize:15,border:"1px solid "+C.border,borderRadius:8,fontFamily:font,marginBottom:12,boxSizing:"border-box",outline:"none",background:C.inputBg,color:C.text}}/>
        {loginError && <div style={{color:C.red,fontSize:13,fontWeight:600,marginBottom:12}}>{loginError}</div>}
        <button type="submit" disabled={loginLoading||!loginPassword} style={{width:"100%",padding:"12px 0",fontSize:15,fontWeight:700,color:"#fff",background:loginLoading?C.accent+"88":C.accent,border:"none",borderRadius:8,cursor:loginLoading?"wait":"pointer",fontFamily:font}}>{loginLoading?"Verificando...":"Entrar"}</button>
      </form>
    </div>
  );

  function updateTemplateConfig(tplName,field,value){
    setTemplateConfig(function(prev){
      var entry=prev[tplName]||{category:"sin_categoria",region:"",ab_group:null,sort_order:0,hidden:false,qualification:"general"};
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
        qualification:next[tplName].qualification||"general",
        updated_at:new Date().toISOString()
      }).then(function(){});
      return next;
    });
  }

  function resetConfig(){
    setTemplateConfig({});
    supabase.from("template_config").delete().neq("template_name","").then(function(){});
  }

  function _deduceQual(name){
    var lo=name.toLowerCase();
    if(/no[_\s]?calificado|no[_\s]?qualificado|leads_baja|leads_baixa/.test(lo))return "no_calificado";
    if(/calificado|qualificado/.test(lo))return "calificado";
    return "general";
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

  function resolvePreset(key){
    var now=new Date();var y=now.getFullYear(),m=now.getMonth(),d=now.getDate();
    function iso(dt){return dt.toISOString().slice(0,10);}
    if(key==="hoy") return {from:iso(now),to:iso(now)};
    if(key==="ayer"){var yd=new Date(y,m,d-1);return {from:iso(yd),to:iso(yd)};}
    if(key==="esta_semana"){var dow=now.getDay();var diff=dow===0?6:dow-1;var mon=new Date(y,m,d-diff);return {from:iso(mon),to:iso(now)};}
    if(key==="este_mes") return {from:y+"-"+String(m+1).padStart(2,"0")+"-01",to:iso(now)};
    if(key==="ultimos_7"){var d7=new Date(y,m,d-6);return {from:iso(d7),to:iso(now)};}
    if(key==="ultimos_30"){var d30=new Date(y,m,d-29);return {from:iso(d30),to:iso(now)};}
    if(key==="mes_pasado"){var first=new Date(y,m-1,1);var last=new Date(y,m,0);return {from:iso(first),to:iso(last)};}
    return {from:iso(now),to:iso(now)};
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
      var toApi=to?formatEndDateForApi(to):undefined;
      // Single call — each lead already has entry_date, departure_date, status
      var leadsData=await fetchCampaignLeads(campaignId,fromApi,toApi,"entry");
      var allLeads=(leadsData.data&&leadsData.data.leads)||leadsData.leads||[];
      if(!Array.isArray(allLeads))allLeads=[];
      // Derive entry and exit lists client-side
      var entryLeads=allLeads;
      var exitLeads=allLeads.filter(function(l){return l.status==="exited"&&l.departure_date;});
      setGruposEntryLeads(entryLeads);setGruposExitLeads(exitLeads);
      // Build daily data for chart
      var dayMap={};
      for(var i=0;i<entryLeads.length;i++){
        var dk=parseMgvDate(entryLeads[i].entry_date);
        if(!dk)continue;
        if(!dayMap[dk])dayMap[dk]={d:dk,entries:0,exits:0};
        dayMap[dk].entries++;
      }
      for(var j=0;j<exitLeads.length;j++){
        var dk2=parseMgvDate(exitLeads[j].departure_date);
        if(!dk2)continue;
        if(!dayMap[dk2])dayMap[dk2]={d:dk2,entries:0,exits:0};
        dayMap[dk2].exits++;
      }
      var dailyArr=Object.values(dayMap).sort(function(a,b){return a.d<b.d?-1:1;});
      setGruposDailyData(dailyArr);
      // Fetch groups lazily (for detail cards — limit, retention, etc.)
      fetchCampaignGroups(campaignId).then(function(groupsData){
        var groups=(groupsData.data&&groupsData.data.groups)||groupsData.groups||[];
        if(!Array.isArray(groups))groups=[];
        setGruposGroups(groups);
      }).catch(function(e){console.warn("[Grupos] Groups detail fetch failed:",e.message);});
    }catch(e){setGruposError(e.message);}
    finally{setGruposLoading(false);}
  }

  async function loadGruposCrossReference(campaignId,from,to){
    setGruposLoading(true);setGruposError(null);
    try{
      // 1. Get phones from MeuGrupoVip entry leads
      var fromApi=from?formatDateForApi(from):undefined;
      var toApi=to?formatEndDateForApi(to):undefined;
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
  var CRM_SINCE=getFirstOfMonth();
  async function fetchHubSpotFresh(){
    console.log("[CRM] Fetching HubSpot since",CRM_SINCE,"...");
    var [meetingsRes,dealsRes,leadsRes,pipelines]=await Promise.all([
      fetchMeetingsSince(CRM_SINCE),
      fetchDealsSince(CRM_SINCE),
      fetchLeadsSince(CRM_SINCE,"808581652").catch(function(e){console.warn("[CRM] Leads fetch failed:",e.message);return [];}),
      fetchDealPipelines()
    ]);
    console.log("[CRM] Parallel fetch done. Meetings:",meetingsRes.length,"Deals:",dealsRes.length,"Leads:",leadsRes.length);
    var contactIdSet={};
    for(var i=0;i<meetingsRes.length;i++){
      var assoc=meetingsRes[i].associations&&meetingsRes[i].associations.contacts&&meetingsRes[i].associations.contacts.results;
      if(assoc){for(var j=0;j<assoc.length;j++){contactIdSet[assoc[j].id]=true;}}
    }
    for(var di=0;di<dealsRes.length;di++){
      var dAssoc=dealsRes[di].associations&&dealsRes[di].associations.contacts&&dealsRes[di].associations.contacts.results;
      if(dAssoc){for(var dj=0;dj<dAssoc.length;dj++){contactIdSet[dAssoc[dj].id]=true;}}
    }
    var contactIds=Object.keys(contactIdSet);
    var contactsRes=[];
    if(contactIds.length>0){
      contactsRes=await fetchContactsByIds(contactIds);
      console.log("[CRM] Contacts (from meetings+deals):",contactsRes.length);
    }
    var ownerIdSet={};
    for(var oi=0;oi<meetingsRes.length;oi++){
      var ownId=meetingsRes[oi].properties&&meetingsRes[oi].properties.hubspot_owner_id;
      if(ownId)ownerIdSet[ownId]=true;
    }
    for(var doi=0;doi<dealsRes.length;doi++){
      var dOwnId=dealsRes[doi].properties&&dealsRes[doi].properties.hubspot_owner_id;
      if(dOwnId)ownerIdSet[dOwnId]=true;
    }
    var ownerIds=Object.keys(ownerIdSet);
    var ownerMap={};
    if(ownerIds.length>0){
      try{ownerMap=await fetchOwnersByIds(ownerIds);console.log("[CRM] Owners resolved:",Object.keys(ownerMap).length);}
      catch(e){console.warn("[CRM] Owner fetch failed:",e.message);}
    }
    return {meetings:meetingsRes,contacts:contactsRes,deals:dealsRes,leads:leadsRes,pipelines:pipelines,owners:ownerMap};
  }

  function applyCrmData(d){
    setCrmOwnerMap(d.owners);setCrmContacts(d.contacts);setCrmMeetings(d.meetings);setCrmDeals(d.deals);setCrmLeads(d.leads);setCrmPipelines(d.pipelines);
  }

  async function saveCrmCache(d){
    var now=new Date().toISOString();
    var rows=[
      {key:"meetings",data:d.meetings,updated_at:now},
      {key:"contacts",data:d.contacts,updated_at:now},
      {key:"deals",data:d.deals,updated_at:now},
      {key:"leads",data:d.leads,updated_at:now},
      {key:"pipelines",data:d.pipelines,updated_at:now},
      {key:"owners",data:d.owners,updated_at:now}
    ];
    var {error}=await supabase.from("hubspot_cache").upsert(rows);
    if(error)console.warn("[CRM] Cache save error:",error.message);
    else console.log("[CRM] Cache saved at",now);
  }

  async function initCrm(){
    setCrmLoading(true);setCrmError(null);
    try{
      // Phase 1: Load from cache
      var {data:cacheRows,error:cacheErr}=await supabase.from("hubspot_cache").select("key,data,updated_at");
      if(!cacheErr&&cacheRows&&cacheRows.length>0){
        var cache={};
        for(var ci=0;ci<cacheRows.length;ci++){cache[cacheRows[ci].key]=cacheRows[ci].data;}
        if(cache.meetings&&cache.contacts){
          console.log("[CRM] Cache hit — loading cached data");
          applyCrmData({meetings:cache.meetings||[],contacts:cache.contacts||[],deals:cache.deals||[],leads:cache.leads||[],pipelines:cache.pipelines||null,owners:cache.owners||{}});
          setCrmInited(true);setCrmLoading(false);
          // Phase 2: Background refresh
          setCrmRefreshing(true);
          try{
            var fresh=await fetchHubSpotFresh();
            applyCrmData(fresh);
            await saveCrmCache(fresh);
            console.log("[CRM] Background refresh done. Meetings:",fresh.meetings.length,"Contacts:",fresh.contacts.length);
          }catch(e){console.warn("[CRM] Background refresh failed:",e.message);}
          finally{setCrmRefreshing(false);}
          return;
        }
      }
      // No cache — full load (first time)
      console.log("[CRM] No cache, fetching fresh...");
      var fresh=await fetchHubSpotFresh();
      applyCrmData(fresh);setCrmInited(true);
      await saveCrmCache(fresh);
      console.log("[CRM] Done. Meetings:",fresh.meetings.length,"Contacts:",fresh.contacts.length,"Deals:",fresh.deals.length,"Leads:",fresh.leads.length);
    }catch(e){console.error("[CRM] Error:",e);setCrmError(e.message);}
    finally{setCrmLoading(false);}
  }

  async function loadCrmCrossReference(){
    setCrmCrossLoading(true);setCrmError(null);
    try{
      // 1. HubSpot phones — fetch only contacts with phone for cross-reference
      var allCrmContacts=await fetchAllContactsWithPhone();
      var hsPhones=extractHubSpotPhones(allCrmContacts);

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

  // --- Email (Brevo) tab functions ---
  var EMAIL_WORKFLOW_IDS=[4,5];
  async function initEmail(){
    setEmailLoading(true);setEmailError(null);
    try{
      console.log("[Email] Running Brevo diagnostic to discover automation data...");
      var diag=await fetchAutomationDiagnostic();
      console.log("[Email] Diagnostic done. Templates:",diag.templates.length,"Events:",diag.events.length);
      // For now, set placeholder data so the UI renders the diagnostic results
      var emptyStats={sent:0,delivered:0,uniqueOpens:0,uniqueClicks:0,hardBounces:0,softBounces:0,unsubscriptions:0,complaints:0};
      var emptyMetrics=calculateMetrics(emptyStats);
      // If aggregated report is available, use it as total
      if(diag.aggregated){
        var agg=diag.aggregated;
        var totalStats={sent:agg.requests||0,delivered:agg.delivered||0,uniqueOpens:agg.uniqueOpens||0,uniqueClicks:agg.uniqueClicks||0,hardBounces:agg.hardBounces||0,softBounces:agg.softBounces||0,unsubscriptions:agg.unsubscribed||0,complaints:agg.spamReports||0};
        var totalMetrics=calculateMetrics(totalStats);
        setEmailData({wf4:{campaigns:[],stats:emptyStats,metrics:emptyMetrics},wf5:{campaigns:[],stats:emptyStats,metrics:emptyMetrics},total:{campaigns:[],stats:totalStats,metrics:totalMetrics}});
      }else{
        setEmailData({wf4:{campaigns:[],stats:emptyStats,metrics:emptyMetrics},wf5:{campaigns:[],stats:emptyStats,metrics:emptyMetrics},total:{campaigns:[],stats:emptyStats,metrics:emptyMetrics}});
      }
      setEmailInited(true);
    }catch(e){console.error("[Email] Error:",e);setEmailError(e.message);}
    finally{setEmailLoading(false);}
  }

  var BRASIL_OWNER_ID="79360573";
  var SOURCE_COLORS={"PAID_SOCIAL":C.accent,"DIRECT_TRAFFIC":C.purple,"ORGANIC_SEARCH":C.green,"REFERRALS":C.cyan,"OFFLINE":C.orange,"OTHER_CAMPAIGNS":C.pink,"EMAIL_MARKETING":C.yellow,"ORGANIC_SOCIAL":C.red,"PAID_SEARCH":"#6366F1"};

  async function initGrowth(monthOverride){
    var selMonth=monthOverride||growthMonth;
    setGrowthLoading(true);setGrowthError(null);
    try{
      // Parse month
      var parts=selMonth.split("-");
      var year=parseInt(parts[0]);var mo=parseInt(parts[1])-1;
      var firstDay=new Date(year,mo,1);
      var lastDay=new Date(year,mo+1,0);
      var now=new Date();
      var currentDay=now.getFullYear()===year&&now.getMonth()===mo?now.getDate():lastDay.getDate();
      var totalDays=lastDay.getDate();

      // Fetch goals + leads + PostHog sources in parallel (independent calls)
      console.log("[Growth] Fetching goals + leads + PostHog since",firstDay.toISOString());
      setPosthogSourcesLoading(true);setPosthogSourcesError(null);
      var nextMonth=new Date(year,mo+1,1);
      var parallelResults=await Promise.allSettled([
        supabase.from("growth_goals").select("*").eq("month",selMonth),
        fetchGrowthLeads(firstDay.toISOString(),"808581652"),
        fetchPostHogSources(firstDay,nextMonth)
      ]);
      // PostHog is non-blocking — handle separately
      if(parallelResults[2].status==="fulfilled"){setPosthogSources(parallelResults[2].value);console.log("[Growth] PostHog sources loaded");}
      else{console.warn("[Growth] PostHog sources failed:",parallelResults[2].reason);setPosthogSourcesError(parallelResults[2].reason&&parallelResults[2].reason.message||"Error al cargar PostHog");}
      setPosthogSourcesLoading(false);
      // Unwrap goals + leads (these are critical)
      if(parallelResults[0].status==="rejected")throw parallelResults[0].reason;
      if(parallelResults[1].status==="rejected")throw parallelResults[1].reason;
      parallelResults=[parallelResults[0].value,parallelResults[1].value];
      var goalsResult=parallelResults[0];
      var leads=parallelResults[1];
      var goalsRows=goalsResult.data||[];
      var goals={latam:{signups:0,pqls:0},brasil:{signups:0,pqls:0}};
      for(var gi=0;gi<goalsRows.length;gi++){
        var gr=goalsRows[gi];
        if(gr.region==="latam"){goals.latam.signups=Number(gr.signups_goal);goals.latam.pqls=Number(gr.pqls_goal);}
        if(gr.region==="brasil"){goals.brasil.signups=Number(gr.signups_goal);goals.brasil.pqls=Number(gr.pqls_goal);}
      }
      setGrowthGoals(goals);

      // Filter to selected month only (leads already filtered by date, but double-check month boundary)
      var monthEnd=new Date(year,mo+1,0,23,59,59,999);
      var filtered=leads.filter(function(l){
        var props=l.properties||{};
        var cd=props.createdate||props.hs_createdate||l.createdAt;
        if(!cd)return false;
        var d=new Date(cd);
        return d>=firstDay&&d<=monthEnd;
      });
      console.log("[Growth] Leads in month:",filtered.length);

      // Split by region using associated contact's hubspot_owner_id
      var latamContacts=[];var brasilContacts=[];
      for(var i=0;i<filtered.length;i++){
        var ownerId=(filtered[i]._contactProps&&filtered[i]._contactProps.hubspot_owner_id)||"";
        if(ownerId===BRASIL_OWNER_ID)brasilContacts.push(filtered[i]);
        else latamContacts.push(filtered[i]);
      }

      // Count PQLs using associated contact's prioridad_plg
      function countPqls(arr){var n=0;for(var j=0;j<arr.length;j++){var p=(arr[j]._contactProps&&arr[j]._contactProps.prioridad_plg)||"";var lo=p.toLowerCase();if(lo==="alta"||lo==="media"||lo==="m\u00E9dia")n++;}return n;}
      var latamPqls=countPqls(latamContacts);
      var brasilPqls=countPqls(brasilContacts);

      // Compute metrics per region
      function computeRegion(signups,pqls,goal){
        var metaToDateSignups=totalDays>0?goal.signups*currentDay/totalDays:0;
        var metaToDatePqls=totalDays>0?goal.pqls*currentDay/totalDays:0;
        return {
          signups:signups,pqls:pqls,
          signupsGoal:goal.signups,pqlsGoal:goal.pqls,
          metaToDateSignups:metaToDateSignups,metaToDatePqls:metaToDatePqls,
          avanceSignups:goal.signups>0?(signups/goal.signups*100):0,
          avancePqls:goal.pqls>0?(pqls/goal.pqls*100):0,
          avanceToDateSignups:metaToDateSignups>0?(signups/metaToDateSignups*100):0,
          avanceToDatePqls:metaToDatePqls>0?(pqls/metaToDatePqls*100):0,
        };
      }
      var latamMetrics=computeRegion(latamContacts.length,latamPqls,goals.latam);
      var brasilMetrics=computeRegion(brasilContacts.length,brasilPqls,goals.brasil);

      // Source breakdown (from associated contact)
      function sourceBreakdown(arr){
        var map={};
        for(var s=0;s<arr.length;s++){
          var src=(arr[s]._contactProps&&arr[s]._contactProps.hs_analytics_source)||"UNKNOWN";
          if(!map[src])map[src]=0;
          map[src]++;
        }
        var items=Object.keys(map).map(function(k){return{source:k,count:map[k]};});
        items.sort(function(a,b){return b.count-a.count;});
        return items;
      }
      var latamSources=sourceBreakdown(latamContacts);
      var brasilSources=sourceBreakdown(brasilContacts);

      // Build summary text
      var pctF=function(v){return v.toFixed(1)+"%";};
      var summary="Growth Update "+selMonth+"\n\n";
      summary+="LATAM\n";
      summary+="Signups: "+latamMetrics.signups+" / "+latamMetrics.signupsGoal+" ("+pctF(latamMetrics.avanceSignups)+" del mes)\n";
      summary+="PQLs: "+latamMetrics.pqls+" / "+latamMetrics.pqlsGoal+" ("+pctF(latamMetrics.avancePqls)+" del mes)\n";
      summary+="Avance to Date: Signups "+pctF(latamMetrics.avanceToDateSignups)+" | PQLs "+pctF(latamMetrics.avanceToDatePqls)+"\n\n";
      summary+="BRASIL\n";
      summary+="Signups: "+brasilMetrics.signups+" / "+brasilMetrics.signupsGoal+" ("+pctF(brasilMetrics.avanceSignups)+" del mes)\n";
      summary+="PQLs: "+brasilMetrics.pqls+" / "+brasilMetrics.pqlsGoal+" ("+pctF(brasilMetrics.avancePqls)+" del mes)\n";
      summary+="Avance to Date: Signups "+pctF(brasilMetrics.avanceToDateSignups)+" | PQLs "+pctF(brasilMetrics.avanceToDatePqls)+"\n\n";
      summary+="Sources (LATAM)\n";
      for(var si=0;si<latamSources.length;si++)summary+="  "+latamSources[si].source+": "+latamSources[si].count+"\n";
      summary+="\nSources (Brasil)\n";
      for(var sj=0;sj<brasilSources.length;sj++)summary+="  "+brasilSources[sj].source+": "+brasilSources[sj].count+"\n";

      setGrowthData({
        latam:latamMetrics,brasil:brasilMetrics,
        latamSources:latamSources,brasilSources:brasilSources,
        latamContacts:latamContacts,brasilContacts:brasilContacts,
        summary:summary,currentDay:currentDay,totalDays:totalDays,
      });
      setGrowthInited(true);
      console.log("[Growth] Done. LATAM:",latamContacts.length,"Brasil:",brasilContacts.length);
    }catch(e){console.error("[Growth] Error:",e);setGrowthError(e.message);}
    finally{setGrowthLoading(false);}
  }

  async function saveGrowthGoals(newGoals){
    var month=growthMonth;
    try{
      await supabase.from("growth_goals").upsert([
        {month:month,region:"latam",signups_goal:newGoals.latam.signups,pqls_goal:newGoals.latam.pqls,updated_at:new Date().toISOString()},
        {month:month,region:"brasil",signups_goal:newGoals.brasil.signups,pqls_goal:newGoals.brasil.pqls,updated_at:new Date().toISOString()},
      ],{onConflict:"month,region"});
      setGrowthGoals(newGoals);
      setShowGoalsEditor(false);
      setGrowthInited(false);
      initGrowth();
    }catch(e){console.error("[Growth] Save goals error:",e);}
  }

  var ADS_FAQ_OPTIONS=[
    "Quiero m\u00E1s informaci\u00F3n sobre el Vendedor IA.",
    "Quiero registrarme para obtener mi Vendedor IA.",
    "\u00BFC\u00F3mo obtengo mi Vendedor IA para Whatsapp?"
  ];
  var ADS_FAQ_SHORT=["Info Vendedor IA","Registrarme","\u00BFC\u00F3mo obtener?"];
  var ADS_FAQ_COLORS=[C.accent,C.green,C.purple];

  function classifyFaq(msg){
    if(!msg)return -1;
    var lo=msg.toLowerCase();
    if(lo.indexOf("quiero m")>=0&&lo.indexOf("informaci")>=0&&lo.indexOf("vendedor ia")>=0)return 0;
    if(lo.indexOf("quiero registrarme")>=0&&lo.indexOf("vendedor ia")>=0)return 1;
    if(lo.indexOf("mo obtengo mi vendedor ia")>=0)return 2;
    return -1;
  }

  function adsCountryFlag(phone){
    if(!phone)return"\u{1F30E}";var p=phone.replace(/^\+/,"");
    if(p.startsWith("52"))return"\u{1F1F2}\u{1F1FD}";if(p.startsWith("54"))return"\u{1F1E6}\u{1F1F7}";
    if(p.startsWith("55"))return"\u{1F1E7}\u{1F1F7}";if(p.startsWith("56"))return"\u{1F1E8}\u{1F1F1}";
    if(p.startsWith("57"))return"\u{1F1E8}\u{1F1F4}";if(p.startsWith("51"))return"\u{1F1F5}\u{1F1EA}";
    if(p.startsWith("593"))return"\u{1F1EA}\u{1F1E8}";if(p.startsWith("58"))return"\u{1F1FB}\u{1F1EA}";
    if(p.startsWith("506"))return"\u{1F1E8}\u{1F1F7}";if(p.startsWith("502"))return"\u{1F1EC}\u{1F1F9}";
    if(p.startsWith("1"))return"\u{1F1FA}\u{1F1F8}";return"\u{1F30E}";
  }

  function parseAdsThread(t){
    var messages=[];
    if(t.values_json){try{var v=JSON.parse(t.values_json);if(v&&v.messages)messages=v.messages;}catch(e){}}
    var conversation=[];var humanMsgCount=0;var wordCount=0;var hasMeetingLink=false;
    for(var mi=0;mi<messages.length;mi++){
      var msg=messages[mi];
      var msgType=msg.type==="human"?1:msg.type==="tool"?3:2;
      var content="";
      if(typeof msg.content==="string")content=msg.content;
      else if(Array.isArray(msg.content))content=msg.content.map(function(b){return typeof b==="string"?b:(b&&b.text||"");}).join("");
      var msgDt="";
      if(msg.additional_kwargs&&msg.additional_kwargs.metadata&&msg.additional_kwargs.metadata.timestamp){
        var ts=msg.additional_kwargs.metadata.timestamp;
        msgDt=typeof ts==="number"?new Date(ts*1000).toISOString():String(ts);
      }
      if(msgType===1){humanMsgCount++;wordCount+=content.split(/\s+/).filter(Boolean).length;}
      if(msg.type==="ai"&&content&&(/meetings\.hubspot\.com\//.test(content)||/yavendio\.com\/[^\s]*meetings/.test(content)))hasMeetingLink=true;
      conversation.push([msgType,content,msgDt]);
    }
    var phone=t.phone_number||"";
    var depth=humanMsgCount<=1?"rebote":humanMsgCount<=4?"corta":humanMsgCount<=9?"media":"profunda";
    return{p:phone,ms:humanMsgCount,w:wordCount,au:false,e:depth,q:"",co:adsCountryFlag(phone),tr:[],fr:null,c:conversation,ml:hasMeetingLink,_faq:classifyFaq(t.first_human_msg),_created:t.thread_created_at,_threadId:t.thread_id};
  }

  async function initAds(monthOverride){
    var selMonth=monthOverride||growthMonth;
    setAdsLoading(true);setAdsError(null);
    try{
      var parts=selMonth.split("-");
      var year=parseInt(parts[0]);var mo=parseInt(parts[1])-1;
      var firstDay=new Date(year,mo,1);
      var lastDay=new Date(year,mo+1,0,23,59,59,999);
      var sinceStr=firstDay.toISOString();
      var untilStr=lastDay.toISOString();

      console.log("[Ads] Fetching threads + lifecycle phones",sinceStr,"to",untilStr);
      var parallel=await Promise.all([
        fetchAdsThreads(sinceStr,untilStr),
        lifecyclePhonesData?Promise.resolve(lifecyclePhonesData):fetchLifecyclePhones().catch(function(e){console.warn("[Ads] Lifecycle phones failed:",e);return {};})
      ]);
      var threads=parallel[0];
      var lcPhones=parallel[1];
      if(!lifecyclePhonesData&&lcPhones)setLifecyclePhonesData(lcPhones);
      console.log("[Ads] Got",threads.length,"threads matching FAQ patterns");

      // Build MeetModal-compatible lead objects
      var leads=[];
      for(var i=0;i<threads.length;i++){leads.push(parseAdsThread(threads[i]));}

      // Classify by FAQ option
      var byFaq=[[],[],[]];
      for(var fi=0;fi<leads.length;fi++){
        var fIdx=leads[fi]._faq;
        if(fIdx>=0)byFaq[fIdx].push(leads[fi]);
      }

      // Meeting offered & confirmed (same logic as inbound: filter CRM meetings by period)
      var meetOffered=leads.filter(function(l){return l.ml;});
      var meetConfirmed=[];
      if(crmMeetings.length>0&&crmContacts.length>0){
        // Filter HubSpot meetings to selected month
        var adsFiltM=crmMeetings.filter(function(m){
          var st=m.properties&&m.properties.hs_createdate||m.createdAt;if(!st)return false;
          var md=new Date(st);return md>=firstDay&&md<=lastDay;
        });
        var adsPeriodPhones=getMeetingContactPhones(adsFiltM,crmContacts);
        // Build expanded phone index (full + last N digits)
        var adsPhIdx={};var adsMpK=Object.keys(adsPeriodPhones);
        for(var ipi=0;ipi<adsMpK.length;ipi++){
          var ipd=adsMpK[ipi];adsPhIdx[ipd]=true;
          if(ipd.length>11)adsPhIdx[ipd.slice(-11)]=true;
          if(ipd.length>10)adsPhIdx[ipd.slice(-10)]=true;
          if(ipd.length>9)adsPhIdx[ipd.slice(-9)]=true;
          if(ipd.length>8)adsPhIdx[ipd.slice(-8)]=true;
        }
        for(var mc=0;mc<meetOffered.length;mc++){
          var mph=(meetOffered[mc].p||"").replace(/\D/g,"");if(!mph)continue;
          var matched=false;
          if(adsPhIdx[mph])matched=true;
          else if(mph.length>11&&adsPhIdx[mph.slice(-11)])matched=true;
          else if(mph.length>10&&adsPhIdx[mph.slice(-10)])matched=true;
          else if(mph.length>9&&adsPhIdx[mph.slice(-9)])matched=true;
          else if(mph.length>8&&adsPhIdx[mph.slice(-8)])matched=true;
          if(matched){meetOffered[mc]._confirmed=true;meetConfirmed.push(meetOffered[mc]);}
        }
      }

      // Signups confirmed (received step 1 of lifecycle)
      var signupConfirmed=[];
      for(var si=0;si<leads.length;si++){
        var sph=(leads[si].p||"").replace(/\D/g,"");
        var lcInfo=sph&&lcPhones?lcPhones[sph]:null;
        if(!lcInfo&&sph.length>10)lcInfo=lcPhones[sph.slice(-10)]||lcPhones[sph.slice(-11)];
        if(lcInfo&&lcInfo.firstStep1At){leads[si].signup=true;signupConfirmed.push(leads[si]);}
      }

      // Daily trend
      var dailyMap={};
      for(var d=1;d<=lastDay.getDate();d++){var key=selMonth+"-"+String(d).padStart(2,"0");dailyMap[key]=0;}
      for(var j=0;j<leads.length;j++){
        var dt=leads[j]._created;
        if(dt){var dayKey=dt.slice(0,10);if(dailyMap[dayKey]!==undefined)dailyMap[dayKey]++;}
      }
      var dailyArr=Object.keys(dailyMap).sort().map(function(k){return{date:k,count:dailyMap[k]};});

      // Country breakdown from phone prefix
      var countryMap={};
      for(var ci=0;ci<leads.length;ci++){
        var ph=leads[ci].p||"";var cc="Desconocido";var pp=ph.replace(/^\+/,"");
        if(pp.startsWith("52"))cc="Mexico";else if(pp.startsWith("54"))cc="Argentina";
        else if(pp.startsWith("55"))cc="Brasil";else if(pp.startsWith("56"))cc="Chile";
        else if(pp.startsWith("57"))cc="Colombia";else if(pp.startsWith("51"))cc="Peru";
        else if(pp.startsWith("593"))cc="Ecuador";else if(pp.startsWith("58"))cc="Venezuela";
        else if(pp.startsWith("506"))cc="Costa Rica";else if(pp.startsWith("502"))cc="Guatemala";
        else if(pp.startsWith("1"))cc="US/Canada";else if(pp.length>3)cc="Otro";
        if(!countryMap[cc])countryMap[cc]=0;countryMap[cc]++;
      }
      var countries=Object.keys(countryMap).map(function(k){return{country:k,count:countryMap[k]};});
      countries.sort(function(a,b){return b.count-a.count;});

      setAdsData({
        total:leads.length,
        byFaq:byFaq,
        daily:dailyArr,
        countries:countries,
        leads:leads,
        meetOffered:meetOffered,
        meetConfirmed:meetConfirmed,
        signupConfirmed:signupConfirmed,
      });
      setAdsInited(true);
      console.log("[Ads] Done. Total:",leads.length,"Meetings offered:",meetOffered.length,"Confirmed:",meetConfirmed.length,"Signups:",signupConfirmed.length);
    }catch(e){console.error("[Ads] Error:",e);setAdsError(e.message);}
    finally{setAdsLoading(false);}
  }

  function loadInboundData(){
    var isResumen=section==="resumen";
    if(!isResumen) setMode(0);
    // Helper: merge inboundHsPhones + crmContacts phones
    function mergePhones(hsPhones){
      var merged=Object.assign({},hsPhones||{});
      if(crmContacts.length>0){Object.assign(merged,extractHubSpotPhones(crmContacts));}
      return Object.keys(merged).length>0?merged:null;
    }
    if(inboundRawRows){
      if(!isResumen){
        var hp=mergePhones(inboundHsPhones);
        var filtered=filterRowsByDate(inboundRawRows,dateFrom,dateTo);
        var result=processInboundRows(filtered,regionFilter,lifecyclePhonesData,hp);
        applyResult(result);
      }
    }else{
      setInboundLoading(true);
      var spPromise=fetchLifecyclePhonesCached().catch(function(e){console.warn("Lifecycle phones query failed:",e);return {};});
      Promise.all([fetchInboundCached(getFirstOfMonth()),spPromise]).then(function(all){
        var csvRows=all[0];var sp=all[1];
        setInboundRawRows(csvRows);
        setLifecyclePhonesData(sp);
        if(!isResumen){
          var hp=mergePhones(inboundHsPhones);
          var filtered2=filterRowsByDate(csvRows,dateFrom,dateTo);
          var result2=processInboundRows(filtered2,regionFilter,sp,hp);
          applyResult(result2);
        }
        setInboundLoading(false);
        // HubSpot phone match — load in background, update when ready
        if(!inboundHsPhones){
          fetchAllContactsWithPhone().then(function(c){
            var fetchedHp=extractHubSpotPhones(c);
            // Merge fetched phones with crmContacts phones
            var merged=Object.assign({},fetchedHp);
            if(crmContacts.length>0){Object.assign(merged,extractHubSpotPhones(crmContacts));}
            var hp2=Object.keys(merged).length>0?merged:null;
            setInboundHsPhones(hp2);
            if(!isResumen){
              var f2=filterRowsByDate(csvRows,dateFrom,dateTo);
              var r2=processInboundRows(f2,regionFilter,sp,hp2);
              applyResult(r2);
            }
          }).catch(function(e){console.warn("HubSpot phones fetch failed:",e);});
        }
      }).catch(function(e){
        console.error("Inbound load error:",e);
        setInboundLoading(false);
      });
    }
  }

  function navigateTo(sec,sub){
    var info=SECTIONS[sec];
    var defaultSub=info&&info.subTabs.length>0?info.subTabs[0]:null;
    setSection(sec);
    setSubTab(sub||defaultSub||"");
    if(sec==="resumen"){ loadInboundData(); }
    else if(sec==="inbound") loadInboundData();
    else if(sec==="outbound"&&rawRows){
      var filtered2=filterRowsByDate(rawRows,dateFrom,dateTo);
      var result2=processCSVRows(filtered2,templateConfig,regionFilter);
      applyResult(result2);
    }
  }

  function applyDateFilter(from,to){
    if(section==="inbound"){
      if(!inboundRawRows) return;
      var filtered=filterRowsByDate(inboundRawRows,from,to);
      var result=processInboundRows(filtered,regionFilter,lifecyclePhonesData,inboundHsPhones);
      applyResult(result);
    }else{
      if(!rawRows) return;
      var filtered2=filterRowsByDate(rawRows,from,to);
      var result2=processCSVRows(filtered2,templateConfig,regionFilter);
      applyResult(result2);
    }
  }

  function onDateFromChange(e){setDateFrom(e.target.value);}
  function onDateToChange(e){setDateTo(e.target.value);}
  function onClickFilter(){setHsDetailDay(null);applyDateFilter(dateFrom,dateTo);}
  function clearDateFilter(){setDateFrom("");setDateTo("");applyDateFilter("","");}
  function onRegionChange(e){var v=e.target.value;setRegionFilter(v);if(section==="inbound"&&inboundRawRows){var filtered=filterRowsByDate(inboundRawRows,dateFrom,dateTo);var result=processInboundRows(filtered,v,lifecyclePhonesData,inboundHsPhones);applyResult(result);}else if(section==="outbound"&&rawRows){var filtered2=filterRowsByDate(rawRows,dateFrom,dateTo);var result2=processCSVRows(filtered2,templateConfig,v);applyResult(result2);}}

  var mk=mode===0?"all":"real";var d=dataD[mk];var funnel=mode===0?funnelAll:funnelReal;var mbt=mode===0?meetByTplAll:meetByTplReal;
  var _jsFiltTc=headerInfo.esTotal+headerInfo.ptTotal;
  var tc=(section==="outbound"&&regionFilter==="all"&&responseStats&&responseStats.outboundTotal)?responseStats.outboundTotal:_jsFiltTc;
  var lpd=headerInfo.leadsPerDay;
  var _jsTc=_jsFiltTc;var _tplScale=(tc>0&&_jsTc>0&&tc>_jsTc)?tc/_jsTc:1;
  function _cS(s){return _tplScale!==1?Math.round(s*_tplScale):s;}
  function _cR(r,s){var cs=_cS(s);return cs>0?((r/cs)*100).toFixed(1)+"%":"0%";}

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
      <div style={{width:48,height:48,borderRadius:"50%",background:C.lRed,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px"}}><span style={{fontSize:24,color:C.red}}>!</span></div>
      <div style={{fontSize:18,fontWeight:700,color:C.text,marginBottom:6}}>Error al cargar datos</div>
      <div style={{fontSize:14,color:C.muted,lineHeight:1.6,marginBottom:16}}>{loadError}</div>
      <button onClick={function(){setLoadError(null);setDbLoading(true);fetchThreads(null,getFirstOfMonth()).then(function(threads){var csvRows=expandThreadMessages(threads);setRawRows(csvRows);var filtered=filterRowsByDate(csvRows,dateFrom,dateTo);var result=processCSVRows(filtered,templateConfig,regionFilter);applyResult(result);setDbLoading(false);}).catch(function(e){setLoadError(e.message||"Error");setDbLoading(false);});}} style={{background:C.accent,color:"#fff",border:"none",borderRadius:10,padding:"10px 24px",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:font}}>Reintentar</button>
    </div>
  </div>);

  var _secKeys=Object.keys(SECTIONS);
  function renderFilterBar(){
    if(section==="resumen") return (<div style={{background:C.card,borderBottom:"1px solid "+C.border,padding:"10px 28px",display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
      <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
        {[{k:"hoy",l:"Hoy"},{k:"ayer",l:"Ayer"},{k:"esta_semana",l:"Esta Semana"},{k:"este_mes",l:"Este Mes"},{k:"ultimos_7",l:"\u00DAlt. 7d"},{k:"ultimos_30",l:"\u00DAlt. 30d"},{k:"mes_pasado",l:"Mes Pasado"}].map(function(p){var a=resumenPreset===p.k;return <button key={p.k} onClick={function(){setResumenPreset(p.k);var r=resolvePreset(p.k);setDateFrom(r.from);setDateTo(r.to);}} style={{background:a?C.accent:"transparent",color:a?"#fff":C.muted,border:"1px solid "+(a?C.accent:C.border),borderRadius:20,padding:"5px 12px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:font,transition:"all 0.15s ease"}}>{p.l}</button>;})}
      </div>
      <div style={{width:1,height:24,background:C.border}}/>
      <div style={{display:"flex",alignItems:"center",gap:6}}>
        <span style={{fontSize:12,color:C.muted}}>De</span>
        <input type="date" value={dateFrom} onChange={function(e){setDateFrom(e.target.value);setResumenPreset("custom");}} style={{padding:"5px 10px",border:"1px solid "+C.border,borderRadius:8,fontSize:13,fontFamily:mono,color:C.text,background:C.rowBg,outline:"none"}}/>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:6}}>
        <span style={{fontSize:12,color:C.muted}}>Hasta</span>
        <input type="date" value={dateTo} onChange={function(e){setDateTo(e.target.value);setResumenPreset("custom");}} style={{padding:"5px 10px",border:"1px solid "+C.border,borderRadius:8,fontSize:13,fontFamily:mono,color:C.text,background:C.rowBg,outline:"none"}}/>
      </div>
    </div>);
    if(section==="outbound") return (<div style={{background:C.card,borderBottom:"1px solid "+C.border,padding:"10px 28px",display:"flex",alignItems:"center",gap:16,flexWrap:"wrap"}}>
      <div style={{display:"flex",background:C.rowAlt,borderRadius:10,padding:3,gap:2,boxShadow:"inset 0 1px 2px #00000008"}}>
        {[{l:"Todas",c:C.accent},{l:"Reales",c:C.green}].map(function(o,i){var a=mode===i;return <button key={i} onClick={function(){setMode(i);}} style={{background:a?o.c:"transparent",color:a?"#fff":C.muted,border:"none",borderRadius:8,padding:"6px 14px",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:font}}>{o.l}</button>;})}
      </div>
      <div style={{width:1,height:24,background:C.border}}/>
      <select value={regionFilter} onChange={onRegionChange} style={{fontSize:12,fontWeight:600,padding:"5px 8px",borderRadius:8,border:"1px solid "+C.border,background:C.rowBg,color:C.text,fontFamily:font,cursor:"pointer"}}>
        <option value="all">LATAM + BR</option>
        <option value="es">LATAM (ES)</option>
        <option value="pt">Brasil (PT)</option>
      </select>
      <div style={{width:1,height:24,background:C.border}}/>
      <div style={{display:"flex",alignItems:"center",gap:6}}>
        <span style={{fontSize:12,color:C.muted}}>De</span>
        <input type="date" value={dateFrom} onChange={onDateFromChange} style={{padding:"5px 10px",border:"1px solid "+C.border,borderRadius:8,fontSize:13,fontFamily:mono,color:C.text,background:C.rowBg,outline:"none"}}/>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:6}}>
        <span style={{fontSize:12,color:C.muted}}>Hasta</span>
        <input type="date" value={dateTo} onChange={onDateToChange} style={{padding:"5px 10px",border:"1px solid "+C.border,borderRadius:8,fontSize:13,fontFamily:mono,color:C.text,background:C.rowBg,outline:"none"}}/>
      </div>
      <button onClick={onClickFilter} style={{background:C.accent,color:"#fff",border:"none",borderRadius:8,padding:"6px 16px",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:font}}>Filtrar</button>
      <span style={{fontSize:12,color:C.accent,fontWeight:700,background:C.lBlue,padding:"4px 10px",borderRadius:6}}>{tc} leads</span>
    </div>);
    if(section==="inbound") return (<div style={{background:C.card,borderBottom:"1px solid "+C.border,padding:"10px 28px",display:"flex",alignItems:"center",gap:16,flexWrap:"wrap"}}>
      <select value={regionFilter} onChange={onRegionChange} style={{fontSize:12,fontWeight:600,padding:"5px 8px",borderRadius:8,border:"1px solid "+C.border,background:C.rowBg,color:C.text,fontFamily:font,cursor:"pointer"}}>
        <option value="all">LATAM + BR</option>
        <option value="es">LATAM (ES)</option>
        <option value="pt">Brasil (PT)</option>
      </select>
      <div style={{width:1,height:24,background:C.border}}/>
      <div style={{display:"flex",alignItems:"center",gap:6}}>
        <span style={{fontSize:12,color:C.muted}}>De</span>
        <input type="date" value={dateFrom} onChange={onDateFromChange} style={{padding:"5px 10px",border:"1px solid "+C.border,borderRadius:8,fontSize:13,fontFamily:mono,color:C.text,background:C.rowBg,outline:"none"}}/>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:6}}>
        <span style={{fontSize:12,color:C.muted}}>Hasta</span>
        <input type="date" value={dateTo} onChange={onDateToChange} style={{padding:"5px 10px",border:"1px solid "+C.border,borderRadius:8,fontSize:13,fontFamily:mono,color:C.text,background:C.rowBg,outline:"none"}}/>
      </div>
      <button onClick={onClickFilter} style={{background:C.accent,color:"#fff",border:"none",borderRadius:8,padding:"6px 16px",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:font}}>Filtrar</button>
      <span style={{fontSize:12,color:C.accent,fontWeight:700,background:C.lBlue,padding:"4px 10px",borderRadius:6}}>{tc} leads</span>
    </div>);
    if(section==="hubspot"&&subTab==="analytics"){
      var _dealOwnerIds={};
      for(var _doi=0;_doi<crmDeals.length;_doi++){var _doId=crmDeals[_doi].properties&&crmDeals[_doi].properties.hubspot_owner_id;if(_doId)_dealOwnerIds[_doId]=true;}
      var _dealOwnerList=Object.keys(_dealOwnerIds).sort(function(a,b){return(crmOwnerMap[a]||a).localeCompare(crmOwnerMap[b]||b);});
      return (<div style={{background:C.card,borderBottom:"1px solid "+C.border,padding:"10px 28px",display:"flex",alignItems:"center",gap:16,flexWrap:"wrap"}}>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          <span style={{fontSize:12,color:C.muted}}>De</span>
          <input type="date" value={dateFrom} onChange={onDateFromChange} style={{padding:"5px 10px",border:"1px solid "+C.border,borderRadius:8,fontSize:13,fontFamily:mono,color:C.text,background:C.rowBg,outline:"none"}}/>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          <span style={{fontSize:12,color:C.muted}}>Hasta</span>
          <input type="date" value={dateTo} onChange={onDateToChange} style={{padding:"5px 10px",border:"1px solid "+C.border,borderRadius:8,fontSize:13,fontFamily:mono,color:C.text,background:C.rowBg,outline:"none"}}/>
        </div>
        <div style={{width:1,height:24,background:C.border}}/>
        <div style={{display:"flex",alignItems:"center",gap:4}}>
          {["all","720627716","833703951"].map(function(pv){
            var pLabel=pv==="all"?"Ambos":pv==="720627716"?"New Sales":"Self Service PLG";
            var isSel=hsDealPipelineFilter===pv;
            return <button key={pv} onClick={function(){setHsDealPipelineFilter(pv);}} style={{background:isSel?C.accent:C.rowBg,color:isSel?"#fff":C.sub,border:"1px solid "+(isSel?C.accent:C.border),borderRadius:8,padding:"5px 12px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:font}}>{pLabel}</button>;
          })}
        </div>
        <div style={{width:1,height:24,background:C.border}}/>
        <div style={{display:"flex",alignItems:"center",gap:4,flexWrap:"wrap"}}>
          {_dealOwnerList.map(function(oid){
            var isSel=hsDealOwnerFilter.indexOf(oid)>=0;
            return <button key={oid} onClick={function(){setHsDealOwnerFilter(function(prev){return prev.indexOf(oid)>=0?prev.filter(function(x){return x!==oid;}):prev.concat([oid]);});}} style={{background:isSel?C.purple:C.rowBg,color:isSel?"#fff":C.sub,border:"1px solid "+(isSel?C.purple:C.border),borderRadius:8,padding:"4px 10px",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:font}}>{crmOwnerMap[oid]||oid}</button>;
          })}
          {hsDealOwnerFilter.length>0 && <button onClick={function(){setHsDealOwnerFilter([]);}} style={{background:"none",border:"none",color:C.muted,fontSize:11,cursor:"pointer",fontWeight:600,textDecoration:"underline"}}>Limpiar</button>}
        </div>
        {crmRefreshing && <span style={{fontSize:12,color:C.orange,fontWeight:600,display:"flex",alignItems:"center",gap:6}}><span style={{width:12,height:12,border:"2px solid "+C.orange,borderTopColor:"transparent",borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>Actualizando...</span>}
      </div>);
    }
    return null;
  }

  var _curSec=SECTIONS[section]||{};
  var _subTabs=_curSec.subTabs||[];
  var _subTabLabels={resumen:"Resumen",engagement:"Engagement",templates:"Templates",grupos:"Grupos",ads:"Ads",analytics:"Analytics",reuniones:"Reuniones"};

  return (<div style={{display:"flex",background:C.bg,minHeight:"100vh",color:C.text,fontFamily:font,fontSize:15}}>
    <link href="https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@400;600;700;800;900&family=JetBrains+Mono:wght@400;700;800&display=swap" rel="stylesheet"/>
    {showM && <MeetModal leads={meetings.filter(function(l){return l.ml;})} mode={mode} onClose={function(){setShowM(false);}} title={"\u{1F4C5} Leads con Oferta de Reuni\u00F3n"} crmContacts={crmContacts}/>}
    {showA && <MeetModal leads={meetings} mode={mode} onClose={function(){setShowA(false);}} title={"\u{1F4AC} Todas las Conversaciones"} crmContacts={crmContacts}/>}
    {showConfirmed && <MeetModal leads={confirmedLeads} mode={mode} onClose={function(){setShowConfirmed(false);}} title={"\u2705 Reuniones Agendadas (Cruce HubSpot)"} crmContacts={crmContacts}/>}
    {qualModalLeads && <MeetModal leads={qualModalLeads} mode={mode} onClose={function(){setQualModalLeads(null);}} title={qualModalTitle} crmContacts={crmContacts}/>}
    {chartDayModalData && <MeetModal leads={chartDayModalData.leads} mode={mode} onClose={function(){setChartDayModalData(null);}} title={chartDayModalData.title} crmContacts={crmContacts}/>}
    {selTpl && <TplModal tpl={selTpl} leads={meetings} mode={mode} onClose={function(){setSelTpl(null);}}/>}
    {topicModal && (function(){
      var tkw=TOPIC_KEYWORDS[topicModal];
      var useHumanOnly=section==="inbound";
      var filtered=meetings.filter(function(l){
        var txt="";for(var ci=0;ci<l.c.length;ci++){if(useHumanOnly?l.c[ci][0]===1:(l.c[ci][0]===1||l.c[ci][0]===2))txt+=" "+l.c[ci][1];}
        var lower=txt.toLowerCase();
        if(!tkw)return false;
        for(var ki=0;ki<tkw.kw.length;ki++){if(lower.includes(tkw.kw[ki]))return true;}
        return false;
      });
      return <MeetModal leads={filtered} mode={mode} onClose={function(){setTopicModal(null);}} title={(tkw?tkw.e+" ":"")+"T\u00F3pico: "+topicModal+" ("+filtered.length+" leads)"} crmContacts={crmContacts}/>;
    })()}

    {/* Search Modal */}
    {searchOpen && (<div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"#00000044",backdropFilter:"blur(4px)",WebkitBackdropFilter:"blur(4px)",zIndex:999,display:"flex",alignItems:"center",justifyContent:"center",padding:20,animation:"fadeInModal 0.2s ease-out"}} onClick={function(){setSearchOpen(false);setSearchSel(null);setSearchThreadData(null);}}>
      <div style={{background:C.card,borderRadius:20,padding:28,maxWidth:700,width:"100%",maxHeight:"88vh",overflowY:"auto",boxShadow:"0 25px 60px #00000025",animation:"scaleInModal 0.2s ease-out"}} onClick={function(e){e.stopPropagation();}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
          <div style={{fontSize:19,fontWeight:900}}>Buscar Conversaci\u00F3n</div>
          <button onClick={function(){setSearchOpen(false);setSearchSel(null);setSearchThreadData(null);}} style={{background:C.rowAlt,border:"none",borderRadius:8,width:36,height:36,fontSize:18,cursor:"pointer",color:C.muted,fontWeight:700}}>{"\u2715"}</button>
        </div>
        <form onSubmit={function(e){e.preventDefault();handleSearch(searchQuery);}} style={{display:"flex",gap:10,marginBottom:14}}>
          <input value={searchQuery} onChange={function(e){setSearchQuery(e.target.value);}} placeholder="Tel\u00E9fono o Thread ID..." style={{flex:1,padding:"12px 16px",border:"1px solid "+C.border,borderRadius:10,fontSize:15,fontFamily:mono,outline:"none",background:C.rowBg,color:C.text}}/>
          <button type="submit" disabled={searchLoading} style={{background:C.accent,color:"#fff",border:"none",borderRadius:10,padding:"12px 24px",fontSize:14,fontWeight:700,cursor:searchLoading?"wait":"pointer",fontFamily:font,opacity:searchLoading?0.6:1}}>{searchLoading?"Buscando...":"Buscar"}</button>
        </form>
        <div style={{fontSize:12,color:C.muted,marginBottom:14}}>Busca por n\u00FAmero de tel\u00E9fono (parcial). Busca en los datos cargados.</div>
        {searchLoading && <div style={{textAlign:"center",padding:40,color:C.muted,fontSize:15}}>Buscando...</div>}
        {searchResults!==null&&!searchLoading&&searchResults.length===0 && (
          <div style={{textAlign:"center",padding:40}}>
            <div style={{fontSize:36,marginBottom:8}}>{"?"}</div>
            <div style={{fontSize:16,fontWeight:700,color:C.muted}}>No se encontraron resultados</div>
            <div style={{fontSize:13,color:C.muted,marginTop:4}}>Intenta con otro n\u00FAmero o thread ID</div>
          </div>
        )}
        {searchResults!==null&&searchResults.length>0&&searchSel===null && (
          <div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
              <div style={{fontSize:16,fontWeight:800}}>{searchResults.length} resultado{searchResults.length!==1?"s":""}</div>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {searchResults.map(function(r,i){
                var l=r.lead;var eC2={alto:C.green,medio:C.accent,bajo:C.yellow,minimo:C.red};var ql=qualLabel(l.q);
                return (<div key={i} onClick={function(){selectSearchResult(i);}} style={{display:"flex",alignItems:"center",gap:14,padding:"14px 16px",background:C.rowBg,borderRadius:12,cursor:"pointer",border:"2px solid transparent"}}>
                  <span style={{fontSize:20}}>{l.co}</span>
                  <div style={{flex:1}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                      <span style={{fontFamily:mono,fontWeight:700,fontSize:16}}>{l.p}</span>
                      {l.hid && <span style={{color:C.accent,fontWeight:600,fontSize:12,marginLeft:4}}>HS #{l.hid}</span>}
                      <Bd color={eC2[l.e]||C.muted}>{l.e}</Bd>
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
          </div>
        )}
        {searchSel!==null&&searchResults&&searchResults[searchSel] && (function(){
          var item=searchResults[searchSel];var lead=item.lead;
          return <ConvView lead={lead} onBack={function(){setSearchSel(null);setSearchThreadData(null);}}/>;
        })()}
      </div>
    </div>)}

    {/* Sidebar */}
    <nav style={{width:56,minHeight:"100vh",background:C.card,borderRight:"1px solid "+C.border,display:"flex",flexDirection:"column",alignItems:"center",position:"sticky",top:0,height:"100vh",flexShrink:0,paddingTop:12,gap:4,zIndex:10}}>
      <div style={{width:36,height:36,borderRadius:10,background:"linear-gradient(135deg, #2563EB, #7C3AED)",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:900,fontSize:16,marginBottom:12,flexShrink:0}}>Y</div>
      {["resumen","outbound","inbound","canales","growth"].map(function(sk){var s=SECTIONS[sk];var a=section===sk;return <SideBtn key={sk} label={s.label} onClick={function(){navigateTo(sk);}} active={a}>{a&&<div style={{position:"absolute",left:0,top:8,bottom:8,width:3,borderRadius:"0 3px 3px 0",background:C.accent}}/>}{s.icon}</SideBtn>;})}
      <div style={{width:28,height:1,background:C.border,margin:"6px 0",flexShrink:0}}/>
      {["hubspot","brevo"].map(function(sk){var s=SECTIONS[sk];var a=section===sk;return <SideBtn key={sk} label={s.label} onClick={function(){navigateTo(sk);}} active={a}>{a&&<div style={{position:"absolute",left:0,top:8,bottom:8,width:3,borderRadius:"0 3px 3px 0",background:C.accent}}/>}{s.icon}</SideBtn>;})}
      <div style={{flex:1}}/>
      <SideBtn label="Buscar" onClick={function(){setSearchOpen(true);}}>{"\uD83D\uDD0D"}</SideBtn>
      <SideBtn label={darkMode?"Modo claro":"Modo oscuro"} onClick={function(){var next=!darkMode;setDarkMode(next);try{localStorage.setItem("yago_dark",next?"1":"0");}catch(e){}}} style={{marginBottom:8}}>{darkMode?"\u2600\uFE0F":"\uD83C\uDF19"}</SideBtn>
    </nav>

    {/* Content Area */}
    <div style={{flex:1,minWidth:0}}>
      {/* Header */}
      <div style={{background:"linear-gradient(135deg, "+C.gradFrom+" 0%, "+C.gradTo+" 100%)",borderBottom:"1px solid "+C.border,padding:"14px 28px",display:"flex",alignItems:"center",gap:14}}>
        <h1 style={{margin:0,fontSize:20,fontWeight:900}}><span style={{background:"linear-gradient(135deg, #2563EB, #7C3AED)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>YAGO</span> <span style={{color:C.muted,fontWeight:400}}>KPI{"'"}s</span></h1>
        <div style={{width:1,height:24,background:C.border}}/>
        <span style={{fontSize:14,fontWeight:800,color:C.text}}>{_curSec.icon} {_curSec.label}</span>
        <span style={{fontSize:13,color:C.muted,background:C.rowAlt,padding:"4px 10px",borderRadius:6,fontWeight:600}}>{headerInfo.dateRange} {"\u00B7"} {tc} leads</span>
      </div>

      {/* Sub-tab bar */}
      {_subTabs.length>0 && (<div style={{background:C.card,borderBottom:"1px solid "+C.border,padding:"8px 28px",display:"flex",gap:4}}>
        {_subTabs.map(function(st){var a=subTab===st;return <button key={st} onClick={function(){setSubTab(st);}} style={{background:a?C.accent:"transparent",color:a?"#fff":C.muted,border:"none",borderRadius:8,padding:"6px 16px",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:font,transition:"all 0.15s ease"}}>{_subTabLabels[st]||st}</button>;})}
      </div>)}

      {/* Filter bar */}
      {renderFilterBar()}

      {/* Content */}
      <div style={{padding:"24px 28px",maxWidth:1300,margin:"0 auto"}}>
      {inboundLoading && <div style={{background:C.lPurple,border:"1px solid "+C.purple+"25",borderRadius:12,padding:"12px 18px",marginBottom:20,display:"flex",gap:12,alignItems:"center"}}><div style={{width:20,height:20,border:"2px solid "+C.purple+"33",borderTopColor:C.purple,borderRadius:"50%",animation:"spin 0.8s linear infinite",flexShrink:0}}/><div><strong style={{color:C.purple}}>Cargando datos inbound...</strong></div></div>}

      {/* ============ RESUMEN SECTION ============ */}
      {section==="resumen" && (function(){
        // --- Outbound leads ---
        var outLeads=[];
        if(rawRows){
          var filtOut=filterRowsByDate(rawRows,dateFrom,dateTo);
          var outResult=processCSVRows(filtOut,templateConfig,"all");
          outLeads=outResult.MEETINGS||[];
        }
        var outTc=outLeads.length;
        var outOferta=outLeads.filter(function(l){return l.ml;}).length;

        // --- Inbound leads ---
        var inbLeads=[];
        if(inboundRawRows){
          var filtInb=filterRowsByDate(inboundRawRows,dateFrom,dateTo);
          var inbResult=processInboundRows(filtInb,"all",lifecyclePhonesData,inboundHsPhones);
          inbLeads=inbResult.MEETINGS||[];
        }
        var inbTc=inbLeads.length;
        var inbOferta=inbLeads.filter(function(l){return l.ml;}).length;

        // --- Combined (tag source) ---
        var totalLeads=outTc+inbTc;
        var totalOferta=outOferta+inbOferta;
        var outPhones={};for(var _oi=0;_oi<outLeads.length;_oi++){var _op=(outLeads[_oi].p||"").replace(/\D/g,"");if(_op)outPhones[_op]=true;}
        var inbPhones={};for(var _ii2=0;_ii2<inbLeads.length;_ii2++){var _ip=(inbLeads[_ii2].p||"").replace(/\D/g,"");if(_ip)inbPhones[_ip]=true;}
        for(var _ti=0;_ti<outLeads.length;_ti++){var _tp=(outLeads[_ti].p||"").replace(/\D/g,"");outLeads[_ti]._src=(_tp&&inbPhones[_tp])?"ambos":"outbound";}
        for(var _ti2=0;_ti2<inbLeads.length;_ti2++){var _tp2=(inbLeads[_ti2].p||"").replace(/\D/g,"");inbLeads[_ti2]._src=(_tp2&&outPhones[_tp2])?"ambos":"inbound";}
        var allLeads=outLeads.concat(inbLeads);

        // --- CRM meetings filtered by date ---
        var filtCrmMeetings=crmMeetings;
        if(dateFrom||dateTo){
          var rfD=dateFrom?new Date(dateFrom+"T00:00:00"):null;
          var rtD=dateTo?new Date(dateTo+"T23:59:59"):null;
          filtCrmMeetings=crmMeetings.filter(function(m){
            var st=m.properties&&m.properties.hs_createdate||m.createdAt;
            if(!st)return false;var md=new Date(st);
            if(rfD&&md<rfD)return false;
            if(rtD&&md>rtD)return false;
            return true;
          });
        }

        // --- Phone matching (cross-ref leads with ml:true vs HubSpot meetings) ---
        var confirmedCount=0;var confirmedArr=[];
        var outConfirmed=0;var inbConfirmed=0;
        if(filtCrmMeetings.length>0&&crmContacts.length>0){
          var periodMeetPhones=getMeetingContactPhones(filtCrmMeetings,crmContacts);
          var contactIdIdx=getMeetingContactIds(filtCrmMeetings);
          var phoneIdx={};
          var mpKeys=Object.keys(periodMeetPhones);
          for(var pi=0;pi<mpKeys.length;pi++){
            var pd=mpKeys[pi];
            phoneIdx[pd]=true;
            if(pd.length>11)phoneIdx[pd.slice(-11)]=true;
            if(pd.length>10)phoneIdx[pd.slice(-10)]=true;
            if(pd.length>9)phoneIdx[pd.slice(-9)]=true;
            if(pd.length>8)phoneIdx[pd.slice(-8)]=true;
          }
          // Check all leads with ml
          var ofertaAll=allLeads.filter(function(l){return l.ml;});
          var ofertaOut=outLeads.filter(function(l){return l.ml;});
          var ofertaInb=inbLeads.filter(function(l){return l.ml;});
          function matchPhone(phone,hid){
            var p=(phone||"").replace(/\D/g,"");
            if(p){
              if(phoneIdx[p])return true;
              if(p.length>11&&phoneIdx[p.slice(-11)])return true;
              if(p.length>10&&phoneIdx[p.slice(-10)])return true;
              if(p.length>9&&phoneIdx[p.slice(-9)])return true;
              if(p.length>8&&phoneIdx[p.slice(-8)])return true;
            }
            if(hid&&contactIdIdx[hid])return true;
            return false;
          }
          for(var ai=0;ai<ofertaAll.length;ai++){
            if(matchPhone(ofertaAll[ai].p,ofertaAll[ai].hid)){confirmedCount++;confirmedArr.push(ofertaAll[ai]);}
          }
          for(var oi=0;oi<ofertaOut.length;oi++){if(matchPhone(ofertaOut[oi].p,ofertaOut[oi].hid))outConfirmed++;}
          for(var ii=0;ii<ofertaInb.length;ii++){if(matchPhone(ofertaInb[ii].p,ofertaInb[ii].hid))inbConfirmed++;}
        }

        // --- Realizadas (COMPLETED) ---
        var realizadas=filtCrmMeetings.filter(function(m){return m.properties&&m.properties.hs_meeting_outcome==="COMPLETED";}).length;
        var realizadasPct=confirmedCount>0?((realizadas/confirmedCount)*100).toFixed(1):"0";

        // --- Outcome stats ---
        var outcomeColor={COMPLETED:C.green,SCHEDULED:C.accent,NO_SHOW:C.red,CANCELED:C.yellow,RESCHEDULED:C.orange,"NO CALIFICADA":C.pink,UNKNOWN:C.muted};
        var outcomeCounts={};
        for(var mi=0;mi<filtCrmMeetings.length;mi++){
          var oc=filtCrmMeetings[mi].properties&&filtCrmMeetings[mi].properties.hs_meeting_outcome||"UNKNOWN";
          outcomeCounts[oc]=(outcomeCounts[oc]||0)+1;
        }
        var outcomeData=Object.keys(outcomeCounts).sort(function(a,b){return outcomeCounts[b]-outcomeCounts[a];}).map(function(k){return {name:k,count:outcomeCounts[k],color:outcomeColor[k]||C.muted};});

        // --- Daily chart data (Leads por Día stacked Out+In) ---
        var dayMap={};
        function addToDay(leads,key){
          for(var di=0;di<leads.length;di++){
            var l=leads[di];
            var dStr="";
            if(l.c&&l.c.length>0){
              for(var ci=0;ci<l.c.length;ci++){if(l.c[ci][2]){var pd2=parseDatetime(l.c[ci][2]);if(pd2){dStr=String(pd2.getDate()).padStart(2,"0")+"/"+String(pd2.getMonth()+1).padStart(2,"0");break;}}}
            }
            if(!dStr) continue;
            if(!dayMap[dStr])dayMap[dStr]={d:dStr,outbound:0,inbound:0,_sort:null};
            dayMap[dStr][key]++;
            if(!dayMap[dStr]._sort&&l.c&&l.c[0]&&l.c[0][2]){dayMap[dStr]._sort=parseDatetime(l.c[0][2]);}
          }
        }
        addToDay(outLeads,"outbound");addToDay(inbLeads,"inbound");
        var dailyLeads=Object.values(dayMap).sort(function(a,b){return (a._sort||0)-(b._sort||0);});

        // --- Daily chart: Ofertas vs Confirmadas vs Realizadas ---
        var dayMap2={};
        // Ofertas by day of the message with the meeting link
        var ofertaAllLeads=allLeads.filter(function(l){return l.ml;});
        for(var ofi=0;ofi<ofertaAllLeads.length;ofi++){
          var ol=ofertaAllLeads[ofi];
          var oDay="";
          for(var oci=0;oci<ol.c.length;oci++){
            if(ol.c[oci][0]===2&&ol.c[oci][1]&&(/meetings\.hubspot\.com\//.test(ol.c[oci][1])||/yavendio\.com\/[^\s]*meetings/.test(ol.c[oci][1]))){
              if(ol.c[oci][2]){var opd=parseDatetime(ol.c[oci][2]);if(opd){oDay=String(opd.getDate()).padStart(2,"0")+"/"+String(opd.getMonth()+1).padStart(2,"0");}}
              break;
            }
          }
          if(!oDay) continue;
          if(!dayMap2[oDay])dayMap2[oDay]={d:oDay,ofertas:0,confirmadas:0,realizadas:0,_sort:null};
          dayMap2[oDay].ofertas++;
          if(!dayMap2[oDay]._sort){var opd2=parseDatetime(ol.c[0]&&ol.c[0][2]);if(opd2)dayMap2[oDay]._sort=opd2;}
        }
        // Confirmadas by hs_createdate
        for(var cfi=0;cfi<filtCrmMeetings.length;cfi++){
          var cm=filtCrmMeetings[cfi];
          var cdt=cm.properties&&cm.properties.hs_createdate||cm.createdAt;
          if(!cdt)continue;var cpd=new Date(cdt);
          var cDay=String(cpd.getDate()).padStart(2,"0")+"/"+String(cpd.getMonth()+1).padStart(2,"0");
          if(!dayMap2[cDay])dayMap2[cDay]={d:cDay,ofertas:0,confirmadas:0,realizadas:0,_sort:cpd};
          dayMap2[cDay].confirmadas++;
          if(!dayMap2[cDay]._sort)dayMap2[cDay]._sort=cpd;
          // Realizadas
          if(cm.properties&&cm.properties.hs_meeting_outcome==="COMPLETED") dayMap2[cDay].realizadas++;
        }
        var dailyFunnel=Object.values(dayMap2).sort(function(a,b){return (a._sort||0)-(b._sort||0);});

        // --- Funnel data ---
        var funnelData=[
          {n:"Conversaciones",v:totalLeads,c:C.accent},
          {n:"Ofertas Reuni\u00F3n",v:totalOferta,c:C.pink},
          {n:"Agendadas (HS)",v:confirmedCount,c:C.green},
          {n:"Realizadas",v:realizadas,c:C.cyan}
        ];

        // --- Conversion table ---
        var outOfertaPct=outTc>0?((outOferta/outTc)*100).toFixed(1):"0";
        var inbOfertaPct=inbTc>0?((inbOferta/inbTc)*100).toFixed(1):"0";
        var totalOfertaPct=totalLeads>0?((totalOferta/totalLeads)*100).toFixed(1):"0";
        var outConfirmPct=outOferta>0?((outConfirmed/outOferta)*100).toFixed(1):"0";
        var inbConfirmPct=inbOferta>0?((inbConfirmed/inbOferta)*100).toFixed(1):"0";
        var totalConfirmPct=totalOferta>0?((confirmedCount/totalOferta)*100).toFixed(1):"0";
        var realizPct=confirmedCount>0?((realizadas/confirmedCount)*100).toFixed(1):"0";

        return (<>
          {/* CRM loading indicator */}
          {crmLoading && <div style={{background:C.lBlue,border:"1px solid "+C.accent+"25",borderRadius:12,padding:"12px 18px",marginBottom:20,display:"flex",gap:12,alignItems:"center"}}><div style={{width:20,height:20,border:"2px solid "+C.accent+"33",borderTopColor:C.accent,borderRadius:"50%",animation:"spin 0.8s linear infinite",flexShrink:0}}/><div><strong style={{color:C.accent}}>Cargando datos de HubSpot...</strong></div></div>}

          {/* KPI Cards */}
          <Sec>INDICADORES PRINCIPALES</Sec>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4, 1fr)",gap:14,marginBottom:24}}>
            {/* Card: Conversaciones */}
            <Cd style={{border:"2px solid "+C.accent+"44",background:"linear-gradient(135deg, "+C.card+" 0%, "+C.lBlue+" 100%)",position:"relative",overflow:"hidden"}}>
              <div style={{position:"absolute",top:-8,right:-8,fontSize:48,opacity:0.04,pointerEvents:"none"}}>{"\u{1F4AC}"}</div>
              <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}>
                <div style={{width:32,height:32,borderRadius:10,background:C.accent+"15",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>{"\u{1F4AC}"}</div>
                <span style={{fontSize:13,color:C.muted,fontWeight:600}}>Conversaciones</span>
              </div>
              <div style={{fontSize:36,fontWeight:900,fontFamily:mono,marginTop:4,lineHeight:1}}>{totalLeads}</div>
              <div style={{fontSize:13,color:C.muted,marginTop:6}}>Out: <strong>{outTc}</strong> / In: <strong>{inbTc}</strong></div>
            </Cd>
            {/* Card: Ofertas de Reunión */}
            <Cd onClick={totalOferta>0?function(){setQualModalLeads(allLeads.filter(function(l){return l.ml;}));setQualModalTitle("\u{1F4C5} Leads con Oferta de Reuni\u00F3n ("+totalOferta+")");}:undefined} style={{border:"2px solid "+C.pink+"44",background:"linear-gradient(135deg, "+C.card+" 0%, "+C.lPurple+" 100%)",position:"relative",overflow:"hidden",cursor:totalOferta>0?"pointer":"default"}}>
              <div style={{position:"absolute",top:-8,right:-8,fontSize:48,opacity:0.04,pointerEvents:"none"}}>{"\u{1F4C5}"}</div>
              <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}>
                <div style={{width:32,height:32,borderRadius:10,background:C.pink+"15",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>{"\u{1F4C5}"}</div>
                <span style={{fontSize:13,color:C.muted,fontWeight:600}}>Ofertas de Reuni{"\u00F3"}n</span>
              </div>
              <div style={{fontSize:36,fontWeight:900,fontFamily:mono,color:C.pink,marginTop:4,lineHeight:1}}>{totalOferta}</div>
              <div style={{fontSize:13,color:C.muted,marginTop:6}}>{totalOfertaPct}% de leads {"\u00B7"} Out: <strong>{outOferta}</strong> / In: <strong>{inbOferta}</strong></div>
            </Cd>
            {/* Card: Agendadas */}
            <Cd onClick={confirmedArr.length>0?function(){setConfirmedLeads(confirmedArr);setShowConfirmed(true);}:undefined} style={{border:"2px solid "+C.green+"44",background:"linear-gradient(135deg, "+C.card+" 0%, "+C.lGreen+" 100%)",position:"relative",overflow:"hidden",cursor:confirmedArr.length>0?"pointer":"default"}}>
              <div style={{position:"absolute",top:-8,right:-8,fontSize:48,opacity:0.04,pointerEvents:"none"}}>{"\u2705"}</div>
              <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}>
                <div style={{width:32,height:32,borderRadius:10,background:C.green+"15",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>{"\u2705"}</div>
                <span style={{fontSize:13,color:C.muted,fontWeight:600}}>Reuniones Agendadas</span>
              </div>
              <div style={{fontSize:36,fontWeight:900,fontFamily:mono,color:C.green,marginTop:4,lineHeight:1}}>{confirmedCount}</div>
              <div style={{fontSize:13,color:C.muted,marginTop:6}}>{totalOferta>0?((confirmedCount/totalOferta)*100).toFixed(1):"0"}% de ofertas {"\u00B7"} Out: <strong>{outConfirmed}</strong> / In: <strong>{inbConfirmed}</strong></div>
            </Cd>
            {/* Card: Realizadas */}
            <Cd onClick={realizadas>0?function(){setHsReunionOutcomeFilter("COMPLETED");navigateTo("hubspot","reuniones");}:undefined} style={{border:"2px solid "+C.cyan+"44",background:"linear-gradient(135deg, "+C.card+" 0%, "+C.lBlue+" 100%)",position:"relative",overflow:"hidden",cursor:realizadas>0?"pointer":"default"}}>
              <div style={{position:"absolute",top:-8,right:-8,fontSize:48,opacity:0.04,pointerEvents:"none"}}>{"\u{1F3AF}"}</div>
              <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}>
                <div style={{width:32,height:32,borderRadius:10,background:C.cyan+"15",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>{"\u{1F3AF}"}</div>
                <span style={{fontSize:13,color:C.muted,fontWeight:600}}>Reuniones Realizadas</span>
              </div>
              <div style={{fontSize:36,fontWeight:900,fontFamily:mono,color:C.cyan,marginTop:4,lineHeight:1}}>{realizadas}</div>
              <div style={{fontSize:13,color:C.muted,marginTop:6}}>{realizadasPct}% de agendadas {"\u00B7"} {filtCrmMeetings.length} en HubSpot</div>
            </Cd>
          </div>

          {/* Funnel + Outcome distribution */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:24}}>
            <Cd><Sec>Embudo de Conversi{"\u00F3"}n</Sec>
              {funnelData.map(function(f,i){var base=funnelData[0].v||1;var w=Math.max((f.v/base)*100,3);var prev=i>0?((f.v/(funnelData[i-1].v||1))*100).toFixed(0):null;
                return (<div key={i} style={{marginBottom:10}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}><span style={{fontSize:14,color:C.sub,fontWeight:500}}><span style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:20,height:20,borderRadius:6,background:f.c+"18",color:f.c,fontSize:11,fontWeight:800,marginRight:6}}>{i+1}</span>{f.n}</span><div><span style={{fontSize:17,fontWeight:800,fontFamily:mono}}>{f.v}</span><span style={{fontSize:13,color:C.muted,marginLeft:6}}>{(f.v/base*100).toFixed(1)}%</span>{prev && <span style={{fontSize:12,color:parseFloat(prev)>=50?C.green:parseFloat(prev)>=20?C.yellow:C.red,marginLeft:6}}>({prev}%{"\u2193"})</span>}</div></div><div style={{height:24,background:C.rowAlt,borderRadius:6,overflow:"hidden"}}><div style={{height:"100%",width:w+"%",background:"linear-gradient(90deg, "+f.c+" 0%, "+f.c+"CC 100%)",borderRadius:6,transition:"width 0.5s ease"}}/></div></div>);})}
            </Cd>
            <Cd><Sec>Distribuci{"\u00F3"}n de Resultados (HubSpot)</Sec>
              {outcomeData.length>0 ? outcomeData.map(function(o,i){var maxC=outcomeData[0].count||1;var w2=Math.max((o.count/maxC)*100,3);
                return (<div key={i} onClick={function(){setHsReunionOutcomeFilter(o.name);navigateTo("hubspot","reuniones");}} style={{marginBottom:8,cursor:"pointer",borderRadius:6,padding:"4px 6px",transition:"background 0.15s ease"}} onMouseEnter={function(e){e.currentTarget.style.background=C.rowAlt;}} onMouseLeave={function(e){e.currentTarget.style.background="transparent";}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}><span style={{fontSize:13,fontWeight:600,color:o.color}}>{o.name}</span><span style={{fontSize:14,fontWeight:800,fontFamily:mono}}>{o.count}</span></div><div style={{height:18,background:C.rowAlt,borderRadius:4,overflow:"hidden"}}><div style={{height:"100%",width:w2+"%",background:o.color,borderRadius:4,opacity:0.7,transition:"width 0.4s ease"}}/></div></div>);
              }) : <div style={{fontSize:13,color:C.muted,padding:20,textAlign:"center"}}>Sin datos de reuniones en HubSpot para este per{"\u00ED"}odo</div>}
            </Cd>
          </div>

          {/* Chart: Leads por Día stacked */}
          <Cd style={{marginBottom:24}}><Sec>Leads por D{"\u00ED"}a (Outbound + Inbound)</Sec>
            {dailyLeads.length>0 ? <ResponsiveContainer width="100%" height={220}><BarChart data={dailyLeads} margin={{left:-15,right:5,top:5,bottom:0}}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border}/><XAxis dataKey="d" tick={{fontSize:11,fill:C.muted}}/><YAxis tick={{fontSize:11,fill:C.muted}} allowDecimals={false}/>
              <Tooltip contentStyle={{background:C.card,border:"1px solid "+C.border,borderRadius:8,fontSize:13,color:C.text}}/>
              <Legend wrapperStyle={{fontSize:12}}/>
              <Bar dataKey="outbound" name="Outbound" stackId="a" fill={C.accent} radius={[0,0,0,0]}/>
              <Bar dataKey="inbound" name="Inbound" stackId="a" fill={C.purple} radius={[4,4,0,0]}/>
            </BarChart></ResponsiveContainer> : <div style={{fontSize:13,color:C.muted,padding:20,textAlign:"center"}}>Sin datos para el per{"\u00ED"}odo seleccionado</div>}
          </Cd>

          {/* Chart: Ofertas vs Agendadas vs Realizadas */}
          <Cd style={{marginBottom:24}}><Sec>Ofertas vs Agendadas vs Realizadas por D{"\u00ED"}a</Sec>
            {dailyFunnel.length>0 ? <ResponsiveContainer width="100%" height={220}><BarChart data={dailyFunnel} margin={{left:-15,right:5,top:5,bottom:0}}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border}/><XAxis dataKey="d" tick={{fontSize:11,fill:C.muted}}/><YAxis tick={{fontSize:11,fill:C.muted}} allowDecimals={false}/>
              <Tooltip contentStyle={{background:C.card,border:"1px solid "+C.border,borderRadius:8,fontSize:13,color:C.text}}/>
              <Legend wrapperStyle={{fontSize:12}}/>
              <Bar dataKey="ofertas" name="Ofertas" fill={C.pink}/>
              <Bar dataKey="confirmadas" name="Agendadas" fill={C.green}/>
              <Bar dataKey="realizadas" name="Realizadas" fill={C.cyan}/>
            </BarChart></ResponsiveContainer> : <div style={{fontSize:13,color:C.muted,padding:20,textAlign:"center"}}>Sin datos para el per{"\u00ED"}odo seleccionado</div>}
          </Cd>

          {/* Conversion Table: Outbound vs Inbound */}
          <Cd style={{marginBottom:24,overflowX:"auto"}}><Sec>Conversi{"\u00F3"}n: Outbound vs Inbound</Sec>
            <table style={{width:"100%",borderCollapse:"separate",borderSpacing:"0 4px",fontSize:14}}>
              <thead><tr>{["M\u00E9trica","Outbound","Inbound","Total"].map(function(h,i){return <th key={i} style={{padding:"10px 14px",textAlign:i===0?"left":"center",color:C.muted,fontWeight:700,fontSize:12,textTransform:"uppercase",borderBottom:"2px solid "+C.border}}>{h}</th>;})}</tr></thead>
              <tbody>
                {[
                  {m:"Conversaciones",o:outTc,i:inbTc,t:totalLeads},
                  {m:"Ofertas Reuni\u00F3n",o:outOferta,i:inbOferta,t:totalOferta},
                  {m:"Tasa Oferta/Leads",o:outOfertaPct+"%",i:inbOfertaPct+"%",t:totalOfertaPct+"%"},
                  {m:"Agendadas",o:outConfirmed,i:inbConfirmed,t:confirmedCount},
                  {m:"Tasa Confirm/Oferta",o:outConfirmPct+"%",i:inbConfirmPct+"%",t:totalConfirmPct+"%"},
                  {m:"Realizadas (COMPLETED)",o:"\u2014",i:"\u2014",t:realizadas},
                  {m:"Tasa Realiz/Confirm",o:"\u2014",i:"\u2014",t:realizPct+"%"}
                ].map(function(r,i){return(<tr key={i} style={{background:i%2===0?C.rowBg:"transparent"}}><td style={{padding:"12px 14px",fontWeight:600,borderRadius:"8px 0 0 8px"}}>{r.m}</td><td style={{padding:"12px 14px",fontWeight:800,fontFamily:mono,fontSize:15,textAlign:"center",color:C.accent}}>{r.o}</td><td style={{padding:"12px 14px",fontWeight:800,fontFamily:mono,fontSize:15,textAlign:"center",color:C.purple}}>{r.i}</td><td style={{padding:"12px 14px",fontWeight:800,fontFamily:mono,fontSize:15,textAlign:"center",borderRadius:"0 8px 8px 0"}}>{r.t}</td></tr>);})}
              </tbody>
            </table>
          </Cd>
        </>);
      })()}

      {section==="outbound"&&subTab==="resumen" && (function(){var cd=null; return (<>
          {/* Outbound: 4 KPI funnel cards */}
          <div style={{fontSize:13,color:C.muted,textTransform:"uppercase",letterSpacing:1.5,fontWeight:700,marginBottom:10,paddingBottom:8,borderBottom:"2px solid "+C.border+"66",display:"flex",alignItems:"center",gap:8}}>{"\u{1F4CA}"} GENERAL</div>
          {(function(){
            var sqlTotal=(regionFilter==="all"&&responseStats)?responseStats.outboundTotal:null;
            var sqlResp=(regionFilter==="all"&&responseStats)?responseStats.outboundResponded:null;
            var sqlRespReal=(regionFilter==="all"&&responseStats)?responseStats.outboundRespondedReal:null;
            var contactados=sqlTotal||tc;
            var respCount=mode===1?(sqlRespReal!=null?sqlRespReal:d.resp):(sqlResp!=null?sqlResp:d.resp);
            var respRate=contactados>0?((respCount/contactados)*100).toFixed(1):"0";
            var twoMsgCount=meetings.filter(function(m){return m.ms>=2&&(mode===0||!m.au);}).length;
            var twoMsgPct=respCount>0?((twoMsgCount/respCount)*100).toFixed(1):"0";
            var ofertaCount=d.mc;
            var ofertaVsResp=respCount>0?((ofertaCount/respCount)*100).toFixed(1):"0";
            var ofertaVsTotal=contactados>0?((ofertaCount/contactados)*100).toFixed(1):"0";
            // Filter HS meetings by active date period
            var periodMeetPhones=null;
            if(crmMeetings.length>0&&crmContacts.length>0){
              var fromD2=dateFrom?new Date(dateFrom+"T00:00:00"):null;
              var toD2=dateTo?new Date(dateTo+"T23:59:59"):null;
              var filtMeetings=crmMeetings;
              if(fromD2||toD2){
                filtMeetings=crmMeetings.filter(function(m){
                  var st=m.properties&&m.properties.hs_createdate||m.createdAt;
                  if(!st)return false;var md=new Date(st);
                  if(fromD2&&md<fromD2)return false;
                  if(toD2&&md>toD2)return false;
                  return true;
                });
              }
              periodMeetPhones=getMeetingContactPhones(filtMeetings,crmContacts);
            }
            var contactIdIdx=filtMeetings?getMeetingContactIds(filtMeetings):{};
            // Cross only leads with ml:true (received meeting link) against HS meetings
            var actualMeetCount=0;
            var confirmedArr=[];
            if(periodMeetPhones){
              // Build expanded phone index: full digits + last 11 + last 10 for each HS phone
              var phoneIdx={};
              var mpKeys=Object.keys(periodMeetPhones);
              for(var pi=0;pi<mpKeys.length;pi++){
                var pd=mpKeys[pi];
                phoneIdx[pd]=true;
                if(pd.length>11)phoneIdx[pd.slice(-11)]=true;
                if(pd.length>10)phoneIdx[pd.slice(-10)]=true;
                if(pd.length>9)phoneIdx[pd.slice(-9)]=true;
                if(pd.length>8)phoneIdx[pd.slice(-8)]=true;
              }
              var ofertaLeadsArr=meetings.filter(function(l){return l.ml;});
              for(var ami=0;ami<ofertaLeadsArr.length;ami++){
                var olLead=ofertaLeadsArr[ami];
                var olPhone=(olLead.p||"").replace(/\D/g,"");
                // Check full number + suffix variants against the index
                var matched=false;
                if(olPhone){
                  if(phoneIdx[olPhone])matched=true;
                  else if(olPhone.length>11&&phoneIdx[olPhone.slice(-11)])matched=true;
                  else if(olPhone.length>10&&phoneIdx[olPhone.slice(-10)])matched=true;
                  else if(olPhone.length>9&&phoneIdx[olPhone.slice(-9)])matched=true;
                  else if(olPhone.length>8&&phoneIdx[olPhone.slice(-8)])matched=true;
                }
                if(!matched&&olLead.hid&&contactIdIdx[olLead.hid])matched=true;
                if(matched){actualMeetCount++;confirmedArr.push(olLead);}
              }
            }
            // Leads that received meeting link but did NOT book
            var confirmedSet={};for(var ci=0;ci<confirmedArr.length;ci++){confirmedSet[confirmedArr[ci].p||""]=true;}
            var notBookedArr=meetings.filter(function(l){return l.ml&&(mode===0||!l.au)&&!confirmedSet[l.p||""];});
            var notBookedCount=notBookedArr.length;
            var actualVsOferta=ofertaCount>0?((actualMeetCount/ofertaCount)*100).toFixed(1):"0";
            var actualVsTotal=contactados>0?((actualMeetCount/contactados)*100).toFixed(1):"0";
            return (
          <div style={{display:"grid",gridTemplateColumns:"repeat(4, 1fr)",gap:12,marginBottom:22}}>
            {/* Card 1: Contactados */}
            <Cd onClick={function(){setShowA(true);}} style={{position:"relative",cursor:"pointer",border:"2px solid "+C.accent+"44",background:"linear-gradient(135deg, "+C.card+" 0%, "+C.lBlue+" 100%)"}}>
              <div style={{position:"absolute",top:-8,right:-8,fontSize:48,opacity:0.04,pointerEvents:"none"}}>{"\u{1F4E9}"}</div>
              <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}>
                <div style={{width:32,height:32,borderRadius:10,background:C.accent+"15",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>{"\u{1F4E9}"}</div>
                <span style={{fontSize:13,color:C.muted,fontWeight:600}}>Contactados</span>
                <InfoTip dark={_isDark} data={TIPS.contactados}/>
              </div>
              <div style={{fontSize:32,fontWeight:800,fontFamily:mono,lineHeight:1}}>{contactados}</div>
              <div style={{fontSize:13,color:C.muted,marginTop:4}}>{lpd}/d{"\u00ED"}a</div>
              <div style={{fontSize:11,color:C.accent,fontWeight:700,marginTop:6}}>{"\u{1F4AC} Ver conversaciones \u2192"}</div>
            </Cd>
            {/* Card 2: Respuestas */}
            <Cd onClick={function(){setShowA(true);}} style={{position:"relative",cursor:"pointer",border:"2px solid "+C.purple+"44",background:"linear-gradient(135deg, "+C.card+" 0%, "+C.lPurple+" 100%)"}}>
              <div style={{position:"absolute",top:-8,right:-8,fontSize:48,opacity:0.04,pointerEvents:"none"}}>{"\u{1F4CA}"}</div>
              <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}>
                <div style={{width:32,height:32,borderRadius:10,background:C.purple+"15",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>{"\u{1F4CA}"}</div>
                <span style={{fontSize:13,color:C.muted,fontWeight:600}}>Respuestas</span>
                <InfoTip dark={_isDark} data={TIPS.respuestaRate}/>
              </div>
              <div style={{fontSize:32,fontWeight:800,fontFamily:mono,lineHeight:1}}>{respCount}</div>
              <div style={{fontSize:13,color:C.muted,marginTop:4}}>{respRate}% de los contactados</div>
              <div style={{marginTop:6,fontSize:12,color:C.purple,fontWeight:600,borderTop:"1px solid "+C.border,paddingTop:6}}>{twoMsgCount} con 2+ msgs ({twoMsgPct}%)</div>
              <div style={{fontSize:11,color:C.purple,fontWeight:700,marginTop:4}}>{"\u{1F4AC} Ver conversaciones \u2192"}</div>
            </Cd>
            {/* Card 3: Oferta de Reunión */}
            <Cd onClick={function(){var tagged=meetings.filter(function(l){return l.ml;}).map(function(l){var lp=(l.p||"").replace(/\D/g,"");var isConf=false;if(lp&&typeof phoneIdx!=="undefined"&&phoneIdx){if(phoneIdx[lp])isConf=true;else if(lp.length>11&&phoneIdx[lp.slice(-11)])isConf=true;else if(lp.length>10&&phoneIdx[lp.slice(-10)])isConf=true;else if(lp.length>9&&phoneIdx[lp.slice(-9)])isConf=true;else if(lp.length>8&&phoneIdx[lp.slice(-8)])isConf=true;}if(!isConf&&l.hid&&contactIdIdx[l.hid])isConf=true;return Object.assign({},l,{_confirmed:isConf});});setChartDayModalData({title:"\u{1F4C5} Leads con Oferta de Reuni\u00F3n",leads:tagged});}} style={{position:"relative",cursor:"pointer",border:"2px solid "+C.pink+"44",background:"linear-gradient(135deg, "+C.card+" 0%, "+C.lRed+" 100%)"}}>
              <div style={{position:"absolute",top:-8,right:-8,fontSize:48,opacity:0.04,pointerEvents:"none"}}>{"\u{1F4C5}"}</div>
              <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}>
                <div style={{width:32,height:32,borderRadius:10,background:C.pink+"15",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>{"\u{1F4C5}"}</div>
                <span style={{fontSize:13,color:C.muted,fontWeight:600}}>Oferta Reuni{"\u00F3"}n</span>
                <InfoTip dark={_isDark} data={TIPS.ofertaReunion}/>
              </div>
              <div style={{fontSize:32,fontWeight:800,fontFamily:mono,lineHeight:1}}>{ofertaCount}</div>
              <div style={{fontSize:13,color:C.muted,marginTop:4}}>{ofertaVsResp}% de respuestas {"\u00B7"} {ofertaVsTotal}% del total</div>
              <div style={{fontSize:11,color:C.pink,fontWeight:700,marginTop:6}}>{"\u{1F4C5} Ver contactos \u2192"}</div>
              {periodMeetPhones&&notBookedCount>0&&<div onClick={function(e){e.stopPropagation();var nbTagged=notBookedArr.map(function(l){return Object.assign({},l,{_confirmed:false});});setChartDayModalData({title:"\u274C Leads que NO agendaron reuni\u00F3n ("+notBookedCount+")",leads:nbTagged});}} style={{fontSize:11,color:"#e67e22",fontWeight:700,marginTop:4,borderTop:"1px solid "+C.border,paddingTop:4,cursor:"pointer"}}>{"\u{1F50D} Ver "+notBookedCount+" que no agendaron \u2192"}</div>}
            </Cd>
            {/* Card 4: Reunión Agendada (HubSpot cross-reference) */}
            <Cd onClick={function(){if(confirmedArr.length>0){setConfirmedLeads(confirmedArr);setShowConfirmed(true);}}} style={{position:"relative",cursor:periodMeetPhones&&actualMeetCount>0?"pointer":"default",border:"2px solid "+C.green+"44",background:"linear-gradient(135deg, "+C.card+" 0%, "+C.lGreen+" 100%)"}}>
              <div style={{position:"absolute",top:-8,right:-8,fontSize:48,opacity:0.04,pointerEvents:"none"}}>{"\u2705"}</div>
              <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}>
                <div style={{width:32,height:32,borderRadius:10,background:C.green+"15",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>{"\u2705"}</div>
                <span style={{fontSize:13,color:C.muted,fontWeight:600}}>Reuni{"\u00F3"}n Agendada</span>
              </div>
              {periodMeetPhones?(<>
                <div style={{fontSize:32,fontWeight:800,fontFamily:mono,lineHeight:1,color:C.green}}>{actualMeetCount}</div>
                <div style={{fontSize:13,color:C.muted,marginTop:4}}>{actualVsOferta}% de ofertas {"\u00B7"} {actualVsTotal}% del total</div>
                <div style={{fontSize:11,color:C.green,fontWeight:700,marginTop:6,borderTop:"1px solid "+C.border,paddingTop:6}}>{actualMeetCount>0?"\u2705 Ver reuniones \u2192":"Cruce con HubSpot Meetings"}</div>
              </>):(<>
                <div style={{fontSize:24,fontWeight:800,fontFamily:mono,lineHeight:1,color:C.muted}}>...</div>
                <div style={{fontSize:12,color:C.muted,marginTop:4}}>{crmLoading?"Cargando HubSpot...":"Esperando datos HubSpot"}</div>
              </>)}
            </Cd>
          </div>
            );
          })()}
          {/* Qualified KPI Cards: Alta + Media */}
          {(function(){
            function isQual(q){if(!q)return false;var lo=q.toLowerCase();return lo==="alta"||lo==="media"||lo==="m\u00E9dia";}
            var qContactados=0;var qk=Object.keys(totalContactadosByQual);for(var qi=0;qi<qk.length;qi++){if(isQual(qk[qi]))qContactados+=totalContactadosByQual[qk[qi]];}
            var qMeetings=meetings.filter(function(m){return isQual(m.q)&&(mode===0||!m.au);});
            var qResp=qMeetings.length;
            var qRespRate=qContactados>0?((qResp/qContactados)*100).toFixed(1):"0";
            var qTwoMsg=qMeetings.filter(function(m){return m.ms>=2;}).length;
            var qTwoMsgPct=qResp>0?((qTwoMsg/qResp)*100).toFixed(1):"0";
            var qOferta=qMeetings.filter(function(m){return m.ml;}).length;
            var qOfertaVsResp=qResp>0?((qOferta/qResp)*100).toFixed(1):"0";
            var qOfertaVsTotal=qContactados>0?((qOferta/qContactados)*100).toFixed(1):"0";
            var qPeriodPhones=null;
            if(crmMeetings.length>0&&crmContacts.length>0){
              var qFromD=dateFrom?new Date(dateFrom+"T00:00:00"):null;
              var qToD=dateTo?new Date(dateTo+"T23:59:59"):null;
              var qFiltM=crmMeetings;
              if(qFromD||qToD){qFiltM=crmMeetings.filter(function(m){var st=m.properties&&m.properties.hs_createdate||m.createdAt;if(!st)return false;var md=new Date(st);if(qFromD&&md<qFromD)return false;if(qToD&&md>qToD)return false;return true;});}
              qPeriodPhones=getMeetingContactPhones(qFiltM,crmContacts);
            }
            var qContactIdIdx=qFiltM?getMeetingContactIds(qFiltM):{};
            var qActualMeet=0;var qConfirmedArr=[];
            if(qPeriodPhones){
              var qPhIdx={};var qMpK=Object.keys(qPeriodPhones);
              for(var qpi=0;qpi<qMpK.length;qpi++){var qpd=qMpK[qpi];qPhIdx[qpd]=true;if(qpd.length>11)qPhIdx[qpd.slice(-11)]=true;if(qpd.length>10)qPhIdx[qpd.slice(-10)]=true;if(qpd.length>9)qPhIdx[qpd.slice(-9)]=true;if(qpd.length>8)qPhIdx[qpd.slice(-8)]=true;}
              var qOfertaLeads=qMeetings.filter(function(l){return l.ml;});
              for(var qai=0;qai<qOfertaLeads.length;qai++){
                var qOlLead=qOfertaLeads[qai];
                var qOlP=(qOlLead.p||"").replace(/\D/g,"");
                var qMatched=false;
                if(qOlP){
                  if(qPhIdx[qOlP])qMatched=true;
                  else if(qOlP.length>11&&qPhIdx[qOlP.slice(-11)])qMatched=true;
                  else if(qOlP.length>10&&qPhIdx[qOlP.slice(-10)])qMatched=true;
                  else if(qOlP.length>9&&qPhIdx[qOlP.slice(-9)])qMatched=true;
                  else if(qOlP.length>8&&qPhIdx[qOlP.slice(-8)])qMatched=true;
                }
                if(!qMatched&&qOlLead.hid&&qContactIdIdx[qOlLead.hid])qMatched=true;
                if(qMatched){qActualMeet++;qConfirmedArr.push(qOfertaLeads[qai]);}
              }
            }
            // Qualified leads that received meeting link but did NOT book
            var qConfSet={};for(var qci=0;qci<qConfirmedArr.length;qci++){qConfSet[qConfirmedArr[qci].p||""]=true;}
            var qNotBookedArr=qMeetings.filter(function(l){return l.ml&&!qConfSet[l.p||""];});
            var qNotBookedCount=qNotBookedArr.length;
            var qActualVsOferta=qOferta>0?((qActualMeet/qOferta)*100).toFixed(1):"0";
            var qActualVsTotal=qContactados>0?((qActualMeet/qContactados)*100).toFixed(1):"0";
            var qLpd=lpd>0&&tc>0?Math.round(qContactados/(tc/lpd)):0;
            return (<>
          <div style={{fontSize:13,color:C.green,textTransform:"uppercase",letterSpacing:1.5,fontWeight:700,marginBottom:10,marginTop:6,paddingBottom:8,borderBottom:"2px solid "+C.green+"33",display:"flex",alignItems:"center",gap:8}}>{"\u2B50"} CALIFICADOS: ALTA + MEDIA</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4, 1fr)",gap:12,marginBottom:22}}>
            <Cd onClick={function(){setQualModalLeads(qMeetings);setQualModalTitle("\u{1F4AC} Conversaciones Calificados (Alta + Media)");}} style={{position:"relative",cursor:"pointer",border:"2px solid "+C.accent+"44",background:"linear-gradient(135deg, "+C.card+" 0%, "+C.lBlue+" 100%)"}}>
              <div style={{position:"absolute",top:-8,right:-8,fontSize:48,opacity:0.04,pointerEvents:"none"}}>{"\u{1F4E9}"}</div>
              <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}>
                <div style={{width:32,height:32,borderRadius:10,background:C.accent+"15",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>{"\u{1F4E9}"}</div>
                <span style={{fontSize:13,color:C.muted,fontWeight:600}}>Contactados</span>
              </div>
              <div style={{fontSize:32,fontWeight:800,fontFamily:mono,lineHeight:1}}>{qContactados}</div>
              <div style={{fontSize:13,color:C.muted,marginTop:4}}>{qLpd}/d{"\u00ED"}a</div>
              <div style={{fontSize:11,color:C.accent,fontWeight:700,marginTop:6}}>{"\u{1F4AC} Ver conversaciones \u2192"}</div>
            </Cd>
            <Cd onClick={function(){setQualModalLeads(qMeetings);setQualModalTitle("\u{1F4AC} Respuestas Calificados (Alta + Media)");}} style={{position:"relative",cursor:"pointer",border:"2px solid "+C.purple+"44",background:"linear-gradient(135deg, "+C.card+" 0%, "+C.lPurple+" 100%)"}}>
              <div style={{position:"absolute",top:-8,right:-8,fontSize:48,opacity:0.04,pointerEvents:"none"}}>{"\u{1F4CA}"}</div>
              <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}>
                <div style={{width:32,height:32,borderRadius:10,background:C.purple+"15",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>{"\u{1F4CA}"}</div>
                <span style={{fontSize:13,color:C.muted,fontWeight:600}}>Respuestas</span>
              </div>
              <div style={{fontSize:32,fontWeight:800,fontFamily:mono,lineHeight:1}}>{qResp}</div>
              <div style={{fontSize:13,color:C.muted,marginTop:4}}>{qRespRate}% de los contactados</div>
              <div style={{marginTop:6,fontSize:12,color:C.purple,fontWeight:600,borderTop:"1px solid "+C.border,paddingTop:6}}>{qTwoMsg} con 2+ msgs ({qTwoMsgPct}%)</div>
              <div style={{fontSize:11,color:C.purple,fontWeight:700,marginTop:4}}>{"\u{1F4AC} Ver conversaciones \u2192"}</div>
            </Cd>
            <Cd onClick={function(){var tagged=qMeetings.filter(function(l){return l.ml;}).map(function(l){var lp=(l.p||"").replace(/\D/g,"");var isConf=false;if(lp&&typeof qPhIdx!=="undefined"&&qPhIdx){if(qPhIdx[lp])isConf=true;else if(lp.length>11&&qPhIdx[lp.slice(-11)])isConf=true;else if(lp.length>10&&qPhIdx[lp.slice(-10)])isConf=true;else if(lp.length>9&&qPhIdx[lp.slice(-9)])isConf=true;else if(lp.length>8&&qPhIdx[lp.slice(-8)])isConf=true;}if(!isConf&&l.hid&&qContactIdIdx[l.hid])isConf=true;return Object.assign({},l,{_confirmed:isConf});});setChartDayModalData({title:"\u{1F4C5} Oferta Reuni\u00F3n Calificados (Alta + Media)",leads:tagged});}} style={{position:"relative",cursor:"pointer",border:"2px solid "+C.pink+"44",background:"linear-gradient(135deg, "+C.card+" 0%, "+C.lRed+" 100%)"}}>
              <div style={{position:"absolute",top:-8,right:-8,fontSize:48,opacity:0.04,pointerEvents:"none"}}>{"\u{1F4C5}"}</div>
              <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}>
                <div style={{width:32,height:32,borderRadius:10,background:C.pink+"15",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>{"\u{1F4C5}"}</div>
                <span style={{fontSize:13,color:C.muted,fontWeight:600}}>Oferta Reuni{"\u00F3"}n</span>
              </div>
              <div style={{fontSize:32,fontWeight:800,fontFamily:mono,lineHeight:1}}>{qOferta}</div>
              <div style={{fontSize:13,color:C.muted,marginTop:4}}>{qOfertaVsResp}% de respuestas {"\u00B7"} {qOfertaVsTotal}% del total</div>
              <div style={{fontSize:11,color:C.pink,fontWeight:700,marginTop:6}}>{"\u{1F4C5} Ver contactos \u2192"}</div>
              {qPeriodPhones&&qNotBookedCount>0&&<div onClick={function(e){e.stopPropagation();var nbTagged=qNotBookedArr.map(function(l){return Object.assign({},l,{_confirmed:false});});setChartDayModalData({title:"\u274C Calificados que NO agendaron reuni\u00F3n ("+qNotBookedCount+")",leads:nbTagged});}} style={{fontSize:11,color:"#e67e22",fontWeight:700,marginTop:4,borderTop:"1px solid "+C.border,paddingTop:4,cursor:"pointer"}}>{"\u{1F50D} Ver "+qNotBookedCount+" que no agendaron \u2192"}</div>}
            </Cd>
            <Cd onClick={function(){if(qConfirmedArr.length>0){setConfirmedLeads(qConfirmedArr);setShowConfirmed(true);}}} style={{position:"relative",cursor:qPeriodPhones&&qActualMeet>0?"pointer":"default",border:"2px solid "+C.green+"44",background:"linear-gradient(135deg, "+C.card+" 0%, "+C.lGreen+" 100%)"}}>
              <div style={{position:"absolute",top:-8,right:-8,fontSize:48,opacity:0.04,pointerEvents:"none"}}>{"\u2705"}</div>
              <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}>
                <div style={{width:32,height:32,borderRadius:10,background:C.green+"15",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>{"\u2705"}</div>
                <span style={{fontSize:13,color:C.muted,fontWeight:600}}>Reuni{"\u00F3"}n Agendada</span>
              </div>
              {qPeriodPhones?(<>
                <div style={{fontSize:32,fontWeight:800,fontFamily:mono,lineHeight:1,color:C.green}}>{qActualMeet}</div>
                <div style={{fontSize:13,color:C.muted,marginTop:4}}>{qActualVsOferta}% de ofertas {"\u00B7"} {qActualVsTotal}% del total</div>
                <div style={{fontSize:11,color:C.green,fontWeight:700,marginTop:6,borderTop:"1px solid "+C.border,paddingTop:6}}>{qActualMeet>0?"\u2705 Ver reuniones \u2192":"Cruce con HubSpot Meetings"}</div>
              </>):(<>
                <div style={{fontSize:24,fontWeight:800,fontFamily:mono,lineHeight:1,color:C.muted}}>...</div>
                <div style={{fontSize:12,color:C.muted,marginTop:4}}>{crmLoading?"Cargando HubSpot...":"Esperando datos HubSpot"}</div>
              </>)}
            </Cd>
          </div>
            </>);
          })()}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:22}}>
            <Cd><Sec tipKey="funnel">Embudo de Conversi&oacute;n</Sec>
              {(function(){
                // Filter HS meetings by active date period for funnel
                var actualMC=0;
                if(crmMeetings.length>0&&crmContacts.length>0){
                  var fromD3=dateFrom?new Date(dateFrom+"T00:00:00"):null;
                  var toD3=dateTo?new Date(dateTo+"T23:59:59"):null;
                  var filtM2=crmMeetings;
                  if(fromD3||toD3){filtM2=crmMeetings.filter(function(m){var st=m.properties&&m.properties.hs_createdate||m.createdAt;if(!st)return false;var md=new Date(st);if(fromD3&&md<fromD3)return false;if(toD3&&md>toD3)return false;return true;});}
                  var fMeetPhones=getMeetingContactPhones(filtM2,crmContacts);
                  var fPhIdx={};var fMpK=Object.keys(fMeetPhones);
                  for(var fpi=0;fpi<fMpK.length;fpi++){var fpd=fMpK[fpi];fPhIdx[fpd]=true;if(fpd.length>11)fPhIdx[fpd.slice(-11)]=true;if(fpd.length>10)fPhIdx[fpd.slice(-10)]=true;if(fpd.length>9)fPhIdx[fpd.slice(-9)]=true;if(fpd.length>8)fPhIdx[fpd.slice(-8)]=true;}
                  var fOferta=meetings.filter(function(l){return l.ml;});
                  for(var mi2=0;mi2<fOferta.length;mi2++){var fp=(fOferta[mi2].p||"").replace(/\D/g,"");if(!fp)continue;if(fPhIdx[fp]||(fp.length>11&&fPhIdx[fp.slice(-11)])||(fp.length>10&&fPhIdx[fp.slice(-10)])||(fp.length>9&&fPhIdx[fp.slice(-9)])||(fp.length>8&&fPhIdx[fp.slice(-8)]))actualMC++;}
                }
                var funnelRespCount=mode===1?(regionFilter==="all"&&responseStats&&responseStats.outboundRespondedReal!=null?responseStats.outboundRespondedReal:d.resp):(regionFilter==="all"&&responseStats&&responseStats.outboundResponded!=null?responseStats.outboundResponded:d.resp);
                var correctedFunnel=funnel.map(function(f,i){if(i===0&&tc>0)return{n:f.n,v:tc,c:f.c};if(i===1)return{n:f.n,v:funnelRespCount,c:f.c};return f;});
                var funnelFull=correctedFunnel.concat([{n:"Reuni\u00F3n Agendada",v:actualMC,c:C.green}]);
                return funnelFull.map(function(f,i){var w=Math.max((f.v/(tc||1))*100,4);var prev=i>0?((f.v/(funnelFull[i-1].v||1))*100).toFixed(0):null;
                return (<div key={i} style={{marginBottom:10}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}><span style={{fontSize:14,color:C.sub,fontWeight:500}}><span style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:20,height:20,borderRadius:6,background:f.c+"18",color:f.c,fontSize:11,fontWeight:800,marginRight:6}}>{i+1}</span>{f.n}</span><div><span style={{fontSize:17,fontWeight:800,fontFamily:mono}}>{f.v}</span><span style={{fontSize:13,color:C.muted,marginLeft:6}}>{(f.v/(tc||1)*100).toFixed(1)}%</span>{prev && <span style={{fontSize:12,color:parseFloat(prev)>=50?C.green:parseFloat(prev)>=20?C.yellow:C.red,marginLeft:6}}>({prev}%{"\u2193"})</span>}</div></div><div style={{height:24,background:C.rowAlt,borderRadius:6,overflow:"hidden"}}><div style={{height:"100%",width:w+"%",background:"linear-gradient(90deg, "+f.c+" 0%, "+f.c+"CC 100%)",borderRadius:6,transition:"width 0.5s ease"}}/></div></div>);});
              })()}
            </Cd>
            <Cd><Sec tipKey="yagoVsMercado">Yago vs Mercado</Sec>
              {(function(){var _cResp=(regionFilter==="all"&&responseStats&&responseStats.outboundResponded!=null)?responseStats.outboundResponded:d.resp;var _cRespReal=(regionFilter==="all"&&responseStats&&responseStats.outboundRespondedReal!=null)?responseStats.outboundRespondedReal:d.resp;var _cRateTodas=tc>0?parseFloat(((_cResp/tc)*100).toFixed(1)):0;var _cRateReales=tc>0?parseFloat(((_cRespReal/tc)*100).toFixed(1)):0;var _corrBench=chBench.map(function(b){if(b.ch==="Yago (todas)")return{ch:b.ch,r:_cRateTodas,y:b.y};if(b.ch==="Yago (reales)")return{ch:b.ch,r:_cRateReales,y:b.y};return b;});return _corrBench.map(function(b,i){return (<div key={i} style={{marginBottom:9}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}><span style={{fontSize:14,color:b.y?C.text:C.muted,fontWeight:b.y?700:400}}>{b.ch}</span><span style={{fontSize:15,fontWeight:800,color:b.y?C.accent:C.muted,fontFamily:mono}}>{b.r}%</span></div><div style={{height:8,background:C.rowAlt,borderRadius:4}}><div style={{height:"100%",width:(b.r/45)*100+"%",background:b.y?C.accent:C.muted,borderRadius:4,opacity:b.y?0.8:0.3}}/></div></div>);});})()}
            </Cd>
          </div>
        {/* Daily chart: Ofertadas vs Confirmadas (no qualification filter, self-contained) */}
        {(function(){
          // Ofertadas by day: leads with ml:true, grouped by meeting link message date
          var allMlLeads=meetings.filter(function(l){return l.ml&&(mode===0||!l.au);});
          var ofertaByDay={};
          for(var odi=0;odi<allMlLeads.length;odi++){
            var lead=allMlLeads[odi];
            var mlDate=null;
            if(lead.c){
              for(var ci2=0;ci2<lead.c.length;ci2++){
                var msg=lead.c[ci2];
                if(msg[0]===2&&msg[1]&&(/meetings\.hubspot\.com\//.test(msg[1])||/yavendio\.com\/[^\s]*meetings/.test(msg[1]))){
                  if(msg[2])mlDate=parseDatetime(msg[2]);
                  break;
                }
              }
              if(!mlDate&&lead.c[0]&&lead.c[0][2])mlDate=parseDatetime(lead.c[0][2]);
            }
            if(mlDate&&!isNaN(mlDate.getTime())){
              var dk=String(mlDate.getDate()).padStart(2,"0")+"/"+String(mlDate.getMonth()+1).padStart(2,"0");
              if(!ofertaByDay[dk])ofertaByDay[dk]=[];
              ofertaByDay[dk].push(lead);
            }
          }
          // Confirmadas: rebuild phone matching (self-contained, same logic as KPI cards)
          var confirmedByDay={};
          var gPhoneToMeetDate={};
          var gContactIdToMeetDate={};
          if(crmMeetings.length>0&&crmContacts.length>0){
            var gFromD=dateFrom?new Date(dateFrom+"T00:00:00"):null;
            var gToD=dateTo?new Date(dateTo+"T23:59:59"):null;
            var gFiltM=crmMeetings;
            if(gFromD||gToD){gFiltM=crmMeetings.filter(function(m){var st=m.properties&&m.properties.hs_createdate||m.createdAt;if(!st)return false;var md=new Date(st);if(gFromD&&md<gFromD)return false;if(gToD&&md>gToD)return false;return true;});}
            // Build contact phone map (both phone + mobilephone)
            var gContactPhones={};
            for(var gci=0;gci<crmContacts.length;gci++){
              var gcc=crmContacts[gci];var gps=[];
              if(gcc.properties){
                if(gcc.properties.phone){var gp1=gcc.properties.phone.replace(/\D/g,"");if(gp1)gps.push(gp1);}
                if(gcc.properties.mobilephone){var gp2=gcc.properties.mobilephone.replace(/\D/g,"");if(gp2&&gps.indexOf(gp2)<0)gps.push(gp2);}
                if(gcc.properties.hs_whatsapp_phone_number){var gp3=gcc.properties.hs_whatsapp_phone_number.replace(/\D/g,"");if(gp3&&gps.indexOf(gp3)<0)gps.push(gp3);}
              }
              if(gps.length>0)gContactPhones[gcc.id]=gps;
            }
            // Build meeting→phones→date map + contactId→date map
            for(var gmi=0;gmi<gFiltM.length;gmi++){
              var gm=gFiltM[gmi];
              var gAssoc=gm.associations&&gm.associations.contacts&&gm.associations.contacts.results;
              if(!gAssoc)continue;
              var gSt=gm.properties&&(gm.properties.hs_createdate||gm.properties.hs_meeting_start_time)||gm.createdAt;
              if(!gSt)continue;
              for(var gak=0;gak<gAssoc.length;gak++){
                var gAId=gAssoc[gak].id;
                if(gAId)gContactIdToMeetDate[gAId]=gSt;
                var gCPs=gContactPhones[gAId];
                if(!gCPs)continue;
                for(var gpi=0;gpi<gCPs.length;gpi++){
                  var gph=gCPs[gpi];
                  gPhoneToMeetDate[gph]=gSt;
                  if(gph.length>11)gPhoneToMeetDate[gph.slice(-11)]=gSt;
                  if(gph.length>10)gPhoneToMeetDate[gph.slice(-10)]=gSt;
                  if(gph.length>9)gPhoneToMeetDate[gph.slice(-9)]=gSt;
                  if(gph.length>8)gPhoneToMeetDate[gph.slice(-8)]=gSt;
                }
              }
            }
            // Match leads and group by HS meeting date
            for(var gli=0;gli<allMlLeads.length;gli++){
              var gl=allMlLeads[gli];
              var glP=(gl.p||"").replace(/\D/g,"");
              var gMSt=null;
              if(glP){gMSt=gPhoneToMeetDate[glP]||(glP.length>11&&gPhoneToMeetDate[glP.slice(-11)])||(glP.length>10&&gPhoneToMeetDate[glP.slice(-10)])||(glP.length>9&&gPhoneToMeetDate[glP.slice(-9)])||(glP.length>8&&gPhoneToMeetDate[glP.slice(-8)])||null;}
              if(!gMSt&&gl.hid)gMSt=gContactIdToMeetDate[gl.hid]||null;
              if(gMSt){
                var gMD=new Date(gMSt);
                if(!isNaN(gMD.getTime())){
                  var gdk=String(gMD.getDate()).padStart(2,"0")+"/"+String(gMD.getMonth()+1).padStart(2,"0");
                  if(!confirmedByDay[gdk])confirmedByDay[gdk]=[];
                  confirmedByDay[gdk].push(gl);
                }
              }
            }
          }
          // Merge into sorted array
          var allDays={};
          var odKeys=Object.keys(ofertaByDay);for(var oki=0;oki<odKeys.length;oki++)allDays[odKeys[oki]]=true;
          var cdKeys=Object.keys(confirmedByDay);for(var cki=0;cki<cdKeys.length;cki++)allDays[cdKeys[cki]]=true;
          var chartData=Object.keys(allDays).sort(function(a,b){
            var pa=a.split("/"),pb=b.split("/");
            var da=parseInt(pa[1])*100+parseInt(pa[0]),db=parseInt(pb[1])*100+parseInt(pb[0]);
            return da-db;
          }).map(function(dk){return{d:dk,ofertadas:(ofertaByDay[dk]||[]).length,confirmadas:(confirmedByDay[dk]||[]).length};});
          if(chartData.length===0)return null;
          var handleBarClick=function(data,dataKey){
            var day=(data.payload||data).d;
            var leads;
            if(dataKey==="ofertadas"){
              leads=(ofertaByDay[day]||[]).map(function(l){
                var lp=(l.p||"").replace(/\D/g,"");
                var isConf=false;
                if(lp){isConf=!!(gPhoneToMeetDate[lp]||(lp.length>11&&gPhoneToMeetDate[lp.slice(-11)])||(lp.length>10&&gPhoneToMeetDate[lp.slice(-10)])||(lp.length>9&&gPhoneToMeetDate[lp.slice(-9)])||(lp.length>8&&gPhoneToMeetDate[lp.slice(-8)]));}
                if(!isConf&&l.hid&&gContactIdToMeetDate[l.hid])isConf=true;
                return Object.assign({},l,{_confirmed:isConf});
              });
            }else{
              leads=confirmedByDay[day]||[];
            }
            if(leads.length>0)setChartDayModalData({title:(dataKey==="ofertadas"?"\u{1F4C5} Ofertadas ":"\u2705 Agendadas ")+day,leads:leads});
          };
          var handleLegendClick=function(e){
            var dk=e.dataKey;
            setChartHiddenBars(function(prev){var n=Object.assign({},prev);n[dk]=!n[dk];return n;});
          };
          return (
            <Cd style={{marginBottom:16}}>
              <Sec>Reuniones Ofertadas vs Agendadas por D{"\u00ED"}a</Sec>
              <div style={{fontSize:11,color:C.muted,marginBottom:4,marginTop:-4}}>Click en una barra para ver las conversaciones</div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData} margin={{left:-15,right:5,top:5,bottom:0}}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border}/>
                  <XAxis dataKey="d" tick={{fontSize:11,fill:C.muted}}/>
                  <YAxis tick={{fontSize:11,fill:C.muted}} allowDecimals={false}/>
                  <Tooltip contentStyle={{background:C.card,border:"1px solid "+C.border,borderRadius:8,fontSize:13,color:C.text}} formatter={function(value,name,props){if(chartHiddenBars[props.dataKey])return [null,null];return [value,name];}}/>
                  <Legend wrapperStyle={{fontSize:12,cursor:"pointer"}} onClick={handleLegendClick} formatter={function(value,entry){var hidden=chartHiddenBars[entry.dataKey];return (<span style={{color:hidden?C.muted:entry.color,textDecoration:hidden?"line-through":"none",opacity:hidden?0.5:1}}>{value}</span>);}}/>
                  <Bar dataKey="ofertadas" name="Ofertadas" stackId="a" fill={chartHiddenBars.ofertadas?"transparent":C.pink} radius={[0,0,0,0]} cursor={chartHiddenBars.ofertadas?"default":"pointer"} onClick={chartHiddenBars.ofertadas?undefined:function(d){handleBarClick(d,"ofertadas");}}/>
                  <Bar dataKey="confirmadas" name="Agendadas" stackId="a" fill={chartHiddenBars.confirmadas?"transparent":C.green} radius={[4,4,0,0]} cursor={chartHiddenBars.confirmadas?"default":"pointer"} onClick={chartHiddenBars.confirmadas?undefined:function(d){handleBarClick(d,"confirmadas");}}/>

                </BarChart>
              </ResponsiveContainer>
            </Cd>
          );
        })()}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
          {(function(){var jsTotal=headerInfo.esTotal+headerInfo.ptTotal;var esFrac=jsTotal>0?headerInfo.esTotal/jsTotal:0.5;var corrEsTotal=tc>0?Math.round(tc*esFrac):headerInfo.esTotal;var corrPtTotal=tc>0?tc-corrEsTotal:headerInfo.ptTotal;var _esResp=mode===1?headerInfo.esRespReal:headerInfo.esResp;var _ptResp=mode===1?headerInfo.ptRespReal:headerInfo.ptResp;var _esRate=corrEsTotal>0?((_esResp/corrEsTotal)*100).toFixed(1):"0.0";var _ptRate=corrPtTotal>0?((_ptResp/corrPtTotal)*100).toFixed(1):"0.0";return <Cd><Sec tipKey="esVsPt">{"\u{1F1EA}\u{1F1F8} vs \u{1F1E7}\u{1F1F7}"}</Sec><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}><div style={{background:C.lBlue,borderRadius:12,padding:16,textAlign:"center"}}><div style={{fontSize:12,color:C.accent,fontWeight:700}}>{"\u{1F1EA}\u{1F1F8} ESPA\u00D1OL"}</div><div style={{fontSize:34,fontWeight:900,color:C.accent,fontFamily:mono}}>{_esRate}%</div><div style={{fontSize:13,color:C.muted}}>{_esResp} de {corrEsTotal}</div></div><div style={{background:C.lGreen,borderRadius:12,padding:16,textAlign:"center"}}><div style={{fontSize:12,color:C.green,fontWeight:700}}>{"\u{1F1E7}\u{1F1F7} PORTUGU\u00C9S"}</div><div style={{fontSize:34,fontWeight:900,color:C.green,fontFamily:mono}}>{_ptRate}%</div><div style={{fontSize:13,color:C.muted}}>{_ptResp} de {corrPtTotal}</div></div></div></Cd>;})()}
          <Cd><Sec tipKey="leadsPorDia">Leads por D{"\u00ED"}a</Sec><ResponsiveContainer width="100%" height={180}><AreaChart data={dailyWithHs.length>0?dailyWithHs:daily} margin={{left:-15,right:5,top:5,bottom:0}}><defs><linearGradient id="ag" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.accent} stopOpacity={0.2}/><stop offset="100%" stopColor={C.accent} stopOpacity={0}/></linearGradient><linearGradient id="agHs" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.orange} stopOpacity={0.2}/><stop offset="100%" stopColor={C.orange} stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" stroke={C.border}/><XAxis dataKey="d" tick={{fontSize:12,fill:C.muted}}/><YAxis tick={{fontSize:12,fill:C.muted}}/><Tooltip contentStyle={{background:C.card,border:"1px solid "+C.border,borderRadius:8,fontSize:13}}/><Legend wrapperStyle={{fontSize:12}} formatter={function(v){return v==="l"?"Yago":"HubSpot"}}/><Area type="monotone" dataKey="l" name="l" stroke={C.accent} fill="url(#ag)" strokeWidth={2}/><Area type="monotone" dataKey="hs" name="hs" stroke={C.orange} fill="url(#agHs)" strokeWidth={2}/></AreaChart></ResponsiveContainer></Cd>
        </div>
        <Cd style={{marginTop:22,marginBottom:22,overflowX:"auto"}}><Sec tipKey="benchmarkComparacion">{"Comparaci\u00F3n vs Benchmarks (Warm Leads)"}</Sec>
          <div style={{fontSize:13,color:C.muted,marginBottom:14}}>{"Leads que se registraron en la plataforma = warm/opt-in. Benchmarks: Twilio, Meta, Respond.io, ChatArchitect (2024-2025)."}</div>
          <table style={{width:"100%",borderCollapse:"separate",borderSpacing:"0 4px",fontSize:14}}><thead><tr>{["M\u00E9trica","Yago","Benchmark","\u0394",""].map(function(h,i){return <th key={i} style={{padding:"10px 14px",textAlign:"left",color:C.muted,fontWeight:700,fontSize:12,textTransform:"uppercase",borderBottom:"2px solid "+C.border}}>{h}</th>;})}</tr></thead>
          <tbody>{bTable.map(function(r,i){return(<tr key={i} style={{background:i%2===0?C.rowBg:"transparent"}}><td style={{padding:"12px 14px",fontWeight:600,borderRadius:"8px 0 0 8px"}}>{r.m}</td><td style={{padding:"12px 14px",fontWeight:800,fontFamily:mono,fontSize:15}}>{r.y}</td><td style={{padding:"12px 14px",color:C.muted}}>{r.b}</td><td style={{padding:"12px 14px",fontWeight:700,fontFamily:mono,color:r.s?C.green:C.red}}>{r.d}</td><td style={{padding:"12px 14px",borderRadius:"0 8px 8px 0"}}><Bd color={r.s?C.green:C.red}>{r.s?"\u2713 ARRIBA":"\u2717 ABAJO"}</Bd></td></tr>);})}</tbody></table>
        </Cd>
      </>);})()}

      {section==="inbound"&&subTab==="resumen" && (function(){var ix=inboundExtra;var inbTc=(regionFilter==="all"&&responseStats&&responseStats.inbound)?responseStats.inbound:(ix?ix.uniqueLeadCount:0); return (<>
        {ix ? (<>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(200px, 1fr))",gap:14,marginBottom:22}}>
            <Cd onClick={function(){setShowA(true);}} style={{cursor:"pointer",border:"2px solid "+C.purple+"44",position:"relative",overflow:"hidden"}}>
              <div style={{position:"absolute",top:-8,right:-8,fontSize:48,opacity:0.04}}>{"\u{1F4AC}"}</div>
              <div style={{display:"flex",alignItems:"center",gap:6}}><div style={{width:32,height:32,borderRadius:10,background:C.purple+"15",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>{"\u{1F4AC}"}</div><span style={{fontSize:13,color:C.muted,fontWeight:600}}>Leads Inbound</span><InfoTip dark={_isDark} data={TIPS.contactados}/></div>
              <div style={{fontSize:36,fontWeight:900,fontFamily:mono,marginTop:6,lineHeight:1}}>{inbTc}</div>
              <div style={{fontSize:13,color:C.muted,marginTop:4}}>{lpd}/d{"\u00ED"}a {"\u00B7"} {tc} conversaciones</div>
              {ix.hubspotMatchCount!=null && <div style={{fontSize:12,fontWeight:600,marginTop:6,borderTop:"1px solid "+C.border,paddingTop:6,color:C.orange}}>{ix.hubspotMatchCount} en HubSpot ({inbTc>0?((ix.hubspotMatchCount/inbTc)*100).toFixed(1):"0"}%)</div>}
              <div style={{fontSize:11,color:C.purple,fontWeight:700,marginTop:6}}>{"\u{1F4AC} Ver conversaciones \u2192"}</div>
            </Cd>
            <Cd style={{position:"relative",overflow:"hidden"}}>
              <div style={{position:"absolute",top:-8,right:-8,fontSize:48,opacity:0.04}}>{"\u2705"}</div>
              <div style={{display:"flex",alignItems:"center",gap:6}}><div style={{width:32,height:32,borderRadius:10,background:C.green+"15",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>{"\u2705"}</div><span style={{fontSize:13,color:C.muted,fontWeight:600}}>Conversi{"\u00F3"}n Signup</span><InfoTip dark={_isDark} data={TIPS.conversionSignup}/></div>
              <div style={{fontSize:36,fontWeight:900,fontFamily:mono,color:C.green,marginTop:6,lineHeight:1}}>{ix.signupLinkCount}</div>
              <div style={{fontSize:13,color:C.muted,marginTop:4}}>recibieron link crear cuenta</div>
              <div style={{fontSize:12,color:C.green,fontWeight:600,marginTop:6,borderTop:"1px solid "+C.border,paddingTop:6}}>{ix.signupCount} recibieron Step 1 ({inbTc>0?((ix.signupCount/inbTc)*100).toFixed(1):"0"}%)</div>
            </Cd>
            {(function(){
              // Oferta de Reunión card for inbound
              var inbOfertaLeads=meetings.filter(function(l){return l.ml;});
              var inbOfertaCount=inbOfertaLeads.length;
              var inbOfertaVsTotal=inbTc>0?((inbOfertaCount/inbTc)*100).toFixed(1):"0";
              // Build phone index to tag _confirmed
              var _phIdx=null;
              if(crmMeetings.length>0&&crmContacts.length>0){
                var _fromD=dateFrom?new Date(dateFrom+"T00:00:00"):null;var _toD=dateTo?new Date(dateTo+"T23:59:59"):null;
                var _filtM=crmMeetings;
                if(_fromD||_toD){_filtM=crmMeetings.filter(function(m){var st=m.properties&&m.properties.hs_createdate||m.createdAt;if(!st)return false;var md=new Date(st);if(_fromD&&md<_fromD)return false;if(_toD&&md>_toD)return false;return true;});}
                var _pp=getMeetingContactPhones(_filtM,crmContacts);
                if(_pp){_phIdx={};var _mpK=Object.keys(_pp);for(var _i=0;_i<_mpK.length;_i++){var _d=_mpK[_i];_phIdx[_d]=true;if(_d.length>11)_phIdx[_d.slice(-11)]=true;if(_d.length>10)_phIdx[_d.slice(-10)]=true;if(_d.length>9)_phIdx[_d.slice(-9)]=true;if(_d.length>8)_phIdx[_d.slice(-8)]=true;}}
              }
              var taggedLeads=inbOfertaLeads.map(function(l){
                if(!_phIdx)return l;
                var lp=(l.p||"").replace(/\D/g,"");if(!lp)return l;
                var mc=!!(_phIdx[lp]||(lp.length>11&&_phIdx[lp.slice(-11)])||(lp.length>10&&_phIdx[lp.slice(-10)])||(lp.length>9&&_phIdx[lp.slice(-9)])||(lp.length>8&&_phIdx[lp.slice(-8)]));
                return Object.assign({},l,{_confirmed:mc});
              });
              return (
                <Cd onClick={function(){if(inbOfertaCount>0){setChartDayModalData({title:"\u{1F4C5} Leads con Oferta de Reuni\u00F3n (Inbound)",leads:taggedLeads});}}} style={{position:"relative",cursor:inbOfertaCount>0?"pointer":"default",border:"2px solid "+C.pink+"44",background:"linear-gradient(135deg, "+C.card+" 0%, "+C.lRed+" 100%)"}}>
                  <div style={{position:"absolute",top:-8,right:-8,fontSize:48,opacity:0.04,pointerEvents:"none"}}>{"\u{1F4C5}"}</div>
                  <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}>
                    <div style={{width:32,height:32,borderRadius:10,background:C.pink+"15",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>{"\u{1F4C5}"}</div>
                    <span style={{fontSize:13,color:C.muted,fontWeight:600}}>Oferta Reuni{"\u00F3"}n</span>
                  </div>
                  <div style={{fontSize:32,fontWeight:800,fontFamily:mono,lineHeight:1}}>{inbOfertaCount}</div>
                  <div style={{fontSize:13,color:C.muted,marginTop:4}}>{inbOfertaVsTotal}% del total</div>
                  <div style={{fontSize:11,color:C.pink,fontWeight:700,marginTop:6}}>{"\u{1F4C5} Ver contactos \u2192"}</div>
                </Cd>
              );
            })()}
            {(function(){
              // Reunión Agendada card for inbound
              var inbPeriodPhones=null;var inbActualMeet=0;var inbConfirmedArr=[];
              if(crmMeetings.length>0&&crmContacts.length>0){
                var inbFromD=dateFrom?new Date(dateFrom+"T00:00:00"):null;
                var inbToD=dateTo?new Date(dateTo+"T23:59:59"):null;
                var inbFiltM=crmMeetings;
                if(inbFromD||inbToD){inbFiltM=crmMeetings.filter(function(m){var st=m.properties&&m.properties.hs_createdate||m.createdAt;if(!st)return false;var md=new Date(st);if(inbFromD&&md<inbFromD)return false;if(inbToD&&md>inbToD)return false;return true;});}
                inbPeriodPhones=getMeetingContactPhones(inbFiltM,crmContacts);
              }
              var inbContactIdIdx=inbFiltM?getMeetingContactIds(inbFiltM):{};
              if(inbPeriodPhones){
                var inbPhIdx={};var inbMpK=Object.keys(inbPeriodPhones);
                for(var ipi=0;ipi<inbMpK.length;ipi++){var ipd=inbMpK[ipi];inbPhIdx[ipd]=true;if(ipd.length>11)inbPhIdx[ipd.slice(-11)]=true;if(ipd.length>10)inbPhIdx[ipd.slice(-10)]=true;if(ipd.length>9)inbPhIdx[ipd.slice(-9)]=true;if(ipd.length>8)inbPhIdx[ipd.slice(-8)]=true;}
                var inbMlLeads=meetings.filter(function(l){return l.ml;});
                for(var iai=0;iai<inbMlLeads.length;iai++){
                  var iaLead=inbMlLeads[iai];
                  var iaP=(iaLead.p||"").replace(/\D/g,"");
                  var iaMatched=false;
                  if(iaP){
                    if(inbPhIdx[iaP])iaMatched=true;
                    else if(iaP.length>11&&inbPhIdx[iaP.slice(-11)])iaMatched=true;
                    else if(iaP.length>10&&inbPhIdx[iaP.slice(-10)])iaMatched=true;
                    else if(iaP.length>9&&inbPhIdx[iaP.slice(-9)])iaMatched=true;
                    else if(iaP.length>8&&inbPhIdx[iaP.slice(-8)])iaMatched=true;
                  }
                  if(!iaMatched&&iaLead.hid&&inbContactIdIdx[iaLead.hid])iaMatched=true;
                  if(iaMatched){inbActualMeet++;inbConfirmedArr.push(iaLead);}
                }
              }
              var inbOfertaCount=meetings.filter(function(l){return l.ml;}).length;
              var inbActualVsOferta=inbOfertaCount>0?((inbActualMeet/inbOfertaCount)*100).toFixed(1):"0";
              var inbActualVsTotal=inbTc>0?((inbActualMeet/inbTc)*100).toFixed(1):"0";
              return (
                <Cd onClick={function(){if(inbConfirmedArr.length>0){setConfirmedLeads(inbConfirmedArr);setShowConfirmed(true);}}} style={{position:"relative",cursor:inbPeriodPhones&&inbActualMeet>0?"pointer":"default",border:"2px solid "+C.green+"44",background:"linear-gradient(135deg, "+C.card+" 0%, "+C.lGreen+" 100%)"}}>
                  <div style={{position:"absolute",top:-8,right:-8,fontSize:48,opacity:0.04,pointerEvents:"none"}}>{"\u2705"}</div>
                  <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}>
                    <div style={{width:32,height:32,borderRadius:10,background:C.green+"15",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>{"\u2705"}</div>
                    <span style={{fontSize:13,color:C.muted,fontWeight:600}}>Reuni{"\u00F3"}n Agendada</span>
                  </div>
                  {inbPeriodPhones?(<>
                    <div style={{fontSize:36,fontWeight:900,fontFamily:mono,lineHeight:1,color:C.green}}>{inbActualMeet}</div>
                    <div style={{fontSize:13,color:C.muted,marginTop:4}}>{inbActualVsOferta}% de ofertas {"\u00B7"} {inbActualVsTotal}% del total</div>
                    <div style={{fontSize:11,color:C.green,fontWeight:700,marginTop:6,borderTop:"1px solid "+C.border,paddingTop:6}}>{inbActualMeet>0?"\u2705 Ver reuniones \u2192":"Cruce con HubSpot Meetings"}</div>
                  </>):(<>
                    <div style={{fontSize:24,fontWeight:800,fontFamily:mono,lineHeight:1,color:C.muted}}>...</div>
                    <div style={{fontSize:12,color:C.muted,marginTop:4}}>{crmLoading?"Cargando HubSpot...":"Esperando datos HubSpot"}</div>
                  </>)}
                </Cd>
              );
            })()}
          </div>
          {/* Daily chart: Ofertadas vs Confirmadas — Inbound */}
          {(function(){
            var inbMlLeads=meetings.filter(function(l){return l.ml&&(mode===0||!l.au);});
            var ofertaByDay={};
            for(var odi=0;odi<inbMlLeads.length;odi++){
              var lead=inbMlLeads[odi];var mlDate=null;
              if(lead.c){
                for(var ci2=0;ci2<lead.c.length;ci2++){var msg=lead.c[ci2];if(msg[0]===2&&msg[1]&&(/meetings\.hubspot\.com\//.test(msg[1])||/yavendio\.com\/[^\s]*meetings/.test(msg[1]))){if(msg[2])mlDate=parseDatetime(msg[2]);break;}}
                if(!mlDate&&lead.c[0]&&lead.c[0][2])mlDate=parseDatetime(lead.c[0][2]);
              }
              if(mlDate&&!isNaN(mlDate.getTime())){var dk=String(mlDate.getDate()).padStart(2,"0")+"/"+String(mlDate.getMonth()+1).padStart(2,"0");if(!ofertaByDay[dk])ofertaByDay[dk]=[];ofertaByDay[dk].push(lead);}
            }
            var confirmedByDay={};
            var gPTD={};
            var gCIDToDate={};
            if(crmMeetings.length>0&&crmContacts.length>0){
              var gFromD=dateFrom?new Date(dateFrom+"T00:00:00"):null;var gToD=dateTo?new Date(dateTo+"T23:59:59"):null;
              var gFiltM=crmMeetings;
              if(gFromD||gToD){gFiltM=crmMeetings.filter(function(m){var st=m.properties&&m.properties.hs_createdate||m.createdAt;if(!st)return false;var md=new Date(st);if(gFromD&&md<gFromD)return false;if(gToD&&md>gToD)return false;return true;});}
              var gCP={};for(var gci=0;gci<crmContacts.length;gci++){var gcc=crmContacts[gci];var gps=[];if(gcc.properties){if(gcc.properties.phone){var gp1=gcc.properties.phone.replace(/\D/g,"");if(gp1)gps.push(gp1);}if(gcc.properties.mobilephone){var gp2=gcc.properties.mobilephone.replace(/\D/g,"");if(gp2&&gps.indexOf(gp2)<0)gps.push(gp2);}if(gcc.properties.hs_whatsapp_phone_number){var gp3=gcc.properties.hs_whatsapp_phone_number.replace(/\D/g,"");if(gp3&&gps.indexOf(gp3)<0)gps.push(gp3);}}if(gps.length>0)gCP[gcc.id]=gps;}
              for(var gmi=0;gmi<gFiltM.length;gmi++){var gm=gFiltM[gmi];var gA=gm.associations&&gm.associations.contacts&&gm.associations.contacts.results;if(!gA)continue;var gSt=gm.properties&&(gm.properties.hs_createdate||gm.properties.hs_meeting_start_time)||gm.createdAt;if(!gSt)continue;for(var gak=0;gak<gA.length;gak++){var gAId=gA[gak].id;if(gAId)gCIDToDate[gAId]=gSt;var gCPs=gCP[gAId];if(!gCPs)continue;for(var gpi=0;gpi<gCPs.length;gpi++){var gph=gCPs[gpi];gPTD[gph]=gSt;if(gph.length>11)gPTD[gph.slice(-11)]=gSt;if(gph.length>10)gPTD[gph.slice(-10)]=gSt;if(gph.length>9)gPTD[gph.slice(-9)]=gSt;if(gph.length>8)gPTD[gph.slice(-8)]=gSt;}}}
              for(var gli=0;gli<inbMlLeads.length;gli++){var gl=inbMlLeads[gli];var glP=(gl.p||"").replace(/\D/g,"");var gMSt=null;if(glP){gMSt=gPTD[glP]||(glP.length>11&&gPTD[glP.slice(-11)])||(glP.length>10&&gPTD[glP.slice(-10)])||(glP.length>9&&gPTD[glP.slice(-9)])||(glP.length>8&&gPTD[glP.slice(-8)])||null;}if(!gMSt&&gl.hid)gMSt=gCIDToDate[gl.hid]||null;if(gMSt){var gMD=new Date(gMSt);if(!isNaN(gMD.getTime())){var gdk=String(gMD.getDate()).padStart(2,"0")+"/"+String(gMD.getMonth()+1).padStart(2,"0");if(!confirmedByDay[gdk])confirmedByDay[gdk]=[];confirmedByDay[gdk].push(gl);}}}
            }
            var allDays={};var odK=Object.keys(ofertaByDay);for(var ok=0;ok<odK.length;ok++)allDays[odK[ok]]=true;var cdK=Object.keys(confirmedByDay);for(var ck=0;ck<cdK.length;ck++)allDays[cdK[ck]]=true;
            var chartData=Object.keys(allDays).sort(function(a,b){var pa=a.split("/"),pb=b.split("/");return(parseInt(pa[1])*100+parseInt(pa[0]))-(parseInt(pb[1])*100+parseInt(pb[0]));}).map(function(dk){return{d:dk,ofertadas:(ofertaByDay[dk]||[]).length,confirmadas:(confirmedByDay[dk]||[]).length};});
            if(chartData.length===0)return null;
            var handleInbBarClick=function(data,dataKey){
              var day=(data.payload||data).d;
              var leads;
              if(dataKey==="ofertadas"){
                leads=(ofertaByDay[day]||[]).map(function(l){
                  var lp=(l.p||"").replace(/\D/g,"");
                  var isConf=false;
                  if(lp){isConf=!!(gPTD[lp]||(lp.length>11&&gPTD[lp.slice(-11)])||(lp.length>10&&gPTD[lp.slice(-10)])||(lp.length>9&&gPTD[lp.slice(-9)])||(lp.length>8&&gPTD[lp.slice(-8)]));}
                  if(!isConf&&l.hid&&gCIDToDate[l.hid])isConf=true;
                  return Object.assign({},l,{_confirmed:isConf});
                });
              }else{
                leads=confirmedByDay[day]||[];
              }
              if(leads.length>0)setChartDayModalData({title:(dataKey==="ofertadas"?"\u{1F4C5} Ofertadas ":"\u2705 Agendadas ")+day,leads:leads});
            };
            var handleInbLegendClick=function(e){
              var dk=e.dataKey;
              setChartHiddenBars(function(prev){var n=Object.assign({},prev);n[dk]=!n[dk];return n;});
            };
            return (<Cd style={{marginBottom:16}}>
              <Sec>Reuniones Ofertadas vs Agendadas por D{"\u00ED"}a</Sec>
              <div style={{fontSize:11,color:C.muted,marginBottom:4,marginTop:-4}}>Click en una barra para ver las conversaciones</div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData} margin={{left:-15,right:5,top:5,bottom:0}}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border}/><XAxis dataKey="d" tick={{fontSize:11,fill:C.muted}}/><YAxis tick={{fontSize:11,fill:C.muted}} allowDecimals={false}/>
                  <Tooltip contentStyle={{background:C.card,border:"1px solid "+C.border,borderRadius:8,fontSize:13,color:C.text}} formatter={function(value,name,props){if(chartHiddenBars[props.dataKey])return [null,null];return [value,name];}}/>
                  <Legend wrapperStyle={{fontSize:12,cursor:"pointer"}} onClick={handleInbLegendClick} formatter={function(value,entry){var hidden=chartHiddenBars[entry.dataKey];return (<span style={{color:hidden?C.muted:entry.color,textDecoration:hidden?"line-through":"none",opacity:hidden?0.5:1}}>{value}</span>);}}/>
                  <Bar dataKey="ofertadas" name="Ofertadas" stackId="a" fill={chartHiddenBars.ofertadas?"transparent":C.pink} radius={[0,0,0,0]} cursor={chartHiddenBars.ofertadas?"default":"pointer"} onClick={chartHiddenBars.ofertadas?undefined:function(d){handleInbBarClick(d,"ofertadas");}}/>
                  <Bar dataKey="confirmadas" name="Agendadas" stackId="a" fill={chartHiddenBars.confirmadas?"transparent":C.green} radius={[4,4,0,0]} cursor={chartHiddenBars.confirmadas?"default":"pointer"} onClick={chartHiddenBars.confirmadas?undefined:function(d){handleInbBarClick(d,"confirmadas");}}/>
                </BarChart>
              </ResponsiveContainer>
            </Cd>);
          })()}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:22}}>
            <Cd><Sec tipKey="funnel">Embudo de Conversi&oacute;n</Sec>
              {funnel.map(function(f,i){var base=funnel[0].v||1;var w=Math.max((f.v/base)*100,3);var prev=i>0?((f.v/(funnel[i-1].v||1))*100).toFixed(0):null;
                var hsW=f.hs!=null&&f.v>0?Math.max((f.hs/base)*100,1):0;
                return (<div key={i} style={{marginBottom:10}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}><span style={{fontSize:14,color:C.sub,fontWeight:500}}><span style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:20,height:20,borderRadius:6,background:f.c+"18",color:f.c,fontSize:11,fontWeight:800,marginRight:6}}>{i+1}</span>{f.n}</span><div><span style={{fontSize:17,fontWeight:800,fontFamily:mono}}>{f.v}</span>{f.hs!=null && <span style={{fontSize:13,color:C.orange,fontWeight:700,marginLeft:6}}>{f.hs} en HS</span>}<span style={{fontSize:13,color:C.muted,marginLeft:6}}>{(f.v/base*100).toFixed(1)}%</span>{prev && <span style={{fontSize:12,color:parseFloat(prev)>=50?C.green:parseFloat(prev)>=20?C.yellow:C.red,marginLeft:6}}>({prev}%{"\u2193"})</span>}</div></div><div style={{height:24,background:C.rowAlt,borderRadius:6,overflow:"hidden",position:"relative"}}><div style={{height:"100%",width:w+"%",background:"linear-gradient(90deg, "+f.c+" 0%, "+f.c+"CC 100%)",borderRadius:6,transition:"width 0.5s ease"}}/>{hsW>0 && <div style={{position:"absolute",top:0,left:0,height:"100%",width:hsW+"%",background:C.orange+"55",borderRadius:6,transition:"width 0.5s ease",borderRight:"2px solid "+C.orange}}/>}</div></div>);})}
            </Cd>
            <Cd><Sec tipKey="temasAbordados">{"\u00BF"}Qu{"\u00E9"} buscan?</Sec>
              {d.topics.map(function(tp,i){
                var topicColors=[C.accent,C.purple,C.cyan,C.yellow,C.green,C.red];
                var bC=topicColors[i%topicColors.length];
                return (
                  <div key={i} onClick={function(){setTopicModal(tp.t);}} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 0",borderBottom:i<d.topics.length-1?"1px solid "+C.border+"44":"none",cursor:"pointer"}}>
                    <span style={{fontSize:22}}>{tp.e}</span>
                    <div style={{flex:1}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                        <span style={{fontSize:14,fontWeight:700}}>{tp.t}</span>
                        <span style={{fontSize:14,fontWeight:800,fontFamily:mono,color:bC}}>{tp.n} <span style={{fontSize:12,fontWeight:600,color:C.muted}}>({tp.p}%)</span></span>
                      </div>
                      <div style={{height:6,background:C.rowAlt,borderRadius:3,overflow:"hidden"}}>
                        <div style={{height:"100%",width:tp.p+"%",background:bC,borderRadius:3,opacity:0.7}}/>
                      </div>
                    </div>
                  </div>
                );
              })}
            </Cd>
          </div>
        </>) : (<div style={{textAlign:"center",padding:40,color:C.muted}}>Cargando datos inbound...</div>)}
      </>);})()}

      {section==="inbound"&&subTab==="engagement" && (function(){
        var ix=inboundExtra;
        var peakH=0;var peakV=0;for(var hi=0;hi<d.hours.length;hi++){if(d.hours[hi]>peakV){peakV=d.hours[hi];peakH=hi;}}
        var topicColors=[C.accent,C.purple,C.cyan,C.yellow,C.green,C.red];
        if(!ix) return <div style={{textAlign:"center",padding:40,color:C.muted}}>Cargando datos inbound...</div>;
        if(ix){
          var depthItems=[
            {k:"rebote",n:"Rebote: 1 msg",c:C.red,bg:C.lRed,ic:"\u{1F4A4}"},
            {k:"corta",n:"Corta: 2-4 msgs",c:C.yellow,bg:C.lYellow,ic:"\u{1F610}"},
            {k:"media",n:"Media: 5-9 msgs",c:C.accent,bg:C.lBlue,ic:"\u{1F44D}"},
            {k:"profunda",n:"Profunda: 10+ msgs",c:C.green,bg:C.lGreen,ic:"\u{1F525}"}
          ];
          var depthLabels={profunda:"Profunda (10+)",media:"Media (5-9)",corta:"Corta (2-4)",rebote:"Rebote (1 msg)"};
          /* Conversion step helpers */
          var stLeads=(regionFilter==="all"&&responseStats&&responseStats.inbound)?responseStats.inbound:ix.uniqueLeadCount;
          var stEngaged=ix.engagedTotal;
          var stLink=ix.signupLinkCount;
          var stStep1=ix.signupCount;
          var stHubspot=ix.hubspotMatchCount||0;
          var convSteps=[
            {n:"Leads Inbound",v:stLeads,c:C.accent,ic:"\u{1F4F2}",hs:stHubspot},
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
                var hsW=st.hs!=null&&stLeads>0?Math.max((st.hs/stLeads)*100,1):0;
                var prevV=i>0?convSteps[i-1].v:null;
                var stepRate=prevV&&prevV>0?((st.v/prevV)*100).toFixed(1):null;
                var absRate=stLeads>0?((st.v/stLeads)*100).toFixed(1):"0";
                return (<div key={i} style={{marginBottom:i<convSteps.length-1?14:0}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                    <span style={{fontSize:14,fontWeight:600,color:C.sub}}><span style={{marginRight:6}}>{st.ic}</span>{st.n}</span>
                    <div style={{display:"flex",alignItems:"baseline",gap:8}}>
                      <span style={{fontSize:20,fontWeight:900,fontFamily:mono,color:st.c}}>{st.v}</span>
                      {st.hs!=null && <span style={{fontSize:13,color:C.orange,fontWeight:700}}>{st.hs} en HS</span>}
                      <span style={{fontSize:12,color:C.muted}}>({absRate}%)</span>
                      {stepRate && <span style={{fontSize:12,fontWeight:700,color:parseFloat(stepRate)>=50?C.green:parseFloat(stepRate)>=20?C.yellow:C.red,background:parseFloat(stepRate)>=50?C.lGreen:parseFloat(stepRate)>=20?C.lYellow:C.lRed,padding:"2px 8px",borderRadius:4}}>{stepRate}% del paso anterior</span>}
                    </div>
                  </div>
                  <div style={{height:18,background:C.rowAlt,borderRadius:6,overflow:"hidden",position:"relative"}}>
                    <div style={{height:"100%",width:w+"%",background:st.c,borderRadius:6,opacity:0.8,transition:"width 0.3s"}}/>
                    {hsW>0 && <div style={{position:"absolute",top:0,left:0,height:"100%",width:hsW+"%",background:C.orange+"55",borderRadius:6,transition:"width 0.3s",borderRight:"2px solid "+C.orange}}/>}
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
                <div style={{display:"flex",gap:0,height:12,borderRadius:6,overflow:"hidden",background:C.rowAlt}}>
                  {depthItems.map(function(e,i){var w=parseFloat((d.eng[e.k]||{p:"0"}).p)||0;return w>0?<div key={i} style={{width:w+"%",background:e.c,height:"100%",transition:"width 0.3s"}} title={depthLabels[e.k]+": "+w+"%"}/>:null;})
                  }
                </div>
                {ix.avgDepth>0 && <div style={{marginTop:12,fontSize:13,color:C.muted,textAlign:"center"}}>Promedio: <strong style={{color:C.accent,fontFamily:mono}}>{ix.avgDepth}</strong> msgs/conv (leads engajados)</div>}
              </Cd>

              {/* Multi-day + quick stats */}
              <div style={{display:"flex",flexDirection:"column",gap:16}}>
                <Cd style={{background:C.lBlue,border:"1px solid "+C.accent+"20",flex:1}}>
                  <div style={{fontSize:40,marginBottom:6,opacity:0.8}}>{"\u{1F504}"}</div>
                  <div style={{fontSize:11,color:C.muted,fontWeight:700,textTransform:"uppercase",letterSpacing:1,display:"flex",alignItems:"center"}}>Leads Recurrentes<InfoTip dark={_isDark} data={TIPS.leadsRecurrentes}/></div>
                  <div style={{display:"flex",alignItems:"baseline",gap:6,marginTop:4}}>
                    <span style={{fontSize:32,fontWeight:900,fontFamily:mono,color:C.accent}}>{ix.multiDayCount}</span>
                    <span style={{fontSize:14,fontWeight:700,color:C.accent}}>({stLeads>0?((ix.multiDayCount/stLeads)*100).toFixed(1):"0"}%)</span>
                  </div>
                  <div style={{fontSize:12,color:C.sub,marginTop:4}}>volvieron otro d{"\u00ED"}a</div>
                </Cd>
                <Cd style={{background:C.lGreen,border:"1px solid "+C.green+"20",flex:1}}>
                  <div style={{fontSize:40,marginBottom:6,opacity:0.8}}>{"\u{1F3AF}"}</div>
                  <div style={{fontSize:11,color:C.muted,fontWeight:700,textTransform:"uppercase",letterSpacing:1,display:"flex",alignItems:"center"}}>Con Resultado<InfoTip dark={_isDark} data={TIPS.conResultado}/></div>
                  <div style={{display:"flex",alignItems:"baseline",gap:6,marginTop:4}}>
                    <span style={{fontSize:32,fontWeight:900,fontFamily:mono,color:C.green}}>{ix.outcomeCount}</span>
                    <span style={{fontSize:14,fontWeight:700,color:C.green}}>({stLeads>0?((ix.outcomeCount/stLeads)*100).toFixed(1):"0"}%)</span>
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
                      <td style={{padding:"12px 14px",fontFamily:mono}}>{stLeads}</td>
                      <td style={{padding:"12px 14px",fontFamily:mono,color:C.green}}>{ix.outcomeCount}</td>
                      <td style={{padding:"12px 14px"}}><Bd color={C.accent}>{stLeads>0?((ix.outcomeCount/stLeads)*100).toFixed(1):"0"}%</Bd></td>
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
                    {d.hours.map(function(v,i){return <Cell key={i} fill={i===peakH?C.accent:v>=10?"url(#barGrad)":v>=5?C.accent+"77":C.accent+"33"}/>;})
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
        return null;
      })()}

      {section==="outbound"&&subTab==="engagement" && (function(){
        var _sqlR=(regionFilter==="all"&&responseStats)?responseStats.outboundResponded:null;
        var _sqlRReal=(regionFilter==="all"&&responseStats)?responseStats.outboundRespondedReal:null;
        var totalResp=(_sqlR!=null)?_sqlR:(headerInfo.realesCount+headerInfo.autoReplyCount);
        var corrRespCount=mode===1?(_sqlRReal!=null?_sqlRReal:d.resp):totalResp;
        var corrRate=tc>0?((corrRespCount/tc)*100).toFixed(1)+"%":"0%";
        var autoP=totalResp>0?((headerInfo.autoReplyCount/totalResp)*100).toFixed(1):"0";
        var realP=totalResp>0?((headerInfo.realesCount/totalResp)*100).toFixed(1):"0";
        var peakH=0;var peakV=0;for(var hi=0;hi<d.hours.length;hi++){if(d.hours[hi]>peakV){peakV=d.hours[hi];peakH=hi;}}
        var topicColors=[C.accent,C.purple,C.cyan,C.yellow,C.green,C.red];
        var engIcons={alto:"\u{1F525}",medio:"\u{1F44D}",bajo:"\u{1F610}",minimo:"\u{1F4A4}"};
        var engLabels={alto:"Alto",medio:"Medio",bajo:"Bajo",minimo:"M\u00EDnimo"};
        return (<>
        {/* Hero KPIs */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:22}}>
          {[
            {l:"Total Respuestas",v:totalResp,ic:"\u{1F4AC}",c:C.purple,sub:(tc>0?((totalResp/tc)*100).toFixed(1):"0")+"% tasa",tip:"respuestaRate"},
            {l:"Tasa de Respuesta",v:corrRate,ic:"\u{1F4CA}",c:C.accent,sub:corrRespCount+" leads respondieron",tip:"respuestaRate"},
            {l:mode===1?"Auto-replies excl.":"Auto-replies",v:headerInfo.autoReplyCount,ic:"\u{1F916}",c:mode===1?C.green:C.red,sub:mode===1?"Excluidos del an\u00E1lisis":autoP+"% del total",tip:"autoReply"},
            {l:"Leads Reales",v:headerInfo.realesCount,ic:"\u2705",c:C.green,sub:realP+"% son humanos reales",tip:"respuestaReales"}
          ].map(function(k,i){return (
            <Cd key={i} style={{position:"relative",overflow:"hidden"}}>
              <div style={{position:"absolute",top:-8,right:-8,fontSize:48,opacity:0.06}}>{k.ic}</div>
              <div style={{fontSize:12,color:C.muted,fontWeight:700,textTransform:"uppercase",letterSpacing:1,display:"flex",alignItems:"center"}}>{k.l}{k.tip && <InfoTip dark={_isDark} data={TIPS[k.tip]}/>}</div>
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
              {k:"alto",n:"Alto",c:C.green,bg:C.lGreen},
              {k:"medio",n:"Medio",c:C.accent,bg:C.lBlue},
              {k:"bajo",n:"Bajo",c:C.yellow,bg:C.lYellow},
              {k:"minimo",n:"M\u00EDnimo",c:C.red,bg:C.lRed}
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
          <div style={{display:"flex",gap:0,height:14,borderRadius:7,overflow:"hidden",background:C.rowAlt}}>
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
                    <div style={{flex:1,height:8,background:C.rowAlt,borderRadius:4,overflow:"hidden"}}>
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
                {d.hours.map(function(v,i){return <Cell key={i} fill={i===peakH?C.accent:v>=10?"url(#barGrad)":v>=5?C.accent+"77":C.accent+"33"}/>;})
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

      {section==="outbound"&&subTab==="templates" && (function(){
        var _mk=mode===0?"all":"real";var _abD=dataD[_mk];
        var _abGrp={};var _ck=Object.keys(templateConfig);
        for(var _i=0;_i<_ck.length;_i++){var _k=_ck[_i];var _v=templateConfig[_k];if(_v&&_v.ab_group){if(!_abGrp[_v.ab_group])_abGrp[_v.ab_group]=[];_abGrp[_v.ab_group].push(_k);}}
        function _gts(name){if(!_abD||!_abD.tpl)return{sent:0,resp:0,rate:"0.0%"};for(var i=0;i<_abD.tpl.length;i++){if(_abD.tpl[i].name===name||_abD.tpl[i].key===name)return _abD.tpl[i];}return{sent:0,resp:0,rate:"0.0%"};}
        function _isH(n){var e=templateConfig[n];return e&&e.hidden;}
        function _so(n){var e=templateConfig[n];return(e&&e.sort_order)||0;}
        function _getQ(n){var e=templateConfig[n];return(e&&e.qualification)||_deduceQual(n);}
        var _qualGroups=[{key:"calificado",label:"Calificados",color:C.green},{key:"no_calificado",label:"No Calificados",color:C.orange},{key:"general",label:"General",color:C.accent}];
        var _tplMeetStats={};var _isReal=mode===1;
        for(var _tmi=0;_tmi<meetings.length;_tmi++){var _tm=meetings[_tmi];if(_isReal&&_tm.au)continue;for(var _tti=0;_tti<_tm.tr.length;_tti++){var _ttpl=_tm.tr[_tti];if(!_tplMeetStats[_ttpl])_tplMeetStats[_ttpl]={link:0,booked:0};if(_tm.ml)_tplMeetStats[_ttpl].link++;if(crmMeetingPhones){var _tph=(_tm.p||"").replace(/\D/g,"");if(_tph&&(crmMeetingPhones[_tph]||(crmMeetingPhones[_tph.slice(-11)])||(crmMeetingPhones[_tph.slice(-10)])))_tplMeetStats[_ttpl].booked++;}}}
        function _meetInfo(tplName){if(_getQ(tplName)!=="calificado")return null;var st=_tplMeetStats[tplName];if(!st||(!st.link&&!st.booked))return null;return (<div style={{display:"flex",gap:12,marginTop:8,paddingTop:8,borderTop:"1px solid "+C.border+"44"}}><div style={{display:"flex",alignItems:"center",gap:4}}><span style={{fontSize:12}}>{"\u{1F517}"}</span><div><div style={{fontSize:11,color:C.muted,fontWeight:600}}>Link agend.</div><div style={{fontSize:16,fontWeight:800,color:C.pink,fontFamily:mono}}>{st.link}</div></div></div><div style={{display:"flex",alignItems:"center",gap:4}}><span style={{fontSize:12}}>{"\u{1F4C5}"}</span><div><div style={{fontSize:11,color:C.muted,fontWeight:600}}>Agendaron</div><div style={{fontSize:16,fontWeight:800,color:C.green,fontFamily:mono}}>{st.booked}</div></div></div></div>);}
        function _abCard(gId){
          var pair=_abGrp[gId];var stA=_gts(pair[0]);var stB=_gts(pair[1]);
          var rA=parseFloat(_cR(stA.resp||0,stA.sent||0))||0;var rB=parseFloat(_cR(stB.resp||0,stB.sent||0))||0;
          var diff=Math.abs(rA-rB).toFixed(1);var w=rA>rB?0:(rB>rA?1:-1);var mx=Math.max(rA,rB,1);
          return (<div key={gId} style={{background:C.inputBg,border:"1px solid "+C.purple+"33",borderRadius:14,padding:0,overflow:"hidden"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 20px",background:C.lPurple,borderBottom:"1px solid "+C.purple+"22"}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:15,fontWeight:800,color:C.purple}}>Test A/B</span>
                {w>=0 && <span style={{fontSize:12,fontWeight:700,color:C.green,background:C.lGreen,padding:"2px 10px",borderRadius:6}}>+{diff}pp</span>}
              </div>
              <button onClick={function(){for(var ri=0;ri<pair.length;ri++){updateTemplateConfig(pair[ri],"ab_group",null);}}} style={{background:"none",border:"none",fontSize:18,color:C.muted,cursor:"pointer",padding:"2px 6px",borderRadius:6,lineHeight:1}} title="Eliminar test A/B">{"\u00D7"}</button>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:0}}>
              {[0,1].map(function(idx){
                var st=idx===0?stA:stB;var rate=idx===0?rA:rB;var isW=w===idx;var lb=idx===0?"A":"B";
                return (<div key={idx} style={{padding:"16px 20px",borderRight:idx===0?"1px solid "+C.purple+"15":"none",position:"relative"}}>
                  {isW && <div style={{position:"absolute",top:8,right:12,background:C.green,color:"#FFF",fontSize:10,fontWeight:800,padding:"2px 8px",borderRadius:6,letterSpacing:0.5}}>GANADOR</div>}
                  <div style={{fontSize:11,fontWeight:800,color:C.purple,textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>{lb}</div>
                  <div style={{fontSize:13,fontWeight:700,fontFamily:mono,color:C.text,marginBottom:12,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{pair[idx]}</div>
                  <div style={{display:"flex",gap:16,marginBottom:10}}>
                    <div><div style={{fontSize:11,color:C.muted,fontWeight:600}}>Enviados</div><div style={{fontSize:18,fontWeight:800,color:C.text,fontFamily:mono}}>{_cS(st.sent||0)}</div></div>
                    <div><div style={{fontSize:11,color:C.muted,fontWeight:600}}>Respuestas</div><div style={{fontSize:18,fontWeight:800,color:C.text,fontFamily:mono}}>{st.resp||0}</div></div>
                    <div><div style={{fontSize:11,color:C.muted,fontWeight:600}}>Tasa</div><div style={{fontSize:18,fontWeight:800,color:isW?C.green:C.text,fontFamily:mono}}>{_cR(st.resp||0,st.sent||0)}</div></div>
                  </div>
                  <div style={{background:C.rowAlt,borderRadius:6,height:8,overflow:"hidden"}}>
                    <div style={{height:"100%",borderRadius:6,background:isW?C.green:C.accent,width:(mx>0?(rate/mx*100):0)+"%",transition:"width 0.3s ease"}}></div>
                  </div>
                  {(function(){var _abs=_tplMeetStats[pair[idx]];if(!_abs||(!_abs.link&&!_abs.booked))return null;return (<div style={{display:"flex",gap:12,marginTop:10,paddingTop:8,borderTop:"1px solid "+C.purple+"15"}}><div><div style={{fontSize:10,color:C.muted,fontWeight:600}}>{"\u{1F517}"} Link agend.</div><div style={{fontSize:15,fontWeight:800,color:C.pink,fontFamily:mono}}>{_abs.link}</div></div><div><div style={{fontSize:10,color:C.muted,fontWeight:600}}>{"\u{1F4C5}"} Agendaron</div><div style={{fontSize:15,fontWeight:800,color:C.green,fontFamily:mono}}>{_abs.booked}</div></div></div>);})()}
                </div>);
              })}
            </div>
          </div>);
        }
        var _allAbKeys=Object.keys(_abGrp).filter(function(g){return _abGrp[g].length>=2;});
        return (<>
        {d.tplByStep ? (function(){
          var stepKeys=Object.keys(d.tplByStep).sort(function(a,b){return (d.tplByStep[a].order||99)-(d.tplByStep[b].order||99);});
          var _renderedAb={};
          return (<>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14,paddingBottom:10,borderBottom:"1px solid "+C.border+"66"}}><div style={{display:"flex",alignItems:"center",gap:0,fontSize:13,color:C.muted,textTransform:"uppercase",letterSpacing:1.5,fontWeight:700}}>Performance por Step<InfoTip dark={_isDark} data={TIPS.templatePerformance}/></div><button onClick={function(){setShowTplConfig(true);}} title="Configuraci\u00F3n de templates" style={{background:"none",border:"none",cursor:"pointer",color:C.muted,padding:4,borderRadius:6,display:"flex",alignItems:"center",transition:"color 0.15s"}} onMouseEnter={function(e){e.currentTarget.style.color=C.accent;}} onMouseLeave={function(e){e.currentTarget.style.color=C.muted;}}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg></button></div>
            {stepKeys.map(function(sk){var sg=d.tplByStep[sk];var visTpls=sg.templates.filter(function(t){return !_isH(t.name);}).sort(function(a,b){var sa=_so(a.name);var sb=_so(b.name);if(sa!==sb)return sa-sb;return a.name.localeCompare(b.name);});var hidTpls=sg.templates.filter(function(t){return _isH(t.name);});
              var stepTplNames={};for(var sti=0;sti<sg.templates.length;sti++)stepTplNames[sg.templates[sti].name]=true;
              var stepAbKeys=_allAbKeys.filter(function(gId){if(_renderedAb[gId])return false;var pair=_abGrp[gId];return pair&&pair.length>=2&&stepTplNames[pair[0]]&&stepTplNames[pair[1]];});
              for(var sai=0;sai<stepAbKeys.length;sai++)_renderedAb[stepAbKeys[sai]]=true;
              if(visTpls.length===0&&hidTpls.length===0&&stepAbKeys.length===0)return null;var _sgRate=_cR(sg.totalResp,sg.totalSent);var rn=parseFloat(_sgRate);var sc=rn>=20?C.green:rn>=12?C.yellow:C.red;
              return (<div key={sk} style={{marginBottom:22}}>
                <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:12,padding:"10px 16px",background:sg.color+"08",borderRadius:10,border:"1px solid "+sg.color+"22"}}>
                  <div style={{flex:1}}>
                    <div style={{fontSize:11,color:C.muted,fontWeight:600}}>{sg.day}</div>
                    <div style={{fontSize:18,fontWeight:800,color:sg.color}}>{sg.label}</div>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontSize:28,fontWeight:800,color:sc,fontFamily:mono}}>{_sgRate}</div>
                    <div style={{fontSize:13,color:C.muted}}>{sg.totalResp} de {_cS(sg.totalSent)}</div>
                  </div>
                </div>
                {stepAbKeys.length>0 && <div style={{display:"flex",flexDirection:"column",gap:12,marginBottom:12}}>
                  {stepAbKeys.map(function(gId){return _abCard(gId);})}
                </div>}
                {visTpls.length>0 && (function(){
                  var hasMultipleQuals=_qualGroups.filter(function(qg){return visTpls.some(function(t){return _getQ(t.name)===qg.key;});}).length>1;
                  if(!hasMultipleQuals){return (<div style={{display:"grid",gridTemplateColumns:visTpls.length===1?"1fr":"1fr 1fr",gap:12}}>
                    {visTpls.map(function(t,i){var _tr=_cR(t.resp,t.sent);var trn=parseFloat(_tr);var tsc=trn>=20?C.green:trn>=12?C.yellow:C.red;
                      var tplItem=d.tpl.find(function(x){return x.key===t.name;});var _tName=t.name;
                      return (<Cd key={_tName} draggable={true} onDragStart={function(e){e.dataTransfer.effectAllowed="move";setDragTpl({name:_tName,step:sk});}} onDragOver={function(e){e.preventDefault();e.dataTransfer.dropEffect="move";e.currentTarget.style.outline="2px solid "+C.accent;e.currentTarget.style.outlineOffset="-2px";}} onDragLeave={function(e){e.currentTarget.style.outline="none";}} onDrop={function(e){e.preventDefault();e.currentTarget.style.outline="none";if(!dragTpl||dragTpl.name===_tName||dragTpl.step!==sk)return;var fromIdx=visTpls.findIndex(function(x){return x.name===dragTpl.name;});var toIdx=i;if(fromIdx<0)return;for(var wi=0;wi<visTpls.length;wi++){var newOrder=wi;if(fromIdx<toIdx){if(wi>fromIdx&&wi<=toIdx)newOrder=wi-1;else if(wi===fromIdx)newOrder=toIdx;}else{if(wi>=toIdx&&wi<fromIdx)newOrder=wi+1;else if(wi===fromIdx)newOrder=toIdx;}updateTemplateConfig(visTpls[wi].name,"sort_order",newOrder);}setDragTpl(null);}} onDragEnd={function(){setDragTpl(null);}} onClick={tplItem?function(){setSelTpl(tplItem);}:undefined} style={Object.assign({},{cursor:tplItem?"pointer":"grab"},dragTpl&&dragTpl.name===_tName?{opacity:0.5}:{})}><div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}><div><div style={{display:"flex",alignItems:"center",gap:6}}><span style={{fontWeight:800,fontSize:15}}>{t.displayName}</span><button onClick={function(e){e.stopPropagation();updateTemplateConfig(t.name,"hidden",true);}} title="Ocultar template" style={{background:"none",border:"none",cursor:"pointer",padding:"2px 4px",color:C.muted,opacity:0.5,flexShrink:0,display:"flex",alignItems:"center"}}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button></div><div style={{display:"flex",gap:6,marginTop:4}}><span style={{fontSize:11,fontWeight:700,padding:"2px 8px",borderRadius:4,background:t.lang==="pt"?C.green+"15":C.accent+"15",color:t.lang==="pt"?C.green:C.accent}}>{t.lang==="pt"?"PT":"ES"}</span>{t.region && <span style={{fontSize:11,fontWeight:700,padding:"2px 8px",borderRadius:4,background:t.region==="br"?C.lGreen:C.lBlue,color:t.region==="br"?C.green:C.accent}}>{t.region==="br"?"BR":"LATAM"}</span>}</div></div><div style={{textAlign:"right"}}><div style={{fontSize:24,fontWeight:800,color:tsc,fontFamily:mono}}>{_tr}</div><div style={{fontSize:12,color:C.muted}}>{t.resp} de {_cS(t.sent)}</div></div></div>{_meetInfo(_tName)}{tplItem && <div style={{fontSize:11,color:C.accent,fontWeight:600,marginTop:8}}>Click para ver detalles {"\u2192"}</div>}</Cd>);
                    })}
                  </div>);}
                  return (<div>{_qualGroups.map(function(qg){
                    var qTpls=visTpls.filter(function(t){return _getQ(t.name)===qg.key;});
                    if(qTpls.length===0)return null;
                    return (<div key={qg.key} style={{marginBottom:14}}>
                      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                        <div style={{width:3,height:16,borderRadius:2,background:qg.color}}/>
                        <span style={{fontSize:12,fontWeight:700,color:qg.color,textTransform:"uppercase",letterSpacing:0.8}}>{qg.label}</span>
                        <span style={{fontSize:11,color:C.muted}}>({qTpls.length})</span>
                      </div>
                      <div style={{display:"grid",gridTemplateColumns:qTpls.length===1?"1fr":"1fr 1fr",gap:12}}>
                        {qTpls.map(function(t,i){var _tr=_cR(t.resp,t.sent);var trn=parseFloat(_tr);var tsc=trn>=20?C.green:trn>=12?C.yellow:C.red;
                          var tplItem=d.tpl.find(function(x){return x.key===t.name;});var _tName=t.name;
                          return (<Cd key={_tName} draggable={true} onDragStart={function(e){e.dataTransfer.effectAllowed="move";setDragTpl({name:_tName,step:sk});}} onDragOver={function(e){e.preventDefault();e.dataTransfer.dropEffect="move";e.currentTarget.style.outline="2px solid "+C.accent;e.currentTarget.style.outlineOffset="-2px";}} onDragLeave={function(e){e.currentTarget.style.outline="none";}} onDrop={function(e){e.preventDefault();e.currentTarget.style.outline="none";if(!dragTpl||dragTpl.name===_tName||dragTpl.step!==sk)return;var fromIdx=visTpls.findIndex(function(x){return x.name===dragTpl.name;});var toIdx=i;if(fromIdx<0)return;for(var wi=0;wi<visTpls.length;wi++){var newOrder=wi;if(fromIdx<toIdx){if(wi>fromIdx&&wi<=toIdx)newOrder=wi-1;else if(wi===fromIdx)newOrder=toIdx;}else{if(wi>=toIdx&&wi<fromIdx)newOrder=wi+1;else if(wi===fromIdx)newOrder=toIdx;}updateTemplateConfig(visTpls[wi].name,"sort_order",newOrder);}setDragTpl(null);}} onDragEnd={function(){setDragTpl(null);}} onClick={tplItem?function(){setSelTpl(tplItem);}:undefined} style={Object.assign({},{cursor:tplItem?"pointer":"grab"},dragTpl&&dragTpl.name===_tName?{opacity:0.5}:{})}><div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}><div><div style={{display:"flex",alignItems:"center",gap:6}}><span style={{fontWeight:800,fontSize:15}}>{t.displayName}</span><button onClick={function(e){e.stopPropagation();updateTemplateConfig(t.name,"hidden",true);}} title="Ocultar template" style={{background:"none",border:"none",cursor:"pointer",padding:"2px 4px",color:C.muted,opacity:0.5,flexShrink:0,display:"flex",alignItems:"center"}}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button></div><div style={{display:"flex",gap:6,marginTop:4}}><span style={{fontSize:11,fontWeight:700,padding:"2px 8px",borderRadius:4,background:t.lang==="pt"?C.green+"15":C.accent+"15",color:t.lang==="pt"?C.green:C.accent}}>{t.lang==="pt"?"PT":"ES"}</span>{t.region && <span style={{fontSize:11,fontWeight:700,padding:"2px 8px",borderRadius:4,background:t.region==="br"?C.lGreen:C.lBlue,color:t.region==="br"?C.green:C.accent}}>{t.region==="br"?"BR":"LATAM"}</span>}</div></div><div style={{textAlign:"right"}}><div style={{fontSize:24,fontWeight:800,color:tsc,fontFamily:mono}}>{_tr}</div><div style={{fontSize:12,color:C.muted}}>{t.resp} de {_cS(t.sent)}</div></div></div>{_meetInfo(_tName)}{tplItem && <div style={{fontSize:11,color:C.accent,fontWeight:600,marginTop:8}}>Click para ver detalles {"\u2192"}</div>}</Cd>);
                        })}
                      </div>
                    </div>);
                  })}</div>);
                })()}
                {hidTpls.length>0 && (<div style={{marginTop:10}}>
                  <button onClick={function(){setOpenArchivedStep(function(prev){return prev===sk?null:sk;});}} style={{background:"none",border:"1px solid "+C.border,borderRadius:8,padding:"6px 14px",fontSize:12,fontWeight:600,cursor:"pointer",color:C.muted,fontFamily:font,display:"flex",alignItems:"center",gap:6}}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                    {hidTpls.length} archivado{hidTpls.length!==1?"s":""}
                    <span style={{fontSize:10,transition:"transform 0.2s",display:"inline-block",transform:openArchivedStep===sk?"rotate(180deg)":"rotate(0deg)"}}>{"\u25BC"}</span>
                  </button>
                  {openArchivedStep===sk && (<div style={{marginTop:8,display:"flex",flexDirection:"column",gap:6}}>
                    {hidTpls.map(function(ht,hi){return (<div key={hi} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 14px",background:C.rowBg,borderRadius:8,border:"1px solid "+C.border,opacity:0.7}}>
                      <span style={{fontSize:13,fontWeight:600,fontFamily:mono,color:C.sub}}>{ht.displayName||ht.name}</span>
                      <button onClick={function(){updateTemplateConfig(ht.name,"hidden",false);}} style={{background:C.lBlue,color:C.accent,border:"1px solid "+C.accent+"33",borderRadius:6,padding:"4px 12px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:font}}>Desarchivar</button>
                    </div>);})}
                  </div>)}
                </div>)}
              </div>);
            })}
            {(function(){var unplacedAb=_allAbKeys.filter(function(gId){return !_renderedAb[gId];});if(unplacedAb.length===0)return null;return (<div style={{marginBottom:22}}><Sec>Tests A/B</Sec><div style={{display:"flex",flexDirection:"column",gap:16}}>{unplacedAb.map(function(gId){return _abCard(gId);})}</div></div>);})()}
          </>);
        })() : (<>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14,paddingBottom:10,borderBottom:"1px solid "+C.border+"66"}}><div style={{display:"flex",alignItems:"center",gap:0,fontSize:13,color:C.muted,textTransform:"uppercase",letterSpacing:1.5,fontWeight:700}}>Performance por Template<InfoTip dark={_isDark} data={TIPS.templatePerformance}/></div><button onClick={function(){setShowTplConfig(true);}} title="Configuraci\u00F3n de templates" style={{background:"none",border:"none",cursor:"pointer",color:C.muted,padding:4,borderRadius:6,display:"flex",alignItems:"center",transition:"color 0.15s"}} onMouseEnter={function(e){e.currentTarget.style.color=C.accent;}} onMouseLeave={function(e){e.currentTarget.style.color=C.muted;}}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg></button></div>
          {_allAbKeys.length>0 && (<div style={{marginBottom:16}}><div style={{display:"flex",flexDirection:"column",gap:12}}>{_allAbKeys.map(function(gId){return _abCard(gId);})}</div></div>)}
          {(function(){var _flatVis=d.tpl.slice().filter(function(t){return !_isH(t.key||t.name);}).sort(function(a,b){var sa=_so(a.key||a.name);var sb=_so(b.key||b.name);if(sa!==sb)return sa-sb;return(a.name||"").localeCompare(b.name||"");});return (<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:22}}>
            {_flatVis.map(function(t,i){var _tr=_cR(t.resp,t.sent);var rn=parseFloat(_tr);var sc=rn>=20?C.green:rn>=12?C.yellow:C.red;var _fName=t.key||t.name;
              return (<Cd key={_fName} draggable={true} onDragStart={function(e){e.dataTransfer.effectAllowed="move";setDragTpl({name:_fName,step:"_flat"});}} onDragOver={function(e){e.preventDefault();e.dataTransfer.dropEffect="move";e.currentTarget.style.outline="2px solid "+C.accent;e.currentTarget.style.outlineOffset="-2px";}} onDragLeave={function(e){e.currentTarget.style.outline="none";}} onDrop={function(e){e.preventDefault();e.currentTarget.style.outline="none";if(!dragTpl||dragTpl.name===_fName||dragTpl.step!=="_flat")return;var fromIdx=_flatVis.findIndex(function(x){return(x.key||x.name)===dragTpl.name;});var toIdx=i;if(fromIdx<0)return;for(var wi=0;wi<_flatVis.length;wi++){var newOrder=wi;if(fromIdx<toIdx){if(wi>fromIdx&&wi<=toIdx)newOrder=wi-1;else if(wi===fromIdx)newOrder=toIdx;}else{if(wi>=toIdx&&wi<fromIdx)newOrder=wi+1;else if(wi===fromIdx)newOrder=toIdx;}updateTemplateConfig(_flatVis[wi].key||_flatVis[wi].name,"sort_order",newOrder);}setDragTpl(null);}} onDragEnd={function(){setDragTpl(null);}} onClick={function(){setSelTpl(t);}} style={Object.assign({cursor:"pointer"},dragTpl&&dragTpl.name===_fName?{opacity:0.5}:{})}><div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}><div><div style={{display:"flex",alignItems:"center",gap:6}}><span style={{fontWeight:800,fontSize:16}}>{t.name}</span><button onClick={function(e){e.stopPropagation();updateTemplateConfig(t.key||t.name,"hidden",true);}} title="Ocultar template" style={{background:"none",border:"none",cursor:"pointer",padding:"2px 4px",color:C.muted,opacity:0.5,flexShrink:0,display:"flex",alignItems:"center"}}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button></div><span style={{fontSize:12,color:C.muted,background:C.rowAlt,padding:"2px 8px",borderRadius:4}}>{t.day}</span></div><div style={{textAlign:"right"}}><div style={{fontSize:28,fontWeight:800,color:sc,fontFamily:mono}}>{_tr}</div><div style={{fontSize:13,color:C.muted}}>{t.resp} de {_cS(t.sent)}</div></div></div>{_meetInfo(_fName)}<div style={{fontSize:11,color:C.accent,fontWeight:600,marginTop:8}}>Click para ver detalles {"\u2192"}</div></Cd>);
            })}
          </div>);})()}
          {(function(){var _flatHid=d.tpl.slice().filter(function(t){return _isH(t.key||t.name);});if(_flatHid.length===0)return null;return (<div style={{marginTop:10,marginBottom:22}}>
            <button onClick={function(){setOpenArchivedStep(function(prev){return prev==="_flat"?null:"_flat";});}} style={{background:"none",border:"1px solid "+C.border,borderRadius:8,padding:"6px 14px",fontSize:12,fontWeight:600,cursor:"pointer",color:C.muted,fontFamily:font,display:"flex",alignItems:"center",gap:6}}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
              {_flatHid.length} archivado{_flatHid.length!==1?"s":""}
              <span style={{fontSize:10,transition:"transform 0.2s",display:"inline-block",transform:openArchivedStep==="_flat"?"rotate(180deg)":"rotate(0deg)"}}>{"\u25BC"}</span>
            </button>
            {openArchivedStep==="_flat" && (<div style={{marginTop:8,display:"flex",flexDirection:"column",gap:6}}>
              {_flatHid.map(function(ht,hi){return (<div key={hi} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 14px",background:C.rowBg,borderRadius:8,border:"1px solid "+C.border,opacity:0.7}}>
                <span style={{fontSize:13,fontWeight:600,fontFamily:mono,color:C.sub}}>{ht.name}</span>
                <button onClick={function(){updateTemplateConfig(ht.key||ht.name,"hidden",false);}} style={{background:C.lBlue,color:C.accent,border:"1px solid "+C.accent+"33",borderRadius:6,padding:"4px 12px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:font}}>Desarchivar</button>
              </div>);})}
            </div>)}
          </div>);})()}
        </>)}
        {d.bcast&&d.bcast.length>0&&(<div style={{marginTop:10,marginBottom:22}}><div style={{fontSize:12,fontWeight:700,color:C.muted,textTransform:"uppercase",marginBottom:8,letterSpacing:1}}>Disparos Puntuais (fora do lifecycle)</div><div style={{display:"grid",gridTemplateColumns:"1fr",gap:10}}>{d.bcast.map(function(t,i){var rn=parseFloat(t.rate);var sc=rn>=20?C.green:rn>=12?C.yellow:C.red;return(<Cd key={i} onClick={function(){setSelTpl(t);}} style={{background:C.lYellow,border:"1px dashed "+C.yellow+"55",cursor:"pointer"}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><div><div style={{fontWeight:800,fontSize:16}}>{t.name}</div><span style={{fontSize:12,color:C.muted,background:C.lYellow,padding:"2px 8px",borderRadius:4}}>Broadcast</span></div><div style={{textAlign:"right"}}><div style={{fontSize:28,fontWeight:800,color:sc,fontFamily:mono}}>{t.rate}</div><div style={{fontSize:13,color:C.muted}}>{t.resp+" de "+t.sent}</div></div></div><div style={{fontSize:11,color:C.yellow,fontWeight:600,marginTop:8}}>Click para ver detalles {"\u2192"}</div></Cd>);})}</div></div>)}
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

      {section==="canales"&&subTab==="grupos" && (<>
        {/* Selector + Filtros */}
        <Cd style={{marginBottom:22}}>
          <Sec>Grupos WhatsApp — MeuGrupoVip</Sec>
          <div style={{display:"flex",gap:12,alignItems:"center",flexWrap:"wrap"}}>
            <select value={gruposSelectedCampaign||""} onChange={function(e){var v=e.target.value;setGruposSelectedCampaign(v);loadGruposData(v,gruposDateFrom,gruposDateTo);}} style={{fontSize:13,fontWeight:600,padding:"8px 12px",borderRadius:10,border:"1px solid "+C.border,background:C.rowBg,color:C.text,fontFamily:font,cursor:"pointer",minWidth:200}}>
              {gruposCampaigns.map(function(c){var cid=c.campaign_id||c.id;return <option key={cid} value={cid}>{c.name||c.title||("Campa\u00F1a "+cid)}</option>;})}
            </select>
            <input type="date" value={gruposDateFrom} onChange={function(e){setGruposDateFrom(e.target.value);}} style={{fontSize:13,padding:"8px 10px",borderRadius:10,border:"1px solid "+C.border,background:C.rowBg,fontFamily:font,color:C.text}}/>
            <span style={{color:C.muted,fontSize:13}}>a</span>
            <input type="date" value={gruposDateTo} onChange={function(e){setGruposDateTo(e.target.value);}} style={{fontSize:13,padding:"8px 10px",borderRadius:10,border:"1px solid "+C.border,background:C.rowBg,fontFamily:font,color:C.text}}/>
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
                    <Tooltip contentStyle={{borderRadius:10,border:"1px solid "+C.border,fontSize:13,background:C.card,color:C.text}}/>
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
                    <div style={{background:C.rowAlt,borderRadius:6,height:8,overflow:"hidden",marginBottom:8}}>
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
              <div style={{position:"relative",background:C.rowAlt,borderRadius:10,height:24,overflow:"hidden"}}>
                <div style={{background:"linear-gradient(90deg, "+C.accent+", "+C.purple+")",height:"100%",width:gruposCrossRef.rate+"%",borderRadius:10,transition:"width 0.5s ease"}}/>
                <div style={{position:"absolute",top:0,left:0,right:0,bottom:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:800,color:Number(gruposCrossRef.rate)>50?"#fff":C.text}}>{gruposCrossRef.overlap} / {gruposCrossRef.grupoTotal} miembros tambi&eacute;n hablaron con Yago</div>
              </div>
            </Cd>
          )}
        </>)}
      </>)}

      {section==="hubspot" && subTab==="analytics" && (function(){
        var TARGET_PIPELINES={"720627716":"New Sales Framework","833703951":"Self Service PLG"};
        // Build pipeline stage map + stage order
        var stageMap={};var stageOrder={};var pipelineMap={};
        if(crmPipelines&&crmPipelines.results){
          for(var pi=0;pi<crmPipelines.results.length;pi++){
            var pl=crmPipelines.results[pi];
            pipelineMap[pl.id]=pl.label;
            if(pl.stages){
              for(var si=0;si<pl.stages.length;si++){
                stageMap[pl.stages[si].id]=pl.stages[si].label;
                stageOrder[pl.stages[si].id]=si;
              }
            }
          }
        }

        // Filter deals by target pipelines + date + pipeline filter + owner filter
        var filteredDeals=crmDeals.filter(function(d){
          var p=d.properties||{};
          if(!TARGET_PIPELINES[p.pipeline])return false;
          if(hsDealPipelineFilter!=="all"&&p.pipeline!==hsDealPipelineFilter)return false;
          if(hsDealOwnerFilter.length>0&&hsDealOwnerFilter.indexOf(p.hubspot_owner_id)<0)return false;
          if(dateFrom||dateTo){
            var cd=p.createdate?new Date(p.createdate):null;
            if(!cd)return false;
            if(dateFrom&&cd<new Date(dateFrom+"T00:00:00"))return false;
            if(dateTo&&cd>new Date(dateTo+"T23:59:59"))return false;
          }
          return true;
        });

        // KPIs
        var totalDeals=filteredDeals.length;
        var wonDeals=filteredDeals.filter(function(d){return d.properties&&d.properties.hs_is_closed_won==="true";});
        var lostDeals=filteredDeals.filter(function(d){return d.properties&&d.properties.hs_is_closed_lost==="true";});
        var openDeals=filteredDeals.filter(function(d){var p=d.properties||{};return p.hs_is_closed_won!=="true"&&p.hs_is_closed_lost!=="true";});
        var wonRevenue=0;for(var wi=0;wi<wonDeals.length;wi++)wonRevenue+=parseFloat(wonDeals[wi].properties.amount)||0;
        var avgTicket=wonDeals.length>0?wonRevenue/wonDeals.length:0;
        var winRate=(wonDeals.length+lostDeals.length)>0?(wonDeals.length/(wonDeals.length+lostDeals.length)*100):0;
        var totalDaysClose=0;var daysCount=0;
        for(var dci=0;dci<wonDeals.length;dci++){var dtc=parseFloat(wonDeals[dci].properties.days_to_close);if(!isNaN(dtc)){totalDaysClose+=dtc;daysCount++;}}
        var avgDays=daysCount>0?Math.round(totalDaysClose/daysCount):0;
        function computePipelineKPIs(pid){
          var pDeals=filteredDeals.filter(function(d){return d.properties&&d.properties.pipeline===pid;});
          var pWon=pDeals.filter(function(d){return d.properties.hs_is_closed_won==="true";});
          var pLost=pDeals.filter(function(d){return d.properties.hs_is_closed_lost==="true";});
          var pOpen=pDeals.filter(function(d){return d.properties.hs_is_closed_won!=="true"&&d.properties.hs_is_closed_lost!=="true";});
          var pRev=0;for(var ri=0;ri<pWon.length;ri++)pRev+=parseFloat(pWon[ri].properties.amount)||0;
          var pAvgT=pWon.length>0?pRev/pWon.length:0;
          var pWR=(pWon.length+pLost.length)>0?(pWon.length/(pWon.length+pLost.length)*100):0;
          var pDays=0;var pDC=0;for(var pdi=0;pdi<pWon.length;pdi++){var v=parseFloat(pWon[pdi].properties.days_to_close);if(!isNaN(v)){pDays+=v;pDC++;}}
          return{total:pDeals.length,won:pWon.length,lost:pLost.length,open:pOpen.length,revenue:pRev,avgTicket:pAvgT,winRate:pWR,avgDays:pDC>0?Math.round(pDays/pDC):0};
        }
        var nsKPI=computePipelineKPIs("720627716");
        var ssKPI=computePipelineKPIs("833703951");
        function buildFunnelData(pid){
          var byStage={};
          for(var fi=0;fi<filteredDeals.length;fi++){
            var fp=filteredDeals[fi].properties||{};
            if(fp.pipeline!==pid)continue;
            var stg=fp.dealstage||"unknown";
            if(!byStage[stg])byStage[stg]={count:0,value:0,order:stageOrder[stg]!=null?stageOrder[stg]:999};
            byStage[stg].count++;
            byStage[stg].value+=parseFloat(fp.amount)||0;
          }
          return Object.keys(byStage).map(function(k){return{stage:stageMap[k]||k,count:byStage[k].count,value:byStage[k].value,order:byStage[k].order};}).sort(function(a,b){return a.order-b.order;});
        }
        var nsFunnel=buildFunnelData("720627716");
        var ssFunnel=buildFunnelData("833703951");
        var revByDay={};
        for(var rvi=0;rvi<filteredDeals.length;rvi++){
          var rvp=filteredDeals[rvi].properties||{};
          if(rvp.hs_is_closed_won!=="true"||!rvp.closedate)continue;
          var rvd=new Date(rvp.closedate);if(isNaN(rvd.getTime()))continue;
          var rvk=rvd.toISOString().slice(0,10);
          if(!revByDay[rvk])revByDay[rvk]={ns:0,ss:0};
          if(rvp.pipeline==="720627716")revByDay[rvk].ns+=parseFloat(rvp.amount)||0;
          else revByDay[rvk].ss+=parseFloat(rvp.amount)||0;
        }
        var revenueChartData=Object.keys(revByDay).sort().map(function(k){return{d:k.slice(5),ns:revByDay[k].ns,ss:revByDay[k].ss};});
        var crByDay={};
        for(var cri=0;cri<filteredDeals.length;cri++){
          var crp=filteredDeals[cri].properties||{};
          if(!crp.createdate)continue;
          var crd=new Date(crp.createdate);if(isNaN(crd.getTime()))continue;
          var crk=crd.toISOString().slice(0,10);
          if(!crByDay[crk])crByDay[crk]={ns:0,ss:0};
          if(crp.pipeline==="720627716")crByDay[crk].ns++;
          else crByDay[crk].ss++;
        }
        var creationChartData=Object.keys(crByDay).sort().map(function(k){return{d:k.slice(5),ns:crByDay[k].ns,ss:crByDay[k].ss};});
        var dealsByOwner={};
        for(var obi=0;obi<filteredDeals.length;obi++){
          var obp=filteredDeals[obi].properties||{};
          var obOid=obp.hubspot_owner_id||"unassigned";
          if(!dealsByOwner[obOid])dealsByOwner[obOid]={total:0,won:0,lost:0,revenue:0,days:0,daysN:0};
          dealsByOwner[obOid].total++;
          if(obp.hs_is_closed_won==="true"){dealsByOwner[obOid].won++;dealsByOwner[obOid].revenue+=parseFloat(obp.amount)||0;var obd=parseFloat(obp.days_to_close);if(!isNaN(obd)){dealsByOwner[obOid].days+=obd;dealsByOwner[obOid].daysN++;}}
          if(obp.hs_is_closed_lost==="true")dealsByOwner[obOid].lost++;
        }
        var topDeals=filteredDeals.slice().sort(function(a,b){return(parseFloat(b.properties&&b.properties.amount)||0)-(parseFloat(a.properties&&a.properties.amount)||0);}).slice(0,20);
        var donutData=[{name:"Won",value:wonDeals.length,fill:C.green},{name:"Lost",value:lostDeals.length,fill:C.red},{name:"Open",value:openDeals.length,fill:C.accent}].filter(function(dd){return dd.value>0;});

        var sourceLabels={PAID_SOCIAL:"Paid Social",DIRECT_TRAFFIC:"Direct Traffic",OFFLINE:"Offline",ORGANIC_SEARCH:"Organic Search",OTHER_CAMPAIGNS:"Other Campaigns",PAID_SEARCH:"Paid Search",EMAIL_MARKETING:"Email Marketing",SOCIAL_MEDIA:"Organic Social",REFERRALS:"Referrals",AI_REFERRALS:"AI Referrals"};

        // --- Phone matching helpers for Canal Yago ---
        function buildPhoneSets(outRows,inRows){
          var outSet={};var inSet={};
          function addToSet(set,raw){
            if(!raw)return;
            var clean=raw.replace(/\D/g,"");
            if(!clean)return;
            set[clean]=true;
            if(clean.length>11)set[clean.slice(-11)]=true;
            if(clean.length>10)set[clean.slice(-10)]=true;
            if(clean.length>9)set[clean.slice(-9)]=true;
            if(clean.length>8)set[clean.slice(-8)]=true;
          }
          if(outRows){for(var i=0;i<outRows.length;i++){addToSet(outSet,outRows[i].phone_number);}}
          if(inRows){for(var j=0;j<inRows.length;j++){addToSet(inSet,inRows[j].phone_number);}}
          return{outbound:outSet,inbound:inSet};
        }
        function matchPhoneInSet(phoneSet,contact){
          if(!contact||!contact.properties)return false;
          var props=contact.properties;
          var phones=[props.phone,props.mobilephone,props.hs_whatsapp_phone_number];
          for(var i=0;i<phones.length;i++){
            var raw=phones[i];if(!raw)continue;
            var p=raw.replace(/\D/g,"");if(!p)continue;
            if(phoneSet[p])return true;
            if(p.length>11&&phoneSet[p.slice(-11)])return true;
            if(p.length>10&&phoneSet[p.slice(-10)])return true;
            if(p.length>9&&phoneSet[p.slice(-9)])return true;
            if(p.length>8&&phoneSet[p.slice(-8)])return true;
          }
          return false;
        }
        function classifyCanal(contact,phoneSets){
          var isOut=matchPhoneInSet(phoneSets.outbound,contact);
          var isIn=matchPhoneInSet(phoneSets.inbound,contact);
          if(isOut&&isIn)return"Ambos";
          if(isOut)return"Outbound";
          if(isIn)return"Inbound";
          return"Directo";
        }
        var phoneSets=buildPhoneSets(rawRows,inboundRawRows);
        var mtgContactMap={};
        for(var cmi=0;cmi<crmContacts.length;cmi++){mtgContactMap[crmContacts[cmi].id]=crmContacts[cmi];}
        var canalColors={"Outbound":C.green,"Inbound":C.cyan,"Ambos":C.purple,"Directo":C.muted};

        function buildDealSankey(deals,contactMap,pSets){
          var srcCanal={};
          for(var i=0;i<deals.length;i++){
            var p=deals[i].properties||{};
            var src=p.hs_analytics_source||"UNKNOWN";
            var outcome=p.hs_is_closed_won==="true"?"Won":p.hs_is_closed_lost==="true"?"Lost":"Open";
            var canal="Directo";
            var dAssoc=deals[i].associations&&deals[i].associations.contacts&&deals[i].associations.contacts.results;
            if(dAssoc&&dAssoc.length>0){var ct=contactMap[dAssoc[0].id];if(ct)canal=classifyCanal(ct,pSets);}
            if(!srcCanal[src])srcCanal[src]={};
            if(!srcCanal[src][canal])srcCanal[src][canal]={};
            srcCanal[src][canal][outcome]=(srcCanal[src][canal][outcome]||0)+1;
          }
          var nodeNames=[];var nodeIndex={};
          var srcTotals={};
          Object.keys(srcCanal).forEach(function(s){var t=0;Object.keys(srcCanal[s]).forEach(function(cn){Object.keys(srcCanal[s][cn]).forEach(function(o){t+=srcCanal[s][cn][o];});});srcTotals[s]=t;});
          var srcKeys=Object.keys(srcTotals).sort(function(a,b){return srcTotals[b]-srcTotals[a];});
          srcKeys.forEach(function(s){nodeIndex[s]=nodeNames.length;nodeNames.push(sourceLabels[s]||s);});
          ["Outbound","Inbound","Ambos","Directo"].forEach(function(cn){nodeIndex["canal_"+cn]=nodeNames.length;nodeNames.push(cn);});
          ["Won","Lost","Open"].forEach(function(o){nodeIndex["out_"+o]=nodeNames.length;nodeNames.push(o);});
          var nodes=nodeNames.map(function(n){
            var fill=C.accent;
            if(canalColors[n])fill=canalColors[n];
            if(n==="Won")fill=C.green;if(n==="Lost")fill=C.red;if(n==="Open")fill=C.accent;
            return{name:n,fill:fill};
          });
          var links=[];
          // Source → Canal
          srcKeys.forEach(function(s){Object.keys(srcCanal[s]).forEach(function(cn){var total=0;Object.keys(srcCanal[s][cn]).forEach(function(o){total+=srcCanal[s][cn][o];});if(total>0)links.push({source:nodeIndex[s],target:nodeIndex["canal_"+cn],value:total});});});
          // Canal → Outcome
          var canalOutcome={};
          srcKeys.forEach(function(s){Object.keys(srcCanal[s]).forEach(function(cn){if(!canalOutcome[cn])canalOutcome[cn]={};Object.keys(srcCanal[s][cn]).forEach(function(o){canalOutcome[cn][o]=(canalOutcome[cn][o]||0)+srcCanal[s][cn][o];});});});
          Object.keys(canalOutcome).forEach(function(cn){Object.keys(canalOutcome[cn]).forEach(function(o){if(canalOutcome[cn][o]>0)links.push({source:nodeIndex["canal_"+cn],target:nodeIndex["out_"+o],value:canalOutcome[cn][o]});});});
          return{nodes:nodes,links:links};
        }
        var dealSankeyData=buildDealSankey(filteredDeals,mtgContactMap,phoneSets);

        function buildMeetingSankey(meetings,contactMap,pSets){
          var srcCanal={};
          for(var i=0;i<meetings.length;i++){
            var mp=meetings[i].properties||{};
            var outcome=mp.hs_meeting_outcome||"UNKNOWN";
            var assoc=meetings[i].associations&&meetings[i].associations.contacts&&meetings[i].associations.contacts.results;
            var src="UNKNOWN";var canal="Directo";
            if(assoc&&assoc.length>0){var ct=contactMap[assoc[0].id];if(ct){if(ct.properties&&ct.properties.hs_analytics_source)src=ct.properties.hs_analytics_source;canal=classifyCanal(ct,pSets);}}
            if(!srcCanal[src])srcCanal[src]={};
            if(!srcCanal[src][canal])srcCanal[src][canal]={};
            srcCanal[src][canal][outcome]=(srcCanal[src][canal][outcome]||0)+1;
          }
          var nodeNames=[];var nodeIndex={};
          var srcTotals={};
          Object.keys(srcCanal).forEach(function(s){var t=0;Object.keys(srcCanal[s]).forEach(function(cn){Object.keys(srcCanal[s][cn]).forEach(function(o){t+=srcCanal[s][cn][o];});});srcTotals[s]=t;});
          var srcKeys=Object.keys(srcTotals).sort(function(a,b){return srcTotals[b]-srcTotals[a];});
          srcKeys.forEach(function(s){nodeIndex[s]=nodeNames.length;nodeNames.push(sourceLabels[s]||s);});
          ["Outbound","Inbound","Ambos","Directo"].forEach(function(cn){nodeIndex["canal_"+cn]=nodeNames.length;nodeNames.push(cn);});
          var outcomeKeys=["COMPLETED","SCHEDULED","NO_SHOW","CANCELED","RESCHEDULED"];
          outcomeKeys.forEach(function(o){var exists=false;srcKeys.forEach(function(s){Object.keys(srcCanal[s]).forEach(function(cn){if(srcCanal[s][cn][o])exists=true;});});if(exists){nodeIndex["out_"+o]=nodeNames.length;nodeNames.push(o);}});
          srcKeys.forEach(function(s){Object.keys(srcCanal[s]).forEach(function(cn){Object.keys(srcCanal[s][cn]).forEach(function(o){if(nodeIndex["out_"+o]===undefined){nodeIndex["out_"+o]=nodeNames.length;nodeNames.push(o);}});});});
          var nodes=nodeNames.map(function(n){
            var fill=C.accent;
            if(canalColors[n])fill=canalColors[n];
            if(n==="COMPLETED")fill=C.green;if(n==="NO_SHOW")fill=C.red;
            if(n==="CANCELED")fill=C.yellow;if(n==="RESCHEDULED")fill=C.orange;
            if(n==="SCHEDULED")fill=C.accent;
            return{name:n,fill:fill};
          });
          var links=[];
          // Source → Canal
          srcKeys.forEach(function(s){Object.keys(srcCanal[s]).forEach(function(cn){var total=0;Object.keys(srcCanal[s][cn]).forEach(function(o){total+=srcCanal[s][cn][o];});if(total>0)links.push({source:nodeIndex[s],target:nodeIndex["canal_"+cn],value:total});});});
          // Canal → Outcome
          var canalOutcome={};
          srcKeys.forEach(function(s){Object.keys(srcCanal[s]).forEach(function(cn){if(!canalOutcome[cn])canalOutcome[cn]={};Object.keys(srcCanal[s][cn]).forEach(function(o){canalOutcome[cn][o]=(canalOutcome[cn][o]||0)+srcCanal[s][cn][o];});});});
          Object.keys(canalOutcome).forEach(function(cn){Object.keys(canalOutcome[cn]).forEach(function(o){if(canalOutcome[cn][o]>0)links.push({source:nodeIndex["canal_"+cn],target:nodeIndex["out_"+o],value:canalOutcome[cn][o]});});});
          return{nodes:nodes,links:links};
        }
        var meetingSankeyData=buildMeetingSankey(crmMeetings,mtgContactMap,phoneSets);

        return (<>
          {crmLoading && <div style={{textAlign:"center",padding:40,color:C.muted,fontSize:15}}><div style={{width:30,height:30,border:"3px solid "+C.border,borderTopColor:C.accent,borderRadius:"50%",animation:"spin 0.8s linear infinite",margin:"0 auto 12px"}}/>Cargando datos de HubSpot...</div>}
          {crmError && <div style={{color:C.red,fontSize:13,fontWeight:600,marginBottom:16,background:C.lRed,padding:"12px 18px",borderRadius:10,border:"1px solid "+C.redBorder}}>Error: {crmError} <button onClick={function(){setCrmError(null);setCrmInited(false);}} style={{marginLeft:12,background:C.accent,color:"#fff",border:"none",borderRadius:6,padding:"4px 12px",fontSize:12,fontWeight:700,cursor:"pointer"}}>Reintentar</button></div>}
          {!crmLoading && crmInited && (<>
            <div style={{display:"flex",justifyContent:"flex-end",marginBottom:12}}>
              <span style={{fontSize:12,color:C.purple,fontWeight:700,background:C.lPurple,padding:"4px 12px",borderRadius:6}}>{filteredDeals.length} negocios</span>
            </div>
            {/* A. KPI Cards */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:16,marginBottom:22}}>
              <Cd style={{border:"2px solid "+C.accent+"44",background:"linear-gradient(135deg, "+C.card+" 0%, "+C.lBlue+" 100%)"}}>
                <div style={{fontSize:12,color:C.muted,fontWeight:700,textTransform:"uppercase",letterSpacing:1}}>Total Deals</div>
                <div style={{fontSize:32,fontWeight:900,color:C.accent,fontFamily:mono,marginTop:6}}>{totalDeals}</div>
                <div style={{fontSize:12,color:C.muted,marginTop:2}}>{openDeals.length} abiertos</div>
              </Cd>
              <Cd style={{border:"2px solid "+C.green+"44",background:"linear-gradient(135deg, "+C.card+" 0%, "+C.lGreen+" 100%)"}}>
                <div style={{fontSize:12,color:C.muted,fontWeight:700,textTransform:"uppercase",letterSpacing:1}}>Receita Won</div>
                <div style={{fontSize:28,fontWeight:900,color:C.green,fontFamily:mono,marginTop:6}}>${wonRevenue.toLocaleString(undefined,{maximumFractionDigits:0})}</div>
                <div style={{fontSize:12,color:C.muted,marginTop:2}}>avg ticket ${avgTicket.toLocaleString(undefined,{maximumFractionDigits:0})}</div>
              </Cd>
              <Cd style={{border:"2px solid "+C.purple+"44",background:"linear-gradient(135deg, "+C.card+" 0%, "+C.lPurple+" 100%)"}}>
                <div style={{fontSize:12,color:C.muted,fontWeight:700,textTransform:"uppercase",letterSpacing:1}}>Win Rate</div>
                <div style={{fontSize:32,fontWeight:900,color:C.purple,fontFamily:mono,marginTop:6}}>{winRate.toFixed(1)}%</div>
                <div style={{fontSize:12,color:C.muted,marginTop:2}}>{wonDeals.length} won / {lostDeals.length} lost</div>
              </Cd>
              <Cd style={{border:"2px solid "+C.cyan+"44",background:"linear-gradient(135deg, "+C.card+" 0%, "+C.lBlue+" 100%)"}}>
                <div style={{fontSize:12,color:C.muted,fontWeight:700,textTransform:"uppercase",letterSpacing:1}}>D{"í"}as Medio p/ Fechar</div>
                <div style={{fontSize:32,fontWeight:900,color:C.cyan,fontFamily:mono,marginTop:6}}>{avgDays}</div>
                <div style={{fontSize:12,color:C.muted,marginTop:2}}>de {daysCount} deals cerrados</div>
              </Cd>
            </div>
            {/* B. Comparacion Pipelines */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:22}}>
              {[{id:"720627716",name:"New Sales Framework",kpi:nsKPI,color:C.purple},{id:"833703951",name:"Self Service PLG",kpi:ssKPI,color:C.cyan}].map(function(pp){
                return (<Cd key={pp.id} style={{border:"2px solid "+pp.color+"33"}}>
                  <div style={{fontSize:14,fontWeight:800,color:pp.color,marginBottom:12}}>{pp.name}</div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
                    <div><div style={{fontSize:11,color:C.muted,fontWeight:700}}>Total</div><div style={{fontSize:22,fontWeight:900,fontFamily:mono,color:C.text}}>{pp.kpi.total}</div></div>
                    <div><div style={{fontSize:11,color:C.muted,fontWeight:700}}>Receita Won</div><div style={{fontSize:18,fontWeight:900,fontFamily:mono,color:C.green}}>${pp.kpi.revenue.toLocaleString(undefined,{maximumFractionDigits:0})}</div></div>
                    <div><div style={{fontSize:11,color:C.muted,fontWeight:700}}>Won / Lost / Open</div><div style={{fontSize:14,fontWeight:700,fontFamily:mono}}><span style={{color:C.green}}>{pp.kpi.won}</span> / <span style={{color:C.red}}>{pp.kpi.lost}</span> / <span style={{color:C.accent}}>{pp.kpi.open}</span></div></div>
                    <div><div style={{fontSize:11,color:C.muted,fontWeight:700}}>Ticket Medio</div><div style={{fontSize:16,fontWeight:800,fontFamily:mono,color:C.text}}>${pp.kpi.avgTicket.toLocaleString(undefined,{maximumFractionDigits:0})}</div></div>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
                    <div style={{fontSize:12,fontWeight:700,color:C.muted,minWidth:60}}>Win Rate</div>
                    <div style={{flex:1,position:"relative",background:C.barTrack,borderRadius:10,height:14,overflow:"hidden"}}><div style={{background:pp.color,height:"100%",width:Math.min(pp.kpi.winRate,100)+"%",borderRadius:10,transition:"width 0.5s ease"}}/></div>
                    <div style={{fontSize:13,fontWeight:800,fontFamily:mono,color:pp.color,minWidth:50,textAlign:"right"}}>{pp.kpi.winRate.toFixed(1)}%</div>
                  </div>
                  <div style={{fontSize:12,color:C.muted}}>D{"í"}as medio: <strong style={{color:C.text}}>{pp.kpi.avgDays}</strong></div>
                </Cd>);
              })}
            </div>
            {/* C. Funil por Pipeline */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:22}}>
              {[{name:"New Sales Framework",data:nsFunnel,color:C.purple},{name:"Self Service PLG",data:ssFunnel,color:C.cyan}].map(function(fp){
                if(fp.data.length===0)return null;
                return (<Cd key={fp.name}>
                  <Sec>{fp.name} {"—"} Funil</Sec>
                  <div style={{height:Math.max(180,fp.data.length*40)}}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={fp.data} layout="vertical" margin={{top:5,right:30,left:10,bottom:5}}>
                        <CartesianGrid strokeDasharray="3 3" stroke={C.border}/>
                        <XAxis type="number" tick={{fontSize:11,fill:C.muted}}/>
                        <YAxis type="category" dataKey="stage" tick={{fontSize:11,fill:C.sub}} width={110}/>
                        <Tooltip contentStyle={{borderRadius:10,border:"1px solid "+C.border,fontSize:13,background:C.card,color:C.text}} formatter={function(v,name){return name==="value"?"$"+v.toLocaleString():v;}}/>
                        <Bar dataKey="count" name="Deals" fill={fp.color} radius={[0,6,6,0]}/>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:8,marginTop:12}}>
                    {fp.data.map(function(s,i){return (<div key={i} style={{background:fp.color+"08",borderRadius:8,padding:"10px 12px",border:"1px solid "+fp.color+"18"}}><div style={{fontSize:10,color:C.muted,fontWeight:700,textTransform:"uppercase"}}>{s.stage}</div><div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginTop:2}}><span style={{fontSize:18,fontWeight:800,fontFamily:mono,color:fp.color}}>{s.count}</span><span style={{fontSize:12,fontWeight:700,color:C.green,fontFamily:mono}}>${s.value.toLocaleString(undefined,{maximumFractionDigits:0})}</span></div></div>);})}
                  </div>
                </Cd>);
              })}
            </div>
            {/* D. Receita ao Longo do Tempo */}
            {revenueChartData.length>0 && (<Cd style={{marginBottom:22}}>
              <Sec>Receita ao Longo do Tempo (Won)</Sec>
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={revenueChartData} margin={{left:-5,right:5,top:5,bottom:0}}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border}/><XAxis dataKey="d" tick={{fontSize:11,fill:C.muted}}/><YAxis tick={{fontSize:11,fill:C.muted}} tickFormatter={function(v){return"$"+v.toLocaleString();}}/>
                  <Tooltip contentStyle={{background:C.card,border:"1px solid "+C.border,borderRadius:8,fontSize:13,color:C.text}} formatter={function(v){return"$"+v.toLocaleString();}}/>
                  <Area type="monotone" dataKey="ns" name="New Sales" stackId="1" stroke={C.purple} fill={C.purple+"44"}/><Area type="monotone" dataKey="ss" name="Self Service" stackId="1" stroke={C.cyan} fill={C.cyan+"44"}/>
                  <Legend/>
                </AreaChart>
              </ResponsiveContainer>
            </Cd>)}
            {/* E. Deals Creados por Dia */}
            {creationChartData.length>0 && (<Cd style={{marginBottom:22}}>
              <Sec>Deals Creados por D{"í"}a</Sec>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={creationChartData} margin={{left:-15,right:5,top:5,bottom:0}}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border}/><XAxis dataKey="d" tick={{fontSize:11,fill:C.muted}}/><YAxis tick={{fontSize:11,fill:C.muted}} allowDecimals={false}/>
                  <Tooltip contentStyle={{background:C.card,border:"1px solid "+C.border,borderRadius:8,fontSize:13,color:C.text}}/>
                  <Bar dataKey="ns" name="New Sales" fill={C.purple} stackId="a" radius={[0,0,0,0]}/><Bar dataKey="ss" name="Self Service" fill={C.cyan} stackId="a" radius={[4,4,0,0]}/>
                  <Legend/>
                </BarChart>
              </ResponsiveContainer>
            </Cd>)}
            {/* F. Won vs Lost + Donut */}
            <Cd style={{marginBottom:22}}>
              <Sec>Won vs Lost vs Open</Sec>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:16,marginBottom:16}}>
                <div style={{background:C.green+"10",borderRadius:10,padding:"14px 16px",border:"1px solid "+C.green+"22",textAlign:"center"}}><div style={{fontSize:11,fontWeight:700,color:C.green,textTransform:"uppercase"}}>Won</div><div style={{fontSize:28,fontWeight:900,fontFamily:mono,color:C.green,marginTop:4}}>{wonDeals.length}</div><div style={{fontSize:12,color:C.muted}}>{totalDeals>0?(wonDeals.length/totalDeals*100).toFixed(1):"0"}%</div></div>
                <div style={{background:C.red+"10",borderRadius:10,padding:"14px 16px",border:"1px solid "+C.red+"22",textAlign:"center"}}><div style={{fontSize:11,fontWeight:700,color:C.red,textTransform:"uppercase"}}>Lost</div><div style={{fontSize:28,fontWeight:900,fontFamily:mono,color:C.red,marginTop:4}}>{lostDeals.length}</div><div style={{fontSize:12,color:C.muted}}>{totalDeals>0?(lostDeals.length/totalDeals*100).toFixed(1):"0"}%</div></div>
                <div style={{background:C.accent+"10",borderRadius:10,padding:"14px 16px",border:"1px solid "+C.accent+"22",textAlign:"center"}}><div style={{fontSize:11,fontWeight:700,color:C.accent,textTransform:"uppercase"}}>Open</div><div style={{fontSize:28,fontWeight:900,fontFamily:mono,color:C.accent,marginTop:4}}>{openDeals.length}</div><div style={{fontSize:12,color:C.muted}}>{totalDeals>0?(openDeals.length/totalDeals*100).toFixed(1):"0"}%</div></div>
                {donutData.length>0 && (<div style={{display:"flex",alignItems:"center",justifyContent:"center"}}><PieChart width={120} height={120}><Pie data={donutData} dataKey="value" cx={55} cy={55} innerRadius={30} outerRadius={52} paddingAngle={3}>{donutData.map(function(entry,i){return <Cell key={i} fill={entry.fill}/>;})}</Pie><Tooltip contentStyle={{background:C.card,border:"1px solid "+C.border,borderRadius:8,fontSize:12,color:C.text}}/></PieChart></div>)}
              </div>
            </Cd>
            {/* F2. Sankey: Origen de Negocios */}
            {dealSankeyData.links.length>0 && (<Cd style={{marginBottom:22}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14,paddingBottom:10,borderBottom:"1px solid "+C.border+"66"}}><span style={{fontSize:13,color:C.muted,textTransform:"uppercase",letterSpacing:1.5,fontWeight:700}}>Origen de Negocios (Sankey)</span>{!inboundRawRows && <span style={{fontSize:11,color:C.yellow,fontWeight:700,background:C.lYellow,padding:"2px 8px",borderRadius:6}}>(sin datos inbound)</span>}</div>
              <div style={{height:400,width:"100%"}}>
                <ResponsiveContainer width="100%" height="100%">
                  <Sankey data={dealSankeyData} nodePadding={30} nodeWidth={12} link={{stroke:C.accent+"44"}} margin={{top:10,right:160,bottom:10,left:10}}>
                    <Tooltip contentStyle={{background:C.card,border:"1px solid "+C.border,borderRadius:8,fontSize:13,color:C.text}}/>
                  </Sankey>
                </ResponsiveContainer>
              </div>
            </Cd>)}
            {/* F3. Sankey: Origen de Reuniones */}
            {meetingSankeyData.links.length>0 && (<Cd style={{marginBottom:22}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14,paddingBottom:10,borderBottom:"1px solid "+C.border+"66"}}><span style={{fontSize:13,color:C.muted,textTransform:"uppercase",letterSpacing:1.5,fontWeight:700}}>Origen de Reuniones (Sankey)</span>{!inboundRawRows && <span style={{fontSize:11,color:C.yellow,fontWeight:700,background:C.lYellow,padding:"2px 8px",borderRadius:6}}>(sin datos inbound)</span>}</div>
              <div style={{height:350,width:"100%"}}>
                <ResponsiveContainer width="100%" height="100%">
                  <Sankey data={meetingSankeyData} nodePadding={30} nodeWidth={12} link={{stroke:C.purple+"44"}} margin={{top:10,right:160,bottom:10,left:10}}>
                    <Tooltip contentStyle={{background:C.card,border:"1px solid "+C.border,borderRadius:8,fontSize:13,color:C.text}}/>
                  </Sankey>
                </ResponsiveContainer>
              </div>
            </Cd>)}
            {/* G. Performance por Vendedor */}
            {Object.keys(dealsByOwner).length>0 && (<Cd style={{marginBottom:22}}>
              <Sec>Performance por Vendedor / SDR</Sec>
              <div style={{overflowX:"auto"}}>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
                  <thead><tr style={{borderBottom:"2px solid "+C.border}}>
                    <th style={{textAlign:"left",padding:"8px 12px",color:C.muted,fontWeight:700,fontSize:11,textTransform:"uppercase",letterSpacing:1}}>SDR</th>
                    <th style={{textAlign:"center",padding:"8px 12px",color:C.muted,fontWeight:700,fontSize:11,textTransform:"uppercase",letterSpacing:1}}>Total</th>
                    <th style={{textAlign:"center",padding:"8px 12px",color:C.green,fontWeight:700,fontSize:11,textTransform:"uppercase",letterSpacing:1}}>Won</th>
                    <th style={{textAlign:"center",padding:"8px 12px",color:C.red,fontWeight:700,fontSize:11,textTransform:"uppercase",letterSpacing:1}}>Lost</th>
                    <th style={{textAlign:"center",padding:"8px 12px",color:C.green,fontWeight:700,fontSize:11,textTransform:"uppercase",letterSpacing:1}}>Receita</th>
                    <th style={{textAlign:"center",padding:"8px 12px",color:C.muted,fontWeight:700,fontSize:11,textTransform:"uppercase",letterSpacing:1}}>Ticket Medio</th>
                    <th style={{textAlign:"center",padding:"8px 12px",color:C.purple,fontWeight:700,fontSize:11,textTransform:"uppercase",letterSpacing:1}}>Win Rate</th>
                    <th style={{textAlign:"center",padding:"8px 12px",color:C.cyan,fontWeight:700,fontSize:11,textTransform:"uppercase",letterSpacing:1}}>D{"í"}as Medio</th>
                  </tr></thead>
                  <tbody>
                    {Object.keys(dealsByOwner).sort(function(a,b){return dealsByOwner[b].revenue-dealsByOwner[a].revenue;}).map(function(oid,idx){
                      var row=dealsByOwner[oid];var ownerName=crmOwnerMap[oid]||oid;
                      var oWR=(row.won+row.lost)>0?(row.won/(row.won+row.lost)*100).toFixed(1):"0";
                      var oAvgT=row.won>0?row.revenue/row.won:0;
                      var oAvgD=row.daysN>0?Math.round(row.days/row.daysN):0;
                      return (<tr key={oid} style={{borderBottom:"1px solid "+C.border+"66",background:idx%2===0?C.rowBg:"transparent"}}>
                        <td style={{padding:"10px 12px",fontWeight:700}}>{ownerName}</td>
                        <td style={{padding:"10px 12px",textAlign:"center",fontFamily:mono,fontWeight:800}}>{row.total}</td>
                        <td style={{padding:"10px 12px",textAlign:"center",fontFamily:mono,color:C.green,fontWeight:700}}>{row.won}</td>
                        <td style={{padding:"10px 12px",textAlign:"center",fontFamily:mono,color:C.red,fontWeight:700}}>{row.lost}</td>
                        <td style={{padding:"10px 12px",textAlign:"center",fontFamily:mono,color:C.green,fontWeight:700}}>${row.revenue.toLocaleString(undefined,{maximumFractionDigits:0})}</td>
                        <td style={{padding:"10px 12px",textAlign:"center",fontFamily:mono,fontWeight:700}}>${oAvgT.toLocaleString(undefined,{maximumFractionDigits:0})}</td>
                        <td style={{padding:"10px 12px",textAlign:"center"}}><span style={{background:parseFloat(oWR)>=50?C.green+"18":parseFloat(oWR)>=30?C.yellow+"18":C.red+"18",color:parseFloat(oWR)>=50?C.green:parseFloat(oWR)>=30?C.yellow:C.red,padding:"4px 10px",borderRadius:8,fontWeight:800,fontFamily:mono,fontSize:13}}>{oWR}%</span></td>
                        <td style={{padding:"10px 12px",textAlign:"center",fontFamily:mono,color:C.cyan,fontWeight:700}}>{oAvgD}</td>
                      </tr>);
                    })}
                  </tbody>
                </table>
              </div>
            </Cd>)}
            {/* H. Top Deals */}
            {topDeals.length>0 && (<Cd style={{marginBottom:22}}>
              <Sec>Top {topDeals.length} Deals por Valor</Sec>
              <div style={{overflowX:"auto",maxHeight:500,overflowY:"auto"}}>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                  <thead style={{position:"sticky",top:0,background:C.card,zIndex:2}}><tr style={{borderBottom:"2px solid "+C.border}}>
                    <th style={{textAlign:"left",padding:"8px 10px",color:C.muted,fontWeight:700,fontSize:10,textTransform:"uppercase",letterSpacing:1}}>Deal</th>
                    <th style={{textAlign:"left",padding:"8px 10px",color:C.muted,fontWeight:700,fontSize:10,textTransform:"uppercase",letterSpacing:1}}>Pipeline</th>
                    <th style={{textAlign:"left",padding:"8px 10px",color:C.muted,fontWeight:700,fontSize:10,textTransform:"uppercase",letterSpacing:1}}>Stage</th>
                    <th style={{textAlign:"right",padding:"8px 10px",color:C.muted,fontWeight:700,fontSize:10,textTransform:"uppercase",letterSpacing:1}}>Valor</th>
                    <th style={{textAlign:"left",padding:"8px 10px",color:C.muted,fontWeight:700,fontSize:10,textTransform:"uppercase",letterSpacing:1}}>Owner</th>
                    <th style={{textAlign:"left",padding:"8px 10px",color:C.muted,fontWeight:700,fontSize:10,textTransform:"uppercase",letterSpacing:1}}>Creado</th>
                    <th style={{textAlign:"left",padding:"8px 10px",color:C.muted,fontWeight:700,fontSize:10,textTransform:"uppercase",letterSpacing:1}}>Cierre</th>
                    <th style={{textAlign:"center",padding:"8px 10px",color:C.muted,fontWeight:700,fontSize:10,textTransform:"uppercase",letterSpacing:1}}>D{"í"}as</th>
                    <th style={{textAlign:"center",padding:"8px 10px",color:C.muted,fontWeight:700,fontSize:10,textTransform:"uppercase",letterSpacing:1}}>Status</th>
                  </tr></thead>
                  <tbody>
                    {topDeals.map(function(deal,idx){
                      var dp=deal.properties||{};var isWon=dp.hs_is_closed_won==="true";var isLost=dp.hs_is_closed_lost==="true";
                      var statusColor=isWon?C.green:isLost?C.red:C.accent;var statusLabel=isWon?"Won":isLost?"Lost":"Open";
                      var created=dp.createdate?new Date(dp.createdate).toLocaleDateString("es",{day:"2-digit",month:"short"}):"";
                      var closed=dp.closedate?new Date(dp.closedate).toLocaleDateString("es",{day:"2-digit",month:"short"}):"";
                      return (<tr key={deal.id} style={{borderBottom:"1px solid "+C.border+"66",background:idx%2===0?C.rowBg:"transparent"}}>
                        <td style={{padding:"8px 10px",fontWeight:700,maxWidth:200,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{dp.dealname||"Sin nombre"}</td>
                        <td style={{padding:"8px 10px",fontSize:11,color:C.sub}}>{TARGET_PIPELINES[dp.pipeline]||dp.pipeline}</td>
                        <td style={{padding:"8px 10px",fontSize:11,color:C.sub}}>{stageMap[dp.dealstage]||dp.dealstage}</td>
                        <td style={{padding:"8px 10px",textAlign:"right",fontFamily:mono,fontWeight:800,color:C.green}}>${(parseFloat(dp.amount)||0).toLocaleString(undefined,{maximumFractionDigits:0})}</td>
                        <td style={{padding:"8px 10px",fontSize:11,color:C.sub}}>{crmOwnerMap[dp.hubspot_owner_id]||dp.hubspot_owner_id||"—"}</td>
                        <td style={{padding:"8px 10px",fontSize:11,fontFamily:mono}}>{created}</td>
                        <td style={{padding:"8px 10px",fontSize:11,fontFamily:mono}}>{closed}</td>
                        <td style={{padding:"8px 10px",textAlign:"center",fontFamily:mono,fontWeight:700}}>{dp.days_to_close||"—"}</td>
                        <td style={{padding:"8px 10px",textAlign:"center"}}><span style={{background:statusColor+"18",color:statusColor,padding:"2px 8px",borderRadius:6,fontWeight:700,fontSize:11}}>{statusLabel}</span></td>
                      </tr>);
                    })}
                  </tbody>
                </table>
              </div>
            </Cd>)}
          </>)}
        </>);
      })()}

      {section==="hubspot" && subTab==="reuniones" && (function(){
        var outcomeColor={COMPLETED:C.green,SCHEDULED:C.accent,NO_SHOW:C.red,CANCELED:C.yellow,RESCHEDULED:C.orange,"NO CALIFICADA":C.pink,UNKNOWN:C.muted};
        var outcomeLabels={COMPLETED:"Completadas",SCHEDULED:"Agendadas",NO_SHOW:"No Show",CANCELED:"Canceladas",RESCHEDULED:"Reagendadas","NO CALIFICADA":"No Calificada"};
        var outcomeKeys=["COMPLETED","SCHEDULED","NO_SHOW","CANCELED","RESCHEDULED","NO CALIFICADA"];
        var outcomePriority={COMPLETED:6,SCHEDULED:5,RESCHEDULED:4,NO_SHOW:3,CANCELED:2,"NO CALIFICADA":1,UNKNOWN:0};

        // Deduplicate meetings: group by start_time + title + first associated contact id, keep best outcome
        var dedupMap={};
        for(var ddi=0;ddi<crmMeetings.length;ddi++){
          var dm=crmMeetings[ddi];var dp=dm.properties||{};
          var dAssoc=dm.associations&&dm.associations.contacts&&dm.associations.contacts.results;
          var dContactId=dAssoc&&dAssoc.length>0?dAssoc[0].id:"none";
          var dKey=(dp.hs_meeting_start_time||"")+"||"+(dp.hs_meeting_title||"")+"||"+dContactId;
          var dOutcome=dp.hs_meeting_outcome||"UNKNOWN";
          var existing=dedupMap[dKey];
          var existOutcome=existing&&existing.properties&&existing.properties.hs_meeting_outcome||"UNKNOWN";
          var newPri=outcomePriority[dOutcome]||0;
          var exPri=outcomePriority[existOutcome]||0;
          if(!existing||newPri>exPri||(newPri===exPri&&dp.hs_activity_type&&!(existing.properties&&existing.properties.hs_activity_type))){
            dedupMap[dKey]=dm;
          }
        }
        var dedupMeetings=Object.keys(dedupMap).map(function(k){return dedupMap[k];});

        // Build list of unique owners from all meetings
        var ownerIds={};
        for(var oi=0;oi<dedupMeetings.length;oi++){
          var oid=dedupMeetings[oi].properties&&dedupMeetings[oi].properties.hubspot_owner_id;
          if(oid)ownerIds[oid]=true;
        }
        var ownerList=Object.keys(ownerIds).map(function(id){return{id:id,name:crmOwnerMap[id]||id};}).sort(function(a,b){return a.name.localeCompare(b.name);});

        // Build list of unique meeting types
        var typeIds={};
        for(var ti=0;ti<dedupMeetings.length;ti++){
          var tval=dedupMeetings[ti].properties&&dedupMeetings[ti].properties.hs_activity_type;
          if(tval)typeIds[tval]=true;
        }
        var typeList=Object.keys(typeIds).sort();

        // Filter meetings by selected owners
        var filteredMeetings=dedupMeetings;
        if(hsReunionOwnerFilter.length>0){
          var filterSet={};
          for(var fi=0;fi<hsReunionOwnerFilter.length;fi++)filterSet[hsReunionOwnerFilter[fi]]=true;
          filteredMeetings=dedupMeetings.filter(function(m){
            var mid=m.properties&&m.properties.hubspot_owner_id;
            return mid&&filterSet[mid];
          });
        }

        // Filter meetings by date range
        if(hsReunionDateFrom){
          var dfrom=new Date(hsReunionDateFrom+"T00:00:00");
          filteredMeetings=filteredMeetings.filter(function(m){
            var st=m.properties&&m.properties.hs_meeting_start_time;
            return st&&new Date(st)>=dfrom;
          });
        }
        if(hsReunionDateTo){
          var dto=new Date(hsReunionDateTo+"T23:59:59");
          filteredMeetings=filteredMeetings.filter(function(m){
            var st=m.properties&&m.properties.hs_meeting_start_time;
            return st&&new Date(st)<=dto;
          });
        }

        // Filter meetings by selected type
        if(hsReunionTypeFilter.length>0){
          var typeSet={};
          for(var tfi=0;tfi<hsReunionTypeFilter.length;tfi++)typeSet[hsReunionTypeFilter[tfi]]=true;
          filteredMeetings=filteredMeetings.filter(function(m){
            var mt=m.properties&&m.properties.hs_activity_type;
            return mt&&typeSet[mt];
          });
        }

        // Filter meetings by outcome
        if(hsReunionOutcomeFilter){
          filteredMeetings=filteredMeetings.filter(function(m){
            var mo=m.properties&&m.properties.hs_meeting_outcome||"UNKNOWN";
            return mo===hsReunionOutcomeFilter;
          });
        }

        // Sort by date descending
        var sorted=filteredMeetings.slice().sort(function(a,b){
          var sa=a.properties&&a.properties.hs_meeting_start_time||"";
          var sb=b.properties&&b.properties.hs_meeting_start_time||"";
          return sb.localeCompare(sa);
        });

        // Stats per outcome
        var outcomeStats={};
        for(var si=0;si<sorted.length;si++){
          var soc=sorted[si].properties&&sorted[si].properties.hs_meeting_outcome||"UNKNOWN";
          if(!outcomeStats[soc])outcomeStats[soc]=0;
          outcomeStats[soc]++;
        }

        // Build daily stacked chart data
        var dailyMap={};
        for(var di=0;di<sorted.length;di++){
          var dst=sorted[di].properties&&sorted[di].properties.hs_meeting_start_time;
          if(!dst)continue;
          var dkey=dst.slice(0,10);
          if(!dailyMap[dkey]){var row={date:dkey};for(var oki=0;oki<outcomeKeys.length;oki++)row[outcomeKeys[oki]]=0;dailyMap[dkey]=row;}
          var doc=sorted[di].properties&&sorted[di].properties.hs_meeting_outcome||"UNKNOWN";
          if(dailyMap[dkey][doc]===undefined)dailyMap[dkey][doc]=0;
          dailyMap[dkey][doc]++;
        }
        var dailyChartData=Object.keys(dailyMap).sort().map(function(k){return dailyMap[k];});

        function toggleOwner(id){
          setHsReunionOwnerFilter(function(prev){
            var idx=prev.indexOf(id);
            if(idx>=0){var n=prev.slice();n.splice(idx,1);return n;}
            return prev.concat([id]);
          });
        }

        function toggleType(val){
          setHsReunionTypeFilter(function(prev){
            var idx=prev.indexOf(val);
            if(idx>=0){var n=prev.slice();n.splice(idx,1);return n;}
            return prev.concat([val]);
          });
        }

        // Build contact map for associated contact info
        var contactMap={};
        for(var cmi=0;cmi<crmContacts.length;cmi++){contactMap[crmContacts[cmi].id]=crmContacts[cmi];}

        function getContactForMeeting(m){
          var assoc=m.associations&&m.associations.contacts&&m.associations.contacts.results;
          if(!assoc||assoc.length===0)return null;
          return contactMap[assoc[0].id]||null;
        }

        return (<>
          {crmLoading && <div style={{textAlign:"center",padding:40,color:C.muted,fontSize:15}}><div style={{width:30,height:30,border:"3px solid "+C.border,borderTopColor:C.accent,borderRadius:"50%",animation:"spin 0.8s linear infinite",margin:"0 auto 12px"}}/>Cargando datos de HubSpot...</div>}
          {crmError && <div style={{color:C.red,fontSize:13,fontWeight:600,marginBottom:16,background:C.lRed,padding:"12px 18px",borderRadius:10,border:"1px solid "+C.redBorder}}>Error: {crmError}</div>}

          {!crmLoading && crmInited && (<>
            {/* Date filter + Owner filter */}
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12,flexWrap:"wrap"}}>
              <span style={{fontSize:12,color:C.muted,fontWeight:700}}>Fecha:</span>
              <input type="date" value={hsReunionDateFrom} onChange={function(e){setHsReunionDateFrom(e.target.value);}} style={{padding:"5px 10px",border:"1px solid "+C.border,borderRadius:8,fontSize:13,fontFamily:mono,color:C.text,background:C.rowBg,outline:"none"}}/>
              <span style={{fontSize:12,color:C.muted}}>a</span>
              <input type="date" value={hsReunionDateTo} onChange={function(e){setHsReunionDateTo(e.target.value);}} style={{padding:"5px 10px",border:"1px solid "+C.border,borderRadius:8,fontSize:13,fontFamily:mono,color:C.text,background:C.rowBg,outline:"none"}}/>
              {(hsReunionDateFrom||hsReunionDateTo)&&<button onClick={function(){setHsReunionDateFrom("");setHsReunionDateTo("");}} style={{background:C.rowAlt,color:C.muted,border:"1px solid "+C.border,borderRadius:8,padding:"5px 12px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:font}}>Limpiar</button>}
            </div>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:18,flexWrap:"wrap"}}>
              <span style={{fontSize:12,color:C.muted,fontWeight:700}}>Propietarios:</span>
              <button onClick={function(){setHsReunionOwnerFilter([]);}} style={{background:hsReunionOwnerFilter.length===0?C.accent:C.rowAlt,color:hsReunionOwnerFilter.length===0?"#fff":C.muted,border:"1px solid "+(hsReunionOwnerFilter.length===0?C.accent:C.border),borderRadius:8,padding:"5px 14px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:font}}>Todos</button>
              {ownerList.map(function(o){
                var active=hsReunionOwnerFilter.indexOf(o.id)>=0;
                return <button key={o.id} onClick={function(){toggleOwner(o.id);}} style={{background:active?C.purple:C.rowAlt,color:active?"#fff":C.sub,border:"1px solid "+(active?C.purple:C.border),borderRadius:8,padding:"5px 14px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:font,transition:"all 0.15s ease"}}>{o.name}</button>;
              })}
              <span style={{fontSize:12,color:C.purple,fontWeight:700,background:C.lPurple,padding:"4px 10px",borderRadius:6}}>{sorted.length} reuniones</span>
              {crmRefreshing && <span style={{fontSize:12,color:C.orange,fontWeight:600,display:"flex",alignItems:"center",gap:6}}><span style={{width:12,height:12,border:"2px solid "+C.orange,borderTopColor:"transparent",borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>Actualizando datos de HubSpot...</span>}
            </div>
            {typeList.length>0 && <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:18,flexWrap:"wrap"}}>
              <span style={{fontSize:12,color:C.muted,fontWeight:700}}>Tipo:</span>
              <button onClick={function(){setHsReunionTypeFilter([]);}} style={{background:hsReunionTypeFilter.length===0?C.accent:C.rowAlt,color:hsReunionTypeFilter.length===0?"#fff":C.muted,border:"1px solid "+(hsReunionTypeFilter.length===0?C.accent:C.border),borderRadius:8,padding:"5px 14px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:font}}>Todos</button>
              {typeList.map(function(tv){
                var active=hsReunionTypeFilter.indexOf(tv)>=0;
                return <button key={tv} onClick={function(){toggleType(tv);}} style={{background:active?C.cyan:C.rowAlt,color:active?"#fff":C.sub,border:"1px solid "+(active?C.cyan:C.border),borderRadius:8,padding:"5px 14px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:font,transition:"all 0.15s ease"}}>{tv}</button>;
              })}
            </div>}
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:18,flexWrap:"wrap"}}>
              <span style={{fontSize:12,color:C.muted,fontWeight:700}}>Outcome:</span>
              <button onClick={function(){setHsReunionOutcomeFilter("");}} style={{background:!hsReunionOutcomeFilter?C.accent:C.rowAlt,color:!hsReunionOutcomeFilter?"#fff":C.muted,border:"1px solid "+(!hsReunionOutcomeFilter?C.accent:C.border),borderRadius:8,padding:"5px 14px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:font}}>Todos</button>
              {outcomeKeys.map(function(oc){
                var active=hsReunionOutcomeFilter===oc;
                var clr=outcomeColor[oc]||C.muted;
                return <button key={oc} onClick={function(){setHsReunionOutcomeFilter(active?"":oc);}} style={{background:active?clr:C.rowAlt,color:active?"#fff":C.sub,border:"1px solid "+(active?clr:C.border),borderRadius:8,padding:"5px 14px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:font,transition:"all 0.15s ease"}}>{outcomeLabels[oc]||oc}</button>;
              })}
            </div>

            {/* Outcome KPI cards */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:12,marginBottom:22}}>
              {outcomeKeys.map(function(oc){
                var cnt=outcomeStats[oc]||0;if(cnt===0&&oc!=="COMPLETED"&&oc!=="SCHEDULED")return null;
                var clr=outcomeColor[oc]||C.muted;
                return <Cd key={oc} style={{textAlign:"center",padding:"14px 10px",border:"1px solid "+clr+"33"}}>
                  <div style={{fontSize:11,fontWeight:700,color:clr,textTransform:"uppercase",letterSpacing:0.5}}>{outcomeLabels[oc]||oc}</div>
                  <div style={{fontSize:28,fontWeight:900,fontFamily:mono,color:clr,marginTop:4}}>{cnt}</div>
                  <div style={{fontSize:11,color:C.muted,marginTop:2}}>{sorted.length>0?(cnt/sorted.length*100).toFixed(1):0}%</div>
                </Cd>;
              }).filter(Boolean)}
            </div>

            {/* Daily stacked chart */}
            {dailyChartData.length>1 && <Cd style={{marginBottom:22}}>
              <Sec>Reuniones por D{"\u00ED"}a</Sec>
              <div style={{height:300}}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dailyChartData} margin={{left:-15,right:5,top:5,bottom:0}}>
                    <CartesianGrid strokeDasharray="3 3" stroke={C.border}/>
                    <XAxis dataKey="date" tick={{fontSize:11,fill:C.muted}} tickFormatter={function(v){var pp=v.split("-");return pp[2]+"/"+pp[1];}}/>
                    <YAxis tick={{fontSize:11,fill:C.muted}} allowDecimals={false}/>
                    <Tooltip contentStyle={{background:C.card,border:"1px solid "+C.border,borderRadius:8,fontSize:13,color:C.text}} labelFormatter={function(v){var pp=v.split("-");return pp[2]+"/"+pp[1]+"/"+pp[0];}}/>
                    <Legend wrapperStyle={{fontSize:12}}/>
                    {outcomeKeys.map(function(oc){
                      var hasAny=false;for(var ci=0;ci<dailyChartData.length;ci++){if(dailyChartData[ci][oc]>0){hasAny=true;break;}}
                      if(!hasAny)return null;
                      return <Bar key={oc} dataKey={oc} name={outcomeLabels[oc]||oc} fill={outcomeColor[oc]||C.muted} stackId="outcomes" radius={0}/>;
                    }).filter(Boolean)}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Cd>}

            {/* Meetings table */}
            <Cd style={{marginBottom:22}}>
              <Sec>Todas las Reuniones</Sec>
              <div style={{maxHeight:600,overflowY:"auto",borderRadius:10,border:"1px solid "+C.border}}>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:13,fontFamily:font}}>
                  <thead>
                    <tr style={{background:C.rowAlt,position:"sticky",top:0,zIndex:1}}>
                      <th style={{padding:"10px 12px",textAlign:"left",fontWeight:700,color:C.muted,fontSize:11,textTransform:"uppercase",letterSpacing:1,borderBottom:"1px solid "+C.border}}>Fecha</th>
                      <th style={{padding:"10px 12px",textAlign:"left",fontWeight:700,color:C.muted,fontSize:11,textTransform:"uppercase",letterSpacing:1,borderBottom:"1px solid "+C.border}}>Hora</th>
                      <th style={{padding:"10px 12px",textAlign:"left",fontWeight:700,color:C.muted,fontSize:11,textTransform:"uppercase",letterSpacing:1,borderBottom:"1px solid "+C.border}}>Creaci{"\u00F3"}n</th>
                      <th style={{padding:"10px 12px",textAlign:"left",fontWeight:700,color:C.muted,fontSize:11,textTransform:"uppercase",letterSpacing:1,borderBottom:"1px solid "+C.border}}>T{"\u00ED"}tulo</th>
                      <th style={{padding:"10px 12px",textAlign:"left",fontWeight:700,color:C.muted,fontSize:11,textTransform:"uppercase",letterSpacing:1,borderBottom:"1px solid "+C.border}}>Contacto</th>
                      <th style={{padding:"10px 12px",textAlign:"left",fontWeight:700,color:C.muted,fontSize:11,textTransform:"uppercase",letterSpacing:1,borderBottom:"1px solid "+C.border}}>Tipo</th>
                      <th style={{padding:"10px 12px",textAlign:"left",fontWeight:700,color:C.muted,fontSize:11,textTransform:"uppercase",letterSpacing:1,borderBottom:"1px solid "+C.border}}>Outcome</th>
                      <th style={{padding:"10px 12px",textAlign:"left",fontWeight:700,color:C.muted,fontSize:11,textTransform:"uppercase",letterSpacing:1,borderBottom:"1px solid "+C.border}}>Propietario</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map(function(m,idx){
                      var p=m.properties||{};
                      var st=p.hs_meeting_start_time?new Date(p.hs_meeting_start_time):null;
                      var createdD=p.hs_createdate?new Date(p.hs_createdate):m.createdAt?new Date(m.createdAt):null;
                      var oc=outcomeColor[p.hs_meeting_outcome]||C.muted;
                      var ct=getContactForMeeting(m);
                      var ctProps=ct&&ct.properties||{};
                      var ctName=(ctProps.firstname||"")+(ctProps.lastname?(" "+ctProps.lastname):"");
                      var ctEmail=ctProps.email||"";
                      return <tr key={m.id} style={{background:idx%2===0?C.card:C.rowBg,borderBottom:"1px solid "+C.border+"44"}}>
                        <td style={{padding:"8px 12px",fontSize:12,color:C.sub,fontFamily:mono}}>{st?st.toLocaleDateString("es",{day:"2-digit",month:"2-digit",year:"numeric"}):"\u2014"}</td>
                        <td style={{padding:"8px 12px",fontSize:12,color:C.sub,fontFamily:mono}}>{st?st.toLocaleTimeString("es",{hour:"2-digit",minute:"2-digit"}):"\u2014"}</td>
                        <td style={{padding:"8px 12px",fontSize:12,color:C.sub,fontFamily:mono}}>{createdD?createdD.toLocaleDateString("es",{day:"2-digit",month:"2-digit"})+" "+createdD.toLocaleTimeString("es",{hour:"2-digit",minute:"2-digit"}):"\u2014"}</td>
                        <td style={{padding:"8px 12px",fontWeight:600,color:C.text,maxWidth:250,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.hs_meeting_title||"Sin t\u00EDtulo"}</td>
                        <td style={{padding:"8px 12px"}}>
                          {ctName?<div><span style={{fontWeight:600,color:C.text}}>{ctName}</span>{ctEmail&&<span style={{fontSize:11,color:C.muted,marginLeft:6}}>{ctEmail}</span>}</div>:<span style={{color:C.muted,fontSize:12}}>Sin contacto</span>}
                        </td>
                        <td style={{padding:"8px 12px",color:C.sub,fontSize:12}}>{p.hs_activity_type||"\u2014"}</td>
                        <td style={{padding:"8px 12px"}}><span style={{background:oc+"18",color:oc,padding:"3px 10px",borderRadius:6,fontSize:11,fontWeight:700}}>{p.hs_meeting_outcome||"UNKNOWN"}</span></td>
                        <td style={{padding:"8px 12px",color:C.sub,fontSize:12}}>{crmOwnerMap[p.hubspot_owner_id]||p.hubspot_owner_id||"\u2014"}</td>
                      </tr>;
                    })}
                    {sorted.length===0 && <tr><td colSpan={8} style={{padding:20,textAlign:"center",color:C.muted,fontSize:13}}>No hay reuniones{(hsReunionOwnerFilter.length>0||hsReunionTypeFilter.length>0||hsReunionDateFrom||hsReunionDateTo)?" con los filtros seleccionados":""}</td></tr>}
                  </tbody>
                </table>
              </div>
            </Cd>
          </>)}
        </>);
      })()}

      {section==="brevo" && (function(){
        var ed=emailData||{};
        var mt=ed.total&&ed.total.metrics||{};
        var m4=ed.wf4&&ed.wf4.metrics||{};
        var m5=ed.wf5&&ed.wf5.metrics||{};
        var hasWfSplit=(ed.wf4&&ed.wf4.campaigns&&ed.wf4.campaigns.length>0)||(ed.wf5&&ed.wf5.campaigns&&ed.wf5.campaigns.length>0);
        var allCampaigns=ed.total&&ed.total.campaigns||[];

        function better(a,b,higher){if(higher)return parseFloat(a)>parseFloat(b)?"wf4":parseFloat(b)>parseFloat(a)?"wf5":"tie";return parseFloat(a)<parseFloat(b)?"wf4":parseFloat(b)<parseFloat(a)?"wf5":"tie";}

        return (<>
          {emailLoading && <div style={{textAlign:"center",padding:40,color:C.muted,fontSize:15}}><div style={{width:30,height:30,border:"3px solid "+C.border,borderTopColor:C.accent,borderRadius:"50%",animation:"spin 0.8s linear infinite",margin:"0 auto 12px"}}/>Cargando datos de Brevo...</div>}
          {emailError && <div style={{color:C.red,fontSize:13,fontWeight:600,marginBottom:16,background:C.lRed,padding:"12px 18px",borderRadius:10,border:"1px solid "+C.redBorder}}>Error: {emailError} <button onClick={function(){setEmailError(null);setEmailInited(false);}} style={{marginLeft:12,background:C.accent,color:"#fff",border:"none",borderRadius:6,padding:"4px 12px",fontSize:12,fontWeight:700,cursor:"pointer"}}>Reintentar</button></div>}

          {!emailLoading && emailInited && (<>
            {/* Hero KPIs */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:16,marginBottom:22}}>
              <Cd onClick={function(){setEmailDetail(emailDetail==="sent"?null:"sent");}} style={{cursor:"pointer",border:"2px solid "+(emailDetail==="sent"?C.accent:C.accent+"44"),background:"linear-gradient(135deg, "+C.card+" 0%, "+C.lBlue+" 100%)"}}>
                <div style={{fontSize:12,color:C.muted,fontWeight:700,textTransform:"uppercase",letterSpacing:1}}>Total Enviados</div>
                <div style={{fontSize:32,fontWeight:900,color:C.accent,fontFamily:mono,marginTop:6}}>{(mt.sent||0).toLocaleString()}</div>
                <div style={{fontSize:12,color:C.muted,marginTop:2}}>{(mt.delivered||0).toLocaleString()} entregados ({mt.deliveryRate||0}%)</div>
              </Cd>
              <Cd onClick={function(){setEmailDetail(emailDetail==="opens"?null:"opens");}} style={{cursor:"pointer",border:"2px solid "+(emailDetail==="opens"?C.purple:C.purple+"44"),background:"linear-gradient(135deg, "+C.card+" 0%, "+C.lPurple+" 100%)"}}>
                <div style={{fontSize:12,color:C.muted,fontWeight:700,textTransform:"uppercase",letterSpacing:1}}>Tasa de Apertura</div>
                <div style={{fontSize:32,fontWeight:900,color:C.purple,fontFamily:mono,marginTop:6}}>{mt.openRate||0}%</div>
                <div style={{fontSize:12,color:C.muted,marginTop:2}}>{(mt.uniqueOpens||0).toLocaleString()} aperturas {"\u00FA"}nicas</div>
              </Cd>
              <Cd onClick={function(){setEmailDetail(emailDetail==="clicks"?null:"clicks");}} style={{cursor:"pointer",border:"2px solid "+(emailDetail==="clicks"?C.cyan:C.cyan+"44"),background:"linear-gradient(135deg, "+C.card+" 0%, #ECFEFF 100%)"}}>
                <div style={{fontSize:12,color:C.muted,fontWeight:700,textTransform:"uppercase",letterSpacing:1}}>Tasa de Clics</div>
                <div style={{fontSize:32,fontWeight:900,color:C.cyan,fontFamily:mono,marginTop:6}}>{mt.clickRate||0}%</div>
                <div style={{fontSize:12,color:C.muted,marginTop:2}}>{(mt.uniqueClicks||0).toLocaleString()} clics {"\u00FA"}nicos</div>
              </Cd>
              <Cd onClick={function(){setEmailDetail(emailDetail==="bounces"?null:"bounces");}} style={{cursor:"pointer",border:"2px solid "+(emailDetail==="bounces"?C.red:C.red+"44"),background:"linear-gradient(135deg, "+C.card+" 0%, "+C.lRed+" 100%)"}}>
                <div style={{fontSize:12,color:C.muted,fontWeight:700,textTransform:"uppercase",letterSpacing:1}}>Tasa de Bounce</div>
                <div style={{fontSize:32,fontWeight:900,color:C.red,fontFamily:mono,marginTop:6}}>{mt.bounceRate||0}%</div>
                <div style={{fontSize:12,color:C.muted,marginTop:2}}>{(mt.hardBounces||0).toLocaleString()} hard + {(mt.softBounces||0).toLocaleString()} soft</div>
              </Cd>
            </div>

            {/* Drill-down panel for selected KPI */}
            {emailDetail && (function(){
              var detailConfig={
                sent:{title:"Detalle: Enviados",color:C.accent,sortKey:"sent",columns:[
                  {h:"Enviados",k:"sent"},{h:"Entregados",k:"delivered"},{h:"Entrega %",k:"deliveryPct"}
                ]},
                opens:{title:"Detalle: Aperturas",color:C.purple,sortKey:"uniqueOpens",columns:[
                  {h:"Aperturas",k:"uniqueOpens"},{h:"Enviados",k:"sent"},{h:"Tasa %",k:"openPct"}
                ]},
                clicks:{title:"Detalle: Clics",color:C.cyan,sortKey:"uniqueClicks",columns:[
                  {h:"Clics",k:"uniqueClicks"},{h:"Entregados",k:"delivered"},{h:"Tasa %",k:"clickPct"}
                ]},
                bounces:{title:"Detalle: Bounces",color:C.red,sortKey:"totalBounces",columns:[
                  {h:"Bounces",k:"totalBounces"},{h:"Hard",k:"hardBounces"},{h:"Soft",k:"softBounces"},{h:"Tasa %",k:"bouncePct"}
                ]},
                unsubs:{title:"Detalle: Unsubscribes",color:C.yellow,sortKey:"unsubscriptions",columns:[
                  {h:"Unsubs",k:"unsubscriptions"},{h:"Entregados",k:"delivered"},{h:"Tasa %",k:"unsubPct"}
                ]},
                complaints:{title:"Detalle: Quejas / Spam",color:C.orange,sortKey:"complaints",columns:[
                  {h:"Quejas",k:"complaints"},{h:"Entregados",k:"delivered"},{h:"Tasa %",k:"complaintPct"}
                ]},
              };
              var cfg=detailConfig[emailDetail];
              if(!cfg)return null;

              // Build rows from campaigns with computed fields
              var rows=allCampaigns.map(function(c){
                var gs=c.statistics&&c.statistics.globalStats||{};
                var s=gs.sent||0,d=gs.delivered||0,o=gs.uniqueOpens||0,cl=gs.uniqueClicks||0;
                var hb=gs.hardBounces||0,sb=gs.softBounces||0,tb=hb+sb,un=gs.unsubscriptions||0,co=gs.complaints||0;
                return {
                  name:c.name||"Campaign #"+c.id,id:c.id,
                  sent:s,delivered:d,uniqueOpens:o,uniqueClicks:cl,
                  hardBounces:hb,softBounces:sb,totalBounces:tb,
                  unsubscriptions:un,complaints:co,
                  deliveryPct:s>0?(d/s*100).toFixed(1):"0",
                  openPct:d>0?(o/d*100).toFixed(1):"0",
                  clickPct:d>0?(cl/d*100).toFixed(1):"0",
                  bouncePct:s>0?(tb/s*100).toFixed(1):"0",
                  unsubPct:d>0?(un/d*100).toFixed(2):"0",
                  complaintPct:d>0?(co/d*100).toFixed(3):"0",
                  wf:ed.wf4&&ed.wf4.campaigns&&ed.wf4.campaigns.indexOf(c)>=0?"WF#4":ed.wf5&&ed.wf5.campaigns&&ed.wf5.campaigns.indexOf(c)>=0?"WF#5":null,
                };
              }).sort(function(a,b){return (b[cfg.sortKey]||0)-(a[cfg.sortKey]||0);});

              return <Cd style={{marginBottom:22,border:"2px solid "+cfg.color+"44"}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
                  <Sec style={{marginBottom:0}}>{cfg.title}</Sec>
                  <button onClick={function(){setEmailDetail(null);}} style={{background:C.rowAlt,color:C.muted,border:"none",borderRadius:8,padding:"6px 14px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:font}}>Cerrar</button>
                </div>
                <div style={{overflowX:"auto"}}>
                  <table style={{width:"100%",borderCollapse:"collapse",fontSize:13,fontFamily:font}}>
                    <thead>
                      <tr style={{borderBottom:"2px solid "+C.border}}>
                        <th style={{textAlign:"left",padding:"10px 8px",fontSize:11,color:C.muted,fontWeight:700,textTransform:"uppercase",letterSpacing:0.5}}>Campa{"\u00F1"}a</th>
                        {cfg.columns.map(function(col){return <th key={col.h} style={{textAlign:"right",padding:"10px 8px",fontSize:11,color:C.muted,fontWeight:700,textTransform:"uppercase",letterSpacing:0.5}}>{col.h}</th>;})}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map(function(r,idx){
                        return <tr key={r.id||idx} style={{borderBottom:"1px solid "+C.border,background:idx%2===0?"transparent":C.rowAlt}}>
                          <td style={{padding:"10px 8px",fontWeight:600,maxWidth:300,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                            {r.name}
                            {r.wf && <span style={{marginLeft:8,fontSize:10,fontWeight:800,color:r.wf==="WF#4"?C.accent:C.purple,background:(r.wf==="WF#4"?C.accent:C.purple)+"15",padding:"2px 6px",borderRadius:4}}>{r.wf}</span>}
                          </td>
                          {cfg.columns.map(function(col){
                            var val=r[col.k];
                            var display=col.k.indexOf("Pct")>=0?val+"%":typeof val==="number"?val.toLocaleString():val;
                            return <td key={col.h} style={{padding:"10px 8px",fontFamily:mono,textAlign:"right",color:col===cfg.columns[0]?cfg.color:C.text,fontWeight:col===cfg.columns[0]?800:400}}>{display}</td>;
                          })}
                        </tr>;
                      })}
                      {rows.length===0 && <tr><td colSpan={cfg.columns.length+1} style={{textAlign:"center",padding:20,color:C.muted}}>No hay datos para mostrar</td></tr>}
                    </tbody>
                  </table>
                </div>
              </Cd>;
            })()}

            {/* Workflow Comparison */}
            {hasWfSplit && <Cd style={{marginBottom:22}}>
              <Sec>Comparaci{"\u00F3"}n Workflow #4 vs #5</Sec>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:24}}>
                {[{label:"Workflow #4",m:m4,c:C.accent,count:(ed.wf4&&ed.wf4.campaigns||[]).length},{label:"Workflow #5",m:m5,c:C.purple,count:(ed.wf5&&ed.wf5.campaigns||[]).length}].map(function(wf){
                  return <div key={wf.label} style={{background:C.rowBg,borderRadius:12,padding:18}}>
                    <div style={{fontSize:15,fontWeight:800,color:wf.c,marginBottom:14}}>{wf.label} <span style={{fontSize:12,fontWeight:500,color:C.muted}}>({wf.count} campa{"\u00F1"}as)</span></div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                      {[
                        {label:"Enviados",val:(wf.m.sent||0).toLocaleString(),best:better(m4.sent,m5.sent,true)===(wf.label==="Workflow #4"?"wf4":"wf5")},
                        {label:"Entregados",val:(wf.m.delivered||0).toLocaleString(),best:better(m4.delivered,m5.delivered,true)===(wf.label==="Workflow #4"?"wf4":"wf5")},
                        {label:"Abiertos %",val:(wf.m.openRate||0)+"%",best:better(m4.openRate,m5.openRate,true)===(wf.label==="Workflow #4"?"wf4":"wf5")},
                        {label:"Clicados %",val:(wf.m.clickRate||0)+"%",best:better(m4.clickRate,m5.clickRate,true)===(wf.label==="Workflow #4"?"wf4":"wf5")},
                        {label:"Bounces",val:(wf.m.totalBounces||0).toLocaleString(),best:better(m4.totalBounces,m5.totalBounces,false)===(wf.label==="Workflow #4"?"wf4":"wf5")},
                        {label:"Unsubs",val:(wf.m.unsubscriptions||0).toLocaleString(),best:better(m4.unsubscriptions,m5.unsubscriptions,false)===(wf.label==="Workflow #4"?"wf4":"wf5")},
                      ].map(function(row){return <div key={row.label} style={{padding:"8px 10px",borderRadius:8,background:row.best?C.lGreen:"transparent"}}>
                        <div style={{fontSize:11,color:C.muted,fontWeight:700,textTransform:"uppercase",letterSpacing:0.5}}>{row.label}</div>
                        <div style={{fontSize:20,fontWeight:800,fontFamily:mono,color:C.text,marginTop:2}}>{row.val}</div>
                        {row.best && <div style={{fontSize:10,color:C.green,fontWeight:700,marginTop:1}}>Mejor</div>}
                      </div>;})}
                    </div>
                  </div>;
                })}
              </div>
            </Cd>}

            {/* Campaign detail table */}
            <Cd style={{marginBottom:22}}>
              <Sec>Detalle por Campa{"\u00F1"}a</Sec>
              <div style={{overflowX:"auto"}}>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:13,fontFamily:font}}>
                  <thead>
                    <tr style={{borderBottom:"2px solid "+C.border}}>
                      {["Campa\u00F1a","Enviados","Entregados","Abiertos (%)","Clicados (%)","Bounces","Quejas"].map(function(h){
                        return <th key={h} style={{textAlign:"left",padding:"10px 8px",fontSize:11,color:C.muted,fontWeight:700,textTransform:"uppercase",letterSpacing:0.5}}>{h}</th>;
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {allCampaigns.map(function(c,idx){
                      var gs=c.statistics&&c.statistics.globalStats||{};
                      var cSent=gs.sent||0;var cDel=gs.delivered||0;var cOpen=gs.uniqueOpens||0;var cClick=gs.uniqueClicks||0;
                      var cBounce=(gs.hardBounces||0)+(gs.softBounces||0);var cComplaints=gs.complaints||0;
                      var openPct=cDel>0?(cOpen/cDel*100).toFixed(1):"0";
                      var clickPct=cDel>0?(cClick/cDel*100).toFixed(1):"0";
                      var wfTag=null;
                      if(ed.wf4&&ed.wf4.campaigns&&ed.wf4.campaigns.indexOf(c)>=0)wfTag="WF#4";
                      else if(ed.wf5&&ed.wf5.campaigns&&ed.wf5.campaigns.indexOf(c)>=0)wfTag="WF#5";
                      return <tr key={c.id||idx} style={{borderBottom:"1px solid "+C.border,background:idx%2===0?"transparent":C.rowAlt}}>
                        <td style={{padding:"10px 8px",fontWeight:600,maxWidth:280,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                          {c.name||"Campaign #"+c.id}
                          {wfTag && <span style={{marginLeft:8,fontSize:10,fontWeight:800,color:wfTag==="WF#4"?C.accent:C.purple,background:(wfTag==="WF#4"?C.accent:C.purple)+"15",padding:"2px 6px",borderRadius:4}}>{wfTag}</span>}
                        </td>
                        <td style={{padding:"10px 8px",fontFamily:mono}}>{cSent.toLocaleString()}</td>
                        <td style={{padding:"10px 8px",fontFamily:mono}}>{cDel.toLocaleString()}</td>
                        <td style={{padding:"10px 8px",fontFamily:mono}}>{cOpen.toLocaleString()} <span style={{color:C.muted}}>({openPct}%)</span></td>
                        <td style={{padding:"10px 8px",fontFamily:mono}}>{cClick.toLocaleString()} <span style={{color:C.muted}}>({clickPct}%)</span></td>
                        <td style={{padding:"10px 8px",fontFamily:mono}}>{cBounce.toLocaleString()}</td>
                        <td style={{padding:"10px 8px",fontFamily:mono}}>{cComplaints.toLocaleString()}</td>
                      </tr>;
                    })}
                    {allCampaigns.length===0 && <tr><td colSpan={7} style={{textAlign:"center",padding:20,color:C.muted}}>No hay campa{"\u00F1"}as de email para mostrar</td></tr>}
                  </tbody>
                </table>
              </div>
            </Cd>

            {/* Additional cards: Unsubscribes & Complaints */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:22}}>
              <Cd onClick={function(){setEmailDetail(emailDetail==="unsubs"?null:"unsubs");}} style={{cursor:"pointer",border:emailDetail==="unsubs"?"2px solid "+C.yellow:undefined}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                  <div>
                    <div style={{fontSize:12,color:C.muted,fontWeight:700,textTransform:"uppercase",letterSpacing:1}}>Unsubscribes</div>
                    <div style={{fontSize:36,fontWeight:900,color:C.yellow,fontFamily:mono,marginTop:6}}>{(mt.unsubscriptions||0).toLocaleString()}</div>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontSize:28,fontWeight:800,color:C.yellow,fontFamily:mono}}>{mt.unsubRate||0}%</div>
                    <div style={{fontSize:12,color:C.muted}}>del total entregado</div>
                  </div>
                </div>
              </Cd>
              <Cd onClick={function(){setEmailDetail(emailDetail==="complaints"?null:"complaints");}} style={{cursor:"pointer",border:emailDetail==="complaints"?"2px solid "+C.orange:undefined}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                  <div>
                    <div style={{fontSize:12,color:C.muted,fontWeight:700,textTransform:"uppercase",letterSpacing:1}}>Quejas / Spam</div>
                    <div style={{fontSize:36,fontWeight:900,color:C.orange,fontFamily:mono,marginTop:6}}>{(mt.complaints||0).toLocaleString()}</div>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontSize:28,fontWeight:800,color:C.orange,fontFamily:mono}}>{mt.complaintRate||0}%</div>
                    <div style={{fontSize:12,color:C.muted}}>del total entregado</div>
                  </div>
                </div>
              </Cd>
            </div>
          </>)}
        </>);
      })()}

      {section==="inbound" && subTab==="ads" && (function(){
        var ad=adsData||{};
        var adLeads=ad.leads||[];
        var adDaily=ad.daily||[];
        var adCountries=ad.countries||[];
        var adByFaq=ad.byFaq||[[],[],[]];
        var adMeetOffered=ad.meetOffered||[];
        var adMeetConfirmed=ad.meetConfirmed||[];
        var adSignups=ad.signupConfirmed||[];
        var faqCounts=[adByFaq[0].length,adByFaq[1].length,adByFaq[2].length];
        var faqData=ADS_FAQ_SHORT.map(function(label,i){return{name:label,leads:adByFaq[i],count:faqCounts[i],color:ADS_FAQ_COLORS[i]};});
        var maxFaq=Math.max.apply(null,faqCounts.concat([1]));

        function openAdsModal(title,leads){setAdsModal({title:title,leads:leads});}

        return (<>
          {adsModal && <MeetModal leads={adsModal.leads} mode={0} onClose={function(){setAdsModal(null);}} title={adsModal.title} crmContacts={crmContacts}/>}

          {adsLoading && <div style={{textAlign:"center",padding:40,color:C.muted,fontSize:15}}><div style={{width:30,height:30,border:"3px solid "+C.border,borderTopColor:C.accent,borderRadius:"50%",animation:"spin 0.8s linear infinite",margin:"0 auto 12px"}}/>Cargando datos de Ads...</div>}
          {adsError && <div style={{color:C.red,fontSize:13,fontWeight:600,marginBottom:16,background:C.lRed,padding:"12px 18px",borderRadius:10,border:"1px solid "+C.redBorder}}>Error: {adsError} <button onClick={function(){setAdsError(null);setAdsInited(false);}} style={{marginLeft:12,background:C.accent,color:"#fff",border:"none",borderRadius:6,padding:"4px 12px",fontSize:12,fontWeight:700,cursor:"pointer"}}>Reintentar</button></div>}

          {/* Header bar */}
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:18,flexWrap:"wrap"}}>
            <input type="month" value={growthMonth} onChange={function(e){setGrowthMonth(e.target.value);setAdsInited(false);}} style={{padding:"8px 14px",border:"1px solid "+C.border,borderRadius:10,fontSize:14,fontFamily:font,background:C.inputBg,color:C.text,outline:"none"}}/>
            <button onClick={function(){setAdsInited(false);initAds();}} disabled={adsLoading} style={{background:C.accent,color:"#fff",border:"none",borderRadius:10,padding:"8px 20px",fontSize:13,fontWeight:700,cursor:adsLoading?"wait":"pointer",fontFamily:font,opacity:adsLoading?0.6:1}}>Actualizar</button>
          </div>

          {!adsLoading && adsInited && (<>
            {/* KPI row 1: Total + FAQ breakdown */}
            <Sec>Conversaciones por FAQ</Sec>
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:16,marginBottom:22}}>
              <Cd onClick={function(){openAdsModal("Todas las Conversaciones Ads ("+adLeads.length+")",adLeads);}} style={{cursor:"pointer",border:"2px solid "+C.accent+"44",background:"linear-gradient(135deg, "+C.card+" 0%, "+C.accent+"08 100%)"}}>
                <div style={{fontSize:12,color:C.muted,fontWeight:700,textTransform:"uppercase",letterSpacing:1}}>Total Conversaciones Ads</div>
                <div style={{fontSize:36,fontWeight:900,color:C.accent,fontFamily:mono,marginTop:6}}>{(ad.total||0).toLocaleString()}</div>
                <div style={{fontSize:11,color:C.accent,marginTop:8,fontWeight:600}}>Click para ver conversaciones {"\u2192"}</div>
              </Cd>
              {faqData.map(function(f,idx){
                return <Cd key={idx} onClick={function(){openAdsModal(f.name+" ("+f.count+")",f.leads);}} style={{cursor:"pointer",border:"2px solid "+f.color+"44",background:"linear-gradient(135deg, "+C.card+" 0%, "+f.color+"08 100%)"}}>
                  <div style={{fontSize:12,color:C.muted,fontWeight:700,textTransform:"uppercase",letterSpacing:1}}>{f.name}</div>
                  <div style={{fontSize:36,fontWeight:900,color:f.color,fontFamily:mono,marginTop:6}}>{f.count.toLocaleString()}</div>
                  <div style={{fontSize:12,color:C.muted,marginTop:2}}>{ad.total>0?(f.count/ad.total*100).toFixed(1):0}% del total</div>
                  <div style={{fontSize:11,color:f.color,marginTop:8,fontWeight:600}}>Click para ver conversaciones {"\u2192"}</div>
                </Cd>;
              })}
            </div>

            {/* KPI row 2: Funnel - Meetings offered, confirmed, signups */}
            <Sec>Funnel de Conversi{"\u00F3"}n</Sec>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:16,marginBottom:22}}>
              <Cd onClick={function(){openAdsModal("Reuni\u00F3n Ofrecida ("+adMeetOffered.length+")",adMeetOffered);}} style={{cursor:"pointer",border:"2px solid "+C.cyan+"44",background:"linear-gradient(135deg, "+C.card+" 0%, "+C.cyan+"08 100%)"}}>
                <div style={{fontSize:12,color:C.muted,fontWeight:700,textTransform:"uppercase",letterSpacing:1}}>Reuniones Ofrecidas</div>
                <div style={{fontSize:36,fontWeight:900,color:C.cyan,fontFamily:mono,marginTop:6}}>{adMeetOffered.length.toLocaleString()}</div>
                <div style={{fontSize:12,color:C.muted,marginTop:2}}>{ad.total>0?(adMeetOffered.length/ad.total*100).toFixed(1):0}% de conversaciones</div>
                <div style={{fontSize:11,color:C.cyan,marginTop:8,fontWeight:600}}>Click para ver conversaciones {"\u2192"}</div>
              </Cd>
              <Cd onClick={function(){openAdsModal("Reuniones Agendadas ("+adMeetConfirmed.length+")",adMeetConfirmed);}} style={{cursor:"pointer",border:"2px solid "+C.green+"44",background:"linear-gradient(135deg, "+C.card+" 0%, "+C.green+"08 100%)"}}>
                <div style={{fontSize:12,color:C.muted,fontWeight:700,textTransform:"uppercase",letterSpacing:1}}>Reuniones Agendadas</div>
                <div style={{fontSize:36,fontWeight:900,color:C.green,fontFamily:mono,marginTop:6}}>{adMeetConfirmed.length.toLocaleString()}</div>
                <div style={{fontSize:12,color:C.muted,marginTop:2}}>{adMeetOffered.length>0?(adMeetConfirmed.length/adMeetOffered.length*100).toFixed(1):0}% de ofrecidas</div>
                <div style={{fontSize:11,color:C.green,marginTop:8,fontWeight:600}}>Click para ver conversaciones {"\u2192"}</div>
              </Cd>
              <Cd onClick={function(){openAdsModal("Signups Confirmados ("+adSignups.length+")",adSignups);}} style={{cursor:"pointer",border:"2px solid "+C.purple+"44",background:"linear-gradient(135deg, "+C.card+" 0%, "+C.purple+"08 100%)"}}>
                <div style={{fontSize:12,color:C.muted,fontWeight:700,textTransform:"uppercase",letterSpacing:1}}>Signups Confirmados</div>
                <div style={{fontSize:36,fontWeight:900,color:C.purple,fontFamily:mono,marginTop:6}}>{adSignups.length.toLocaleString()}</div>
                <div style={{fontSize:12,color:C.muted,marginTop:2}}>{ad.total>0?(adSignups.length/ad.total*100).toFixed(1):0}% de conversaciones</div>
                <div style={{fontSize:11,color:C.purple,marginTop:8,fontWeight:600}}>Click para ver conversaciones {"\u2192"}</div>
              </Cd>
            </div>

            {/* Daily trend chart */}
            <Cd style={{marginBottom:22}}>
              <Sec>Tendencia Diaria</Sec>
              <div style={{width:"100%",height:260}}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={adDaily} margin={{top:10,right:30,left:0,bottom:0}}>
                    <CartesianGrid strokeDasharray="3 3" stroke={C.border}/>
                    <XAxis dataKey="date" tick={{fontSize:11,fill:C.muted}} tickFormatter={function(v){return v.slice(8);}}/>
                    <YAxis tick={{fontSize:11,fill:C.muted}} allowDecimals={false}/>
                    <Tooltip contentStyle={{background:C.card,border:"1px solid "+C.border,borderRadius:8,fontSize:12}} labelFormatter={function(v){return "Fecha: "+v;}}/>
                    <Area type="monotone" dataKey="count" stroke={C.accent} fill={C.accent+"33"} strokeWidth={2} name="Conversaciones"/>
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Cd>

            {/* FAQ breakdown + Country breakdown side by side */}
            <div style={{display:"flex",gap:16,marginBottom:22,flexWrap:"wrap"}}>
              <Cd style={{flex:1,minWidth:300}}>
                <Sec>Breakdown por FAQ</Sec>
                {faqData.map(function(f,idx){
                  var pct=maxFaq>0?(f.count/maxFaq*100):0;
                  return <div key={idx} onClick={function(){openAdsModal(f.name+" ("+f.count+")",f.leads);}} style={{display:"flex",alignItems:"center",gap:10,marginBottom:10,cursor:"pointer",padding:"4px 6px",borderRadius:8,transition:"background 0.15s"}} onMouseEnter={function(e){e.currentTarget.style.background=C.rowAlt;}} onMouseLeave={function(e){e.currentTarget.style.background="transparent";}}>
                    <div style={{width:160,fontSize:12,fontWeight:600,color:C.sub,textAlign:"right",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{f.name}</div>
                    <div style={{flex:1,background:C.barTrack,borderRadius:6,height:22,overflow:"hidden"}}>
                      <div style={{height:"100%",borderRadius:6,background:f.color,width:pct+"%",transition:"width 0.3s ease"}}/>
                    </div>
                    <div style={{width:50,fontSize:13,fontWeight:800,fontFamily:mono,color:C.text}}>{f.count}</div>
                  </div>;
                })}
                {faqData.length===0 && <div style={{color:C.muted,fontSize:13,textAlign:"center",padding:20}}>Sin datos</div>}
              </Cd>
              <Cd style={{flex:1,minWidth:300}}>
                <Sec>Breakdown por Pa{"\u00ED"}s</Sec>
                {adCountries.map(function(c,idx){
                  var maxC=adCountries.length>0?adCountries[0].count:1;
                  var pct=maxC>0?(c.count/maxC*100):0;
                  var clr=[C.accent,C.green,C.purple,C.cyan,C.orange,C.pink,C.yellow,C.red][idx%8];
                  return <div key={c.country} style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
                    <div style={{width:120,fontSize:12,fontWeight:600,color:C.sub,textAlign:"right",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.country}</div>
                    <div style={{flex:1,background:C.barTrack,borderRadius:6,height:22,overflow:"hidden"}}>
                      <div style={{height:"100%",borderRadius:6,background:clr,width:pct+"%",transition:"width 0.3s ease"}}/>
                    </div>
                    <div style={{width:50,fontSize:13,fontWeight:800,fontFamily:mono,color:C.text}}>{c.count}</div>
                  </div>;
                })}
                {adCountries.length===0 && <div style={{color:C.muted,fontSize:13,textAlign:"center",padding:20}}>Sin datos</div>}
              </Cd>
            </div>
          </>)}
        </>);
      })()}

      {section==="growth" && subTab==="resumen" && (function(){
        var gd=growthData||{};
        var lat=gd.latam||{};var bra=gd.brasil||{};
        var latS=gd.latamSources||[];var braS=gd.brasilSources||[];
        var latC=gd.latamContacts||[];var braC=gd.brasilContacts||[];

        function filterPqls(arr){return arr.filter(function(c){var p=(c._contactProps&&c._contactProps.prioridad_plg||"").toLowerCase();return p==="alta"||p==="media"||p==="m\u00E9dia";});}
        function filterBySource(arr,src){return arr.filter(function(c){return(c._contactProps&&c._contactProps.hs_analytics_source||"")=== src;});}

        function openModal(title,contacts){setGrowthModal({title:title,contacts:contacts});}

        function kpiCard(label,actual,goal,pct,color,metaToDate,avanceToDate,onClick){
          var ahead=avanceToDate>=100;
          return <Cd onClick={onClick} style={{cursor:"pointer",border:"2px solid "+color+"44",background:"linear-gradient(135deg, "+C.card+" 0%, "+color+"08 100%)"}}>
            <div style={{fontSize:12,color:C.muted,fontWeight:700,textTransform:"uppercase",letterSpacing:1}}>{label}</div>
            <div style={{fontSize:32,fontWeight:900,color:color,fontFamily:mono,marginTop:6}}>{actual.toLocaleString()}</div>
            <div style={{fontSize:12,color:C.muted,marginTop:2}}>Meta: {Math.round(goal).toLocaleString()} ({pct.toFixed(1)}% del mes)</div>
            <div style={{marginTop:6,fontSize:12}}>
              <span style={{color:C.muted}}>To Date: </span>
              <span style={{fontWeight:700,color:ahead?C.green:C.red}}>{Math.round(metaToDate).toLocaleString()}</span>
              <span style={{marginLeft:8,fontWeight:800,color:ahead?C.green:C.red}}>{avanceToDate.toFixed(1)}%</span>
              <span style={{marginLeft:4,fontSize:11,color:ahead?C.green:C.red}}>{ahead?"\u25B2":"\u25BC"}</span>
            </div>
            <div style={{fontSize:11,color:C.accent,marginTop:8,fontWeight:600}}>Click para ver contactos {"\u2192"}</div>
          </Cd>;
        }

        function sourceChart(sources,label,regionContacts,regionName){
          var maxCount=sources.length>0?sources[0].count:1;
          return <Cd style={{flex:1,minWidth:300}}>
            <Sec>{label}</Sec>
            {sources.map(function(s,idx){
              var pct=maxCount>0?(s.count/maxCount*100):0;
              var clr=SOURCE_COLORS[s.source]||C.muted;
              return <div key={s.source} onClick={function(){openModal(regionName+" — "+s.source+" ("+s.count+")",filterBySource(regionContacts,s.source));}} style={{display:"flex",alignItems:"center",gap:10,marginBottom:8,cursor:"pointer",padding:"4px 6px",borderRadius:8,transition:"background 0.15s"}} onMouseEnter={function(e){e.currentTarget.style.background=C.rowAlt;}} onMouseLeave={function(e){e.currentTarget.style.background="transparent";}}>
                <div style={{width:140,fontSize:12,fontWeight:600,color:C.sub,textAlign:"right",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.source}</div>
                <div style={{flex:1,background:C.barTrack,borderRadius:6,height:22,overflow:"hidden"}}>
                  <div style={{height:"100%",borderRadius:6,background:clr,width:pct+"%",transition:"width 0.3s ease"}}/>
                </div>
                <div style={{width:50,fontSize:13,fontWeight:800,fontFamily:mono,color:C.text}}>{s.count}</div>
              </div>;
            })}
            {sources.length===0 && <div style={{color:C.muted,fontSize:13,textAlign:"center",padding:20}}>Sin datos</div>}
          </Cd>;
        }

        return (<>
          {growthModal && <GrowthContactsModal contacts={growthModal.contacts} title={growthModal.title} onClose={function(){setGrowthModal(null);}}/>}

          {growthLoading && <div style={{textAlign:"center",padding:40,color:C.muted,fontSize:15}}><div style={{width:30,height:30,border:"3px solid "+C.border,borderTopColor:C.accent,borderRadius:"50%",animation:"spin 0.8s linear infinite",margin:"0 auto 12px"}}/>Cargando datos de Growth...</div>}
          {growthError && <div style={{color:C.red,fontSize:13,fontWeight:600,marginBottom:16,background:C.lRed,padding:"12px 18px",borderRadius:10,border:"1px solid "+C.redBorder}}>Error: {growthError} <button onClick={function(){setGrowthError(null);setGrowthInited(false);}} style={{marginLeft:12,background:C.accent,color:"#fff",border:"none",borderRadius:6,padding:"4px 12px",fontSize:12,fontWeight:700,cursor:"pointer"}}>Reintentar</button></div>}

          {/* Header bar */}
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:18,flexWrap:"wrap"}}>
            <input type="month" value={growthMonth} onChange={function(e){setGrowthMonth(e.target.value);setGrowthInited(false);}} style={{padding:"8px 14px",border:"1px solid "+C.border,borderRadius:10,fontSize:14,fontFamily:font,background:C.inputBg,color:C.text,outline:"none"}}/>
            <button onClick={function(){setGrowthInited(false);initGrowth();}} disabled={growthLoading} style={{background:C.accent,color:"#fff",border:"none",borderRadius:10,padding:"8px 20px",fontSize:13,fontWeight:700,cursor:growthLoading?"wait":"pointer",fontFamily:font,opacity:growthLoading?0.6:1}}>Actualizar</button>
            <button onClick={function(){setShowGoalsEditor(true);}} style={{background:C.rowAlt,color:C.muted,border:"1px solid "+C.border,borderRadius:10,padding:"8px 20px",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:font}}>Configurar Metas</button>
            {gd.currentDay && <span style={{fontSize:12,color:C.muted,background:C.rowAlt,padding:"4px 10px",borderRadius:6,fontWeight:600}}>D{"\u00ED"}a {gd.currentDay} de {gd.totalDays}</span>}
          </div>

          {!growthLoading && growthInited && (<>
            {/* LATAM KPIs */}
            <Sec>LATAM</Sec>
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:16,marginBottom:22}}>
              {kpiCard("Signups",lat.signups||0,lat.signupsGoal||0,lat.avanceSignups||0,C.accent,lat.metaToDateSignups||0,lat.avanceToDateSignups||0,function(){openModal("LATAM — Todos los Signups ("+latC.length+")",latC);})}
              {kpiCard("PQLs",lat.pqls||0,lat.pqlsGoal||0,lat.avancePqls||0,C.purple,lat.metaToDatePqls||0,lat.avanceToDatePqls||0,function(){openModal("LATAM — PQLs ("+(lat.pqls||0)+")",filterPqls(latC));})}
              <Cd onClick={function(){openModal("LATAM — Todos los Signups ("+latC.length+")",latC);}} style={{cursor:"pointer"}}>
                <div style={{fontSize:12,color:C.muted,fontWeight:700,textTransform:"uppercase",letterSpacing:1}}>Meta to Date (Signups)</div>
                <div style={{fontSize:32,fontWeight:900,color:C.cyan,fontFamily:mono,marginTop:6}}>{Math.round(lat.metaToDateSignups||0).toLocaleString()}</div>
                <div style={{fontSize:12,color:C.muted,marginTop:2}}>Pro-rata d{"\u00ED"}a {gd.currentDay||0} / {gd.totalDays||0}</div>
                <div style={{fontSize:11,color:C.accent,marginTop:8,fontWeight:600}}>Click para ver contactos {"\u2192"}</div>
              </Cd>
              <Cd onClick={function(){openModal("LATAM — Todos los Signups ("+latC.length+")",latC);}} style={{cursor:"pointer"}}>
                <div style={{fontSize:12,color:C.muted,fontWeight:700,textTransform:"uppercase",letterSpacing:1}}>Avance to Date</div>
                <div style={{fontSize:32,fontWeight:900,color:(lat.avanceToDateSignups||0)>=100?C.green:C.red,fontFamily:mono,marginTop:6}}>{(lat.avanceToDateSignups||0).toFixed(1)}%</div>
                <div style={{fontSize:12,color:C.muted,marginTop:2}}>{(lat.avanceToDateSignups||0)>=100?"Por encima de la meta":"Por debajo de la meta"}</div>
                <div style={{fontSize:11,color:C.accent,marginTop:8,fontWeight:600}}>Click para ver contactos {"\u2192"}</div>
              </Cd>
            </div>

            {/* Brasil KPIs */}
            <Sec>Brasil</Sec>
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:16,marginBottom:22}}>
              {kpiCard("Signups",bra.signups||0,bra.signupsGoal||0,bra.avanceSignups||0,C.green,bra.metaToDateSignups||0,bra.avanceToDateSignups||0,function(){openModal("Brasil — Todos los Signups ("+braC.length+")",braC);})}
              {kpiCard("PQLs",bra.pqls||0,bra.pqlsGoal||0,bra.avancePqls||0,C.orange,bra.metaToDatePqls||0,bra.avanceToDatePqls||0,function(){openModal("Brasil — PQLs ("+(bra.pqls||0)+")",filterPqls(braC));})}
              <Cd onClick={function(){openModal("Brasil — Todos los Signups ("+braC.length+")",braC);}} style={{cursor:"pointer"}}>
                <div style={{fontSize:12,color:C.muted,fontWeight:700,textTransform:"uppercase",letterSpacing:1}}>Meta to Date (Signups)</div>
                <div style={{fontSize:32,fontWeight:900,color:C.cyan,fontFamily:mono,marginTop:6}}>{Math.round(bra.metaToDateSignups||0).toLocaleString()}</div>
                <div style={{fontSize:12,color:C.muted,marginTop:2}}>Pro-rata d{"\u00ED"}a {gd.currentDay||0} / {gd.totalDays||0}</div>
                <div style={{fontSize:11,color:C.accent,marginTop:8,fontWeight:600}}>Click para ver contactos {"\u2192"}</div>
              </Cd>
              <Cd onClick={function(){openModal("Brasil — Todos los Signups ("+braC.length+")",braC);}} style={{cursor:"pointer"}}>
                <div style={{fontSize:12,color:C.muted,fontWeight:700,textTransform:"uppercase",letterSpacing:1}}>Avance to Date</div>
                <div style={{fontSize:32,fontWeight:900,color:(bra.avanceToDateSignups||0)>=100?C.green:C.red,fontFamily:mono,marginTop:6}}>{(bra.avanceToDateSignups||0).toFixed(1)}%</div>
                <div style={{fontSize:12,color:C.muted,marginTop:2}}>{(bra.avanceToDateSignups||0)>=100?"Por encima de la meta":"Por debajo de la meta"}</div>
                <div style={{fontSize:11,color:C.accent,marginTop:8,fontWeight:600}}>Click para ver contactos {"\u2192"}</div>
              </Cd>
            </div>

            {/* Sources breakdown */}
            <Sec>Breakdown por Fuente</Sec>
            <div style={{display:"flex",gap:16,marginBottom:22,flexWrap:"wrap"}}>
              {sourceChart(latS,"LATAM Sources",latC,"LATAM")}
              {sourceChart(braS,"Brasil Sources",braC,"Brasil")}
            </div>

            {/* Resumen para compartir */}
            <Cd style={{marginBottom:22}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
                <Sec>Resumen para Compartir</Sec>
                <button onClick={function(){navigator.clipboard.writeText(gd.summary||"");}} style={{background:C.accent,color:"#fff",border:"none",borderRadius:8,padding:"6px 16px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:font}}>Copiar</button>
              </div>
              <pre style={{background:C.rowBg,borderRadius:10,padding:16,fontSize:12,fontFamily:mono,color:C.sub,whiteSpace:"pre-wrap",lineHeight:1.6,margin:0,border:"1px solid "+C.border}}>{gd.summary||""}</pre>
            </Cd>

            {/* PostHog sources comparison */}
            <Sec>Fuentes de Leads — PostHog vs HubSpot</Sec>
            {posthogSourcesLoading && <div style={{textAlign:"center",padding:20,color:C.muted,fontSize:13}}>Cargando datos de PostHog...</div>}
            {posthogSourcesError && <div style={{color:C.red,fontSize:12,marginBottom:12,background:C.lRed,padding:"8px 14px",borderRadius:8,border:"1px solid "+C.redBorder}}>PostHog: {posthogSourcesError}</div>}
            {posthogSources && (function(){
              var phDom=posthogSources.byDomain||[];
              var phUtm=posthogSources.byUtmSource||[];
              var allHs=[].concat(latS,braS);
              var hsMap={};
              for(var hi=0;hi<allHs.length;hi++){var hk=allHs[hi].source;hsMap[hk]=(hsMap[hk]||0)+allHs[hi].count;}
              var hsCombined=Object.keys(hsMap).map(function(k){return{source:k,count:hsMap[k]};}).sort(function(a,b){return b.count-a.count;});

              function phBar(items,label){
                var max=items.length>0?items[0].count:1;
                return <Cd style={{flex:1,minWidth:280}}>
                  <div style={{fontSize:13,fontWeight:700,color:C.sub,marginBottom:12}}>{label}</div>
                  {items.map(function(s){
                    var pct=max>0?(s.count/max*100):0;
                    return <div key={s.source} style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}>
                      <div style={{width:150,fontSize:11,fontWeight:600,color:C.sub,textAlign:"right",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={s.source}>{s.source}</div>
                      <div style={{flex:1,background:C.barTrack,borderRadius:6,height:20,overflow:"hidden"}}>
                        <div style={{height:"100%",borderRadius:6,background:C.cyan,width:pct+"%",transition:"width 0.3s ease"}}/>
                      </div>
                      <div style={{width:45,fontSize:12,fontWeight:800,fontFamily:mono,color:C.text}}>{s.count}</div>
                    </div>;
                  })}
                  {items.length===0 && <div style={{color:C.muted,fontSize:12,textAlign:"center",padding:16}}>Sin datos</div>}
                </Cd>;
              }

              function hsBar(items,label){
                var max=items.length>0?items[0].count:1;
                return <Cd style={{flex:1,minWidth:280}}>
                  <div style={{fontSize:13,fontWeight:700,color:C.sub,marginBottom:12}}>{label}</div>
                  {items.map(function(s){
                    var pct=max>0?(s.count/max*100):0;
                    var clr=SOURCE_COLORS[s.source]||C.muted;
                    return <div key={s.source} style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}>
                      <div style={{width:150,fontSize:11,fontWeight:600,color:C.sub,textAlign:"right",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.source}</div>
                      <div style={{flex:1,background:C.barTrack,borderRadius:6,height:20,overflow:"hidden"}}>
                        <div style={{height:"100%",borderRadius:6,background:clr,width:pct+"%",transition:"width 0.3s ease"}}/>
                      </div>
                      <div style={{width:45,fontSize:12,fontWeight:800,fontFamily:mono,color:C.text}}>{s.count}</div>
                    </div>;
                  })}
                </Cd>;
              }

              return <div style={{display:"flex",gap:16,marginBottom:22,flexWrap:"wrap"}}>
                {phBar(phDom,"PostHog — Referring Domain")}
                {phBar(phUtm,"PostHog — UTM Source")}
                {hsBar(hsCombined,"HubSpot — Analytics Source (Total)")}
              </div>;
            })()}
          </>)}

          {/* Goals editor modal */}
          {showGoalsEditor && (function(){
            var lg=growthGoals;
            var tmpRef={latamSignups:lg.latam.signups,latamPqls:lg.latam.pqls,brasilSignups:lg.brasil.signups,brasilPqls:lg.brasil.pqls};
            function onSave(){
              var ls=parseFloat(document.getElementById("ge-ls").value)||0;
              var lp=parseFloat(document.getElementById("ge-lp").value)||0;
              var bs=parseFloat(document.getElementById("ge-bs").value)||0;
              var bp=parseFloat(document.getElementById("ge-bp").value)||0;
              saveGrowthGoals({latam:{signups:ls,pqls:lp},brasil:{signups:bs,pqls:bp}});
            }
            return <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"#00000066",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center"}} onClick={function(e){if(e.target===e.currentTarget)setShowGoalsEditor(false);}}>
              <div style={{background:C.card,borderRadius:16,padding:28,width:420,maxWidth:"90vw",boxShadow:"0 20px 60px #00000033"}}>
                <div style={{fontSize:18,fontWeight:800,color:C.text,marginBottom:20}}>Configurar Metas — {growthMonth}</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
                  <div>
                    <label style={{fontSize:12,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:0.5}}>LATAM Signups</label>
                    <input id="ge-ls" type="number" defaultValue={tmpRef.latamSignups} style={{width:"100%",padding:"10px 12px",border:"1px solid "+C.border,borderRadius:8,fontSize:15,fontFamily:mono,background:C.inputBg,color:C.text,marginTop:4,boxSizing:"border-box"}}/>
                  </div>
                  <div>
                    <label style={{fontSize:12,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:0.5}}>LATAM PQLs</label>
                    <input id="ge-lp" type="number" defaultValue={tmpRef.latamPqls} style={{width:"100%",padding:"10px 12px",border:"1px solid "+C.border,borderRadius:8,fontSize:15,fontFamily:mono,background:C.inputBg,color:C.text,marginTop:4,boxSizing:"border-box"}}/>
                  </div>
                  <div>
                    <label style={{fontSize:12,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:0.5}}>Brasil Signups</label>
                    <input id="ge-bs" type="number" defaultValue={tmpRef.brasilSignups} style={{width:"100%",padding:"10px 12px",border:"1px solid "+C.border,borderRadius:8,fontSize:15,fontFamily:mono,background:C.inputBg,color:C.text,marginTop:4,boxSizing:"border-box"}}/>
                  </div>
                  <div>
                    <label style={{fontSize:12,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:0.5}}>Brasil PQLs</label>
                    <input id="ge-bp" type="number" defaultValue={tmpRef.brasilPqls} style={{width:"100%",padding:"10px 12px",border:"1px solid "+C.border,borderRadius:8,fontSize:15,fontFamily:mono,background:C.inputBg,color:C.text,marginTop:4,boxSizing:"border-box"}}/>
                  </div>
                </div>
                <div style={{display:"flex",gap:12,marginTop:20,justifyContent:"flex-end"}}>
                  <button onClick={function(){setShowGoalsEditor(false);}} style={{background:C.rowAlt,color:C.muted,border:"1px solid "+C.border,borderRadius:8,padding:"10px 20px",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:font}}>Cancelar</button>
                  <button onClick={onSave} style={{background:C.accent,color:"#fff",border:"none",borderRadius:8,padding:"10px 20px",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:font}}>Guardar</button>
                </div>
              </div>
            </div>;
          })()}
        </>);
      })()}


      {showTplConfig && (function(){
        var mk=mode===0?"all":"real";var abD=dataD[mk];
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
        return (<div onClick={function(e){if(e.target===e.currentTarget){setShowTplConfig(false);setAbSelectMode(false);setAbSelected([]);}}} style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.4)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",animation:"fadeInModal 0.2s ease"}}>
          <div style={{background:C.card,borderRadius:16,padding:28,width:"94%",maxWidth:1060,maxHeight:"85vh",overflowY:"auto",boxShadow:"0 20px 60px rgba(0,0,0,0.15)",animation:"scaleInModal 0.2s ease"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
              <div style={{fontSize:18,fontWeight:800,color:C.text}}>Configuraci&oacute;n de Templates</div>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                {allTemplateNames.length>0 && (
                  abSelectMode
                    ? <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <span style={{fontSize:13,color:C.accent,fontWeight:600}}>Selecciona 2 templates para comparar</span>
                        <button onClick={function(){setAbSelectMode(false);setAbSelected([]);}} style={{background:C.rowAlt,border:"1px solid "+C.border,borderRadius:8,padding:"6px 14px",fontSize:12,fontWeight:700,cursor:"pointer",color:C.muted,fontFamily:font}}>Cancelar</button>
                      </div>
                    : <button onClick={function(){setAbSelectMode(true);setAbSelected([]);}} style={{background:C.lPurple,color:C.purple,border:"1px solid "+C.purple+"33",borderRadius:8,padding:"8px 16px",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:font,whiteSpace:"nowrap"}}>+ Crear Test A/B</button>
                )}
                <button onClick={function(){setShowTplConfig(false);setAbSelectMode(false);setAbSelected([]);}} style={{background:"none",border:"none",fontSize:22,color:C.muted,cursor:"pointer",padding:"2px 6px",borderRadius:6,lineHeight:1}} title="Cerrar">{"\u00D7"}</button>
              </div>
            </div>
            <div style={{fontSize:14,color:C.sub,marginBottom:18,lineHeight:1.6}}>Asigna cada template a una categor&iacute;a para agruparlos en la vista de Templates. Templates marcados como <strong>Autom&aacute;tico</strong> o <strong>Campa&ntilde;a</strong> ser&aacute;n excluidos de los indicadores de Resumen.</div>
            {allTemplateNames.length===0 && <div style={{textAlign:"center",padding:30,color:C.muted,fontSize:14}}>No hay templates cargados a&uacute;n. Carga datos primero.</div>}
            {allTemplateNames.length>0 && (<>
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {allTemplateNames.slice().sort(function(a,b){var da=templateLastSent[a]||"";var db=templateLastSent[b]||"";if(da!==db)return db.localeCompare(da);return a.localeCompare(b);}).map(function(tplName){
                  var currentEntry=templateConfig[tplName]||{};
                  var currentCat=typeof currentEntry==="string"?currentEntry:(currentEntry.category||"sin_categoria");
                  var currentRegion=typeof currentEntry==="string"?"":(currentEntry.region||"");
                  var currentQual=currentEntry.qualification||_deduceQual(tplName);
                  var hasAbGroup=currentEntry.ab_group;
                  var isAbSel=abSelected.indexOf(tplName)>=0;
                  var isHidden=currentEntry.hidden||false;
                  return (<div key={tplName} onClick={abSelectMode?function(){handleAbToggle(tplName);}:undefined} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",background:isAbSel?C.abSelBg:hasAbGroup?C.abRowBg:C.rowBg,borderRadius:10,border:"1px solid "+(isAbSel?C.purple+"66":hasAbGroup?C.purple+"33":C.border),cursor:abSelectMode?"pointer":"default",transition:"all 0.15s ease",opacity:isHidden?0.5:1}}>
                    {abSelectMode && (
                      <div style={{width:20,height:20,borderRadius:6,border:"2px solid "+(isAbSel?C.purple:C.border),background:isAbSel?C.purple:C.inputBg,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all 0.15s ease"}}>
                        {isAbSel && <span style={{color:"#FFF",fontSize:12,fontWeight:800}}>{"\u2713"}</span>}
                      </div>
                    )}
                    <div style={{display:"flex",flexDirection:"column",gap:2,flexShrink:0}}>
                      <button onClick={function(e){e.stopPropagation();updateTemplateConfig(tplName,"sort_order",(currentEntry.sort_order||0)-1);}} style={{background:"none",border:"1px solid "+C.border,borderRadius:4,width:22,height:18,fontSize:10,cursor:"pointer",color:C.muted,display:"flex",alignItems:"center",justifyContent:"center",padding:0,lineHeight:1}}>{"\u25B2"}</button>
                      <button onClick={function(e){e.stopPropagation();updateTemplateConfig(tplName,"sort_order",(currentEntry.sort_order||0)+1);}} style={{background:"none",border:"1px solid "+C.border,borderRadius:4,width:22,height:18,fontSize:10,cursor:"pointer",color:C.muted,display:"flex",alignItems:"center",justifyContent:"center",padding:0,lineHeight:1}}>{"\u25BC"}</button>
                    </div>
                    <button onClick={function(e){e.stopPropagation();updateTemplateConfig(tplName,"hidden",!isHidden);}} title={isHidden?"Mostrar template":"Ocultar template"} style={{background:"none",border:"none",cursor:"pointer",padding:"2px 4px",color:isHidden?C.muted:C.accent,flexShrink:0,opacity:isHidden?0.5:0.8,display:"flex",alignItems:"center"}}>{isHidden?<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>}</button>
                    <div style={{flex:1,minWidth:0,fontWeight:700,fontSize:14,fontFamily:mono,display:"flex",alignItems:"center",gap:8,overflow:"hidden"}}>
                      <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={tplName}>{tplName}</span>
                      {hasAbGroup && <span style={{background:C.purple+"18",color:C.purple,padding:"2px 8px",borderRadius:6,fontSize:11,fontWeight:800,letterSpacing:0.5,flexShrink:0}}>A/B</span>}
                      {isHidden && <span style={{background:C.red+"15",color:C.red,padding:"2px 8px",borderRadius:6,fontSize:11,fontWeight:800,letterSpacing:0.5,flexShrink:0}}>Oculto</span>}
                    </div>
                    <select value={currentCat} onClick={function(e){e.stopPropagation();}} onChange={function(e){updateTemplateConfig(tplName,"category",e.target.value);}} style={{padding:"6px 10px",border:"1px solid "+C.border,borderRadius:8,fontSize:12,fontFamily:font,background:C.inputBg,color:C.text,cursor:"pointer",flexShrink:0}}>
                      <option value="sin_categoria">Sin categor&iacute;a</option>
                      <option value="d0">D+0</option>
                      <option value="d1">D+1</option>
                      <option value="d3">D+3</option>
                      <option value="d5">D+5</option>
                      <option value="automatico">Auto</option>
                      <option value="campanha">Campa&ntilde;a</option>
                    </select>
                    <select value={currentRegion} onClick={function(e){e.stopPropagation();}} onChange={function(e){updateTemplateConfig(tplName,"region",e.target.value);}} style={{padding:"6px 10px",border:"1px solid "+C.border,borderRadius:8,fontSize:12,fontFamily:font,background:C.inputBg,color:C.text,cursor:"pointer",flexShrink:0}}>
                      <option value="">Sin regi&oacute;n</option>
                      <option value="br">BR</option>
                      <option value="latam">LATAM</option>
                    </select>
                    <select value={currentQual} onClick={function(e){e.stopPropagation();}} onChange={function(e){updateTemplateConfig(tplName,"qualification",e.target.value);}} style={{padding:"6px 10px",border:"1px solid "+(currentQual==="calificado"?C.green+"66":currentQual==="no_calificado"?C.orange+"66":C.border),borderRadius:8,fontSize:12,fontFamily:font,background:currentQual==="calificado"?C.lGreen:currentQual==="no_calificado"?C.lOrange:C.inputBg,color:C.text,cursor:"pointer",flexShrink:0}}>
                      <option value="general">General</option>
                      <option value="calificado">Calificado</option>
                      <option value="no_calificado">No Calificado</option>
                    </select>
                  </div>);
                })}
              </div>

              {Object.keys(abGroups).length>0 && (
                <div style={{marginTop:24}}>
                  <Sec>Tests A/B Activos</Sec>
                  <div style={{display:"flex",flexDirection:"column",gap:16}}>
                    {Object.keys(abGroups).map(function(gId){
                      var pair=abGroups[gId];
                      if(pair.length<2) return null;
                      var stA=getTplStats(pair[0]);
                      var stB=getTplStats(pair[1]);
                      var rateA=parseFloat(_cR(stA.resp||0,stA.sent||0))||0;
                      var rateB=parseFloat(_cR(stB.resp||0,stB.sent||0))||0;
                      var diff=Math.abs(rateA-rateB).toFixed(1);
                      var winner=rateA>rateB?0:(rateB>rateA?1:-1);
                      var maxRate=Math.max(rateA,rateB,1);
                      return (<div key={gId} style={{background:C.inputBg,border:"1px solid "+C.purple+"33",borderRadius:14,padding:0,overflow:"hidden"}}>
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
                                <div><div style={{fontSize:11,color:C.muted,fontWeight:600}}>Enviados</div><div style={{fontSize:18,fontWeight:800,color:C.text,fontFamily:mono}}>{_cS(st.sent||0)}</div></div>
                                <div><div style={{fontSize:11,color:C.muted,fontWeight:600}}>Respuestas</div><div style={{fontSize:18,fontWeight:800,color:C.text,fontFamily:mono}}>{st.resp||0}</div></div>
                                <div><div style={{fontSize:11,color:C.muted,fontWeight:600}}>Tasa</div><div style={{fontSize:18,fontWeight:800,color:isWinner?C.green:C.text,fontFamily:mono}}>{_cR(st.resp||0,st.sent||0)}</div></div>
                              </div>
                              <div style={{background:C.rowAlt,borderRadius:6,height:8,overflow:"hidden"}}>
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
                <button onClick={resetConfig} style={{background:C.lRed,color:C.red,border:"1px solid "+C.redBorder,borderRadius:8,padding:"10px 20px",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:font}}>Resetear config</button>
                <span style={{fontSize:12,color:C.muted,alignSelf:"center"}}>Resetear volver&aacute; al auto-detect por step_order en la pr&oacute;xima carga.</span>
              </div>
            </>)}
          </div>
        </div>);
      })()}
    </div>
    </div>
  </div>);
}
