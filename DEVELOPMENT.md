# Zenso Plugin Template Maintenance & Release Guide

This document describes how to maintain, test, and release `zenso-plugin-template`.

---

## 1. Local Verification & Quality Checks

Before cutting a release or publishing updates:

```bash
# Install dependencies
npm ci

# Validate TypeScript & bundling
npm run build

# Verify build outputs
ls -la dist/
ls -la plugin.zip
```

Verify that:
1. `dist/manifest.json` matches the canonical schema at `https://schemas.zenso.ink/v1/plugin-manifest.schema.json`.
2. `dist/index.liquid` contains clean asset URLs.
3. `plugin.zip` contains all runtime assets, `manifest.json`, `README.md`, and `LICENSE`.

---

## 2. Release & Packaging Pipeline

Releases are automated via GitHub Actions (`.github/workflows/release.yml`).

### Step-by-Step Release Process

1. **Update Version**:
   Increment the version in `package.json`:
   ```bash
   npm version minor # or patch / major
   ```

2. **Commit and Tag**:
   ```bash
   git add package.json package-lock.json
   git commit -m "chore(release): vX.Y.Z"
   git tag vX.Y.Z
   git push origin master --tags
   ```

3. **CI Pipeline Automation**:
   Pushing a tag `v*` triggers the automated release workflow:
   - Sets up Node.js environment and executes `npm ci`.
   - Runs `npm run build` to package `plugin.zip`.
   - Generates SHA256 checksum: `sha256sum plugin.zip > plugin.zip.sha256`.
   - Signs the archive with **Sigstore Cosign** using keyless GitHub OIDC identity.
   - Publishes a new GitHub Release containing:
     - `plugin.zip` (packaged plugin bundle)
     - `plugin.zip.sha256` (checksum file)
     - `plugin.zip.bundle` (Sigstore verification bundle)

---

## 3. Verifying Signed Release Artifacts

To verify the cryptographic integrity and origin of downloaded release artifacts:

```bash
cosign verify-blob \
  --bundle plugin.zip.bundle \
  --certificate-identity-regexp "https://github.com/zensoink/zenso-plugin-template/\.github/workflows/.*" \
  --certificate-oidc-issuer "https://token.actions.githubusercontent.com" \
  plugin.zip
```

---

## 4. Upstream Sync for Derivative Plugins

When plugins created from this template need updates from newer template versions:
1. Update `@zenso/vite-plugin` in `package.json` to the latest version.
2. Review updates to `vite.config.ts` and `tsconfig.json`.
3. Check `GUIDE.md` for any new schema capabilities or conventions.
