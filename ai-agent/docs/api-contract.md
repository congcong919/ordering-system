# API Contract — La Bella Cucina Backend

Base URL (development): `http://localhost:8000`

All requests and responses use UTF-8 encoding. There is no authentication, versioning, or rate limiting on any endpoint.

---

## `GET /api/health`

Health check. Used to confirm the backend is running.

### Request
No body. No parameters.

### Response `200 OK`
```json
{
  "status": "ok",
  "restaurant": "La Bella Cucina"
}
```

### Error responses
None — if the server is not running the request will time out or return a network error.

---

## `POST /api/chat`

Sends a user message to the agent and receives the response as a Server-Sent Events stream.

### Request

**Content-Type:** `application/json`

```json
{
  "message": "string",
  "session_id": "string"
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `message` | string | Yes | The user's chat message. No enforced length limit (known issue). |
| `session_id` | string | Yes | UUID identifying the conversation session. Generated client-side via `crypto.randomUUID()`. |

### Response `200 OK`

**Content-Type:** `text/event-stream`

The response body is a stream of SSE frames. Two event types are used:

**Token frame** — emitted for each text token of the agent's response:
```
event: token
data: {"text": "<token string>"}

```

**Done frame** — emitted once when the agent has finished responding:
```
event: done
data: 

```

The stream ends after the `done` frame. The client should close the connection at this point.

#### Example stream
```
event: token
data: {"text": "Buongiorno"}

event: token
data: {"text": "! Here"}

event: token
data: {"text": " are today"}

event: token
data: {"text": "'s specials:"}

event: done
data: 
```

### Response `422 Unprocessable Entity`

Returned by FastAPI when the request body is malformed or missing required fields.

```json
{
  "detail": [
    {
      "type": "missing",
      "loc": ["body", "session_id"],
      "msg": "Field required",
      "input": {}
    }
  ]
}
```

### Error behaviour (within the stream)

If the agent encounters an unhandled exception during processing, the error is not returned as an HTTP error code. Instead, an error message is pushed as a token into the stream:

```
event: token
data: {"text": "Sorry, something went wrong. Please try again."}

event: done
data: 
```

The HTTP status code remains `200`. The client has no way to distinguish an agent error from a normal short response except by reading the content.

### Client implementation note

The frontend (`api/chat.ts`) does **not** use the browser's `EventSource` API. It uses `fetch()` with a `ReadableStream` reader and an `AbortController` signal. This allows the stream to be cancelled mid-flight (stop button). `EventSource` does not support `AbortController`.

---

## `DELETE /api/session/{session_id}`

Clears the LangGraph conversation memory for a given session. Called by the frontend when the user clicks "New Chat".

### Request

**Path parameter:**

| Parameter | Type | Notes |
|---|---|---|
| `session_id` | string | The UUID of the session to clear. |

No request body.

### Response `200 OK`

```json
{
  "cleared": "<session_id>",
  "existed": true
}
```

| Field | Type | Notes |
|---|---|---|
| `cleared` | string | The `session_id` that was targeted. |
| `existed` | boolean | `true` if the session had checkpoint data. `false` if no data was found for that ID (e.g., already cleared or never used). |

### Notes

- This endpoint always returns `200` regardless of whether the session existed.
- After this call, any subsequent `POST /api/chat` with the same `session_id` starts a fresh conversation with no memory of prior turns.
- The client generates a new `session_id` after calling this endpoint, so the old ID is not reused.

---

## SSE Parsing Reference

The frontend manually parses the SSE byte stream using a `ReadableStream` reader. The parsing logic in `api/chat.ts`:

1. Reads chunks from the response body as `Uint8Array`.
2. Decodes with `TextDecoder` in streaming mode.
3. Splits on `\n` and buffers incomplete lines.
4. For lines beginning with `data: `, strips the prefix and JSON-parses the remainder.
5. If the parsed object has a `text` field, yields it as a token.
6. Non-JSON lines (e.g., `event: done`) and empty `data:` lines are silently ignored.

---

## CORS

The backend allows the following origins:

```
http://localhost:5173
http://127.0.0.1:5173
```

Allowed methods: `GET`, `POST`, `DELETE`, `OPTIONS`
Allowed headers: `*`

Production origins are TBD and must be configured via environment variable before deployment (currently hardcoded in `main.py`).

---

## Known Limitations

| Limitation | Detail |
|---|---|
| No authentication | All endpoints are public. No API key, session token, or login required. |
| No rate limiting | Unlimited requests accepted. Each request may trigger DeepSeek API calls at operator cost. |
| No input size validation | `message` and `session_id` have no enforced length limit. |
| No API versioning | No `/v1/` prefix or `Accept-Version` header. Breaking changes will affect all clients immediately. |
| Error reporting in stream | Agent errors are returned as text tokens, not as HTTP error codes or structured error frames. |
