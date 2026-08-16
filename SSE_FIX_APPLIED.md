# SSE Real-Time Updates - Fix Applied

## Problem
Real-time updates on admin dashboard were not working in production.

## Root Cause
Nginx was buffering Server-Sent Events (SSE) responses by default, preventing the EventSource client from receiving data in real-time.

## Solution Applied
Added `X-Accel-Buffering: no` header to the SSE endpoint in `api/admin-db.js`:

```javascript
res.setHeader("X-Accel-Buffering", "no");  // Tell nginx: DO NOT buffer this response
```

## Why This Works
- `X-Accel-Buffering` is a special header that nginx recognizes
- Setting it to "no" tells nginx to bypass response buffering for this specific request
- This allows SSE data to stream immediately to the browser
- Works even when you don't control the nginx configuration (like in this hackathon)

## Verification Steps

After deployment completes:

1. **Open the admin dashboard**
   - Go to: `https://team07.aiforthai.in.th/api/admin-db?secret=YOUR_SECRET`

2. **Check browser DevTools (F12)**
   - Network tab → Look for request to `admin-db?secret=...&stream=true`
   - Should show:
     - Status: `200`
     - Type: `text/event-stream`
     - Size: Shows increasing (streaming)

3. **Watch live updates**
   - The "Live Updates (Last 5 messages)" section should refresh every 2 seconds
   - The pulsing green dot next to "LIVE" badge indicates active connection
   - Send a test message via LINE Bot or web chat
   - Should appear in the live updates within 2 seconds

4. **Check Console tab**
   - Should see no EventSource errors
   - Connection should stay open (not reconnecting constantly)

## What Changed
- **Before**: nginx buffered responses → EventSource never received initial data → connection timeout
- **After**: nginx streams responses immediately → EventSource connects successfully → live updates work

## Technical Details

The header works with common nginx proxy configurations:
- `X-Accel-Buffering: no` overrides `proxy_buffering on` at the request level
- Nginx documentation: http://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_buffering
- This is the standard solution for SSE/streaming when you can't modify nginx config

## Files Changed
- `api/admin-db.js` (line 28): Added X-Accel-Buffering header
- `SSE_TROUBLESHOOTING.md`: Comprehensive debugging guide for future reference

## Next Steps
After deployment succeeds, verify the fix works by following the verification steps above.
