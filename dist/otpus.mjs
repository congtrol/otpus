// SHA-256 (+ HMAC and PBKDF2) for JavaScript.
//
// Written in 2014-2016 by Dmitry Chestnykh.
// Public domain, no warranty.
//
// Functions (accept and return Uint8Arrays):
//
//   sha256(message) -> hash
//   sha256.hmac(key, message) -> mac
//   sha256.pbkdf2(password, salt, rounds, dkLen) -> dk
//
//  Classes:
//
//   new sha256.Hash()
//   new sha256.HMAC(key)
//
var digestLength = 32;
var blockSize = 64;
// SHA-256 constants
const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b,
  0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01,
  0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7,
  0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
  0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152,
  0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
  0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc,
  0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819,
  0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08,
  0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f,
  0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
]);
function hashBlocks (w, v, p, pos, len) {
  let a, b, c, d, e, f, g, h, u, i, j, t1, t2;
  while (len >= 64) {
    a = v[0];
    b = v[1];
    c = v[2];
    d = v[3];
    e = v[4];
    f = v[5];
    g = v[6];
    h = v[7];
    for (i = 0; i < 16; i++) {
      j = pos + i * 4;
      w[i] = (((p[j] & 0xff) << 24) | ((p[j + 1] & 0xff) << 16) |
                ((p[j + 2] & 0xff) << 8) | (p[j + 3] & 0xff));
    }
    for (i = 16; i < 64; i++) {
      u = w[i - 2];
      t1 = (u >>> 17 | u << (32 - 17)) ^ (u >>> 19 | u << (32 - 19)) ^ (u >>> 10);
      u = w[i - 15];
      t2 = (u >>> 7 | u << (32 - 7)) ^ (u >>> 18 | u << (32 - 18)) ^ (u >>> 3);
      w[i] = (t1 + w[i - 7] | 0) + (t2 + w[i - 16] | 0);
    }
    for (i = 0; i < 64; i++) {
      t1 = (((((e >>> 6 | e << (32 - 6)) ^ (e >>> 11 | e << (32 - 11)) ^
                (e >>> 25 | e << (32 - 25))) + ((e & f) ^ (~e & g))) | 0) +
                ((h + ((K[i] + w[i]) | 0)) | 0)) | 0;
      t2 = (((a >>> 2 | a << (32 - 2)) ^ (a >>> 13 | a << (32 - 13)) ^
                (a >>> 22 | a << (32 - 22))) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
      h = g;
      g = f;
      f = e;
      e = (d + t1) | 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) | 0;
    }
    v[0] += a;
    v[1] += b;
    v[2] += c;
    v[3] += d;
    v[4] += e;
    v[5] += f;
    v[6] += g;
    v[7] += h;
    pos += 64;
    len -= 64;
  }
  return pos
}
// Hash implements SHA256 hash algorithm.
const Hash = /** @class */ (function () {
  function Hash () {
    this.digestLength = digestLength;
    this.blockSize = blockSize;
    // Note: Int32Array is used instead of Uint32Array for performance reasons.
    this.state = new Int32Array(8); // hash state
    this.temp = new Int32Array(64); // temporary state
    this.buffer = new Uint8Array(128); // buffer for data to hash
    this.bufferLength = 0; // number of bytes in buffer
    this.bytesHashed = 0; // number of total bytes hashed
    this.finished = false; // indicates whether the hash was finalized
    this.reset();
  }
  // Resets hash state making it possible
  // to re-use this instance to hash other data.
  Hash.prototype.reset = function () {
    this.state[0] = 0x6a09e667;
    this.state[1] = 0xbb67ae85;
    this.state[2] = 0x3c6ef372;
    this.state[3] = 0xa54ff53a;
    this.state[4] = 0x510e527f;
    this.state[5] = 0x9b05688c;
    this.state[6] = 0x1f83d9ab;
    this.state[7] = 0x5be0cd19;
    this.bufferLength = 0;
    this.bytesHashed = 0;
    this.finished = false;
    return this
  };
  // Cleans internal buffers and re-initializes hash state.
  Hash.prototype.clean = function () {
    for (var i = 0; i < this.buffer.length; i++) {
      this.buffer[i] = 0;
    }
    for (var i = 0; i < this.temp.length; i++) {
      this.temp[i] = 0;
    }
    this.reset();
  };
  // Updates hash state with the given data.
  //
  // Optionally, length of the data can be specified to hash
  // fewer bytes than data.length.
  //
  // Throws error when trying to update already finalized hash:
  // instance must be reset to use it again.
  Hash.prototype.update = function (data, dataLength) {
    if (dataLength === void 0) { dataLength = data.length; }
    if (this.finished) {
      throw new Error("SHA256: can't update because hash was finished.")
    }
    let dataPos = 0;
    this.bytesHashed += dataLength;
    if (this.bufferLength > 0) {
      while (this.bufferLength < 64 && dataLength > 0) {
        this.buffer[this.bufferLength++] = data[dataPos++];
        dataLength--;
      }
      if (this.bufferLength === 64) {
        hashBlocks(this.temp, this.state, this.buffer, 0, 64);
        this.bufferLength = 0;
      }
    }
    if (dataLength >= 64) {
      dataPos = hashBlocks(this.temp, this.state, data, dataPos, dataLength);
      dataLength %= 64;
    }
    while (dataLength > 0) {
      this.buffer[this.bufferLength++] = data[dataPos++];
      dataLength--;
    }
    return this
  };
  // Finalizes hash state and puts hash into out.
  //
  // If hash was already finalized, puts the same value.
  Hash.prototype.finish = function (out) {
    if (!this.finished) {
      const bytesHashed = this.bytesHashed;
      const left = this.bufferLength;
      const bitLenHi = (bytesHashed / 0x20000000) | 0;
      const bitLenLo = bytesHashed << 3;
      const padLength = (bytesHashed % 64 < 56) ? 64 : 128;
      this.buffer[left] = 0x80;
      for (var i = left + 1; i < padLength - 8; i++) {
        this.buffer[i] = 0;
      }
      this.buffer[padLength - 8] = (bitLenHi >>> 24) & 0xff;
      this.buffer[padLength - 7] = (bitLenHi >>> 16) & 0xff;
      this.buffer[padLength - 6] = (bitLenHi >>> 8) & 0xff;
      this.buffer[padLength - 5] = (bitLenHi >>> 0) & 0xff;
      this.buffer[padLength - 4] = (bitLenLo >>> 24) & 0xff;
      this.buffer[padLength - 3] = (bitLenLo >>> 16) & 0xff;
      this.buffer[padLength - 2] = (bitLenLo >>> 8) & 0xff;
      this.buffer[padLength - 1] = (bitLenLo >>> 0) & 0xff;
      hashBlocks(this.temp, this.state, this.buffer, 0, padLength);
      this.finished = true;
    }
    for (var i = 0; i < 8; i++) {
      out[i * 4 + 0] = (this.state[i] >>> 24) & 0xff;
      out[i * 4 + 1] = (this.state[i] >>> 16) & 0xff;
      out[i * 4 + 2] = (this.state[i] >>> 8) & 0xff;
      out[i * 4 + 3] = (this.state[i] >>> 0) & 0xff;
    }
    return this
  };
  // Returns the final hash digest.
  Hash.prototype.digest = function () {
    const out = new Uint8Array(this.digestLength);
    this.finish(out);
    return out
  };
  // Internal function for use in HMAC for optimization.
  Hash.prototype._saveState = function (out) {
    for (let i = 0; i < this.state.length; i++) {
      out[i] = this.state[i];
    }
  };
  // Internal function for use in HMAC for optimization.
  Hash.prototype._restoreState = function (from, bytesHashed) {
    for (let i = 0; i < this.state.length; i++) {
      this.state[i] = from[i];
    }
    this.bytesHashed = bytesHashed;
    this.finished = false;
    this.bufferLength = 0;
  };
  return Hash
}());
// HMAC implements HMAC-SHA256 message authentication algorithm.
const HMAC = /** @class */ (function () {
  function HMAC (key) {
    this.inner = new Hash();
    this.outer = new Hash();
    this.blockSize = this.inner.blockSize;
    this.digestLength = this.inner.digestLength;
    const pad = new Uint8Array(this.blockSize);
    if (key.length > this.blockSize) {
      (new Hash()).update(key).finish(pad).clean();
    } else {
      for (var i = 0; i < key.length; i++) {
        pad[i] = key[i];
      }
    }
    for (var i = 0; i < pad.length; i++) {
      pad[i] ^= 0x36;
    }
    this.inner.update(pad);
    for (var i = 0; i < pad.length; i++) {
      pad[i] ^= 0x36 ^ 0x5c;
    }
    this.outer.update(pad);
    this.istate = new Uint32Array(8);
    this.ostate = new Uint32Array(8);
    this.inner._saveState(this.istate);
    this.outer._saveState(this.ostate);
    for (var i = 0; i < pad.length; i++) {
      pad[i] = 0;
    }
  }
  // Returns HMAC state to the state initialized with key
  // to make it possible to run HMAC over the other data with the same
  // key without creating a new instance.
  HMAC.prototype.reset = function () {
    this.inner._restoreState(this.istate, this.inner.blockSize);
    this.outer._restoreState(this.ostate, this.outer.blockSize);
    return this
  };
  // Cleans HMAC state.
  HMAC.prototype.clean = function () {
    for (let i = 0; i < this.istate.length; i++) {
      this.ostate[i] = this.istate[i] = 0;
    }
    this.inner.clean();
    this.outer.clean();
  };
  // Updates state with provided data.
  HMAC.prototype.update = function (data) {
    this.inner.update(data);
    return this
  };
  // Finalizes HMAC and puts the result in out.
  HMAC.prototype.finish = function (out) {
    if (this.outer.finished) {
      this.outer.finish(out);
    } else {
      this.inner.finish(out);
      this.outer.update(out, this.digestLength).finish(out);
    }
    return this
  };
  // Returns message authentication code.
  HMAC.prototype.digest = function () {
    const out = new Uint8Array(this.digestLength);
    this.finish(out);
    return out
  };
  return HMAC
}());
// Returns SHA256 hash of data.
function hash (data) {
  const h = (new Hash()).update(data);
  const digest = h.digest();
  h.clean();
  return digest
}
// Returns HMAC-SHA256 of data under the key.
function hmac (key, data) {
  const h = (new HMAC(key)).update(data);
  const digest = h.digest();
  h.clean();
  return digest
}

const encoder$2 = new TextEncoder();
new TextDecoder();

hash.arrayBuffer = function (data) {
  if (typeof data === 'string') {
    data = encoder$2.encode(data);
  } else if (ArrayBuffer.isView(data)) {
    if (data.constructor.name === 'Uint8Array') ; else {
      throw new Error('Use Uint8Array')
    }
  } else if (data.constructor === ArrayBuffer) {
    data = new Uint8Array(data);
  } else {
    throw new Error('unsupported data type')
  }
  return hash(data).buffer
};

hash.hex = function (data) {
  const sum = hash.arrayBuffer(data);
  return buf2hex$1(sum)
};

hash.hmac = function (key,data) {
  if (typeof data === 'string') {
    data = encoder$2.encode(data);
  } else if (ArrayBuffer.isView(data)) {
    // if (data.constructor.name === 'Uint8Array') {
    if (data instanceof Uint8Array) ; else {
      throw new Error('Use Uint8Array')
    }
  } else if (data.constructor === ArrayBuffer) {
    data = new Uint8Array(data);
  } else {
    throw new Error('unsupported data type')
  }

  if (typeof key === 'string') {
    key = encoder$2.encode(key);
  } else if (ArrayBuffer.isView(key)) {
    if (key.constructor.name === 'Uint8Array') ; else {
      throw new Error('Use Uint8Array')
    }
  } else if (key.constructor === ArrayBuffer) {
    key = new Uint8Array(key);
  } else {
    throw new Error('unsupported key type')
  }
  return hmac(key,data)
  
};  

function buf2hex$1 (buffer) { return Array.prototype.map.call(new Uint8Array(buffer), x => ('00' + x.toString(16)).slice(-2)).join('') }

function createCommonjsModule(fn) {
  var module = { exports: {} };
	return fn(module, module.exports), module.exports;
}

var byteLength_1 = byteLength;
var toByteArray_1 = toByteArray;
var fromByteArray_1 = fromByteArray;

var lookup = [];
var revLookup = [];
var Arr = typeof Uint8Array !== 'undefined' ? Uint8Array : Array;

var code = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
for (var i = 0, len = code.length; i < len; ++i) {
  lookup[i] = code[i];
  revLookup[code.charCodeAt(i)] = i;
}

// Support decoding URL-safe base64 strings, as Node.js does.
// See: https://en.wikipedia.org/wiki/Base64#URL_applications
revLookup['-'.charCodeAt(0)] = 62;
revLookup['_'.charCodeAt(0)] = 63;

function getLens (b64) {
  var len = b64.length;

  if (len % 4 > 0) {
    throw new Error('Invalid string. Length must be a multiple of 4')
  }

  // Trim off extra bytes after placeholder bytes are found
  // See: https://github.com/beatgammit/base64-js/issues/42
  var validLen = b64.indexOf('=');
  if (validLen === -1) validLen = len;

  var placeHoldersLen = validLen === len
    ? 0
    : 4 - (validLen % 4);

  return [validLen, placeHoldersLen]
}

// base64 is 4/3 + up to two characters of the original data
function byteLength (b64) {
  var lens = getLens(b64);
  var validLen = lens[0];
  var placeHoldersLen = lens[1];
  return ((validLen + placeHoldersLen) * 3 / 4) - placeHoldersLen
}

function _byteLength (b64, validLen, placeHoldersLen) {
  return ((validLen + placeHoldersLen) * 3 / 4) - placeHoldersLen
}

function toByteArray (b64) {
  var tmp;
  var lens = getLens(b64);
  var validLen = lens[0];
  var placeHoldersLen = lens[1];

  var arr = new Arr(_byteLength(b64, validLen, placeHoldersLen));

  var curByte = 0;

  // if there are placeholders, only get up to the last complete 4 chars
  var len = placeHoldersLen > 0
    ? validLen - 4
    : validLen;

  var i;
  for (i = 0; i < len; i += 4) {
    tmp =
      (revLookup[b64.charCodeAt(i)] << 18) |
      (revLookup[b64.charCodeAt(i + 1)] << 12) |
      (revLookup[b64.charCodeAt(i + 2)] << 6) |
      revLookup[b64.charCodeAt(i + 3)];
    arr[curByte++] = (tmp >> 16) & 0xFF;
    arr[curByte++] = (tmp >> 8) & 0xFF;
    arr[curByte++] = tmp & 0xFF;
  }

  if (placeHoldersLen === 2) {
    tmp =
      (revLookup[b64.charCodeAt(i)] << 2) |
      (revLookup[b64.charCodeAt(i + 1)] >> 4);
    arr[curByte++] = tmp & 0xFF;
  }

  if (placeHoldersLen === 1) {
    tmp =
      (revLookup[b64.charCodeAt(i)] << 10) |
      (revLookup[b64.charCodeAt(i + 1)] << 4) |
      (revLookup[b64.charCodeAt(i + 2)] >> 2);
    arr[curByte++] = (tmp >> 8) & 0xFF;
    arr[curByte++] = tmp & 0xFF;
  }

  return arr
}

function tripletToBase64 (num) {
  return lookup[num >> 18 & 0x3F] +
    lookup[num >> 12 & 0x3F] +
    lookup[num >> 6 & 0x3F] +
    lookup[num & 0x3F]
}

function encodeChunk (uint8, start, end) {
  var tmp;
  var output = [];
  for (var i = start; i < end; i += 3) {
    tmp =
      ((uint8[i] << 16) & 0xFF0000) +
      ((uint8[i + 1] << 8) & 0xFF00) +
      (uint8[i + 2] & 0xFF);
    output.push(tripletToBase64(tmp));
  }
  return output.join('')
}

function fromByteArray (uint8) {
  var tmp;
  var len = uint8.length;
  var extraBytes = len % 3; // if we have 1 byte left, pad 2 bytes
  var parts = [];
  var maxChunkLength = 16383; // must be multiple of 3

  // go through the array every three bytes, we'll deal with trailing stuff later
  for (var i = 0, len2 = len - extraBytes; i < len2; i += maxChunkLength) {
    parts.push(encodeChunk(uint8, i, (i + maxChunkLength) > len2 ? len2 : (i + maxChunkLength)));
  }

  // pad the end with zeros, but make sure to not forget the extra bytes
  if (extraBytes === 1) {
    tmp = uint8[len - 1];
    parts.push(
      lookup[tmp >> 2] +
      lookup[(tmp << 4) & 0x3F] +
      '=='
    );
  } else if (extraBytes === 2) {
    tmp = (uint8[len - 2] << 8) + uint8[len - 1];
    parts.push(
      lookup[tmp >> 10] +
      lookup[(tmp >> 4) & 0x3F] +
      lookup[(tmp << 2) & 0x3F] +
      '='
    );
  }

  return parts.join('')
}

var base64Js = {
	byteLength: byteLength_1,
	toByteArray: toByteArray_1,
	fromByteArray: fromByteArray_1
};

/*! ieee754. BSD-3-Clause License. Feross Aboukhadijeh <https://feross.org/opensource> */
var read = function (buffer, offset, isLE, mLen, nBytes) {
  var e, m;
  var eLen = (nBytes * 8) - mLen - 1;
  var eMax = (1 << eLen) - 1;
  var eBias = eMax >> 1;
  var nBits = -7;
  var i = isLE ? (nBytes - 1) : 0;
  var d = isLE ? -1 : 1;
  var s = buffer[offset + i];

  i += d;

  e = s & ((1 << (-nBits)) - 1);
  s >>= (-nBits);
  nBits += eLen;
  for (; nBits > 0; e = (e * 256) + buffer[offset + i], i += d, nBits -= 8) {}

  m = e & ((1 << (-nBits)) - 1);
  e >>= (-nBits);
  nBits += mLen;
  for (; nBits > 0; m = (m * 256) + buffer[offset + i], i += d, nBits -= 8) {}

  if (e === 0) {
    e = 1 - eBias;
  } else if (e === eMax) {
    return m ? NaN : ((s ? -1 : 1) * Infinity)
  } else {
    m = m + Math.pow(2, mLen);
    e = e - eBias;
  }
  return (s ? -1 : 1) * m * Math.pow(2, e - mLen)
};

var write = function (buffer, value, offset, isLE, mLen, nBytes) {
  var e, m, c;
  var eLen = (nBytes * 8) - mLen - 1;
  var eMax = (1 << eLen) - 1;
  var eBias = eMax >> 1;
  var rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0);
  var i = isLE ? 0 : (nBytes - 1);
  var d = isLE ? 1 : -1;
  var s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0;

  value = Math.abs(value);

  if (isNaN(value) || value === Infinity) {
    m = isNaN(value) ? 1 : 0;
    e = eMax;
  } else {
    e = Math.floor(Math.log(value) / Math.LN2);
    if (value * (c = Math.pow(2, -e)) < 1) {
      e--;
      c *= 2;
    }
    if (e + eBias >= 1) {
      value += rt / c;
    } else {
      value += rt * Math.pow(2, 1 - eBias);
    }
    if (value * c >= 2) {
      e++;
      c /= 2;
    }

    if (e + eBias >= eMax) {
      m = 0;
      e = eMax;
    } else if (e + eBias >= 1) {
      m = ((value * c) - 1) * Math.pow(2, mLen);
      e = e + eBias;
    } else {
      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen);
      e = 0;
    }
  }

  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8) {}

  e = (e << mLen) | m;
  eLen += mLen;
  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8) {}

  buffer[offset + i - d] |= s * 128;
};

var ieee754 = {
	read: read,
	write: write
};

/*!
 * The buffer module from node.js, for the browser.
 *
 * @author   Feross Aboukhadijeh <https://feross.org>
 * @license  MIT
 */

var buffer = createCommonjsModule(function (module, exports) {



const customInspectSymbol =
  (typeof Symbol === 'function' && typeof Symbol['for'] === 'function') // eslint-disable-line dot-notation
    ? Symbol['for']('nodejs.util.inspect.custom') // eslint-disable-line dot-notation
    : null;

exports.Buffer = Buffer;
exports.SlowBuffer = SlowBuffer;
exports.INSPECT_MAX_BYTES = 50;

const K_MAX_LENGTH = 0x7fffffff;
exports.kMaxLength = K_MAX_LENGTH;

/**
 * If `Buffer.TYPED_ARRAY_SUPPORT`:
 *   === true    Use Uint8Array implementation (fastest)
 *   === false   Print warning and recommend using `buffer` v4.x which has an Object
 *               implementation (most compatible, even IE6)
 *
 * Browsers that support typed arrays are IE 10+, Firefox 4+, Chrome 7+, Safari 5.1+,
 * Opera 11.6+, iOS 4.2+.
 *
 * We report that the browser does not support typed arrays if the are not subclassable
 * using __proto__. Firefox 4-29 lacks support for adding new properties to `Uint8Array`
 * (See: https://bugzilla.mozilla.org/show_bug.cgi?id=695438). IE 10 lacks support
 * for __proto__ and has a buggy typed array implementation.
 */
Buffer.TYPED_ARRAY_SUPPORT = typedArraySupport();

if (!Buffer.TYPED_ARRAY_SUPPORT && typeof console !== 'undefined' &&
    typeof console.error === 'function') {
  console.error(
    'This browser lacks typed array (Uint8Array) support which is required by ' +
    '`buffer` v5.x. Use `buffer` v4.x if you require old browser support.'
  );
}

function typedArraySupport () {
  // Can typed array instances can be augmented?
  try {
    const arr = new Uint8Array(1);
    const proto = { foo: function () { return 42 } };
    Object.setPrototypeOf(proto, Uint8Array.prototype);
    Object.setPrototypeOf(arr, proto);
    return arr.foo() === 42
  } catch (e) {
    return false
  }
}

Object.defineProperty(Buffer.prototype, 'parent', {
  enumerable: true,
  get: function () {
    if (!Buffer.isBuffer(this)) return undefined
    return this.buffer
  }
});

Object.defineProperty(Buffer.prototype, 'offset', {
  enumerable: true,
  get: function () {
    if (!Buffer.isBuffer(this)) return undefined
    return this.byteOffset
  }
});

function createBuffer (length) {
  if (length > K_MAX_LENGTH) {
    throw new RangeError('The value "' + length + '" is invalid for option "size"')
  }
  // Return an augmented `Uint8Array` instance
  const buf = new Uint8Array(length);
  Object.setPrototypeOf(buf, Buffer.prototype);
  return buf
}

/**
 * The Buffer constructor returns instances of `Uint8Array` that have their
 * prototype changed to `Buffer.prototype`. Furthermore, `Buffer` is a subclass of
 * `Uint8Array`, so the returned instances will have all the node `Buffer` methods
 * and the `Uint8Array` methods. Square bracket notation works as expected -- it
 * returns a single octet.
 *
 * The `Uint8Array` prototype remains unmodified.
 */

function Buffer (arg, encodingOrOffset, length) {
  // Common case.
  if (typeof arg === 'number') {
    if (typeof encodingOrOffset === 'string') {
      throw new TypeError(
        'The "string" argument must be of type string. Received type number'
      )
    }
    return allocUnsafe(arg)
  }
  return from(arg, encodingOrOffset, length)
}

Buffer.poolSize = 8192; // not used by this implementation

function from (value, encodingOrOffset, length) {
  if (typeof value === 'string') {
    return fromString(value, encodingOrOffset)
  }

  if (ArrayBuffer.isView(value)) {
    return fromArrayView(value)
  }

  if (value == null) {
    throw new TypeError(
      'The first argument must be one of type string, Buffer, ArrayBuffer, Array, ' +
      'or Array-like Object. Received type ' + (typeof value)
    )
  }

  if (isInstance(value, ArrayBuffer) ||
      (value && isInstance(value.buffer, ArrayBuffer))) {
    return fromArrayBuffer(value, encodingOrOffset, length)
  }

  if (typeof SharedArrayBuffer !== 'undefined' &&
      (isInstance(value, SharedArrayBuffer) ||
      (value && isInstance(value.buffer, SharedArrayBuffer)))) {
    return fromArrayBuffer(value, encodingOrOffset, length)
  }

  if (typeof value === 'number') {
    throw new TypeError(
      'The "value" argument must not be of type number. Received type number'
    )
  }

  const valueOf = value.valueOf && value.valueOf();
  if (valueOf != null && valueOf !== value) {
    return Buffer.from(valueOf, encodingOrOffset, length)
  }

  const b = fromObject(value);
  if (b) return b

  if (typeof Symbol !== 'undefined' && Symbol.toPrimitive != null &&
      typeof value[Symbol.toPrimitive] === 'function') {
    return Buffer.from(value[Symbol.toPrimitive]('string'), encodingOrOffset, length)
  }

  throw new TypeError(
    'The first argument must be one of type string, Buffer, ArrayBuffer, Array, ' +
    'or Array-like Object. Received type ' + (typeof value)
  )
}

/**
 * Functionally equivalent to Buffer(arg, encoding) but throws a TypeError
 * if value is a number.
 * Buffer.from(str[, encoding])
 * Buffer.from(array)
 * Buffer.from(buffer)
 * Buffer.from(arrayBuffer[, byteOffset[, length]])
 **/
Buffer.from = function (value, encodingOrOffset, length) {
  return from(value, encodingOrOffset, length)
};

// Note: Change prototype *after* Buffer.from is defined to workaround Chrome bug:
// https://github.com/feross/buffer/pull/148
Object.setPrototypeOf(Buffer.prototype, Uint8Array.prototype);
Object.setPrototypeOf(Buffer, Uint8Array);

function assertSize (size) {
  if (typeof size !== 'number') {
    throw new TypeError('"size" argument must be of type number')
  } else if (size < 0) {
    throw new RangeError('The value "' + size + '" is invalid for option "size"')
  }
}

function alloc (size, fill, encoding) {
  assertSize(size);
  if (size <= 0) {
    return createBuffer(size)
  }
  if (fill !== undefined) {
    // Only pay attention to encoding if it's a string. This
    // prevents accidentally sending in a number that would
    // be interpreted as a start offset.
    return typeof encoding === 'string'
      ? createBuffer(size).fill(fill, encoding)
      : createBuffer(size).fill(fill)
  }
  return createBuffer(size)
}

/**
 * Creates a new filled Buffer instance.
 * alloc(size[, fill[, encoding]])
 **/
Buffer.alloc = function (size, fill, encoding) {
  return alloc(size, fill, encoding)
};

function allocUnsafe (size) {
  assertSize(size);
  return createBuffer(size < 0 ? 0 : checked(size) | 0)
}

/**
 * Equivalent to Buffer(num), by default creates a non-zero-filled Buffer instance.
 * */
Buffer.allocUnsafe = function (size) {
  return allocUnsafe(size)
};
/**
 * Equivalent to SlowBuffer(num), by default creates a non-zero-filled Buffer instance.
 */
Buffer.allocUnsafeSlow = function (size) {
  return allocUnsafe(size)
};

function fromString (string, encoding) {
  if (typeof encoding !== 'string' || encoding === '') {
    encoding = 'utf8';
  }

  if (!Buffer.isEncoding(encoding)) {
    throw new TypeError('Unknown encoding: ' + encoding)
  }

  const length = byteLength(string, encoding) | 0;
  let buf = createBuffer(length);

  const actual = buf.write(string, encoding);

  if (actual !== length) {
    // Writing a hex string, for example, that contains invalid characters will
    // cause everything after the first invalid character to be ignored. (e.g.
    // 'abxxcd' will be treated as 'ab')
    buf = buf.slice(0, actual);
  }

  return buf
}

function fromArrayLike (array) {
  const length = array.length < 0 ? 0 : checked(array.length) | 0;
  const buf = createBuffer(length);
  for (let i = 0; i < length; i += 1) {
    buf[i] = array[i] & 255;
  }
  return buf
}

function fromArrayView (arrayView) {
  if (isInstance(arrayView, Uint8Array)) {
    const copy = new Uint8Array(arrayView);
    return fromArrayBuffer(copy.buffer, copy.byteOffset, copy.byteLength)
  }
  return fromArrayLike(arrayView)
}

function fromArrayBuffer (array, byteOffset, length) {
  if (byteOffset < 0 || array.byteLength < byteOffset) {
    throw new RangeError('"offset" is outside of buffer bounds')
  }

  if (array.byteLength < byteOffset + (length || 0)) {
    throw new RangeError('"length" is outside of buffer bounds')
  }

  let buf;
  if (byteOffset === undefined && length === undefined) {
    buf = new Uint8Array(array);
  } else if (length === undefined) {
    buf = new Uint8Array(array, byteOffset);
  } else {
    buf = new Uint8Array(array, byteOffset, length);
  }

  // Return an augmented `Uint8Array` instance
  Object.setPrototypeOf(buf, Buffer.prototype);

  return buf
}

function fromObject (obj) {
  if (Buffer.isBuffer(obj)) {
    const len = checked(obj.length) | 0;
    const buf = createBuffer(len);

    if (buf.length === 0) {
      return buf
    }

    obj.copy(buf, 0, 0, len);
    return buf
  }

  if (obj.length !== undefined) {
    if (typeof obj.length !== 'number' || numberIsNaN(obj.length)) {
      return createBuffer(0)
    }
    return fromArrayLike(obj)
  }

  if (obj.type === 'Buffer' && Array.isArray(obj.data)) {
    return fromArrayLike(obj.data)
  }
}

function checked (length) {
  // Note: cannot use `length < K_MAX_LENGTH` here because that fails when
  // length is NaN (which is otherwise coerced to zero.)
  if (length >= K_MAX_LENGTH) {
    throw new RangeError('Attempt to allocate Buffer larger than maximum ' +
                         'size: 0x' + K_MAX_LENGTH.toString(16) + ' bytes')
  }
  return length | 0
}

function SlowBuffer (length) {
  if (+length != length) { // eslint-disable-line eqeqeq
    length = 0;
  }
  return Buffer.alloc(+length)
}

Buffer.isBuffer = function isBuffer (b) {
  return b != null && b._isBuffer === true &&
    b !== Buffer.prototype // so Buffer.isBuffer(Buffer.prototype) will be false
};

Buffer.compare = function compare (a, b) {
  if (isInstance(a, Uint8Array)) a = Buffer.from(a, a.offset, a.byteLength);
  if (isInstance(b, Uint8Array)) b = Buffer.from(b, b.offset, b.byteLength);
  if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b)) {
    throw new TypeError(
      'The "buf1", "buf2" arguments must be one of type Buffer or Uint8Array'
    )
  }

  if (a === b) return 0

  let x = a.length;
  let y = b.length;

  for (let i = 0, len = Math.min(x, y); i < len; ++i) {
    if (a[i] !== b[i]) {
      x = a[i];
      y = b[i];
      break
    }
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
};

Buffer.isEncoding = function isEncoding (encoding) {
  switch (String(encoding).toLowerCase()) {
    case 'hex':
    case 'utf8':
    case 'utf-8':
    case 'ascii':
    case 'latin1':
    case 'binary':
    case 'base64':
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      return true
    default:
      return false
  }
};

Buffer.concat = function concat (list, length) {
  if (!Array.isArray(list)) {
    throw new TypeError('"list" argument must be an Array of Buffers')
  }

  if (list.length === 0) {
    return Buffer.alloc(0)
  }

  let i;
  if (length === undefined) {
    length = 0;
    for (i = 0; i < list.length; ++i) {
      length += list[i].length;
    }
  }

  const buffer = Buffer.allocUnsafe(length);
  let pos = 0;
  for (i = 0; i < list.length; ++i) {
    let buf = list[i];
    if (isInstance(buf, Uint8Array)) {
      if (pos + buf.length > buffer.length) {
        if (!Buffer.isBuffer(buf)) buf = Buffer.from(buf);
        buf.copy(buffer, pos);
      } else {
        Uint8Array.prototype.set.call(
          buffer,
          buf,
          pos
        );
      }
    } else if (!Buffer.isBuffer(buf)) {
      throw new TypeError('"list" argument must be an Array of Buffers')
    } else {
      buf.copy(buffer, pos);
    }
    pos += buf.length;
  }
  return buffer
};

function byteLength (string, encoding) {
  if (Buffer.isBuffer(string)) {
    return string.length
  }
  if (ArrayBuffer.isView(string) || isInstance(string, ArrayBuffer)) {
    return string.byteLength
  }
  if (typeof string !== 'string') {
    throw new TypeError(
      'The "string" argument must be one of type string, Buffer, or ArrayBuffer. ' +
      'Received type ' + typeof string
    )
  }

  const len = string.length;
  const mustMatch = (arguments.length > 2 && arguments[2] === true);
  if (!mustMatch && len === 0) return 0

  // Use a for loop to avoid recursion
  let loweredCase = false;
  for (;;) {
    switch (encoding) {
      case 'ascii':
      case 'latin1':
      case 'binary':
        return len
      case 'utf8':
      case 'utf-8':
        return utf8ToBytes(string).length
      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return len * 2
      case 'hex':
        return len >>> 1
      case 'base64':
        return base64ToBytes(string).length
      default:
        if (loweredCase) {
          return mustMatch ? -1 : utf8ToBytes(string).length // assume utf8
        }
        encoding = ('' + encoding).toLowerCase();
        loweredCase = true;
    }
  }
}
Buffer.byteLength = byteLength;

function slowToString (encoding, start, end) {
  let loweredCase = false;

  // No need to verify that "this.length <= MAX_UINT32" since it's a read-only
  // property of a typed array.

  // This behaves neither like String nor Uint8Array in that we set start/end
  // to their upper/lower bounds if the value passed is out of range.
  // undefined is handled specially as per ECMA-262 6th Edition,
  // Section 13.3.3.7 Runtime Semantics: KeyedBindingInitialization.
  if (start === undefined || start < 0) {
    start = 0;
  }
  // Return early if start > this.length. Done here to prevent potential uint32
  // coercion fail below.
  if (start > this.length) {
    return ''
  }

  if (end === undefined || end > this.length) {
    end = this.length;
  }

  if (end <= 0) {
    return ''
  }

  // Force coercion to uint32. This will also coerce falsey/NaN values to 0.
  end >>>= 0;
  start >>>= 0;

  if (end <= start) {
    return ''
  }

  if (!encoding) encoding = 'utf8';

  while (true) {
    switch (encoding) {
      case 'hex':
        return hexSlice(this, start, end)

      case 'utf8':
      case 'utf-8':
        return utf8Slice(this, start, end)

      case 'ascii':
        return asciiSlice(this, start, end)

      case 'latin1':
      case 'binary':
        return latin1Slice(this, start, end)

      case 'base64':
        return base64Slice(this, start, end)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return utf16leSlice(this, start, end)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = (encoding + '').toLowerCase();
        loweredCase = true;
    }
  }
}

// This property is used by `Buffer.isBuffer` (and the `is-buffer` npm package)
// to detect a Buffer instance. It's not possible to use `instanceof Buffer`
// reliably in a browserify context because there could be multiple different
// copies of the 'buffer' package in use. This method works even for Buffer
// instances that were created from another copy of the `buffer` package.
// See: https://github.com/feross/buffer/issues/154
Buffer.prototype._isBuffer = true;

function swap (b, n, m) {
  const i = b[n];
  b[n] = b[m];
  b[m] = i;
}

Buffer.prototype.swap16 = function swap16 () {
  const len = this.length;
  if (len % 2 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 16-bits')
  }
  for (let i = 0; i < len; i += 2) {
    swap(this, i, i + 1);
  }
  return this
};

Buffer.prototype.swap32 = function swap32 () {
  const len = this.length;
  if (len % 4 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 32-bits')
  }
  for (let i = 0; i < len; i += 4) {
    swap(this, i, i + 3);
    swap(this, i + 1, i + 2);
  }
  return this
};

Buffer.prototype.swap64 = function swap64 () {
  const len = this.length;
  if (len % 8 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 64-bits')
  }
  for (let i = 0; i < len; i += 8) {
    swap(this, i, i + 7);
    swap(this, i + 1, i + 6);
    swap(this, i + 2, i + 5);
    swap(this, i + 3, i + 4);
  }
  return this
};

Buffer.prototype.toString = function toString () {
  const length = this.length;
  if (length === 0) return ''
  if (arguments.length === 0) return utf8Slice(this, 0, length)
  return slowToString.apply(this, arguments)
};

Buffer.prototype.toLocaleString = Buffer.prototype.toString;

Buffer.prototype.equals = function equals (b) {
  if (!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
  if (this === b) return true
  return Buffer.compare(this, b) === 0
};

Buffer.prototype.inspect = function inspect () {
  let str = '';
  const max = exports.INSPECT_MAX_BYTES;
  str = this.toString('hex', 0, max).replace(/(.{2})/g, '$1 ').trim();
  if (this.length > max) str += ' ... ';
  return '<Buffer ' + str + '>'
};
if (customInspectSymbol) {
  Buffer.prototype[customInspectSymbol] = Buffer.prototype.inspect;
}

Buffer.prototype.compare = function compare (target, start, end, thisStart, thisEnd) {
  if (isInstance(target, Uint8Array)) {
    target = Buffer.from(target, target.offset, target.byteLength);
  }
  if (!Buffer.isBuffer(target)) {
    throw new TypeError(
      'The "target" argument must be one of type Buffer or Uint8Array. ' +
      'Received type ' + (typeof target)
    )
  }

  if (start === undefined) {
    start = 0;
  }
  if (end === undefined) {
    end = target ? target.length : 0;
  }
  if (thisStart === undefined) {
    thisStart = 0;
  }
  if (thisEnd === undefined) {
    thisEnd = this.length;
  }

  if (start < 0 || end > target.length || thisStart < 0 || thisEnd > this.length) {
    throw new RangeError('out of range index')
  }

  if (thisStart >= thisEnd && start >= end) {
    return 0
  }
  if (thisStart >= thisEnd) {
    return -1
  }
  if (start >= end) {
    return 1
  }

  start >>>= 0;
  end >>>= 0;
  thisStart >>>= 0;
  thisEnd >>>= 0;

  if (this === target) return 0

  let x = thisEnd - thisStart;
  let y = end - start;
  const len = Math.min(x, y);

  const thisCopy = this.slice(thisStart, thisEnd);
  const targetCopy = target.slice(start, end);

  for (let i = 0; i < len; ++i) {
    if (thisCopy[i] !== targetCopy[i]) {
      x = thisCopy[i];
      y = targetCopy[i];
      break
    }
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
};

// Finds either the first index of `val` in `buffer` at offset >= `byteOffset`,
// OR the last index of `val` in `buffer` at offset <= `byteOffset`.
//
// Arguments:
// - buffer - a Buffer to search
// - val - a string, Buffer, or number
// - byteOffset - an index into `buffer`; will be clamped to an int32
// - encoding - an optional encoding, relevant is val is a string
// - dir - true for indexOf, false for lastIndexOf
function bidirectionalIndexOf (buffer, val, byteOffset, encoding, dir) {
  // Empty buffer means no match
  if (buffer.length === 0) return -1

  // Normalize byteOffset
  if (typeof byteOffset === 'string') {
    encoding = byteOffset;
    byteOffset = 0;
  } else if (byteOffset > 0x7fffffff) {
    byteOffset = 0x7fffffff;
  } else if (byteOffset < -0x80000000) {
    byteOffset = -0x80000000;
  }
  byteOffset = +byteOffset; // Coerce to Number.
  if (numberIsNaN(byteOffset)) {
    // byteOffset: it it's undefined, null, NaN, "foo", etc, search whole buffer
    byteOffset = dir ? 0 : (buffer.length - 1);
  }

  // Normalize byteOffset: negative offsets start from the end of the buffer
  if (byteOffset < 0) byteOffset = buffer.length + byteOffset;
  if (byteOffset >= buffer.length) {
    if (dir) return -1
    else byteOffset = buffer.length - 1;
  } else if (byteOffset < 0) {
    if (dir) byteOffset = 0;
    else return -1
  }

  // Normalize val
  if (typeof val === 'string') {
    val = Buffer.from(val, encoding);
  }

  // Finally, search either indexOf (if dir is true) or lastIndexOf
  if (Buffer.isBuffer(val)) {
    // Special case: looking for empty string/buffer always fails
    if (val.length === 0) {
      return -1
    }
    return arrayIndexOf(buffer, val, byteOffset, encoding, dir)
  } else if (typeof val === 'number') {
    val = val & 0xFF; // Search for a byte value [0-255]
    if (typeof Uint8Array.prototype.indexOf === 'function') {
      if (dir) {
        return Uint8Array.prototype.indexOf.call(buffer, val, byteOffset)
      } else {
        return Uint8Array.prototype.lastIndexOf.call(buffer, val, byteOffset)
      }
    }
    return arrayIndexOf(buffer, [val], byteOffset, encoding, dir)
  }

  throw new TypeError('val must be string, number or Buffer')
}

function arrayIndexOf (arr, val, byteOffset, encoding, dir) {
  let indexSize = 1;
  let arrLength = arr.length;
  let valLength = val.length;

  if (encoding !== undefined) {
    encoding = String(encoding).toLowerCase();
    if (encoding === 'ucs2' || encoding === 'ucs-2' ||
        encoding === 'utf16le' || encoding === 'utf-16le') {
      if (arr.length < 2 || val.length < 2) {
        return -1
      }
      indexSize = 2;
      arrLength /= 2;
      valLength /= 2;
      byteOffset /= 2;
    }
  }

  function read (buf, i) {
    if (indexSize === 1) {
      return buf[i]
    } else {
      return buf.readUInt16BE(i * indexSize)
    }
  }

  let i;
  if (dir) {
    let foundIndex = -1;
    for (i = byteOffset; i < arrLength; i++) {
      if (read(arr, i) === read(val, foundIndex === -1 ? 0 : i - foundIndex)) {
        if (foundIndex === -1) foundIndex = i;
        if (i - foundIndex + 1 === valLength) return foundIndex * indexSize
      } else {
        if (foundIndex !== -1) i -= i - foundIndex;
        foundIndex = -1;
      }
    }
  } else {
    if (byteOffset + valLength > arrLength) byteOffset = arrLength - valLength;
    for (i = byteOffset; i >= 0; i--) {
      let found = true;
      for (let j = 0; j < valLength; j++) {
        if (read(arr, i + j) !== read(val, j)) {
          found = false;
          break
        }
      }
      if (found) return i
    }
  }

  return -1
}

Buffer.prototype.includes = function includes (val, byteOffset, encoding) {
  return this.indexOf(val, byteOffset, encoding) !== -1
};

Buffer.prototype.indexOf = function indexOf (val, byteOffset, encoding) {
  return bidirectionalIndexOf(this, val, byteOffset, encoding, true)
};

Buffer.prototype.lastIndexOf = function lastIndexOf (val, byteOffset, encoding) {
  return bidirectionalIndexOf(this, val, byteOffset, encoding, false)
};

function hexWrite (buf, string, offset, length) {
  offset = Number(offset) || 0;
  const remaining = buf.length - offset;
  if (!length) {
    length = remaining;
  } else {
    length = Number(length);
    if (length > remaining) {
      length = remaining;
    }
  }

  const strLen = string.length;

  if (length > strLen / 2) {
    length = strLen / 2;
  }
  let i;
  for (i = 0; i < length; ++i) {
    const parsed = parseInt(string.substr(i * 2, 2), 16);
    if (numberIsNaN(parsed)) return i
    buf[offset + i] = parsed;
  }
  return i
}

function utf8Write (buf, string, offset, length) {
  return blitBuffer(utf8ToBytes(string, buf.length - offset), buf, offset, length)
}

function asciiWrite (buf, string, offset, length) {
  return blitBuffer(asciiToBytes(string), buf, offset, length)
}

function base64Write (buf, string, offset, length) {
  return blitBuffer(base64ToBytes(string), buf, offset, length)
}

function ucs2Write (buf, string, offset, length) {
  return blitBuffer(utf16leToBytes(string, buf.length - offset), buf, offset, length)
}

Buffer.prototype.write = function write (string, offset, length, encoding) {
  // Buffer#write(string)
  if (offset === undefined) {
    encoding = 'utf8';
    length = this.length;
    offset = 0;
  // Buffer#write(string, encoding)
  } else if (length === undefined && typeof offset === 'string') {
    encoding = offset;
    length = this.length;
    offset = 0;
  // Buffer#write(string, offset[, length][, encoding])
  } else if (isFinite(offset)) {
    offset = offset >>> 0;
    if (isFinite(length)) {
      length = length >>> 0;
      if (encoding === undefined) encoding = 'utf8';
    } else {
      encoding = length;
      length = undefined;
    }
  } else {
    throw new Error(
      'Buffer.write(string, encoding, offset[, length]) is no longer supported'
    )
  }

  const remaining = this.length - offset;
  if (length === undefined || length > remaining) length = remaining;

  if ((string.length > 0 && (length < 0 || offset < 0)) || offset > this.length) {
    throw new RangeError('Attempt to write outside buffer bounds')
  }

  if (!encoding) encoding = 'utf8';

  let loweredCase = false;
  for (;;) {
    switch (encoding) {
      case 'hex':
        return hexWrite(this, string, offset, length)

      case 'utf8':
      case 'utf-8':
        return utf8Write(this, string, offset, length)

      case 'ascii':
      case 'latin1':
      case 'binary':
        return asciiWrite(this, string, offset, length)

      case 'base64':
        // Warning: maxLength not taken into account in base64Write
        return base64Write(this, string, offset, length)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return ucs2Write(this, string, offset, length)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = ('' + encoding).toLowerCase();
        loweredCase = true;
    }
  }
};

Buffer.prototype.toJSON = function toJSON () {
  return {
    type: 'Buffer',
    data: Array.prototype.slice.call(this._arr || this, 0)
  }
};

function base64Slice (buf, start, end) {
  if (start === 0 && end === buf.length) {
    return base64Js.fromByteArray(buf)
  } else {
    return base64Js.fromByteArray(buf.slice(start, end))
  }
}

function utf8Slice (buf, start, end) {
  end = Math.min(buf.length, end);
  const res = [];

  let i = start;
  while (i < end) {
    const firstByte = buf[i];
    let codePoint = null;
    let bytesPerSequence = (firstByte > 0xEF)
      ? 4
      : (firstByte > 0xDF)
          ? 3
          : (firstByte > 0xBF)
              ? 2
              : 1;

    if (i + bytesPerSequence <= end) {
      let secondByte, thirdByte, fourthByte, tempCodePoint;

      switch (bytesPerSequence) {
        case 1:
          if (firstByte < 0x80) {
            codePoint = firstByte;
          }
          break
        case 2:
          secondByte = buf[i + 1];
          if ((secondByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0x1F) << 0x6 | (secondByte & 0x3F);
            if (tempCodePoint > 0x7F) {
              codePoint = tempCodePoint;
            }
          }
          break
        case 3:
          secondByte = buf[i + 1];
          thirdByte = buf[i + 2];
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0xC | (secondByte & 0x3F) << 0x6 | (thirdByte & 0x3F);
            if (tempCodePoint > 0x7FF && (tempCodePoint < 0xD800 || tempCodePoint > 0xDFFF)) {
              codePoint = tempCodePoint;
            }
          }
          break
        case 4:
          secondByte = buf[i + 1];
          thirdByte = buf[i + 2];
          fourthByte = buf[i + 3];
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80 && (fourthByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0x12 | (secondByte & 0x3F) << 0xC | (thirdByte & 0x3F) << 0x6 | (fourthByte & 0x3F);
            if (tempCodePoint > 0xFFFF && tempCodePoint < 0x110000) {
              codePoint = tempCodePoint;
            }
          }
      }
    }

    if (codePoint === null) {
      // we did not generate a valid codePoint so insert a
      // replacement char (U+FFFD) and advance only 1 byte
      codePoint = 0xFFFD;
      bytesPerSequence = 1;
    } else if (codePoint > 0xFFFF) {
      // encode to utf16 (surrogate pair dance)
      codePoint -= 0x10000;
      res.push(codePoint >>> 10 & 0x3FF | 0xD800);
      codePoint = 0xDC00 | codePoint & 0x3FF;
    }

    res.push(codePoint);
    i += bytesPerSequence;
  }

  return decodeCodePointsArray(res)
}

// Based on http://stackoverflow.com/a/22747272/680742, the browser with
// the lowest limit is Chrome, with 0x10000 args.
// We go 1 magnitude less, for safety
const MAX_ARGUMENTS_LENGTH = 0x1000;

function decodeCodePointsArray (codePoints) {
  const len = codePoints.length;
  if (len <= MAX_ARGUMENTS_LENGTH) {
    return String.fromCharCode.apply(String, codePoints) // avoid extra slice()
  }

  // Decode in chunks to avoid "call stack size exceeded".
  let res = '';
  let i = 0;
  while (i < len) {
    res += String.fromCharCode.apply(
      String,
      codePoints.slice(i, i += MAX_ARGUMENTS_LENGTH)
    );
  }
  return res
}

function asciiSlice (buf, start, end) {
  let ret = '';
  end = Math.min(buf.length, end);

  for (let i = start; i < end; ++i) {
    ret += String.fromCharCode(buf[i] & 0x7F);
  }
  return ret
}

function latin1Slice (buf, start, end) {
  let ret = '';
  end = Math.min(buf.length, end);

  for (let i = start; i < end; ++i) {
    ret += String.fromCharCode(buf[i]);
  }
  return ret
}

function hexSlice (buf, start, end) {
  const len = buf.length;

  if (!start || start < 0) start = 0;
  if (!end || end < 0 || end > len) end = len;

  let out = '';
  for (let i = start; i < end; ++i) {
    out += hexSliceLookupTable[buf[i]];
  }
  return out
}

function utf16leSlice (buf, start, end) {
  const bytes = buf.slice(start, end);
  let res = '';
  // If bytes.length is odd, the last 8 bits must be ignored (same as node.js)
  for (let i = 0; i < bytes.length - 1; i += 2) {
    res += String.fromCharCode(bytes[i] + (bytes[i + 1] * 256));
  }
  return res
}

Buffer.prototype.slice = function slice (start, end) {
  const len = this.length;
  start = ~~start;
  end = end === undefined ? len : ~~end;

  if (start < 0) {
    start += len;
    if (start < 0) start = 0;
  } else if (start > len) {
    start = len;
  }

  if (end < 0) {
    end += len;
    if (end < 0) end = 0;
  } else if (end > len) {
    end = len;
  }

  if (end < start) end = start;

  const newBuf = this.subarray(start, end);
  // Return an augmented `Uint8Array` instance
  Object.setPrototypeOf(newBuf, Buffer.prototype);

  return newBuf
};

/*
 * Need to make sure that buffer isn't trying to write out of bounds.
 */
function checkOffset (offset, ext, length) {
  if ((offset % 1) !== 0 || offset < 0) throw new RangeError('offset is not uint')
  if (offset + ext > length) throw new RangeError('Trying to access beyond buffer length')
}

Buffer.prototype.readUintLE =
Buffer.prototype.readUIntLE = function readUIntLE (offset, byteLength, noAssert) {
  offset = offset >>> 0;
  byteLength = byteLength >>> 0;
  if (!noAssert) checkOffset(offset, byteLength, this.length);

  let val = this[offset];
  let mul = 1;
  let i = 0;
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul;
  }

  return val
};

Buffer.prototype.readUintBE =
Buffer.prototype.readUIntBE = function readUIntBE (offset, byteLength, noAssert) {
  offset = offset >>> 0;
  byteLength = byteLength >>> 0;
  if (!noAssert) {
    checkOffset(offset, byteLength, this.length);
  }

  let val = this[offset + --byteLength];
  let mul = 1;
  while (byteLength > 0 && (mul *= 0x100)) {
    val += this[offset + --byteLength] * mul;
  }

  return val
};

Buffer.prototype.readUint8 =
Buffer.prototype.readUInt8 = function readUInt8 (offset, noAssert) {
  offset = offset >>> 0;
  if (!noAssert) checkOffset(offset, 1, this.length);
  return this[offset]
};

Buffer.prototype.readUint16LE =
Buffer.prototype.readUInt16LE = function readUInt16LE (offset, noAssert) {
  offset = offset >>> 0;
  if (!noAssert) checkOffset(offset, 2, this.length);
  return this[offset] | (this[offset + 1] << 8)
};

Buffer.prototype.readUint16BE =
Buffer.prototype.readUInt16BE = function readUInt16BE (offset, noAssert) {
  offset = offset >>> 0;
  if (!noAssert) checkOffset(offset, 2, this.length);
  return (this[offset] << 8) | this[offset + 1]
};

Buffer.prototype.readUint32LE =
Buffer.prototype.readUInt32LE = function readUInt32LE (offset, noAssert) {
  offset = offset >>> 0;
  if (!noAssert) checkOffset(offset, 4, this.length);

  return ((this[offset]) |
      (this[offset + 1] << 8) |
      (this[offset + 2] << 16)) +
      (this[offset + 3] * 0x1000000)
};

Buffer.prototype.readUint32BE =
Buffer.prototype.readUInt32BE = function readUInt32BE (offset, noAssert) {
  offset = offset >>> 0;
  if (!noAssert) checkOffset(offset, 4, this.length);

  return (this[offset] * 0x1000000) +
    ((this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    this[offset + 3])
};

Buffer.prototype.readBigUInt64LE = defineBigIntMethod(function readBigUInt64LE (offset) {
  offset = offset >>> 0;
  validateNumber(offset, 'offset');
  const first = this[offset];
  const last = this[offset + 7];
  if (first === undefined || last === undefined) {
    boundsError(offset, this.length - 8);
  }

  const lo = first +
    this[++offset] * 2 ** 8 +
    this[++offset] * 2 ** 16 +
    this[++offset] * 2 ** 24;

  const hi = this[++offset] +
    this[++offset] * 2 ** 8 +
    this[++offset] * 2 ** 16 +
    last * 2 ** 24;

  return BigInt(lo) + (BigInt(hi) << BigInt(32))
});

Buffer.prototype.readBigUInt64BE = defineBigIntMethod(function readBigUInt64BE (offset) {
  offset = offset >>> 0;
  validateNumber(offset, 'offset');
  const first = this[offset];
  const last = this[offset + 7];
  if (first === undefined || last === undefined) {
    boundsError(offset, this.length - 8);
  }

  const hi = first * 2 ** 24 +
    this[++offset] * 2 ** 16 +
    this[++offset] * 2 ** 8 +
    this[++offset];

  const lo = this[++offset] * 2 ** 24 +
    this[++offset] * 2 ** 16 +
    this[++offset] * 2 ** 8 +
    last;

  return (BigInt(hi) << BigInt(32)) + BigInt(lo)
});

Buffer.prototype.readIntLE = function readIntLE (offset, byteLength, noAssert) {
  offset = offset >>> 0;
  byteLength = byteLength >>> 0;
  if (!noAssert) checkOffset(offset, byteLength, this.length);

  let val = this[offset];
  let mul = 1;
  let i = 0;
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul;
  }
  mul *= 0x80;

  if (val >= mul) val -= Math.pow(2, 8 * byteLength);

  return val
};

Buffer.prototype.readIntBE = function readIntBE (offset, byteLength, noAssert) {
  offset = offset >>> 0;
  byteLength = byteLength >>> 0;
  if (!noAssert) checkOffset(offset, byteLength, this.length);

  let i = byteLength;
  let mul = 1;
  let val = this[offset + --i];
  while (i > 0 && (mul *= 0x100)) {
    val += this[offset + --i] * mul;
  }
  mul *= 0x80;

  if (val >= mul) val -= Math.pow(2, 8 * byteLength);

  return val
};

Buffer.prototype.readInt8 = function readInt8 (offset, noAssert) {
  offset = offset >>> 0;
  if (!noAssert) checkOffset(offset, 1, this.length);
  if (!(this[offset] & 0x80)) return (this[offset])
  return ((0xff - this[offset] + 1) * -1)
};

Buffer.prototype.readInt16LE = function readInt16LE (offset, noAssert) {
  offset = offset >>> 0;
  if (!noAssert) checkOffset(offset, 2, this.length);
  const val = this[offset] | (this[offset + 1] << 8);
  return (val & 0x8000) ? val | 0xFFFF0000 : val
};

Buffer.prototype.readInt16BE = function readInt16BE (offset, noAssert) {
  offset = offset >>> 0;
  if (!noAssert) checkOffset(offset, 2, this.length);
  const val = this[offset + 1] | (this[offset] << 8);
  return (val & 0x8000) ? val | 0xFFFF0000 : val
};

Buffer.prototype.readInt32LE = function readInt32LE (offset, noAssert) {
  offset = offset >>> 0;
  if (!noAssert) checkOffset(offset, 4, this.length);

  return (this[offset]) |
    (this[offset + 1] << 8) |
    (this[offset + 2] << 16) |
    (this[offset + 3] << 24)
};

Buffer.prototype.readInt32BE = function readInt32BE (offset, noAssert) {
  offset = offset >>> 0;
  if (!noAssert) checkOffset(offset, 4, this.length);

  return (this[offset] << 24) |
    (this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    (this[offset + 3])
};

Buffer.prototype.readBigInt64LE = defineBigIntMethod(function readBigInt64LE (offset) {
  offset = offset >>> 0;
  validateNumber(offset, 'offset');
  const first = this[offset];
  const last = this[offset + 7];
  if (first === undefined || last === undefined) {
    boundsError(offset, this.length - 8);
  }

  const val = this[offset + 4] +
    this[offset + 5] * 2 ** 8 +
    this[offset + 6] * 2 ** 16 +
    (last << 24); // Overflow

  return (BigInt(val) << BigInt(32)) +
    BigInt(first +
    this[++offset] * 2 ** 8 +
    this[++offset] * 2 ** 16 +
    this[++offset] * 2 ** 24)
});

Buffer.prototype.readBigInt64BE = defineBigIntMethod(function readBigInt64BE (offset) {
  offset = offset >>> 0;
  validateNumber(offset, 'offset');
  const first = this[offset];
  const last = this[offset + 7];
  if (first === undefined || last === undefined) {
    boundsError(offset, this.length - 8);
  }

  const val = (first << 24) + // Overflow
    this[++offset] * 2 ** 16 +
    this[++offset] * 2 ** 8 +
    this[++offset];

  return (BigInt(val) << BigInt(32)) +
    BigInt(this[++offset] * 2 ** 24 +
    this[++offset] * 2 ** 16 +
    this[++offset] * 2 ** 8 +
    last)
});

Buffer.prototype.readFloatLE = function readFloatLE (offset, noAssert) {
  offset = offset >>> 0;
  if (!noAssert) checkOffset(offset, 4, this.length);
  return ieee754.read(this, offset, true, 23, 4)
};

Buffer.prototype.readFloatBE = function readFloatBE (offset, noAssert) {
  offset = offset >>> 0;
  if (!noAssert) checkOffset(offset, 4, this.length);
  return ieee754.read(this, offset, false, 23, 4)
};

Buffer.prototype.readDoubleLE = function readDoubleLE (offset, noAssert) {
  offset = offset >>> 0;
  if (!noAssert) checkOffset(offset, 8, this.length);
  return ieee754.read(this, offset, true, 52, 8)
};

Buffer.prototype.readDoubleBE = function readDoubleBE (offset, noAssert) {
  offset = offset >>> 0;
  if (!noAssert) checkOffset(offset, 8, this.length);
  return ieee754.read(this, offset, false, 52, 8)
};

function checkInt (buf, value, offset, ext, max, min) {
  if (!Buffer.isBuffer(buf)) throw new TypeError('"buffer" argument must be a Buffer instance')
  if (value > max || value < min) throw new RangeError('"value" argument is out of bounds')
  if (offset + ext > buf.length) throw new RangeError('Index out of range')
}

Buffer.prototype.writeUintLE =
Buffer.prototype.writeUIntLE = function writeUIntLE (value, offset, byteLength, noAssert) {
  value = +value;
  offset = offset >>> 0;
  byteLength = byteLength >>> 0;
  if (!noAssert) {
    const maxBytes = Math.pow(2, 8 * byteLength) - 1;
    checkInt(this, value, offset, byteLength, maxBytes, 0);
  }

  let mul = 1;
  let i = 0;
  this[offset] = value & 0xFF;
  while (++i < byteLength && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF;
  }

  return offset + byteLength
};

Buffer.prototype.writeUintBE =
Buffer.prototype.writeUIntBE = function writeUIntBE (value, offset, byteLength, noAssert) {
  value = +value;
  offset = offset >>> 0;
  byteLength = byteLength >>> 0;
  if (!noAssert) {
    const maxBytes = Math.pow(2, 8 * byteLength) - 1;
    checkInt(this, value, offset, byteLength, maxBytes, 0);
  }

  let i = byteLength - 1;
  let mul = 1;
  this[offset + i] = value & 0xFF;
  while (--i >= 0 && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF;
  }

  return offset + byteLength
};

Buffer.prototype.writeUint8 =
Buffer.prototype.writeUInt8 = function writeUInt8 (value, offset, noAssert) {
  value = +value;
  offset = offset >>> 0;
  if (!noAssert) checkInt(this, value, offset, 1, 0xff, 0);
  this[offset] = (value & 0xff);
  return offset + 1
};

Buffer.prototype.writeUint16LE =
Buffer.prototype.writeUInt16LE = function writeUInt16LE (value, offset, noAssert) {
  value = +value;
  offset = offset >>> 0;
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0);
  this[offset] = (value & 0xff);
  this[offset + 1] = (value >>> 8);
  return offset + 2
};

Buffer.prototype.writeUint16BE =
Buffer.prototype.writeUInt16BE = function writeUInt16BE (value, offset, noAssert) {
  value = +value;
  offset = offset >>> 0;
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0);
  this[offset] = (value >>> 8);
  this[offset + 1] = (value & 0xff);
  return offset + 2
};

Buffer.prototype.writeUint32LE =
Buffer.prototype.writeUInt32LE = function writeUInt32LE (value, offset, noAssert) {
  value = +value;
  offset = offset >>> 0;
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0);
  this[offset + 3] = (value >>> 24);
  this[offset + 2] = (value >>> 16);
  this[offset + 1] = (value >>> 8);
  this[offset] = (value & 0xff);
  return offset + 4
};

Buffer.prototype.writeUint32BE =
Buffer.prototype.writeUInt32BE = function writeUInt32BE (value, offset, noAssert) {
  value = +value;
  offset = offset >>> 0;
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0);
  this[offset] = (value >>> 24);
  this[offset + 1] = (value >>> 16);
  this[offset + 2] = (value >>> 8);
  this[offset + 3] = (value & 0xff);
  return offset + 4
};

function wrtBigUInt64LE (buf, value, offset, min, max) {
  checkIntBI(value, min, max, buf, offset, 7);

  let lo = Number(value & BigInt(0xffffffff));
  buf[offset++] = lo;
  lo = lo >> 8;
  buf[offset++] = lo;
  lo = lo >> 8;
  buf[offset++] = lo;
  lo = lo >> 8;
  buf[offset++] = lo;
  let hi = Number(value >> BigInt(32) & BigInt(0xffffffff));
  buf[offset++] = hi;
  hi = hi >> 8;
  buf[offset++] = hi;
  hi = hi >> 8;
  buf[offset++] = hi;
  hi = hi >> 8;
  buf[offset++] = hi;
  return offset
}

function wrtBigUInt64BE (buf, value, offset, min, max) {
  checkIntBI(value, min, max, buf, offset, 7);

  let lo = Number(value & BigInt(0xffffffff));
  buf[offset + 7] = lo;
  lo = lo >> 8;
  buf[offset + 6] = lo;
  lo = lo >> 8;
  buf[offset + 5] = lo;
  lo = lo >> 8;
  buf[offset + 4] = lo;
  let hi = Number(value >> BigInt(32) & BigInt(0xffffffff));
  buf[offset + 3] = hi;
  hi = hi >> 8;
  buf[offset + 2] = hi;
  hi = hi >> 8;
  buf[offset + 1] = hi;
  hi = hi >> 8;
  buf[offset] = hi;
  return offset + 8
}

Buffer.prototype.writeBigUInt64LE = defineBigIntMethod(function writeBigUInt64LE (value, offset = 0) {
  return wrtBigUInt64LE(this, value, offset, BigInt(0), BigInt('0xffffffffffffffff'))
});

Buffer.prototype.writeBigUInt64BE = defineBigIntMethod(function writeBigUInt64BE (value, offset = 0) {
  return wrtBigUInt64BE(this, value, offset, BigInt(0), BigInt('0xffffffffffffffff'))
});

Buffer.prototype.writeIntLE = function writeIntLE (value, offset, byteLength, noAssert) {
  value = +value;
  offset = offset >>> 0;
  if (!noAssert) {
    const limit = Math.pow(2, (8 * byteLength) - 1);

    checkInt(this, value, offset, byteLength, limit - 1, -limit);
  }

  let i = 0;
  let mul = 1;
  let sub = 0;
  this[offset] = value & 0xFF;
  while (++i < byteLength && (mul *= 0x100)) {
    if (value < 0 && sub === 0 && this[offset + i - 1] !== 0) {
      sub = 1;
    }
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF;
  }

  return offset + byteLength
};

Buffer.prototype.writeIntBE = function writeIntBE (value, offset, byteLength, noAssert) {
  value = +value;
  offset = offset >>> 0;
  if (!noAssert) {
    const limit = Math.pow(2, (8 * byteLength) - 1);

    checkInt(this, value, offset, byteLength, limit - 1, -limit);
  }

  let i = byteLength - 1;
  let mul = 1;
  let sub = 0;
  this[offset + i] = value & 0xFF;
  while (--i >= 0 && (mul *= 0x100)) {
    if (value < 0 && sub === 0 && this[offset + i + 1] !== 0) {
      sub = 1;
    }
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF;
  }

  return offset + byteLength
};

Buffer.prototype.writeInt8 = function writeInt8 (value, offset, noAssert) {
  value = +value;
  offset = offset >>> 0;
  if (!noAssert) checkInt(this, value, offset, 1, 0x7f, -0x80);
  if (value < 0) value = 0xff + value + 1;
  this[offset] = (value & 0xff);
  return offset + 1
};

Buffer.prototype.writeInt16LE = function writeInt16LE (value, offset, noAssert) {
  value = +value;
  offset = offset >>> 0;
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000);
  this[offset] = (value & 0xff);
  this[offset + 1] = (value >>> 8);
  return offset + 2
};

Buffer.prototype.writeInt16BE = function writeInt16BE (value, offset, noAssert) {
  value = +value;
  offset = offset >>> 0;
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000);
  this[offset] = (value >>> 8);
  this[offset + 1] = (value & 0xff);
  return offset + 2
};

Buffer.prototype.writeInt32LE = function writeInt32LE (value, offset, noAssert) {
  value = +value;
  offset = offset >>> 0;
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000);
  this[offset] = (value & 0xff);
  this[offset + 1] = (value >>> 8);
  this[offset + 2] = (value >>> 16);
  this[offset + 3] = (value >>> 24);
  return offset + 4
};

Buffer.prototype.writeInt32BE = function writeInt32BE (value, offset, noAssert) {
  value = +value;
  offset = offset >>> 0;
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000);
  if (value < 0) value = 0xffffffff + value + 1;
  this[offset] = (value >>> 24);
  this[offset + 1] = (value >>> 16);
  this[offset + 2] = (value >>> 8);
  this[offset + 3] = (value & 0xff);
  return offset + 4
};

Buffer.prototype.writeBigInt64LE = defineBigIntMethod(function writeBigInt64LE (value, offset = 0) {
  return wrtBigUInt64LE(this, value, offset, -BigInt('0x8000000000000000'), BigInt('0x7fffffffffffffff'))
});

Buffer.prototype.writeBigInt64BE = defineBigIntMethod(function writeBigInt64BE (value, offset = 0) {
  return wrtBigUInt64BE(this, value, offset, -BigInt('0x8000000000000000'), BigInt('0x7fffffffffffffff'))
});

function checkIEEE754 (buf, value, offset, ext, max, min) {
  if (offset + ext > buf.length) throw new RangeError('Index out of range')
  if (offset < 0) throw new RangeError('Index out of range')
}

function writeFloat (buf, value, offset, littleEndian, noAssert) {
  value = +value;
  offset = offset >>> 0;
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 4);
  }
  ieee754.write(buf, value, offset, littleEndian, 23, 4);
  return offset + 4
}

Buffer.prototype.writeFloatLE = function writeFloatLE (value, offset, noAssert) {
  return writeFloat(this, value, offset, true, noAssert)
};

Buffer.prototype.writeFloatBE = function writeFloatBE (value, offset, noAssert) {
  return writeFloat(this, value, offset, false, noAssert)
};

function writeDouble (buf, value, offset, littleEndian, noAssert) {
  value = +value;
  offset = offset >>> 0;
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 8);
  }
  ieee754.write(buf, value, offset, littleEndian, 52, 8);
  return offset + 8
}

Buffer.prototype.writeDoubleLE = function writeDoubleLE (value, offset, noAssert) {
  return writeDouble(this, value, offset, true, noAssert)
};

Buffer.prototype.writeDoubleBE = function writeDoubleBE (value, offset, noAssert) {
  return writeDouble(this, value, offset, false, noAssert)
};

// copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
Buffer.prototype.copy = function copy (target, targetStart, start, end) {
  if (!Buffer.isBuffer(target)) throw new TypeError('argument should be a Buffer')
  if (!start) start = 0;
  if (!end && end !== 0) end = this.length;
  if (targetStart >= target.length) targetStart = target.length;
  if (!targetStart) targetStart = 0;
  if (end > 0 && end < start) end = start;

  // Copy 0 bytes; we're done
  if (end === start) return 0
  if (target.length === 0 || this.length === 0) return 0

  // Fatal error conditions
  if (targetStart < 0) {
    throw new RangeError('targetStart out of bounds')
  }
  if (start < 0 || start >= this.length) throw new RangeError('Index out of range')
  if (end < 0) throw new RangeError('sourceEnd out of bounds')

  // Are we oob?
  if (end > this.length) end = this.length;
  if (target.length - targetStart < end - start) {
    end = target.length - targetStart + start;
  }

  const len = end - start;

  if (this === target && typeof Uint8Array.prototype.copyWithin === 'function') {
    // Use built-in when available, missing from IE11
    this.copyWithin(targetStart, start, end);
  } else {
    Uint8Array.prototype.set.call(
      target,
      this.subarray(start, end),
      targetStart
    );
  }

  return len
};

// Usage:
//    buffer.fill(number[, offset[, end]])
//    buffer.fill(buffer[, offset[, end]])
//    buffer.fill(string[, offset[, end]][, encoding])
Buffer.prototype.fill = function fill (val, start, end, encoding) {
  // Handle string cases:
  if (typeof val === 'string') {
    if (typeof start === 'string') {
      encoding = start;
      start = 0;
      end = this.length;
    } else if (typeof end === 'string') {
      encoding = end;
      end = this.length;
    }
    if (encoding !== undefined && typeof encoding !== 'string') {
      throw new TypeError('encoding must be a string')
    }
    if (typeof encoding === 'string' && !Buffer.isEncoding(encoding)) {
      throw new TypeError('Unknown encoding: ' + encoding)
    }
    if (val.length === 1) {
      const code = val.charCodeAt(0);
      if ((encoding === 'utf8' && code < 128) ||
          encoding === 'latin1') {
        // Fast path: If `val` fits into a single byte, use that numeric value.
        val = code;
      }
    }
  } else if (typeof val === 'number') {
    val = val & 255;
  } else if (typeof val === 'boolean') {
    val = Number(val);
  }

  // Invalid ranges are not set to a default, so can range check early.
  if (start < 0 || this.length < start || this.length < end) {
    throw new RangeError('Out of range index')
  }

  if (end <= start) {
    return this
  }

  start = start >>> 0;
  end = end === undefined ? this.length : end >>> 0;

  if (!val) val = 0;

  let i;
  if (typeof val === 'number') {
    for (i = start; i < end; ++i) {
      this[i] = val;
    }
  } else {
    const bytes = Buffer.isBuffer(val)
      ? val
      : Buffer.from(val, encoding);
    const len = bytes.length;
    if (len === 0) {
      throw new TypeError('The value "' + val +
        '" is invalid for argument "value"')
    }
    for (i = 0; i < end - start; ++i) {
      this[i + start] = bytes[i % len];
    }
  }

  return this
};

// CUSTOM ERRORS
// =============

// Simplified versions from Node, changed for Buffer-only usage
const errors = {};
function E (sym, getMessage, Base) {
  errors[sym] = class NodeError extends Base {
    constructor () {
      super();

      Object.defineProperty(this, 'message', {
        value: getMessage.apply(this, arguments),
        writable: true,
        configurable: true
      });

      // Add the error code to the name to include it in the stack trace.
      this.name = `${this.name} [${sym}]`;
      // Access the stack to generate the error message including the error code
      // from the name.
      this.stack; // eslint-disable-line no-unused-expressions
      // Reset the name to the actual name.
      delete this.name;
    }

    get code () {
      return sym
    }

    set code (value) {
      Object.defineProperty(this, 'code', {
        configurable: true,
        enumerable: true,
        value,
        writable: true
      });
    }

    toString () {
      return `${this.name} [${sym}]: ${this.message}`
    }
  };
}

E('ERR_BUFFER_OUT_OF_BOUNDS',
  function (name) {
    if (name) {
      return `${name} is outside of buffer bounds`
    }

    return 'Attempt to access memory outside buffer bounds'
  }, RangeError);
E('ERR_INVALID_ARG_TYPE',
  function (name, actual) {
    return `The "${name}" argument must be of type number. Received type ${typeof actual}`
  }, TypeError);
E('ERR_OUT_OF_RANGE',
  function (str, range, input) {
    let msg = `The value of "${str}" is out of range.`;
    let received = input;
    if (Number.isInteger(input) && Math.abs(input) > 2 ** 32) {
      received = addNumericalSeparator(String(input));
    } else if (typeof input === 'bigint') {
      received = String(input);
      if (input > BigInt(2) ** BigInt(32) || input < -(BigInt(2) ** BigInt(32))) {
        received = addNumericalSeparator(received);
      }
      received += 'n';
    }
    msg += ` It must be ${range}. Received ${received}`;
    return msg
  }, RangeError);

function addNumericalSeparator (val) {
  let res = '';
  let i = val.length;
  const start = val[0] === '-' ? 1 : 0;
  for (; i >= start + 4; i -= 3) {
    res = `_${val.slice(i - 3, i)}${res}`;
  }
  return `${val.slice(0, i)}${res}`
}

// CHECK FUNCTIONS
// ===============

function checkBounds (buf, offset, byteLength) {
  validateNumber(offset, 'offset');
  if (buf[offset] === undefined || buf[offset + byteLength] === undefined) {
    boundsError(offset, buf.length - (byteLength + 1));
  }
}

function checkIntBI (value, min, max, buf, offset, byteLength) {
  if (value > max || value < min) {
    const n = typeof min === 'bigint' ? 'n' : '';
    let range;
    if (byteLength > 3) {
      if (min === 0 || min === BigInt(0)) {
        range = `>= 0${n} and < 2${n} ** ${(byteLength + 1) * 8}${n}`;
      } else {
        range = `>= -(2${n} ** ${(byteLength + 1) * 8 - 1}${n}) and < 2 ** ` +
                `${(byteLength + 1) * 8 - 1}${n}`;
      }
    } else {
      range = `>= ${min}${n} and <= ${max}${n}`;
    }
    throw new errors.ERR_OUT_OF_RANGE('value', range, value)
  }
  checkBounds(buf, offset, byteLength);
}

function validateNumber (value, name) {
  if (typeof value !== 'number') {
    throw new errors.ERR_INVALID_ARG_TYPE(name, 'number', value)
  }
}

function boundsError (value, length, type) {
  if (Math.floor(value) !== value) {
    validateNumber(value, type);
    throw new errors.ERR_OUT_OF_RANGE(type || 'offset', 'an integer', value)
  }

  if (length < 0) {
    throw new errors.ERR_BUFFER_OUT_OF_BOUNDS()
  }

  throw new errors.ERR_OUT_OF_RANGE(type || 'offset',
                                    `>= ${type ? 1 : 0} and <= ${length}`,
                                    value)
}

// HELPER FUNCTIONS
// ================

const INVALID_BASE64_RE = /[^+/0-9A-Za-z-_]/g;

function base64clean (str) {
  // Node takes equal signs as end of the Base64 encoding
  str = str.split('=')[0];
  // Node strips out invalid characters like \n and \t from the string, base64-js does not
  str = str.trim().replace(INVALID_BASE64_RE, '');
  // Node converts strings with length < 2 to ''
  if (str.length < 2) return ''
  // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not
  while (str.length % 4 !== 0) {
    str = str + '=';
  }
  return str
}

function utf8ToBytes (string, units) {
  units = units || Infinity;
  let codePoint;
  const length = string.length;
  let leadSurrogate = null;
  const bytes = [];

  for (let i = 0; i < length; ++i) {
    codePoint = string.charCodeAt(i);

    // is surrogate component
    if (codePoint > 0xD7FF && codePoint < 0xE000) {
      // last char was a lead
      if (!leadSurrogate) {
        // no lead yet
        if (codePoint > 0xDBFF) {
          // unexpected trail
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD);
          continue
        } else if (i + 1 === length) {
          // unpaired lead
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD);
          continue
        }

        // valid lead
        leadSurrogate = codePoint;

        continue
      }

      // 2 leads in a row
      if (codePoint < 0xDC00) {
        if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD);
        leadSurrogate = codePoint;
        continue
      }

      // valid surrogate pair
      codePoint = (leadSurrogate - 0xD800 << 10 | codePoint - 0xDC00) + 0x10000;
    } else if (leadSurrogate) {
      // valid bmp char, but last char was a lead
      if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD);
    }

    leadSurrogate = null;

    // encode utf8
    if (codePoint < 0x80) {
      if ((units -= 1) < 0) break
      bytes.push(codePoint);
    } else if (codePoint < 0x800) {
      if ((units -= 2) < 0) break
      bytes.push(
        codePoint >> 0x6 | 0xC0,
        codePoint & 0x3F | 0x80
      );
    } else if (codePoint < 0x10000) {
      if ((units -= 3) < 0) break
      bytes.push(
        codePoint >> 0xC | 0xE0,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      );
    } else if (codePoint < 0x110000) {
      if ((units -= 4) < 0) break
      bytes.push(
        codePoint >> 0x12 | 0xF0,
        codePoint >> 0xC & 0x3F | 0x80,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      );
    } else {
      throw new Error('Invalid code point')
    }
  }

  return bytes
}

function asciiToBytes (str) {
  const byteArray = [];
  for (let i = 0; i < str.length; ++i) {
    // Node's code seems to be doing this and not & 0x7F..
    byteArray.push(str.charCodeAt(i) & 0xFF);
  }
  return byteArray
}

function utf16leToBytes (str, units) {
  let c, hi, lo;
  const byteArray = [];
  for (let i = 0; i < str.length; ++i) {
    if ((units -= 2) < 0) break

    c = str.charCodeAt(i);
    hi = c >> 8;
    lo = c % 256;
    byteArray.push(lo);
    byteArray.push(hi);
  }

  return byteArray
}

function base64ToBytes (str) {
  return base64Js.toByteArray(base64clean(str))
}

function blitBuffer (src, dst, offset, length) {
  let i;
  for (i = 0; i < length; ++i) {
    if ((i + offset >= dst.length) || (i >= src.length)) break
    dst[i + offset] = src[i];
  }
  return i
}

// ArrayBuffer or Uint8Array objects from other contexts (i.e. iframes) do not pass
// the `instanceof` check but they should be treated as of that type.
// See: https://github.com/feross/buffer/issues/166
function isInstance (obj, type) {
  return obj instanceof type ||
    (obj != null && obj.constructor != null && obj.constructor.name != null &&
      obj.constructor.name === type.name)
}
function numberIsNaN (obj) {
  // For IE11 support
  return obj !== obj // eslint-disable-line no-self-compare
}

// Create lookup table for `toString('hex')`
// See: https://github.com/feross/buffer/issues/219
const hexSliceLookupTable = (function () {
  const alphabet = '0123456789abcdef';
  const table = new Array(256);
  for (let i = 0; i < 16; ++i) {
    const i16 = i * 16;
    for (let j = 0; j < 16; ++j) {
      table[i16 + j] = alphabet[i] + alphabet[j];
    }
  }
  return table
})();

// Return not function with Error if BigInt not supported
function defineBigIntMethod (fn) {
  return typeof BigInt === 'undefined' ? BufferBigIntNotDefined : fn
}

function BufferBigIntNotDefined () {
  throw new Error('BigInt not supported')
}
});

const encoder$1 = new TextEncoder();
const decoder$1 = new TextDecoder();

/*  
@params:
-type: It's string keyword that indicate datatype.
  8, 16, 32     default:  read and write as Uint. BigEndian.
  i8, i16,      includes 'I' then read and write as Int.
  16L , i16l    includes 'L  then read and write as LittleEndian.
-value:  number to store the buffer
return: Buffer
*/

const NB = numberBuffer;
function numberBuffer(type, initValue = 0) {
    let buffer$1;
    if (type === undefined || typeof type !== 'string' || typeof initValue !== 'number') {
        throw TypeError('invlaid init variablie type name. ')
    }
    type = type.toUpperCase();

    if (type.includes('8')) {
        buffer$1 = buffer.Buffer.alloc(1);
        if (type.includes('I')) buffer$1.writeInt8(initValue);
        else buffer$1.writeUint8(initValue);

    } else if (type.includes('16')) {
        buffer$1 = buffer.Buffer.alloc(2);
        if (type.includes('I')) {
            if (type.includes('L')) buffer$1.writeInt16LE(initValue);
            else buffer$1.writeInt16BE(initValue);
        } else {
            if (type.includes('L')) buffer$1.writeUint16LE(initValue);
            else buffer$1.writeUint16BE(initValue);
        }

    } else if (type.includes('32')) {
        buffer$1 = buffer.Buffer.alloc(4);
        if (type.includes('I')) {
            if (type.includes('L')) buffer$1.writeInt32LE(initValue);
            else buffer$1.writeInt32BE(initValue);
        } else {
            if (type.includes('L')) buffer$1.writeUint32LE(initValue);
            else buffer$1.writeUint32BE(initValue);
        }
    } else if (type.includes('N')) {  // number as string
        buffer$1 = buffer.Buffer.from(String(initValue));
    } else {
        console.log(`invalid type: ${type} or initvalue: ${initValue}`);
    }
    return buffer$1

}



/*
@name:  name of the buffer.  
  packer and unpacker use the name.
@type:
  8, 16, 32     default:  read and write as Uint. BigEndian.
  i8, i16,      includes 'I' then read and write as Int.
  16L , i16l    includes 'L  then read and write as LittleEndian.
@data:
  number : new buffer will be initilized with the value.
  buffer without type : use the buffer
  number without type : new buffer alloc with the size

  return  ['name', data:Buffer , 'type']
*/

/* 
 get buffer Object with initial value & meta info( name, data type, endian , length )
 
input:   name, type, initValue 
return:  return ['name',buffer, type ]  

ex. new buffer 4bytes with name.
  MB('bufname', 4)

ex. 
  MB('strBuffer', 'buffer store this text' )

ex.
  MB('uid', '16', 0x12EF )   => name: uid, type: uint16array, bigendian, init value 0x1234.   
  return ['uid', <Buffer 12 EF > , '16' ] 

ex.
  let buf = Buffer.alloc(8)
  MB('bufname', buf )  => name: 'bufname'   8byte buffer. 
  return ['bufname', <Buffer 00 00 00 00 00 00 00 00 > ,'b' ] 

*/

const MB$1 = metaBuffer;
function metaBuffer(name, typeOrData, initValue) {
    let buffer$1;
    let bufferType = 'B';
    if (typeof typeOrData === 'number') {  // this number is buffer size. not value.
        buffer$1 = buffer.Buffer.alloc(typeOrData);
        if (initValue) buffer$1.fill(initValue);
        bufferType = 'B';
    } else if (typeof typeOrData === 'string' && typeof initValue === 'number') { // number with type.
        bufferType = typeOrData.toUpperCase();  //use explicit type name
        buffer$1 = numberBuffer(typeOrData, initValue); // notice.  two categories.  n: number string.  8, 16, 32: typed number.  
    } else if (typeof typeOrData === 'string' && initValue === undefined) { //  string
        buffer$1 = encoder$1.encode(typeOrData);
        bufferType = 'S';
    } else if (typeOrData instanceof Uint8Array && initValue === undefined) {  // buffer 
        buffer$1 = typeOrData;
    } else if (typeOrData instanceof ArrayBuffer && initValue === undefined) {
        buffer$1 = new Uint8Array(typeOrData);
    } else if (ArrayBuffer.isView(typeOrData)) {
        buffer$1 = new Uint8Array(typeOrData.buffer, typeOrData.byteOffset, typeOrData.byteLength);
    } else if (typeof typeOrData === 'object' && initValue === undefined) {  //   object. like array. stringify
        buffer$1 = encoder$1.encode(JSON.stringify(typeOrData));
        bufferType = 'O';
    } else if (typeof typeOrData === 'boolean' && initValue === undefined) {  //   object. like array. stringify
        let v = typeOrData ? 1 : 0;
        buffer$1 = buffer.Buffer.from([v]);
        bufferType = '!';
    } else {
        prn('invalid metabuffer data err', name, typeOrData, initValue);
    }

    if (typeof name === 'string' && name.includes('#')) name = '';  // 

    return [name, bufferType, buffer$1]

}


const MBA = metaBufferArguments;
function metaBufferArguments(...args) {
    let i = 0;
    let mba = args.map(
        data => {
            let argsIndex = i++;  // index number becom metabuffer's name.
            if (typeof data === 'number') {
                // * JS's primitive Number stored as string. 
                return MB$1(argsIndex, 'N', data)
            } else {
                // typedarray, dataview, array, object, boolean
                return MB$1(argsIndex, data)
            }
        });

    // add parameter length. 
    mba.push(MB$1('$', '8', mba.length));
    return mba
}



function readTypedBuffer(type, buffer, offset, length) {
    // prn('RTB type',type)
    if (type.includes('8')) {
        if (type.includes('I')) {
            return buffer.readInt8(offset)
        } else {
            return buffer.readUint8(offset)
        }
    } else if (type.includes('16')) {
        if (type.includes('I')) {
            if (type.includes('L')) {
                return buffer.readInt16LE(offset)
            } else {
                return buffer.readInt16BE(offset)
            }
        } else {
            if (type.includes('L')) {
                return buffer.readUint16LE(offset)
            } else {
                return buffer.readUint16BE(offset)
            }
        }

    } else if (type.includes('32')) {
        if (type.includes('I')) {
            if (type.includes('L')) {
                return buffer.readInt32LE(offset)
            } else {
                return buffer.readInt32BE(offset)
            }
        } else {
            if (type.includes('L')) {
                return buffer.readUint32LE(offset)
            } else {
                return buffer.readUint32BE(offset)
            }
        }

    } else if (type === 'B') { //buffer
        return buffer.slice(offset, offset + length)
    } else if (type === 'S') { //string or arguments
        let strBuffer = buffer.slice(offset, offset + length);
        return decoder$1.decode(strBuffer)
    } else if (type === 'N') { // number encoded as string
        let strNumber = buffer.slice(offset, offset + length);
        return Number(decoder$1.decode(strNumber))
    } else if (type === 'O') { // object encoded string
        let objEncoded = buffer.slice(offset, offset + length);
        try {
            return JSON.parse(decoder$1.decode(objEncoded))
        } catch (error) {
            console.log('err. obj parse');
        }
    } else if (type === '!') { // boolean  1:true 0:false
        let v = buffer.readInt8(offset);
        return v === 1 ? true : false
    } else {
        throw TypeError('invalid data')

    }
}

function flatSubArray(args) {
    // prn('args',args)
    let subArr = [];
    let mainArr = args.filter(item => {
        if (Array.isArray(item[0])) subArr = subArr.concat(item);
        else return item
    });
    return mainArr.concat(subArr)
}

function pack(...args) {
    let bufArr = flatSubArray(args);
    let size = 0;
    let info = [];
    let offset = 0;

    bufArr.forEach(bufPack => {
        let [name, type, data] = bufPack;
        size += data.byteLength;
        if (typeof name === 'number' || name.length > 0) {
            if (type.includes('N') || type.includes('B') || type.includes('S') || type.includes('O')) {
                info.push([name, type, offset, data.byteLength]);
            } else {
                info.push([name, type, offset]);
            }
        }
        offset = size;
    });

    let infoEncoded = encoder$1.encode(JSON.stringify(info));
    let infoSize = infoEncoded.byteLength;
    size = size + infoSize + 2;

    let buffer$1 = buffer.Buffer.alloc(size);
    offset = 0;
    bufArr.forEach(bufPack => {
        let buf = bufPack[2];
        buffer$1.set(buf, offset);
        offset += buf.byteLength;
    });

    buffer$1.set(infoEncoded, offset);
    let infoSizeBuff = NB('16', infoSize);
    buffer$1.set(infoSizeBuff, offset + infoSize);
    return buffer$1
}

function unpack(binPack) {
    let buffer$1 = buffer.Buffer.from(binPack);
    let infoSize = buffer$1.readUInt16BE(buffer$1.byteLength - 2);
    let infoFrom = buffer$1.byteLength - infoSize - 2;
    let infoEncoded = buffer$1.subarray(infoFrom, buffer$1.byteLength - 2);
    try {
        let decoded = decoder$1.decode(infoEncoded);
        let infoArr = JSON.parse(decoded);
        let binObj = {};
        infoArr.forEach(bufPack => {
            let [name, type, offset, length] = bufPack;
            binObj[name] = readTypedBuffer(type, buffer$1, offset, length);
        });

        // set args with values
        if (binObj.$) {
            let argLen = binObj.$;
            let args = [];
            for (let n = 0; n < argLen; n++) {
                args.push(binObj[n]);
            }
            binObj.args = args;
            binObj.$ = binObj.args;  // same  .args or .$
        }
        // prn('binObj',binObj)
        return binObj
    } catch (error) {
        console.log('unpack: invalid data.', error);
    }

}




/* simple parser and packer */
// input: any
// return uint8Array.  
// *point*  if input number -> output is 1 byte Uint8Array that initialized by the input number.
const U8 = parseUint8Array;
function parseUint8Array(data) {

    if (data == undefined) throw 'Invalid data type: Undefined'
    if (typeof data === 'string') { // string > encode > uint8array
        return encoder$1.encode(data)
    } else if (typeof data === 'number') {  // number > 1 byte uint8array(number)
        return Uint8Array.from([data])
    } else if (data instanceof ArrayBuffer ) {  // arraybuffer > wrap uint8arra(ab)
        return new Uint8Array(data)
    } else if (ArrayBuffer.isView(data)) {
        if (data instanceof Uint8Array ) {  // uint8array > return same .  accept Buffer too.
            return data
        } else {
            return new Uint8Array(data.buffer, data.byteOffset, data.byteLength)  // DataView, TypedArray >  uint8array( use offset, length )
        }
    } else { // array, object 
        return encoder$1.encode(JSON.stringify(data))  // object(array.. )  > JSON.str > encode > unint8array
    }
}

// in:  arraybuffer,typedArray,DataView,number
// return: unint8array
// 1. normalize: any into Uint8array 
// 2. return new buffer merged.
const U8pack = parseUint8ThenConcat;
function parseUint8ThenConcat(...dataArray) {
    try {
        let bufferSize = 0;
        let offset = 0;
        let buffers = dataArray.map(data => parseUint8Array(data));
        buffers.forEach(buf => { bufferSize += buf.byteLength; });
        let buffer = new Uint8Array(bufferSize);
        buffers.forEach(buf => {
            buffer.set(buf, offset);
            offset += buf.byteLength;
        });
        return buffer
    } catch (error) {
        console.log(error);
    }
}


function hex(buffer) {
    return Array.prototype.map.call(new Uint8Array(buffer), x => ('00' + x.toString(16)).slice(-2)).join('')
} // arraybuffer를 hex문자열로


function prn(...data) {
    console.log(...data);
}

var metaBufferPack = /*#__PURE__*/Object.freeze({
  __proto__: null,
  NB: NB,
  numberBuffer: numberBuffer,
  MB: MB$1,
  metaBuffer: metaBuffer,
  MBA: MBA,
  metaBufferArguments: metaBufferArguments,
  readTypedBuffer: readTypedBuffer,
  pack: pack,
  unpack: unpack,
  U8: U8,
  parseUint8Array: parseUint8Array,
  U8pack: U8pack,
  parseUint8ThenConcat: parseUint8ThenConcat,
  hex: hex
});

const MB = MB$1;


const encoder = new TextEncoder();
const decoder = new TextDecoder();

let webCrypto;


let isNode = false;
try {
    isNode = Object.prototype.toString.call(global.process) === '[object process]';
} catch (e) { }

try {
    if (isNode) {
        console.log('# node.js env:');
        import('crypto').then(crypto => {
              console.log('otpus webcrypto:');
            webCrypto = crypto.webcrypto;
            // webCryptoTest();
        });
    } else if (typeof importScripts === 'function') {
        webCrypto = self.crypto;
        console.log('# Web Worker env');
        // webCryptoTest();
    } else if (typeof document !== 'undefined') {
        webCrypto = window.crypto;
        console.log('# browser env');
        // webCryptoTest();
    }

} catch (error) {
    console.log('webCrypto err: ', error);
}


function webCryptoTest() {
    if (typeof webCrypto.subtle !== 'object') {
        console.log('No WebCrypto API supported.');
    } else {
        console.log('webCrypto test:');
        let rand = webCrypto.getRandomValues(new Uint8Array(40));
        console.log('1. getRandomValues: ', rand);

        webCrypto.subtle.digest('SHA-256', rand).then(sum => {
            let hash1 = buf2hex(sum);
            let hash2 = hash.hex(rand);
            console.log('A.Compare binary hash sums');
            console.log('1. subtle.digest.sha256: ', hash1);
            console.log('2. js.sha256: ', hash2);
            if (hash1 === hash2) {
                console.log('hash test: success.');
            } else {
                throw new Error('diffrent hash result')
            }

        });
        let message = buf2hex(rand.buffer);

        webCrypto.subtle.digest('SHA-256', encoder.encode(message)).then(sum => {
            let hash1 = buf2hex(sum);
            let hash2 = hash.hex(message);
            console.log('B.Compare string hash sums');
            console.log('1. subtle.digest.sha256: ', hash1);
            console.log('2. js.sha256: ', hash2);
            if (hash1 === hash2) {
                console.log('hash test: success.');
            } else {
                throw new Error('diffrent hash result')
            }

        });

    }
}


/*
    문자열을 UTF8호환 TextEncoder로 encode 하여 버퍼로 변환후 암호화한뒤 base64 문자열로 반환한다.
    특징 및 제한
    1. randomize size.  : 매 암호화시마다 암호결과값의 크기가 달라진다.(현재 0~64 랜덤추가됨)   메시지폭 검사 대항.
    2. control strength of key:  중첩해쉬를 통한 암호키 생성방식으로 강도 조절.
                                2 ^ n 번 중첩연산됨. n은 10~16 충분. 너무크면 시간이 오래걸리므로 주의.
                                현재, 16까지만 되도록 제한걸어둠.

    3. 메시지 크기는 2 ^ 16 까지만 되도록 제한함. 문자열이라 64KB정도로 제한함.

    암호화 결과 데이타 버퍼 구조.
    +---------+-------+----------+
    데이타명:   index   bytesize.
    msg:        [0]     1 ~ 64KB
    hmac:       [-67]   32 Bytes
    salt:       [-35]   32 Bytes
    nPower:     [-3]    1 Bytes
    msgLen:     [-2]    2 Bytes
*/

const msgPos = { msg: 0, hmac: -67, salt: -35, nPower: -3, msgLen: -2 };


function encryptMsg(msg, key, nPower = 10) {
    const msgBuffer = encoder.encode(msg);
    const realMsgLen = msgBuffer.byteLength;
    const saltBin = webCrypto.getRandomValues(new Uint8Array(32));
    // var saltBin = new Uint8Array(32) ;
    const randomSize = realMsgLen + parseInt(webCrypto.getRandomValues(new Uint8Array(1))[0] / 4); // 0~63.
    // var randomSize = 4;
    if (randomSize > 65536) {
        console.log('over msg size limit: it support about 64KB ascii characters.  or about 20K  UTF-8 characters ');
        return ''
    }
    if (nPower > 20) {
        console.log('over ntimeKey limit: 16 max.');
        return ''
    }
    // 다른형식의 데이타나 손상된 메시지 체크도 필요함.  이값이 너무 커지면 멈춤.
    // 현재는 특정사이트용 간단한 구현.  공개lib형의 경우 추가로 메시지 체크섬,  메시지 시간, 규칙, 에러핸들링 추가요함.

    const msgBufferExpanded = new Uint8Array(randomSize);
    msgBufferExpanded.set(msgBuffer);
    const saltStr = buf2hex(saltBin.buffer);
    const masterKeyArr = new Uint8Array(nTimesHash(saltStr + key, Math.pow(2, nPower)));

    let hmac = hash.hmac(masterKeyArr, msgBuffer);

    xotp(msgBufferExpanded, masterKeyArr, 0);
    const base64Buffer = new Uint8Array(msgBufferExpanded.byteLength + hmac.byteLength + saltBin.byteLength + 3);
    base64Buffer.set(msgBufferExpanded);

    base64Buffer.set(hmac, base64Buffer.byteLength + msgPos.hmac);
    base64Buffer.set(saltBin, base64Buffer.byteLength + msgPos.salt);
    base64Buffer[base64Buffer.byteLength + msgPos.nPower] = nPower;
    const dv = new DataView(base64Buffer.buffer);
    dv.setUint16(base64Buffer.byteLength + msgPos.msgLen, msgBufferExpanded.byteLength);
    return base64Js.fromByteArray(base64Buffer)
}


function encryptMsgPack(msg, key, nPower = 10) {
    const msgBuffer = encoder.encode(msg);
    const realMsgLen = msgBuffer.byteLength;
    const saltBin = webCrypto.getRandomValues(new Uint8Array(32));
    // var saltBin = new Uint8Array(32) ;
    const randomSize = realMsgLen + parseInt(webCrypto.getRandomValues(new Uint8Array(1))[0] / 4); // 0~63.
    // var randomSize = 4;
    if (randomSize > 65536) {
        console.log('over msg size limit: it support about 64KB ascii characters.  or about 20K  UTF-8 characters ');
        return ''
    }
    if (nPower > 20) {
        console.log('over ntimeKey limit: 16 max.');
        return ''
    }

   
    const msgBufferExpanded = new Uint8Array(randomSize);
    msgBufferExpanded.set(msgBuffer);
    const saltStr = buf2hex(saltBin);

    const masterKeyArr = new Uint8Array(nTimesHash(saltStr + key, Math.pow(2, nPower)));

    let hmac = hash.hmac(masterKeyArr, msgBuffer);


    xotp(msgBufferExpanded, masterKeyArr, 0);

    let pack$1 = pack(
        MB('msgBuffer', msgBufferExpanded),
        MB('hmac', hmac ),
        MB('salt', saltBin ),
        MB('nPower','8',nPower),
        MB('msgLen','16', msgBuffer.byteLength )
    );
        // console.log( pack )
    return pack$1.toString('base64')

}

function decryptMsgPack(b64msg, key) {
    let msgObj = unpack( buffer.Buffer.from(b64msg,'base64') );

    // console.log( 'msgObj', msgObj)

    if (msgObj.nPower > 20) {
        console.log('warning: too much nPower:' + msgObj.nPower);
        return 'nPower too large'
    }
    const saltStr = buf2hex( msgObj.salt);
    const masterKeyArr = new Uint8Array(nTimesHash(saltStr + key, Math.pow(2, msgObj.nPower)));
    xotp(msgObj.msgBuffer , masterKeyArr, 0);
    const realMsgBuffer = msgObj.msgBuffer.slice(0,  msgObj.msgLen );

    let hmac = hash.hmac(masterKeyArr, realMsgBuffer);

    if (!equal(hmac, msgObj.hmac )) return 'BROKEN'
    const msg = decoder.decode(realMsgBuffer);

    return msg
}

function decryptMsg(b64msg, key) {
    const totalBuffer = base64Js.toByteArray(b64msg);
    const dv = new DataView(totalBuffer.buffer);
    const msgLen = dv.getUint16(totalBuffer.byteLength + msgPos.msgLen);
    const expandedMsgBuffer = totalBuffer.slice(0, msgLen);
    const saltBin = totalBuffer.slice(msgPos.salt, msgPos.nPower);
    const hmacRead = totalBuffer.slice(msgPos.hmac, msgPos.salt);

    const nPower = dv.getUint8(totalBuffer.byteLength + msgPos.nPower);
    if (nPower > 20) {
        console.log('warning: too much nPower:' + nPower);
        return 'nPower 값이 너무큰것같음'
    }
    const saltStr = buf2hex(saltBin.buffer);
    const masterKeyArr = new Uint8Array(nTimesHash(saltStr + key, Math.pow(2, nPower)));
    xotp(expandedMsgBuffer, masterKeyArr, 0);
    const realMsgBuffer = expandedMsgBuffer.slice(0, expandedMsgBuffer.indexOf(0));

    let hmac = hash.hmac(masterKeyArr, realMsgBuffer);

    if (!equal(hmac, hmacRead)) return 'BROKEN'
    const msg = decoder.decode(realMsgBuffer);

    return msg
}

function buf2hex(buffer) { return Array.prototype.map.call(new Uint8Array(buffer ), x => ('00' + x.toString(16)).slice(-2)).join('') } // arraybuffer를 hex문자열로


/*
key:
data:
otpStartIndex:

*/
function xotp(data, key, otpStartIndex = 0) {

    // SET.  32bytes key.
    let cryptoKey;
    if (key === null || key === undefined || key === '') {
        throw 'bayoX: cryptoKey is null or undefined'
    } else if (key instanceof ArrayBuffer) {
        cryptoKey = new Uint8Array(key);
    } else if (typeof key === 'string') {
        cryptoKey = new Uint8Array(hash.arrayBuffer(key));
    } else if (ArrayBuffer.isView(key)) {
        if (key instanceof Uint8Array) {
            cryptoKey = key;
        } else {
            throw new Error('Accept key types : String, ArrayBuffer or Uint8Array')
        }
    } else {
        throw new Error('unsupported key data type')
    }
    if (cryptoKey.byteLength != 32) {
        throw 'cryptoKey byteLength not 32Bytes'
    }

    // SET data Buffer.
    if (typeof data === 'string') {
        data = encoder.encode(data);
    } else if (ArrayBuffer.isView(data)) {
        if (data instanceof Uint8Array) ; else {
            console.log( 'err data',data );
            throw new Error('Use Uint8Array')
        }
    } else if (data instanceof ArrayBuffer) {
        data = new Uint8Array(data);
    } else {
        throw new Error('unsupported data type')
    }

    const otpMasterKeyArr = new Uint32Array(9);
    const cryptoKeyArr = new Uint32Array(cryptoKey.buffer);
    otpMasterKeyArr.set(cryptoKeyArr);
    otpMasterKeyArr[8] = otpStartIndex;
    const nBytes = data.byteLength;
    const nTimes = Math.ceil(nBytes / 32); // 최소값 1   ; 필요한 otp 개수
    const lastTime = nTimes - 1; // 최소값 0
    const nRemains = nBytes % 32;
    const buf32Len = Math.floor(nBytes / 4); // byteLength / 4 => 4바이트의 배수
    // console.log(`bayoXCrypto src u8Arr .byteOffset: ${u8Arr.byteOffset} .byteLength: ${u8Arr.byteLength}  1/4 floored => buf32Len: ${buf32Len}`);

    const buf32 = new Uint32Array(data.buffer, data.byteOffset, buf32Len);

    for (let i = 0; i < nTimes; i++) {
        // 32바이트 단위로 원본 파일읽어서 otp 연산.
        // 1. indexed psudo otp 생성
        otpMasterKeyArr[8]++;
        const potp = hash.arrayBuffer(otpMasterKeyArr.buffer);
        const potp32 = new Uint32Array(potp);

        if (i == lastTime && nRemains != 0) { // 32바이트 이하 (나머지 Byte 연산)
            const potp8 = new Uint8Array(potp);
            for (let q = nBytes - nRemains, r = 0; r < nRemains; r++) { // 최대 31번
                // console.log(`q:${q} r:${r}`);
                data[q++] ^= potp8[r]; // q;버퍼의 index   r; otp의 index
            }
        } else { // 4Bytes 단위 8회 연산
            for (let ib = 0; ib < 8; ib++) buf32[i * 8 + ib] ^= potp32[ib];
        }
    }


    return data

}

function equal(buf1, buf2) {
    if(buf1.byteLength != buf2.byteLength ) return false
    for(let i = 0 ; i < buf1.byteLength; i++){
      if(buf1[i] != buf2[i] ) return false
    }
  
    return true 
  }
  

/* nTimesHash.   (PBKDF2 와 유사한 용도)
최초  srcData로 arrayBuffer화 1회 연ㅏ 후  n회 반복.  총 hash 연산수는 n+1번임.
입력: srcData:  참고로 문자열, UTF-8문자열 입력시 인코딩됨, array, typedarray, arraybuffer 모두 지원
출력: arraybuffer 반환
*/

function nTimesHash(srcData, n) {
    let hashSum = hash.arrayBuffer(srcData);
    for (let i = 0; i < n; i++) hashSum = hash.arrayBuffer(hashSum);
    return hashSum
}

var Buffer = buffer.Buffer;
export { Buffer, metaBufferPack as MBP, base64Js as base64js, buf2hex, decoder, decryptMsg, decryptMsgPack, encoder, encryptMsg, encryptMsgPack, equal, nTimesHash, hash as sha256, webCrypto, webCryptoTest, xotp };
