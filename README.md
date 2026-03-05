# DriveBot

A full-stack application that allows users to manage their Google Drive files via WhatsApp messages.

## Project Structure

### Frontend (React)

- **client/src/components/** - Reusable React components
- **client/src/pages/** - Page components (Login, Onboarding)
- **client/src/services/** - API integration with Axios

### Backend (Node.js + Express)

- **server/config/** - Configuration files for MongoDB, Redis, RabbitMQ, and Google OAuth
- **server/controllers/** - Route handlers
- **server/middlewares/** - Express middleware (auth, validation, error handling)
- **server/models/** - MongoDB schemas
- **server/queues/** - RabbitMQ producer and consumer
- **server/routes/** - API routes
- **server/services/** - Business logic
- **server/utils/** - Helper utilities

## Getting Started

### Prerequisites

- Node.js 16+
- MongoDB
- Redis
- RabbitMQ
- Google OAuth credentials
- Twilio account

### Installation

1. Clone the repository
2. Install dependencies:

```bash
# Backend
cd server
npm install

# Frontend
cd ../client
npm install
```

3. Set up environment variables:

```bash
# Copy .env.example to .env and fill in the values
cp server/.env.example server/.env
```

4. Start the services using Docker Compose:

```bash
docker-compose up
```

5. Start the server:

```bash
cd server
npm start
```

6. Start the client:

```bash
cd client
npm run dev
```

## API Endpoints

### Auth Routes

- `GET /auth/callback` - Google OAuth callback
- `POST /auth/logout` - User logout

### Drive Routes

- `GET /drive/files` - List user's files
- `POST /drive/upload` - Upload file
- `DELETE /drive/:fileId` - Delete file
- `GET /drive/download/:fileId` - Download file

### User Routes

- `GET /user/profile` - Get user profile
- `PUT /user/profile` - Update user profile
- `DELETE /user/profile` - Delete user account

### WhatsApp Routes

- `POST /whatsapp/webhook` - Twilio webhook for incoming messages
- `POST /whatsapp/send` - Send WhatsApp message

## Features

- Google Login integration
- Drive file management
- WhatsApp command interface
- Redis caching and sessions
- RabbitMQ for async tasks
- JWT authentication
- Rate limiting
- Error handling

## License

MIT
