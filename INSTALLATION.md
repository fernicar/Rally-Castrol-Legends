# Installation Guide - Rally Castrol Legends

## Quick Start

```bash
# Use pnpm (recommended)
pnpm install
pnpm run dev

# Or if you must use npm
npm install
# If you encounter errors, see "Troubleshooting" below
```

## Prerequisites

- Node.js v18 or higher (tested with Node.js v22.14.0)
- pnpm 10.19.0+ (recommended) or npm 8+
- Windows, macOS, or Linux

## Recommended Package Manager: pnpm

This project is configured to use **pnpm** as specified in the `packageManager` field of `package.json`. Using pnpm is strongly recommended because:

1. **Better optional dependency handling** - pnpm correctly installs platform-specific optional dependencies
2. **Faster installs** - More efficient dependency resolution and disk usage
3. **Stricter dependency management** - Prevents phantom dependencies

### Installing pnpm

```bash
npm install -g pnpm
```

## Installation Issues & Solutions

During the initial setup of this project, we encountered two critical issues. This section documents these problems and their solutions.

---

### Issue 1: NPM Optional Dependencies Bug (Rollup on Windows)

#### Error Message
```
Error: Cannot find module @rollup/rollup-win32-x64-msvc. 
npm has a bug related to optional dependencies 
(https://github.com/npm/cli/issues/4828). 
Please try `npm i` again after removing both package-lock.json 
and node_modules directory.
```

#### What Happened
- npm failed to install `@rollup/rollup-win32-x64-msvc`, a platform-specific binary required by Rollup (used by Vite)
- This is an **optional dependency** that provides native optimizations for Windows x64 systems
- The error occurred even after following the suggested remediation (removing package-lock.json and node_modules)

#### Root Cause
- **Known npm bug**: npm has a longstanding issue with optional dependencies ([npm/cli#4828](https://github.com/npm/cli/issues/4828))
- The bug particularly affects Windows users
- When installing packages with platform-specific optional dependencies, npm may:
  - Skip the installation entirely
  - Install to the wrong location
  - Fail to resolve the dependency correctly

#### Why Rollup Needs This Package
- Vite uses Rollup as its bundler
- Rollup uses native bindings for performance
- Without the platform-specific binary, Rollup cannot start
- The package `@rollup/rollup-win32-x64-msvc` provides optimized native code for Windows

#### Solutions (in order of preference)

**Solution 1: Use pnpm (Recommended)**
```bash
# Remove existing npm artifacts
rm -rf node_modules package-lock.json

# Install with pnpm
pnpm install
```

**Why this works**: pnpm has a completely different dependency resolution algorithm that handles optional dependencies correctly.

**Solution 2: Manual Installation with npm**
```bash
# Install the missing optional dependency manually
npm install @rollup/rollup-win32-x64-msvc --save-optional

# Then run your dev server
npm run dev
```

**Solution 3: Use yarn**
```bash
# Remove existing npm artifacts
rm -rf node_modules package-lock.json

# Install with yarn
yarn install
```

Yarn also handles optional dependencies more reliably than npm.

#### Prevention
1. **Use the project's specified package manager** - Check the `packageManager` field in package.json
2. **Don't mix package managers** - Stick to one package manager per project
3. **Keep package managers updated** - Newer versions may have bug fixes
4. **Check npm version** - Use npm 9+ if you must use npm (though the bug persists)

---

### Issue 2: Tailwind CSS v4 PostCSS Configuration

#### Error Message
```
[postcss] It looks like you're trying to use `tailwindcss` directly 
as a PostCSS plugin. The PostCSS plugin has moved to a separate package, 
so to continue using Tailwind CSS with PostCSS you'll need to install 
`@tailwindcss/postcss` and update your PostCSS configuration.
```

#### What Happened
- After successfully starting the Vite dev server, PostCSS failed to process CSS files
- The error occurred when Vite tried to compile Tailwind CSS

#### Root Cause
- **Tailwind CSS v4 Breaking Change**: Tailwind CSS v4 is a major version with significant architectural changes
- In v3, the PostCSS plugin was part of the main `tailwindcss` package
- In v4, the PostCSS plugin was **extracted into a separate package**: `@tailwindcss/postcss`
- The old configuration syntax no longer works

#### Old Configuration (v3 - Does NOT work with v4)
```javascript
// postcss.config.js
export default {
  plugins: {
    tailwindcss: {},  // ❌ This doesn't work in v4
    autoprefixer: {},
  },
}
```

#### New Configuration (v4 - Required)
```javascript
// postcss.config.js
export default {
  plugins: {
    '@tailwindcss/postcss': {},  // ✅ Use the new package
    autoprefixer: {},
  },
}
```

#### Solution Steps

1. **Install the new PostCSS plugin**:
```bash
pnpm add -D @tailwindcss/postcss
# or
npm install -D @tailwindcss/postcss
```

2. **Update postcss.config.js**:
```javascript
export default {
  plugins: {
    '@tailwindcss/postcss': {},
    autoprefixer: {},
  },
}
```

3. **Restart the dev server** - The changes should hot-reload automatically, but if not:
```bash
# Stop the server (Ctrl+C) and restart
pnpm run dev
```

#### Why This Happened
- The project was set up with Tailwind CSS v4 (`tailwindcss@4.1.18`) in package.json
- However, it was using the old v3 PostCSS configuration
- This mismatch caused the PostCSS processing to fail

#### Prevention
1. **Check migration guides** - Always read the migration documentation when upgrading major versions
2. **Update all related packages** - When updating Tailwind, ensure all Tailwind-related packages are updated
3. **Test after upgrades** - Run the dev server immediately after dependency updates
4. **Review breaking changes** - Major version bumps (v3 → v4) usually have breaking changes

---

## Current Working Configuration

### package.json (critical dependencies)
```json
{
  "devDependencies": {
    "@tailwindcss/postcss": "^4.1.18",  // ✅ Required for Tailwind v4
    "tailwindcss": "^4.1.18",
    "vite": "^6.2.0"
  },
  "optionalDependencies": {
    "@rollup/rollup-win32-x64-msvc": "^4.53.3"  // ✅ Explicitly added for Windows
  },
  "packageManager": "pnpm@10.19.0+sha512..."  // ✅ Specifies pnpm
}
```

### postcss.config.js
```javascript
export default {
  plugins: {
    '@tailwindcss/postcss': {},  // ✅ Tailwind v4 plugin
    autoprefixer: {},
  },
}
```

---

## Troubleshooting Guide

### General npm Install Failures

1. **Clear all caches and artifacts**:
```bash
# Remove node_modules and lock files
rm -rf node_modules package-lock.json pnpm-lock.yaml yarn.lock

# Clear npm cache
npm cache clean --force

# Reinstall
pnpm install
```

2. **Check Node.js version**:
```bash
node --version  # Should be v18 or higher
```

3. **Check for conflicting global packages**:
```bash
npm list -g --depth=0
```

### Dev Server Won't Start

1. **Check for port conflicts**:
```bash
# Default Vite port is 5173, but it auto-increments if busy
# Check what's running on your ports
netstat -ano | findstr :5173  # Windows
lsof -i :5173                  # macOS/Linux
```

2. **Clear Vite cache**:
```bash
rm -rf node_modules/.vite
```

3. **Check for TypeScript errors**:
```bash
pnpm run build  # Will show compilation errors
```

### PostCSS Errors

1. **Verify PostCSS config syntax**:
```bash
node -e "console.log(require('./postcss.config.js'))"
```

2. **Check installed PostCSS plugins**:
```bash
pnpm list @tailwindcss/postcss autoprefixer
```

3. **Ensure Tailwind content paths are correct** in `tailwind.config.js`:
```javascript
export default {
  content: [
    "./index.html",
    "./**/*.{js,ts,jsx,tsx}",  // Scans all JS/TS/JSX/TSX files
  ],
  // ...
}
```

---

## Best Practices

1. **Use the specified package manager** - This project uses pnpm (see `packageManager` in package.json)
2. **Don't commit lock files from other package managers** - Only commit the lock file for your chosen package manager
3. **Keep dependencies updated** - Regularly update dependencies, but test thoroughly
4. **Read migration guides** - Always check migration docs for major version updates
5. **Test after dependency changes** - Run the dev server and build after updating dependencies
6. **Document issues** - If you encounter new installation issues, update this document

---

## Platform-Specific Notes

### Windows
- **Use pnpm** - npm has known issues with optional dependencies on Windows
- **PowerShell vs CMD** - Both work, but PowerShell is recommended
- **Long paths** - Enable long path support if you encounter path length errors:
  ```powershell
  # Run as Administrator
  New-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem" -Name "LongPathsEnabled" -Value 1 -PropertyType DWORD -Force
  ```

### macOS/Linux
- Generally fewer issues with npm optional dependencies
- May need to install build tools for native dependencies:
  ```bash
  # macOS
  xcode-select --install
  
  # Ubuntu/Debian
  sudo apt-get install build-essential
  ```

---

## Common Error Reference

| Error | Cause | Solution |
|-------|-------|----------|
| `Cannot find module @rollup/rollup-win32-x64-msvc` | npm optional dependencies bug | Use pnpm or manually install the package |
| `PostCSS plugin has moved to a separate package` | Tailwind v4 breaking change | Install `@tailwindcss/postcss` and update config |
| `Port already in use` | Another process using the port | Kill the process or Vite will auto-increment port |
| `Cannot find module 'vite'` | Dependencies not installed | Run `pnpm install` |
| `ESM syntax error` | Wrong Node.js version | Use Node.js v18+ |

---

## Getting Help

If you encounter issues not covered in this guide:

1. Check the project's GitHub Issues
2. Review Vite documentation: https://vitejs.dev
3. Review Tailwind CSS v4 documentation: https://tailwindcss.com
4. Check pnpm troubleshooting: https://pnpm.io/faq

---

## Summary

This project successfully runs with:
- **Package Manager**: pnpm 10.19.0+
- **Node.js**: v22.14.0
- **Vite**: v6.2.0
- **React**: v19.2.3
- **Tailwind CSS**: v4.1.18 with `@tailwindcss/postcss`
- **Platform**: Windows (with `@rollup/rollup-win32-x64-msvc` optional dependency)

The key lessons learned:
1. Use pnpm for projects with platform-specific optional dependencies
2. Always install the required PostCSS plugin for Tailwind CSS v4
3. Follow the package manager specified in package.json
4. Read migration guides for major version upgrades
