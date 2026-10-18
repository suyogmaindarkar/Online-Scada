# Connector 1.0.1 deployment and acceptance checks

## Deployment order

1. Deploy the updated backend on Render and wait for Live.
2. Publish the newly compiled installer at `frontend/public/OnlineSCADA-Factory-Connector-Setup.exe` (already tracked by this repository). The installer must be rebuilt after connector source changes; an already-installed older connector does not gain discovery support automatically.
3. Deploy the updated frontend on Vercel. Keep `VITE_API_URL=https://onlinescada-api.onrender.com/api` and the working public installer URL. The page falls back to the same-origin installer file when the installer URL is not configured.
4. Download the new installer only after the deployment is Ready. Older downloaded installers do not contain these fixes.

The installer version is 1.0.1. Compilation does not code-sign it; sign the final executable before general customer distribution. A build or SCM running check does not prove a physical equipment connection.

For this release, the compiler output was written directly to the tracked `frontend/public` file. An older copy under `installer/Output` is not automatically updated by that command. For a future rebuild, run `installer\build-installer.bat`, sign its output, and publish that new output file to `frontend/public` before deploying.

## Service startup regression

Use a maintenance window: re-pairing/restarting the connector interrupts equipment polling.

1. Run the new installer on the existing factory computer while the old connector service is running.
2. Approve the correct workspace and computer in the browser.
3. The installer must stop and restart the existing Windows service to load the newly saved protected credentials. It must not require a manual restart in Services.
4. Wait up to 30 seconds for the Equipment page to report the connector online.
5. Repeat with an installed stopped service, then on a clean Windows test machine.
6. For support verification, the SCM service ID is `onlinescadafactoryconnector.exe`; `OnlineSCADAFactoryConnector` is the display name:

   ```bat
   sc query onlinescadafactoryconnector.exe
   ```

7. Cancel/expire browser approval or deny service-start permissions. Setup must visibly report failure instead of claiming success.
8. Restart Windows and verify automatic connector reconnection without running setup again.

## Equipment page

- Panel title: **PLC Connector Link**.
- No Pair Connector or Simulate button.
- Download Connector downloads the Windows `.exe`, not a ZIP and does not rotate an existing connector key.
- An online connector does not imply a physical equipment connection or streaming data.
- Old simulation records remain intact, but the page no longer offers creation of new simulations.

## Start / Stop / Test

These controls manage communication/polling; they do not start or stop the physical machine.

1. Use test equipment, not a safety-critical production process.
2. Stop an enabled connection. Expect a correlated confirmation, STOPPED state, disabled polling, and a Start icon.
3. Refresh the page. It must remain stopped.
4. Start it again. Expect an acknowledgement or a finite failure; actual connected status requires a protocol connection from the factory computer.
5. Test a reachable connection with the check button. It must test from the factory computer, not from Render.
6. Test a stopped connection. It must remain stopped after the temporary probe closes.
7. Test an unreachable address and an offline connector. Expect an actionable failure, not an infinite spinner or a false connected state.

## Discover

Scan only a network you are authorized to administer. The connector performs read-only protocol identification but this still generates network traffic.

1. Ensure connector 1.0.1 is online and click Discover.
2. Enter a small known range on the factory LAN, for example start `192.168.0.1`, end `192.168.0.10` if that is the actual equipment subnet.
3. Leave protocol verification enabled. Start the scan and verify progress, a finite result, and detected IP/port/protocol details.
4. An open-port candidate with verification disabled is not proof of an industrial device; model identity is not guaranteed.
5. Add a verified result and confirm the equipment form contains its protocol, IP and port. Save, configure valid tags, and test the connection.
6. Cancel an active scan, then start another. Late reports must not revive the cancelled scan.
7. Disconnect the connector during a scan. Expect failure rather than endless scanning.
8. Leave both IPs blank only when the connector's first non-loopback IPv4 adapter is the intended factory LAN; otherwise provide the explicit range. Scans are capped at 1024 addresses.

The current scanner checks common TCP industrial services: Siemens S7 (102), Modbus TCP (502), OPC UA (4840), EtherNet/IP (44818), Mitsubishi MC candidates (5000), Omron FINS/TCP (9600), IEC 60870-5-104 candidates (2404), DNP3 candidates (20000), and Beckhoff ADS candidates (48898). A verified result means the connector received the protocol handshake it knows how to validate. An open-port candidate is not proof of a PLC. Modbus RTU, PROFIBUS without a TCP gateway, vendor-specific serial protocols, and arbitrary proprietary PLC protocols require an explicit gateway/protocol adapter and cannot be guaranteed by generic network discovery.

## Automated verification

```text
npm test --prefix backend
npm test --prefix edge-gateway
node --test frontend/test/equipmentState.test.mjs
npm run build --prefix frontend
```

Lifecycle, protocol clients, sockets and discovery are simulated in unit tests. Clean-machine installation, deployed socket delivery and physical protocol handshakes must still be verified using the checks above.
