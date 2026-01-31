export type GatePayload = {
  eventId?: string;
  tokenId?: string;
  code?: string;
};

const GATE_SCHEME_PREFIX = "etkinlik://gate";

function readFirstParam(params: URLSearchParams, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = params.get(key);
    if (value && value.trim()) {
      return value.trim();
    }
  }
  return undefined;
}

export function parseGatePayloadFromSearchParams(params: URLSearchParams): GatePayload {
  return {
    eventId: readFirstParam(params, ["e", "eventId"]),
    tokenId: readFirstParam(params, ["t", "tokenId"]),
    code: readFirstParam(params, ["c", "code"]),
  };
}

export function parseGatePayloadFromString(input: string): GatePayload | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  if (!lower.startsWith(GATE_SCHEME_PREFIX)) return null;
  try {
    const url = new URL(trimmed);
    return parseGatePayloadFromSearchParams(url.searchParams);
  } catch {
    return null;
  }
}

type GatePayloadTestCase = {
  name: string;
  value: string;
  expected: GatePayload;
};

export function runGatePayloadParsingTests() {
  const cases: GatePayloadTestCase[] = [
    {
      name: "short keys from /gate",
      value: "/gate?v=1&e=2&t=23&c=W4WU-NDTR-8ZGS",
      expected: { eventId: "2", tokenId: "23", code: "W4WU-NDTR-8ZGS" },
    },
    {
      name: "long keys from /gate",
      value: "/gate?eventId=2&tokenId=23&code=W4WU-NDTR-8ZGS",
      expected: { eventId: "2", tokenId: "23", code: "W4WU-NDTR-8ZGS" },
    },
    {
      name: "scheme payload",
      value: "etkinlik://gate?v=1&e=2&t=23&c=W4WU-NDTR-8ZGS",
      expected: { eventId: "2", tokenId: "23", code: "W4WU-NDTR-8ZGS" },
    },
  ];

  const results = cases.map((testCase) => {
    let actual: GatePayload = {};
    if (testCase.value.startsWith("etkinlik://gate")) {
      actual = parseGatePayloadFromString(testCase.value) ?? {};
    } else {
      const url = new URL(testCase.value, "https://example.test");
      actual = parseGatePayloadFromSearchParams(url.searchParams);
    }
    const ok = JSON.stringify(actual) === JSON.stringify(testCase.expected);
    return { ...testCase, actual, ok };
  });

  const ok = results.every((result) => result.ok);
  return { ok, results };
}
