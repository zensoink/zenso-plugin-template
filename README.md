# Zenso Plugin Template

A starter template for developing Zenso widgets and plugins for e-ink displays.

## Features

- Liquid template rendering with Vite
- Mock data for local development
- GitHub Actions CI/CD for releases

## Project Structure

```
├── src/              # Source code
├── assets/           # Assets (images, thubnail)
├── dev/              # Mock data and pages
├── dist/             # Build output
├── manifest.json     # Plugin configuration
└── vite.config.js    # Build settings
```

## Getting Started

### Prerequisites
```bash
npm install
```

### Development
```bash
npm run dev      # Start dev server with hot reload
npm run preview  # Preview production build
```

### Build
```bash
npm run build   # Create production build in dist/
```

## Configuration

### manifest.json
Configure your plugin's metadata (id, name, description, schema_version, etc.).

### Mock Data
Add or edit mock data in `dev/mock/*.json` to test templates locally.

### Template Variables
Use Liquid syntax (`{{ variable }}`, `{% render %}`) in your templates.

For Liquid template syntax, see the [official Liquid tutorial](https://liquidjs.com/tutorials/intro-to-liquid.html).

## Deployment

Trigger a release by creating a git tag:
```bash
git tag v1.0.0
git push origin v1.0.0
```

## License

MIT
