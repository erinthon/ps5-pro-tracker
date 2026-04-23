import axios from "axios";

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14.7; rv:131.0) Gecko/20100101 Firefox/131.0",
];

// Delays em ms entre tentativas: [1ª retry, 2ª retry]
const RETRY_DELAYS = [1500, 4000];
// 403 incluído pois Cloudflare pode bloquear temporariamente e liberar após espera
const RETRYABLE_STATUSES = new Set([403, 429, 503, 504]);

function randomUA(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function buildHeaders(ua: string, extra: Record<string, string> = {}): Record<string, string> {
  const isChrome = ua.includes("Chrome") && !ua.includes("Firefox");
  const base: Record<string, string> = {
    "User-Agent": ua,
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
    "Accept-Encoding": "gzip, deflate, br",
    "Cache-Control": "max-age=0",
    "Upgrade-Insecure-Requests": "1",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
  };

  if (isChrome) {
    const versionMatch = ua.match(/Chrome\/([\d]+)/);
    const v = versionMatch?.[1] ?? "130";
    base["Sec-Ch-Ua"] = `"Chromium";v="${v}", "Google Chrome";v="${v}", "Not?A_Brand";v="99"`;
    base["Sec-Ch-Ua-Mobile"] = "?0";
    base["Sec-Ch-Ua-Platform"] = '"Windows"';
  }

  return { ...base, ...extra };
}

export async function fetchHtml(url: string, extra: Record<string, string> = {}): Promise<string> {
  const ua = randomUA();
  const headers = buildHeaders(ua, extra);

  for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
    try {
      const response = await axios.get<string>(url, { headers, timeout: 20000 });
      return response.data;
    } catch (error: any) {
      const status: number | undefined = error?.response?.status;
      if (status && RETRYABLE_STATUSES.has(status) && attempt < RETRY_DELAYS.length) {
        const delay = RETRY_DELAYS[attempt];
        console.warn(`[HTTP] ${status} em ${url} — tentativa ${attempt + 1}, aguardando ${delay}ms`);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw error;
    }
  }

  throw new Error(`[HTTP] Max retries atingido para ${url}`);
}
