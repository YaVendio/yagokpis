// threadProcessor.js — process pre-computed thread metrics (no message parsing)
// Replaces processCSVRows / processInboundRows from csvParser.js

import { parseTemplateName, stepToDay, parseDatetime, TOPIC_KEYWORDS } from "./csvParser";

var COUNTRY_MAP = {
  "1": "\u{1F1FA}\u{1F1F8}", "34": "\u{1F1EA}\u{1F1F8}", "44": "\u{1F1EC}\u{1F1E7}",
  "49": "\u{1F1E9}\u{1F1EA}", "51": "\u{1F1F5}\u{1F1EA}", "52": "\u{1F1F2}\u{1F1FD}",
  "54": "\u{1F1E6}\u{1F1F7}", "55": "\u{1F1E7}\u{1F1F7}", "56": "\u{1F1E8}\u{1F1F1}",
  "57": "\u{1F1E8}\u{1F1F4}", "58": "\u{1F1FB}\u{1F1EA}", "503": "\u{1F1F8}\u{1F1FB}",
  "505": "\u{1F1F3}\u{1F1EE}", "506": "\u{1F1E8}\u{1F1F7}", "507": "\u{1F1F5}\u{1F1E6}",
  "591": "\u{1F1E7}\u{1F1F4}", "593": "\u{1F1EA}\u{1F1E8}", "595": "\u{1F1F5}\u{1F1FE}",
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

// Bitmask constants matching edge function TOPIC_KEYWORDS flags
var TOPIC_FLAG_MAP = {
  "Ventas": 1, "Soporte": 2, "Automatizaci\u00F3n": 4,
  "Whatsapp": 8, "Precios": 16, "Configuraci\u00F3n": 32,
};

function decodeTopic(flags) {
  var topics = {};
  for (var name in TOPIC_FLAG_MAP) {
    if (flags & TOPIC_FLAG_MAP[name]) topics[name] = true;
  }
  return topics;
}

// --- processOutboundThreads ---

export function processOutboundThreads(threads, templateConfig, regionFilter) {
  var CATEGORY_META = {
    d0: { day: "D+0", label: "Contacto Inicial", color: "#2563EB", order: 1 },
    d1: { day: "D+1", label: "Seguimiento", color: "#7C3AED", order: 2 },
    d3: { day: "D+3", label: "Value Nudge", color: "#0891B2", order: 3 },
    d5: { day: "D+5", label: "Quick Audit", color: "#EA580C", order: 4 },
    automatico: { day: "Auto", label: "Autom\u00E1ticos", color: "#6B7280", order: 90 },
    campanha: { day: "Camp", label: "Campa\u00F1as", color: "#D97706", order: 91 },
    sin_categoria: { day: "\u2014", label: "Sin categor\u00EDa", color: "#9CA3AF", order: 99 },
  };
  var EXCLUDED_CATEGORIES = { automatico: true, campanha: true };
  var tplConfig = templateConfig || {};

  function getCategory(tplName) {
    var cfg = tplConfig[tplName];
    if (!cfg) return "sin_categoria";
    if (typeof cfg === "string") return cfg;
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

  // Group threads by phone_number (replicating expandThreadMessages grouping)
  var phoneGroups = {};
  var phoneOrder = [];
  for (var i = 0; i < threads.length; i++) {
    var t = threads[i];
    var key = t.phone_number || t.thread_id;
    if (!phoneGroups[key]) { phoneGroups[key] = []; phoneOrder.push(key); }
    phoneGroups[key].push(t);
  }

  // Sort each group by step_order
  for (var gi = 0; gi < phoneOrder.length; gi++) {
    phoneGroups[phoneOrder[gi]].sort(function(a, b) {
      return (a.step_order || 999) - (b.step_order || 999);
    });
  }

  // Check which phone groups have a step_order=1 thread (contactados)
  var contactadoKeys = [];
  for (var ci = 0; ci < phoneOrder.length; ci++) {
    var gKey = phoneOrder[ci];
    var grp = phoneGroups[gKey];
    var hasStep1 = false;
    for (var si = 0; si < grp.length; si++) {
      if (grp[si].template_name && isExcluded(grp[si].template_name)) continue;
      if (grp[si].step_order && parseInt(grp[si].step_order) === 1) { hasStep1 = true; break; }
      if (grp[si].template_name) {
        var parsed = parseTemplateName(grp[si].template_name);
        if (parsed && parsed.day === 0) { hasStep1 = true; break; }
      }
    }
    if (hasStep1) contactadoKeys.push(gKey);
  }
  var totalContactados = contactadoKeys.length;

  // Collect all contacted phones
  var allContactedPhones = {};
  for (var api = 0; api < contactadoKeys.length; api++) {
    var apGrp = phoneGroups[contactadoKeys[api]];
    for (var apj = 0; apj < apGrp.length; apj++) {
      if (apGrp[apj].phone_number) {
        var apClean = apGrp[apj].phone_number.replace(/\D/g, "");
        if (apClean) allContactedPhones[apClean] = true;
        break;
      }
    }
  }

  // Process each phone group
  var meetings = [];
  var allTemplatesSent = {};
  var allTemplatesResp = {};
  var allTemplatesRespExcluded = {};
  var allTemplatesRespReal = {};
  var allTemplateLastSent = {};
  var dailyMap = {};
  var hourlyAll = new Array(24).fill(0);
  var hourlyReal = new Array(24).fill(0);
  var topicCounts = {};
  var topicCountsReal = {};
  var engCounts = { alto: 0, medio: 0, bajo: 0, minimo: 0 };
  var engCountsReal = { alto: 0, medio: 0, bajo: 0, minimo: 0 };
  var igCount = 0, igLinkCount = 0, igAtOnlyCount = 0, toolCount = 0, mcCount = 0;
  var igCountReal = 0, igLinkCountReal = 0, igAtOnlyCountReal = 0, toolCountReal = 0, mcCountReal = 0;
  var autoReplyThreads = 0;
  var esTotal = 0, esResp = 0, ptTotal = 0, ptResp = 0, esRespReal = 0, ptRespReal = 0;
  var totalContactadosByQual = {};

  // Collect per-template step info for tplByStep
  var tplStepInfo = {};
  var hasStepOrder = false;
  for (var tsi = 0; tsi < threads.length; tsi++) {
    if (threads[tsi].template_name && threads[tsi].step_order) {
      tplStepInfo[threads[tsi].template_name] = parseInt(threads[tsi].step_order);
      hasStepOrder = true;
    }
  }

  for (var ci2 = 0; ci2 < contactadoKeys.length; ci2++) {
    var gKey2 = contactadoKeys[ci2];
    var grp2 = phoneGroups[gKey2];
    var step1 = grp2[0]; // First thread (sorted by step_order)

    // Aggregate metrics across all threads in group
    var phone = null;
    var qual = "";
    var hid = "";
    var groupHumanCount = 0;
    var groupWordCount = 0;
    var groupHasTool = false;
    var groupHasMeetingLink = false;
    var groupHasIgLink = false;
    var groupHasIgAt = false;
    var groupTopicFlags = 0;
    var templatesSent = [];
    var earliestFirstHumanTs = null;
    var latestLastHumanTs = null;
    var groupThreadIds = [];

    for (var gi2 = 0; gi2 < grp2.length; gi2++) {
      var th = grp2[gi2];
      if (th.thread_id) groupThreadIds.push(th.thread_id);
      if (th.phone_number) phone = th.phone_number;
      if (th.lead_qualification) qual = th.lead_qualification;
      if (th.hubspot_id) hid = th.hubspot_id;
      groupHumanCount += th.human_msg_count || 0;
      groupWordCount += th.total_word_count || 0;
      if (th.has_tool) groupHasTool = true;
      if (th.has_meeting_link) groupHasMeetingLink = true;
      if (th.has_ig_link) groupHasIgLink = true;
      if (th.has_ig_at) groupHasIgAt = true;
      groupTopicFlags |= (th.topic_flags || 0);
      if (th.template_name) templatesSent.push(th.template_name);
      if (th.first_human_ts) {
        var fht = new Date(th.first_human_ts);
        if (!isNaN(fht.getTime()) && (!earliestFirstHumanTs || fht < earliestFirstHumanTs)) {
          earliestFirstHumanTs = fht;
        }
      }
      if (th.last_human_ts) {
        var lht2 = new Date(th.last_human_ts);
        if (!isNaN(lht2.getTime()) && (!latestLastHumanTs || lht2 > latestLastHumanTs)) {
          latestLastHumanTs = lht2;
        }
      }
    }

    // Language detection from step1 detected_lang
    var lang = step1.detected_lang || "es";
    // Override by phone prefix for accuracy
    var phoneDigits = (phone || gKey2 || "").replace(/\D/g, "");
    if (phoneDigits.startsWith("55") && phoneDigits.length >= 12) lang = "pt";
    else if (phoneDigits.length >= 10 && lang !== "pt") lang = "es";

    if (regionFilter && regionFilter !== "all") {
      if (regionFilter === "es" && lang !== "es") continue;
      if (regionFilter === "pt" && lang !== "pt") continue;
    }
    var isES = lang === "es";
    if (isES) esTotal++; else ptTotal++;

    if (qual) {
      if (!totalContactadosByQual[qual]) totalContactadosByQual[qual] = 0;
      totalContactadosByQual[qual]++;
    }

    // Daily distribution from step1 template_sent_at
    var sentAt = step1.template_sent_at;
    if (sentAt) {
      var pd = parseDatetime(sentAt);
      if (pd && !isNaN(pd.getTime())) {
        var dayKey = String(pd.getDate()).padStart(2, "0") + "/" + String(pd.getMonth() + 1).padStart(2, "0");
        if (!dailyMap[dayKey]) dailyMap[dayKey] = 0;
        dailyMap[dayKey]++;
      }
    }

    // Track templates sent (unique per group)
    var tplSentUnique = {};
    for (var ts2 = 0; ts2 < templatesSent.length; ts2++) tplSentUnique[templatesSent[ts2]] = true;
    for (var tplKey in tplSentUnique) {
      if (!allTemplatesSent[tplKey]) allTemplatesSent[tplKey] = 0;
      allTemplatesSent[tplKey]++;
    }
    var threadSentAt = sentAt || "";
    if (threadSentAt) {
      for (var tplKey2 in tplSentUnique) {
        if (!allTemplateLastSent[tplKey2] || threadSentAt > allTemplateLastSent[tplKey2]) {
          allTemplateLastSent[tplKey2] = threadSentAt;
        }
      }
    }

    // Auto-reply: step1 is_auto_reply AND total group human count = 1
    var isAuto = !!(step1.is_auto_reply && groupHumanCount <= 1);

    // Determine trigger template: last template sent before first human response
    var triggerTpl = null;
    if (phone && groupHumanCount > 0 && templatesSent.length > 0) {
      if (earliestFirstHumanTs) {
        for (var tri = grp2.length - 1; tri >= 0; tri--) {
          var trTh = grp2[tri];
          if (trTh.template_name && trTh.template_sent_at) {
            var trSent = new Date(trTh.template_sent_at);
            if (!isNaN(trSent.getTime()) && trSent <= earliestFirstHumanTs) {
              triggerTpl = trTh.template_name; break;
            }
          }
        }
      }
      if (!triggerTpl) triggerTpl = templatesSent[0];

      if (!isExcluded(triggerTpl)) {
        if (!allTemplatesResp[triggerTpl]) allTemplatesResp[triggerTpl] = 0;
        allTemplatesResp[triggerTpl]++;
      } else {
        if (!allTemplatesRespExcluded[triggerTpl]) allTemplatesRespExcluded[triggerTpl] = 0;
        allTemplatesRespExcluded[triggerTpl]++;
      }

      if (isES) esResp++; else ptResp++;
    }

    if (!isAuto && phone && templatesSent.length > 0 && groupHumanCount > 0) {
      if (isES) esRespReal++; else ptRespReal++;
    }

    // Engagement
    var engagement = "minimo";
    if (qual === "Alta") engagement = "alto";
    else if (qual === "M\u00E9dia" || qual === "Media") engagement = "medio";
    else if (qual === "Baixa" || qual === "Baja") engagement = "bajo";

    // Hourly from first human hour of first thread with human response
    for (var hi = 0; hi < grp2.length; hi++) {
      if (grp2[hi].first_human_hour != null) {
        hourlyAll[grp2[hi].first_human_hour]++;
        if (!isAuto) hourlyReal[grp2[hi].first_human_hour]++;
        break;
      }
    }

    if (phone && groupHumanCount > 0) {
      engCounts[engagement]++;
      if (groupHasIgLink) { igLinkCount++; igCount++; }
      else if (groupHasIgAt) { igAtOnlyCount++; igCount++; }
      if (groupHasTool) toolCount++;
      if (isAuto) autoReplyThreads++;
      if (groupHasMeetingLink) mcCount++;

      if (!isAuto) {
        engCountsReal[engagement]++;
        if (groupHasIgLink) { igLinkCountReal++; igCountReal++; }
        else if (groupHasIgAt) { igAtOnlyCountReal++; igCountReal++; }
        if (groupHasTool) toolCountReal++;
        if (groupHasMeetingLink) mcCountReal++;
        if (triggerTpl) {
          if (!allTemplatesRespReal[triggerTpl]) allTemplatesRespReal[triggerTpl] = 0;
          allTemplatesRespReal[triggerTpl]++;
        }
      }

      // Topics from bitmask
      var gTopics = decodeTopic(groupTopicFlags);
      for (var topicName in gTopics) {
        if (!topicCounts[topicName]) topicCounts[topicName] = 0;
        topicCounts[topicName]++;
        if (!isAuto) {
          if (!topicCountsReal[topicName]) topicCountsReal[topicName] = 0;
          topicCountsReal[topicName]++;
        }
      }

      meetings.push({
        p: phone,
        ms: groupHumanCount,
        w: groupWordCount,
        au: isAuto,
        e: engagement,
        q: qual,
        hid: hid,
        co: getCountryFlag(phone),
        tr: Object.keys(tplSentUnique),
        fr: triggerTpl,
        c: [], // lazy load
        ml: groupHasMeetingLink,
        _created: sentAt || null,
        _lastTs: latestLastHumanTs ? latestLastHumanTs.toISOString() : null,
        _threadIds: groupThreadIds,
        _table: "mb_outbound_threads",
      });
    }
  }

  totalContactados = esTotal + ptTotal;

  // Build metrics
  var respondieron = meetings.length;
  var realesCount = meetings.filter(function(m) { return !m.au; }).length;
  var rate = totalContactados > 0 ? ((respondieron / totalContactados) * 100).toFixed(1) + "%" : "0%";
  var rateReal = totalContactados > 0 ? ((realesCount / totalContactados) * 100).toFixed(1) + "%" : "0%";

  var igR = respondieron > 0 ? ((igCount / respondieron) * 100).toFixed(1) + "%" : "0%";
  var igLinkR = respondieron > 0 ? ((igLinkCount / respondieron) * 100).toFixed(1) + "%" : "0%";
  var igAtOnlyR = respondieron > 0 ? ((igAtOnlyCount / respondieron) * 100).toFixed(1) + "%" : "0%";
  var tR = respondieron > 0 ? ((toolCount / respondieron) * 100).toFixed(1) + "%" : "0%";
  var mR = respondieron > 0 ? ((mcCount / respondieron) * 100).toFixed(1) + "%" : "0%";

  var topicsArr = [];
  for (var tn in topicCounts) {
    var cnt = topicCounts[tn];
    var def = TOPIC_KEYWORDS[tn];
    topicsArr.push({ t: tn, e: def.e, n: cnt, p: respondieron > 0 ? parseFloat(((cnt / respondieron) * 100).toFixed(1)) : 0 });
  }
  topicsArr.sort(function(a, b) { return b.n - a.n; });

  function engEntry(val, total) {
    var tt = total || respondieron;
    return { v: val, p: tt > 0 ? ((val / tt) * 100).toFixed(1) + "%" : "0%" };
  }

  var topicsArrReal = [];
  for (var tnr in topicCountsReal) {
    var cntr = topicCountsReal[tnr];
    var defr = TOPIC_KEYWORDS[tnr];
    topicsArrReal.push({ t: tnr, e: defr.e, n: cntr, p: realesCount > 0 ? parseFloat(((cntr / realesCount) * 100).toFixed(1)) : 0 });
  }
  topicsArrReal.sort(function(a, b) { return b.n - a.n; });

  var igRReal = realesCount > 0 ? ((igCountReal / realesCount) * 100).toFixed(1) + "%" : "0%";
  var igLinkRReal = realesCount > 0 ? ((igLinkCountReal / realesCount) * 100).toFixed(1) + "%" : "0%";
  var igAtOnlyRReal = realesCount > 0 ? ((igAtOnlyCountReal / realesCount) * 100).toFixed(1) + "%" : "0%";
  var tRReal = realesCount > 0 ? ((toolCountReal / realesCount) * 100).toFixed(1) + "%" : "0%";
  var mRReal = realesCount > 0 ? ((mcCountReal / realesCount) * 100).toFixed(1) + "%" : "0%";

  // Template performance
  var allSentKeys = Object.keys(allTemplatesSent);
  var hasNewFormat = allSentKeys.some(function(k) { return parseTemplateName(k) !== null; });
  var hasTemplateConfig = Object.keys(tplConfig).length > 0;
  var tplPerf = [];
  var tplPerfReal = [];
  var bcastPerf = [];
  var bcastPerfReal = [];
  var stepGroupsAll = null;
  var stepGroupsReal = null;
  var STEP_COLORS = { 1: "#2563EB", 2: "#7C3AED", 3: "#0891B2", 4: "#EA580C" };

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
          var step = tplStepInfo[tName];
          if (!step) continue;
          var stepCatMap = { 1: "d0", 2: "d1", 3: "d3", 4: "d5" };
          cat = stepCatMap[step] || "sin_categoria";
        }
        var meta = CATEGORY_META[cat];
        if (!meta) continue;
        if (!groups[cat]) {
          groups[cat] = { day: meta.day, label: meta.label, color: meta.color, order: meta.order, templates: [], totalSent: 0, totalResp: 0 };
        }
        var s = sentMap[tName] || 0;
        var r = (EXCLUDED_CATEGORIES[cat] ? (respExcludedMap[tName] || 0) : (respMap[tName] || 0));
        var tLang = "es";
        if (tName.startsWith("pt_") || tName.includes("_br")) tLang = "pt";
        groups[cat].templates.push({
          name: tName, displayName: tName, lang: tLang, region: getRegion(tName),
          sent: s, resp: r, rate: s > 0 ? ((r / s) * 100).toFixed(1) + "%" : "0%"
        });
        groups[cat].totalSent += s;
        groups[cat].totalResp += r;
      }
      var catKeys = Object.keys(groups).sort(function(a, b) { return (groups[a].order || 99) - (groups[b].order || 99); });
      var result = {};
      for (var cci = 0; cci < catKeys.length; cci++) {
        var ck = catKeys[cci];
        var sg = groups[ck];
        sg.totalRate = sg.totalSent > 0 ? ((sg.totalResp / sg.totalSent) * 100).toFixed(1) + "%" : "0%";
        sg.templates.sort(function(a, b) { return b.sent - a.sent; });
        result[ck] = sg;
      }
      return result;
    }
    stepGroupsAll = buildStepGroups(allTemplatesSent, allTemplatesResp, allTemplatesRespExcluded);
    stepGroupsReal = buildStepGroups(allTemplatesSent, allTemplatesRespReal, allTemplatesRespExcluded);

    var stepSorted = Object.keys(tplStepInfo).sort(function(a, b) {
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
      tplPerf.push({ name: fk, day: stepToDay(fstep), sent: fsent, resp: fresp, rate: fsent > 0 ? ((fresp / fsent) * 100).toFixed(1) + "%" : "0%", key: fk, content: null });
      tplPerfReal.push({ name: fk, day: stepToDay(fstep), sent: fsent, resp: frrespReal, rate: fsent > 0 ? ((frrespReal / fsent) * 100).toFixed(1) + "%" : "0%", key: fk, content: null });
    }
  } else if (hasNewFormat) {
    var newKeys = allSentKeys.filter(function(k) { return parseTemplateName(k) !== null; });
    newKeys.sort(function(a, b) {
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
      tplPerf.push({ name: nk, day: "D+" + np.day, sent: nsent, resp: nresp, rate: nsent > 0 ? ((nresp / nsent) * 100).toFixed(1) + "%" : "0%", key: nk, content: null });
      tplPerfReal.push({ name: nk, day: "D+" + np.day, sent: nsent, resp: nrrespReal, rate: nsent > 0 ? ((nrrespReal / nsent) * 100).toFixed(1) + "%" : "0%", key: nk, content: null });
    }
  }

  // Daily sorted
  var dailyArr = [];
  var dailyKeys = Object.keys(dailyMap).sort(function(a, b) {
    var pa = a.split("/"), pb = b.split("/");
    return (parseInt(pa[1]) * 100 + parseInt(pa[0])) - (parseInt(pb[1]) * 100 + parseInt(pb[0]));
  });
  for (var di = 0; di < dailyKeys.length; di++) {
    dailyArr.push({ d: dailyKeys[di], l: dailyMap[dailyKeys[di]] });
  }

  var dateRange = "";
  if (dailyKeys.length > 0) dateRange = dailyKeys[0] + " \u2013 " + dailyKeys[dailyKeys.length - 1];

  var C = { accent: "#2563EB", purple: "#7C3AED", green: "#059669", orange: "#EA580C", pink: "#EC4899", cyan: "#0891B2" };
  var funnelAll = [
    { n: "Contactados", v: totalContactados, c: C.accent },
    { n: "Respondieron", v: respondieron, c: C.purple },
    { n: "Oferta Reuni\u00F3n", v: mcCount, c: C.pink },
  ];
  var funnelReal = [
    { n: "Contactados", v: totalContactados, c: C.accent },
    { n: "Resp. Reales", v: realesCount, c: C.cyan },
    { n: "Oferta Reuni\u00F3n", v: mcCountReal, c: C.pink },
  ];

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

  var avgMsgs = respondieron > 0 ? (meetings.reduce(function(s, m) { return s + m.ms; }, 0) / respondieron).toFixed(1) : "0";
  var bTable = [
    { m: "Respuesta (todas)", y: rate, b: "40-60%", d: (rateNum - 40).toFixed(0) + " a " + (rateNum - 60).toFixed(0) + "pp", s: rateNum >= 40 ? 1 : 0 },
    { m: "Respuesta (reales)", y: rateReal, b: "40-60%", d: (rateRealNum - 40).toFixed(0) + " a " + (rateRealNum - 60).toFixed(0) + "pp", s: rateRealNum >= 40 ? 1 : 0 },
    { m: "Env\u00EDo de Instagram", y: igR, b: "35-50%", d: parseFloat(igR) >= 35 ? "~En rango" : "~" + (parseFloat(igR) - 35).toFixed(0) + "pp", s: parseFloat(igR) >= 35 ? 1 : 0 },
    { m: "Oferta Reuni\u00F3n", y: mR, b: "20-30%", d: parseFloat(mR) >= 20 ? "~En rango" : "~" + (parseFloat(mR) - 20).toFixed(0) + "pp", s: parseFloat(mR) >= 20 ? 1 : 0 },
    { m: "Tiempo 1a Resp.", y: "~3 min", b: "<15 min", d: "5x mejor", s: 1 },
    { m: "Msgs/Conv.", y: avgMsgs, b: "10-20", d: parseFloat(avgMsgs) > 20 ? "Alto" : "Normal", s: parseFloat(avgMsgs) >= 10 ? 1 : 0 },
  ];

  // Meet by template (trigger)
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
  function getMeetTplColor(tplName) {
    var step = tplStepInfo[tplName];
    if (step && STEP_COLORS[step]) return STEP_COLORS[step];
    if (tplName.startsWith("pt_")) return C.green;
    return C.accent;
  }
  var allMeetTpls = Object.keys(meetByTplMapAll);
  var realMeetKeys = Object.keys(meetByTplMapReal);
  for (var rki = 0; rki < realMeetKeys.length; rki++) {
    if (allMeetTpls.indexOf(realMeetKeys[rki]) < 0) allMeetTpls.push(realMeetKeys[rki]);
  }
  var meetByTplAll = [];
  var meetByTplReal = [];
  for (var mti = 0; mti < allMeetTpls.length; mti++) {
    var mk = allMeetTpls[mti];
    meetByTplAll.push({ l: mk, v: meetByTplMapAll[mk] || 0, c: getMeetTplColor(mk) });
    meetByTplReal.push({ l: mk, v: meetByTplMapReal[mk] || 0, c: getMeetTplColor(mk) });
  }
  meetByTplAll.sort(function(a, b) { return b.v - a.v; });
  meetByTplReal.sort(function(a, b) { return b.v - a.v; });

  var esRate = esTotal > 0 ? ((esResp / esTotal) * 100).toFixed(1) : "0.0";
  var ptRate = ptTotal > 0 ? ((ptResp / ptTotal) * 100).toFixed(1) : "0.0";
  var esRateReal = esTotal > 0 ? ((esRespReal / esTotal) * 100).toFixed(1) : "0.0";
  var ptRateReal = ptTotal > 0 ? ((ptRespReal / ptTotal) * 100).toFixed(1) : "0.0";
  var leadsPerDay = dailyArr.length > 0 ? Math.round(totalContactados / dailyArr.length) : 0;
  var useStepGroups = hasStepOrder || hasTemplateConfig;

  return {
    rawRows: threads,
    MEETINGS: meetings,
    topicsAll: topicsArr,
    allTemplateNames: Object.keys(allTemplatesSent),
    templateLastSent: allTemplateLastSent,
    tplStepInfo: tplStepInfo,
    D: {
      all: {
        resp: respondieron, rate: rate, topics: topicsArr,
        ig: igCount, igR: igR, igLink: igLinkCount, igLinkR: igLinkR, igAt: igAtOnlyCount, igAtR: igAtOnlyR, mc: mcCount, mR: mR,
        tool: toolCount, tR: tR,
        eng: { alto: engEntry(engCounts.alto), medio: engEntry(engCounts.medio), bajo: engEntry(engCounts.bajo), minimo: engEntry(engCounts.minimo) },
        hours: hourlyAll, tpl: tplPerf, bcast: bcastPerf,
        tplByStep: useStepGroups ? stepGroupsAll : null,
      },
      real: {
        resp: realesCount, rate: rateReal, topics: topicsArrReal,
        ig: igCountReal, igR: igRReal, igLink: igLinkCountReal, igLinkR: igLinkRReal, igAt: igAtOnlyCountReal, igAtR: igAtOnlyRReal,
        mc: mcCountReal, mR: mRReal, tool: toolCountReal, tR: tRReal,
        eng: { alto: engEntry(engCountsReal.alto, realesCount), medio: engEntry(engCountsReal.medio, realesCount), bajo: engEntry(engCountsReal.bajo, realesCount), minimo: engEntry(engCountsReal.minimo, realesCount) },
        hours: hourlyReal, tpl: tplPerfReal, bcast: bcastPerfReal,
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
    totalContactadosByQual: totalContactadosByQual,
    leadsPerDay: leadsPerDay,
    dateRange: dateRange,
    autoReplyCount: autoReplyThreads,
    realesCount: realesCount,
    esRate: esRate,
    esResp: esResp,
    esRespReal: esRespReal,
    esTotal: esTotal,
    ptRate: ptRate,
    ptResp: ptResp,
    ptRespReal: ptRespReal,
    ptTotal: ptTotal,
    esRateReal: esRateReal,
    ptRateReal: ptRateReal,
    allContactedPhones: allContactedPhones,
  };
}

// --- processInboundThreads ---

export function processInboundThreads(threads, regionFilter, lifecyclePhones, hubspotPhones) {
  // Filter to threads with human messages
  var threadIds = [];
  for (var i = 0; i < threads.length; i++) {
    if ((threads[i].human_msg_count || 0) > 0) threadIds.push(i);
  }

  // Unique inbound phones
  var inboundPhones = {};
  for (var ip = 0; ip < threadIds.length; ip++) {
    var ph = threads[threadIds[ip]].phone_number;
    if (ph) inboundPhones[ph] = true;
  }
  var inboundPhoneKeys = Object.keys(inboundPhones);
  var totalConversaciones = threadIds.length;

  // HubSpot phone match count
  var hubspotMatchCount = 0;
  if (hubspotPhones) {
    for (var hi = 0; hi < inboundPhoneKeys.length; hi++) {
      var hp = inboundPhoneKeys[hi].replace(/\D/g, "");
      if (!hp) continue;
      if (hubspotPhones[hp] || (hp.length > 11 && hubspotPhones[hp.slice(-11)]) || (hp.length > 10 && hubspotPhones[hp.slice(-10)])) {
        hubspotMatchCount++;
      }
    }
  }

  var meetings = [];
  var dailyMap = {};
  var hourlyAll = new Array(24).fill(0);
  var topicCounts = {};
  var depthCounts = { rebote: 0, corta: 0, media: 0, profunda: 0 };
  var igCount = 0, igLinkCount = 0, igAtOnlyCount = 0, toolCount = 0, mcCount = 0;
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
    var th = threads[threadIds[t]];
    var phone = th.phone_number || null;
    var humanMsgCount = th.human_msg_count || 0;
    var wordCount = th.total_word_count || 0;
    var hasIgLink = !!th.has_ig_link;
    var hasIgAt = !!th.has_ig_at;
    var hasTool = !!th.has_tool;
    var hasMeetingLink = !!th.has_meeting_link;
    var hasSignupLink = !!th.has_signup_link;
    var isAuto = !!(th.is_auto_reply && humanMsgCount <= 1);

    // Language
    var lang = th.detected_lang || "es";
    var phoneDigits = (phone || th.thread_id || "").replace(/\D/g, "");
    if (phoneDigits.startsWith("55") && phoneDigits.length >= 12) lang = "pt";
    else if (phoneDigits.length >= 10 && lang !== "pt") lang = "es";

    if (regionFilter && regionFilter !== "all") {
      if (regionFilter === "es" && lang !== "es") continue;
      if (regionFilter === "pt" && lang !== "pt") continue;
    }
    var isES = lang === "es";
    if (isES) esTotal++; else ptTotal++;

    // Daily distribution
    var sentAt = th.created_at;
    if (sentAt) {
      var pd = parseDatetime(sentAt);
      if (pd && !isNaN(pd.getTime())) {
        var dayKey = String(pd.getDate()).padStart(2, "0") + "/" + String(pd.getMonth() + 1).padStart(2, "0");
        if (!dailyMap[dayKey]) dailyMap[dayKey] = 0;
        dailyMap[dayKey]++;
      }
    }

    // Hourly
    if (th.first_human_hour != null) {
      hourlyAll[th.first_human_hour]++;
    }

    // Depth classification
    var depth = "rebote";
    if (humanMsgCount >= 10) depth = "profunda";
    else if (humanMsgCount >= 5) depth = "media";
    else if (humanMsgCount >= 2) depth = "corta";

    // Multi-day
    var isMultiDay = false;
    if (th.first_human_ts && th.last_human_ts) {
      var fht = new Date(th.first_human_ts);
      var lht = new Date(th.last_human_ts);
      if (!isNaN(fht.getTime()) && !isNaN(lht.getTime())) {
        if ((lht.getTime() - fht.getTime()) / (1000 * 60 * 60 * 24) >= 1) isMultiDay = true;
      }
    }

    var hasIg = hasIgLink || hasIgAt;
    var hasOutcome = hasTool || hasIg || hasMeetingLink;
    var displayId = phone || th.thread_id;

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

    // Topics from bitmask
    var gTopics = decodeTopic(th.topic_flags || 0);
    for (var topicName in gTopics) {
      if (!topicCounts[topicName]) topicCounts[topicName] = 0;
      topicCounts[topicName]++;
      if (!topicOutcomes[topicName]) topicOutcomes[topicName] = { total: 0, withOutcome: 0 };
      topicOutcomes[topicName].total++;
      if (hasOutcome) topicOutcomes[topicName].withOutcome++;
      if (!topicDepth[topicName]) topicDepth[topicName] = { rebote: 0, corta: 0, media: 0, profunda: 0 };
      topicDepth[topicName][depth]++;
    }

    meetings.push({
      p: displayId,
      ms: humanMsgCount,
      w: wordCount,
      au: isAuto,
      e: depth,
      q: "",
      hid: "",
      co: getCountryFlag(phone),
      tr: [],
      fr: null,
      c: [], // lazy load
      ml: hasMeetingLink,
      lang: lang,
      signup: !!(lcInfo && lcInfo.firstStep1At),
      signupLink: hasSignupLink,
      _created: th.created_at || null,
      _lastTs: th.last_human_ts || null,
      _threadIds: [th.thread_id],
      _table: "mb_inbound_threads",
    });
  }

  var respondieron = meetings.length;
  var realesCount = meetings.filter(function(m) { return !m.au; }).length;
  var engagedTotal = depthCounts.corta + depthCounts.media + depthCounts.profunda;
  var avgDepth = engagedCount > 0 ? parseFloat((engagedMsgSum / engagedCount).toFixed(1)) : 0;
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
  topicsArr.sort(function(a, b) { return b.n - a.n; });

  function depthEntry(val) {
    return { v: val, p: respondieron > 0 ? ((val / respondieron) * 100).toFixed(1) + "%" : "0%" };
  }

  var dailyArr = [];
  var dailyKeys = Object.keys(dailyMap).sort(function(a, b) {
    var pa = a.split("/"), pb = b.split("/");
    return (parseInt(pa[1]) * 100 + parseInt(pa[0])) - (parseInt(pb[1]) * 100 + parseInt(pb[0]));
  });
  for (var di = 0; di < dailyKeys.length; di++) {
    dailyArr.push({ d: dailyKeys[di], l: dailyMap[dailyKeys[di]] });
  }

  var dateRange = "";
  if (dailyKeys.length > 0) dateRange = dailyKeys[0] + " \u2013 " + dailyKeys[dailyKeys.length - 1];

  var CC = { accent: "#2563EB", purple: "#7C3AED", green: "#059669", orange: "#EA580C", pink: "#EC4899", cyan: "#0891B2" };
  var signupPhoneMap = {};
  var linkPhoneMap = {};
  for (var si = 0; si < meetings.length; si++) {
    if (meetings[si].signup) signupPhoneMap[meetings[si].p] = true;
    if (meetings[si].signupLink) linkPhoneMap[meetings[si].p] = true;
  }
  var signupUniqueCount = Object.keys(signupPhoneMap).length;
  var linkUniqueCount = Object.keys(linkPhoneMap).length;

  var funnelAll = [
    { n: "Leads Inbound", v: uniqueLeadCount, c: CC.accent, hs: hubspotMatchCount },
    { n: "Engajaron (2+)", v: engagedTotal, c: CC.purple },
    { n: "Link Crear Cuenta", v: linkUniqueCount, c: CC.cyan },
    { n: "Recibieron Step 1", v: signupUniqueCount, c: CC.green },
  ];

  var esRate = esTotal > 0 ? ((esResp / esTotal) * 100).toFixed(1) : "0.0";
  var ptRate = ptTotal > 0 ? ((ptResp / ptTotal) * 100).toFixed(1) : "0.0";
  var leadsPerDay = dailyArr.length > 0 ? Math.round(totalConversaciones / dailyArr.length) : 0;

  return {
    rawRows: threads,
    MEETINGS: meetings,
    topicsAll: topicsArr,
    allTemplateNames: [],
    templateLastSent: {},
    tplStepInfo: {},
    D: {
      all: {
        resp: respondieron, rate: rate, topics: topicsArr,
        ig: igCount, igR: igR, igLink: igLinkCount, igLinkR: igLinkR, igAt: igAtOnlyCount, igAtR: igAtOnlyR, mc: mcCount, mR: mR,
        tool: toolCount, tR: tR,
        eng: { profunda: depthEntry(depthCounts.profunda), media: depthEntry(depthCounts.media), corta: depthEntry(depthCounts.corta), rebote: depthEntry(depthCounts.rebote) },
        hours: hourlyAll, tpl: [], bcast: [], tplByStep: null,
      },
      real: {
        resp: respondieron, rate: rate, topics: topicsArr,
        ig: igCount, igR: igR, igLink: igLinkCount, igLinkR: igLinkR, igAt: igAtOnlyCount, igAtR: igAtOnlyR, mc: mcCount, mR: mR,
        tool: toolCount, tR: tR,
        eng: { profunda: depthEntry(depthCounts.profunda), media: depthEntry(depthCounts.media), corta: depthEntry(depthCounts.corta), rebote: depthEntry(depthCounts.rebote) },
        hours: hourlyAll, tpl: [], bcast: [], tplByStep: null,
      },
    },
    funnelAll: funnelAll,
    funnelReal: funnelAll,
    chBench: [],
    daily: dailyArr,
    bTable: [],
    meetByTplAll: [],
    meetByTplReal: [],
    totalContactados: totalConversaciones,
    leadsPerDay: leadsPerDay,
    dateRange: dateRange,
    autoReplyCount: autoReplyThreads,
    realesCount: realesCount,
    esRate: esRate,
    esResp: esResp,
    esRespReal: esResp,
    esTotal: esTotal,
    ptRate: ptRate,
    ptResp: ptResp,
    ptRespReal: ptResp,
    ptTotal: ptTotal,
    esRateReal: esRate,
    ptRateReal: ptRate,
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
    hubspotMatchCount: hubspotMatchCount,
  };
}
