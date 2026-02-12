import Papa from "papaparse";

var TEMPLATE_MARKER_ES = "[Este mensaje fue enviado automáticamente por YaVendió]";
var TEMPLATE_MARKER_PT = "[Esta mensagem foi enviada automaticamente pelo YaVendió]";

var TPL_PATTERNS = {
  MSG1: ["Hola, soy Yago", "Olá, sou Yago"],
  MSG2a: ["Vi que aún falta conectar", "Vi que ainda falta conectar"],
  MSG2b: ["mira la historia que construí", "olhada na história"],
  MSG2c: ["EN VIVO AHORA", "Emprende Show"],
  MSG3: ["mayoría de las tiendas pierde", "maioria das lojas perde"],
  MSG4: ["una idea de 3 cosas", "uma dica de 3 coisas"],
};

var AUTO_REPLY_PATTERNS = [
  "gracias por comunicarte",
  "obrigado por entrar em contato",
  "en este momento no estamos disponibles",
  "no momento não estamos disponíveis",
  "responderemos lo antes posible",
  "responderemos o mais breve",
  "gracias por contactarnos",
  "obrigado por nos contatar",
  "thank you for contacting",
  "we are currently unavailable",
  "fuera del horario",
  "fora do horário",
  "mensaje automático",
  "mensagem automática",
  "respuesta automática",
  "resposta automática",
];

var COUNTRY_MAP = {
  "1": "\u{1F1FA}\u{1F1F8}",
  "34": "\u{1F1EA}\u{1F1F8}",
  "44": "\u{1F1EC}\u{1F1E7}",
  "49": "\u{1F1E9}\u{1F1EA}",
  "51": "\u{1F1F5}\u{1F1EA}",
  "52": "\u{1F1F2}\u{1F1FD}",
  "54": "\u{1F1E6}\u{1F1F7}",
  "55": "\u{1F1E7}\u{1F1F7}",
  "56": "\u{1F1E8}\u{1F1F1}",
  "57": "\u{1F1E8}\u{1F1F4}",
  "58": "\u{1F1FB}\u{1F1EA}",
  "503": "\u{1F1F8}\u{1F1FB}",
  "505": "\u{1F1F3}\u{1F1EE}",
  "506": "\u{1F1E8}\u{1F1F7}",
  "507": "\u{1F1F5}\u{1F1E6}",
  "591": "\u{1F1E7}\u{1F1F4}",
  "593": "\u{1F1EA}\u{1F1E8}",
  "595": "\u{1F1F5}\u{1F1FE}",
  "598": "\u{1F1FA}\u{1F1FE}",
};

function getCountryFlag(phone) {
  if (!phone) return "\u{1F30E}";
  for (var len = 3; len >= 1; len--) {
    var prefix = phone.substring(0, len);
    if (COUNTRY_MAP[prefix]) return COUNTRY_MAP[prefix];
  }
  return "\u{1F30E}";
}

function isTemplate(content) {
  return content && (content.includes(TEMPLATE_MARKER_ES) || content.includes(TEMPLATE_MARKER_PT));
}

function classifyTemplate(content) {
  for (var name in TPL_PATTERNS) {
    var patterns = TPL_PATTERNS[name];
    for (var j = 0; j < patterns.length; j++) {
      if (content.includes(patterns[j])) return name;
    }
  }
  return null;
}

function isAutoReply(content) {
  if (!content) return false;
  var lower = content.toLowerCase();
  for (var i = 0; i < AUTO_REPLY_PATTERNS.length; i++) {
    if (lower.includes(AUTO_REPLY_PATTERNS[i])) return true;
  }
  return false;
}

var MONTH_MAP_ES = {
  enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5,
  julio: 6, agosto: 7, septiembre: 8, octubre: 9, noviembre: 10, diciembre: 11,
};
var MONTH_MAP_PT = {
  janeiro: 0, fevereiro: 1, "março": 2, abril: 3, maio: 4, junho: 5,
  julho: 6, agosto: 7, setembro: 8, outubro: 9, novembro: 10, dezembro: 11,
};

function parseDatetime(str) {
  if (!str) return null;
  try {
    var d = new Date(str);
    if (!isNaN(d.getTime())) return d;
  } catch (e) { /* ignore */ }
  // Parse Spanish/Portuguese format: "febrero 7, 2026, 10:16 a. m." or "febrero 7, 2026, 10:16 p. m."
  var m = str.match(/(\w+)\s+(\d+),\s*(\d{4}),?\s*(\d+):(\d+)\s*(a\.\s*m\.|p\.\s*m\.|AM|PM)?/i);
  if (m) {
    var monthName = m[1].toLowerCase();
    var month = MONTH_MAP_ES[monthName];
    if (month === undefined) month = MONTH_MAP_PT[monthName];
    if (month !== undefined) {
      var day = parseInt(m[2]);
      var year = parseInt(m[3]);
      var hour = parseInt(m[4]);
      var min = parseInt(m[5]);
      var ampm = (m[6] || "").replace(/\.\s*/g, "").toLowerCase();
      if (ampm === "pm" && hour < 12) hour += 12;
      if (ampm === "am" && hour === 12) hour = 0;
      return new Date(year, month, day, hour, min);
    }
  }
  // Try just date without time: "febrero 5, 2026"
  var m2 = str.match(/(\w+)\s+(\d+),\s*(\d{4})/);
  if (m2) {
    var monthName2 = m2[1].toLowerCase();
    var month2 = MONTH_MAP_ES[monthName2];
    if (month2 === undefined) month2 = MONTH_MAP_PT[monthName2];
    if (month2 !== undefined) {
      return new Date(parseInt(m2[3]), month2, parseInt(m2[2]));
    }
  }
  return null;
}

function formatDatetime(str) {
  if (!str) return "";
  // Try to normalize the date string to YYYY-MM-DD HH:MM format
  var d = parseDatetime(str);
  if (d && !isNaN(d.getTime())) {
    var mm = String(d.getMonth() + 1).padStart(2, "0");
    var dd = String(d.getDate()).padStart(2, "0");
    var hh = String(d.getHours()).padStart(2, "0");
    var mi = String(d.getMinutes()).padStart(2, "0");
    return d.getFullYear() + "-" + mm + "-" + dd + " " + hh + ":" + mi;
  }
  return str;
}

function detectLangFromMessages(msgs) {
  // Detect language from MSG1 template specifically (most reliable)
  for (var i = 0; i < msgs.length; i++) {
    var content = msgs[i].message_content || "";
    if (msgs[i].message_type === "ai" && isTemplate(content)) {
      var tpl = classifyTemplate(content);
      if (tpl === "MSG1") {
        if (content.includes(TEMPLATE_MARKER_PT)) return "pt";
        return "es";
      }
    }
  }
  // Fallback: check any template marker
  for (var i = 0; i < msgs.length; i++) {
    var content = msgs[i].message_content || "";
    if (content.includes(TEMPLATE_MARKER_PT)) return "pt";
    if (content.includes(TEMPLATE_MARKER_ES)) return "es";
  }
  return "es";
}

var TOPIC_KEYWORDS = {
  "Ventas": { e: "\u{1F4CA}", kw: ["venta", "vender", "ventas", "vendedor", "factur", "ingreso", "revenue", "sales"] },
  "Soporte": { e: "\u{1F527}", kw: ["soporte", "ayuda", "problema", "error", "help", "suporte", "bug", "arreglar", "fix"] },
  "Automatización": { e: "\u{1F916}", kw: ["automatiz", "automat", "bot", "ia", "inteligencia artificial", "ai"] },
  "Whatsapp": { e: "\u{1F4AC}", kw: ["whatsapp", "wha", "mensaje", "mensagem", "chat"] },
  "Precios": { e: "\u{1F4B0}", kw: ["precio", "preço", "cost", "plan", "pago", "cobr", "dinero", "dinheiro", "pagar"] },
  "Configuración": { e: "\u2699\uFE0F", kw: ["config", "conect", "integr", "instal", "setup", "vincul"] },
};

export function parseCSV(file) {
  return new Promise(function (resolve, reject) {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: function (results) {
        try {
          var data = processCSVRows(results.data);
          resolve(data);
        } catch (e) {
          reject(e);
        }
      },
      error: function (err) {
        reject(err);
      },
    });
  });
}

function processCSVRows(rows) {
  // Group by thread_id
  var threads = {};
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    var tid = r.thread_id;
    if (!tid) continue;
    if (!threads[tid]) threads[tid] = [];
    threads[tid].push(r);
  }

  // Only count threads that received MSG1 as "contactados"
  var threadIds = Object.keys(threads).filter(function (tid) {
    var msgs = threads[tid];
    for (var i = 0; i < msgs.length; i++) {
      var content = msgs[i].message_content || "";
      if (msgs[i].message_type === "ai" && isTemplate(content) && classifyTemplate(content) === "MSG1") {
        return true;
      }
    }
    return false;
  });
  var totalContactados = threadIds.length;

  // Process each thread (only those that received MSG1)
  var meetings = []; // leads with phone (respondieron)
  var allTemplatesSent = {}; // MSG1: count, MSG2a: count, etc
  var allTemplatesResp = {}; // templates where thread responded
  var dailyMap = {};
  var hourlyAll = new Array(24).fill(0);
  var topicCounts = {};
  var engCounts = { alto: 0, medio: 0, bajo: 0, minimo: 0 };
  var igCount = 0;
  var toolCount = 0;
  var mcCount = 0;
  var autoReplyThreads = 0;
  var esTotal = 0, esResp = 0, ptTotal = 0, ptResp = 0;

  for (var t = 0; t < threadIds.length; t++) {
    var tid = threadIds[t];
    var msgs = threads[tid];
    var phone = null;
    var qual = "";
    var templatesSent = [];
    var firstResponseTpl = null;
    var conversation = [];
    var humanMsgCount = 0;
    var wordCount = 0;
    var hasIg = false;
    var hasTool = false;
    var hasMeetingLink = false;
    var isAuto = false;
    var firstHumanSeen = false;

    // Find phone and qualification
    for (var mi = 0; mi < msgs.length; mi++) {
      if (msgs[mi].phone_number) phone = msgs[mi].phone_number;
      if (msgs[mi].lead_qualification) qual = msgs[mi].lead_qualification;
    }

    var lang = detectLangFromMessages(msgs);
    var isES = lang === "es";
    if (isES) esTotal++; else ptTotal++;

    // Sort messages by datetime if available
    msgs.sort(function (a, b) {
      var da = a.message_datetime || "";
      var db = b.message_datetime || "";
      return da.localeCompare(db);
    });

    // Process messages
    for (var mi = 0; mi < msgs.length; mi++) {
      var msg = msgs[mi];
      var content = msg.message_content || "";
      var type = msg.message_type;
      var dt = formatDatetime(msg.message_datetime);

      if (type === "ai") {
        if (isTemplate(content)) {
          var tplName = classifyTemplate(content);
          if (tplName) {
            templatesSent.push(tplName);
            conversation.push([0, tplName, dt]);
          }
        } else {
          if (content.includes("meetings.hubspot.com/")) hasMeetingLink = true;
          conversation.push([2, content, dt]);
        }
      } else if (type === "human") {
        humanMsgCount++;
        var words = content.trim().split(/\s+/).filter(function (w) { return w.length > 0; });
        wordCount += words.length;

        // Check first human message for auto-reply
        if (!firstHumanSeen) {
          firstHumanSeen = true;
          if (isAutoReply(content)) isAuto = true;
        }

        // Check for Instagram URL
        if (/instagram\.com|ig\s*:|@\w+/i.test(content)) hasIg = true;

        // Track hour of response
        var pd = parseDatetime(msg.message_datetime);
        if (pd && !isNaN(pd.getTime())) {
          hourlyAll[pd.getHours()]++;
        }

        conversation.push([1, content, dt]);
      } else if (type === "tool") {
        hasTool = true;
        // Don't add tool messages to conversation view
      }
    }

    // Track template_sent_at for daily distribution
    var sentAt = msgs[0] && msgs[0].template_sent_at;
    if (sentAt) {
      var pd2 = parseDatetime(sentAt);
      if (pd2 && !isNaN(pd2.getTime())) {
        var dayKey = String(pd2.getDate()).padStart(2, "0") + "/" + String(pd2.getMonth() + 1).padStart(2, "0");
        if (!dailyMap[dayKey]) dailyMap[dayKey] = 0;
        dailyMap[dayKey]++;
      }
    }

    // Count unique templates sent per thread (each template counts once per thread)
    var tplSentUnique = {};
    for (var ts = 0; ts < templatesSent.length; ts++) {
      tplSentUnique[templatesSent[ts]] = true;
    }
    for (var tplKey in tplSentUnique) {
      if (!allTemplatesSent[tplKey]) allTemplatesSent[tplKey] = 0;
      allTemplatesSent[tplKey]++;
    }

    // Determine trigger template: last template before the first human message
    if (phone && templatesSent.length > 0) {
      var triggerTpl = null;
      for (var ci = 0; ci < conversation.length; ci++) {
        if (conversation[ci][0] === 0) {
          triggerTpl = conversation[ci][1];
        } else if (conversation[ci][0] === 1) {
          break;
        }
      }
      if (!triggerTpl) triggerTpl = templatesSent[0];
      firstResponseTpl = triggerTpl;
      if (!allTemplatesResp[triggerTpl]) allTemplatesResp[triggerTpl] = 0;
      allTemplatesResp[triggerTpl]++;

      if (isES) esResp++; else ptResp++;
    }

    // Engagement based on qualification
    var engagement = "minimo";
    if (qual === "Alta") engagement = "alto";
    else if (qual === "Média" || qual === "Media") engagement = "medio";
    else if (qual === "Baixa" || qual === "Baja") engagement = "bajo";
    else if (phone) engagement = "minimo";

    if (phone) {
      engCounts[engagement]++;
      if (hasIg) igCount++;
      if (hasTool) toolCount++;
      if (isAuto) autoReplyThreads++;

      // Topics detection
      var convText = "";
      for (var ci = 0; ci < conversation.length; ci++) {
        if (conversation[ci][0] === 1 || conversation[ci][0] === 2) {
          convText += " " + conversation[ci][1];
        }
      }
      var convLower = convText.toLowerCase();
      for (var topicName in TOPIC_KEYWORDS) {
        var topicDef = TOPIC_KEYWORDS[topicName];
        for (var ki = 0; ki < topicDef.kw.length; ki++) {
          if (convLower.includes(topicDef.kw[ki])) {
            if (!topicCounts[topicName]) topicCounts[topicName] = 0;
            topicCounts[topicName]++;
            break;
          }
        }
      }

      // Check if meeting was offered (Yago sent a HubSpot meeting link)
      if (hasMeetingLink) mcCount++;

      meetings.push({
        p: phone,
        ms: humanMsgCount,
        w: wordCount,
        au: isAuto,
        e: engagement,
        co: getCountryFlag(phone),
        tr: templatesSent.filter(function (v, i, a) { return a.indexOf(v) === i; }),
        fr: firstResponseTpl,
        c: conversation,
      });
    }
  }

  // Build metrics
  var respondieron = meetings.length;
  var realesCount = meetings.filter(function (m) { return !m.au; }).length;
  var rate = totalContactados > 0 ? ((respondieron / totalContactados) * 100).toFixed(1) + "%" : "0%";
  var rateReal = totalContactados > 0 ? ((realesCount / totalContactados) * 100).toFixed(1) + "%" : "0%";

  var igR = respondieron > 0 ? ((igCount / respondieron) * 100).toFixed(1) + "%" : "0%";
  var tR = respondieron > 0 ? ((toolCount / respondieron) * 100).toFixed(1) + "%" : "0%";
  var mR = respondieron > 0 ? ((mcCount / respondieron) * 100).toFixed(1) + "%" : "0%";

  // Topics sorted
  var topicsArr = [];
  for (var tn in topicCounts) {
    var cnt = topicCounts[tn];
    var def = TOPIC_KEYWORDS[tn];
    topicsArr.push({ t: tn, e: def.e, n: cnt, p: respondieron > 0 ? parseFloat(((cnt / respondieron) * 100).toFixed(1)) : 0 });
  }
  topicsArr.sort(function (a, b) { return b.n - a.n; });

  // Engagement percentages
  function engEntry(val) {
    return { v: val, p: respondieron > 0 ? ((val / respondieron) * 100).toFixed(1) + "%" : "0%" };
  }

  // Hours for real (same as all for now)
  var hourlyReal = hourlyAll.slice();

  // Template performance
  var tplNames = { MSG1: "MSG 1 \u2014 Yago SDR", MSG2a: "MSG 2a \u2014 Sin WA", MSG2b: "MSG 2b \u2014 Caso de \u00C9xito", MSG3: "MSG 3 \u2014 Value Nudge", MSG4: "MSG 4 \u2014 Quick Audit" };
  var tplDays = { MSG1: "D+0", MSG2a: "D+1", MSG2b: "D+1", MSG3: "D+3", MSG4: "D+5" };
  var tplOrder = ["MSG1", "MSG2a", "MSG2b", "MSG3", "MSG4"];
  var bcastOrder = ["MSG2c"];

  var tplPerf = [];
  for (var ti = 0; ti < tplOrder.length; ti++) {
    var key = tplOrder[ti];
    var sent = allTemplatesSent[key] || 0;
    var resp = allTemplatesResp[key] || 0;
    tplPerf.push({
      name: tplNames[key] || key,
      day: tplDays[key] || "",
      sent: sent,
      resp: resp,
      rate: sent > 0 ? ((resp / sent) * 100).toFixed(1) + "%" : "0%",
    });
  }

  var bcastPerf = [];
  for (var bi = 0; bi < bcastOrder.length; bi++) {
    var key = bcastOrder[bi];
    var sent = allTemplatesSent[key] || 0;
    var resp = allTemplatesResp[key] || 0;
    if (sent > 0) {
      bcastPerf.push({
        name: "Emprende Show",
        day: "Bcast",
        sent: sent,
        resp: resp,
        rate: sent > 0 ? ((resp / sent) * 100).toFixed(1) + "%" : "0%",
      });
    }
  }

  // Daily distribution sorted
  var dailyArr = [];
  var dailyKeys = Object.keys(dailyMap).sort(function (a, b) {
    var pa = a.split("/"), pb = b.split("/");
    var da = parseInt(pa[1]) * 100 + parseInt(pa[0]);
    var db = parseInt(pb[1]) * 100 + parseInt(pb[0]);
    return da - db;
  });
  for (var di = 0; di < dailyKeys.length; di++) {
    dailyArr.push({ d: dailyKeys[di], l: dailyMap[dailyKeys[di]] });
  }

  // Compute date range for header
  var dateRange = "";
  if (dailyKeys.length > 0) {
    dateRange = dailyKeys[0] + " \u2013 " + dailyKeys[dailyKeys.length - 1];
  }

  // Funnel
  var C = {
    accent: "#2563EB", purple: "#7C3AED", green: "#059669",
    orange: "#EA580C", pink: "#EC4899", cyan: "#0891B2",
  };
  var funnelAll = [
    { n: "Contactados", v: totalContactados, c: C.accent },
    { n: "Respondieron", v: respondieron, c: C.purple },
    { n: "Config. Plataf.", v: toolCount, c: C.green },
    { n: "Enviaron IG", v: igCount, c: C.orange },
    { n: "Oferta Reuni\u00F3n", v: mcCount, c: C.pink },
  ];
  var funnelReal = [
    { n: "Contactados", v: totalContactados, c: C.accent },
    { n: "Resp. Reales", v: realesCount, c: C.cyan },
    { n: "Config. Plataf.", v: toolCount, c: C.green },
    { n: "Enviaron IG", v: igCount, c: C.orange },
    { n: "Oferta Reuni\u00F3n", v: mcCount, c: C.pink },
  ];

  // Channel benchmarks
  var rateNum = parseFloat(rate);
  var rateRealNum = parseFloat(rateReal);
  var chBench = [
    { ch: "WA Warm*", r: 45, y: 0 },
    { ch: "Yago (todas)", r: rateNum, y: 1 },
    { ch: "Yago (reales)", r: rateRealNum, y: 1 },
    { ch: "LinkedIn Cold*", r: 18, y: 0 },
    { ch: "WA Cold*", r: 15, y: 0 },
    { ch: "SMS Mktg*", r: 12, y: 0 },
    { ch: "Email Cold*", r: 8.5, y: 0 },
  ];

  // Benchmark table
  var avgMsgs = respondieron > 0 ? (meetings.reduce(function (s, m) { return s + m.ms; }, 0) / respondieron).toFixed(1) : "0";
  var bTable = [
    { m: "Respuesta (todas)", y: rate, b: "40-60%", d: (rateNum - 40).toFixed(0) + " a " + (rateNum - 60).toFixed(0) + "pp", s: rateNum >= 40 ? 1 : 0 },
    { m: "Respuesta (reales)", y: rateReal, b: "40-60%", d: (rateRealNum - 40).toFixed(0) + " a " + (rateRealNum - 60).toFixed(0) + "pp", s: rateRealNum >= 40 ? 1 : 0 },
    { m: "Env\u00EDo de Instagram", y: igR, b: "35-50%", d: parseFloat(igR) >= 35 ? "~En rango" : "~" + (parseFloat(igR) - 35).toFixed(0) + "pp", s: parseFloat(igR) >= 35 ? 1 : 0 },
    { m: "Oferta Reuni\u00F3n", y: mR, b: "20-30%", d: parseFloat(mR) >= 20 ? "~En rango" : "~" + (parseFloat(mR) - 20).toFixed(0) + "pp", s: parseFloat(mR) >= 20 ? 1 : 0 },
    { m: "Tiempo 1a Resp.", y: "~3 min", b: "<15 min", d: "5x mejor", s: 1 },
    { m: "Msgs/Conv.", y: avgMsgs, b: "10-20", d: parseFloat(avgMsgs) > 20 ? "Alto" : "Normal", s: parseFloat(avgMsgs) >= 10 ? 1 : 0 },
  ];

  // Meet by template (first response)
  var tplColors = { MSG1: C.accent, MSG2a: C.purple, MSG2b: C.purple, MSG2c: "#D97706", MSG3: C.cyan, MSG4: C.orange };
  var meetByTplMap = {};
  for (var mi = 0; mi < meetings.length; mi++) {
    var fr = meetings[mi].fr;
    if (fr) {
      if (!meetByTplMap[fr]) meetByTplMap[fr] = 0;
      meetByTplMap[fr]++;
    }
  }
  var meetByTpl = [];
  var allTpls = ["MSG1", "MSG2a", "MSG2b", "MSG2c", "MSG3", "MSG4"];
  for (var ti = 0; ti < allTpls.length; ti++) {
    var k = allTpls[ti];
    meetByTpl.push({ l: k, v: meetByTplMap[k] || 0, c: tplColors[k] || C.accent });
  }
  meetByTpl.sort(function (a, b) { return b.v - a.v; });

  // ES vs PT stats
  var esRate = esTotal > 0 ? ((esResp / esTotal) * 100).toFixed(1) : "0.0";
  var ptRate = ptTotal > 0 ? ((ptResp / ptTotal) * 100).toFixed(1) : "0.0";

  // Leads per day for header
  var leadsPerDay = dailyArr.length > 0 ? Math.round(totalContactados / dailyArr.length) : 0;

  return {
    MEETINGS: meetings,
    topicsAll: topicsArr,
    D: {
      all: {
        resp: respondieron, rate: rate, topics: topicsArr,
        ig: igCount, igR: igR, mc: mcCount, mR: mR,
        tool: toolCount, tR: tR,
        eng: { alto: engEntry(engCounts.alto), medio: engEntry(engCounts.medio), bajo: engEntry(engCounts.bajo), minimo: engEntry(engCounts.minimo) },
        hours: hourlyAll,
        tpl: tplPerf,
        bcast: bcastPerf,
      },
      real: {
        resp: realesCount, rate: rateReal, topics: topicsArr,
        ig: igCount, igR: respondieron > 0 ? ((igCount / realesCount) * 100).toFixed(1) + "%" : "0%",
        mc: mcCount, mR: realesCount > 0 ? ((mcCount / realesCount) * 100).toFixed(1) + "%" : "0%",
        tool: toolCount, tR: realesCount > 0 ? ((toolCount / realesCount) * 100).toFixed(1) + "%" : "0%",
        eng: { alto: engEntry(engCounts.alto), medio: engEntry(engCounts.medio), bajo: engEntry(engCounts.bajo), minimo: engEntry(engCounts.minimo) },
        hours: hourlyReal,
        tpl: tplPerf,
        bcast: bcastPerf,
      },
    },
    funnelAll: funnelAll,
    funnelReal: funnelReal,
    chBench: chBench,
    daily: dailyArr,
    bTable: bTable,
    meetByTpl: meetByTpl,
    totalContactados: totalContactados,
    leadsPerDay: leadsPerDay,
    dateRange: dateRange,
    autoReplyCount: autoReplyThreads,
    realesCount: realesCount,
    esRate: esRate,
    esResp: esResp,
    esTotal: esTotal,
    ptRate: ptRate,
    ptResp: ptResp,
    ptTotal: ptTotal,
  };
}
