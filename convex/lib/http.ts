import { canonicalUrl } from "./model";
export const SOURCE_HOSTS = ["devpost.com", "api.coursera.org", "www.eventbrite.com", "www.meetup.com", "citec.com.ec", "www.espol.edu.ec", "www.uce.edu.ec"];
export const LINK_HOSTS = [...SOURCE_HOSTS, "coursera.org", "eventbrite.com", "meetup.com", "lu.ma", "luma.com", "ekoseventos.com", "epn.edu.ec", "espol.edu.ec", "uce.edu.ec"];
export function checkDestination(value: string, hosts: string[]) {
  canonicalUrl(value); // Validate without changing a fetch path or stripping a required trailing slash.
  const url = new URL(value);
  if (!hosts.some(host => url.hostname === host || url.hostname.endsWith("." + host))) throw new Error("Host not allowed: " + url.hostname);
  return url.href;
}
export async function safeFetch(url: string, options: {
  method?: "GET" | "HEAD"; hosts: string[]; headers?: Record<string, string>;
  maxBytes?: number; timeoutMs?: number; onRequest?: () => void;
}): Promise<{ status: number; text: string; headers: Headers }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 10_000);
  try {
    let target = checkDestination(url, options.hosts);
    for (let redirect = 0; redirect <= 3; redirect++) {
      options.onRequest?.();
      const response = await fetch(target, { method: options.method ?? "GET", redirect: "manual",
        signal: controller.signal, headers: { "User-Agent": "SimCodecEvents/1.0 (+https://eventos.simcodec.com)", ...options.headers } });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get("location");
        await response.body?.cancel();
        if (!location || redirect === 3) throw new Error("Redirect limit or missing location");
        target = checkDestination(new URL(location, target).href, options.hosts);
        continue;
      }
      if (options.method === "HEAD" || response.status === 304) {
        await response.body?.cancel();
        return { status: response.status, text: "", headers: response.headers };
      }
      const limit = options.maxBytes ?? 2_000_000;
      if (Number(response.headers.get("content-length")) > limit) {
        await response.body?.cancel(); throw new Error("Response too large");
      }
      const reader = response.body?.getReader();
      let total = 0;
      let text = "";
      const decoder = new TextDecoder();
      if (reader) {
        try {
          for (;;) {
            const part = await reader.read();
            if (part.done) break;
            total += part.value.byteLength;
            if (total > limit) { await reader.cancel(); throw new Error("Response too large"); }
            text += decoder.decode(part.value, { stream: true });
          }
          text += decoder.decode();
        } finally { reader.releaseLock(); }
      }
      return { status: response.status, text, headers: response.headers };
    }
    throw new Error("Redirect limit");
  } finally { clearTimeout(timer); }
}
