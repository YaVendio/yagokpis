import { useState, useEffect, useRef } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, AreaChart, Area } from "recharts";
import { processCSVRows, processInboundRows, parseDatetime, TOPIC_KEYWORDS } from "./csvParser";
import { fetchThreadsFromPostHog, expandThreadMessages, fetchInboundThreadsFromPostHog, expandInboundThreadMessages, fetchLifecyclePhones } from "./posthogApi";
import { DEFAULT_MEETINGS as _RAW_MEETINGS } from "./defaultData";
import { supabase } from "./supabase";
import { useTheme } from "./context/ThemeContext";
import { Sun, Moon, RefreshCw, Search, ArrowLeft, X, ChevronRight, Calendar, Filter, BarChart3, MessageSquare, Users, Target, TrendingUp, Settings, Zap, ArrowUpRight, ArrowDownRight, Clock } from "lucide-react";
import { clsx } from "clsx";

// ── Color constants (kept for data logic compatibility) ──
var C={bg:"#FAFBFC",card:"#FFF",border:"#E5E7EB",text:"#111827",sub:"#374151",muted:"#6B7280",accent:"#2563EB",green:"#059669",red:"#DC2626",yellow:"#D97706",purple:"#7C3AED",cyan:"#0891B2",orange:"#EA580C",pink:"#EC4899",lBlue:"#EFF6FF",lGreen:"#ECFDF5",lRed:"#FEF2F2",lPurple:"#F5F3FF"};

// Filter default meetings
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

var tplCol={MSG1:"#2563EB",MSG2a:"#7C3AED",MSG2b:"#7C3AED",MSG2c:"#D97706",MSG3:"#0891B2",MSG4:"#EA580C"};
var tplNm={MSG1:"MSG 1 \u2014 Yago SDR (D+0)",MSG2a:"MSG 2a \u2014 Sin WA (D+1)",MSG2b:"MSG 2b \u2014 Caso de \u00C9xito (D+1)",MSG2c:"Emprende Show (Broadcast)",MSG3:"MSG 3 \u2014 Value Nudge (D+3)",MSG4:"MSG 4 \u2014 Quick Audit (D+5)"};

// ── UI Components ──

function Badge({children,variant="default",className}){
  var base="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-bold transition-colors";
  var variants={
    default:"bg-accent-light text-accent",
    green:"bg-green-light text-green",
    red:"bg-red-light text-red",
    yellow:"bg-yellow-light text-yellow",
    purple:"bg-purple-light text-purple",
    muted:"bg-surface-alt text-text-muted",
  };
  return <span className={clsx(base,variants[variant]||variants.default,className)}>{children}</span>;
}

function BadgeColor({children,color}){
  return <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-bold" style={{background:color+"18",color:color}}>{children}</span>;
}

function Card({children,className,onClick,highlight}){
  return (
    <div
      onClick={onClick}
      className={clsx(
        "bg-surface rounded-xl border border-border p-5 transition-all duration-200",
        onClick && "cursor-pointer hover:border-accent/40 hover:shadow-lg hover:shadow-accent/5",
        highlight === "pink" && "border-pink/30 hover:border-pink/60",
        highlight === "purple" && "border-purple/30 hover:border-purple/60",
        className
      )}
    >
      {children}
    </div>
  );
}

function SectionTitle({children}){
  return <div className="text-xs text-text-muted uppercase tracking-widest font-bold mb-3.5">{children}</div>;
}

function qualLabel(q){if(!q)return{t:"Sin calificaci\u00F3n",c:"muted"};var lo=q.toLowerCase();if(lo==="alta")return{t:"Alta",c:"green"};if(lo==="media"||lo==="m\u00E9dia")return{t:"Media",c:"default"};if(lo==="baja"||lo==="baixa")return{t:"Baja",c:"yellow"};return{t:q,c:"muted"};}

function Delta({current,previous,suffix,invert}){
  if(previous===null||previous===undefined) return null;
  var cv=typeof current==="string"?parseFloat(current):current;
  var pv=typeof previous==="string"?parseFloat(previous):previous;
  if(isNaN(cv)||isNaN(pv)) return null;
  var diff=cv-pv;
  if(Math.abs(diff)<0.05) return null;
  var positive=invert?diff<0:diff>0;
  return (
    <span className={clsx("inline-flex items-center gap-0.5 text-xs font-bold ml-1.5",positive?"text-green":"text-red")}>
      {positive ? <ArrowUpRight className="w-3 h-3"/> : <ArrowDownRight className="w-3 h-3"/>}
      {Math.abs(diff).toFixed(1)}{suffix||"pp"}
    </span>
  );
}

// ── Recharts theme hook ──
function useChartTheme(){
  var {dark}=useTheme();
  return {
    grid: dark ? "#3f3f46" : "#e4e4e7",
    tick: dark ? "#a1a1aa" : "#71717a",
    tooltip: {background: dark ? "#18181b" : "#ffffff", border: dark ? "#3f3f46" : "#e4e4e7"},
    accent: dark ? "#3b82f6" : "#2563eb",
    green: dark ? "#10b981" : "#059669",
    purple: dark ? "#8b5cf6" : "#7c3aed",
  };
}

// ── Conversation View ──
function ConvView({lead,onBack}){
  var engColors={alto:"text-green",medio:"text-accent",bajo:"text-yellow",minimo:"text-red",profunda:"text-green",media:"text-accent",corta:"text-yellow",rebote:"text-red"};
  var ql=qualLabel(lead.q);
  return (<div className="max-h-[78vh] overflow-y-auto">
    <div className="flex items-center gap-3 sticky top-0 bg-surface z-10 pb-3 mb-4 border-b border-border">
      <button onClick={onBack} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface-alt text-text-muted text-sm font-semibold hover:bg-border transition-colors">
        <ArrowLeft className="w-4 h-4"/>Volver
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-lg">{lead.co}</span>
          <span className="text-base font-extrabold font-mono">{lead.p}</span>
          <BadgeColor color={engColors[lead.e]?"":"#6B7280"}>{lead.e}</BadgeColor>
          <Badge variant={ql.c}>{ql.t}</Badge>
          {lead.au && <Badge variant="red">AUTO-REPLY</Badge>}
        </div>
        <div className="text-xs text-text-muted mt-1">
          {lead.ms} msgs humanas · {lead.w.toLocaleString()} palabras · Templates: {lead.tr.join(", ")} · 1a resp: <strong className="text-text">{lead.fr||"N/A"}</strong>
        </div>
      </div>
    </div>
    <div className="flex flex-col gap-1.5 pt-2">
      {lead.c.map(function(m,i){
        var dt=m[2]||"";
        if(m[0]===0){
          var tc=tplCol[m[1]]||(m[1]&&m[1].startsWith("pt_")?"#059669":m[1]&&m[1].startsWith("es_")?"#2563EB":"#2563EB");
          var tn=tplNm[m[1]]||m[1];
          return (<div key={i} className="self-center my-2 max-w-[88%] text-center rounded-xl px-5 py-2.5" style={{background:tc+"0C",border:"2px dashed "+tc+"55"}}>
            <div className="text-[11px] font-extrabold uppercase tracking-wider" style={{color:tc}}>TEMPLATE ENVIADO</div>
            <div className="text-sm font-bold mt-1" style={{color:tc}}>{tn}</div>
            {dt && <div className="text-[11px] text-text-muted mt-1">{dt}</div>}
          </div>);
        }
        if(m[0]===1) return (<div key={i} className="self-end rounded-2xl rounded-br-sm px-3.5 py-2.5 text-sm max-w-[72%] leading-relaxed whitespace-pre-wrap" style={{background:"#DCF8C6",color:"#111"}}>
          {m[1]}{dt && <div className="text-[10px] text-text-muted mt-1 text-right">{dt}</div>}
        </div>);
        if(m[0]===2){
          var txt=m[1];
          if(!txt||txt.trim()==="") return null;
          return (<div key={i} className="self-start rounded-2xl rounded-bl-sm px-3.5 py-2.5 text-sm max-w-[72%] leading-relaxed whitespace-pre-wrap bg-accent-light" style={{color:"var(--color-text)"}}>
            <div className="text-[10px] font-bold text-accent mb-1">YAGO</div>
            {txt}{dt && <div className="text-[10px] text-text-muted mt-1">{dt}</div>}
          </div>);
        }
        return null;
      })}
      {lead.c.length>=80 && <div className="text-center text-sm text-text-muted py-4 bg-surface-alt rounded-lg my-2">Conversaci&oacute;n truncada (primeros 80 mensajes)</div>}
    </div>
  </div>);
}

// ── Leads Modal ──
function MeetModal({leads,onClose,mode,title}){
  const [sel,setSel]=useState(null);
  var filtered=mode===1?leads.filter(function(l){return !l.au;}):leads;

  return (<div className="fixed inset-0 z-[999] flex items-center justify-center p-5" onClick={onClose}>
    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm"/>
    <div className="relative bg-surface rounded-2xl p-6 max-w-[880px] w-full max-h-[92vh] shadow-2xl border border-border" onClick={function(e){e.stopPropagation();}}>
      {sel!==null ? (
        <ConvView lead={filtered[sel]} onBack={function(){setSel(null);}} />
      ) : (<div className="max-h-[82vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-5">
          <div>
            <h3 className="text-lg font-black text-text">{title||"Leads con Oferta de Reuni\u00F3n"}</h3>
            <p className="text-sm text-text-muted mt-1">{filtered.length} leads · Click en un contacto para ver la conversaci&oacute;n</p>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-lg bg-surface-alt text-text-muted hover:bg-border flex items-center justify-center transition-colors">
            <X className="w-4 h-4"/>
          </button>
        </div>
        <div className="flex flex-col gap-2">
          {filtered.map(function(l,i){
            var ql=qualLabel(l.q);
            return (<div key={i} onClick={function(){setSel(i);}} className="flex items-center gap-3.5 p-3.5 bg-surface-alt rounded-xl cursor-pointer border-2 border-transparent hover:border-accent/30 transition-all">
              <span className="text-xl">{l.co}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono font-bold text-base">{l.p}</span>
                  <BadgeColor color={C[{alto:"green",medio:"accent",bajo:"yellow",minimo:"red",profunda:"green",media:"accent",corta:"yellow",rebote:"red"}[l.e]]||C.muted}>{l.e}</BadgeColor>
                  <Badge variant={ql.c}>{ql.t}</Badge>
                  {l.au && <Badge variant="red">AUTO</Badge>}
                </div>
                <div className="text-xs text-text-muted mt-1">
                  {l.ms} msgs · {l.w.toLocaleString()} pal. · Tpls: <strong>{l.tr.join(", ")}</strong> · 1a resp: <strong className="text-text">{l.fr||"N/A"}</strong>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-accent"/>
            </div>);
          })}
        </div>
        <div className="mt-4 grid grid-cols-4 gap-2">
          {(filtered.length>0&&filtered[0].e&&["profunda","media","corta","rebote"].indexOf(filtered[0].e)>=0?[{l:"Profunda",c:C.green,v:filtered.filter(function(x){return x.e==="profunda";}).length},{l:"Media",c:C.accent,v:filtered.filter(function(x){return x.e==="media";}).length},{l:"Corta",c:C.yellow,v:filtered.filter(function(x){return x.e==="corta";}).length},{l:"Rebote",c:C.red,v:filtered.filter(function(x){return x.e==="rebote";}).length}]:[{l:"Alto",c:C.green,v:filtered.filter(function(x){return x.e==="alto";}).length},{l:"Medio",c:C.accent,v:filtered.filter(function(x){return x.e==="medio";}).length},{l:"Bajo",c:C.yellow,v:filtered.filter(function(x){return x.e==="bajo";}).length},{l:"M\u00EDnimo",c:C.red,v:filtered.filter(function(x){return x.e==="minimo";}).length}]).map(function(s,i){
            return (<div key={i} className="rounded-lg p-2 text-center" style={{background:s.c+"0C",border:"1px solid "+s.c+"22"}}>
              <div className="text-[10px] text-text-muted font-semibold">{s.l}</div>
              <div className="text-xl font-extrabold font-mono" style={{color:s.c}}>{s.v}</div>
            </div>);
          })}
        </div>
      </div>)}
    </div>
  </div>);
}

// ── Template Modal ──
function TplModal({tpl,leads,mode,onClose}){
  const [sel,setSel]=useState(null);
  var filtered=leads.filter(function(l){
    if(mode===1&&l.au) return false;
    return l.fr===tpl.key;
  });
  var cleanContent=tpl.content;
  if(cleanContent){
    cleanContent=cleanContent.replace(/\[Este mensaje fue enviado autom\u00e1ticamente[^\]]*\]/gi,"").replace(/\[Esta mensagem foi enviada automaticamente[^\]]*\]/gi,"").trim();
  }
  var rn=parseFloat(tpl.rate);var sc=rn>=20?C.green:rn>=12?C.yellow:C.red;

  return (<div className="fixed inset-0 z-[999] flex items-center justify-center p-5" onClick={onClose}>
    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm"/>
    <div className="relative bg-surface rounded-2xl p-6 max-w-[880px] w-full max-h-[92vh] shadow-2xl border border-border" onClick={function(e){e.stopPropagation();}}>
      {sel!==null ? (
        <ConvView lead={filtered[sel]} onBack={function(){setSel(null);}} />
      ) : (<div className="max-h-[82vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-5">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="text-lg font-black">{tpl.name}</span>
              <span className="text-xs text-text-muted bg-surface-alt px-2 py-0.5 rounded">{tpl.day}</span>
              <BadgeColor color={sc}>{tpl.rate}</BadgeColor>
            </div>
            <p className="text-sm text-text-muted mt-1">{filtered.length} leads respondieron a este template</p>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-lg bg-surface-alt text-text-muted hover:bg-border flex items-center justify-center transition-colors">
            <X className="w-4 h-4"/>
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2.5 mb-5">
          {[{l:"Enviados",v:tpl.sent,c:C.accent},{l:"Respondieron",v:tpl.resp,c:C.purple},{l:"Tasa",v:tpl.rate,c:sc}].map(function(s,i){return (<div key={i} className="rounded-xl p-3 text-center" style={{background:s.c+"0C",border:"1px solid "+s.c+"1A"}}>
            <div className="text-[11px] text-text-muted font-semibold">{s.l}</div>
            <div className="text-2xl font-extrabold font-mono mt-0.5" style={{color:s.c}}>{s.v}</div>
          </div>);})}
        </div>
        {cleanContent && <div className="mb-5">
          <div className="text-xs font-bold text-text-muted uppercase tracking-wider mb-2">Contenido del template</div>
          <div className="bg-surface-alt border border-border rounded-xl p-3.5 text-sm text-text-sub leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto">{cleanContent}</div>
        </div>}
        {filtered.length>0 && <div>
          <div className="text-xs font-bold text-text-muted uppercase tracking-wider mb-2">Leads que respondieron ({filtered.length})</div>
          <div className="flex flex-col gap-2">
            {filtered.map(function(l,i){
              var ql=qualLabel(l.q);
              return (<div key={i} onClick={function(){setSel(i);}} className="flex items-center gap-3.5 p-3.5 bg-surface-alt rounded-xl cursor-pointer border-2 border-transparent hover:border-accent/30 transition-all">
                <span className="text-xl">{l.co}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-bold text-base">{l.p}</span>
                    <BadgeColor color={C[{alto:"green",medio:"accent",bajo:"yellow",minimo:"red",profunda:"green",media:"accent",corta:"yellow",rebote:"red"}[l.e]]||C.muted}>{l.e}</BadgeColor>
                    <Badge variant={ql.c}>{ql.t}</Badge>
                    {l.au && <Badge variant="red">AUTO</Badge>}
                  </div>
                  <div className="text-xs text-text-muted mt-1">
                    {l.ms} msgs · {l.w.toLocaleString()} pal. · Tpls: <strong>{l.tr.join(", ")}</strong>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-accent"/>
              </div>);
            })}
          </div>
        </div>}
        {filtered.length===0 && <div className="text-center py-8 text-text-muted text-sm">{"Ning\u00FAn lead respondi\u00F3 a este template"}{mode===1?" (filtro reales activo)":""}.</div>}
      </div>)}
    </div>
  </div>);
}

var EMPTY_ENG={alto:{v:0,p:"0%"},medio:{v:0,p:"0%"},bajo:{v:0,p:"0%"},minimo:{v:0,p:"0%"}};
var EMPTY_D={
  all:{resp:0,rate:"0%",topics:[],ig:0,igR:"0%",igLink:0,igLinkR:"0%",igAt:0,igAtR:"0%",mc:0,mR:"0%",tool:0,tR:"0%",eng:EMPTY_ENG,hours:new Array(24).fill(0),tpl:[],bcast:[],tplByStep:null},
  real:{resp:0,rate:"0%",topics:[],ig:0,igR:"0%",igLink:0,igLinkR:"0%",igAt:0,igAtR:"0%",mc:0,mR:"0%",tool:0,tR:"0%",eng:EMPTY_ENG,hours:new Array(24).fill(0),tpl:[],bcast:[],tplByStep:null}
};
var EMPTY_HEADER={totalContactados:0,leadsPerDay:0,dateRange:"",autoReplyCount:0,realesCount:0,esRate:"0",esResp:0,esTotal:0,ptRate:"0",ptResp:0,ptTotal:0};

// ══════════════════════════════════════════════════════
// ══ MAIN DASHBOARD ══
// ══════════════════════════════════════════════════════

export default function Dashboard(){
  var {dark,toggle}=useTheme();
  var chart=useChartTheme();

  const [isAuthenticated,setIsAuthenticated]=useState(function(){return !!sessionStorage.getItem("dashboard_password");});
  const [loginPassword,setLoginPassword]=useState("");
  const [loginError,setLoginError]=useState("");
  const [loginLoading,setLoginLoading]=useState(false);

  useEffect(function(){
    function onAuthRequired(){sessionStorage.removeItem("dashboard_password");setIsAuthenticated(false);setLoginError("Sesi\u00F3n expirada. Ingrese de nuevo.");}
    window.addEventListener("auth-required",onAuthRequired);
    return function(){window.removeEventListener("auth-required",onAuthRequired);};
  },[]);

  async function handleLogin(e){
    e.preventDefault();
    setLoginLoading(true);setLoginError("");
    sessionStorage.setItem("dashboard_password",loginPassword);
    try{
      var resp=await fetch("/api/metabase",{method:"POST",headers:{"Content-Type":"application/json","x-dashboard-password":loginPassword},body:JSON.stringify({sql:"SELECT 1"})});
      if(resp.status===401){sessionStorage.removeItem("dashboard_password");setLoginError("Contrase\u00F1a incorrecta");setLoginLoading(false);return;}
      setIsAuthenticated(true);
    }catch(err){sessionStorage.removeItem("dashboard_password");setLoginError("Error de conexi\u00F3n");
    }finally{setLoginLoading(false);}
  }

  // ── Login Screen ──
  if(!isAuthenticated) return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-black tracking-tight">
            <span className="text-accent">YAGO</span>{" "}
            <span className="text-text-muted font-normal">SDR</span>
          </h1>
          <p className="text-sm text-text-muted mt-2">Analytics Dashboard</p>
        </div>
        <form onSubmit={handleLogin} className="bg-surface border border-border rounded-2xl p-8 shadow-xl">
          <label className="block text-sm font-semibold text-text-sub mb-2">Contrase&ntilde;a</label>
          <input
            type="password"
            value={loginPassword}
            onChange={function(ev){setLoginPassword(ev.target.value);}}
            placeholder="Ingrese la contrase&ntilde;a"
            className="w-full px-4 py-3 text-sm bg-surface-alt border border-border rounded-xl text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all font-mono"
          />
          {loginError && <p className="text-red text-sm font-semibold mt-3">{loginError}</p>}
          <button
            type="submit"
            disabled={loginLoading||!loginPassword}
            className="w-full mt-4 py-3 text-sm font-bold text-white bg-accent rounded-xl hover:opacity-90 disabled:opacity-40 transition-all cursor-pointer disabled:cursor-not-allowed"
          >
            {loginLoading?"Verificando...":"Entrar"}
          </button>
        </form>
        <button onClick={toggle} className="mx-auto mt-6 flex items-center gap-2 text-xs text-text-muted hover:text-text transition-colors cursor-pointer">
          {dark?<Sun className="w-3.5 h-3.5"/>:<Moon className="w-3.5 h-3.5"/>}
          {dark?"Modo claro":"Modo oscuro"}
        </button>
      </div>
    </div>
  );

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

  // ── All data logic (unchanged) ──

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

  const templateConfigRef=useRef(templateConfig);
  useEffect(function(){
    if(templateConfigRef.current===templateConfig) return;
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

  // ── Loading State ──
  if(dbLoading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-4"/>
        <p className="text-sm text-text-muted font-semibold">Cargando datos de PostHog...</p>
      </div>
    </div>
  );

  // ── Error State ──
  if(loadError) return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="w-12 h-12 rounded-full bg-red-light flex items-center justify-center mx-auto mb-4">
          <X className="w-6 h-6 text-red"/>
        </div>
        <h2 className="text-base font-bold text-red mb-2">Error al cargar datos</h2>
        <p className="text-sm text-text-muted leading-relaxed mb-4">{loadError}</p>
        <button onClick={function(){setLoadError(null);setDbLoading(true);fetchThreadsFromPostHog(stepFilter).then(function(threads){var csvRows=expandThreadMessages(threads);setRawRows(csvRows);var result=processCSVRows(csvRows,templateConfig,regionFilter);applyResult(result);setDbLoading(false);}).catch(function(e){setLoadError(e.message||"Error");setDbLoading(false);});}} className="px-5 py-2.5 bg-accent text-white text-sm font-bold rounded-xl hover:opacity-90 transition-all cursor-pointer">
          Reintentar
        </button>
      </div>
    </div>
  );

  // ── Tab definitions ──
  var tabs=[
    {id:"overview",l:"Resumen",icon:BarChart3},
    {id:"engagement",l:"Engagement",icon:Zap},
    {id:"templates",l:"Templates",icon:MessageSquare,ib:true},
    {id:"benchmarks",l:"Benchmarks",icon:TrendingUp,ib:true},
    {id:"lookup",l:"Buscar",icon:Search},
    {id:"config",l:"Config",icon:Settings,ib:true},
  ];

  // ── Tooltip styling ──
  var tooltipStyle={background:chart.tooltip.background,border:"1px solid "+chart.tooltip.border,borderRadius:10,fontSize:13,color:"var(--color-text)"};

  return (<div className="min-h-screen bg-background text-text">
    {/* Modals */}
    {showM && <MeetModal leads={meetings.filter(function(l){return l.ml;})} mode={mode} onClose={function(){setShowM(false);}} title={"Leads con Oferta de Reuni\u00F3n"}/>}
    {showA && <MeetModal leads={meetings} mode={mode} onClose={function(){setShowA(false);}} title={"Todas las Conversaciones"}/>}
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

    {/* ── Header ── */}
    <header className="sticky top-0 z-50 glass border-b border-border">
      <div className="max-w-[1400px] mx-auto px-6 py-3 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-black tracking-tight">
            <span className="text-accent">YAGO</span>{" "}
            <span className="text-text-muted font-normal">SDR</span>
          </h1>
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-text-muted bg-surface-alt px-3 py-1.5 rounded-lg font-medium">
            <Calendar className="w-3.5 h-3.5"/>
            {headerInfo.dateRange} · {tc} leads
          </div>
        </div>
        <nav className="flex items-center gap-1 bg-surface-alt rounded-lg p-1">
          {tabs.map(function(t){
            var disabled=t.ib&&panel==="inbound";
            var Icon=t.icon;
            return <button key={t.id} onClick={disabled?undefined:function(){setTab(t.id);}} className={clsx(
              "flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all",
              disabled && "opacity-30 cursor-not-allowed",
              !disabled && tab===t.id && "bg-accent text-white shadow-md shadow-accent/20",
              !disabled && tab!==t.id && "text-text-muted hover:text-text hover:bg-surface cursor-pointer"
            )}>
              <Icon className="w-3.5 h-3.5"/>{t.l}
            </button>;
          })}
        </nav>
        <button onClick={toggle} className="p-2 rounded-lg bg-surface-alt text-text-muted hover:text-text hover:bg-border transition-colors cursor-pointer" title={dark?"Modo claro":"Modo oscuro"}>
          {dark?<Sun className="w-4 h-4"/>:<Moon className="w-4 h-4"/>}
        </button>
      </div>
    </header>

    {/* ── Filters Bar ── */}
    <div className="border-b border-border bg-surface/50">
      <div className="max-w-[1400px] mx-auto px-6 py-2.5 flex items-center gap-3 flex-wrap">
        {/* Panel toggle */}
        <div className="flex bg-surface-alt rounded-lg p-0.5 gap-0.5">
          {[{id:"outbound",l:"Outbound"},{id:"inbound",l:"Inbound"}].map(function(p){
            var a=panel===p.id;
            return <button key={p.id} onClick={function(){switchPanel(p.id);}} className={clsx(
              "px-3 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer",
              a && p.id==="outbound" && "bg-accent text-white",
              a && p.id==="inbound" && "bg-purple text-white",
              !a && "text-text-muted hover:text-text"
            )}>{p.l}</button>;
          })}
        </div>

        {/* Mode toggle (outbound only) */}
        {panel==="outbound" && <div className="flex bg-surface-alt rounded-lg p-0.5 gap-0.5">
          {[{l:"Todas",i:0},{l:"Reales",i:1}].map(function(o){
            var a=mode===o.i;
            return <button key={o.i} onClick={function(){setMode(o.i);}} className={clsx(
              "px-3 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer",
              a && o.i===0 && "bg-accent text-white",
              a && o.i===1 && "bg-green text-white",
              !a && "text-text-muted hover:text-text"
            )}>{o.l}</button>;
          })}
        </div>}

        <div className="w-px h-6 bg-border"/>

        {/* Step filter (outbound) */}
        {panel==="outbound" && <select value={stepFilter||""} onChange={function(ev){var v=ev.target.value;setStepFilter(v||null);setDateFrom("");setDateTo("");}} className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-border bg-surface text-text cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent/30">
          <option value="">Todos los steps</option>
          <option value="1">Step 1 (D+0)</option>
          <option value="2">Step 2 (D+1)</option>
          <option value="3">Step 3 (D+3)</option>
          <option value="4">Step 4 (D+5)</option>
        </select>}

        {/* Region filter */}
        <select value={regionFilter} onChange={onRegionChange} className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-border bg-surface text-text cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent/30">
          <option value="all">LATAM + BR</option>
          <option value="es">LATAM (ES)</option>
          <option value="pt">Brasil (PT)</option>
        </select>

        {/* Date filters */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-text-muted">De</span>
          <input type="date" value={dateFrom} onChange={onDateFromChange} className="px-2.5 py-1.5 border border-border rounded-lg text-xs font-mono text-text bg-surface focus:outline-none focus:ring-2 focus:ring-accent/30"/>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-text-muted">Hasta</span>
          <input type="date" value={dateTo} onChange={onDateToChange} className="px-2.5 py-1.5 border border-border rounded-lg text-xs font-mono text-text bg-surface focus:outline-none focus:ring-2 focus:ring-accent/30"/>
        </div>
        {(dateFrom||dateTo) && <>
          <button onClick={clearDateFilter} className="px-3 py-1.5 text-xs font-bold text-red bg-red-light border border-red/20 rounded-lg hover:bg-red/20 transition-colors cursor-pointer">Limpiar</button>
          <span className="text-xs font-bold text-accent bg-accent-light px-2.5 py-1 rounded-md">{tc} leads en per&iacute;odo</span>
        </>}
      </div>
    </div>

    {/* ── Main Content ── */}
    <main className="max-w-[1400px] mx-auto px-6 py-6">
      {inboundLoading && <div className="bg-purple-light border border-purple/20 rounded-xl p-4 mb-5 flex items-center gap-3">
        <div className="w-5 h-5 border-2 border-purple border-t-transparent rounded-full animate-spin"/>
        <span className="text-sm font-bold text-purple">Cargando datos inbound...</span>
      </div>}

      {/* ════ OVERVIEW TAB ════ */}
      {tab==="overview" && (function(){var cd=null;var isInb=panel==="inbound";var ix=inboundExtra; return (<>
        {isInb && ix ? (<>
          {/* Inbound: 3 KPI cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card onClick={function(){setShowA(true);}} highlight="purple">
              <div className="text-xs text-text-muted font-semibold">Leads Inbound</div>
              <div className="text-4xl font-black font-mono mt-2 leading-none">{ix.uniqueLeadCount}</div>
              <div className="text-sm text-text-muted mt-2">{lpd}/d&iacute;a · {tc} conversaciones</div>
              <div className="text-xs text-purple font-bold mt-3 flex items-center gap-1"><MessageSquare className="w-3 h-3"/>Ver conversaciones</div>
            </Card>
            <Card>
              <div className="text-xs text-text-muted font-semibold">Engagement</div>
              <div className="text-4xl font-black font-mono text-accent mt-2 leading-none">{d.resp>0?((ix.engagedTotal/d.resp)*100).toFixed(1):"0"}%</div>
              <div className="text-sm text-text-muted mt-2">{ix.engagedTotal} con 2+ msgs</div>
              <div className="text-xs font-semibold mt-3 pt-3 border-t border-border"><span className="text-red">{ix.depthCounts.rebote} rebotes</span> · <span className="text-accent">{ix.avgDepth} msgs/conv</span></div>
            </Card>
            <Card>
              <div className="text-xs text-text-muted font-semibold">Conversi&oacute;n Signup</div>
              <div className="text-4xl font-black font-mono text-green mt-2 leading-none">{ix.signupLinkCount}</div>
              <div className="text-sm text-text-muted mt-2">recibieron link crear cuenta</div>
              <div className="text-xs text-green font-semibold mt-3 pt-3 border-t border-border">{ix.signupCount} recibieron Step 1 ({ix.uniqueLeadCount>0?((ix.signupCount/ix.uniqueLeadCount)*100).toFixed(1):"0"}%)</div>
            </Card>
          </div>

          {/* Inbound: Funnel + Topics */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            <Card><SectionTitle>{"Embudo de Conversi\u00F3n"}</SectionTitle>
              {funnel.map(function(f,i){var base=funnel[0].v||1;var w=Math.max((f.v/base)*100,3);var prev=i>0?((f.v/(funnel[i-1].v||1))*100).toFixed(0):null;
                return (<div key={i} className="mb-2.5"><div className="flex justify-between mb-1"><span className="text-sm text-text-sub">{f.n}</span><div className="flex items-center gap-1.5"><span className="text-base font-extrabold font-mono">{f.v}</span><span className="text-xs text-text-muted">{(f.v/base*100).toFixed(1)}%</span>{prev && <span className={clsx("text-xs font-bold",parseFloat(prev)>=50?"text-green":parseFloat(prev)>=20?"text-yellow":"text-red")}>({prev}%)</span>}</div></div><div className="h-5 bg-surface-alt rounded-md overflow-hidden"><div className="h-full rounded-md transition-all duration-500" style={{width:w+"%",background:f.c,opacity:0.8}}/></div></div>);})}
            </Card>
            <Card><SectionTitle>{"¿Qu\u00E9 buscan?"}</SectionTitle>
              {d.topics.map(function(tp,i){
                var topicColors=["#3B82F6","#8B5CF6","#06B6D4","#F59E0B","#10B981","#EF4444"];
                var bC=topicColors[i%topicColors.length];
                return (
                  <div key={i} onClick={function(){setTopicModal(tp.t);}} className="flex items-center gap-2.5 py-2.5 border-b border-border/40 last:border-0 cursor-pointer hover:bg-surface-alt/50 -mx-2 px-2 rounded-lg transition-colors">
                    <span className="text-xl">{tp.e}</span>
                    <div className="flex-1">
                      <div className="flex justify-between mb-1"><span className="text-sm font-bold">{tp.t}</span><span className="text-sm font-extrabold font-mono" style={{color:bC}}>{tp.n} <span className="text-xs font-semibold text-text-muted">({tp.p}%)</span></span></div>
                      <div className="h-1.5 bg-surface-alt rounded-full overflow-hidden"><div className="h-full rounded-full" style={{width:tp.p+"%",background:bC,opacity:0.7}}/></div>
                    </div>
                  </div>
                );
              })}
            </Card>
          </div>
        </>) : (<>
          {/* Outbound: KPI cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
            {[{l:"Contactados",v:String(tc),s:lpd+"/d\u00EDa",cv:cd?String(cd.resp!==undefined?cd.totalContactados:""):null},{l:"Respuesta",v:d.rate,s:d.resp+" leads",b:45,ck:2,cv:cd?cd.rate:null},{l:"Instagram",v:d.igLinkR,s:d.igLink+" leads con link",ig2:d.igAt,cv:cd?cd.igLinkR:null},{l:"Config. Plataf.",v:d.tR,s:d.tool+" leads",cv:cd?cd.tR:null},{l:"Oferta Reuni\u00F3n",v:d.mR,s:d.mc+" leads",ck:1,cv:cd?cd.mR:null}].map(function(k,i){
              var diff=k.b?(parseFloat(k.v)-k.b).toFixed(1):null;
              return (<Card key={i} onClick={k.ck===1?function(){setShowM(true);}:k.ck===2?function(){setShowA(true);}:undefined} highlight={k.ck===1?"pink":k.ck===2?"purple":undefined}>
                <div className="text-xs text-text-muted font-semibold">{k.l}</div>
                <div className="text-3xl font-extrabold font-mono mt-2 leading-none">{k.v}<Delta current={k.v} previous={k.cv}/></div>
                <div className="text-xs text-text-muted mt-2">{k.s}</div>
                {diff && <div className={clsx("mt-2 text-xs font-bold flex items-center gap-1",diff>0?"text-green":"text-red")}>{diff>0?<ArrowUpRight className="w-3 h-3"/>:<ArrowDownRight className="w-3 h-3"/>}{Math.abs(diff)}pp vs WA Warm</div>}
                {k.cv && <div className="mt-1 text-[11px] text-purple font-semibold">Anterior: {k.cv}</div>}
                {k.ig2!==undefined && <div className="mt-2 text-xs text-orange font-semibold pt-2 border-t border-border">{"Solo @: "+k.ig2+" leads"}</div>}
                {k.ck===1 && <div className="text-[11px] text-pink font-bold mt-2 flex items-center gap-1"><Target className="w-3 h-3"/>Ver contactos</div>}
                {k.ck===2 && <div className="text-[11px] text-purple font-bold mt-2 flex items-center gap-1"><MessageSquare className="w-3 h-3"/>Ver conversaciones</div>}
              </Card>);
            })}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            <Card><SectionTitle>{"Embudo de Conversi\u00F3n"}</SectionTitle>
              {funnel.map(function(f,i){var w=Math.max((f.v/(tc||1))*100,4);var prev=i>0?((f.v/(funnel[i-1].v||1))*100).toFixed(0):null;
                return (<div key={i} className="mb-2.5"><div className="flex justify-between mb-1"><span className="text-sm text-text-sub">{f.n}</span><div className="flex items-center gap-1.5"><span className="text-base font-extrabold font-mono">{f.v}</span><span className="text-xs text-text-muted">{(f.v/(tc||1)*100).toFixed(1)}%</span>{prev && <span className="text-xs font-bold text-red">({prev}%)</span>}</div></div><div className="h-5 bg-surface-alt rounded-md overflow-hidden"><div className="h-full rounded-md transition-all duration-500" style={{width:w+"%",background:f.c,opacity:0.8}}/></div></div>);})}
            </Card>
            <Card><SectionTitle>Yago vs Mercado</SectionTitle>
              {chBench.map(function(b,i){return (<div key={i} className="mb-2"><div className="flex justify-between mb-1"><span className={clsx("text-sm",b.y?"font-bold text-text":"text-text-muted")}>{b.ch}</span><span className={clsx("text-sm font-extrabold font-mono",b.y?"text-accent":"text-text-muted")}>{b.r}%</span></div><div className="h-2 bg-surface-alt rounded-full"><div className={clsx("h-full rounded-full",b.y?"opacity-80":"opacity-30")} style={{width:(b.r/45)*100+"%",background:b.y?"var(--color-accent)":"var(--color-text-muted)"}}/></div></div>);})}
            </Card>
          </div>
        </>)}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card><SectionTitle>ES vs BR</SectionTitle>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-accent-light rounded-xl p-4 text-center">
                <div className="text-xs text-accent font-bold">ES</div>
                <div className="text-3xl font-black text-accent font-mono mt-1">{headerInfo.esRate}%</div>
                <div className="text-xs text-text-muted mt-1">{headerInfo.esResp} de {headerInfo.esTotal}</div>
              </div>
              <div className="bg-green-light rounded-xl p-4 text-center">
                <div className="text-xs text-green font-bold">PT</div>
                <div className="text-3xl font-black text-green font-mono mt-1">{headerInfo.ptRate}%</div>
                <div className="text-xs text-text-muted mt-1">{headerInfo.ptResp} de {headerInfo.ptTotal}</div>
              </div>
            </div>
          </Card>
          <Card><SectionTitle>{"Leads por D\u00EDa"}</SectionTitle>
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={daily} margin={{left:-15,right:5,top:5,bottom:0}}>
                <defs><linearGradient id="ag" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={chart.accent} stopOpacity={0.2}/><stop offset="100%" stopColor={chart.accent} stopOpacity={0}/></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke={chart.grid}/>
                <XAxis dataKey="d" tick={{fontSize:12,fill:chart.tick}}/>
                <YAxis tick={{fontSize:12,fill:chart.tick}}/>
                <Tooltip contentStyle={tooltipStyle}/>
                <Area type="monotone" dataKey="l" stroke={chart.accent} fill="url(#ag)" strokeWidth={2}/>
              </AreaChart>
            </ResponsiveContainer>
          </Card>
        </div>
      </>);})()}

      {/* ════ ENGAGEMENT TAB ════ */}
      {tab==="engagement" && (function(){
        var isInb=panel==="inbound";var ix=inboundExtra;
        var totalResp=headerInfo.realesCount+headerInfo.autoReplyCount;
        var autoP=totalResp>0?((headerInfo.autoReplyCount/totalResp)*100).toFixed(1):"0";
        var realP=totalResp>0?((headerInfo.realesCount/totalResp)*100).toFixed(1):"0";
        var peakH=0;var peakV=0;for(var hi=0;hi<d.hours.length;hi++){if(d.hours[hi]>peakV){peakV=d.hours[hi];peakH=hi;}}
        var topicColors=["#3B82F6","#8B5CF6","#06B6D4","#F59E0B","#10B981","#EF4444"];

        if(isInb&&ix){
          var depthItems=[
            {k:"rebote",n:"Rebote: 1 msg",c:C.red,ic:"rebote"},
            {k:"corta",n:"Corta: 2-4",c:C.yellow,ic:"corta"},
            {k:"media",n:"Media: 5-9",c:C.accent,ic:"media"},
            {k:"profunda",n:"Profunda: 10+",c:C.green,ic:"profunda"}
          ];
          var convSteps=[
            {n:"Leads Inbound",v:ix.uniqueLeadCount,c:C.accent},
            {n:"Engajaron (2+ msgs)",v:ix.engagedTotal,c:C.purple},
            {n:"Recibieron Link Cuenta",v:ix.signupLinkCount,c:C.cyan},
            {n:"Recibieron Step 1",v:ix.signupCount,c:C.green}
          ];
          return (<>
            <Card className="mb-6">
              <SectionTitle>{"Jornada de Conversi\u00F3n Inbound"}</SectionTitle>
              <p className="text-sm text-text-muted mb-4">De lead inbound a signup — tasa de conversi&oacute;n entre cada paso</p>
              {convSteps.map(function(st,i){
                var w=ix.uniqueLeadCount>0?Math.max((st.v/ix.uniqueLeadCount)*100,3):0;
                var prevV=i>0?convSteps[i-1].v:null;
                var stepRate=prevV&&prevV>0?((st.v/prevV)*100).toFixed(1):null;
                var absRate=ix.uniqueLeadCount>0?((st.v/ix.uniqueLeadCount)*100).toFixed(1):"0";
                return (<div key={i} className={clsx(i<convSteps.length-1&&"mb-3.5")}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-semibold text-text-sub">{st.n}</span>
                    <div className="flex items-baseline gap-2">
                      <span className="text-xl font-black font-mono" style={{color:st.c}}>{st.v}</span>
                      <span className="text-xs text-text-muted">({absRate}%)</span>
                      {stepRate && <span className={clsx("text-xs font-bold px-2 py-0.5 rounded",parseFloat(stepRate)>=50?"text-green bg-green-light":parseFloat(stepRate)>=20?"text-yellow bg-yellow-light":"text-red bg-red-light")}>{stepRate}% del paso anterior</span>}
                    </div>
                  </div>
                  <div className="h-4 bg-surface-alt rounded-md overflow-hidden"><div className="h-full rounded-md transition-all duration-500" style={{width:w+"%",background:st.c,opacity:0.8}}/></div>
                </div>);
              })}
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4 mb-6">
              <Card>
                <SectionTitle>{"Profundidad de Conversaci\u00F3n"}</SectionTitle>
                <div className="grid grid-cols-4 gap-3 mb-3.5">
                  {depthItems.map(function(e,i){var eng=d.eng[e.k]||{v:0,p:"0%"};return (
                    <div key={i} className="rounded-xl p-3 text-center" style={{background:e.c+"0C",border:"1px solid "+e.c+"22"}}>
                      <div className="text-[11px] font-bold" style={{color:e.c}}>{e.n}</div>
                      <div className="text-2xl font-black font-mono my-1" style={{color:e.c}}>{eng.v}</div>
                      <div className="text-sm font-bold" style={{color:e.c}}>{eng.p}</div>
                    </div>
                  );})}
                </div>
                <div className="flex h-3 rounded-md overflow-hidden bg-surface-alt">
                  {depthItems.map(function(e,i){var w=parseFloat((d.eng[e.k]||{p:"0"}).p)||0;return w>0?<div key={i} className="h-full transition-all duration-300" style={{width:w+"%",background:e.c}}/>:null;})}
                </div>
                {ix.avgDepth>0 && <div className="mt-3 text-sm text-text-muted text-center">Promedio: <strong className="text-accent font-mono">{ix.avgDepth}</strong> msgs/conv (leads engajados)</div>}
              </Card>
              <div className="flex flex-col gap-4">
                <Card className="flex-1 bg-accent-light border-accent/20">
                  <div className="text-xs text-text-muted font-bold uppercase tracking-wider">Leads Recurrentes</div>
                  <div className="flex items-baseline gap-1.5 mt-2">
                    <span className="text-3xl font-black font-mono text-accent">{ix.multiDayCount}</span>
                    <span className="text-sm font-bold text-accent">({d.resp>0?((ix.multiDayCount/d.resp)*100).toFixed(1):"0"}%)</span>
                  </div>
                  <div className="text-xs text-text-sub mt-1">volvieron otro d&iacute;a</div>
                </Card>
                <Card className="flex-1 bg-green-light border-green/20">
                  <div className="text-xs text-text-muted font-bold uppercase tracking-wider">Con Resultado</div>
                  <div className="flex items-baseline gap-1.5 mt-2">
                    <span className="text-3xl font-black font-mono text-green">{ix.outcomeCount}</span>
                    <span className="text-sm font-bold text-green">({d.resp>0?((ix.outcomeCount/d.resp)*100).toFixed(1):"0"}%)</span>
                  </div>
                  <div className="text-xs text-text-sub mt-1">tool, IG o reuni&oacute;n</div>
                </Card>
              </div>
            </div>

            <Card className="mb-6">
              <SectionTitle>{"Outcomes por T\u00F3pico"}</SectionTitle>
              <p className="text-sm text-text-muted mb-3.5">&quot;Con resultado&quot; = Yago us&oacute; herramienta, lead envi&oacute; IG, o se ofreci&oacute; reuni&oacute;n</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b-2 border-border">
                    {["T\u00F3pico","Conversas","Con Resultado","%"].map(function(h,i){return <th key={i} className="p-3 text-left text-text-muted font-bold text-xs uppercase tracking-wider">{h}</th>;})}
                  </tr></thead>
                  <tbody>
                    {d.topics.map(function(tp,i){
                      var to=ix.topicOutcomes[tp.t]||{total:0,withOutcome:0};
                      var oRate=to.total>0?((to.withOutcome/to.total)*100).toFixed(1):"0.0";
                      var oColor=parseFloat(oRate)>=30?"green":parseFloat(oRate)>=15?"yellow":"red";
                      return (<tr key={i} onClick={function(){setTopicModal(tp.t);}} className="border-b border-border/40 cursor-pointer hover:bg-surface-alt/50 transition-colors">
                        <td className="p-3 font-bold"><span className="mr-2">{tp.e}</span>{tp.t} <ChevronRight className="inline w-3 h-3 text-accent"/></td>
                        <td className="p-3 font-mono font-bold">{tp.n}</td>
                        <td className="p-3 font-mono font-bold text-green">{to.withOutcome}</td>
                        <td className="p-3"><Badge variant={oColor}>{oRate}%</Badge></td>
                      </tr>);
                    })}
                    <tr className="border-t-2 border-border font-extrabold">
                      <td className="p-3">Total</td>
                      <td className="p-3 font-mono">{d.resp}</td>
                      <td className="p-3 font-mono text-green">{ix.outcomeCount}</td>
                      <td className="p-3"><Badge>{d.resp>0?((ix.outcomeCount/d.resp)*100).toFixed(1):"0"}%</Badge></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </Card>

            <Card>
              <SectionTitle>Horario de Mensajes Inbound</SectionTitle>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={d.hours.map(function(v,i){return{h:String(i).padStart(2,"0")+"h",v:v};})} margin={{left:-10,right:5}}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chart.grid}/>
                  <XAxis dataKey="h" tick={{fontSize:11,fill:chart.tick}}/>
                  <YAxis tick={{fontSize:11,fill:chart.tick}}/>
                  <Tooltip contentStyle={tooltipStyle} formatter={function(v){return[v,"Mensajes"];}}/>
                  <Bar dataKey="v" radius={[4,4,0,0]} barSize={22}>
                    {d.hours.map(function(v,i){return <Cell key={i} fill={i===peakH?chart.accent:v>=10?chart.accent+"CC":v>=5?chart.accent+"77":chart.accent+"33"}/>;})}</Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="flex items-center justify-center gap-2 mt-3 px-4 py-2 bg-accent-light rounded-lg">
                <Clock className="w-4 h-4 text-accent"/>
                <span className="text-sm text-accent font-bold">Horario pico: {String(peakH).padStart(2,"0")}:00h</span>
                <span className="text-xs text-text-muted">({peakV} mensajes)</span>
              </div>
            </Card>
          </>);
        }

        /* Outbound engagement */
        return (<>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[
            {l:"Total Respuestas",v:totalResp,c:"text-purple",sub:dataD.all.rate+" tasa"},
            {l:"Tasa de Respuesta",v:d.rate,c:"text-accent",sub:d.resp+" leads respondieron"},
            {l:mode===1?"Auto-replies excl.":"Auto-replies",v:headerInfo.autoReplyCount,c:mode===1?"text-green":"text-red",sub:mode===1?"Excluidos del an\u00E1lisis":autoP+"% del total"},
            {l:"Leads Reales",v:headerInfo.realesCount,c:"text-green",sub:realP+"% son humanos reales"}
          ].map(function(k,i){return (
            <Card key={i} className="relative overflow-hidden">
              <div className="text-[11px] text-text-muted font-bold uppercase tracking-wider">{k.l}</div>
              <div className={clsx("text-3xl font-black font-mono mt-2 leading-none",k.c)}>{k.v}</div>
              <div className="text-xs text-text-muted mt-2">{k.sub}</div>
            </Card>
          );})}
        </div>

        <Card className="mb-6">
          <SectionTitle>{"Distribuci\u00F3n de Engagement ("+d.resp+" leads)"}</SectionTitle>
          <div className="grid grid-cols-4 gap-4 mb-4">
            {[
              {k:"alto",n:"Alto",c:C.green},
              {k:"medio",n:"Medio",c:C.accent},
              {k:"bajo",n:"Bajo",c:C.yellow},
              {k:"minimo",n:"M\u00EDnimo",c:C.red}
            ].map(function(e,i){var eng=d.eng[e.k];return (
              <div key={i} className="rounded-xl p-4 text-center" style={{background:e.c+"0C",border:"1px solid "+e.c+"22"}}>
                <div className="text-sm font-bold" style={{color:e.c}}>{e.n}</div>
                <div className="text-3xl font-black font-mono my-1" style={{color:e.c}}>{eng.v}</div>
                <div className="text-sm font-bold" style={{color:e.c}}>{eng.p}</div>
              </div>
            );})}
          </div>
          <div className="flex h-3.5 rounded-lg overflow-hidden bg-surface-alt">
            {[{k:"alto",c:C.green},{k:"medio",c:C.accent},{k:"bajo",c:C.yellow},{k:"minimo",c:C.red}].map(function(e,i){var w=parseFloat(d.eng[e.k].p)||0;return w>0?<div key={i} className="h-full transition-all duration-300" style={{width:w+"%",background:e.c}}/>:null;})}
          </div>
        </Card>

        <Card className="mb-6">
          <SectionTitle>{"Temas Abordados ("+d.resp+" leads)"}</SectionTitle>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {d.topics.map(function(tp,i){
              var bC=topicColors[i%topicColors.length];
              return (
                <div key={i} onClick={function(){setTopicModal(tp.t);}} className="rounded-xl p-4 cursor-pointer hover:scale-[1.02] transition-transform" style={{background:bC+"0A",border:"1px solid "+bC+"1A"}}>
                  <div className="flex items-center gap-2.5 mb-2.5">
                    <span className="text-2xl">{tp.e}</span>
                    <div><div className="text-sm font-extrabold">{tp.t}</div><div className="text-xs text-text-muted">{tp.n} leads</div></div>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <div className="flex-1 h-2 bg-surface-alt rounded-full overflow-hidden"><div className="h-full rounded-full" style={{width:tp.p+"%",background:bC,opacity:0.8}}/></div>
                    <span className="text-sm font-extrabold font-mono min-w-12 text-right" style={{color:bC}}>{tp.p}%</span>
                  </div>
                  <div className="text-[11px] font-bold mt-2 flex items-center gap-1" style={{color:bC}}>Ver conversaciones <ChevronRight className="w-3 h-3"/></div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card>
          <SectionTitle>Horario de Respuestas</SectionTitle>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={d.hours.map(function(v,i){return{h:String(i).padStart(2,"0")+"h",v:v};})} margin={{left:-10,right:5}}>
              <CartesianGrid strokeDasharray="3 3" stroke={chart.grid}/>
              <XAxis dataKey="h" tick={{fontSize:11,fill:chart.tick}}/>
              <YAxis tick={{fontSize:11,fill:chart.tick}}/>
              <Tooltip contentStyle={tooltipStyle} formatter={function(v){return[v,"Respuestas"];}}/>
              <Bar dataKey="v" radius={[4,4,0,0]} barSize={22}>
                {d.hours.map(function(v,i){return <Cell key={i} fill={i===peakH?chart.accent:v>=10?chart.accent+"CC":v>=5?chart.accent+"77":chart.accent+"33"}/>;})}</Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="flex items-center justify-center gap-2 mt-3 px-4 py-2 bg-accent-light rounded-lg">
            <Clock className="w-4 h-4 text-accent"/>
            <span className="text-sm text-accent font-bold">Horario pico: {String(peakH).padStart(2,"0")}:00h</span>
            <span className="text-xs text-text-muted">({peakV} respuestas)</span>
          </div>
        </Card>
      </>);
      })()}

      {/* ════ TEMPLATES TAB ════ */}
      {tab==="templates" && (<>
        {d.tplByStep ? (function(){
          var stepKeys=Object.keys(d.tplByStep).sort(function(a,b){return (d.tplByStep[a].order||99)-(d.tplByStep[b].order||99);});
          return (<>
            <Card className="mb-5"><SectionTitle>Cadencia</SectionTitle>
              <div className="flex items-center gap-0">{stepKeys.map(function(sk,i){var sg=d.tplByStep[sk];var items=[];if(i>0)items.push(<div key={"sep"+i} className="w-9 h-0.5 bg-border shrink-0"/>);items.push(<div key={sk} className="flex-1 rounded-xl p-3 text-center" style={{background:sg.color+"0A",border:"1px solid "+sg.color+"22"}}><div className="text-[11px] text-text-muted">{sg.day}</div><div className="text-base font-extrabold mt-1" style={{color:sg.color}}>{sg.label}</div><div className="text-xs text-text-muted">{sg.totalSent} enviados · {sg.templates.length} variante{sg.templates.length!==1?"s":""}</div></div>);return items;}).flat()}</div>
            </Card>
            <SectionTitle>Performance por Step</SectionTitle>
            {stepKeys.map(function(sk){var sg=d.tplByStep[sk];var rn=parseFloat(sg.totalRate);var sc=rn>=20?C.green:rn>=12?C.yellow:C.red;
              return (<div key={sk} className="mb-6">
                <div className="flex items-center gap-3 mb-3 px-4 py-2.5 rounded-xl" style={{background:sg.color+"0A",border:"1px solid "+sg.color+"22"}}>
                  <div className="flex-1">
                    <div className="text-[11px] text-text-muted font-semibold">{sg.day}</div>
                    <div className="text-lg font-extrabold" style={{color:sg.color}}>{sg.label}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-extrabold font-mono" style={{color:sc}}>{sg.totalRate}</div>
                    <div className="text-xs text-text-muted">{sg.totalResp} de {sg.totalSent}</div>
                  </div>
                </div>
                <div className={clsx("grid gap-3",sg.templates.length===1?"grid-cols-1":"grid-cols-1 md:grid-cols-2")}>
                  {sg.templates.map(function(t,i){var trn=parseFloat(t.rate);var tsc=trn>=20?C.green:trn>=12?C.yellow:C.red;
                    var tplItem=d.tpl.find(function(x){return x.key===t.name;});
                    return (<Card key={i} onClick={tplItem?function(){setSelTpl(tplItem);}:undefined}>
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-extrabold text-sm">{t.displayName}</div>
                          <div className="flex gap-1.5 mt-1">
                            <span className="text-[11px] text-text-muted bg-surface-alt px-2 py-0.5 rounded">{sg.day}</span>
                            <span className={clsx("text-[11px] font-bold px-2 py-0.5 rounded",t.lang==="pt"?"text-green bg-green-light":"text-accent bg-accent-light")}>{t.lang==="pt"?"PT":"ES"}</span>
                            {t.region && <span className={clsx("text-[11px] font-bold px-2 py-0.5 rounded",t.region==="br"?"text-green bg-green-light":"text-accent bg-accent-light")}>{t.region==="br"?"BR":"LATAM"}</span>}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xl font-extrabold font-mono" style={{color:tsc}}>{t.rate}</div>
                          <div className="text-xs text-text-muted">{t.resp} de {t.sent}</div>
                        </div>
                      </div>
                      {tplItem && <div className="text-[11px] text-accent font-semibold mt-2 flex items-center gap-1">Ver detalles <ChevronRight className="w-3 h-3"/></div>}
                    </Card>);
                  })}
                </div>
              </div>);
            })}
          </>);
        })() : (<>
          <Card className="mb-5"><SectionTitle>Cadencia</SectionTitle>
            <div className="flex items-center gap-0">{[{l:"MSG 1",s:"Yago SDR",d:"D+0",c:C.accent},0,{l:"MSG 2",s:"Sin WA / Caso \u00C9xito",d:"D+1",c:C.purple},0,{l:"MSG 3",s:"Value Nudge",d:"D+3",c:C.cyan},0,{l:"MSG 4",s:"Quick Audit",d:"D+5",c:C.orange}].map(function(s,i){if(!s)return <div key={i} className="w-9 h-0.5 bg-border shrink-0"/>;return(<div key={i} className="flex-1 rounded-xl p-3 text-center" style={{background:s.c+"0A",border:"1px solid "+s.c+"22"}}><div className="text-[11px] text-text-muted">{s.d}</div><div className="text-base font-extrabold mt-1" style={{color:s.c}}>{s.l}</div><div className="text-xs text-text-muted">{s.s}</div></div>);})}</div>
          </Card>
          <SectionTitle>Performance por Template</SectionTitle>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
            {d.tpl.map(function(t,i){var rn=parseFloat(t.rate);var sc=rn>=20?C.green:rn>=12?C.yellow:C.red;
              return (<Card key={i} onClick={function(){setSelTpl(t);}}>
                <div className="flex justify-between items-start"><div><div className="font-extrabold text-base">{t.name}</div><span className="text-xs text-text-muted bg-surface-alt px-2 py-0.5 rounded">{t.day}</span></div><div className="text-right"><div className="text-2xl font-extrabold font-mono" style={{color:sc}}>{t.rate}</div><div className="text-xs text-text-muted">{t.resp} de {t.sent}</div></div></div>
                <div className="text-[11px] text-accent font-semibold mt-2 flex items-center gap-1">Ver detalles <ChevronRight className="w-3 h-3"/></div>
              </Card>);
            })}
          </div>
        </>)}
        {d.bcast&&d.bcast.length>0&&(<div className="mb-6"><SectionTitle>Disparos Puntuais (fora do lifecycle)</SectionTitle><div className="grid grid-cols-1 gap-2.5">{d.bcast.map(function(t,i){var rn=parseFloat(t.rate);var sc=rn>=20?C.green:rn>=12?C.yellow:C.red;return(<Card key={i} onClick={function(){setSelTpl(t);}} className="border-dashed border-yellow/40 bg-yellow-light">
          <div className="flex justify-between items-center"><div><div className="font-extrabold text-base">{t.name}</div><span className="text-xs text-text-muted bg-yellow-light px-2 py-0.5 rounded">Broadcast</span></div><div className="text-right"><div className="text-2xl font-extrabold font-mono" style={{color:sc}}>{t.rate}</div><div className="text-xs text-text-muted">{t.resp+" de "+t.sent}</div></div></div>
          <div className="text-[11px] text-yellow font-semibold mt-2 flex items-center gap-1">Ver detalles <ChevronRight className="w-3 h-3"/></div>
        </Card>);})}</div></div>)}
        <Card className="mb-5 bg-purple-light border-purple/20">
          <SectionTitle>{"¿En qu\u00E9 template respondieron los que llegaron a reuni\u00F3n?"}</SectionTitle>
          <p className="text-sm text-text-sub mb-3.5">De {d.mc} leads, este fue el <strong>template donde respondieron por primera vez</strong>:</p>
          <div className={clsx("grid gap-2.5","grid-cols-"+Math.min(mbt.length,6))}>
            {mbt.map(function(m,i){return (<div key={i} className="text-center p-3 bg-surface rounded-xl" style={{border:m.v?"2px solid "+m.c+"33":"1px solid var(--color-border)"}}><div className="text-xs font-bold" style={{color:m.v?m.c:"var(--color-text-muted)"}}>{m.l}</div><div className="text-2xl font-black font-mono mt-1" style={{color:m.v?m.c:"var(--color-text-muted)"}}>{m.v}</div></div>);})}
          </div>
        </Card>
        <Card onClick={function(){setShowM(true);}} highlight="pink" className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Target className="w-7 h-7 text-pink"/>
            <div><div className="text-base font-extrabold text-pink">{"Ver los "+d.mc+" leads con oferta de reuni\u00F3n"}</div><div className="text-xs text-text-muted">Click para ver contactos y conversaciones completas</div></div>
          </div>
          <ChevronRight className="w-5 h-5 text-pink"/>
        </Card>
      </>)}

      {/* ════ BENCHMARKS TAB ════ */}
      {tab==="benchmarks" && (<>
        <Card className="mb-6 overflow-x-auto"><SectionTitle>{"Comparaci\u00F3n vs Benchmarks (Warm Leads)"}</SectionTitle>
          <p className="text-sm text-text-muted mb-3.5">{"Leads que se registraron en la plataforma = warm/opt-in. Benchmarks: Twilio, Meta, Respond.io, ChatArchitect (2024-2025)."}</p>
          <table className="w-full text-sm">
            <thead><tr className="border-b-2 border-border">
              {["M\u00E9trica","Yago","Benchmark","\u0394",""].map(function(h,i){return <th key={i} className="p-3 text-left text-text-muted font-bold text-xs uppercase tracking-wider">{h}</th>;})}
            </tr></thead>
            <tbody>{bTable.map(function(r,i){return(<tr key={i} className="border-b border-border/40 hover:bg-surface-alt/50 transition-colors">
              <td className="p-3 font-semibold">{r.m}</td>
              <td className="p-3 font-extrabold font-mono text-base">{r.y}</td>
              <td className="p-3 text-text-muted">{r.b}</td>
              <td className="p-3 font-bold font-mono" style={{color:r.s?"var(--color-green)":"var(--color-red)"}}>{r.d}</td>
              <td className="p-3"><Badge variant={r.s?"green":"red"}>{r.s?"\u2713 ARRIBA":"\u2717 ABAJO"}</Badge></td>
            </tr>);})}</tbody>
          </table>
        </Card>
        <Card>
          <h3 className="text-lg font-black mb-5">Veredicto</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[{t:"FORTALEZAS",c:"green",i:["Resp. <6 min — 2.5x mejor que benchmark","75% engagement medio o alto","28 msgs/conv — conversaciones profundas","Cada template captura leads nuevos"]},{t:"GAPS",c:"red",i:["23.6% real vs 40-60% warm benchmark","24.6% auto-replies inflando m\u00E9tricas","Caso \u00C9xito solo 4% de la base","Solo 3% llega a reuni\u00F3n (bench: 20-30%)"]},{t:"ACCIONES",c:"yellow",i:["Filtrar auto-replies","Escalar Caso de \u00C9xito","Mover CTA reuni\u00F3n a MSG 3","Enviar 14-18h"]}].map(function(col,i){return(<div key={i}>
              <div className={clsx("text-sm font-extrabold mb-3","text-"+col.c)}>{col.t}</div>
              {col.i.map(function(item,j){return <div key={j} className={clsx("text-sm text-text-sub py-1.5 pl-3 border-l-2 leading-relaxed","border-"+col.c+"/30")}>{item}</div>;})}
            </div>);})}
          </div>
        </Card>
      </>)}

      {/* ════ LOOKUP TAB ════ */}
      {tab==="lookup" && (<>
        <Card className="mb-6">
          <SectionTitle>{"Buscar Conversaci\u00F3n"}</SectionTitle>
          <form onSubmit={function(e){e.preventDefault();handleSearch(searchQuery);}} className="flex gap-2.5">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted"/>
              <input value={searchQuery} onChange={function(e){setSearchQuery(e.target.value);}} placeholder="Tel&eacute;fono o Thread ID..." className="w-full pl-10 pr-4 py-3 bg-surface-alt border border-border rounded-xl text-sm font-mono text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-all"/>
            </div>
            <button type="submit" disabled={searchLoading} className="px-6 py-3 bg-accent text-white text-sm font-bold rounded-xl hover:opacity-90 disabled:opacity-50 transition-all cursor-pointer disabled:cursor-not-allowed">
              {searchLoading?"Buscando...":"Buscar"}
            </button>
          </form>
          <p className="text-xs text-text-muted mt-2">Busca por n&uacute;mero de tel&eacute;fono (parcial). Busca en los datos cargados.</p>
        </Card>

        {searchLoading && <div className="text-center py-10 text-text-muted text-sm">Buscando...</div>}

        {searchResults!==null&&!searchLoading&&searchResults.length===0 && (
          <Card className="text-center py-10">
            <Search className="w-8 h-8 text-text-muted mx-auto mb-3 opacity-40"/>
            <p className="text-base font-bold text-text-muted">No se encontraron resultados</p>
            <p className="text-sm text-text-muted mt-1">Intenta con otro n&uacute;mero o thread ID</p>
          </Card>
        )}

        {searchResults!==null&&searchResults.length>0&&searchSel===null && (
          <Card>
            <div className="flex justify-between items-center mb-3.5">
              <span className="text-base font-extrabold">{searchResults.length} resultado{searchResults.length!==1?"s":""}</span>
              <span className="text-xs text-text-muted">Click en un resultado para ver detalles</span>
            </div>
            <div className="flex flex-col gap-2">
              {searchResults.map(function(r,i){
                var l=r.lead;var ql=qualLabel(l.q);
                return (<div key={i} onClick={function(){selectSearchResult(i);}} className="flex items-center gap-3.5 p-3.5 bg-surface-alt rounded-xl cursor-pointer border-2 border-transparent hover:border-accent/30 transition-all">
                  <span className="text-xl">{l.co}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-base">{l.p}</span>
                      <BadgeColor color={C[{alto:"green",medio:"accent",bajo:"yellow",minimo:"red"}[l.e]]||C.muted}>{l.e}</BadgeColor>
                      <Badge variant={ql.c}>{ql.t}</Badge>
                      {l.au && <Badge variant="red">AUTO</Badge>}
                    </div>
                    <div className="text-xs text-text-muted mt-1">
                      {l.ms} msgs · {l.w.toLocaleString()} pal. · Tpls: <strong>{l.tr.join(", ")||"N/A"}</strong>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-accent"/>
                </div>);
              })}
            </div>
          </Card>
        )}

        {searchSel!==null&&searchResults&&searchResults[searchSel] && (function(){
          var item=searchResults[searchSel];var lead=item.lead;
          return (<Card>
            <ConvView lead={lead} onBack={function(){setSearchSel(null);setSearchThreadData(null);}}/>
          </Card>);
        })()}
      </>)}

      {/* ════ CONFIG TAB ════ */}
      {tab==="config" && (<>
        <Card>
          <SectionTitle>{"Configuraci\u00F3n de Templates"}</SectionTitle>
          <p className="text-sm text-text-sub mb-5 leading-relaxed">Asigna cada template a una categor&iacute;a para agruparlos en la pesta&ntilde;a Templates. Templates marcados como <strong>Autom&aacute;tico</strong> o <strong>Campa&ntilde;a</strong> ser&aacute;n excluidos de los indicadores de Resumen.</p>
          {allTemplateNames.length===0 && <div className="text-center py-8 text-text-muted text-sm">No hay templates cargados a&uacute;n. Carga datos primero.</div>}
          {allTemplateNames.length>0 && (<>
            <div className="flex flex-col gap-2">
              {allTemplateNames.slice().sort().map(function(tplName){
                var currentEntry=templateConfig[tplName]||{};
                var currentCat=typeof currentEntry==="string"?currentEntry:(currentEntry.category||"sin_categoria");
                var currentRegion=typeof currentEntry==="string"?"":(currentEntry.region||"");
                return (<div key={tplName} className="flex items-center gap-3.5 p-3 bg-surface-alt rounded-xl border border-border">
                  <div className="flex-1 font-bold text-sm font-mono truncate">{tplName}</div>
                  <select value={currentCat} onChange={function(e){updateTemplateConfig(tplName,"category",e.target.value);}} className="px-3 py-1.5 border border-border rounded-lg text-sm bg-surface text-text cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent/30 min-w-48">
                    <option value="sin_categoria">Sin categor&iacute;a</option>
                    <option value="d0">D+0 — Contacto Inicial</option>
                    <option value="d1">D+1 — Seguimiento</option>
                    <option value="d3">D+3 — Value Nudge</option>
                    <option value="d5">D+5 — Quick Audit</option>
                    <option value="automatico">Autom&aacute;tico</option>
                    <option value="campanha">Campa&ntilde;a</option>
                  </select>
                  <select value={currentRegion} onChange={function(e){updateTemplateConfig(tplName,"region",e.target.value);}} className="px-3 py-1.5 border border-border rounded-lg text-sm bg-surface text-text cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent/30 min-w-32">
                    <option value="">Sin regi&oacute;n</option>
                    <option value="br">BR</option>
                    <option value="latam">LATAM</option>
                  </select>
                </div>);
              })}
            </div>
            <div className="mt-5 flex items-center gap-3">
              <button onClick={resetConfig} className="px-5 py-2.5 text-sm font-bold text-red bg-red-light border border-red/20 rounded-xl hover:bg-red/20 transition-colors cursor-pointer">Resetear config</button>
              <span className="text-xs text-text-muted">Resetear volver&aacute; al auto-detect por step_order en la pr&oacute;xima carga.</span>
            </div>
          </>)}
        </Card>
      </>)}
    </main>
  </div>);
}
