'use strict';

const { ProtocolSimulator, PROTOCOLS } = require('../src/simulator/protocolSimulator');

const args = process.argv.slice(2);
const get = (name, fallback) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : fallback; };
const requested = String(get('protocol', 'all')).toUpperCase();
const protocols = requested === 'ALL' ? PROTOCOLS : [requested];
const cycles = Math.max(1, Number(get('cycles', 4)) || 4);
const failureAt = Number(get('failure-at', 2));
const tags = [
  { tagId: 'temperature', tagName: 'Temperature', dataType: 'REAL' },
  { tagId: 'running', tagName: 'Running', dataType: 'BOOL' },
];

(async () => {
  const output = [];
  for (const protocol of protocols) {
    const config = { protocol, seed: 100 + protocols.indexOf(protocol), failureCycles: [failureAt] };
    if (protocol === 'PROFIBUS_GATEWAY') config.transportProtocol = get('transport', 'MODBUS_TCP');
    output.push(await new ProtocolSimulator(config).run(tags, cycles));
  }
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
})().catch(error => { console.error(error.message); process.exitCode = 1; });
