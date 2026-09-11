# 11 Shaft Complex — Tunisi Digital Twin

Asset & breakdown register for the Tunisi mine's 11 Shaft Complex. Built with React + Vite.

## What's in this project

```
tunisi-app/
├── index.html          # HTML entry point
├── package.json         # dependencies + scripts
├── vite.config.js       # build tool config
├── .env.example         # copy to .env and fill in your Supabase credentials
├── .gitignore
├── README.md
├── supabase/
│   └── schema.sql        # run once in Supabase to create the shared table
└── src/
    ├── main.jsx          # React entry point
    ├── App.jsx           # the whole app (tabs, dashboard, log, report form)
    ├── storage.js         # shared/live (Supabase) storage, auto-falls back to localStorage
    └── index.css          # base page styles
```

## 1. Prerequisites

Install these once, if you don't already have them:

- **Node.js** (v18 or later) — https://nodejs.org (this also installs `npm`)
- **Git** — https://git-scm.com/downloads
- **VS Code** — https://code.visualstudio.com
- A **GitHub** account — https://github.com

Check they're installed by opening a terminal and running:

```bash
node -v
npm -v
git -v
```

## 2. Run it locally in VS Code

1. Unzip this project folder somewhere on your computer.
2. Open VS Code, then **File → Open Folder…** and select the `tunisi-app` folder.
3. Open the built-in terminal: **Terminal → New Terminal**.
4. Install dependencies:
   ```bash
   npm install
   ```
5. Start the dev server:
   ```bash
   npm run dev
   ```
6. Vite will print a local URL (usually `http://localhost:5173`). Open it in your browser — the app should look exactly like the recording.

Edits you make to files in `src/` hot-reload automatically while `npm run dev` is running.

## 3. Push it to GitHub

From inside the `tunisi-app` folder (same terminal):

```bash
# Turn the folder into a git repo
git init
git add .
git commit -m "Initial commit — Tunisi 11 Shaft Complex register"

# Create the GitHub repo (pick ONE of the two options below)
```

**Option A — using the GitHub CLI** (`gh`, install from https://cli.github.com):
```bash
gh repo create tunisi-11shaft-register --public --source=. --remote=origin --push
```

**Option B — manually on github.com:**
1. Go to https://github.com/new, name it (e.g. `tunisi-11shaft-register`), don't initialize with a README (you already have one), click **Create repository**.
2. GitHub will show you commands like these — run them in your terminal:
   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/tunisi-11shaft-register.git
   git branch -M main
   git push -u origin main
   ```

After that, any time you make changes:
```bash
git add .
git commit -m "Describe what changed"
git push
```

You can also do all of the above through VS Code's built-in **Source Control** tab (the icon with branching lines in the left sidebar) instead of typing git commands — stage, commit, and push with clicks.

## 4. Deploying it so others can open a link (optional)

The quickest options, both free for a project like this:

- **Vercel** — https://vercel.com → "Add New Project" → import your GitHub repo → it auto-detects Vite and deploys.
- **Netlify** — https://netlify.com → "Add new site" → "Import an existing project" → pick the repo → build command `npm run build`, publish directory `dist`.

Either will give you a live URL and redeploy automatically every time you `git push`.

## 5. Wiring up real shared/live data with Supabase

By default (no setup) the app runs in **local-only mode**: data saves to your browser's `localStorage`, so it's not shared with anyone else. The header badge will say **"Local only"** in amber.

To get a genuinely shared, live log — a report submitted on one phone appears on everyone else's screen within a second or two, no reload — connect a free Supabase project. `src/storage.js` auto-detects Supabase credentials and switches modes with zero code changes; you're just filling in config.

### Step by step

1. **Create a project** at https://supabase.com (free tier is plenty for this). Give it any name and a database password (you won't need the password day-to-day).
2. **Create the table.** In your project's dashboard: **SQL Editor → New query**, paste in the contents of `supabase/schema.sql` from this repo, and click **Run**. This creates the `kv_store` table, sets up permissive access policies (see the comments in that file for what that means), and turns on realtime for the table.
3. **Grab your API credentials.** In the dashboard: **Settings → API**. Copy:
   - **Project URL**
   - **anon public** key (not the `service_role` key — never put that one in frontend code)
4. **Create your `.env` file.** In the project root:
   ```bash
   cp .env.example .env
   ```
   Then open `.env` and paste in your Project URL and anon key.
5. **Restart the dev server** (`Ctrl+C` then `npm run dev` again — Vite only reads `.env` on startup). Reload the page in your browser. The header badge should now say **"Live — shared"** in green.
6. **Test it:** open the app in two browser tabs (or your phone + laptop), submit a report in the Report tab on one, and watch it appear in the Breakdown Log on the other without refreshing.

### Deploying with Supabase

When you deploy to Vercel/Netlify (see section 4), add the same two variables — `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` — in that platform's **Environment Variables** settings, using the same values from your `.env`. Don't commit `.env` itself to GitHub; it's already listed in `.gitignore`.

### A note on access control

The SQL policies in `supabase/schema.sql` allow anyone holding your app's anon key (i.e. anyone who can load the deployed site) to read and write the data — there's no login. That's fine for an internal tool shared via a private link with a shift team, which is what this app is. If you later need to restrict who can submit reports, add Supabase Auth and tighten the policies in `schema.sql` to require an authenticated user.

## 6. Seed data

On first load, if there's no saved data yet, the app generates a realistic starting dataset (equipment, categories, working places, operators/artisans) using a fixed random seed, so it looks the same every time you clear storage and reload. You can adjust the equipment counts and category/detail phrase lists near the top of `App.jsx` (`generateSeed()`) to change what the seed data looks like.
