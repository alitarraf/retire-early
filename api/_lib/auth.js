// Resolve the signed-in Supabase user from a request's Bearer token.
// Server-side verification via the secret-key client. Returns null when there's
// no token, it's invalid, or Supabase isn't configured.

export async function getUserFromRequest(sb, req) {
  if (!sb) return null;
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token) return null;
  try {
    const { data, error } = await sb.auth.getUser(token);
    if (error || !data?.user) return null;
    return data.user;
  } catch {
    return null;
  }
}
