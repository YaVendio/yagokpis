var POSTHOG_API_URL = "https://us.posthog.com/api/projects";
var PROJECT_ID = import.meta.env.VITE_POSTHOG_PROJECT_ID;
var API_KEY = import.meta.env.VITE_POSTHOG_API_KEY;

export async function queryPostHog(hogqlQuery) {
  var resp = await fetch(POSTHOG_API_URL + "/" + PROJECT_ID + "/query/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + API_KEY,
    },
    body: JSON.stringify({
      query: { kind: "HogQLQuery", query: hogqlQuery },
    }),
  });
  if (!resp.ok) {
    var errText = await resp.text();
    throw new Error("PostHog API error " + resp.status + ": " + errText);
  }
  var data = await resp.json();
  return { columns: data.columns, results: data.results };
}

export async function fetchThreadsFromPostHog(stepFilter) {
  var stepClause = "";
  if (stepFilter) {
    stepClause = "\n    AND lfs.step_order = " + parseInt(stepFilter);
  }

  var query =
    "WITH last_lead_qualification AS (\n" +
    "    SELECT\n" +
    "        company_id,\n" +
    "        argMax(JSONExtractString(event_data, 'qualification'), event_timestamp) AS lead_qualification\n" +
    "    FROM postgres.yago.lifecycle_events\n" +
    "    WHERE event_name = 'lead_qualification'\n" +
    "    GROUP BY company_id\n" +
    ")\n" +
    "SELECT\n" +
    "    t.thread_id,\n" +
    "    le.phone_number,\n" +
    "    le.sent_at AS template_sent_at,\n" +
    "    le.template_id,\n" +
    "    le.template_name,\n" +
    "    lfs.step_order,\n" +
    "    llq.lead_qualification,\n" +
    "    toString(t.values) AS values_json\n" +
    "FROM postgres.yago.thread t\n" +
    "JOIN postgres.yago.lifecycle_executions le\n" +
    "    ON JSONExtractString(t.metadata, 'execution_id') = toString(le.id)\n" +
    "JOIN postgres.yago.lifecycle_flow_steps lfs\n" +
    "    ON le.step_id = lfs.id\n" +
    "LEFT JOIN last_lead_qualification llq\n" +
    "    ON llq.company_id = le.company_id\n" +
    "WHERE le.flow_id = 1\n" +
    "    AND le.sent_at >= '2026-02-03'" +
    stepClause +
    "\nORDER BY t.thread_id\nLIMIT 10000";

  var result = await queryPostHog(query);

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

export async function fetchInboundThreadsFromPostHog() {
  // Fetch ALL threads — inbound determination happens in JS by comparing
  // first human message timestamp vs first lifecycle execution per phone
  var query =
    "SELECT\n" +
    "    t.thread_id,\n" +
    "    JSONExtractString(t.metadata, 'phone_number') AS phone_from_meta,\n" +
    "    JSONExtractString(t.metadata, 'phone') AS phone2,\n" +
    "    JSONExtractString(t.metadata, 'wa_id') AS wa_id,\n" +
    "    JSONExtractString(t.metadata, 'contact_phone') AS contact_phone,\n" +
    "    t.created_at AS thread_created_at,\n" +
    "    toString(t.values) AS values_json\n" +
    "FROM postgres.yago.thread t\n" +
    "WHERE t.created_at >= '2026-02-03'\n" +
    "ORDER BY t.thread_id\n" +
    "LIMIT 10000";

  var result = await queryPostHog(query);

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
    "FROM postgres.yago.lifecycle_executions le\n" +
    "JOIN postgres.yago.lifecycle_flow_steps lfs ON le.step_id = lfs.id\n" +
    "WHERE le.sent_at >= '2025-01-01'\n" +
    "GROUP BY le.phone_number";

  var result = await queryPostHog(query);
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
