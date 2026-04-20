// Compute { [template_name]: { link, booked } } from the meetings array.
// `link` = meeting shared via message; `booked` = meeting actually scheduled
// (phone matches a HubSpot CRM meeting).
// Mirrors the inline logic at src/App.jsx (outbound/templates render) so both
// the existing Templates subtab and the new Lifecycles screen can share it.
export function computeTemplateMeetingStats(meetings, opts) {
  opts = opts || {};
  var realMode = !!opts.realMode;
  var crmMeetingPhones = opts.crmMeetingPhones || null;
  var templateFilter = opts.templateFilter || null;

  var stats = {};
  if (!meetings || !meetings.length) return stats;

  for (var i = 0; i < meetings.length; i++) {
    var m = meetings[i];
    if (realMode && m.au) continue;
    var tr = m.tr || [];
    for (var ti = 0; ti < tr.length; ti++) {
      var tpl = tr[ti];
      if (templateFilter && !templateFilter(tpl)) continue;
      if (!stats[tpl]) stats[tpl] = { link: 0, booked: 0 };
      if (m.ml) stats[tpl].link++;
      if (crmMeetingPhones) {
        var ph = (m.p || "").replace(/\D/g, "");
        if (ph && (crmMeetingPhones[ph] || crmMeetingPhones[ph.slice(-11)] || crmMeetingPhones[ph.slice(-10)])) {
          stats[tpl].booked++;
        }
      }
    }
  }
  return stats;
}
