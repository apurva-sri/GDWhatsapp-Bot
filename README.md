# DriveBot

## Overview
DriveBot is a full‑stack application that lets users manage their **Google Drive** files through **WhatsApp** messages. Users authenticate via Google OAuth, receive a JWT for session management, and interact with Drive using natural language commands sent over Twilio WhatsApp.

---

## Architecture
```
client (React) <--> server (Node.js/Express) <--> MongoDB & Redis & RabbitMQ
                |                              |
                |                              +-- Google Drive API
                +-- Twilio WhatsApp webhook
                +-- Google OAuth 2.0
```
- **Frontend** – React app built with Vite, provides a simple UI for login and viewing command history.
- **Backend** – Express server handling authentication, WhatsApp webhook, Drive operations and async task processing.
- **MongoDB** – Stores user profiles, file metadata, command logs.
- **Redis** – Session store + rate‑limit counters.
- **RabbitMQ** – Queues long‑running Drive actions (upload, delete, share) to a worker process.
- **JWT** – Issued after Google OAuth, signed with HS256, short‑lived (15 min) and refreshed via secure http‑only cookies.
- **Twilio** – Receives inbound WhatsApp messages and routes them to the server.

---

## Tech Stack
| Layer | Technology |
|-------|------------|
| Frontend | React, Vite, Axios, React‑Router |
| Backend | Node.js, Express, Helmet, Morgan |
| Database | MongoDB (Mongoose) |
| Cache / Sessions | Redis |
| Message Queue | RabbitMQ (amqplib) |
| Auth | Google OAuth 2.0, jsonwebtoken, cookie‑parser |
| Messaging | Twilio WhatsApp API |
| Security | helmet, rate‑limit, HMAC‑signed download URLs |
| Other utils | dotenv, winston (logging), bcryptjs |

---

## Features
- **Google Login** – Secure OAuth flow, user profile sync.
- **JWT authentication** – Stateless, short‑lived tokens stored in http‑only cookies.
- **Drive file management** – List, upload, download, delete, share files directly from WhatsApp.
- **WhatsApp command interface** – Natural‑language commands (`list`, `search`, `upload <file>`, `delete <id>`, `share <id> <phone>`, `info <id>`).
- **Asynchronous processing** – Heavy Drive operations handled by a worker via RabbitMQ.
- **Caching** – Frequently accessed file metadata cached in Redis for fast responses.
- **Rate limiting & abuse protection** – Per‑IP and per‑user limits.
- **Comprehensive error handling** – Centralised error middleware, logging with Winston.
- **Secure download URLs** – HMAC‑SHA256 signed tokens that expire after 5 minutes.

---

## Getting Started
### Prerequisites
- Node.js ≥ 16
- MongoDB instance
- Redis server
- RabbitMQ broker
- Google Cloud project with OAuth client credentials
- Twilio account with a WhatsApp sandbox

### Installation
```bash
# Clone the repo
git clone <repo-url>
cd drivebot
```
#### Backend
```bash
cd server
npm install
cp .env.example .env   # fill in all required variables (see below)
```
#### Frontend
```bash
cd ../client
npm install
```
### Running with Docker Compose (recommended)
```bash
docker-compose up --build
```
The compose file starts MongoDB, Redis, RabbitMQ and the two Node services. The frontend is served on **http://localhost:3000** and the API on **http://localhost:5000**.

---

## Configuration
Create a **server/.env** file based on **server/.env.example** with the following keys:
```
PORT=5000
MONGO_URI=mongodb://mongo:27017/drivebot
REDIS_URL=redis://redis:6379
RABBITMQ_URL=amqp://rabbitmq
JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=15m
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=http://localhost:5000/auth/callback
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_WHATSAPP_NUMBER=whatsapp:+1234567890
HMAC_SECRET=your_hmac_secret_for_signed_urls
```
The **HMAC_SECRET** is used to generate time‑limited signed download URLs.

---

## Usage
1. Open the frontend in a browser and click **Login with Google**.
2. After successful login, you will receive a welcome WhatsApp message.
3. Send commands to the WhatsApp number (e.g., `list`, `upload report.pdf`).
4. The bot replies with file listings, download links, or status updates.

---

## WhatsApp Command Cheat Sheet
| Command | Description |
|---------|-------------|
| `list` | List the first 20 files in the user's Drive.
| `search <query>` | Search files by name.
| `upload <file>` | Upload the attached media to Drive.
| `delete <fileId>` | Delete a file by its Drive ID.
| `share <fileId> <whatsapp-number>` | Share a file with another WhatsApp user (generates a signed URL).
| `info <fileId>` | Show metadata for a specific file.
| `help` | Show this cheat sheet.

---

## API Endpoints
| Method | Path | Protected | Description |
|--------|------|-----------|-------------|
| `GET` | `/auth/callback` | No | Google OAuth callback – creates JWT.
| `POST`| `/auth/logout` | Yes| Clears session cookie.
| `GET` | `/drive/files` | Yes| List user files.
| `POST`| `/drive/upload` | Yes| Upload a file (multipart).
| `DELETE`| `/drive/:fileId` | Yes| Delete a file.
| `GET` | `/drive/download/:fileId?token=...` | Yes| Download file via signed URL.
| `POST`| `/whatsapp/webhook` | No| Twilio webhook for inbound messages.
| `POST`| `/whatsapp/send` | Yes| Send a proactive WhatsApp message.
| `GET` | `/user/profile` | Yes| Retrieve user profile.
| `PUT` | `/user/profile` | Yes| Update profile fields.
| `DELETE`| `/user/profile` | Yes| Delete user account.

---

## Security Highlights (from the recent audit)
- **JWT** signed with strong HS256 secret, http‑only cookie, short expiry.
- **HMAC‑signed download URLs** to prevent IDOR.
- **Ownership middleware** validates that the authenticated user owns any accessed resource.
- **Rate limiting** (5 requests/second per IP) and **payload size limits**.
- **Helmet** and **CORS** configured for strict headers.
- **Environment variable validation** at startup to avoid missing secrets.
- **Timing‑safe secret comparisons** using `crypto.timingSafeEqual`.

---

## License
MIT © 2024 DriveBot Contributors
