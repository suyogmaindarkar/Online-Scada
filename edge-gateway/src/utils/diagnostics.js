// Protocol-independent diagnostic normalization. No dependencies.
const CODES = Object.freeze({
    CONNECTION_FAILED: 'CONNECTION_FAILED', TIMEOUT: 'TIMEOUT', INVALID_ADDRESS: 'INVALID_ADDRESS',
    BAD_DEVICE_QUALITY: 'BAD_DEVICE_QUALITY', UNSUPPORTED_DATA_TYPE: 'UNSUPPORTED_DATA_TYPE',
    READ_PERMISSION_DENIED: 'READ_PERMISSION_DENIED', WRITE_PERMISSION_DENIED: 'WRITE_PERMISSION_DENIED',
    UNIT_ID_MISMATCH: 'UNIT_ID_MISMATCH',
});

function text(error) {
    if (!error) return '';
    return String(error.message || error.description || error.reason || error);
}

function normalizeError(error, fallbackCode = CODES.CONNECTION_FAILED) {
    const message = text(error) || fallbackCode;
    const upper = message.toUpperCase();
    let code = error && error.code && CODES[error.code] ? error.code : fallbackCode;
    if (/TIMEOUT|TIMED OUT|ETIMEDOUT/.test(upper)) code = CODES.TIMEOUT;
    else if (/INVALID.*(ADDRESS|OFFSET)|BAD ADDRESS|NODE.*INVALID/.test(upper)) code = CODES.INVALID_ADDRESS;
    else if (/PERMISSION|ACCESS DENIED|NOT AUTHORIZED|READ.?ONLY/.test(upper)) code = /WRITE/.test(upper) ? CODES.WRITE_PERMISSION_DENIED : CODES.READ_PERMISSION_DENIED;
    else if (/UNIT.?ID|SLAVE.*ID|DEVICE.*ID/.test(upper)) code = CODES.UNIT_ID_MISMATCH;
    else if (/UNSUPPORTED|UNKNOWN.*TYPE|DATATYPE/.test(upper)) code = CODES.UNSUPPORTED_DATA_TYPE;
    return { code, message };
}

function diagnosticResult(result, error, fallbackCode) {
    if (!error) return result;
    const diagnostic = normalizeError(error, fallbackCode);
    return Object.assign({}, result, { errorCode: diagnostic.code, error: diagnostic.message });
}

function badTag(tag, error, fallbackCode = CODES.BAD_DEVICE_QUALITY) {
    const diagnostic = normalizeError(error, fallbackCode);
    return { tagId: tag.tagId, tagName: tag.tagName, value: null, quality: 'BAD', errorCode: diagnostic.code, error: diagnostic.message };
}

module.exports = { CODES, normalizeError, diagnosticResult, badTag };
