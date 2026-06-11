# Netlify deploy fix

The app lives in `CascadeProjects/Summer_Goals/`, not the repo root.

**Repo config:** `netlify.toml` at the repo root sets `publish = "CascadeProjects/Summer_Goals"`.

**If deploys still fail**, whoever owns the Netlify site should open
**Site configuration → Build & deploy → Build settings** and clear:

| Setting | Should be |
|---|---|
| Base directory | *(empty)* |
| Package directory | *(empty)* |
| Build command | *(empty)* |
| Publish directory | *(empty)* |

Let the repo `netlify.toml` handle everything. A common failure mode is
Base = `CascadeProjects/Summer_Goals` **and** Publish = `CascadeProjects/Summer_Goals`,
which makes Netlify look for a doubled path that does not exist.

After merging, trigger **Deploys → Trigger deploy → Clear cache and deploy site**.
