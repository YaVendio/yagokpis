import { useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, AreaChart, Area } from "recharts";
import { parseCSV } from "./csvParser";
import { DEFAULT_MEETINGS as _RAW_MEETINGS } from "./defaultData";

var font="'Source Sans 3', sans-serif";
var mono="'JetBrains Mono', monospace";
var C={bg:"#FAFBFC",card:"#FFF",border:"#E5E7EB",text:"#111827",sub:"#374151",muted:"#6B7280",accent:"#2563EB",green:"#059669",red:"#DC2626",yellow:"#D97706",purple:"#7C3AED",cyan:"#0891B2",orange:"#EA580C",pink:"#EC4899",lBlue:"#EFF6FF",lGreen:"#ECFDF5",lRed:"#FEF2F2",lPurple:"#F5F3FF"};

// Filter default meetings to only those that received MSG1
var DEFAULT_MEETINGS=_RAW_MEETINGS.filter(function(m){return m.tr.indexOf("MSG1")>=0;});

var DEFAULT_TOPICS=[{"t": "Automatizaci\u00f3n", "e": "\u{1F916}", "n": 113, "p": 96.6}, {"t": "Ventas", "e": "\u{1F4CA}", "n": 99, "p": 84.6}, {"t": "Soporte", "e": "\u{1F527}", "n": 96, "p": 82.1}, {"t": "Configuraci\u00f3n", "e": "\u2699\uFE0F", "n": 93, "p": 79.5}, {"t": "Whatsapp", "e": "\u{1F4AC}", "n": 85, "p": 72.6}, {"t": "Precios", "e": "\u{1F4B0}", "n": 58, "p": 49.6}];

var DEFAULT_D={
  all:{resp:117,rate:"25.9%",topics:DEFAULT_TOPICS,ig:32,igR:"27.4%",mc:6,mR:"5.1%",tool:67,tR:"57.3%",eng:{alto:{v:2,p:"1.7%"},medio:{v:15,p:"12.8%"},bajo:{v:53,p:"45.3%"},minimo:{v:47,p:"40.2%"}},hours:[48,74,40,17,108,45,32,11,22,22,18,39,138,118,40,118,121,82,105,60,67,51,67,70],
    tpl:[
      {name:"MSG 1 \u2014 Yago SDR",day:"D+0",sent:452,resp:41,rate:"9.1%"},
      {name:"MSG 2a \u2014 Sin WA",day:"D+1",sent:356,resp:30,rate:"8.4%"},
      {name:"MSG 2b \u2014 Caso de \u00C9xito",day:"D+1",sent:15,resp:4,rate:"26.7%"},
      {name:"MSG 3 \u2014 Value Nudge",day:"D+3",sent:232,resp:23,rate:"9.9%"},
      {name:"MSG 4 \u2014 Quick Audit",day:"D+5",sent:109,resp:17,rate:"15.6%"},
    ],
    bcast:[{name:"Emprende Show",day:"Bcast",sent:123,resp:2,rate:"1.6%"}]},
  real:{resp:103,rate:"22.8%",topics:DEFAULT_TOPICS,ig:32,igR:"31.1%",mc:6,mR:"5.8%",tool:67,tR:"65.0%",eng:{alto:{v:2,p:"1.7%"},medio:{v:15,p:"12.8%"},bajo:{v:53,p:"45.3%"},minimo:{v:47,p:"40.2%"}},hours:[48,74,40,17,108,45,32,11,22,22,18,39,138,118,40,118,121,82,105,60,67,51,67,70],
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
var DEFAULT_MEET_BY_TPL=[{l:"MSG1",v:41,c:C.accent},{l:"MSG2a",v:30,c:C.purple},{l:"MSG3",v:23,c:C.cyan},{l:"MSG4",v:17,c:C.orange},{l:"MSG2b",v:4,c:C.purple},{l:"MSG2c",v:2,c:C.yellow}];
var DEFAULT_HEADER={totalContactados:452,leadsPerDay:57,dateRange:"04/02 \u2013 11/02",autoReplyCount:14,realesCount:103,esRate:"27.8",esResp:105,esTotal:378,ptRate:"16.2",ptResp:12,ptTotal:74};
// Note: ES/PT counts based on MSG1 template language detection

var tplCol={MSG1:"#2563EB",MSG2a:"#7C3AED",MSG2b:"#7C3AED",MSG2c:"#D97706",MSG3:"#0891B2",MSG4:"#EA580C"};
var tplNm={MSG1:"MSG 1 \u2014 Yago SDR (D+0)",MSG2a:"MSG 2a \u2014 Sin WA (D+1)",MSG2b:"MSG 2b \u2014 Caso de \u00C9xito (D+1)",MSG2c:"Emprende Show (Broadcast)",MSG3:"MSG 3 \u2014 Value Nudge (D+3)",MSG4:"MSG 4 \u2014 Quick Audit (D+5)"};

function Bd({children,color}){return <span style={{background:color+"15",color:color,padding:"4px 12px",borderRadius:6,fontSize:12,fontWeight:700}}>{children}</span>;}
function Sec({children}){return <div style={{fontSize:13,color:C.muted,textTransform:"uppercase",letterSpacing:1.5,fontWeight:700,marginBottom:14}}>{children}</div>;}
function Cd({children,style,onClick}){return <div onClick={onClick} style={{background:C.card,border:"1px solid "+C.border,borderRadius:14,padding:20,boxShadow:"0 1px 3px #0000000a",...style}}>{children}</div>;}

function ConvView({lead,onBack}){
  var eC={alto:C.green,medio:C.accent,bajo:C.yellow,minimo:C.red};
  return (<div style={{maxHeight:"78vh",overflowY:"auto"}}>
    <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:0,position:"sticky",top:0,background:C.card,padding:"12px 0",zIndex:2,borderBottom:"1px solid "+C.border}}>
      <button onClick={onBack} style={{background:"#F3F4F6",border:"none",borderRadius:8,padding:"8px 14px",fontSize:13,cursor:"pointer",fontWeight:700,color:C.muted}}>{"\u2190 Volver"}</button>
      <div style={{flex:1}}>
        <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
          <span style={{fontSize:18}}>{lead.co}</span>
          <span style={{fontSize:17,fontWeight:800,fontFamily:mono}}>{lead.p}</span>
          <Bd color={eC[lead.e]||C.muted}>{lead.e}</Bd>
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
          var tc=tplCol[m[1]]||C.accent;
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

function MeetModal({leads,onClose,mode}){
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
            <div style={{fontSize:19,fontWeight:900}}>{"\u{1F4C5} Leads con Oferta de Reuni\u00F3n"}</div>
            <div style={{fontSize:14,color:C.muted,marginTop:2}}>{filtered.length} leads {"\u00B7"} Click en un contacto para ver la conversaci\u00F3n</div>
          </div>
          <button onClick={onClose} style={{background:"#F3F4F6",border:"none",borderRadius:8,width:36,height:36,fontSize:18,cursor:"pointer",color:C.muted,fontWeight:700}}>{"\u2715"}</button>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {filtered.map(function(l,i){
            return (<div key={i} onClick={function(){setSel(i);}} style={{display:"flex",alignItems:"center",gap:14,padding:"14px 16px",background:"#F9FAFB",borderRadius:12,cursor:"pointer",border:"2px solid transparent"}}>
              <span style={{fontSize:20}}>{l.co}</span>
              <div style={{flex:1}}>
                <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                  <span style={{fontFamily:mono,fontWeight:700,fontSize:16}}>{l.p}</span>
                  <Bd color={eC[l.e]||C.muted}>{l.e}</Bd>
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

export default function Dashboard(){
  const [tab,setTab]=useState("overview");
  const [mode,setMode]=useState(0);
  const [showM,setShowM]=useState(false);
  const [csvLoading,setCsvLoading]=useState(false);
  const [csvName,setCsvName]=useState(null);

  const [meetings,setMeetings]=useState(DEFAULT_MEETINGS);
  const [topicsAll,setTopicsAll]=useState(DEFAULT_TOPICS);
  const [dataD,setDataD]=useState(DEFAULT_D);
  const [funnelAll,setFunnelAll]=useState(DEFAULT_FUNNEL_ALL);
  const [funnelReal,setFunnelReal]=useState(DEFAULT_FUNNEL_REAL);
  const [chBench,setChBench]=useState(DEFAULT_CH_BENCH);
  const [daily,setDaily]=useState(DEFAULT_DAILY);
  const [bTable,setBTable]=useState(DEFAULT_BTABLE);
  const [meetByTpl,setMeetByTpl]=useState(DEFAULT_MEET_BY_TPL);
  const [headerInfo,setHeaderInfo]=useState(DEFAULT_HEADER);

  function handleCSV(e){
    var file=e.target.files[0];
    if(!file) return;
    clearAll();
    setCsvLoading(true);
    parseCSV(file).then(function(result){
      setMeetings(result.MEETINGS);
      setTopicsAll(result.topicsAll);
      setDataD(result.D);
      setFunnelAll(result.funnelAll);
      setFunnelReal(result.funnelReal);
      setChBench(result.chBench);
      setDaily(result.daily);
      setBTable(result.bTable);
      setMeetByTpl(result.meetByTpl);
      setHeaderInfo({
        totalContactados:result.totalContactados,
        leadsPerDay:result.leadsPerDay,
        dateRange:result.dateRange,
        autoReplyCount:result.autoReplyCount,
        realesCount:result.realesCount,
        esRate:result.esRate,esResp:result.esResp,esTotal:result.esTotal,
        ptRate:result.ptRate,ptResp:result.ptResp,ptTotal:result.ptTotal,
      });
      setCsvName(file.name);
      setCsvLoading(false);
    }).catch(function(err){
      console.error("Error parsing CSV:",err);
      setCsvLoading(false);
      alert("Error al parsear CSV: "+err.message);
    });
    e.target.value="";
  }

  var EMPTY_ENG={alto:{v:0,p:"0%"},medio:{v:0,p:"0%"},bajo:{v:0,p:"0%"},minimo:{v:0,p:"0%"}};
  var EMPTY_D={
    all:{resp:0,rate:"0%",topics:[],ig:0,igR:"0%",mc:0,mR:"0%",tool:0,tR:"0%",eng:EMPTY_ENG,hours:new Array(24).fill(0),tpl:[],bcast:[]},
    real:{resp:0,rate:"0%",topics:[],ig:0,igR:"0%",mc:0,mR:"0%",tool:0,tR:"0%",eng:EMPTY_ENG,hours:new Array(24).fill(0),tpl:[],bcast:[]}
  };
  var EMPTY_HEADER={totalContactados:0,leadsPerDay:0,dateRange:"",autoReplyCount:0,realesCount:0,esRate:"0",esResp:0,esTotal:0,ptRate:"0",ptResp:0,ptTotal:0};

  function clearAll(){
    setMeetings([]);
    setTopicsAll([]);
    setDataD(EMPTY_D);
    setFunnelAll([]);
    setFunnelReal([]);
    setChBench([]);
    setDaily([]);
    setBTable([]);
    setMeetByTpl([]);
    setHeaderInfo(EMPTY_HEADER);
    setCsvName(null);
  }

  var mk=mode===0?"all":"real";var d=dataD[mk];var funnel=mode===0?funnelAll:funnelReal;
  var tc=headerInfo.totalContactados;
  var lpd=headerInfo.leadsPerDay;

  return (<div style={{background:C.bg,minHeight:"100vh",color:C.text,fontFamily:font,fontSize:15}}>
    <link href="https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@400;600;700;800;900&family=JetBrains+Mono:wght@400;700;800&display=swap" rel="stylesheet"/>
    {showM && <MeetModal leads={meetings} mode={mode} onClose={function(){setShowM(false);}}/>}

    <div style={{background:C.card,borderBottom:"1px solid "+C.border,padding:"16px 28px",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:12}}>
      <div style={{display:"flex",alignItems:"center",gap:14}}>
        <h1 style={{margin:0,fontSize:22,fontWeight:900}}><span style={{color:C.accent}}>YAGO</span> <span style={{color:C.muted,fontWeight:400}}>SDR</span></h1>
        <span style={{fontSize:13,color:C.muted,background:"#F3F4F6",padding:"4px 10px",borderRadius:6,fontWeight:600}}>{headerInfo.dateRange} {"\u00B7"} {tc} leads</span>
        {csvName && <span style={{fontSize:11,color:C.green,background:C.lGreen,padding:"3px 8px",borderRadius:5,fontWeight:600}}>CSV: {csvName}</span>}
      </div>
      <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
        <label style={{background:csvLoading?"#F3F4F6":C.accent,color:csvLoading?"#999":"#fff",border:"none",borderRadius:8,padding:"7px 14px",fontSize:13,fontWeight:700,cursor:csvLoading?"wait":"pointer",fontFamily:font,display:"inline-flex",alignItems:"center",gap:6}}>
          {csvLoading ? "Procesando..." : "\u{1F4C2} Importar CSV"}
          <input type="file" accept=".csv" onChange={handleCSV} style={{display:"none"}} disabled={csvLoading}/>
        </label>
        <button onClick={clearAll} style={{background:C.lRed,color:C.red,border:"1px solid "+C.red+"30",borderRadius:8,padding:"7px 14px",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:font}}>Limpiar datos</button>
        <div style={{display:"flex",background:"#F3F4F6",borderRadius:10,padding:3,gap:2}}>
          {["\u{1F4CA} Todas","\u2705 Reales"].map(function(l,i){var a=mode===i;return <button key={i} onClick={function(){setMode(i);}} style={{background:a?(i===0?C.accent:C.green):"transparent",color:a?"#fff":C.muted,border:"none",borderRadius:8,padding:"7px 14px",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:font}}>{l}</button>;})}
        </div>
        <div style={{display:"flex",gap:2,background:"#F3F4F6",borderRadius:10,padding:3}}>
          {[{id:"overview",l:"Resumen"},{id:"engagement",l:"Engagement"},{id:"templates",l:"Templates"},{id:"benchmarks",l:"Benchmarks"}].map(function(t){
            return <button key={t.id} onClick={function(){setTab(t.id);}} style={{background:tab===t.id?"#374151":"transparent",color:tab===t.id?"#fff":C.muted,border:"none",borderRadius:8,padding:"7px 14px",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:font}}>{t.l}</button>;
          })}
        </div>
      </div>
    </div>

    <div style={{padding:"24px 28px",maxWidth:1300,margin:"0 auto"}}>
      {mode===1 && <div style={{background:C.lGreen,border:"1px solid "+C.green+"25",borderRadius:12,padding:"12px 18px",marginBottom:20,display:"flex",gap:12,alignItems:"center"}}><span style={{fontSize:24}}>{"\u2705"}</span><div><strong style={{color:C.green}}>Filtro activo:</strong> <span style={{color:C.sub}}>{headerInfo.autoReplyCount} auto-replies excluidos. <strong>{headerInfo.realesCount} leads</strong> reales.</span></div></div>}

      {tab==="overview" && (<>
        <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:12,marginBottom:22}}>
          {[{l:"Contactados",v:String(tc),s:lpd+"/d\u00EDa"},{l:"Respuesta",v:d.rate,s:d.resp+" leads",b:45},{l:"Instagram",v:d.igR,s:d.ig+" leads"},{l:"Config. Plataf.",v:d.tR,s:d.tool+" leads"},{l:"Oferta Reuni\u00F3n",v:d.mR,s:d.mc+" leads",ck:1}].map(function(k,i){
            var diff=k.b?(parseFloat(k.v)-k.b).toFixed(1):null;
            return (<Cd key={i} onClick={k.ck?function(){setShowM(true);}:undefined} style={k.ck?{cursor:"pointer",border:"2px solid "+C.pink+"44"}:{}}>
              <div style={{fontSize:13,color:C.muted,fontWeight:600}}>{k.l}</div>
              <div style={{fontSize:32,fontWeight:800,fontFamily:mono,marginTop:6,lineHeight:1}}>{k.v}</div>
              <div style={{fontSize:13,color:C.muted,marginTop:4}}>{k.s}</div>
              {diff && <div style={{marginTop:6,fontSize:12,fontWeight:700,color:diff>0?C.green:C.red}}>{diff>0?"\u25B2":"\u25BC"} {Math.abs(diff)}pp vs WA Warm</div>}
              {k.ck && <div style={{fontSize:11,color:C.pink,fontWeight:700,marginTop:6}}>{"\u{1F4C5} Ver contactos y conversaciones \u2192"}</div>}
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
      </>)}

      {tab==="engagement" && (<>
        <div style={{background:C.lRed,border:"1px solid "+C.red+"20",borderRadius:14,padding:18,marginBottom:22,display:"flex",gap:16,alignItems:"center"}}><div style={{fontSize:36}}>{"\u{1F916}"}</div><div><div style={{fontSize:17,fontWeight:800,color:C.red}}>{headerInfo.autoReplyCount>0?((headerInfo.autoReplyCount/(d.resp+headerInfo.autoReplyCount))*100).toFixed(1):"0"}% son auto-replies de WA Business</div><div style={{fontSize:14,color:C.sub,marginTop:4}}>{headerInfo.autoReplyCount} de {d.resp+headerInfo.autoReplyCount} leads. Tasa real: <strong>{dataD.real.rate}</strong> ({headerInfo.realesCount}).</div></div></div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:22}}>
          <Cd><Sec>Calidad</Sec>{[{n:"Humano real",v:headerInfo.realesCount,p:d.resp>0?((headerInfo.realesCount/(headerInfo.realesCount+headerInfo.autoReplyCount))*100).toFixed(1)+"%":"0%",c:C.green},{n:"Auto-reply",v:headerInfo.autoReplyCount,p:d.resp>0?((headerInfo.autoReplyCount/(headerInfo.realesCount+headerInfo.autoReplyCount))*100).toFixed(1)+"%":"0%",c:C.red}].map(function(q,i){return (<div key={i} style={{display:"flex",alignItems:"center",gap:14,marginBottom:14}}><div style={{width:56,height:56,borderRadius:10,background:q.c+"12",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:mono,fontWeight:800,fontSize:17,color:q.c}}>{q.p}</div><div><div style={{fontSize:16,fontWeight:700}}>{q.n}</div><div style={{fontSize:14,color:C.muted}}>{q.v} leads</div></div></div>);})}</Cd>
          <Cd><Sec>{"Engagement ("+d.resp+" leads)"}</Sec>{[{n:"Alto",...d.eng.alto,c:C.green},{n:"Medio",...d.eng.medio,c:C.accent},{n:"Bajo",...d.eng.bajo,c:C.yellow},{n:"M\u00EDnimo",...d.eng.minimo,c:C.red}].map(function(e,i){return (<div key={i} style={{marginBottom:12}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{fontSize:15,fontWeight:700}}>{e.n}</span><span style={{fontSize:15,fontWeight:800,color:e.c,fontFamily:mono}}>{e.v} ({e.p})</span></div><div style={{height:10,background:"#F3F4F6",borderRadius:5}}><div style={{height:"100%",width:parseFloat(e.p)+"%",background:e.c,borderRadius:5,opacity:0.75}}/></div></div>);})}</Cd>
        </div>
        <Cd style={{marginBottom:22}}><Sec>{"Temas Abordados ("+d.resp+" leads)"}</Sec>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"6px 28px"}}>{d.topics.map(function(tp,i){var bW=Math.max(d.topics[0]&&d.topics[0].n>0?(tp.n/d.topics[0].n)*100:2,2);var bC=tp.p>=60?C.accent:tp.p>=30?C.cyan:tp.p>=15?C.yellow:C.red;return (<div key={i} style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}><span style={{fontSize:18,width:26,textAlign:"center"}}>{tp.e}</span><div style={{flex:1}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}><span style={{fontSize:14,fontWeight:600}}>{tp.t}</span><span style={{fontSize:14,fontWeight:800,fontFamily:mono,color:bC}}>{tp.n} <span style={{fontSize:11,color:C.muted}}>({tp.p}%)</span></span></div><div style={{height:10,background:"#F3F4F6",borderRadius:5}}><div style={{height:"100%",width:bW+"%",background:bC,borderRadius:5,opacity:0.75}}/></div></div></div>);})}</div>
        </Cd>
        <Cd><Sec>Horario de Respuestas</Sec><ResponsiveContainer width="100%" height={220}><BarChart data={d.hours.map(function(v,i){return{h:String(i).padStart(2,"0")+"h",v:v};})} margin={{left:-10,right:5}}><CartesianGrid strokeDasharray="3 3" stroke={C.border}/><XAxis dataKey="h" tick={{fontSize:11,fill:C.muted}}/><YAxis tick={{fontSize:11,fill:C.muted}}/><Tooltip contentStyle={{background:C.card,border:"1px solid "+C.border,borderRadius:8,fontSize:13}} formatter={function(v){return[v,"Resp."];}}/><Bar dataKey="v" radius={[4,4,0,0]} barSize={22}>{d.hours.map(function(v,i){return <Cell key={i} fill={v>=10?C.accent:v>=5?C.accent+"88":C.accent+"44"}/>;})}</Bar></BarChart></ResponsiveContainer></Cd>
      </>)}

      {tab==="templates" && (<>
        <Cd style={{marginBottom:18}}><Sec>Cadencia</Sec>
          <div style={{display:"flex",alignItems:"center",gap:0}}>{[{l:"MSG 1",s:"Yago SDR",d:"D+0",c:C.accent},0,{l:"MSG 2",s:"Sin WA / Caso \u00C9xito",d:"D+1",c:C.purple},0,{l:"MSG 3",s:"Value Nudge",d:"D+3",c:C.cyan},0,{l:"MSG 4",s:"Quick Audit",d:"D+5",c:C.orange}].map(function(s,i){if(!s)return <div key={i} style={{width:36,height:2,background:C.border,flexShrink:0}}/>;return(<div key={i} style={{flex:1,background:s.c+"08",border:"1px solid "+s.c+"22",borderRadius:12,padding:"12px 8px",textAlign:"center"}}><div style={{fontSize:11,color:C.muted}}>{s.d}</div><div style={{fontSize:17,fontWeight:800,color:s.c,marginTop:4}}>{s.l}</div><div style={{fontSize:12,color:C.muted}}>{s.s}</div></div>);})}</div>
        </Cd>
        <Sec>Performance por Template</Sec>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:22}}>
          {d.tpl.map(function(t,i){var rn=parseFloat(t.rate);var sc=rn>=20?C.green:rn>=12?C.yellow:C.red;
            return (<Cd key={i}><div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}><div><div style={{fontWeight:800,fontSize:16}}>{t.name}</div><span style={{fontSize:12,color:C.muted,background:"#F3F4F6",padding:"2px 8px",borderRadius:4}}>{t.day}</span></div><div style={{textAlign:"right"}}><div style={{fontSize:28,fontWeight:800,color:sc,fontFamily:mono}}>{t.rate}</div><div style={{fontSize:13,color:C.muted}}>{t.resp} de {t.sent}</div></div></div></Cd>);
          })}
        </div>
        {d.bcast&&d.bcast.length>0&&(<div style={{marginTop:10,marginBottom:22}}><div style={{fontSize:12,fontWeight:700,color:C.muted,textTransform:"uppercase",marginBottom:8,letterSpacing:1}}>Disparos Puntuais (fora do lifecycle)</div><div style={{display:"grid",gridTemplateColumns:"1fr",gap:10}}>{d.bcast.map(function(t,i){var rn=parseFloat(t.rate);var sc=rn>=20?C.green:rn>=12?C.yellow:C.red;return(<Cd key={i} style={{background:"#FEFCE8",border:"1px dashed "+C.yellow+"55"}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><div><div style={{fontWeight:800,fontSize:16}}>{t.name}</div><span style={{fontSize:12,color:C.muted,background:"#FEF9C3",padding:"2px 8px",borderRadius:4}}>Broadcast</span></div><div style={{textAlign:"right"}}><div style={{fontSize:28,fontWeight:800,color:sc,fontFamily:mono}}>{t.rate}</div><div style={{fontSize:13,color:C.muted}}>{t.resp+" de "+t.sent}</div></div></div></Cd>);})}</div></div>)}
        <Cd style={{marginBottom:18,background:C.lPurple,border:"1px solid "+C.purple+"20"}}>
          <Sec>{"\u{1F4C5} \u00BFEn qu\u00E9 template respondieron los que llegaron a reuni\u00F3n?"}</Sec>
          <div style={{fontSize:14,color:C.sub,marginBottom:14}}>De {d.mc} leads, este fue el <strong>template donde respondieron por primera vez</strong>:</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat("+Math.min(meetByTpl.length,6)+",1fr)",gap:10}}>
            {meetByTpl.map(function(m,i){return (<div key={i} style={{textAlign:"center",padding:"12px 8px",background:C.card,borderRadius:10,border:m.v?"2px solid "+m.c+"33":"1px solid "+C.border}}><div style={{fontSize:13,fontWeight:700,color:m.v?m.c:C.muted}}>{m.l}</div><div style={{fontSize:30,fontWeight:900,fontFamily:mono,color:m.v?m.c:C.muted,marginTop:4}}>{m.v}</div></div>);})}
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
    </div>
  </div>);
}
