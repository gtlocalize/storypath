# StoryPath Backend Deployment

## Location
This backend should be deployed to `/opt/vodbase/storypath/`

## Prerequisites
- Node.js v18+
- SQLite3
- Anthropic API key

## Installation

```bash
cd /opt/vodbase/storypath
npm install
```

## Configuration

Create `.env` file:
```
ANTHROPIC_API_KEY=your_key_here
```

## Running

```bash
# Development
node server.js

# Production (with PM2 or similar)
pm2 start server.js --name storypath-server
```

## Frontend Integration

The frontend is located at `/var/www/html/storypath/` and communicates with this backend via:
- API endpoint: `http://localhost:3004/api/`
- SSE for streaming story generation

## After Deployment

1. Pull backend changes: `cd /opt/vodbase/storypath && git pull`
2. Install dependencies: `npm install`
3. Restart server: `pkill -9 -f "node.*storypath.*server.js" && node server.js &`
