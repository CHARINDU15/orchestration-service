# OTP API Reference

**Version:** 1.0.0  
**Service:** Orchestration Service  
**Base URL:** `http://localhost:3002` (Development) | `https://api.parcelpoint.com` (Production)

## Overview

The OTP (One-Time Password) API provides secure two-factor authentication for shipment access. When a receiver clicks on a shipment access link, they must verify their identity using a 6-digit OTP code sent to their registered email or phone number.

### Key Features

- ✅ **6-digit OTP codes** valid for 2 minutes
- ✅ **Multi-channel delivery**: EMAIL or SMS
- ✅ **Auto-fetch recipient details** from database
- ✅ **Rate limiting**: 5 requests per 10 minutes per IP
- ✅ **Security lockout**: Account locked for 60 minutes after 5 failed attempts
- ✅ **Progressive warnings**: Email alerts after 3 failed attempts
- ✅ **IP tracking**: All attempts logged with IP address and user agent
- ✅ **Token validation**: Access link token validated before OTP generation

---

## Authentication

Both OTP endpoints require an access link token in the `Authorization` header:

```http
Authorization: Bearer <access_link_token>
```

The access link token is obtained from the `/api/access-links` endpoint when a shipment access link is created.

---

## Endpoints

### 1. Request OTP

**Endpoint:** `POST /api/otp/request`

Generates and sends a 6-digit OTP code to the receiver.

#### Request Headers

```http
Authorization: Bearer tok_eyJhbGciOiJIUzI1NiIs...
Content-Type: application/json
```

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `shipmentId` | string | Yes | Unique consignment identifier (3-50 chars) |
| `channel` | string | No | Delivery channel: "EMAIL" or "SMS". Default: "EMAIL" |
| `destination` | string | No | Override email/phone. If omitted, fetched from database |

#### Example Request (Auto-fetch from DB)

```bash
curl -X POST http://localhost:3002/api/otp/request \
  -H "Authorization: Bearer tok_eyJhbGciOiJIUzI1NiIs..." \
  -H "Content-Type: application/json" \
  -d '{
    "shipmentId": "CON-20260208-001",
    "channel": "EMAIL"
  }'
```

#### Example Request (Custom Destination)

```bash
curl -X POST http://localhost:3002/api/otp/request \
  -H "Authorization: Bearer tok_eyJhbGciOiJIUzI1NiIs..." \
  -H "Content-Type: application/json" \
  -d '{
    "shipmentId": "CON-20260208-001",
    "channel": "EMAIL",
    "destination": "custom@example.com"
  }'
```

#### Success Response (200 OK)

```json
{
  "success": true,
  "data": {
    "requestId": "otp_req_1708255920_abc123",
    "expiresAt": "2026-02-08T10:32:00Z",
    "channel": "EMAIL"
  },
  "message": "OTP sent via EMAIL. Valid for 2 minutes."
}
```

#### Error Responses

| Status | Code | Description |
|--------|------|-------------|
| 400 | `VALIDATION_ERROR` | Invalid request parameters |
| 400 | `MISSING_DESTINATION` | No email/phone found in database |
| 400 | `SHIPMENT_MISMATCH` | Token shipmentId doesn't match request |
| 401 | `MISSING_TOKEN` | Missing Authorization header |
| 401 | `TOKEN_INVALID` | Invalid or expired access link token |
| 403 | `LINK_LOCKED` | Link locked due to 5 failed verification attempts |
| 404 | `NOT_FOUND` | Consignment not found |
| 429 | `RATE_LIMITED` | Rate limit exceeded (5 req/10min per IP) |
| 500 | `OTP_SEND_FAILED` | Failed to send OTP |

#### Validation Rules

- `shipmentId`: 3-50 characters
- `channel`: Must be "EMAIL" or "SMS" (case-sensitive)
- `destination`: Valid email or phone format (when provided)

---

### 2. Verify OTP

**Endpoint:** `POST /api/otp/verify`

Validates the 6-digit OTP code and grants access to shipment details.

#### Request Headers

```http
Authorization: Bearer tok_eyJhbGciOiJIUzI1NiIs...
Content-Type: application/json
```

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `shipmentId` | string | Yes | Unique consignment identifier (3-50 chars) |
| `otp` | string | Yes | 6-digit numeric OTP code |

#### Example Request

```bash
curl -X POST http://localhost:3002/api/otp/verify \
  -H "Authorization: Bearer tok_eyJhbGciOiJIUzI1NiIs..." \
  -H "Content-Type: application/json" \
  -d '{
    "shipmentId": "CON-20260208-001",
    "otp": "123456"
  }'
```

#### Success Response (200 OK)

```json
{
  "success": true,
  "data": {
    "shipmentId": "CON-20260208-001",
    "verified": true,
    "accessToken": "access_xyz789abc..."
  },
  "message": "OTP verified successfully"
}
```

**Note:** Use the returned `accessToken` to access shipment details.

#### Error Responses

| Status | Code | Description | Attempts Remaining |
|--------|------|-------------|-------------------|
| 400 | `VALIDATION_ERROR` | Invalid OTP format | - |
| 401 | `MISSING_TOKEN` | Missing Authorization header | - |
| 401 | `TOKEN_INVALID` | Invalid access link token | - |
| 401 | `INVALID_OTP` | Wrong OTP code | Yes (shown in response) |
| 401 | `OTP_EXPIRED` | OTP expired (>2 minutes) | - |
| 403 | `LINK_LOCKED` | Account locked (5 failed attempts) | 0 |

#### Failed Verification Response

```json
{
  "success": false,
  "error": "Invalid OTP",
  "code": "INVALID_OTP",
  "attemptsRemaining": 3
}
```

#### Locked Account Response

```json
{
  "success": false,
  "error": "Link locked due to excessive failed attempts",
  "code": "LINK_LOCKED",
  "lockExpiresAt": "2026-02-08T14:30:00Z"
}
```

#### Validation Rules

- `shipmentId`: 3-50 characters
- `otp`: Exactly 6 digits (e.g., "123456")

---

## Security Features

### Rate Limiting

- **5 requests per 10 minutes per IP address**
- Applies to both `/request` and `/verify` endpoints
- Returns HTTP 429 when exceeded
- Response includes `retryAfter` field (seconds)

### Account Lockout

| Failed Attempts | Action |
|----------------|--------|
| 1-2 | Normal operation, attempts remaining shown |
| 3 | ⚠️ Warning email sent to receiver |
| 5 | 🔒 Account locked for 60 minutes, alert email sent |

### IP & User Agent Tracking

All OTP requests and verifications are logged with:
- IP address
- User agent
- Timestamp
- Action result (success/failure)
- Error codes

### Token Security

- Access link tokens validated before OTP generation
- Token must match shipmentId in request
- Expired tokens rejected
- Token must be obtained from `/api/access-links` endpoint

---

## Flow Diagram

```
┌─────────────────┐
│ User Clicks     │
│ Access Link     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ POST /otp/      │
│ request         │
│ (with token)    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Validate Token  │
│ & Rate Limit    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Fetch Email/    │
│ Phone from DB   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Generate 6-     │
│ digit OTP       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Send via        │
│ EMAIL/SMS       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ User Receives   │
│ OTP Code        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ POST /otp/      │
│ verify          │
│ (with OTP)      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Validate OTP    │
│ & Check Lock    │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
  VALID    INVALID
    │         │
    │         ▼
    │   ┌─────────────┐
    │   │ Increment   │
    │   │ Failed      │
    │   │ Attempts    │
    │   └──────┬──────┘
    │          │
    │      ┌───┴───┐
    │      │       │
    │      ▼       ▼
    │   >=3      >=5
    │   WARN    LOCK
    │      │       │
    ▼      ▼       ▼
┌──────────────────┐
│ Grant Access     │
│ Return Token     │
└──────────────────┘
```

---

## Example Workflows

### Scenario 1: Successful Verification

```bash
# Step 1: Request OTP
curl -X POST http://localhost:3002/api/otp/request \
  -H "Authorization: Bearer tok_abc..." \
  -H "Content-Type: application/json" \
  -d '{"shipmentId": "CON-001", "channel": "EMAIL"}'

# Response:
# {
#   "success": true,
#   "data": {
#     "requestId": "otp_req_123",
#     "expiresAt": "2026-02-08T10:32:00Z",
#     "channel": "EMAIL"
#   },
#   "message": "OTP sent via EMAIL. Valid for 2 minutes."
# }

# Step 2: User receives email with OTP: 123456

# Step 3: Verify OTP
curl -X POST http://localhost:3002/api/otp/verify \
  -H "Authorization: Bearer tok_abc..." \
  -H "Content-Type: application/json" \
  -d '{"shipmentId": "CON-001", "otp": "123456"}'

# Response:
# {
#   "success": true,
#   "data": {
#     "shipmentId": "CON-001",
#     "verified": true,
#     "accessToken": "access_xyz..."
#   },
#   "message": "OTP verified successfully"
# }
```

### Scenario 2: Failed Attempts with Lockout

```bash
# Attempt 1-2: Wrong OTP
curl -X POST http://localhost:3002/api/otp/verify \
  -H "Authorization: Bearer tok_abc..." \
  -d '{"shipmentId": "CON-001", "otp": "999999"}'
# Response: {"success": false, "attemptsRemaining": 4}

# Attempt 3: Wrong OTP (Warning email sent)
curl -X POST http://localhost:3002/api/otp/verify \
  -H "Authorization: Bearer tok_abc..." \
  -d '{"shipmentId": "CON-001", "otp": "888888"}'
# Response: {"success": false, "attemptsRemaining": 2}
# ⚠️ Warning email sent to receiver

# Attempts 4-5: Wrong OTP (Account locked)
curl -X POST http://localhost:3002/api/otp/verify \
  -H "Authorization: Bearer tok_abc..." \
  -d '{"shipmentId": "CON-001", "otp": "777777"}'
# Response: 
# {
#   "success": false,
#   "error": "Link locked due to excessive failed attempts",
#   "code": "LINK_LOCKED",
#   "lockExpiresAt": "2026-02-08T14:30:00Z"
# }
# 🔒 Account locked for 60 minutes
# Alert email sent to receiver
```

### Scenario 3: Rate Limiting

```bash
# Request OTP 6 times within 10 minutes
for i in {1..6}; do
  curl -X POST http://localhost:3002/api/otp/request \
    -H "Authorization: Bearer tok_abc..." \
    -d '{"shipmentId": "CON-001"}'
done

# 6th request response:
# {
#   "success": false,
#   "error": "Too many requests. Please try again later.",
#   "code": "RATE_LIMITED",
#   "retryAfter": 300
# }
```

---

## Database Schema

### OTP Storage

```sql
CREATE TABLE otp_codes (
  id SERIAL PRIMARY KEY,
  shipment_id VARCHAR(50) NOT NULL,
  access_token VARCHAR(255) NOT NULL,
  otp_code VARCHAR(6) NOT NULL,
  channel VARCHAR(10) NOT NULL, -- 'EMAIL' or 'SMS'
  destination VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_shipment_token (shipment_id, access_token),
  INDEX idx_expires (expires_at)
);
```

### Attempt Logging

```sql
CREATE TABLE otp_attempts (
  id SERIAL PRIMARY KEY,
  shipment_id VARCHAR(50) NOT NULL,
  access_token VARCHAR(255) NOT NULL,
  ip_address VARCHAR(45) NOT NULL,
  user_agent TEXT,
  action VARCHAR(20) NOT NULL, -- 'OTP_REQUEST', 'OTP_VERIFY'
  result VARCHAR(20) NOT NULL, -- 'SUCCESS', 'TOKEN_INVALID', 'INVALID_OTP', etc.
  error TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_shipment_ip (shipment_id, ip_address),
  INDEX idx_created (created_at)
);
```

### Link Locks

```sql
CREATE TABLE link_locks (
  id SERIAL PRIMARY KEY,
  shipment_id VARCHAR(50) NOT NULL,
  access_token VARCHAR(255) NOT NULL,
  locked_until TIMESTAMP NOT NULL,
  reason VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE (shipment_id, access_token),
  INDEX idx_locked_until (locked_until)
);
```

---

## Testing

### Unit Tests

```bash
cd services/orchestration-service
npm test -- --grep "OTP"
```

### Integration Tests

```bash
# Start service
npm start

# Run tests
npm run test:integration
```

### Manual Testing with Postman

Import the collection: `ParcelPoint_OTP_API.postman_collection.json`

### Test checklist

- [ ] Request OTP with auto-fetch (EMAIL)
- [ ] Request OTP with auto-fetch (SMS)
- [ ] Request OTP with custom destination
- [ ] Verify valid OTP
- [ ] Verify invalid OTP (check attempts remaining)
- [ ] Verify expired OTP (wait >2 minutes)
- [ ] Test rate limiting (6 requests)
- [ ] Test lockout after 5 failed attempts
- [ ] Test with invalid token
- [ ] Test with missing Authorization header
- [ ] Test with non-existent shipmentId

---

## Monitoring & Alerts

### Metrics to Track

- OTP request rate
- OTP verification success rate
- Failed attempt rate
- Account lockout frequency
- Average OTP delivery time
- Rate limit hits

### Alert Conditions

- Failed OTP verification rate > 30%
- Account lockouts > 5 per hour
- OTP send failures > 5%
- Rate limit hits > 50 per hour

---

## Troubleshooting

### Common Issues

#### "Missing or invalid Authorization header"

**Cause:** Authorization header not provided or malformed  
**Solution:** Ensure header format is `Authorization: Bearer <token>`

#### "No email found for receiver"

**Cause:** Database has no email/phone for receiver and no destination provided  
**Solution:** Either:
- Add email/phone to receiver record in database
- Provide `destination` field in request

#### "Too many requests"

**Cause:** Rate limit exceeded (5 req/10min per IP)  
**Solution:** Wait for the time specified in `retryAfter` field

#### "Link locked"

**Cause:** 5 failed OTP verification attempts  
**Solution:** Wait 60 minutes or contact support

#### "Token validation failed"

**Cause:** Invalid or expired access link token  
**Solution:** Generate new access link token from `/api/access-links`

---

## API Changelog

### Version 1.0.0 (2026-02-08)

- Initial release
- POST /api/otp/request
- POST /api/otp/verify
- Auto-fetch recipient details from database
- Rate limiting (5 req/10min per IP)
- Account lockout after 5 failed attempts
- Progressive warnings (email at 3 failures)
- IP and user agent tracking

---

## Related Documentation

- [API_DOCUMENTATION.md](../../API_DOCUMENTATION.md) - Complete API reference
- [OTP_OPENAPI.json](../../OTP_OPENAPI.json) - OpenAPI 3.0 specification
- [OTP_COMPLETE_GUIDE.md](../../OTP_COMPLETE_GUIDE.md) - Implementation guide
- [NOTIFICATION_SERVICE_SETUP.md](../../NOTIFICATION_SERVICE_SETUP.md) - Email/SMS setup

---

## Support

For issues or questions:
- GitHub Issues: https://github.com/parcelpoint/api/issues
- Email: api-support@parcelpoint.com
- Slack: #api-support
