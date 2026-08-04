// Optional integration with the local-forecast/ Python service.
// That service only runs on your own machine (`uvicorn app:app --port 8000`),
// never on Vercel — so this must fail silently and fast when it's not
// reachable (e.g. in production) rather than slowing down or breaking
// the main forecast response.

const BASE_URL = process.env.LOCAL_FORECAST_URL || "http://localhost:8000";
const TIMEOUT_MS = 1500;

export async function fetchAdvancedSignal(symbol, market, horizon = 5) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const params = new URLSearchParams({ symbol, market, horizon: String(horizon) });
    const res = await fetch(`${BASE_URL}/predict?${params.toString()}`, {
      signal: controller.signal,
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    // Local service not running, unreachable, or timed out — that's fine,
    // the caller just won't show the advanced panel.
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
