# 🌙 MealMuse

## Running locally

1. Copy `.env.example` to `.env` and add your Anthropic API key
2. Run `npm install`
3. Run `npm run dev`
4. Open http://localhost:5173

## Deploying to Vercel

1. Push this folder to GitHub:
   ```
   git init
   git add .
   git commit -m "Initial deploy"
   ```
   Then create a repo on github.com and push to it.

2. Go to vercel.com/new and import your GitHub repo

3. Add environment variable in Vercel dashboard:
   - Settings → Environment Variables
   - Name: ANTHROPIC_API_KEY
   - Value: your sk-ant-api03-... key

4. Redeploy — your app is live!

## Making changes later

After any change:
```
git add .
git commit -m "describe your change"
git push
```
Vercel auto-deploys within 60 seconds.
