# OnlineSCADA Launch Workflow

## Purpose

This document is the implementation, verification, and launch plan for taking OnlineSCADA from its current development state to a controlled paid-membership launch.

The plan separates:

- Product upgrades
- Hardware and simulator tests
- Security and tenant-isolation checks
- Pilot-customer preparation
- Production launch gates

No phase should be called complete until its listed acceptance checks are recorded.

## Current baseline

Already implemented or substantially present:

- Multi-tenant companies and company-scoped data
- Workspace and user authentication
- Admin, engineer, operator, and viewer roles
- Graphic Designer and Runtime
- Alarms, trends, recipes, reports, users, and settings
- Factory Connector architecture with outbound cloud tunnel
- OPC UA, Siemens S7, Modbus TCP/RTU, Delta-style Modbus addresses
- Initial Allen-Bradley Ethernet/IP support
- Profibus gateway mode through OPC UA, Modbus TCP, or Ethernet/IP transport
- Connection-status diagnostics and no-tags status handling
- Local protocol simulator kept for internal development only
- Tag Management Phase 1 validation and transport-aware guidance

Current qualification status: feature-complete directionally, but not hardware-qualified for every protocol or ready for an unrestricted membership launch.

## Release strategy

Use three release levels:

1. **Internal alpha**: simulation and code-path verification only.
2. **Controlled pilot**: a small number of real factories and known PLC models.
3. **Paid membership launch**: only supported combinations are advertised, with clear setup documentation and support limits.

Do not market “works with every PLC.” Market supported protocol and gateway combinations.

## Phase 0 — Freeze and baseline

### Work

- Freeze the current feature scope.
- Record the deployed frontend, backend, database, and connector versions.
- Keep the local protocol simulator private; do not expose it in website navigation or customer APIs.
- Create a clean release branch or release tag after the current changes are reviewed.
- Record environment variables and deployment settings without committing secrets.

### Test

- Repository is clean.
- Frontend and backend install from their lockfiles.
- Frontend production build completes.
- Backend starts with production-like environment variables.
- Health endpoint, login, and workspace selection work.
- Existing production deployment remains reachable.

### Exit gate

An identified commit can be restored and deployed again.

## Phase 1 — Tag Management and address correctness

### Work

- Complete the current strict validation for S7, Modbus/Delta, OPC UA, Ethernet/IP, and Profibus gateway transports.
- Add the next small feature: protocol-specific address builders, not a full wizard.
- Add a “Test Address” action after the builder is stable.
- Store test result, quality, diagnostic code, and test timestamp.
- Add normalized address display while preserving the user-entered address.

### Test

- Valid and invalid S7 addresses.
- DB bit offsets 0–7 and invalid bit offsets.
- S7 BOOL, INT, DINT, REAL, WORD, DWORD, BYTE compatibility.
- Modbus coils, discrete inputs, input registers, and holding registers.
- Delta D, M, X, Y, T, and C examples.
- Modbus read-only areas cannot be configured as writable.
- OPC UA string, numeric, GUID, and byte NodeIDs.
- Ethernet/IP controller-scoped and program-scoped tag names.
- Profibus guidance follows the selected gateway transport.
- CSV import rejects invalid protocol/address combinations.
- Workspace A cannot create a tag against Workspace B equipment.

### Exit gate

An engineer can create a tag using a copied PLC address and receives a clear reason when the address is invalid.

## Phase 2 — Unified protocol qualification

### Work

- Maintain one compatibility matrix for protocol, PLC family, driver, address type, data type, read, and write support.
- Keep edge-gateway and downloadable template readers synchronized.
- Add reconnect thresholds and diagnostic codes consistently.
- Add polling overlap protection to every production reader.
- Add byte-order and word-order settings only where a real device requires them.

### Test without hardware

- Run the private protocol simulator for all supported transports.
- Test connect, read, write, scheduled failure, reconnect, and disconnect.
- Test invalid address, unsupported type, timeout, permission, and bad quality paths.
- Confirm simulator files are not imported by the public frontend.

### Test with hardware or vendor simulators

- Siemens S7-1200/1500 and one S7-300/400 if supported by the target market.
- Modbus TCP simulator and one real Modbus device.
- Delta DVP through the intended TCP or RS485 gateway.
- OPC UA anonymous and username/password server.
- CompactLogix or ControlLogix Ethernet/IP controller.
- Profibus through at least one selected gateway transport.

### Exit gate

Every advertised protocol combination has a recorded pass/fail result, known limitations, and setup guide.

## Phase 3 — Factory Connector reliability

### Work

- Improve installer and first-run experience.
- Make connector, tunnel, equipment, tag, and data states distinct.
- Add safe config hot reload and stale-config recovery.
- Ensure connector logs never expose API keys or unnecessary backend details.
- Verify Windows startup, background mode, update/restart behavior, and clean shutdown.

### Test

- Fresh Windows machine with no Node.js installed.
- Download, extract, Start.bat, dependency installation, and first connection.
- Connector offline, cloud offline, equipment offline, and tag invalid states.
- Network interruption and automatic reconnect.
- Configuration change while connector is running.
- API key regeneration invalidates the old package.
- Two connectors cannot leak data between companies.

### Exit gate

A factory operator can install and understand the connector without developer assistance.

## Phase 4 — Security and tenant isolation

### Work

- Perform an endpoint-by-endpoint companyId and role review.
- Review Socket.IO company rooms and Factory Connector authentication.
- Remove secrets from logs, exports, error responses, and frontend bundles.
- Review rate limits, CORS, Helmet, JWT expiry, password reset, and API key rotation.
- Add backup and restore safeguards.

### Test

- Cross-company REST access attempts.
- Cross-company tag writes.
- Cross-company Socket.IO subscriptions.
- Engineer/operator/viewer permission boundaries.
- Expired workspace and user tokens.
- Invalid and regenerated connector API keys.
- Malformed CSV, oversized requests, invalid ObjectIds, and injection-like values.

### Exit gate

No known tenant data leak or unauthorized write remains open.

## Phase 5 — Product usability and operator readiness

### Work

- Remove remaining emoji and technical wording from production UI.
- Standardize “Factory Connector,” “Equipment,” and diagnostic terminology.
- Add onboarding flow: workspace, connector, equipment, tags, first screen.
- Add setup guides for each supported protocol.
- Improve empty, loading, offline, stale, and failure states.
- Add customer-facing compatibility matrix.

### Test

- New operator completes setup from a clean account.
- Engineer configures a tag from a real address map.
- Operator can distinguish connector offline from equipment offline.
- Viewer cannot write.
- Runtime remains usable during temporary data loss.
- Help content matches the actual UI and supported driver behavior.

### Exit gate

Three people unfamiliar with the codebase can complete the guided setup and explain failures correctly.

## Phase 6 — Reliability, performance, and operations

### Work

- Measure polling, database writes, Socket.IO broadcasts, and memory use.
- Batch or throttle high-volume tag updates.
- Add structured operational logs and correlation identifiers.
- Define MongoDB retention and InfluxDB retention policies.
- Add deployment rollback and backup procedures.
- Monitor Render, Vercel, MongoDB, and connector health.

### Test

- 1, 10, and 50 equipment connections in simulation or lab conditions.
- 50, 500, and plan-limit tag counts.
- Multiple browser sessions per company.
- Reconnect storms and repeated configuration updates.
- Long-running 24-hour soak test.
- Browser refresh, laptop sleep, and network changes.

### Exit gate

Measured limits are documented for every membership plan and the system remains stable during the soak test.

## Phase 7 — Pilot customer launch

### Work

- Select two or three pilot factories with known supported hardware.
- Prepare a pilot agreement, support channel, installation checklist, and rollback plan.
- Record PLC model, firmware, gateway, network, addresses, and test results.
- Restrict pilots to supported combinations.
- Track every issue with severity and reproducible evidence.

### Test

- Real read-only monitoring first.
- Then controlled writes with an approved tag list.
- Alarm acknowledgment and notification.
- Trends and reports.
- Recipes only after write safety is approved.
- Factory Connector restart and cloud deployment during an agreed maintenance window.

### Exit gate

Pilot customers complete an agreed operating period without unresolved critical defects.

## Phase 8 — Paid membership launch

### Work

- Publish supported protocol and gateway matrix.
- Publish pricing, plan limits, onboarding, support response times, and exclusions.
- Define trial provisioning and account deletion procedures.
- Add customer terms, privacy, and data-retention policy.
- Prepare sales demo using the private simulator or controlled demo tenant only.
- Create launch rollback and incident communication templates.

### Test

- New paid account provisioning.
- Trial-to-paid transition.
- Plan-limit enforcement.
- Payment or membership workflow, if connected.
- Customer support contact and incident escalation.
- Production backup restore rehearsal.

### Exit gate

A new customer can sign up, install the connector, configure a supported equipment connection, and see live data with documented support coverage.

## Suggested timeline

This is a realistic accelerated schedule, assuming hardware or simulators become available.

| Week | Focus | Deliverable |
|---|---|---|
| 1 | Freeze, baseline, address validation cleanup | Reproducible release baseline |
| 2 | Address builders and Test Address design | Safer tag setup |
| 3 | Protocol qualification with simulators | Compatibility matrix draft |
| 4 | First real PLC and Delta/Modbus qualification | Hardware test records |
| 5 | OPC UA, S7, and Ethernet/IP qualification | Supported hardware list |
| 6 | Factory Connector installation and reconnect hardening | Operator-ready connector |
| 7 | Security and tenant-isolation review | Security sign-off |
| 8 | Usability, help content, performance, and soak test | Release candidate |
| 9–10 | Controlled pilot customers | Pilot report |
| 11 | Fix pilot findings and rehearse rollback | Launch candidate |
| 12 | Paid membership launch | Public supported release |

If hardware is delayed, Weeks 1–3 and the simulator-based portions of Weeks 6–8 can proceed, but real protocol support must remain marked “not hardware-qualified.”

## Launch blockers

Do not launch unrestricted memberships while any of these are unresolved:

- Cross-tenant data or write access
- Unclear connector/equipment status
- Unverified advertised PLC protocol
- Factory Connector cannot recover from ordinary network interruption
- Tag address validation allows silently wrong addresses
- No production backup and rollback procedure
- No support process for a failed customer connection

## Definition of launch-ready

OnlineSCADA is ready for a controlled paid launch when:

- At least one real supported hardware path is verified end-to-end.
- Simulation and protocol test paths pass repeatedly.
- The compatibility matrix is published.
- Connector installation is repeatable.
- Tag setup gives actionable validation and diagnostics.
- Tenant isolation and role boundaries are verified.
- Production monitoring, backup, and rollback are rehearsed.
- Pilot customers complete the agreed acceptance period.
