# Phase 6 Operations Runbook

This runbook covers the first Phase 6 reliability slice: backend health metrics,
structured request logs, connector health, and release operations.

## Health and metrics

The backend health endpoint is:

```text
GET /api/health
```

The response preserves the existing `status`, `database`, `influx`, and `edge`
fields and adds process-local `metrics` counters:

- `requests`: total requests, error count, and cumulative duration.
- `edge.tagBatchesReceived` and `edge.tagsReceived`: incoming connector volume.
- `edge.broadcasts`: website update broadcasts.
- `edge.pendingMongoQueueSize`: current pending tag-write queue size.
- `edge.flushes`, `edge.flushFailures`, and `edge.flushDurationMs`: Mongo flush activity.
- `edge.heartbeatOnline` and `edge.heartbeatOffline`: gateway transitions.

Metrics reset when the backend process restarts. They are diagnostic counters,
not billing or audit records.

## Structured request logs

Backend request completion logs are JSON lines with:

```text
timestamp, level, message, requestId, method, path, statusCode, durationMs
```

Clients may provide `X-Request-ID`; otherwise the backend generates one and
returns it in the response. Never log Authorization headers, API keys, DPAPI
values, passwords, or full connector configuration files.

## Connector health checks

On Windows, check the service using the node-windows service name:

```powershell
sc.exe query "onlinescadafactoryconnector.exe"
Get-Service -Name "onlinescadafactoryconnector.exe"
```

The connector data directory is:

```text
C:\ProgramData\OnlineSCADA\Factory Connector
```

`config.json` must contain `apiKeyProtected` and must not contain a plaintext
`apiKey`. A `connector.lock` file is expected while the service is running.

## Phase 6 test matrix

Record results for:

| Area | Scenarios |
| --- | --- |
| Volume | 1, 10, and 50 equipment connections; 50, 500, and plan-limit tags |
| Sessions | Multiple browser sessions in one company |
| Recovery | Service restart, cloud reconnect, network change, laptop sleep |
| Churn | Repeated configuration updates and reconnect storms |
| Soak | 24-hour run with no unbounded queue, memory, or error growth |

For every run record equipment count, tag count, duration, peak memory,
request/error counters, pending queue peak, flush failures, and observed
disconnects.

## Deployment rollback

1. Keep the previous Render deployment commit and installer artifact identified.
2. If health or connector connectivity regresses, roll Render back to the last
   known-good commit before changing database data.
3. Stop the Windows connector service before installing an older connector build.
4. Preserve `C:\ProgramData\OnlineSCADA\Factory Connector\config.json` unless
   credential rotation is intentionally required.
5. Verify `/api/health`, service state, connector heartbeat, and website status
   after rollback.

## Data retention ownership

- MongoDB retention must be configured and documented in MongoDB Atlas for the
  deployment plan; this repository does not silently delete operational data.
- InfluxDB is optional in the current deployment baseline. If enabled in
  production, configure bucket retention in the InfluxDB deployment and record
  the duration with the environment release notes.
- Backups and restore tests belong to the deployment owner; do not store backup
  credentials or connection strings in this repository.
