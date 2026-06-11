# Netlify deploy fix

Netlify builds run `scripts/prepare-netlify.sh`, which copies the app into `dist/`
and publishes that folder. This works whether Netlify runs from the repo root
or from a UI base directory of `CascadeProjects/Summer_Goals`.

**Before pushing deploy changes, run locally:**

```bash
bash scripts/verify-netlify.sh
```

**If Netlify still fails**, the site owner should clear all four fields under
**Site configuration → Build & deploy → Build settings** (base, package,
build command, publish) so the repo `netlify.toml` files take over.

Then: **Deploys → Trigger deploy → Clear cache and deploy site**.
