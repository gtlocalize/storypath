# 🎭 StoryPath

**AI-Powered Choose-Your-Own-Adventure Story Game**

A whimsical, bardic storytelling experience where every choice writes your tale!

## ✨ Features

- **AI-Powered Storytelling**: Claude Sonnet 4.5 generates dynamic, engaging narratives
- **Choose Your Own Adventure**: Click-based choice system (no free text input)
- **Beautiful Scene Illustrations**: Stable Diffusion-generated artwork for every scene
- **Bilingual Support**: Full English and Japanese UI/stories
- **Multiple Genres**: Fantasy, Sci-Fi, Mystery, Adventure, Spooky
- **RAG Memory System**: AI remembers your choices and story context
- **Password Protection**: Secure your personal stories
- **Whimsical Design**: Playful, bardic theme perfect for kids and young adults

## 🎮 How to Play

1. **Visit**: http://vodbase.net:3004 (or http://localhost:3004)
2. **Create a New Story**: Choose genre, difficulty, character details
3. **Read & Choose**: Enjoy the narrative and make choices
4. **Continue Your Adventure**: Stories are saved automatically

## 🏗️ Architecture

### Backend
- **Framework**: Node.js + Express
- **AI**: Anthropic Claude API (Sonnet 4.5)
- **Image Gen**: Local Stable Diffusion WebUI
- **Database**: SQLite (one DB per story)
- **Process Manager**: PM2

### Frontend
- **Pure HTML/CSS/JS** (no frameworks)
- **Responsive Design**: Mobile-first approach
- **Whimsical Aesthetic**: Custom fonts, bouncy animations, storybook styling
- **i18n**: Full English/Japanese translation support

### File Structure
```
/opt/vodbase/storypath/          # Backend
├── server.js                     # Express server
├── ai/
│   ├── StoryEngine.js           # Claude AI integration
│   └── ImageGenerator.js        # Stable Diffusion integration
├── database/
│   ├── StoryDatabase.js         # SQLite wrapper
│   └── schema.sql               # Database schema
└── stories/                     # SQLite DB files (one per story)

/var/www/html/storypath/         # Frontend
├── index.html                   # Splash page
├── wizard.html                  # Story generator
├── game.html                    # Main game interface
├── css/
│   ├── main.css                 # Base styles
│   ├── wizard.css               # Wizard styles
│   └── game.css                 # Game interface styles
├── js/
│   └── i18n.js                  # Translations
└── images/
    └── generated/               # AI-generated scene images
```

## 🚀 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check |
| `/api/stories` | GET | List all stories |
| `/api/story/create` | POST | Create new story |
| `/api/story/:id` | GET | Get story details |
| `/api/story/:id/choice` | POST | Make a choice |
| `/api/story/:id/image/:sceneNumber` | GET | Check image status |
| `/api/story/unlock` | POST | Verify password |
| `/api/story/:id/history` | GET | Get all scenes |

## ⚙️ Configuration

### Environment Variables (`.env`)
```bash
NODE_ENV=production
PORT=3004

# Claude API
ANTHROPIC_API_KEY=your-key-here

# Stable Diffusion
SD_API_URL=http://localhost:7860/sdapi/v1/txt2img
SD_TIMEOUT=15000

# Session secret
SESSION_SECRET=your-secret-key
```

### PM2 Management
```bash
# Start
pm2 start ecosystem.config.js

# Stop
pm2 stop storypath

# Restart
pm2 restart storypath

# Logs
pm2 logs storypath

# Monitor
pm2 monit
```

## 🎨 Design Philosophy

**Theme**: Playful, whimsical bardic storyteller
- Warm storybook color palette (cream, orange, purple)
- Rounded, friendly fonts (Fredoka, Quicksand, Poppins)
- Bouncy, playful animations
- Hand-drawn aesthetic details
- Perfect for ages 10-25

## 🌐 Language Support

Stories can be created in:
- **English**: AI narrates in English
- **Japanese**: AI narrates in Japanese (日本語)

UI language can be toggled independently from story language.

## 📊 Database Schema

### Key Tables
- **stories**: Metadata, protagonist info, password hash
- **story_state**: Current HP, inventory, stats
- **scenes**: Story progression, narrative text
- **choices**: Player options for each scene
- **story_events**: RAG memory system
- **inventory_items**: Items collected
- **relationships**: NPC relationships

## 🎯 Optimization Features

### Stable Diffusion Speed Improvements
- Local SD WebUI (5-8s vs 30s cloud API)
- Async generation (non-blocking)
- 512x512 resolution for faster generation
- DPM++ 2M sampler with 20 steps
- 15-second timeout
- Placeholder images while generating

### RAG Memory System
- Stores important story events
- Retrieves relevant memories for AI context
- Tracks characters, items, locations
- Importance weighting (1-10)
- Prevents context overflow

## 🔒 Security

- **Password Protection**: bcrypt hashing for story passwords
- **Session Tokens**: localStorage-based session management
- **API Keys**: Environment variables (not in source code)
- **CORS**: Enabled for cross-origin requests

## 📝 Development

### Install Dependencies
```bash
cd /opt/vodbase/storypath
npm install
```

### Run Dev Server
```bash
npm run dev  # Uses nodemon for auto-reload
```

### Run Production
```bash
npm start
# or
pm2 start ecosystem.config.js
```

## 🐛 Troubleshooting

### Stories not loading
- Check PM2 status: `pm2 status`
- Check logs: `pm2 logs storypath`
- Verify port 3004 is not in use

### Images not generating
- Ensure Stable Diffusion WebUI is running on port 7860
- Check SD logs for errors
- Verify `SD_API_URL` in `.env`

### Database errors
- Check permissions on `/opt/vodbase/storypath/stories/`
- Verify SQLite3 is installed

## 🎉 Credits

- **AI**: Anthropic Claude Sonnet 4.5
- **Image Generation**: Stable Diffusion
- **Fonts**: Fredoka, Quicksand, Poppins, M PLUS Rounded 1c
- **Design**: Whimsical bardic storybook aesthetic

## 📜 License

MIT

---

**Enjoy your adventure! 📖✨**
