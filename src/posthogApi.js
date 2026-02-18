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

export function expandThreadMessages(threads) {
  var rows = [];

  for (var i = 0; i < threads.length; i++) {
    var t = threads[i];
    var messages = [];

    if (t.values_json) {
      try {
        var values = JSON.parse(t.values_json);
        if (values && values.messages) {
          messages = values.messages;
        }
      } catch (e) {
        // Skip threads with unparseable values
      }
    }

    var sentAtDate = t.template_sent_at ? new Date(t.template_sent_at) : null;
    var sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

    // Check if thread has any human response (processCSVRows uses phone presence as signal)
    var hasHumanResponse = false;
    for (var h = 0; h < messages.length; h++) {
      if (messages[h].type === "human") { hasHumanResponse = true; break; }
    }
    // Only set phone_number on rows from threads with human responses
    var phoneForRows = hasHumanResponse ? (t.phone_number || "") : "";

    if (messages.length === 0) {
      // Even if no messages, emit one row so the thread is counted as contactado
      rows.push({
        thread_id: t.thread_id,
        phone_number: "",
        template_sent_at: t.template_sent_at || "",
        template_id: t.template_id || "",
        template_name: t.template_name || "",
        step_order: t.step_order != null ? String(t.step_order) : "",
        lead_qualification: t.lead_qualification || "",
        message_type: "ai",
        message_datetime: t.template_sent_at || "",
        message_content: "",
        is_valid_response: "false",
      });
      continue;
    }

    for (var j = 0; j < messages.length; j++) {
      var msg = messages[j];
      var msgType = msg.type === "human" ? "human" : msg.type === "tool" ? "tool" : "ai";

      // Ensure content is always a string (LangChain can store arrays for multi-modal)
      var msgContent = "";
      if (typeof msg.content === "string") {
        msgContent = msg.content;
      } else if (Array.isArray(msg.content)) {
        msgContent = msg.content.map(function(block) {
          if (typeof block === "string") return block;
          if (block && block.text) return block.text;
          return "";
        }).join("");
      }

      // Only set template_name on the actual template message, not on Yago's
      // conversational AI responses. Use per-message metadata first, then fall back
      // to execution-level template_name for the first AI message only.
      var msgTemplateName = "";
      if (msg.additional_kwargs && msg.additional_kwargs.metadata && msg.additional_kwargs.metadata.template_name) {
        msgTemplateName = msg.additional_kwargs.metadata.template_name;
      } else if (msgType === "ai" && j === 0) {
        // First AI message is the template — use execution-level name as fallback
        msgTemplateName = t.template_name || "";
      }

      // Extract timestamp from additional_kwargs.metadata.timestamp
      var msgDatetime = "";
      if (msg.additional_kwargs && msg.additional_kwargs.metadata && msg.additional_kwargs.metadata.timestamp) {
        var ts = msg.additional_kwargs.metadata.timestamp;
        // Convert Unix timestamp (seconds) to ISO string
        if (typeof ts === "number") {
          msgDatetime = new Date(ts * 1000).toISOString();
        } else {
          msgDatetime = String(ts);
        }
      }

      var isValid = false;
      if (msgType === "human" && sentAtDate && msgDatetime) {
        var msgDate = new Date(msgDatetime);
        if (!isNaN(msgDate.getTime())) {
          isValid = msgDate >= sentAtDate && msgDate <= new Date(sentAtDate.getTime() + sevenDaysMs);
        }
      }

      rows.push({
        thread_id: t.thread_id,
        phone_number: phoneForRows,
        template_sent_at: t.template_sent_at || "",
        template_id: t.template_id || "",
        template_name: msgTemplateName,
        step_order: t.step_order != null ? String(t.step_order) : "",
        lead_qualification: t.lead_qualification || "",
        message_type: msgType,
        message_datetime: msgDatetime,
        message_content: msgContent,
        is_valid_response: String(isValid),
      });
    }
  }

  return rows;
}
