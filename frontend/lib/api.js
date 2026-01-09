// Use explicit env var when provided; otherwise use a relative path so the
// browser will call the same origin that served the frontend. In development
// Next.js often serves the frontend on a different port than the Flask API
// (e.g. 3000 vs 5000). If a same-origin `'/api/..'` returns 404 or fails,
// we optionally retry against `http://localhost:5000` to make local dev
// smoother. In production set `NEXT_PUBLIC_BACKEND_URL` to your backend origin.
const BACKEND_ORIGIN = process.env.NEXT_PUBLIC_BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || ''

async function fetchWithFallback(path, options){
  const primary = (BACKEND_ORIGIN || '') + path
  try{
    console.debug('[api] fetching primary URL:', primary)
    const res = await fetch(primary, options)
    // If running on Next dev server (no proxy) a same-origin '/api/..' may
    // return 404 — in that case, try the common Flask default host/port.
    if(res.status === 404 && !BACKEND_ORIGIN){
      const fallbackUrl = 'http://localhost:5000' + path
      console.debug('[api] primary returned 404, trying fallback:', fallbackUrl)
      try{
        const r2 = await fetch(fallbackUrl, options)
        console.debug('[api] fallback response status:', r2.status)
        return r2
      }catch(e){
        console.debug('[api] fallback fetch failed:', e)
        return res
      }
    }
    console.debug('[api] primary response status:', res.status)
    return res
  }catch(err){
    // Network error on primary; if no explicit origin configured try localhost:5000
    if(!BACKEND_ORIGIN){
      const fallbackUrl = 'http://localhost:5000' + path
      console.debug('[api] primary fetch threw, trying fallback:', fallbackUrl, err)
      return fetch(fallbackUrl, options)
    }
    throw err
  }
}

async function handleRes(res){
  const j = await res.json().catch(()=>null)
  if(!res.ok) throw new Error((j && j.error) || `HTTP ${res.status}`)
  return j
}

export async function convertTimestamps(raw_text){
  const res = await fetchWithFallback('/api/convert', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw_dates: raw_text })
  })
  return handleRes(res)
}

export async function postStep2(payload){
  const res = await fetchWithFallback('/api/step2', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
  return handleRes(res)
}

export async function postReliability(chosen_method, results, reliability_level){
  const res = await fetchWithFallback('/api/reliability', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chosen_method, results, reliability_level })
  })
  return handleRes(res)
}

// Special-case plot endpoint: callers expect the raw Response so they can
// call `.json()` and handle image payloads. We return the underlying
// Response from fetchWithFallback so step pages can parse as needed.
export async function fetchPlot(payload){
  return fetchWithFallback('/api/plot', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
}