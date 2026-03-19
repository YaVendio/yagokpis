import { supabase } from "./supabase";
import { withRetry } from "./apiRetry";

export async function queryMetabase(sql) {
  var password = sessionStorage.getItem("dashboard_password") || "";
  try {
    return await withRetry(function () { return _invokeMetabase(sql, password); });
  } catch (e) {
    if (e._status === 401) { window.dispatchEvent(new Event("auth-required")); throw new Error("Unauthorized"); }
    throw e;
  }
}

function _invokeMetabase(sql, password) {
  return supabase.functions.invoke("metabase", {
    body: { sql: sql, password: password },
  }).then(function (res) {
    if (res.error) {
      var status = res.error.context && res.error.context.status;
      var msg = res.data && res.data.error || res.error.message || "Metabase API error";
      var err = new Error(msg);
      err._status = status;
      throw err;
    }
    return res.data;
  });
}

export async function fetchThreads(stepFilter, since) {
  var stepClause = "";
  if (stepFilter) {
    stepClause = "\n    AND lfs.step_order = " + parseInt(stepFilter);
  }

  var query =
    "WITH last_lead_qualification AS (\n" +
    "    SELECT DISTINCT ON (company_id)\n" +
    "        company_id,\n" +
    "        event_data->>'qualification' AS lead_qualification\n" +
    "    FROM lifecycle_events\n" +
    "    WHERE event_name = 'lead_qualification'\n" +
    "    ORDER BY company_id, event_timestamp DESC\n" +
    ")\n" +
    "SELECT\n" +
    "    t.thread_id,\n" +
    "    le.phone_number,\n" +
    "    le.sent_at AS template_sent_at,\n" +
    "    le.template_id,\n" +
    "    le.template_name,\n" +
    "    lfs.step_order,\n" +
    "    llq.lead_qualification,\n" +
    '    t."values"::text AS values_json\n' +
    "FROM thread t\n" +
    "JOIN lifecycle_executions le\n" +
    "    ON (t.metadata->>'execution_id') = le.id::text\n" +
    "JOIN lifecycle_flow_steps lfs\n" +
    "    ON le.step_id = lfs.id\n" +
    "LEFT JOIN last_lead_qualification llq\n" +
    "    ON llq.company_id = le.company_id\n" +
    "WHERE le.flow_id = 1\n" +
    "    AND le.sent_at >= '" + since + "'" +
    stepClause +
    "\nORDER BY t.thread_id";

  var result = await queryMetabase(query);

  var colIdx = {};
  for (var i = 0; i < result.columns.length; i++) {
    colIdx[result.columns[i]] = i;
  }

  var threads = [];
  for (var j = 0; j < result.results.length; j++) {
    var row = result.results[j];
    threads.push({
      thread_id: row[colIdx["thread_id"]],
      phone_number: row[colIdx["phone_number"]],
      template_sent_at: row[colIdx["template_sent_at"]],
      template_id: row[colIdx["template_id"]],
      template_name: row[colIdx["template_name"]],
      step_order: row[colIdx["step_order"]],
      lead_qualification: row[colIdx["lead_qualification"]],
      values_json: row[colIdx["values_json"]],
    });
  }

  return threads;
}

export async function fetchInboundThreads(since) {
  // Fetch ALL threads — inbound determination happens in JS by comparing
  // first human message timestamp vs first lifecycle execution per phone
  var query =
    "SELECT\n" +
    "    t.thread_id,\n" +
    "    t.metadata->>'phone_number' AS phone_from_meta,\n" +
    "    t.metadata->>'phone' AS phone2,\n" +
    "    t.metadata->>'wa_id' AS wa_id,\n" +
    "    t.metadata->>'contact_phone' AS contact_phone,\n" +
    "    t.created_at AS thread_created_at,\n" +
    '    t."values"::text AS values_json\n' +
    "FROM thread t\n" +
    "WHERE t.created_at >= '" + since + "'\n" +
    "ORDER BY t.thread_id";

  var result = await queryMetabase(query);

  var colIdx = {};
  for (var i = 0; i < result.columns.length; i++) {
    colIdx[result.columns[i]] = i;
  }

  var threads = [];
  for (var j = 0; j < result.results.length; j++) {
    var row = result.results[j];
    var phone = row[colIdx["phone_from_meta"]] || row[colIdx["phone2"]] || row[colIdx["wa_id"]] || row[colIdx["contact_phone"]] || "";
    threads.push({
      thread_id: row[colIdx["thread_id"]],
      phone_number: phone,
      thread_created_at: row[colIdx["thread_created_at"]],
      values_json: row[colIdx["values_json"]],
    });
  }

  return threads;
}

export async function fetchLifecyclePhones() {
  // Per phone: first lifecycle sent_at + first step 1 sent_at
  var query =
    "SELECT\n" +
    "    le.phone_number,\n" +
    "    MIN(le.sent_at) AS first_lifecycle_at,\n" +
    "    MIN(CASE WHEN lfs.step_order = 1 THEN le.sent_at ELSE NULL END) AS first_step1_at\n" +
    "FROM lifecycle_executions le\n" +
    "JOIN lifecycle_flow_steps lfs ON le.step_id = lfs.id\n" +
    "WHERE le.sent_at >= '2025-01-01'\n" +
    "GROUP BY le.phone_number";

  var result = await queryMetabase(query);
  var phones = {};
  for (var j = 0; j < result.results.length; j++) {
    var row = result.results[j];
    var phone = row[0];
    if (phone) {
      phones[phone] = {
        firstAt: row[1] || null,
        firstStep1At: row[2] || null,
      };
    }
  }
  return phones;
}

// Filtered inbound threads: excludes outbound (flow_id=1) at SQL level
export async function fetchInboundThreadsFiltered(since) {
  var query =
    "SELECT\n" +
    "    t.thread_id,\n" +
    "    t.metadata->>'phone_number' AS phone_from_meta,\n" +
    "    t.metadata->>'phone' AS phone2,\n" +
    "    t.metadata->>'wa_id' AS wa_id,\n" +
    "    t.metadata->>'contact_phone' AS contact_phone,\n" +
    "    t.created_at AS thread_created_at,\n" +
    '    t."values"::text AS values_json\n' +
    "FROM thread t\n" +
    "WHERE t.created_at >= '" + since + "'\n" +
    "  AND (t.metadata->>'flow_id' IS DISTINCT FROM '1')\n" +
    "ORDER BY t.thread_id";

  var result = await queryMetabase(query);

  var colIdx = {};
  for (var i = 0; i < result.columns.length; i++) {
    colIdx[result.columns[i]] = i;
  }

  var threads = [];
  for (var j = 0; j < result.results.length; j++) {
    var row = result.results[j];
    var phone = row[colIdx["phone_from_meta"]] || row[colIdx["phone2"]] || row[colIdx["wa_id"]] || row[colIdx["contact_phone"]] || "";
    threads.push({
      thread_id: row[colIdx["thread_id"]],
      phone_number: phone,
      thread_created_at: row[colIdx["thread_created_at"]],
      values_json: row[colIdx["values_json"]],
    });
  }

  return threads;
}

export async function fetchResponseStats(since) {
  var query =
    "WITH outbound AS (\n" +
    "    SELECT COUNT(DISTINCT phone_number) AS outbound_total\n" +
    "    FROM lifecycle_executions\n" +
    "    WHERE flow_id = 1\n" +
    "      AND status = 'sent'\n" +
    "      AND sent_at >= '" + since + "'\n" +
    "),\n" +
    "responded_base AS (\n" +
    "    SELECT\n" +
    "        metadata->>'phone_number' AS phone_number,\n" +
    "        \"values\"->'messages' AS messages,\n" +
    "        ROW_NUMBER() OVER (\n" +
    "            PARTITION BY metadata->>'phone_number'\n" +
    "            ORDER BY created_at DESC\n" +
    "        ) AS rn\n" +
    "    FROM thread\n" +
    "    WHERE created_at >= '" + since + "'\n" +
    "      AND COALESCE(metadata->>'channel', '') != 'cgr'\n" +
    "      AND metadata->>'flow_id' = '1'\n" +
    "      AND metadata->>'phone_number' IS NOT NULL\n" +
    "      AND jsonb_array_length(COALESCE(\"values\"->'messages', '[]'::jsonb)) > 0\n" +
    "      AND EXISTS (\n" +
    "          SELECT 1 FROM jsonb_array_elements(\"values\"->'messages') m\n" +
    "          WHERE m->>'type' = 'human'\n" +
    "      )\n" +
    "),\n" +
    "outbound_responded AS (\n" +
    "    SELECT COUNT(*) AS outbound_responded\n" +
    "    FROM responded_base WHERE rn = 1\n" +
    "),\n" +
    "outbound_responded_real AS (\n" +
    "    SELECT COUNT(*) AS outbound_responded_real\n" +
    "    FROM responded_base t\n" +
    "    CROSS JOIN LATERAL (\n" +
    "        SELECT\n" +
    "            (SELECT count(*) FROM jsonb_array_elements(t.messages) m2 WHERE m2->>'type' = 'human') AS human_count,\n" +
    "            (SELECT COALESCE(m3.val->>'content', '')\n" +
    "             FROM jsonb_array_elements(t.messages) WITH ORDINALITY AS m3(val, idx)\n" +
    "             WHERE m3.val->>'type' = 'human' ORDER BY m3.idx LIMIT 1\n" +
    "            ) AS first_human_content,\n" +
    "            (SELECT (m4.val #>> '{additional_kwargs,metadata,timestamp}')::numeric\n" +
    "             FROM jsonb_array_elements(t.messages) WITH ORDINALITY AS m4(val, idx)\n" +
    "             WHERE m4.val->>'type' = 'human' ORDER BY m4.idx LIMIT 1\n" +
    "            ) AS first_human_ts,\n" +
    "            (SELECT max((m5.val #>> '{additional_kwargs,metadata,timestamp}')::numeric)\n" +
    "             FROM jsonb_array_elements(t.messages) WITH ORDINALITY AS m5(val, idx)\n" +
    "             WHERE m5.val->>'type' = 'ai'\n" +
    "               AND m5.idx < (SELECT min(h2.idx) FROM jsonb_array_elements(t.messages) WITH ORDINALITY AS h2(val, idx) WHERE h2.val->>'type' = 'human')\n" +
    "            ) AS preceding_ai_ts\n" +
    "    ) h\n" +
    "    WHERE t.rn = 1\n" +
    "      AND NOT (\n" +
    "          h.human_count = 1\n" +
    "          AND (\n" +
    "              (h.first_human_ts IS NOT NULL AND h.preceding_ai_ts IS NOT NULL AND (h.first_human_ts - h.preceding_ai_ts) < 10)\n" +
    "              OR lower(h.first_human_content) LIKE '%gracias por comunicarte%'\n" +
    "              OR lower(h.first_human_content) LIKE '%obrigado por entrar em contato%'\n" +
    "              OR lower(h.first_human_content) LIKE '%en este momento no estamos disponibles%'\n" +
    "              OR lower(h.first_human_content) LIKE '%no momento não estamos disponíveis%'\n" +
    "              OR lower(h.first_human_content) LIKE '%responderemos lo antes posible%'\n" +
    "              OR lower(h.first_human_content) LIKE '%responderemos o mais breve%'\n" +
    "              OR lower(h.first_human_content) LIKE '%gracias por contactarnos%'\n" +
    "              OR lower(h.first_human_content) LIKE '%obrigado por nos contatar%'\n" +
    "              OR lower(h.first_human_content) LIKE '%thank you for contacting%'\n" +
    "              OR lower(h.first_human_content) LIKE '%we are currently unavailable%'\n" +
    "              OR lower(h.first_human_content) LIKE '%fuera del horario%'\n" +
    "              OR lower(h.first_human_content) LIKE '%fora do horário%'\n" +
    "              OR lower(h.first_human_content) LIKE '%mensaje automático%'\n" +
    "              OR lower(h.first_human_content) LIKE '%mensagem automática%'\n" +
    "              OR lower(h.first_human_content) LIKE '%respuesta automática%'\n" +
    "              OR lower(h.first_human_content) LIKE '%resposta automática%'\n" +
    "              OR lower(h.first_human_content) LIKE '%horario de atención%'\n" +
    "              OR lower(h.first_human_content) LIKE '%horário de atendimento%'\n" +
    "              OR lower(h.first_human_content) LIKE '%nuestro horario%'\n" +
    "              OR lower(h.first_human_content) LIKE '%nosso horário%'\n" +
    "              OR lower(h.first_human_content) LIKE '%le responderemos%'\n" +
    "              OR lower(h.first_human_content) LIKE '%responderemos en breve%'\n" +
    "              OR lower(h.first_human_content) LIKE '%te responderemos%'\n" +
    "              OR lower(h.first_human_content) LIKE '%entraremos en contacto%'\n" +
    "              OR lower(h.first_human_content) LIKE '%entraremos em contato%'\n" +
    "              OR lower(h.first_human_content) LIKE '%gracias por escribirnos%'\n" +
    "              OR lower(h.first_human_content) LIKE '%obrigado por nos escrever%'\n" +
    "              OR lower(h.first_human_content) LIKE '%gracias por tu mensaje%'\n" +
    "              OR lower(h.first_human_content) LIKE '%obrigado pela sua mensagem%'\n" +
    "              OR lower(h.first_human_content) LIKE '%hemos recibido tu mensaje%'\n" +
    "              OR lower(h.first_human_content) LIKE '%recebemos sua mensagem%'\n" +
    "              OR lower(h.first_human_content) LIKE '%en breve un asesor%'\n" +
    "              OR lower(h.first_human_content) LIKE '%em breve um atendente%'\n" +
    "              OR lower(h.first_human_content) LIKE '%nos pondremos en contacto%'\n" +
    "              OR lower(h.first_human_content) LIKE '%automatic reply%'\n" +
    "              OR lower(h.first_human_content) LIKE '%auto-reply%'\n" +
    "              OR lower(h.first_human_content) LIKE '%out of office%'\n" +
    "              OR lower(h.first_human_content) LIKE '%fuera de oficina%'\n" +
    "              OR lower(h.first_human_content) LIKE '%fora do escritório%'\n" +
    "              OR lower(h.first_human_content) LIKE '%no estamos disponibles%'\n" +
    "              OR lower(h.first_human_content) LIKE '%não estamos disponíveis%'\n" +
    "              OR lower(h.first_human_content) LIKE '%bienvenido a%'\n" +
    "              OR lower(h.first_human_content) LIKE '%bem-vindo a%'\n" +
    "              OR lower(h.first_human_content) LIKE '%gracias por su mensaje%'\n" +
    "              OR lower(h.first_human_content) LIKE '%obrigado por sua mensagem%'\n" +
    "          )\n" +
    "      )\n" +
    "),\n" +
    "all_conversational AS (\n" +
    "    SELECT COUNT(*) AS inbound\n" +
    "    FROM (\n" +
    "        SELECT\n" +
    "            COALESCE(metadata->>'phone_number', thread_id::text) AS uid,\n" +
    "            ROW_NUMBER() OVER (\n" +
    "                PARTITION BY COALESCE(metadata->>'phone_number', thread_id::text)\n" +
    "                ORDER BY created_at DESC\n" +
    "            ) AS rn\n" +
    "        FROM thread\n" +
    "        WHERE created_at >= '" + since + "'\n" +
    "          AND COALESCE(metadata->>'channel', '') != 'cgr'\n" +
    "          AND jsonb_array_length(COALESCE(values->'messages', '[]'::jsonb)) > 0\n" +
    "          AND (metadata->>'flow_id' IS DISTINCT FROM '1')\n" +
    "          AND EXISTS (\n" +
    "              SELECT 1 FROM jsonb_array_elements(values->'messages') m\n" +
    "              WHERE m->>'type' = 'human'\n" +
    "          )\n" +
    "          AND EXISTS (\n" +
    "              SELECT 1 FROM jsonb_array_elements(values->'messages') m\n" +
    "              WHERE m->>'type' = 'ai'\n" +
    "          )\n" +
    "    ) t WHERE rn = 1\n" +
    ")\n" +
    "SELECT\n" +
    "    o.outbound_total,\n" +
    "    r.outbound_responded,\n" +
    "    rr.outbound_responded_real,\n" +
    "    i.inbound\n" +
    "FROM outbound o, outbound_responded r, outbound_responded_real rr, all_conversational i";

  var result = await queryMetabase(query);
  if (!result || !result.results || result.results.length === 0) {
    return { outboundTotal: 0, outboundResponded: 0, outboundRespondedReal: 0, inbound: 0 };
  }
  var row = result.results[0];
  return {
    outboundTotal: row[0] || 0,
    outboundResponded: row[1] || 0,
    outboundRespondedReal: row[2] || 0,
    inbound: row[3] || 0,
  };
}

export function expandInboundThreadMessages(threads) {
  var rows = [];

  for (var i = 0; i < threads.length; i++) {
    var t = threads[i];
    var messages = [];
    if (t.values_json) {
      try {
        var values = JSON.parse(t.values_json);
        if (values && values.messages) { messages = values.messages; }
      } catch (e) { /* skip */ }
    }

    var threadCreated = t.thread_created_at || "";

    // Try to extract phone from messages metadata if not in thread metadata
    var phone = t.phone_number;
    if (!phone) {
      for (var pi = 0; pi < messages.length; pi++) {
        var pmsg = messages[pi];
        if (pmsg.additional_kwargs && pmsg.additional_kwargs.metadata) {
          var meta = pmsg.additional_kwargs.metadata;
          phone = meta.phone_number || meta.phone || meta.wa_id || meta.contact_phone || "";
          if (phone) break;
        }
      }
    }

    var hasHuman = false;
    for (var hi = 0; hi < messages.length; hi++) {
      if (messages[hi].type === "human") { hasHuman = true; break; }
    }

    if (messages.length === 0) {
      rows.push({
        thread_id: t.thread_id,
        phone_number: "",
        template_sent_at: threadCreated,
        template_id: "",
        template_name: "",
        step_order: "",
        lead_qualification: "",
        message_type: "ai",
        message_datetime: threadCreated,
        message_content: "",
        is_valid_response: "false",
      });
      continue;
    }

    for (var j = 0; j < messages.length; j++) {
      var msg = messages[j];
      var msgType = msg.type === "human" ? "human" : msg.type === "tool" ? "tool" : "ai";

      var msgContent = "";
      if (typeof msg.content === "string") {
        msgContent = msg.content;
      } else if (Array.isArray(msg.content)) {
        msgContent = msg.content.map(function (block) {
          if (typeof block === "string") return block;
          if (block && block.text) return block.text;
          return "";
        }).join("");
      }

      var msgDatetime = "";
      if (msg.additional_kwargs && msg.additional_kwargs.metadata && msg.additional_kwargs.metadata.timestamp) {
        var ts = msg.additional_kwargs.metadata.timestamp;
        if (typeof ts === "number") {
          msgDatetime = new Date(ts * 1000).toISOString();
        } else {
          msgDatetime = String(ts);
        }
      }

      // For inbound: all human messages are valid (no 7-day window)
      var isValid = msgType === "human";

      rows.push({
        thread_id: t.thread_id,
        phone_number: hasHuman ? (phone || "") : "",
        template_sent_at: threadCreated,
        template_id: "",
        template_name: "",
        step_order: "",
        lead_qualification: "",
        message_type: msgType,
        message_datetime: msgDatetime,
        message_content: msgContent,
        is_valid_response: String(isValid),
      });
    }
  }

  return rows;
}

var INBOUND_CACHE_TTL = 30 * 60 * 1000; // 30 minutes

export async function fetchInboundCached(since) {
  // Try Supabase cache first
  try {
    var cacheRes = await supabase
      .from("hubspot_cache")
      .select("data, updated_at")
      .eq("key", "inbound_rows")
      .single();
    if (cacheRes.data && cacheRes.data.data) {
      var age = Date.now() - new Date(cacheRes.data.updated_at).getTime();
      if (age < INBOUND_CACHE_TTL) {
        console.log("[Inbound] Using cache (" + Math.round(age / 1000) + "s old, " + cacheRes.data.data.length + " rows)");
        return cacheRes.data.data;
      }
    }
  } catch (e) { /* cache miss */ }

  // Cache miss — fetch from Metabase
  console.log("[Inbound] Cache miss, fetching from Metabase...");
  var threads = await fetchInboundThreadsFiltered(since);
  var rows = expandInboundThreadMessages(threads);

  // Save to cache (fire-and-forget)
  supabase
    .from("hubspot_cache")
    .upsert({ key: "inbound_rows", data: rows, updated_at: new Date().toISOString() })
    .then(function () { console.log("[Inbound] Cached " + rows.length + " rows"); })
    .catch(function (e) { console.warn("[Inbound] Cache save failed:", e); });

  return rows;
}

export async function fetchLifecyclePhonesCached() {
  // Try Supabase cache first
  try {
    var cacheRes = await supabase
      .from("hubspot_cache")
      .select("data, updated_at")
      .eq("key", "lifecycle_phones")
      .single();
    if (cacheRes.data && cacheRes.data.data) {
      var age = Date.now() - new Date(cacheRes.data.updated_at).getTime();
      if (age < INBOUND_CACHE_TTL) {
        console.log("[Lifecycle] Using cache (" + Math.round(age / 1000) + "s old)");
        return cacheRes.data.data;
      }
    }
  } catch (e) { /* cache miss */ }

  console.log("[Lifecycle] Cache miss, fetching from Metabase...");
  var phones = await fetchLifecyclePhones();

  supabase
    .from("hubspot_cache")
    .upsert({ key: "lifecycle_phones", data: phones, updated_at: new Date().toISOString() })
    .then(function () { console.log("[Lifecycle] Cached"); })
    .catch(function (e) { console.warn("[Lifecycle] Cache save failed:", e); });

  return phones;
}

export function expandThreadMessages(threads) {
  // Phase 1: Parse messages for each thread and group threads by phone_number.
  // This merges all steps of the same lead into one virtual thread, reproducing
  // the old CSV structure where one thread_id contained all step messages.

  var parsed = []; // { thread, messages[] }
  for (var i = 0; i < threads.length; i++) {
    var t = threads[i];
    var messages = [];
    if (t.values_json) {
      try {
        var values = JSON.parse(t.values_json);
        if (values && values.messages) { messages = values.messages; }
      } catch (e) { /* skip unparseable */ }
    }
    parsed.push({ thread: t, messages: messages });
  }

  // Group by phone_number; fallback to thread_id when phone is missing
  var phoneGroups = {}; // phone → [ index into parsed[] ]
  for (var p = 0; p < parsed.length; p++) {
    var key = parsed[p].thread.phone_number || parsed[p].thread.thread_id;
    if (!phoneGroups[key]) phoneGroups[key] = [];
    phoneGroups[key].push(p);
  }

  // Phase 2 & 3: For each phone group, compute shared fields and emit rows
  var rows = [];
  var sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  var groupKeys = Object.keys(phoneGroups);

  for (var g = 0; g < groupKeys.length; g++) {
    var gKey = groupKeys[g];
    var indices = phoneGroups[gKey];

    // Sort threads in this group by step_order (step 1 first)
    indices.sort(function (a, b) {
      var sa = parsed[a].thread.step_order || 999;
      var sb = parsed[b].thread.step_order || 999;
      return sa - sb;
    });

    // Determine virtual thread id = phone_number (or fallback thread_id)
    var virtualThreadId = gKey;

    // Check if ANY thread in the group has a human response
    var anyHumanResponse = false;
    for (var ah = 0; ah < indices.length; ah++) {
      var ahMsgs = parsed[indices[ah]].messages;
      for (var ah2 = 0; ah2 < ahMsgs.length; ah2++) {
        if (ahMsgs[ah2].type === "human") { anyHumanResponse = true; break; }
      }
      if (anyHumanResponse) break;
    }

    // Get lead_qualification from first thread that has one
    var groupQualification = "";
    for (var q = 0; q < indices.length; q++) {
      if (parsed[indices[q]].thread.lead_qualification) {
        groupQualification = parsed[indices[q]].thread.lead_qualification;
        break;
      }
    }

    // Get template_sent_at from step 1 thread (first in sorted order)
    var step1Thread = parsed[indices[0]].thread;
    var groupSentAt = step1Thread.template_sent_at || "";

    // Phone only shown if lead responded
    var phoneForRows = anyHumanResponse ? (step1Thread.phone_number || "") : "";

    // Emit rows for each thread in the group
    for (var ti = 0; ti < indices.length; ti++) {
      var entry = parsed[indices[ti]];
      var thr = entry.thread;
      var msgs = entry.messages;
      var sentAtDate = thr.template_sent_at ? new Date(thr.template_sent_at) : null;

      if (msgs.length === 0) {
        rows.push({
          thread_id: virtualThreadId,
          phone_number: "",
          template_sent_at: groupSentAt,
          template_id: thr.template_id || "",
          template_name: thr.template_name || "",
          step_order: thr.step_order != null ? String(thr.step_order) : "",
          lead_qualification: groupQualification,
          message_type: "ai",
          message_datetime: groupSentAt,
          message_content: "",
          is_valid_response: "false",
        });
        continue;
      }

      for (var j = 0; j < msgs.length; j++) {
        var msg = msgs[j];
        var msgType = msg.type === "human" ? "human" : msg.type === "tool" ? "tool" : "ai";

        // Normalize content to string
        var msgContent = "";
        if (typeof msg.content === "string") {
          msgContent = msg.content;
        } else if (Array.isArray(msg.content)) {
          msgContent = msg.content.map(function (block) {
            if (typeof block === "string") return block;
            if (block && block.text) return block.text;
            return "";
          }).join("");
        }

        // template_name: per-message metadata first, then execution-level for first AI msg
        var msgTemplateName = "";
        if (msg.additional_kwargs && msg.additional_kwargs.metadata && msg.additional_kwargs.metadata.template_name) {
          msgTemplateName = msg.additional_kwargs.metadata.template_name;
        } else if (msgType === "ai" && j === 0) {
          msgTemplateName = thr.template_name || "";
        }

        // Extract timestamp
        var msgDatetime = "";
        if (msg.additional_kwargs && msg.additional_kwargs.metadata && msg.additional_kwargs.metadata.timestamp) {
          var ts = msg.additional_kwargs.metadata.timestamp;
          if (typeof ts === "number") {
            msgDatetime = new Date(ts * 1000).toISOString();
          } else {
            msgDatetime = String(ts);
          }
        }

        // is_valid_response uses per-thread sentAtDate (before merging)
        var isValid = false;
        if (msgType === "human" && sentAtDate && msgDatetime) {
          var msgDate = new Date(msgDatetime);
          if (!isNaN(msgDate.getTime())) {
            isValid = msgDate >= sentAtDate && msgDate <= new Date(sentAtDate.getTime() + sevenDaysMs);
          }
        }

        rows.push({
          thread_id: virtualThreadId,
          phone_number: phoneForRows,
          template_sent_at: groupSentAt,
          template_id: thr.template_id || "",
          template_name: msgTemplateName,
          step_order: thr.step_order != null ? String(thr.step_order) : "",
          lead_qualification: groupQualification,
          message_type: msgType,
          message_datetime: msgDatetime,
          message_content: msgContent,
          is_valid_response: String(isValid),
        });
      }
    }
  }

  return rows;
}

export async function fetchAdsThreads(since, until) {
  var query =
    "WITH first_human AS (\n" +
    "    SELECT\n" +
    "        t.thread_id,\n" +
    "        t.created_at AS thread_created_at,\n" +
    "        t.metadata->>'phone_number' AS phone_from_meta,\n" +
    "        t.metadata->>'phone' AS phone2,\n" +
    "        t.metadata->>'wa_id' AS wa_id,\n" +
    "        t.metadata->>'contact_phone' AS contact_phone,\n" +
    "        (SELECT m.val->>'content'\n" +
    "         FROM jsonb_array_elements(t.\"values\"->'messages') WITH ORDINALITY AS m(val, idx)\n" +
    "         WHERE m.val->>'type' = 'human'\n" +
    "         ORDER BY m.idx LIMIT 1\n" +
    "        ) AS first_human_msg,\n" +
    "        (SELECT count(*) FROM jsonb_array_elements(t.\"values\"->'messages') m2) AS total_messages,\n" +
    "        (SELECT count(*) FROM jsonb_array_elements(t.\"values\"->'messages') m3 WHERE m3->>'type' = 'human') AS human_messages,\n" +
    "        t.\"values\"::text AS values_json\n" +
    "    FROM thread t\n" +
    "    WHERE t.created_at >= '" + since + "'\n" +
    "      AND t.created_at <= '" + until + "'\n" +
    "      AND jsonb_array_length(COALESCE(t.\"values\"->'messages', '[]'::jsonb)) > 0\n" +
    ")\n" +
    "SELECT * FROM first_human\n" +
    "WHERE first_human_msg ILIKE '%quiero m_s informaci_n sobre el vendedor ia%'\n" +
    "   OR first_human_msg ILIKE '%quiero registrarme para obtener mi vendedor ia%'\n" +
    "   OR first_human_msg ILIKE '%c_mo obtengo mi vendedor ia para whatsapp%'\n" +
    "ORDER BY thread_created_at DESC";

  var result = await queryMetabase(query);

  var colIdx = {};
  for (var i = 0; i < result.columns.length; i++) {
    colIdx[result.columns[i]] = i;
  }

  var threads = [];
  for (var j = 0; j < result.results.length; j++) {
    var row = result.results[j];
    var phone = row[colIdx["phone_from_meta"]] || row[colIdx["phone2"]] || row[colIdx["wa_id"]] || row[colIdx["contact_phone"]] || "";
    threads.push({
      thread_id: row[colIdx["thread_id"]],
      phone_number: phone,
      thread_created_at: row[colIdx["thread_created_at"]],
      first_human_msg: row[colIdx["first_human_msg"]] || "",
      total_messages: row[colIdx["total_messages"]] || 0,
      human_messages: row[colIdx["human_messages"]] || 0,
      values_json: row[colIdx["values_json"]] || "",
    });
  }

  return threads;
}
