const nodes7 = require('nodes7');

class S7Reader {
  constructor() {
    this.connections = new Map();
  }

  /**
   * Convert S7 address string to nodes7 format
   * Examples:
   *   DB1.DBW0    -> { area: 0x84, dbNumber: 1, start: 0, bit: 0, length: 2 }
   *   DB1.DBD4    -> { area: 0x84, dbNumber: 1, start: 4, bit: 0, length: 4 }
   *   MW10        -> { area: 0x83, dbNumber: 0, start: 10, bit: 0, length: 2 }
   *   MB20        -> { area: 0x83, dbNumber: 0, start: 20, bit: 0, length: 1 }
   *   M10.0       -> { area: 0x83, dbNumber: 0, start: 10, bit: 0, length: 1 }
   *   IW0         -> { area: 0x81, dbNumber: 0, start: 0, bit: 0, length: 2 }
   *   QW0         -> { area: 0x82, dbNumber: 0, start: 0, bit: 0, length: 2 }
   */
  parseAddress(address) {
    const upperAddr = address.toUpperCase().trim();

    // DB addresses: DB<number>.<type><offset>
    const dbMatch = upperAddr.match(/^DB(\d+)\.(DB)(W|D|B|X)(\d+)(?:\.(\d+))?$/);
    if (dbMatch) {
      const dbNumber = parseInt(dbMatch[1], 10);
      const type = dbMatch[3];
      const offset = parseInt(dbMatch[4], 10);
      const bit = dbMatch[5] ? parseInt(dbMatch[5], 10) : 0;

      let length, area;
      switch (type) {
        case 'W': length = 2; area = 0x84; break;  // DBW - Word (16-bit)
        case 'D': length = 4; area = 0x84; break;  // DBD - DWord (32-bit)
        case 'B': length = 1; area = 0x84; break;  // DBB - Byte (8-bit)
        case 'X': length = 1; area = 0x84; break;  // DBX - Bit
        default: throw new Error(`Unknown DB type: ${type}`);
      }

      return { area, dbNumber, start: offset, bit, length };
    }

    // Memory addresses: M<type><offset>
    const memMatch = upperAddr.match(/^M(W|D|B|X?)(\d+)(?:\.(\d+))?$/);
    if (memMatch) {
      const type = memMatch[1] || 'B';
      const offset = parseInt(memMatch[2], 10);
      const bit = memMatch[3] ? parseInt(memMatch[3], 10) : 0;

      let length;
      switch (type) {
        case 'W': length = 2; break;
        case 'D': length = 4; break;
        case 'B': length = 1; break;
        case 'X': length = 1; break;
        default: length = 1;
      }

      return { area: 0x83, dbNumber: 0, start: offset, bit, length };
    }

    // Input addresses: I<type><offset>
    const inputMatch = upperAddr.match(/^I(W|D|B|X?)(\d+)(?:\.(\d+))?$/);
    if (inputMatch) {
      const type = inputMatch[1] || 'B';
      const offset = parseInt(inputMatch[2], 10);
      const bit = inputMatch[3] ? parseInt(inputMatch[3], 10) : 0;

      let length;
      switch (type) {
        case 'W': length = 2; break;
        case 'D': length = 4; break;
        case 'B': length = 1; break;
        case 'X': length = 1; break;
        default: length = 1;
      }

      return { area: 0x81, dbNumber: 0, start: offset, bit, length };
    }

    // Output addresses: Q<type><offset>
    const outputMatch = upperAddr.match(/^Q(W|D|B|X?)(\d+)(?:\.(\d+))?$/);
    if (outputMatch) {
      const type = outputMatch[1] || 'B';
      const offset = parseInt(outputMatch[2], 10);
      const bit = outputMatch[3] ? parseInt(outputMatch[3], 10) : 0;

      let length;
      switch (type) {
        case 'W': length = 2; break;
        case 'D': length = 4; break;
        case 'B': length = 1; break;
        case 'X': length = 1; break;
        default: length = 1;
      }

      return { area: 0x82, dbNumber: 0, start: offset, bit, length };
    }

    throw new Error(`Invalid S7 address format: ${address}`);
  }

  /**
   * Get or create a connection to a PLC
   */
  async getConnection(plcConfig) {
    const key = `${plcConfig.ip}:${plcConfig.port}:${plcConfig.rack}:${plcConfig.slot}`;

    if (this.connections.has(key)) {
      const conn = this.connections.get(key);
      if (conn.connected) {
        return conn.client;
      } else {
        // Clean up stale connection
        this.connections.delete(key);
      }
    }

    const client = new nodes7();

    return new Promise((resolve, reject) => {
      client.initiateConnection({
        port: plcConfig.port,
        host: plcConfig.ip,
        rack: plcConfig.rack,
        slot: plcConfig.slot
      }, (connected) => {
        if (connected) {
          console.log(`[S7Reader] Connected to PLC at ${plcConfig.ip}`);
          this.connections.set(key, { client, connected: true });
          resolve(client);
        } else {
          console.error(`[S7Reader] Failed to connect to PLC at ${plcConfig.ip}`);
          reject(new Error('Connection failed'));
        }
      });
    });
  }

  /**
   * Read multiple tags from a PLC
   */
  async readTags(plcConfig) {
    const client = await this.getConnection(plcConfig);
    const results = [];

    for (const tag of plcConfig.tags) {
      try {
        const addr = this.parseAddress(tag.address);
        const value = await this.readTagValue(client, addr, tag.dataType);
        results.push({
          tagId: tag.tagId,
          value: value,
          quality: 'good',
          timestamp: Date.now()
        });
      } catch (error) {
        console.error(`[S7Reader] Error reading tag ${tag.tagId} at ${tag.address}:`, error.message);
        results.push({
          tagId: tag.tagId,
          value: null,
          quality: 'bad',
          timestamp: Date.now(),
          error: error.message
        });
      }
    }

    return results;
  }

  /**
   * Read a single tag value based on data type
   */
  readTagValue(client, addr, dataType) {
    return new Promise((resolve, reject) => {
      const items = [{
        area: addr.area,
        dbNumber: addr.dbNumber,
        start: addr.start,
        bit: addr.bit,
        length: addr.length
      }];

      client.readItems(items, (err, values) => {
        if (err) {
          reject(err);
          return;
        }

        const rawValue = values[0];
        let value;

        switch (dataType.toUpperCase()) {
          case 'INT':
          case 'SINT':
            value = this.bytesToInt16(rawValue);
            break;
          case 'UINT':
          case 'USINT':
            value = this.bytesToUInt16(rawValue);
            break;
          case 'DINT':
            value = this.bytesToInt32(rawValue);
            break;
          case 'UDINT':
            value = this.bytesToUInt32(rawValue);
            break;
          case 'REAL':
            value = this.bytesToFloat32(rawValue);
            break;
          case 'LREAL':
            value = this.bytesToFloat64(rawValue);
            break;
          case 'BOOL':
          case 'BIT':
            value = (rawValue[addr.bit] >> addr.bit) & 1;
            break;
          case 'BYTE':
            value = rawValue[0];
            break;
          case 'WORD':
            value = this.bytesToUInt16(rawValue);
            break;
          case 'DWORD':
            value = this.bytesToUInt32(rawValue);
            break;
          default:
            value = rawValue;
        }

        resolve(value);
      });
    });
  }

  /**
   * Write a single tag value
   */
  async writeTag(plcConfig, tagAddress, dataType, value) {
    const client = await this.getConnection(plcConfig);
    const addr = this.parseAddress(tagAddress);

    return new Promise((resolve, reject) => {
      let buffer;

      switch (dataType.toUpperCase()) {
        case 'INT':
        case 'SINT':
          buffer = this.int16ToBytes(value);
          break;
        case 'UINT':
        case 'USINT':
          buffer = this.uint16ToBytes(value);
          break;
        case 'DINT':
          buffer = this.int32ToBytes(value);
          break;
        case 'UDINT':
          buffer = this.uint32ToBytes(value);
          break;
        case 'REAL':
          buffer = this.float32ToBytes(value);
          break;
        case 'LREAL':
          buffer = this.float64ToBytes(value);
          break;
        case 'BOOL':
        case 'BIT':
          buffer = Buffer.from([value ? 1 : 0]);
          break;
        case 'BYTE':
          buffer = Buffer.from([value]);
          break;
        case 'WORD':
          buffer = this.uint16ToBytes(value);
          break;
        case 'DWORD':
          buffer = this.uint32ToBytes(value);
          break;
        default:
          reject(new Error(`Unsupported data type for write: ${dataType}`));
          return;
      }

      const items = [{
        area: addr.area,
        dbNumber: addr.dbNumber,
        start: addr.start,
        bit: addr.bit,
        length: addr.length,
        data: buffer
      }];

      client.writeItems(items, (err) => {
        if (err) {
          reject(err);
        } else {
          console.log(`[S7Reader] Successfully wrote ${tagAddress} = ${value}`);
          resolve(true);
        }
      });
    });
  }

  // Helper methods for data conversion
  bytesToInt16(bytes) {
    if (bytes.length < 2) return 0;
    return bytes.readInt16BE(0);
  }

  bytesToUInt16(bytes) {
    if (bytes.length < 2) return 0;
    return bytes.readUInt16BE(0);
  }

  bytesToInt32(bytes) {
    if (bytes.length < 4) return 0;
    return bytes.readInt32BE(0);
  }

  bytesToUInt32(bytes) {
    if (bytes.length < 4) return 0;
    return bytes.readUInt32BE(0);
  }

  bytesToFloat32(bytes) {
    if (bytes.length < 4) return 0;
    return bytes.readFloatBE(0);
  }

  bytesToFloat64(bytes) {
    if (bytes.length < 8) return 0;
    return bytes.readDoubleBE(0);
  }

  int16ToBytes(value) {
    const buf = Buffer.alloc(2);
    buf.writeInt16BE(value, 0);
    return buf;
  }

  uint16ToBytes(value) {
    const buf = Buffer.alloc(2);
    buf.writeUInt16BE(value, 0);
    return buf;
  }

  int32ToBytes(value) {
    const buf = Buffer.alloc(4);
    buf.writeInt32BE(value, 0);
    return buf;
  }

  uint32ToBytes(value) {
    const buf = Buffer.alloc(4);
    buf.writeUInt32BE(value, 0);
    return buf;
  }

  float32ToBytes(value) {
    const buf = Buffer.alloc(4);
    buf.writeFloatBE(value, 0);
    return buf;
  }

  float64ToBytes(value) {
    const buf = Buffer.alloc(8);
    buf.writeDoubleBE(value, 0);
    return buf;
  }

  /**
   * Close all connections
   */
  async disconnectAll() {
    for (const [key, conn] of this.connections.entries()) {
      try {
        conn.client.dropConnection();
        conn.connected = false;
      } catch (e) {
        console.error(`[S7Reader] Error closing connection ${key}:`, e.message);
      }
    }
    this.connections.clear();
  }
}

module.exports = S7Reader;