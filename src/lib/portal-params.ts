export interface IncomingPortalParams {
  isFromPortal: boolean;
  ref?: string;
  username?: string;
  color?: string;
  speed?: number;
}

export function readIncomingPortalParams(): IncomingPortalParams {
  if (typeof window === "undefined") return { isFromPortal: false };
  const q = new URLSearchParams(window.location.search);
  return {
    isFromPortal: q.get("portal") === "true",
    ref: q.get("ref") ?? undefined,
    username: q.get("username") ?? undefined,
    color: q.get("color") ?? undefined,
    speed: q.has("speed") ? Number(q.get("speed")) : undefined,
  };
}

interface OutgoingParams {
  username?: string;
  color?: string;
  speed?: number;
  ref?: string;
}

export function buildOutgoingUrl(target: string, params: OutgoingParams): string {
  const u = new URL(target);
  if (params.username) u.searchParams.set("username", params.username);
  if (params.color) u.searchParams.set("color", params.color);
  if (params.speed != null && Number.isFinite(params.speed)) {
    u.searchParams.set("speed", params.speed.toFixed(2));
  }
  if (params.ref) u.searchParams.set("ref", params.ref);
  return u.toString();
}

/** Hostname of this game (for sending as ref to next game). */
export function ownRef(): string {
  if (typeof window === "undefined") return "";
  return window.location.host;
}

/** Normalize a `ref` query param into a URL we can navigate to. */
export function refToUrl(ref: string): string {
  const trimmed = ref.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}
