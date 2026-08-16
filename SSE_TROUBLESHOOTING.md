# SSE (Server-Sent Events) Troubleshooting Guide

## Problem
Real-time updates on admin dashboard are not working in production despite code being deployed.

## Root Cause Analysis

### 1. Nginx Buffering (MOST LIKELY)
**Issue:** Nginx buffers responses by default, which **breaks SSE streaming**.

SSE requires immediate response flushing, but nginx's default `proxy_buffering on` holds responses in memory until:
- Buffer fills up (default 4KB-8KB)
- Response completes
- Timeout occurs

This means the EventSource client never receives the initial SSE handshake, connection times out, and no live updates appear.

### 2. How to Verify

Check browser DevTools → Network tab:
- Look for request to `admin-db?secret=xxx&stream=true`
- If status shows "pending" forever → nginx buffering issue
- If status shows 200 but no data → check console for CSP/CORS errors
- If request doesn't appear → JavaScript error (check Console tab)

### 3. The Fix - Nginx Configuration

Add these directives to the nginx location block for `/api/`:

```nginx
location /api/ {
    proxy_pass http://api:8000/;
    
    # Essential for SSE to work
    proxy_buffering off;           # ← CRITICAL: Disable response buffering
    proxy_cache off;               # Disable caching for SSE
    proxy_http_version 1.1;        # HTTP/1.1 required for SSE
    proxy_set_header Connection '';  # Clear Connection header
    
    # Standard proxy headers
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    
    # Timeouts for long-lived SSE connections
    proxy_read_timeout 3600s;      # 1 hour (SSE can be open indefinitely)
    proxy_send_timeout 3600s;
    proxy_connect_timeout 60s;
}
```

### 4. Alternative: SSE-Specific Location Block

If you only want to disable buffering for SSE endpoint:

```nginx
# Regular API endpoints
location /api/ {
    proxy_pass http://api:8000/;
    proxy_buffering on;  # Keep buffering for regular requests
    # ... other settings
}

# SSE endpoint only
location /api/admin-db {
    proxy_pass http://api:8000/admin-db;
    proxy_buffering off;           # ← Disable only for SSE
    proxy_cache off;
    proxy_http_version 1.1;
    proxy_set_header Connection '';
    proxy_read_timeout 3600s;
    proxy_send_timeout 3600s;
    
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

### 5. Apply the Fix

**Where is nginx config?**
- Likely at: `/etc/nginx/sites-available/team07.aiforthai.in.th`
- Or: `/etc/nginx/conf.d/team07.conf`

**How to apply:**
```bash
# SSH into the server
ssh user@team07.aiforthai.in.th

# Edit nginx config (use your actual config path)
sudo nano /etc/nginx/sites-available/team07.aiforthai.in.th

# Add the configuration above to the /api/ location block

# Test nginx config syntax
sudo nginx -t

# If test passes, reload nginx
sudo systemctl reload nginx

# Check nginx is running
sudo systemctl status nginx
```

### 6. Verify the Fix

After applying nginx changes:

1. Open browser DevTools (F12)
2. Go to Network tab
3. Visit: `https://team07.aiforthai.in.th/api/admin-db?secret=YOUR_SECRET`
4. Look for request to `admin-db?secret=xxx&stream=true`
5. Should show:
   - Status: 200
   - Type: `text/event-stream`
   - Transfer: chunked
   - Data streaming in real-time

6. Check Console tab for:
   ```
   No errors about EventSource
   ```

7. Watch "Live Updates" section update every 2 seconds with latest messages

### 7. Other Potential Issues (Less Likely)

#### a. Firewall blocking long-lived connections
```bash
# Check if connection drops after certain time
timeout 65 curl -N "http://localhost:8000/admin-db?secret=test&stream=true"
```

#### b. Database connection pool exhausted
```bash
# Check PostgreSQL connections
docker exec -it team07-db-1 psql -U postgres -c "SELECT count(*) FROM pg_stat_activity;"
```

#### c. CSP blocking EventSource (already fixed in code)
- Current CSP allows `connect-src 'self'` ✓

#### d. JavaScript errors
- Check browser Console for errors
- EventSource should log connection state

### 8. Testing SSE Without Browser

```bash
# Test SSE endpoint directly (bypasses nginx)
curl -N "http://localhost:8000/admin-db?secret=YOUR_SECRET&stream=true"

# Should output:
# data: {"count":123,"latestMessages":[...]}
#
# data: {"count":123,"latestMessages":[...]}
# (repeating every 2 seconds)
```

If this works but browser doesn't → nginx buffering issue.
If this doesn't work → check API logs for errors.

## Summary

**Most likely fix:** Add `proxy_buffering off;` to nginx `/api/` location block.

**Why this wasn't caught earlier:** Local testing doesn't use nginx, so SSE works fine locally but fails in production behind the reverse proxy.

**How to prevent in future:** Test SSE features through a local nginx reverse proxy before deploying to production.
