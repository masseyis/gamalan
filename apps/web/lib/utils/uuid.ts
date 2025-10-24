const UUID_NAMESPACE_URL = '6ba7b811-9dad-11d1-80b4-00c04fd430c8'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const textEncoder = new TextEncoder()

const parseUuid = (uuid: string): Uint8Array => {
  const hex = uuid.replace(/-/g, '').toLowerCase()
  if (hex.length !== 32) {
    throw new Error('Invalid UUID length')
  }

  const bytes = new Uint8Array(16)
  for (let i = 0; i < 16; i += 1) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  }
  return bytes
}

const stringifyUuid = (bytes: Uint8Array): string => {
  const hex: string[] = []
  bytes.forEach((byte) => {
    hex.push((byte + 0x100).toString(16).slice(1))
  })

  return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex
    .slice(6, 8)
    .join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10).join('')}`
}

const leftRotate = (value: number, shift: number): number =>
  ((value << shift) | (value >>> (32 - shift))) >>> 0

const sha1 = (input: Uint8Array): Uint8Array => {
  const messageLength = input.length
  const wordArrayLength = (((messageLength + 8) >> 6) + 1) << 4
  const words = new Uint32Array(wordArrayLength)

  for (let i = 0; i < messageLength; i += 1) {
    const wordIndex = i >> 2
    const byteOffset = 24 - (i & 3) * 8
    words[wordIndex] |= input[i] << byteOffset
  }

  const lastWord = messageLength >> 2
  const lastByteOffset = (messageLength & 3) * 8
  words[lastWord] |= 0x80 << (24 - lastByteOffset)
  words[wordArrayLength - 1] = messageLength * 8

  let h0 = 0x67452301
  let h1 = 0xefcdab89
  let h2 = 0x98badcfe
  let h3 = 0x10325476
  let h4 = 0xc3d2e1f0

  const w = new Uint32Array(80)

  for (let block = 0; block < wordArrayLength; block += 16) {
    for (let i = 0; i < 16; i += 1) {
      w[i] = words[block + i]
    }

    for (let i = 16; i < 80; i += 1) {
      const value = w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16]
      w[i] = leftRotate(value, 1)
    }

    let a = h0
    let b = h1
    let c = h2
    let d = h3
    let e = h4

    for (let i = 0; i < 80; i += 1) {
      let f: number
      let k: number

      if (i < 20) {
        f = (b & c) | (~b & d)
        k = 0x5a827999
      } else if (i < 40) {
        f = b ^ c ^ d
        k = 0x6ed9eba1
      } else if (i < 60) {
        f = (b & c) | (b & d) | (c & d)
        k = 0x8f1bbcdc
      } else {
        f = b ^ c ^ d
        k = 0xca62c1d6
      }

      const temp = (leftRotate(a, 5) + f + e + k + w[i]) >>> 0
      e = d
      d = c
      c = leftRotate(b, 30)
      b = a
      a = temp
    }

    h0 = (h0 + a) >>> 0
    h1 = (h1 + b) >>> 0
    h2 = (h2 + c) >>> 0
    h3 = (h3 + d) >>> 0
    h4 = (h4 + e) >>> 0
  }

  const digest = new Uint8Array(20)
  const result = [h0, h1, h2, h3, h4]
  for (let i = 0; i < result.length; i += 1) {
    const value = result[i]
    digest[i * 4] = (value >>> 24) & 0xff
    digest[i * 4 + 1] = (value >>> 16) & 0xff
    digest[i * 4 + 2] = (value >>> 8) & 0xff
    digest[i * 4 + 3] = value & 0xff
  }

  return digest
}

export const uuidV5 = (value: string, namespace = UUID_NAMESPACE_URL): string => {
  const namespaceBytes = parseUuid(namespace)
  const valueBytes = textEncoder.encode(value)

  const combined = new Uint8Array(namespaceBytes.length + valueBytes.length)
  combined.set(namespaceBytes)
  combined.set(valueBytes, namespaceBytes.length)

  const hash = sha1(combined)

  hash[6] = (hash[6] & 0x0f) | 0x50
  hash[8] = (hash[8] & 0x3f) | 0x80

  return stringifyUuid(hash.slice(0, 16))
}

export const validateUuid = (value?: string | null): boolean => {
  if (!value) {
    return false
  }
  return UUID_REGEX.test(value)
}

export const normalizeUserId = (value?: string | null): string => {
  if (!value || !value.trim()) {
    return uuidV5('anonymous')
  }

  const trimmed = value.trim()
  return validateUuid(trimmed) ? trimmed.toLowerCase() : uuidV5(trimmed)
}
