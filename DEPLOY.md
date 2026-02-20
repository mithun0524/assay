# Deploy to Vercel (Free)

## Prerequisites
- Free Vercel account: vercel.com
- Free OpenRouter account + API key: openrouter.ai/keys
  - In OpenRouter Settings > Privacy, enable "Allow model training" (required for :free models)

## Deploy

### Option A — One-click via GitHub (recommended)
1. Push this repo to GitHub
2. Go to vercel.com/new and import your repo
3. Add environment variable: OPENROUTER_API_KEY = your key
4. Add environment variable: NEXT_PUBLIC_APP_URL = https://your-project.vercel.app
5. Deploy — takes ~2 minutes

### Option B — Vercel CLI
```bash
vercel --prod
```

## Notes
- vercel.json already includes the required COOP/COEP headers for WebContainers
- Free Vercel hobby plan is sufficient — no paid plan needed
- OpenRouter :free models have no cost — ideal for a portfolio project
- All code execution happens in the user's browser (WebContainer) — zero server compute cost
- The app works on Chrome and Edge (Firefox may need extra config)

## Cost Summary
| Service | Cost |
|---|---|
| Vercel hosting | Free (hobby plan) |
| OpenRouter API | Free (:free models) |
| WebContainer execution | Free (runs in browser) |
| **Total** | **$0/month** |