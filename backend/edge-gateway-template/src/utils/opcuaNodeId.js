'use strict';
function isValidOpcuaNodeId(value) {
    const address = String(value || '').trim();
    if (!/^ns=\d+;(?:s=|i=\d+$|g=[0-9a-f-]{8,}$|b=[A-Za-z0-9+/=]+$)/i.test(address)) return false;
    if (/^ns=\d+;s=/i.test(address)) {
        const identifier = address.replace(/^ns=\d+;s=/i, '');
        if (!identifier || /[;\r\n]/.test(identifier)) return false;
        if (((identifier.match(/"/g) || []).length % 2) !== 0) return false;
    }
    return true;
}
module.exports = { isValidOpcuaNodeId };
