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

export function parseTemplateName(name) {
  if (!name) return null;
  // New qualified format: calificados_d0__v1, no_calificado_d0__v1_br (double underscore before version)
  var m = name.match(/^(no_calificado|calificados?)_d(\d+)_{1,2}v(\d+)(_br)?$/i);
  if (m) {
    var qual = m[1].toLowerCase();
    if (qual === "calificados") qual = "calificado";
    return { qualification: qual, day: parseInt(m[2]), version: parseInt(m[3]), region: m[4] ? "br" : "es", raw: name };
  }
  // msg_1_yago_sdr format: msg_1_yago_sdr_1, msg_1_yago_sdr_br_1
  var m2 = name.match(/^msg_(\d+)_yago_sdr(?:_(br))?(?:_(\d+))?$/i);
  if (m2) {
    var msgNum = parseInt(m2[1]);
    var dayMap = {1:0, 2:1, 3:3, 4:5};
    return { qualification: "msg", day: dayMap[msgNum] !== undefined ? dayMap[msgNum] : msgNum - 1, version: m2[3] ? parseInt(m2[3]) : 1, region: m2[2] ? "br" : "es", raw: name };
  }
  // Pattern 3: es_*/pt_* format — es_quick_audit_offer_2_d5, pt_caso_de_xito_
  var m3 = name.match(/^(es|pt)_(.+?)(?:_d(\d+))?_?$/i);
  if (m3) {
    var region3 = m3[1].toLowerCase() === "pt" ? "br" : "es";
    var body = m3[2];
    var day3 = m3[3] ? parseInt(m3[3]) : 0;
    // Extract version if body ends with _N
    var version3 = 1;
    var vm = body.match(/^(.+?)_(\d+)$/);
    if (vm) { body = vm[1]; version3 = parseInt(vm[2]); }
    return { qualification: body, day: day3, version: version3, region: region3, raw: name };
  }
  return null;
}

var STEP_DAY_MAP = {1:"D+0", 2:"D+1", 3:"D+3", 4:"D+5"};
export function stepToDay(stepOrder) {
  return STEP_DAY_MAP[stepOrder] || "D+?";
}

var HUMANIZE_MAP = {
  "msg_1_yago_sdr": "Yago SDR (ES)",
  "msg_1_yago_sdr_1": "Yago SDR v2 (ES)",
  "msg_1_yago_sdr_br_1": "Yago SDR v2 (PT)",
  "calificados_d0__v1": "Calificados v1 (ES)",
  "calificados_d0__v3": "Calificados v3 (ES)",
  "es_event_sin_whatsapp_d1": "Sin WhatsApp (ES)",
  "pt_event_sem_whatsapp_d1": "Sem WhatsApp (PT)",
  "es_caso_de_xito": "Caso de \u00C9xito (ES)",
  "pt_caso_de_xito_": "Caso de \u00C9xito (PT)",
  "es_value_nudge_1_d3": "Value Nudge (ES)",
  "pt_value_nudge_1_d3": "Value Nudge (PT)",
  "es_quick_audit_offer_2_d5": "Quick Audit (ES)",
  "pt_quick_audit_offer_2_d5": "Quick Audit (PT)",
};

export function humanizeTemplateName(name) {
  if (!name) return "?";
  if (HUMANIZE_MAP[name]) return HUMANIZE_MAP[name];
  // Fallback: strip es_/pt_ prefix, strip _dN suffix, replace _ with space, title case
  var display = name;
  var lang = "";
  if (/^pt_/i.test(display)) { lang = " (PT)"; display = display.replace(/^pt_/i, ""); }
  else if (/^es_/i.test(display)) { lang = " (ES)"; display = display.replace(/^es_/i, ""); }
  display = display.replace(/_d\d+$/i, "").replace(/_+$/, "");
  display = display.replace(/_/g, " ").replace(/\b\w/g, function(c) { return c.toUpperCase(); });
  return display + lang;
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

export function parseDatetime(str) {
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
  // Fast path: detect from template_name prefix
  for (var i = 0; i < msgs.length; i++) {
    var tn = msgs[i].template_name;
    if (tn) {
      if (tn.startsWith("pt_") || tn.includes("_br")) return "pt";
      if (tn.startsWith("es_")) return "es";
      var parsed = parseTemplateName(tn);
      if (parsed) return parsed.region === "br" ? "pt" : "es";
    }
  }
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

export var TOPIC_KEYWORDS = {
  "Ventas": { e: "\u{1F4CA}", kw: ["ventas", "vender", "vendedor", "factur", "ingreso", "revenue", "sales"] },
  "Soporte": { e: "\u{1F527}", kw: ["soporte", "suporte", "problema", "error", "bug", "no funciona", "não funciona"] },
  "Automatización": { e: "\u{1F916}", kw: ["automatiz", "inteligencia artificial"] },
  "Whatsapp": { e: "\u{1F4AC}", kw: ["whatsapp"] },
  "Precios": { e: "\u{1F4B0}", kw: ["precio", "preço", "costo", "cuánto cuesta", "quanto custa", "tarifa", "mensualidad"] },
  "Configuración": { e: "\u2699\uFE0F", kw: ["configurar", "conectar", "integrar", "instalar", "setup", "vincular"] },
};

function detectLangFromContent(msgs) {
  var ptIndicators = ["obrigado", "olá", "você", "preciso", "tenho", "quero", "posso", "vocês", "não", "sim", "bom dia", "boa tarde"];
  var esIndicators = ["hola", "gracias", "necesito", "tengo", "quiero", "puedo", "ustedes", "buenos días", "buenas tardes", "por favor"];
  var ptScore = 0, esScore = 0;
  for (var i = 0; i < msgs.length; i++) {
    var content = (msgs[i].message_content || "").toLowerCase();
    if (!content) continue;
    for (var j = 0; j < ptIndicators.length; j++) {
      if (content.includes(ptIndicators[j])) ptScore++;
    }
    for (var k = 0; k < esIndicators.length; k++) {
      if (content.includes(esIndicators[k])) esScore++;
    }
  }
  return ptScore > esScore ? "pt" : "es";
}

export function processInboundRows(rows, regionFilter, lifecyclePhones) {
  // Group by thread_id
  var threads = {};
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    var tid = r.thread_id;
    if (!tid) continue;
    if (!threads[tid]) threads[tid] = [];
    threads[tid].push(r);
  }

  // Inbound = thread where the first message was sent by the lead (human)
  // Use original row order (preserves LangGraph message order, no sort needed)
  var threadIds = [];
  var allTids = Object.keys(threads);
  for (var ti = 0; ti < allTids.length; ti++) {
    var tid0 = allTids[ti];
    var msgs0 = threads[tid0];
    // First row's message_type reflects the first message in the conversation
    var firstType = msgs0[0] ? msgs0[0].message_type : null;
    if (firstType === "human") threadIds.push(tid0);
  }

  // Unique inbound phones
  var inboundPhones = {};
  for (var ip = 0; ip < threadIds.length; ip++) {
    var ipMsgs = threads[threadIds[ip]];
    for (var ipi = 0; ipi < ipMsgs.length; ipi++) {
      if (ipMsgs[ipi].phone_number) { inboundPhones[ipMsgs[ipi].phone_number] = true; break; }
    }
  }
  var inboundPhoneKeys = Object.keys(inboundPhones);
  var totalConversaciones = threadIds.length;

  var meetings = [];
  var dailyMap = {};
  var hourlyAll = new Array(24).fill(0);
  var topicCounts = {};
  var depthCounts = { rebote: 0, corta: 0, media: 0, profunda: 0 };
  var igCount = 0, igLinkCount = 0, igAtOnlyCount = 0;
  var toolCount = 0, mcCount = 0;
  var autoReplyThreads = 0;
  var esTotal = 0, esResp = 0, ptTotal = 0, ptResp = 0;
  var multiDayCount = 0;
  var outcomeCount = 0;
  var topicOutcomes = {};
  var topicDepth = {};
  var engagedMsgSum = 0, engagedCount = 0;
  var signupCount = 0;
  var signupLinkCount = 0;

  for (var t = 0; t < threadIds.length; t++) {
    var tid2 = threadIds[t];
    var msgs = threads[tid2];
    var phone = null;
    var conversation = [];
    var humanMsgCount = 0;
    var wordCount = 0;
    var hasIgLink = false;
    var hasIgAt = false;
    var hasTool = false;
    var hasMeetingLink = false;
    var isAuto = false;
    var firstHumanSeen = false;
    var firstHumanDate = null;
    var lastHumanDate = null;
    var hasSignupLink = false;

    for (var mi = 0; mi < msgs.length; mi++) {
      if (msgs[mi].phone_number) phone = msgs[mi].phone_number;
    }

    var lang = detectLangFromContent(msgs);
    if (regionFilter && regionFilter !== "all") {
      if (regionFilter === "es" && lang !== "es") continue;
      if (regionFilter === "pt" && lang !== "pt") continue;
    }
    var isES = lang === "es";
    if (isES) esTotal++; else ptTotal++;

    msgs.sort(function (a, b) {
      var da = a.message_datetime || "";
      var db = b.message_datetime || "";
      return da.localeCompare(db);
    });

    for (var mi2 = 0; mi2 < msgs.length; mi2++) {
      var msg = msgs[mi2];
      var content = msg.message_content || "";
      var type = msg.message_type;
      var dt = formatDatetime(msg.message_datetime);

      if (content.includes("meetings.hubspot.com/")) hasMeetingLink = true;

      if (type === "ai") {
        if (/yavendio\.com|yavendió\.com|crear\s+(?:tu\s+)?cuenta|criar\s+(?:sua\s+)?conta|crea\s+una\s+cuenta|registr(?:ar|ate|o)/i.test(content)) hasSignupLink = true;
        conversation.push([2, content, dt]);
      } else if (type === "human") {
        humanMsgCount++;
        var words = content.trim().split(/\s+/).filter(function (w) { return w.length > 0; });
        wordCount += words.length;

        if (!firstHumanSeen) {
          firstHumanSeen = true;
          if (isAutoReply(content)) isAuto = true;
        }

        if (/instagram\.com/i.test(content)) hasIgLink = true;
        if (/@\w+|ig\s*:/i.test(content)) hasIgAt = true;

        var pd = parseDatetime(msg.message_datetime);
        if (pd && !isNaN(pd.getTime())) {
          hourlyAll[pd.getHours()]++;
          if (!firstHumanDate) firstHumanDate = pd;
          lastHumanDate = pd;
        }

        conversation.push([1, content, dt]);
      } else if (type === "tool") {
        hasTool = true;
      }
    }

    var sentAt = msgs[0] && (msgs[0].template_sent_at || msgs[0].message_datetime);
    if (sentAt) {
      var pd2 = parseDatetime(sentAt);
      if (pd2 && !isNaN(pd2.getTime())) {
        var dayKey = String(pd2.getDate()).padStart(2, "0") + "/" + String(pd2.getMonth() + 1).padStart(2, "0");
        if (!dailyMap[dayKey]) dailyMap[dayKey] = 0;
        dailyMap[dayKey]++;
      }
    }

    if (isAuto && humanMsgCount > 1) isAuto = false;

    // Depth classification
    var depth = "rebote";
    if (humanMsgCount >= 10) depth = "profunda";
    else if (humanMsgCount >= 5) depth = "media";
    else if (humanMsgCount >= 2) depth = "corta";

    // Multi-day detection
    var isMultiDay = false;
    if (firstHumanDate && lastHumanDate) {
      var dayDiff = (lastHumanDate.getTime() - firstHumanDate.getTime()) / (1000 * 60 * 60 * 24);
      if (dayDiff >= 1) isMultiDay = true;
    }

    // Outcome detection
    var hasIg = hasIgLink || hasIgAt;
    var hasOutcome = hasTool || hasIg || hasMeetingLink;

    // For inbound, gate on humanMsgCount (lead initiated), not phone
    if (humanMsgCount > 0) {
      var displayId = phone || tid2;
      if (isES) esResp++; else ptResp++;
      depthCounts[depth]++;
      if (hasIgLink) { igLinkCount++; igCount++; }
      else if (hasIgAt) { igAtOnlyCount++; igCount++; }
      if (hasTool) toolCount++;
      if (isAuto) autoReplyThreads++;
      if (hasMeetingLink) mcCount++;
      if (isMultiDay) multiDayCount++;
      if (hasOutcome) outcomeCount++;
      var lcInfo = lifecyclePhones && phone ? lifecyclePhones[phone] : null;
      if (lcInfo && lcInfo.firstStep1At) signupCount++;
      if (hasSignupLink) signupLinkCount++;

      if (humanMsgCount >= 2) {
        engagedMsgSum += humanMsgCount;
        engagedCount++;
      }

      var convText = "";
      for (var ci = 0; ci < conversation.length; ci++) {
        if (conversation[ci][0] === 1) {
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

            if (!topicOutcomes[topicName]) topicOutcomes[topicName] = { total: 0, withOutcome: 0 };
            topicOutcomes[topicName].total++;
            if (hasOutcome) topicOutcomes[topicName].withOutcome++;

            if (!topicDepth[topicName]) topicDepth[topicName] = { rebote: 0, corta: 0, media: 0, profunda: 0 };
            topicDepth[topicName][depth]++;
            break;
          }
        }
      }

      meetings.push({
        p: displayId,
        ms: humanMsgCount,
        w: wordCount,
        au: isAuto,
        e: depth,
        q: "",
        co: getCountryFlag(phone),
        tr: [],
        fr: null,
        c: conversation,
        ml: hasMeetingLink,
        lang: lang,
        signup: !!(lcInfo && lcInfo.firstStep1At),
        signupLink: hasSignupLink,
      });
    }
  }

  // Build metrics
  var respondieron = meetings.length;
  var realesCount = meetings.filter(function (m) { return !m.au; }).length;
  var engagedTotal = depthCounts.corta + depthCounts.media + depthCounts.profunda;
  var avgDepth = engagedCount > 0 ? parseFloat((engagedMsgSum / engagedCount).toFixed(1)) : 0;

  // Unique inbound leads = count of inbound phones
  var uniqueLeadCount = inboundPhoneKeys.length;
  var rate = totalConversaciones > 0 ? ((respondieron / totalConversaciones) * 100).toFixed(1) + "%" : "0%";

  var igR = respondieron > 0 ? ((igCount / respondieron) * 100).toFixed(1) + "%" : "0%";
  var igLinkR = respondieron > 0 ? ((igLinkCount / respondieron) * 100).toFixed(1) + "%" : "0%";
  var igAtOnlyR = respondieron > 0 ? ((igAtOnlyCount / respondieron) * 100).toFixed(1) + "%" : "0%";
  var tR = respondieron > 0 ? ((toolCount / respondieron) * 100).toFixed(1) + "%" : "0%";
  var mR = respondieron > 0 ? ((mcCount / respondieron) * 100).toFixed(1) + "%" : "0%";

  var topicsArr = [];
  for (var tn in topicCounts) {
    var cnt = topicCounts[tn];
    var def = TOPIC_KEYWORDS[tn];
    var to = topicOutcomes[tn] || { total: 0, withOutcome: 0 };
    topicsArr.push({
      t: tn, e: def.e, n: cnt,
      p: respondieron > 0 ? parseFloat(((cnt / respondieron) * 100).toFixed(1)) : 0,
      outcomeN: to.withOutcome,
      outcomeP: to.total > 0 ? parseFloat(((to.withOutcome / to.total) * 100).toFixed(1)) : 0,
    });
  }
  topicsArr.sort(function (a, b) { return b.n - a.n; });

  function depthEntry(val, total) {
    var tt = total || respondieron;
    return { v: val, p: tt > 0 ? ((val / tt) * 100).toFixed(1) + "%" : "0%" };
  }

  // Daily sorted
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

  var dateRange = "";
  if (dailyKeys.length > 0) {
    dateRange = dailyKeys[0] + " \u2013 " + dailyKeys[dailyKeys.length - 1];
  }

  // Funnel adapted for inbound
  var CC = {
    accent: "#2563EB", purple: "#7C3AED", green: "#059669",
    orange: "#EA580C", pink: "#EC4899", cyan: "#0891B2",
  };
  // signupCount/signupLinkCount are per-thread — deduplicate to phone level for funnel
  var signupPhoneMap = {};
  var linkPhoneMap = {};
  for (var si = 0; si < meetings.length; si++) {
    if (meetings[si].signup) signupPhoneMap[meetings[si].p] = true;
    if (meetings[si].signupLink) linkPhoneMap[meetings[si].p] = true;
  }
  var signupUniqueCount = Object.keys(signupPhoneMap).length;
  var linkUniqueCount = Object.keys(linkPhoneMap).length;

  var funnelAll = [
    { n: "Leads Inbound", v: uniqueLeadCount, c: CC.accent },
    { n: "Engajaron (2+)", v: engagedTotal, c: CC.purple },
    { n: "Link Crear Cuenta", v: linkUniqueCount, c: CC.cyan },
    { n: "Recibieron Step 1", v: signupUniqueCount, c: CC.green },
  ];

  // Empty benchmark and template arrays (not applicable to inbound)
  var chBench = [];
  var bTable = [];

  var avgMsgs = respondieron > 0 ? (meetings.reduce(function (s, m) { return s + m.ms; }, 0) / respondieron).toFixed(1) : "0";

  var esRate = esTotal > 0 ? ((esResp / esTotal) * 100).toFixed(1) : "0.0";
  var ptRate = ptTotal > 0 ? ((ptResp / ptTotal) * 100).toFixed(1) : "0.0";

  var leadsPerDay = dailyArr.length > 0 ? Math.round(totalConversaciones / dailyArr.length) : 0;

  return {
    rawRows: rows,
    MEETINGS: meetings,
    topicsAll: topicsArr,
    allTemplateNames: [],
    tplStepInfo: {},
    D: {
      all: {
        resp: respondieron, rate: rate, topics: topicsArr,
        ig: igCount, igR: igR, igLink: igLinkCount, igLinkR: igLinkR, igAt: igAtOnlyCount, igAtR: igAtOnlyR, mc: mcCount, mR: mR,
        tool: toolCount, tR: tR,
        eng: { profunda: depthEntry(depthCounts.profunda), media: depthEntry(depthCounts.media), corta: depthEntry(depthCounts.corta), rebote: depthEntry(depthCounts.rebote) },
        hours: hourlyAll,
        tpl: [],
        bcast: [],
        tplByStep: null,
      },
      real: {
        resp: respondieron, rate: rate, topics: topicsArr,
        ig: igCount, igR: igR, igLink: igLinkCount, igLinkR: igLinkR, igAt: igAtOnlyCount, igAtR: igAtOnlyR, mc: mcCount, mR: mR,
        tool: toolCount, tR: tR,
        eng: { profunda: depthEntry(depthCounts.profunda), media: depthEntry(depthCounts.media), corta: depthEntry(depthCounts.corta), rebote: depthEntry(depthCounts.rebote) },
        hours: hourlyAll,
        tpl: [],
        bcast: [],
        tplByStep: null,
      },
    },
    funnelAll: funnelAll,
    funnelReal: funnelAll,
    chBench: chBench,
    daily: dailyArr,
    bTable: bTable,
    meetByTplAll: [],
    meetByTplReal: [],
    totalContactados: totalConversaciones,
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
    depthCounts: depthCounts,
    multiDayCount: multiDayCount,
    outcomeCount: outcomeCount,
    topicOutcomes: topicOutcomes,
    topicDepth: topicDepth,
    avgDepth: avgDepth,
    engagedTotal: engagedTotal,
    uniqueLeadCount: uniqueLeadCount,
    signupCount: signupUniqueCount,
    signupLinkCount: linkUniqueCount,
  };
}

export function processCSVRows(rows, templateConfig, regionFilter) {
  var CATEGORY_META = {
    d0: { day: "D+0", label: "Contacto Inicial", color: "#2563EB", order: 1 },
    d1: { day: "D+1", label: "Seguimiento", color: "#7C3AED", order: 2 },
    d3: { day: "D+3", label: "Value Nudge", color: "#0891B2", order: 3 },
    d5: { day: "D+5", label: "Quick Audit", color: "#EA580C", order: 4 },
    automatico: { day: "Auto", label: "Automáticos", color: "#6B7280", order: 90 },
    campanha: { day: "Camp", label: "Campañas", color: "#D97706", order: 91 },
    sin_categoria: { day: "—", label: "Sin categoría", color: "#9CA3AF", order: 99 },
  };
  var EXCLUDED_CATEGORIES = { automatico: true, campanha: true };

  var tplConfig = templateConfig || {};
  function getCategory(tplName) {
    var cfg = tplConfig[tplName];
    if (!cfg) return "sin_categoria";
    if (typeof cfg === "string") return cfg; // backward compat
    return cfg.category || "sin_categoria";
  }
  function getRegion(tplName) {
    var cfg = tplConfig[tplName];
    if (!cfg || typeof cfg === "string") return "";
    return cfg.region || "";
  }
  function isExcluded(tplName) {
    return EXCLUDED_CATEGORIES[getCategory(tplName)] === true;
  }

  // Group by thread_id
  var threads = {};
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    var tid = r.thread_id;
    if (!tid) continue;
    if (!threads[tid]) threads[tid] = [];
    threads[tid].push(r);
  }

  // Only count threads that received MSG1 (or a d0 template_name or step_order=1) as "contactados"
  // Threads where ALL templates are excluded (automatico/campanha) are not counted
  var threadIds = Object.keys(threads).filter(function (tid) {
    var msgs = threads[tid];
    for (var i = 0; i < msgs.length; i++) {
      // Skip excluded templates
      if (msgs[i].template_name && isExcluded(msgs[i].template_name)) continue;

      // step_order === 1 means first contact
      if (msgs[i].step_order && parseInt(msgs[i].step_order) === 1) return true;
      // New format: template_name with day 0
      if (msgs[i].template_name) {
        var parsed = parseTemplateName(msgs[i].template_name);
        if (parsed && parsed.day === 0) return true;
      }
      // Legacy format: detect MSG1 from content
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
  var allTemplatesResp = {}; // templates where thread responded (non-excluded)
  var allTemplatesRespExcluded = {}; // responses to excluded templates (for display only)
  var dailyMap = {};
  var hourlyAll = new Array(24).fill(0);
  var topicCounts = {};
  var engCounts = { alto: 0, medio: 0, bajo: 0, minimo: 0 };
  var igCount = 0;
  var igLinkCount = 0;
  var igAtOnlyCount = 0;
  var toolCount = 0;
  var mcCount = 0;
  var autoReplyThreads = 0;
  var esTotal = 0, esResp = 0, ptTotal = 0, ptResp = 0;

  // Real (non-auto-reply) counters
  var engCountsReal = { alto: 0, medio: 0, bajo: 0, minimo: 0 };
  var topicCountsReal = {};
  var hourlyReal = new Array(24).fill(0);
  var allTemplatesRespReal = {};
  var igCountReal = 0, igLinkCountReal = 0, igAtOnlyCountReal = 0;
  var toolCountReal = 0, mcCountReal = 0;

  var templateContents = {};

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
    var hasIgLink = false;
    var hasIgAt = false;
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
    if (regionFilter && regionFilter !== "all") {
      if (regionFilter === "es" && lang !== "es") continue;
      if (regionFilter === "pt" && lang !== "pt") continue;
    }
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

      // Check for HubSpot meeting link in any message type
      if (content.includes("meetings.hubspot.com/")) hasMeetingLink = true;

      if (type === "ai") {
        if (isTemplate(content) || msg.template_name) {
          // Use template_name from CSV row if available, otherwise classify from content
          var tplName = msg.template_name || classifyTemplate(content);
          if (tplName) {
            templatesSent.push(tplName);
            conversation.push([0, tplName, dt]);
            if (!templateContents[tplName]) templateContents[tplName] = content;
          }
        } else {
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

        // Check for Instagram link vs @ mention
        if (/instagram\.com/i.test(content)) hasIgLink = true;
        if (/@\w+|ig\s*:/i.test(content)) hasIgAt = true;

        // Track hour of response
        var pd = parseDatetime(msg.message_datetime);
        if (pd && !isNaN(pd.getTime())) {
          hourlyAll[pd.getHours()]++;
          if (!isAuto) hourlyReal[pd.getHours()]++;
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
      if (!isExcluded(triggerTpl)) {
        if (!allTemplatesResp[triggerTpl]) allTemplatesResp[triggerTpl] = 0;
        allTemplatesResp[triggerTpl]++;
      } else {
        if (!allTemplatesRespExcluded[triggerTpl]) allTemplatesRespExcluded[triggerTpl] = 0;
        allTemplatesRespExcluded[triggerTpl]++;
      }

      if (isES) esResp++; else ptResp++;
    }

    // If first message was auto-reply but there were more human interactions,
    // treat as real lead (the person engaged beyond the auto-reply)
    if (isAuto && humanMsgCount > 1) isAuto = false;

    // Engagement based on qualification
    var engagement = "minimo";
    if (qual === "Alta") engagement = "alto";
    else if (qual === "Média" || qual === "Media") engagement = "medio";
    else if (qual === "Baixa" || qual === "Baja") engagement = "bajo";
    else if (phone) engagement = "minimo";

    if (phone) {
      engCounts[engagement]++;
      if (hasIgLink) { igLinkCount++; igCount++; }
      else if (hasIgAt) { igAtOnlyCount++; igCount++; }
      if (hasTool) toolCount++;
      if (isAuto) autoReplyThreads++;

      // Real counters (non-auto-reply)
      if (!isAuto) {
        engCountsReal[engagement]++;
        if (hasIgLink) { igLinkCountReal++; igCountReal++; }
        else if (hasIgAt) { igAtOnlyCountReal++; igCountReal++; }
        if (hasTool) toolCountReal++;
        if (hasMeetingLink) mcCountReal++;
        if (firstResponseTpl) {
          if (!allTemplatesRespReal[firstResponseTpl]) allTemplatesRespReal[firstResponseTpl] = 0;
          allTemplatesRespReal[firstResponseTpl]++;
        }
      }

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
            if (!isAuto) {
              if (!topicCountsReal[topicName]) topicCountsReal[topicName] = 0;
              topicCountsReal[topicName]++;
            }
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
        q: qual,
        co: getCountryFlag(phone),
        tr: templatesSent.filter(function (v, i, a) { return a.indexOf(v) === i; }),
        fr: firstResponseTpl,
        c: conversation,
        ml: hasMeetingLink,
      });
    }
  }

  // Build metrics
  var respondieron = meetings.length;
  var realesCount = meetings.filter(function (m) { return !m.au; }).length;
  var rate = totalContactados > 0 ? ((respondieron / totalContactados) * 100).toFixed(1) + "%" : "0%";
  var rateReal = totalContactados > 0 ? ((realesCount / totalContactados) * 100).toFixed(1) + "%" : "0%";

  var igR = respondieron > 0 ? ((igCount / respondieron) * 100).toFixed(1) + "%" : "0%";
  var igLinkR = respondieron > 0 ? ((igLinkCount / respondieron) * 100).toFixed(1) + "%" : "0%";
  var igAtOnlyR = respondieron > 0 ? ((igAtOnlyCount / respondieron) * 100).toFixed(1) + "%" : "0%";
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
  function engEntry(val, total) {
    var t = total || respondieron;
    return { v: val, p: t > 0 ? ((val / t) * 100).toFixed(1) + "%" : "0%" };
  }

  // Real topics sorted
  var topicsArrReal = [];
  for (var tnr in topicCountsReal) {
    var cntr = topicCountsReal[tnr];
    var defr = TOPIC_KEYWORDS[tnr];
    topicsArrReal.push({ t: tnr, e: defr.e, n: cntr, p: realesCount > 0 ? parseFloat(((cntr / realesCount) * 100).toFixed(1)) : 0 });
  }
  topicsArrReal.sort(function (a, b) { return b.n - a.n; });

  // Real rates
  var igRReal = realesCount > 0 ? ((igCountReal / realesCount) * 100).toFixed(1) + "%" : "0%";
  var igLinkRReal = realesCount > 0 ? ((igLinkCountReal / realesCount) * 100).toFixed(1) + "%" : "0%";
  var igAtOnlyRReal = realesCount > 0 ? ((igAtOnlyCountReal / realesCount) * 100).toFixed(1) + "%" : "0%";
  var tRReal = realesCount > 0 ? ((toolCountReal / realesCount) * 100).toFixed(1) + "%" : "0%";
  var mRReal = realesCount > 0 ? ((mcCountReal / realesCount) * 100).toFixed(1) + "%" : "0%";

  // Template performance — supports both legacy (MSG1, MSG2a...) and new format (calificados_d0_v1...)
  var tplNamesMap = { MSG1: "MSG 1 \u2014 Yago SDR", MSG2a: "MSG 2a \u2014 Sin WA", MSG2b: "MSG 2b \u2014 Caso de \u00C9xito", MSG3: "MSG 3 \u2014 Value Nudge", MSG4: "MSG 4 \u2014 Quick Audit" };
  var tplDaysMap = { MSG1: "D+0", MSG2a: "D+1", MSG2b: "D+1", MSG3: "D+3", MSG4: "D+5" };
  var legacyOrder = ["MSG1", "MSG2a", "MSG2b", "MSG3", "MSG4"];
  var bcastOrder = ["MSG2c"];

  // Detect step_order in data
  var threadStepMap = {};
  var threadTemplateMap = {};
  var hasStepOrder = false;
  for (var si = 0; si < rows.length; si++) {
    var sr = rows[si];
    if (sr.step_order && sr.thread_id) {
      var so = parseInt(sr.step_order);
      if (!isNaN(so) && so >= 1) {
        hasStepOrder = true;
        threadStepMap[sr.thread_id] = so;
      }
    }
    if (sr.template_name && sr.thread_id) {
      threadTemplateMap[sr.thread_id] = sr.template_name;
    }
  }

  // Detect if we have new-format template names
  var allSentKeys = Object.keys(allTemplatesSent);
  var hasNewFormat = allSentKeys.some(function (k) { return parseTemplateName(k) !== null; });

  var tplPerf = [];
  var tplPerfReal = [];
  var bcastPerf = [];
  var bcastPerfReal = [];
  var stepGroupsAll = null;
  var stepGroupsReal = null;

  var STEP_LABELS = {1:"Contacto Inicial",2:"Seguimiento",3:"Value Nudge",4:"Quick Audit"};
  var STEP_COLORS = {1:"#2563EB",2:"#7C3AED",3:"#0891B2",4:"#EA580C"};

  // Collect per-template step info (needed by both tplByStep and meetByTpl)
  var tplStepInfo = {};
  if (hasStepOrder) {
    for (var tsi = 0; tsi < rows.length; tsi++) {
      var tsr = rows[tsi];
      if (tsr.template_name && tsr.step_order) {
        tplStepInfo[tsr.template_name] = parseInt(tsr.step_order);
      }
    }
  }

  // Determine if we have templateConfig categories configured
  var hasTemplateConfig = Object.keys(tplConfig).length > 0;

  if (hasStepOrder || hasTemplateConfig) {
    function buildStepGroups(sentMap, respMap, respExcludedMap) {
      var groups = {};
      var tplNames = Object.keys(sentMap);
      for (var ti = 0; ti < tplNames.length; ti++) {
        var tName = tplNames[ti];
        var cat;
        if (hasTemplateConfig) {
          cat = getCategory(tName);
        } else {
          // Fallback to step_order based category
          var step = tplStepInfo[tName];
          if (!step) continue;
          var stepCatMap = {1:"d0",2:"d1",3:"d3",4:"d5"};
          cat = stepCatMap[step] || "sin_categoria";
        }
        var meta = CATEGORY_META[cat];
        if (!meta) continue;
        if (!groups[cat]) {
          groups[cat] = {
            day: meta.day, label: meta.label, color: meta.color,
            order: meta.order, templates: [], totalSent: 0, totalResp: 0
          };
        }
        var s = sentMap[tName] || 0;
        // For excluded categories, use respExcludedMap; for others, use respMap
        var r = (EXCLUDED_CATEGORIES[cat] ? (respExcludedMap[tName] || 0) : (respMap[tName] || 0));
        var lang = "es";
        if (tName.startsWith("pt_") || tName.includes("_br")) lang = "pt";
        groups[cat].templates.push({
          name: tName, displayName: tName, lang: lang,
          region: getRegion(tName),
          sent: s, resp: r, rate: s > 0 ? ((r / s) * 100).toFixed(1) + "%" : "0%"
        });
        groups[cat].totalSent += s;
        groups[cat].totalResp += r;
      }
      // Sort by order and compute totalRate
      var catKeys = Object.keys(groups).sort(function(a,b){
        return (groups[a].order || 99) - (groups[b].order || 99);
      });
      var result = {};
      for (var ci = 0; ci < catKeys.length; ci++) {
        var ck = catKeys[ci];
        var sg = groups[ck];
        sg.totalRate = sg.totalSent > 0 ? ((sg.totalResp / sg.totalSent) * 100).toFixed(1) + "%" : "0%";
        sg.templates.sort(function(a,b){return b.sent - a.sent;});
        result[ck] = sg;
      }
      return result;
    }

    stepGroupsAll = buildStepGroups(allTemplatesSent, allTemplatesResp, allTemplatesRespExcluded);
    stepGroupsReal = buildStepGroups(allTemplatesSent, allTemplatesRespReal, allTemplatesRespExcluded);

    // Also build flat tplPerf for compatibility with compare mode
    var stepSorted = Object.keys(tplStepInfo).sort(function(a,b){
      var sa = tplStepInfo[a] || 99, sb = tplStepInfo[b] || 99;
      if (sa !== sb) return sa - sb;
      return a.localeCompare(b);
    });
    for (var fi = 0; fi < stepSorted.length; fi++) {
      var fk = stepSorted[fi];
      var fsent = allTemplatesSent[fk] || 0;
      if (fsent === 0) continue;
      var fresp = allTemplatesResp[fk] || 0;
      var frrespReal = allTemplatesRespReal[fk] || 0;
      var fstep = tplStepInfo[fk];
      tplPerf.push({ name: fk, day: stepToDay(fstep), sent: fsent, resp: fresp, rate: fsent > 0 ? ((fresp / fsent) * 100).toFixed(1) + "%" : "0%", key: fk, content: templateContents[fk] || null });
      tplPerfReal.push({ name: fk, day: stepToDay(fstep), sent: fsent, resp: frrespReal, rate: fsent > 0 ? ((frrespReal / fsent) * 100).toFixed(1) + "%" : "0%", key: fk, content: templateContents[fk] || null });
    }
  } else if (hasNewFormat) {
    // New format: sort by day then by name
    var newKeys = allSentKeys.filter(function (k) { return parseTemplateName(k) !== null; });
    newKeys.sort(function (a, b) {
      var pa = parseTemplateName(a), pb = parseTemplateName(b);
      if (pa.day !== pb.day) return pa.day - pb.day;
      return a.localeCompare(b);
    });
    for (var ni = 0; ni < newKeys.length; ni++) {
      var nk = newKeys[ni];
      var np = parseTemplateName(nk);
      var nsent = allTemplatesSent[nk] || 0;
      var nresp = allTemplatesResp[nk] || 0;
      var nrrespReal = allTemplatesRespReal[nk] || 0;
      tplPerf.push({ name: nk, day: "D+" + np.day, sent: nsent, resp: nresp, rate: nsent > 0 ? ((nresp / nsent) * 100).toFixed(1) + "%" : "0%", key: nk, content: templateContents[nk] || null });
      tplPerfReal.push({ name: nk, day: "D+" + np.day, sent: nsent, resp: nrrespReal, rate: nsent > 0 ? ((nrrespReal / nsent) * 100).toFixed(1) + "%" : "0%", key: nk, content: templateContents[nk] || null });
    }
    // Also include any legacy templates that may exist in the same import
    for (var li = 0; li < legacyOrder.length; li++) {
      var lk = legacyOrder[li];
      if (allTemplatesSent[lk]) {
        var lsent = allTemplatesSent[lk] || 0;
        var lresp = allTemplatesResp[lk] || 0;
        var lrrespReal = allTemplatesRespReal[lk] || 0;
        tplPerf.push({ name: tplNamesMap[lk] || lk, day: tplDaysMap[lk] || "", sent: lsent, resp: lresp, rate: lsent > 0 ? ((lresp / lsent) * 100).toFixed(1) + "%" : "0%", key: lk, content: templateContents[lk] || null });
        tplPerfReal.push({ name: tplNamesMap[lk] || lk, day: tplDaysMap[lk] || "", sent: lsent, resp: lrrespReal, rate: lsent > 0 ? ((lrrespReal / lsent) * 100).toFixed(1) + "%" : "0%", key: lk, content: templateContents[lk] || null });
      }
    }
  } else {
    // Legacy format
    for (var ti = 0; ti < legacyOrder.length; ti++) {
      var key = legacyOrder[ti];
      var sent = allTemplatesSent[key] || 0;
      var resp = allTemplatesResp[key] || 0;
      tplPerf.push({ name: tplNamesMap[key] || key, day: tplDaysMap[key] || "", sent: sent, resp: resp, rate: sent > 0 ? ((resp / sent) * 100).toFixed(1) + "%" : "0%", key: key, content: templateContents[key] || null });
    }
    for (var tri = 0; tri < legacyOrder.length; tri++) {
      var rkey = legacyOrder[tri];
      var rsent = allTemplatesSent[rkey] || 0;
      var rresp = allTemplatesRespReal[rkey] || 0;
      tplPerfReal.push({ name: tplNamesMap[rkey] || rkey, day: tplDaysMap[rkey] || "", sent: rsent, resp: rresp, rate: rsent > 0 ? ((rresp / rsent) * 100).toFixed(1) + "%" : "0%", key: rkey, content: templateContents[rkey] || null });
    }
  }

  for (var bi = 0; bi < bcastOrder.length; bi++) {
    var bkey = bcastOrder[bi];
    var bsent = allTemplatesSent[bkey] || 0;
    var bresp = allTemplatesResp[bkey] || 0;
    if (bsent > 0) {
      bcastPerf.push({ name: "Emprende Show", day: "Bcast", sent: bsent, resp: bresp, rate: bsent > 0 ? ((bresp / bsent) * 100).toFixed(1) + "%" : "0%", key: bkey, content: templateContents[bkey] || null });
    }
  }
  for (var bri = 0; bri < bcastOrder.length; bri++) {
    var brkey = bcastOrder[bri];
    var brsent = allTemplatesSent[brkey] || 0;
    var brresp = allTemplatesRespReal[brkey] || 0;
    if (brsent > 0) {
      bcastPerfReal.push({ name: "Emprende Show", day: "Bcast", sent: brsent, resp: brresp, rate: brsent > 0 ? ((brresp / brsent) * 100).toFixed(1) + "%" : "0%", key: brkey, content: templateContents[brkey] || null });
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
    { n: "Config. Plataf.", v: toolCountReal, c: C.green },
    { n: "Enviaron IG", v: igCountReal, c: C.orange },
    { n: "Oferta Reuni\u00F3n", v: mcCountReal, c: C.pink },
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

  // Meet by template (first response) — All and Real
  var tplColors = { MSG1: C.accent, MSG2a: C.purple, MSG2b: C.purple, MSG2c: "#D97706", MSG3: C.cyan, MSG4: C.orange };
  var meetByTplMapAll = {};
  var meetByTplMapReal = {};
  for (var mi = 0; mi < meetings.length; mi++) {
    var fr = meetings[mi].fr;
    if (fr) {
      if (!meetByTplMapAll[fr]) meetByTplMapAll[fr] = 0;
      meetByTplMapAll[fr]++;
      if (!meetings[mi].au) {
        if (!meetByTplMapReal[fr]) meetByTplMapReal[fr] = 0;
        meetByTplMapReal[fr]++;
      }
    }
  }
  var meetByTplAll = [];
  var meetByTplReal = [];
  // Build dynamic list from all templates that got responses
  var allMeetTpls = Object.keys(meetByTplMapAll);
  var realKeys = Object.keys(meetByTplMapReal);
  for (var rki = 0; rki < realKeys.length; rki++) {
    if (allMeetTpls.indexOf(realKeys[rki]) < 0) allMeetTpls.push(realKeys[rki]);
  }
  function getMeetTplColor(tplName) {
    if (tplColors[tplName]) return tplColors[tplName];
    var step = tplStepInfo ? tplStepInfo[tplName] : null;
    if (step && STEP_COLORS[step]) return STEP_COLORS[step];
    if (tplName.startsWith("pt_")) return C.green;
    if (tplName.startsWith("es_")) return C.accent;
    return C.accent;
  }
  for (var mti = 0; mti < allMeetTpls.length; mti++) {
    var mk2 = allMeetTpls[mti];
    var meetLabel = mk2;
    meetByTplAll.push({ l: meetLabel, v: meetByTplMapAll[mk2] || 0, c: getMeetTplColor(mk2) });
    meetByTplReal.push({ l: meetLabel, v: meetByTplMapReal[mk2] || 0, c: getMeetTplColor(mk2) });
  }
  meetByTplAll.sort(function (a, b) { return b.v - a.v; });
  meetByTplReal.sort(function (a, b) { return b.v - a.v; });

  // ES vs PT stats
  var esRate = esTotal > 0 ? ((esResp / esTotal) * 100).toFixed(1) : "0.0";
  var ptRate = ptTotal > 0 ? ((ptResp / ptTotal) * 100).toFixed(1) : "0.0";

  // Leads per day for header
  var leadsPerDay = dailyArr.length > 0 ? Math.round(totalContactados / dailyArr.length) : 0;

  var useStepGroups = hasStepOrder || hasTemplateConfig;

  return {
    rawRows: rows,
    MEETINGS: meetings,
    topicsAll: topicsArr,
    allTemplateNames: Object.keys(allTemplatesSent),
    tplStepInfo: tplStepInfo,
    D: {
      all: {
        resp: respondieron, rate: rate, topics: topicsArr,
        ig: igCount, igR: igR, igLink: igLinkCount, igLinkR: igLinkR, igAt: igAtOnlyCount, igAtR: igAtOnlyR, mc: mcCount, mR: mR,
        tool: toolCount, tR: tR,
        eng: { alto: engEntry(engCounts.alto), medio: engEntry(engCounts.medio), bajo: engEntry(engCounts.bajo), minimo: engEntry(engCounts.minimo) },
        hours: hourlyAll,
        tpl: tplPerf,
        bcast: bcastPerf,
        tplByStep: useStepGroups ? stepGroupsAll : null,
      },
      real: {
        resp: realesCount, rate: rateReal, topics: topicsArrReal,
        ig: igCountReal, igR: igRReal,
        igLink: igLinkCountReal, igLinkR: igLinkRReal,
        igAt: igAtOnlyCountReal, igAtR: igAtOnlyRReal,
        mc: mcCountReal, mR: mRReal,
        tool: toolCountReal, tR: tRReal,
        eng: { alto: engEntry(engCountsReal.alto, realesCount), medio: engEntry(engCountsReal.medio, realesCount), bajo: engEntry(engCountsReal.bajo, realesCount), minimo: engEntry(engCountsReal.minimo, realesCount) },
        hours: hourlyReal,
        tpl: tplPerfReal,
        bcast: bcastPerfReal,
        tplByStep: useStepGroups ? stepGroupsReal : null,
      },
    },
    funnelAll: funnelAll,
    funnelReal: funnelReal,
    chBench: chBench,
    daily: dailyArr,
    bTable: bTable,
    meetByTplAll: meetByTplAll,
    meetByTplReal: meetByTplReal,
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

