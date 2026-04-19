# Orchestration Service

**Version:** 1.0.0  
**Port:** 3002 (default)  
**Language:** Node.js + Express

## Overview

The Orchestration Service is the main API backend for ParcelPoint. It coordinates shipment management, secure access links, OTP verification, and integrates with notification services.

## Features

- ✅ **Consignment Management**: Create and track shipments
- ✅ **Access Links**: Generate secure, time-limited shipment access tokens
- ✅ **OTP Verification**: Two-factor authentication for shipment access
- ✅ **Shipment Arrival Notifications**: Automated email/SMS alerts
- ✅ **Item Management**: Track individual items within shipments
- ✅ **Rate Limiting**: IP-based request throttling
- ✅ **Security**: JWT validation, token expiration, account lockouts
- ✅ **Monitoring**: Prometheus metrics, structured logging

---

## Quick Start

### Installation

```bash
cd services/orchestration-service
npm install
```

### Environment Setup

```bash
cp .env.example .env
# Edit .env with your configuration
```

**Required Environment Variables:**

```env
PORT=3002
NODE_ENV=development
LOG_LEVEL=info

# Database (Supabase/PostgreSQL)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=parcelpoint
DB_USER=postgres
DB_PASSWORD=your_password

# JWT Keys
JWT_PRIVATE_KEY_BASE64=your_private_key
JWT_PUBLIC_KEY_BASE64=your_public_key

# Service URLs
NOTIFICATION_SERVICE_URL=http://localhost:3003

# Rate Limiting
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX=100

# CORS
CORS_ORIGIN=*
```

### Run Development Server

```bash
npm run dev
```

### Run Production Server

```bash
npm start
```

### Run Tests

```bash
npm test
```

---

## API Endpoints

### Health & Status

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/health` | GET | No | Service health check |
| `/metrics` | GET | No | Prometheus metrics |
| `/api-docs` | GET | No | Swagger UI documentation |

### Consignments

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/consignments` | POST | Bearer | Create new shipment |
| `/api/consignments/:id` | GET | Bearer | Get shipment details |
| `/api/consignments/:id` | PATCH | Bearer | Update shipment status |
| `/api/consignments/:id/arrival` | PATCH | Bearer | Trigger arrival notification |

### Access Links

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/access-links` | POST | Bearer | Generate secure access link |
| `/api/access-links/validate` | GET | No | Validate access token |

### OTP (One-Time Password)

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/otp/request` | POST | Bearer | Request OTP code |
| `/api/otp/verify` | POST | Bearer | Verify OTP code |

**📖 OTP Documentation:**
- [OTP_API_REFERENCE.md](OTP_API_REFERENCE.md) - Complete OTP documentation
- [ParcelPoint_OTP_API.postman_collection.json](ParcelPoint_OTP_API.postman_collection.json) - Postman tests

### Items

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/items` | POST | Bearer | Add item to shipment |
| `/api/items/:id` | GET | Bearer | Get item details |

---

## Authentication

All API endpoints (except `/health`, `/metrics`, `/api-docs`) require authentication.

### Client Credentials Flow (Service-to-Service)

```bash
curl -X POST http://localhost:3001/auth/authenticate \
  -H "Content-Type: application/json" \
  -d '{
    "grantType": "client_credentials",
    "clientId": "parcelpoint-web",
    "clientSecret": "your_secret"
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJSUzI1NiIs...",
    "tokenType": "Bearer",
    "expiresIn": 7200
  }
}
```

### Access Link Flow (User Access)

```bash
# 1. Create access link (authenticated)
curl -X POST http://localhost:3002/api/access-links \
  -H "Authorization: Bearer SERVICE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"shipmentId": "CON-001"}'

# Response includes accessToken
# 2. Use accessToken for OTP endpoints
curl -X POST http://localhost:3002/api/otp/request \
  -H "Authorization: Bearer ACCESS_LINK_TOKEN" \
  -d '{"shipmentId": "CON-001", "channel": "EMAIL"}'
```

---

## Project Structure

```
orchestration-service/
├── src/
│   ├── server.js                    # Main application entry
│   ├── controllers/
│   │   ├── consignmentsController.js
│   │   ├── otpController.js         # OTP request/verify handlers
│   │   ├── accessLinksController.js
│   │   └── ...
│   ├── routes/
│   │   ├── consignments.js
│   │   ├── otp.js                   # OTP routes with Swagger docs
│   │   ├── accessLinks.js
│   │   └── ...
│   ├── services/
│   │   ├── otpService.js            # OTP business logic
│   │   ├── notificationService.js   # Email/SMS integration
│   │   └── externalApiService.js
│   ├── middleware/
│   │   └── authMiddleware.js
│   └── utils/
├── config/
│   └── database.js                  # Database connection
├── migrations/
│   └── *.sql                        # Database migrations
├── tests/
│   └── *.test.js
├── .env
├── .env.example
├── package.json
├── OTP_API_REFERENCE.md             # Complete OTP docs
├── ParcelPoint_OTP_API.postman_collection.json
└── README.md                        # This file
```

---

## Database Schema

### Consignments Table

```sql
CREATE TABLE consignments (
  consignment_id VARCHAR(50) PRIMARY KEY,
  receiver_contact_name VARCHAR(255) NOT NULL,
  receiver_email VARCHAR(255),
  receiver_mobile_number VARCHAR(20),
  status VARCHAR(50) DEFAULT 'created',
  expected_delivery_date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Access Links Table

```sql
CREATE TABLE access_links (
  link_id VARCHAR(255) PRIMARY KEY,
  shipment_id VARCHAR(50) NOT NULL,
  access_token TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (shipment_id) REFERENCES consignments(consignment_id)
);
```

### OTP Codes Table

```sql
CREATE TABLE otp_codes (
  id SERIAL PRIMARY KEY,
  shipment_id VARCHAR(50) NOT NULL,
  access_token VARCHAR(255) NOT NULL,
  otp_code VARCHAR(6) NOT NULL,
  channel VARCHAR(10) NOT NULL,
  destination VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### OTP Attempts Table

```sql
CREATE TABLE otp_attempts (
  id SERIAL PRIMARY KEY,
  shipment_id VARCHAR(50) NOT NULL,
  access_token VARCHAR(255) NOT NULL,
  ip_address VARCHAR(45) NOT NULL,
  user_agent TEXT,
  action VARCHAR(20) NOT NULL,
  result VARCHAR(20) NOT NULL,
  error TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Link Locks Table

```sql
CREATE TABLE link_locks (
  id SERIAL PRIMARY KEY,
  shipment_id VARCHAR(50) NOT NULL,
  access_token VARCHAR(255) NOT NULL,
  locked_until TIMESTAMP NOT NULL,
  reason VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (shipment_id, access_token)
);
```

---

## Security Features

### Rate Limiting

- **Default**: 100 requests per 15 minutes per IP
- **OTP Endpoints**: 5 requests per 10 minutes per IP
- Configurable via `RATE_LIMIT_WINDOW` and `RATE_LIMIT_MAX`

### OTP Security

- **Validity**: 2 minutes
- **Max Attempts**: 5 (then 60-minute lockout)
- **Warning**: Email sent after 3 failed attempts
- **IP Tracking**: All attempts logged
- **Token Validation**: Access link validated before OTP generation

### JWT Validation

- RSA256 signature verification
- Expiration checking
- Issuer validation

### CORS

- Configurable origins
- Credentials support
- Pre-flight handling

---

## Monitoring

### Prometheus Metrics

Access metrics at: `http://localhost:3002/metrics`

**Available Metrics:**
- HTTP request duration
- Request count by endpoint
- Response status codes
- Process metrics (CPU, memory)

### Structured Logging

All logs use Pino logger with JSON format:

```json
{
  "level": 30,
  "time": 1708255920000,
  "msg": "OTP requested successfully",
  "shipmentId": "CON-001",
  "channel": "EMAIL",
  "ipAddress": "192.168.1.1"
}
```

**Log Levels:**
- `trace` (10): Very detailed
- `debug` (20): Debug information
- `info` (30): General information
- `warn` (40): Warning messages
- `error` (50): Error messages
- `fatal` (60): Fatal errors

---

## Testing

### Unit Tests

```bash
npm test
```

### Integration Tests

```bash
npm run test:integration
```

### Test Coverage

```bash
npm run test:coverage
```

### Manual Testing

1. **Swagger UI**: http://localhost:3002/api-docs
2. **Postman**: Import `ParcelPoint_OTP_API.postman_collection.json`
3. **cURL**: See examples in API documentation

---

## Development

### Code Style

- ESLint configuration
- Prettier formatting
- Pre-commit hooks (if configured)

### Environment-specific Behavior

**Development (`NODE_ENV=development`)**:
- Pretty-printed logs
- Detailed error messages
- Stack traces included

**Production (`NODE_ENV=production`)**:
- JSON logs
- Generic error messages
- Stack traces hidden

---

## Deployment

### Docker

```bash
docker build -t orchestration-service .
docker run -p 3002:3002 --env-file .env orchestration-service
```

### Docker Compose

```bash
cd docker
docker-compose up orchestration-service
```

### Kubernetes

```bash
kubectl apply -f infrastructure/k8s/orchestration-service/
```

---

## Troubleshooting

### Common Issues

#### "Database connection failed"
- Check `DB_*` environment variables
- Verify database is running
- Check network connectivity

#### "JWT verification failed"
- Ensure `JWT_PUBLIC_KEY_BASE64` is correct
- Check token hasn't expired
- Verify token issuer

#### "OTP send failed"
- Check notification service is running
- Verify `NOTIFICATION_SERVICE_URL`
- Check notification service logs

#### "Rate limit exceeded"
- Wait for rate limit window to reset
- Check if IP is correct
- Consider adjusting `RATE_LIMIT_MAX`

### Debug Mode

Enable debug logging:

```bash
LOG_LEVEL=debug npm start
```

---

## Dependencies

**Main Dependencies:**
- `express` - Web framework
- `joi` - Request validation
- `pino` - Logging
- `pg` - PostgreSQL client
- `jsonwebtoken` - JWT handling
- `axios` - HTTP client
- `express-rate-limit` - Rate limiting
- `helmet` - Security headers
- `cors` - CORS handling

**Dev Dependencies:**
- `jest` - Testing framework
- `supertest` - API testing
- `eslint` - Linting
- `nodemon` - Development server

---

## Documentation

- [OTP_API_REFERENCE.md](OTP_API_REFERENCE.md) - Complete OTP API documentation
- [../../API_DOCUMENTATION.md](../../API_DOCUMENTATION.md) - Full API reference
- [../../OTP_OPENAPI.json](../../OTP_OPENAPI.json) - OpenAPI specification
- [../../OTP_DOCUMENTATION_INDEX.md](../../OTP_DOCUMENTATION_INDEX.md) - OTP docs index

---

## Support

- **Issues**: [GitHub Issues](https://github.com/parcelpoint/api/issues)
- **Email**: dev-support@parcelpoint.com
- **Slack**: #orchestration-service

---

## License

Proprietary - ParcelPoint © 2026

---

**Last Updated**: February 2026  
**Maintained By**: Backend Team
