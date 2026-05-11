/**
 * Team Calendar Sync - direct-to-BigQuery edition.
 *
 * Pulls every GCal calendar shared with this account + every Calendly org event,
 * then upserts both into BigQuery via SA-authenticated REST calls.
 *
 * Required Script Properties (Project Settings -> Script Properties):
 *   BQ_SA_JSON       Full service-account JSON (paste the key file contents).
 *   BQ_PROJECT_ID    "no-more-mondays-analytics"
 *   BQ_DATASET       "nmm_calendar"
 *   CALENDLY_TOKEN   Calendly Personal Access Token.
 *
 * One-time setup (run in this order):
 *   probeBQ()             Verifies SA auth + dataset reach.
 *   syncAllToBQ()         Pulls + writes once. Confirm tables populate.
 *   installLiveTrigger()  Schedules syncAllToBQ every 5 minutes.
 */

const CONFIG = {
  ALLOWED_DOMAINS: ['nomoremondays.io'],
  LOOKAHEAD_DAYS: 30,
  TRIGGER_MINUTES: 5,

  // Calendly invitee fetch is the most expensive call. Cap concurrent events
  // we fetch invitees for, in case the org grows. 300 should be plenty.
  MAX_CALENDLY_INVITEE_FETCHES: 300,
};

const BQ_SCOPE = 'https://www.googleapis.com/auth/bigquery';

const _CACHE = { token: null, tokenExpiry: 0 };

// ============================================================
// ENTRY POINTS
// ============================================================

function probeBQ() {
  const t = getBQAccessToken_();
  Logger.log('Got SA access token (length=' + (t ? t.length : 0) + ')');
  const projectId = mustProperty_('BQ_PROJECT_ID');
  const dataset = mustProperty_('BQ_DATASET');
  const result = bqQuery_(
    `SELECT '${projectId}.${dataset}' AS reach, CURRENT_TIMESTAMP() AS now`,
    []
  );
  Logger.log('BQ reachable: ' + JSON.stringify(result.rows[0]));

  // Touch each target table to confirm permissions
  const tables = [
    'raw_gcal_events',
    'raw_gcal_events_staging',
    'raw_calendly_events',
    'raw_calendly_events_staging',
    'sync_log',
  ];
  for (const t of tables) {
    try {
      const r = bqQuery_(
        `SELECT COUNT(*) AS n FROM \`${projectId}.${dataset}.${t}\``,
        []
      );
      Logger.log(`  ${t}: ${r.rows[0].n} rows`);
    } catch (e) {
      Logger.log(`  ${t}: ERROR ${e}`);
    }
  }
}

function syncAllToBQ() {
  const runId = Utilities.getUuid();
  const startedAt = new Date();
  const ingestedAt = startedAt.toISOString();

  // Window starts at midnight UTC today, so events earlier in the day (already
  // in the past relative to sync time) are still captured. Goes
  // LOOKAHEAD_DAYS forward.
  const windowStart = new Date(Date.UTC(
    startedAt.getUTCFullYear(),
    startedAt.getUTCMonth(),
    startedAt.getUTCDate()
  ));
  const windowEnd = new Date(windowStart.getTime() + CONFIG.LOOKAHEAD_DAYS * 86400 * 1000);

  Logger.log(
    `=== sync run ${runId} ${startedAt.toISOString()} window=[${windowStart.toISOString()}, ${windowEnd.toISOString()}] ===`
  );

  // GCal
  let gcalCount = 0, gcalErr = null;
  try {
    const rows = pullGCalEvents_(windowStart, windowEnd, ingestedAt);
    gcalCount = rows.length;
    bqUpsertGCal_(rows, windowStart, windowEnd);
    Logger.log(`gcal: pulled ${gcalCount} rows, upserted into raw_gcal_events`);
  } catch (e) {
    gcalErr = String(e);
    Logger.log('gcal FAILED: ' + e);
  }
  bqLogRun_(runId, startedAt, new Date(), 'gcal', 'team', gcalCount, gcalErr ? 'error' : 'ok', gcalErr);

  // Calendly
  let calCount = 0, calErr = null;
  try {
    const rows = pullCalendlyEvents_(windowStart, windowEnd, ingestedAt);
    calCount = rows.length;
    bqUpsertCalendly_(rows, windowStart, windowEnd);
    Logger.log(`calendly: pulled ${calCount} rows, upserted into raw_calendly_events`);
  } catch (e) {
    calErr = String(e);
    Logger.log('calendly FAILED: ' + e);
  }
  bqLogRun_(runId, startedAt, new Date(), 'calendly', 'org', calCount, calErr ? 'error' : 'ok', calErr);

  Logger.log(`=== run ${runId} done in ${(Date.now() - startedAt.getTime())/1000}s ===`);
}

function installLiveTrigger() {
  ScriptApp.getProjectTriggers()
    .filter(function (t) {
      const fn = t.getHandlerFunction();
      return fn === 'syncAllToBQ' || fn === 'syncAll';
    })
    .forEach(function (t) { ScriptApp.deleteTrigger(t); });

  ScriptApp.newTrigger('syncAllToBQ')
    .timeBased()
    .everyMinutes(CONFIG.TRIGGER_MINUTES)
    .create();
  Logger.log('Trigger installed: syncAllToBQ every ' + CONFIG.TRIGGER_MINUTES + ' minutes');
}

function listTriggers() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    Logger.log(t.getHandlerFunction() + ' :: ' + t.getEventType());
  });
}

// Diagnostic: walks each Calendly call and dumps response details so we can
// see exactly where /scheduled_events is choking.
// Diagnostic: fetch a few of Ben's NSC events directly via the advanced API
// and log what the raw response looks like. Helps debug TZ ingest issues.
function probeBenNSC() {
  const tMin = new Date().toISOString();
  const tMax = new Date(Date.now() + 14 * 86400 * 1000).toISOString();
  const resp = Calendar.Events.list('ben@nomoremondays.io', {
    timeMin: tMin,
    timeMax: tMax,
    singleEvents: true,
    orderBy: 'startTime',
    maxResults: 50,
    q: 'NSC',
  });
  Logger.log('Calendar timeZone field on response: ' + resp.timeZone);
  const items = resp.items || [];
  Logger.log('Found ' + items.length + ' matching events');
  items.slice(0, 5).forEach(function (ev, i) {
    Logger.log('--- event ' + i + ' ---');
    Logger.log('  id: ' + ev.id);
    Logger.log('  iCalUID: ' + ev.iCalUID);
    Logger.log('  summary: ' + ev.summary);
    Logger.log('  start.dateTime: ' + (ev.start && ev.start.dateTime));
    Logger.log('  start.timeZone: ' + (ev.start && ev.start.timeZone));
    Logger.log('  end.dateTime: ' + (ev.end && ev.end.dateTime));
    Logger.log('  end.timeZone: ' + (ev.end && ev.end.timeZone));
    Logger.log('  recurringEventId: ' + ev.recurringEventId);
    Logger.log('  originalStartTime: ' + JSON.stringify(ev.originalStartTime));
    if (ev.start && ev.start.dateTime) {
      const parsed = new Date(ev.start.dateTime);
      Logger.log('  parsed UTC: ' + parsed.toISOString());
      Logger.log('  parsed in GMT+1: ' + Utilities.formatDate(parsed, 'Europe/London', 'yyyy-MM-dd HH:mm z'));
      Logger.log('  parsed in PHX:   ' + Utilities.formatDate(parsed, 'America/Phoenix', 'yyyy-MM-dd HH:mm z'));
    }
  });
}

function probeCalendly() {
  const token = mustProperty_('CALENDLY_TOKEN');

  Logger.log('=== /users/me ===');
  const me = calendlyFetch_(token, '/users/me');
  const orgUri = me.resource.current_organization;
  Logger.log('  user: ' + me.resource.email + ' / orgUri: ' + orgUri);

  Logger.log('=== /organization_memberships ===');
  const memb = calendlyFetch_(token, '/organization_memberships', {
    organization: orgUri,
    count: 100,
  });
  Logger.log('  members: ' + (memb.collection || []).length);
  Logger.log('  pagination: ' + JSON.stringify(memb.pagination));

  const minStart = new Date().toISOString();
  const maxStart = new Date(Date.now() + 30 * 86400 * 1000).toISOString();
  Logger.log('=== /scheduled_events ===');
  Logger.log('  min_start_time = ' + minStart);
  Logger.log('  max_start_time = ' + maxStart);
  try {
    const events = calendlyFetch_(token, '/scheduled_events', {
      organization: orgUri,
      min_start_time: minStart,
      max_start_time: maxStart,
      status: 'active',
      count: 100,
    });
    Logger.log('  events: ' + (events.collection || []).length);
    Logger.log('  pagination: ' + JSON.stringify(events.pagination));
    if ((events.collection || []).length > 0) {
      Logger.log('  first event uri: ' + events.collection[0].uri);
    }
  } catch (e) {
    Logger.log('  FAILED: ' + e);
  }
}

// ============================================================
// GOOGLE CALENDAR PULL
// ============================================================

function listSharedCalendars_() {
  const out = [];
  let pageToken = null;
  do {
    const resp = Calendar.CalendarList.list({
      pageToken: pageToken,
      minAccessRole: 'reader',
      showHidden: true,
    });
    (resp.items || []).forEach(function (c) {
      const id = (c.id || '').toLowerCase();
      if (c.primary) return;
      if (id.indexOf('@') === -1) return;
      if (id.indexOf('@group.v.calendar.google.com') !== -1) return;
      const ok = CONFIG.ALLOWED_DOMAINS.some(function (d) {
        return id.indexOf('@' + d.toLowerCase()) !== -1;
      });
      if (!ok) return;
      out.push({
        id: c.id,
        summary: c.summaryOverride || c.summary || c.id,
        accessRole: c.accessRole,
        timeZone: c.timeZone || null,
      });
    });
    pageToken = resp.nextPageToken;
  } while (pageToken);
  return out;
}

function pullGCalEvents_(timeMin, timeMax, ingestedAt) {
  const calendars = listSharedCalendars_();
  Logger.log('GCal: ' + calendars.length + ' shared calendars in scope');

  bqUpsertCalendarTimezones_(calendars, ingestedAt);

  const tMin = timeMin.toISOString();
  const tMax = timeMax.toISOString();

  const rows = [];
  for (const cal of calendars) {
    let pageToken = null;
    let count = 0;
    try {
      do {
        const resp = Calendar.Events.list(cal.id, {
          timeMin: tMin,
          timeMax: tMax,
          singleEvents: true,
          orderBy: 'startTime',
          maxResults: 2500,
          showDeleted: false,
          pageToken: pageToken || undefined,
        });
        const items = resp.items || [];
        for (const ev of items) {
          if (ev.status === 'cancelled') continue;
          rows.push(gcalEventToRow_(cal.id, ev, ingestedAt));
          count++;
        }
        pageToken = resp.nextPageToken || null;
      } while (pageToken);
    } catch (e) {
      Logger.log('  WARN: Calendar.Events.list failed for ' + cal.id + ': ' + e);
      continue;
    }
    Logger.log('  ' + cal.id + ': ' + count);
  }
  return rows;
}

function gcalEventToRow_(userEmail, ev, ingestedAt) {
  const isAllDay = !!(ev.start && ev.start.date && !ev.start.dateTime);

  let startTime = null, endTime = null, startDate = null, endDate = null;
  let eventStartTs, eventEndTs;
  if (isAllDay) {
    startDate = ev.start.date;
    endDate   = ev.end ? ev.end.date : null;
    eventStartTs = new Date(startDate + 'T00:00:00Z').toISOString();
    eventEndTs   = new Date((endDate || startDate) + 'T00:00:00Z').toISOString();
  } else {
    // dateTime is RFC3339 with offset; new Date() parses to absolute UTC instant.
    startTime = new Date(ev.start.dateTime).toISOString();
    endTime   = new Date(ev.end.dateTime).toISOString();
    eventStartTs = startTime;
    eventEndTs   = endTime;
  }

  const attendeesArr = (ev.attendees || []).map(function (g) {
    return (g.email || '') + ':' + (g.responseStatus || '');
  });

  const isRecurring = !!ev.recurringEventId;
  const conferenceType = ev.conferenceData && ev.conferenceData.conferenceSolution
    ? (ev.conferenceData.conferenceSolution.name || null) : null;

  return {
    user_email:         userEmail,
    event_id:           ev.id,
    ical_uid:           ev.iCalUID || ev.id,
    event_start_ts:     eventStartTs,
    event_end_ts:       eventEndTs,
    start_time:         startTime,
    end_time:           endTime,
    start_date:         startDate,
    end_date:           endDate,
    is_all_day:         isAllDay,
    is_recurring:       isRecurring,
    recurring_event_id: ev.recurringEventId || null,
    summary:            ev.summary || null,
    description:        ev.description || null,
    location:           ev.location || null,
    status:             ev.status || null,
    organizer_email:    (ev.organizer && ev.organizer.email) || null,
    creator_email:      (ev.creator && ev.creator.email) || null,
    attendees:          attendeesArr.length > 0 ? attendeesArr.join('; ') : null,
    attendee_count:     attendeesArr.length,
    visibility:         ev.visibility || 'default',
    transparency:       ev.transparency || 'opaque',
    hangout_link:       ev.hangoutLink || null,
    conference_type:    conferenceType,
    created:            ev.created || null,
    updated:            ev.updated || null,
    ingested_at:        ingestedAt,
  };
}

// ============================================================
// CALENDLY PULL
// ============================================================

function pullCalendlyEvents_(timeMin, timeMax, ingestedAt) {
  const token = mustProperty_('CALENDLY_TOKEN');
  const me = calendlyFetch_(token, '/users/me');
  const orgUri = me.resource.current_organization;
  const PAGE_COUNT = 100;
  const MAX_PAGES = 50;

  // Member map for host_email/host_name. Paginate by following pagination.next_page
  // (Calendly stores tokens against the original full query string, including
  // microsecond-precision timestamps it normalizes — re-building the URL ourselves
  // breaks the token).
  const memberMap = {};
  let nextUrl = null;
  let pageNum = 0;
  do {
    const resp = nextUrl
      ? calendlyFetch_(token, nextUrl)
      : calendlyFetch_(token, '/organization_memberships', {
          organization: orgUri, count: PAGE_COUNT,
        });
    const collection = resp.collection || [];
    collection.forEach(function (m) {
      memberMap[m.user.uri] = { email: m.user.email, name: m.user.name };
    });
    nextUrl = (collection.length >= PAGE_COUNT && resp.pagination && resp.pagination.next_page)
      ? resp.pagination.next_page
      : null;
    pageNum++;
  } while (nextUrl && pageNum < MAX_PAGES);

  // Org-wide scheduled events in window — same pattern.
  const events = [];
  nextUrl = null;
  pageNum = 0;
  const minStart = timeMin.toISOString();
  const maxStart = timeMax.toISOString();
  do {
    const resp = nextUrl
      ? calendlyFetch_(token, nextUrl)
      : calendlyFetch_(token, '/scheduled_events', {
          organization: orgUri,
          min_start_time: minStart,
          max_start_time: maxStart,
          status: 'active',
          count: PAGE_COUNT,
        });
    const collection = resp.collection || [];
    collection.forEach(function (e) { events.push(e); });
    nextUrl = (collection.length >= PAGE_COUNT && resp.pagination && resp.pagination.next_page)
      ? resp.pagination.next_page
      : null;
    pageNum++;
  } while (nextUrl && pageNum < MAX_PAGES);

  Logger.log('Calendly: ' + Object.keys(memberMap).length + ' org members, ' + events.length + ' scheduled events');

  const rows = [];
  let inviteeFetches = 0;
  events.forEach(function (ev) {
    const hostUri = (ev.event_memberships && ev.event_memberships[0] && ev.event_memberships[0].user) || '';
    const host = memberMap[hostUri] || { email: '', name: '' };
    const eventUuid = (ev.uri || '').split('/').pop();

    let invitees = [];
    if (inviteeFetches < CONFIG.MAX_CALENDLY_INVITEE_FETCHES && eventUuid) {
      try {
        const r = calendlyFetch_(token, '/scheduled_events/' + eventUuid + '/invitees', { count: 100 });
        invitees = r.collection || [];
        inviteeFetches++;
      } catch (e) {
        Logger.log('  invitee fetch failed for ' + ev.uri + ': ' + e);
      }
    }

    rows.push(calendlyEventToRow_(host, ev, invitees, ingestedAt));
  });

  return rows;
}

function calendlyEventToRow_(host, ev, invitees, ingestedAt) {
  const loc = ev.location || {};
  const start = new Date(ev.start_time);
  const end = new Date(ev.end_time);
  const durationMin = Math.round((end - start) / 60000);

  const inviteesSummary = invitees.map(function (i) {
    return (i.name || '') + ' <' + (i.email || '') + '> [' + (i.status || '') + ']';
  }).join('; ');

  const first = invitees[0] || {};
  const qa = first.questions_and_answers && first.questions_and_answers.length
    ? JSON.stringify(first.questions_and_answers) : null;

  return {
    host_email:                          host.email || '',
    event_uuid:                          (ev.uri || '').split('/').pop(),
    event_uri:                           ev.uri || null,
    host_name:                           host.name || null,
    event_type_name:                     ev.name || null,
    event_type_uri:                      ev.event_type || null,
    start_time:                          ev.start_time,
    end_time:                            ev.end_time,
    duration_min:                        durationMin,
    status:                              ev.status || null,
    location_type:                       loc.type || null,
    location_url_or_address:             loc.join_url || loc.location || null,
    invitee_count:                       invitees.length,
    invitees_summary:                    inviteesSummary || null,
    first_invitee_email:                 first.email || null,
    first_invitee_name:                  first.name || null,
    first_invitee_status:                first.status || null,
    first_invitee_questions_and_answers: qa,
    meeting_notes:                       ev.meeting_notes_plain || null,
    cancel_url:                          first.cancel_url || null,
    reschedule_url:                      first.reschedule_url || null,
    created_at:                          ev.created_at || null,
    updated_at:                          ev.updated_at || null,
    ingested_at:                         ingestedAt,
  };
}

function calendlyFetch_(token, pathOrUrl, params) {
  let url;
  if (pathOrUrl.indexOf('http') === 0) {
    url = pathOrUrl; // full URL — used for pagination via next_page
  } else {
    url = 'https://api.calendly.com' + pathOrUrl;
    if (params) {
      const qs = [];
      Object.keys(params).forEach(function (k) {
        qs.push(encodeURIComponent(k) + '=' + encodeURIComponent(params[k]));
      });
      if (qs.length) url += '?' + qs.join('&');
    }
  }
  const resp = UrlFetchApp.fetch(url, {
    headers: { 'Authorization': 'Bearer ' + token },
    muteHttpExceptions: true,
  });
  const code = resp.getResponseCode();
  if (code < 200 || code >= 300) {
    throw new Error('Calendly API ' + code + ' on ' + pathOrUrl + ': ' + resp.getContentText().substring(0, 500));
  }
  return JSON.parse(resp.getContentText());
}

// Calendly pagination is finicky — sometimes returns "" or stale tokens at end
// of pagination. Treat anything non-truthy or wrapped in next_page URL as null.
function nextPageToken_(resp) {
  if (!resp || !resp.pagination) return null;
  const t = resp.pagination.next_page_token;
  if (typeof t !== 'string') return null;
  const trimmed = t.trim();
  if (trimmed.length === 0) return null;
  // If pagination.next_page is also null/missing, there are no more pages.
  if (!resp.pagination.next_page) return null;
  return trimmed;
}

// ============================================================
// BIGQUERY UPSERT
// ============================================================

const GCAL_FIELDS = [
  ['user_email',         'STRING'],
  ['event_id',           'STRING'],
  ['ical_uid',           'STRING'],
  ['event_start_ts',     'TIMESTAMP'],
  ['event_end_ts',       'TIMESTAMP'],
  ['start_time',         'TIMESTAMP'],
  ['end_time',           'TIMESTAMP'],
  ['start_date',         'DATE'],
  ['end_date',           'DATE'],
  ['is_all_day',         'BOOL'],
  ['is_recurring',       'BOOL'],
  ['recurring_event_id', 'STRING'],
  ['summary',            'STRING'],
  ['description',        'STRING'],
  ['location',           'STRING'],
  ['status',             'STRING'],
  ['organizer_email',    'STRING'],
  ['creator_email',      'STRING'],
  ['attendees',          'STRING'],
  ['attendee_count',     'INT64'],
  ['visibility',         'STRING'],
  ['transparency',       'STRING'],
  ['hangout_link',       'STRING'],
  ['conference_type',    'STRING'],
  ['created',            'TIMESTAMP'],
  ['updated',            'TIMESTAMP'],
  ['ingested_at',        'TIMESTAMP'],
];

const CALENDLY_FIELDS = [
  ['host_email',                          'STRING'],
  ['event_uuid',                          'STRING'],
  ['event_uri',                           'STRING'],
  ['host_name',                           'STRING'],
  ['event_type_name',                     'STRING'],
  ['event_type_uri',                      'STRING'],
  ['start_time',                          'TIMESTAMP'],
  ['end_time',                            'TIMESTAMP'],
  ['duration_min',                        'INT64'],
  ['status',                              'STRING'],
  ['location_type',                       'STRING'],
  ['location_url_or_address',             'STRING'],
  ['invitee_count',                       'INT64'],
  ['invitees_summary',                    'STRING'],
  ['first_invitee_email',                 'STRING'],
  ['first_invitee_name',                  'STRING'],
  ['first_invitee_status',                'STRING'],
  ['first_invitee_questions_and_answers', 'STRING'],
  ['meeting_notes',                       'STRING'],
  ['cancel_url',                          'STRING'],
  ['reschedule_url',                      'STRING'],
  ['created_at',                          'TIMESTAMP'],
  ['updated_at',                          'TIMESTAMP'],
  ['ingested_at',                         'TIMESTAMP'],
];

function bqUpsertGCal_(rows, windowStart, windowEnd) {
  const projectId = mustProperty_('BQ_PROJECT_ID');
  const dataset = mustProperty_('BQ_DATASET');
  const tableProd = `\`${projectId}.${dataset}.raw_gcal_events\``;
  const tableStg  = `\`${projectId}.${dataset}.raw_gcal_events_staging\``;

  // Dedupe: recurring-event occurrences share event_id but have distinct
  // event_start_ts. The MERGE ON clause uses all three as the matching key.
  const seen = new Set();
  rows = rows.filter(function (r) {
    const k = r.user_email + '|' + r.event_id + '|' + r.event_start_ts;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  // 1) Truncate staging
  bqQuery_(`TRUNCATE TABLE ${tableStg}`, []);

  if (rows.length === 0) {
    Logger.log('gcal: no rows to upsert; skipping insert + merge');
    return;
  }

  // 2) Insert into staging via UNNEST(@rows)
  const insertSql = `
    INSERT INTO ${tableStg} (${GCAL_FIELDS.map(function (f) { return f[0]; }).join(', ')})
    SELECT ${GCAL_FIELDS.map(function (f) { return f[0]; }).join(', ')}
    FROM UNNEST(@rows)
  `;
  bqQuery_(insertSql, [
    { name: 'rows', type: { type: 'ARRAY', arrayType: structTypeFor_(GCAL_FIELDS) },
      value: { arrayValues: rows.map(function (r) { return rowToParameter_(r, GCAL_FIELDS); }) } },
  ]);

  // 3) MERGE staging -> prod. BQ disallows subqueries in WHEN clauses, so we
  //    pass the user-email list as a parameter array instead.
  const userEmails = Array.from(new Set(
    rows.map(function (r) { return r.user_email; }).filter(Boolean)
  ));
  const updateAssigns = GCAL_FIELDS
    .filter(function (f) { return f[0] !== 'user_email' && f[0] !== 'event_id'; })
    .map(function (f) { return `${f[0]} = s.${f[0]}`; })
    .join(', ');
  const insertCols = GCAL_FIELDS.map(function (f) { return f[0]; }).join(', ');
  const insertVals = GCAL_FIELDS.map(function (f) { return 's.' + f[0]; }).join(', ');

  // ON clause includes event_start_ts so recurring-event occurrences are
  // upserted as separate rows.
  const mergeSql = `
    MERGE INTO ${tableProd} t
    USING ${tableStg} s
    ON t.user_email = s.user_email
       AND t.event_id = s.event_id
       AND t.event_start_ts = s.event_start_ts
    WHEN MATCHED THEN UPDATE SET ${updateAssigns}
    WHEN NOT MATCHED BY TARGET THEN INSERT (${insertCols}) VALUES (${insertVals})
    WHEN NOT MATCHED BY SOURCE
      AND t.user_email IN UNNEST(@user_emails)
      AND t.event_start_ts >= @window_start
      AND t.event_start_ts <  @window_end
    THEN DELETE
  `;
  bqQuery_(mergeSql, [
    { name: 'window_start', type: { type: 'TIMESTAMP' }, value: { value: windowStart.toISOString() } },
    { name: 'window_end',   type: { type: 'TIMESTAMP' }, value: { value: windowEnd.toISOString() } },
    { name: 'user_emails',  type: { type: 'ARRAY', arrayType: { type: 'STRING' } },
      value: { arrayValues: userEmails.map(function (e) { return { value: e }; }) } },
  ]);
}

function bqUpsertCalendly_(rows, windowStart, windowEnd) {
  const projectId = mustProperty_('BQ_PROJECT_ID');
  const dataset = mustProperty_('BQ_DATASET');
  const tableProd = `\`${projectId}.${dataset}.raw_calendly_events\``;
  const tableStg  = `\`${projectId}.${dataset}.raw_calendly_events_staging\``;

  bqQuery_(`TRUNCATE TABLE ${tableStg}`, []);

  if (rows.length === 0) {
    Logger.log('calendly: no rows; skipping');
    return;
  }

  const insertSql = `
    INSERT INTO ${tableStg} (${CALENDLY_FIELDS.map(function (f) { return f[0]; }).join(', ')})
    SELECT ${CALENDLY_FIELDS.map(function (f) { return f[0]; }).join(', ')}
    FROM UNNEST(@rows)
  `;
  bqQuery_(insertSql, [
    { name: 'rows', type: { type: 'ARRAY', arrayType: structTypeFor_(CALENDLY_FIELDS) },
      value: { arrayValues: rows.map(function (r) { return rowToParameter_(r, CALENDLY_FIELDS); }) } },
  ]);

  const hostEmails = Array.from(new Set(
    rows.map(function (r) { return r.host_email; }).filter(Boolean)
  ));
  const updateAssigns = CALENDLY_FIELDS
    .filter(function (f) { return f[0] !== 'host_email' && f[0] !== 'event_uuid'; })
    .map(function (f) { return `${f[0]} = s.${f[0]}`; })
    .join(', ');
  const insertCols = CALENDLY_FIELDS.map(function (f) { return f[0]; }).join(', ');
  const insertVals = CALENDLY_FIELDS.map(function (f) { return 's.' + f[0]; }).join(', ');

  const mergeSql = `
    MERGE INTO ${tableProd} t
    USING ${tableStg} s
    ON t.host_email = s.host_email AND t.event_uuid = s.event_uuid
    WHEN MATCHED THEN UPDATE SET ${updateAssigns}
    WHEN NOT MATCHED BY TARGET THEN INSERT (${insertCols}) VALUES (${insertVals})
    WHEN NOT MATCHED BY SOURCE
      AND t.host_email IN UNNEST(@host_emails)
      AND t.start_time >= @window_start
      AND t.start_time <  @window_end
    THEN DELETE
  `;
  bqQuery_(mergeSql, [
    { name: 'window_start', type: { type: 'TIMESTAMP' }, value: { value: windowStart.toISOString() } },
    { name: 'window_end',   type: { type: 'TIMESTAMP' }, value: { value: windowEnd.toISOString() } },
    { name: 'host_emails',  type: { type: 'ARRAY', arrayType: { type: 'STRING' } },
      value: { arrayValues: hostEmails.map(function (e) { return { value: e }; }) } },
  ]);
}

function bqUpsertCalendarTimezones_(calendars, ingestedAt) {
  const projectId = mustProperty_('BQ_PROJECT_ID');
  const dataset = mustProperty_('BQ_DATASET');
  const tableProd = `\`${projectId}.${dataset}.calendar_timezones\``;

  const rows = calendars
    .filter(function (c) { return c.id && c.timeZone; })
    .map(function (c) { return { user_email: c.id, time_zone: c.timeZone }; });
  if (rows.length === 0) {
    Logger.log('calendar_timezones: nothing to upsert');
    return;
  }

  // Build a SELECT ... UNION ALL source — small (<20 calendars), no staging table needed.
  const sourceSql = rows
    .map(function (_, i) {
      return `SELECT @email_${i} AS user_email, @tz_${i} AS time_zone, @updated_at AS updated_at`;
    })
    .join(' UNION ALL ');
  const params = [
    { name: 'updated_at', type: { type: 'TIMESTAMP' }, value: { value: ingestedAt } },
  ];
  rows.forEach(function (r, i) {
    params.push({ name: 'email_' + i, type: { type: 'STRING' }, value: { value: r.user_email } });
    params.push({ name: 'tz_' + i,    type: { type: 'STRING' }, value: { value: r.time_zone } });
  });

  const mergeSql = `
    MERGE INTO ${tableProd} t
    USING (${sourceSql}) s
    ON t.user_email = s.user_email
    WHEN MATCHED THEN UPDATE SET time_zone = s.time_zone, updated_at = s.updated_at
    WHEN NOT MATCHED THEN INSERT (user_email, time_zone, updated_at)
      VALUES (s.user_email, s.time_zone, s.updated_at)
  `;
  bqQuery_(mergeSql, params);
  Logger.log('calendar_timezones: upserted ' + rows.length + ' rows');
}

function bqLogRun_(runId, started, finished, source, scope, eventsPulled, status, errorMessage) {
  const projectId = mustProperty_('BQ_PROJECT_ID');
  const dataset = mustProperty_('BQ_DATASET');
  const sql = `
    INSERT INTO \`${projectId}.${dataset}.sync_log\`
      (run_id, started_at, finished_at, source, scope, events_pulled, status, error_message)
    VALUES (@run_id, @started_at, @finished_at, @source, @scope, @events_pulled, @status, @error_message)
  `;
  try {
    bqQuery_(sql, [
      { name: 'run_id',         type: { type: 'STRING' },    value: { value: runId } },
      { name: 'started_at',     type: { type: 'TIMESTAMP' }, value: { value: started.toISOString() } },
      { name: 'finished_at',    type: { type: 'TIMESTAMP' }, value: { value: finished.toISOString() } },
      { name: 'source',         type: { type: 'STRING' },    value: { value: source } },
      { name: 'scope',          type: { type: 'STRING' },    value: { value: scope || null } },
      { name: 'events_pulled',  type: { type: 'INT64' },     value: { value: String(eventsPulled || 0) } },
      { name: 'status',         type: { type: 'STRING' },    value: { value: status } },
      { name: 'error_message',  type: { type: 'STRING' },    value: { value: errorMessage || null } },
    ]);
  } catch (e) {
    Logger.log('sync_log write failed: ' + e);
  }
}

// ============================================================
// BQ HELPERS - JWT, query, parameter typing
// ============================================================

function getBQAccessToken_() {
  const now = Math.floor(Date.now() / 1000);
  if (_CACHE.token && _CACHE.tokenExpiry > now + 60) return _CACHE.token;

  const sa = JSON.parse(mustProperty_('BQ_SA_JSON'));
  const header = { alg: 'RS256', typ: 'JWT' };
  const claim = {
    iss: sa.client_email,
    scope: BQ_SCOPE,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };
  const headerB64 = b64urlNoPad_(JSON.stringify(header));
  const claimB64  = b64urlNoPad_(JSON.stringify(claim));
  const signingInput = headerB64 + '.' + claimB64;
  const signature = Utilities.computeRsaSha256Signature(signingInput, sa.private_key);
  const sigB64 = b64urlNoPad_(signature);
  const jwt = signingInput + '.' + sigB64;

  const resp = UrlFetchApp.fetch('https://oauth2.googleapis.com/token', {
    method: 'post',
    payload: {
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    },
    muteHttpExceptions: true,
  });
  const code = resp.getResponseCode();
  const body = resp.getContentText();
  if (code < 200 || code >= 300) {
    throw new Error('Token exchange failed: ' + code + ' ' + body);
  }
  const tok = JSON.parse(body);
  _CACHE.token = tok.access_token;
  _CACHE.tokenExpiry = now + (tok.expires_in || 3600);
  return tok.access_token;
}

function b64urlNoPad_(input) {
  // Apps Script base64EncodeWebSafe takes bytes or string. Returns base64url with '=' padding.
  const enc = Utilities.base64EncodeWebSafe(input);
  return enc.replace(/=+$/, '');
}

function bqQuery_(sql, parameters) {
  const projectId = mustProperty_('BQ_PROJECT_ID');
  const token = getBQAccessToken_();
  const url = `https://bigquery.googleapis.com/bigquery/v2/projects/${projectId}/queries`;

  const payload = {
    query: sql,
    useLegacySql: false,
    timeoutMs: 60000,
    parameterMode: parameters && parameters.length > 0 ? 'NAMED' : undefined,
    queryParameters: (parameters || []).map(function (p) {
      return {
        name: p.name,
        parameterType: p.type,
        parameterValue: p.value,
      };
    }),
  };

  const resp = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + token },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });
  const code = resp.getResponseCode();
  const body = resp.getContentText();
  if (code < 200 || code >= 300) {
    throw new Error('BQ query failed: ' + code + ' ' + body.substring(0, 1000));
  }
  const result = JSON.parse(body);
  if (result.errors && result.errors.length) {
    throw new Error('BQ query errors: ' + JSON.stringify(result.errors));
  }
  if (!result.jobComplete) {
    // Fall back to polling - for our use case 60s timeout should be enough
    throw new Error('BQ job not complete in timeout; sql=' + sql.substring(0, 200));
  }

  const rows = [];
  if (result.schema && result.rows) {
    const fields = result.schema.fields;
    result.rows.forEach(function (row) {
      const obj = {};
      row.f.forEach(function (cell, i) {
        obj[fields[i].name] = cell.v;
      });
      rows.push(obj);
    });
  }
  return { rows: rows, raw: result };
}

function structTypeFor_(fields) {
  return {
    type: 'STRUCT',
    structTypes: fields.map(function (f) {
      return { name: f[0], type: { type: f[1] } };
    }),
  };
}

function rowToParameter_(row, fields) {
  const structValues = {};
  fields.forEach(function (f) {
    const name = f[0];
    const v = row[name];
    if (v === undefined || v === null) {
      structValues[name] = { value: null };
    } else if (typeof v === 'boolean') {
      structValues[name] = { value: v ? 'true' : 'false' };
    } else {
      structValues[name] = { value: String(v) };
    }
  });
  return { structValues: structValues };
}

// ============================================================
// MISC
// ============================================================

function mustProperty_(name) {
  const v = PropertiesService.getScriptProperties().getProperty(name);
  if (!v) throw new Error('Missing Script Property: ' + name);
  return v;
}
