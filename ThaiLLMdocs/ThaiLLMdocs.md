## Use this model: Pathumma-ThaiLLM-qwen3-8b-think-3.0.0

API Key: CkAPIGzjpSP7jgLmbrlD4P8yJ9SuOb4T

Manage API Keys →
Consumer ID
fbea2150-a93c-401f-a9df-fe2d9c206d99
How to Use
Use this API key to make requests to the ThaiLLM API. Two endpoint shapes are supported:
New (OpenAI-compatible) — recommended

curl http://thaillm.or.th/api/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer CkAPIGzjpSP7jgLmbrlD4P8yJ9SuOb4T" \
  -d '{
    "model": "pathumma-thaillm-qwen3-8b-think-3.0.0",
    "messages": [
      {"role": "user", "content": "สวัสดี"}
    ],
    "max_tokens": 2048,
    "temperature": 0.3
  }'
Legacy (path-based) — still supported

curl http://thaillm.or.th/api/pathumma/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer CkAPIGzjpSP7jgLmbrlD4P8yJ9SuOb4T" \
  -d '{
    "model": "/model",
    "messages": [
      {"role": "user", "content": "สวัสดี"}
    ],
    "max_tokens": 2048,
    "temperature": 0.3
  }'
model accepts shorthand (openthaigpt) or lowercase full name (openthaigpt-thaillm-8b-instruct-v7.2). List all models with GET /api/v1/models.