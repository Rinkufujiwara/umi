// Sign-in runs through our own domain (authDomain = this site), so Firebase's helper pages under /__/auth/
// are passed through to the Firebase project (same as the old vercel.json rewrite).
const UPSTREAM = "https://spanish-shelf.firebaseapp.com";

export async function onRequest({ request }) {
  const url = new URL(request.url);
  const upstream = new Request(UPSTREAM + url.pathname + url.search, request);
  return fetch(upstream, { redirect: "manual" });
}
