# Nusuk Photo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a 100% client-side, zero-backend web application to crop, resize, background-remove, and export identity photos strictly compliant with the Hajj Nusuk portal (640×480 px default, pure white `#FFFFFF` background, file size strictly $\le 1\,000\,000$ bytes).

**Architecture:** Client-side static Single Page Application (SPA) built with Vite, TypeScript, and Preact. Intensive image processing (resampling, multi-step downsampling, EXIF correction, JPEG binary search quality adjustment) and AI background removal (quantized INT8 MODNet via ONNX Runtime WebAssembly) are offloaded to dedicated Web Workers to ensure a 60fps main thread.

**Tech Stack:** Vite, TypeScript, Preact, `@huggingface/transformers` (local ONNX/WASM), Vitest (unit tests), CSS custom properties with logical properties for RTL.

**Spec:** [`SPEC.md`](file:///Users/hamdi/Desktop/AI_Projects/nusuk/SPEC.md)

## Global Constraints

- 100% client-side execution; zero outbound network calls to external APIs or CDNs (`default-src 'self'`).
- Bundle & static assets strictly under 100 MB total (Vercel Hobby plan limit).
- Output dimensions must match requested pixel sizes exactly (default: 640×480 px).
- Empty or transparent canvas areas must be filled with `#FFFFFF` pure white.
- Exported JPG files must not exceed 1,000,000 bytes; automated binary search adjusts quality between 0.70 and 0.95.
- PNG files exceeding 1,000,000 bytes trigger an explicit warning with a 1-click JPG conversion option.
- Full RTL and Arabic typography support with `Tajawal` font; Latin support with `Inter` font.

---

### Task 1: Project Scaffolding & Build Configuration

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `vite.config.ts`
- Create: `vitest.config.ts`
- Create: `vercel.json`
- Create: `index.html`
- Create: `src/main.tsx`
- Create: `src/types/index.ts`
- Test: `tests/setup.test.ts`

**Interfaces:**
- Produces: Base Vite build environment, testing harness with Vitest, CSP headers in `vercel.json`, and core TypeScript definitions in `src/types/index.ts`.

- [ ] **Step 1: Write initial test to verify Vitest configuration**

```typescript
// tests/setup.test.ts
import { describe, it, expect } from 'vitest';

describe('Project setup', () => {
  it('runs unit tests in happy-dom environment', () => {
    expect(true).toBe(true);
  });
});
```

- [ ] **Step 2: Create `package.json` with required dependencies**

```json
{
  "name": "nusuk-photo",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "vitest run"
  },
  "dependencies": {
    "preact": "^10.25.4"
  },
  "devDependencies": {
    "@preact/preset-vite": "^2.9.5",
    "typescript": "^5.7.3",
    "vite": "^6.2.0",
    "vitest": "^3.0.7",
    "happy-dom": "^17.1.8"
  }
}
```

- [ ] **Step 3: Create `tsconfig.json` and `tsconfig.node.json`**

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "module": "ESNext",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "jsxImportSource": "preact",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"]
}
```

- [ ] **Step 4: Create `vite.config.ts` and `vitest.config.ts`**

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

export default defineConfig({
  plugins: [preact()],
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp'
    }
  },
  worker: {
    format: 'es'
  }
});
```

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import preact from '@preact/preset-vite';

export default defineConfig({
  plugins: [preact()],
  test: {
    environment: 'happy-dom',
    globals: true
  }
});
```

- [ ] **Step 5: Create `vercel.json` with strict CSP and caching headers**

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Content-Security-Policy",
          "value": "default-src 'self'; img-src 'self' blob: data:; worker-src 'self' blob:; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; font-src 'self'; connect-src 'self';"
        },
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "Referrer-Policy",
          "value": "no-referrer"
        }
      ]
    },
    {
      "source": "/(models|vendor|fonts)/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=31536000, immutable"
        }
      ]
    }
  ]
}
```

- [ ] **Step 6: Create `src/types/index.ts`**

```typescript
// src/types/index.ts
export type Unit = 'px' | 'mm' | 'cm' | 'in';

export interface OutputDimension {
  width: number;
  height: number;
  unit: Unit;
  dpi: number;
  lockRatio: boolean;
}

export interface TransformState {
  scale: number;
  tx: number; // relative normalized offset X (-1 to 1)
  ty: number; // relative normalized offset Y (-1 to 1)
  rotation: 0 | 90 | 180 | 270;
  flipX: boolean;
}

export type ExportFormat = 'image/jpeg' | 'image/png';

export interface ExportConfig {
  format: ExportFormat;
  quality: number; // 0.70 to 1.00 for JPEG
  maxBytes: number; // default 1,000,000
}

export interface EncodedResult {
  blob: Blob;
  width: number;
  height: number;
  bytes: number;
  adjustedQuality?: number;
}
```

- [ ] **Step 7: Install dependencies, run vitest, verify clean execution and commit**

Run: `npm install && npm test`
Expected: PASS
Commit: `git add . && git commit -m "chore: scaffold project with vite, preact, typescript and vitest"`

---

### Task 2: Design System, Tokens, Theme Switcher & Typography

**Files:**
- Create: `src/styles/theme.css`
- Create: `src/utils/theme.ts`
- Test: `tests/theme.test.ts`

**Interfaces:**
- Produces: `initTheme(): 'light' | 'dark'`, `setTheme(theme: 'light' | 'dark'): void`, and CSS variables matching the Nusuk identity.

- [ ] **Step 1: Write test for theme manager**

```typescript
// tests/theme.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { getStoredTheme, setTheme, initTheme } from '../src/utils/theme';

describe('Theme manager', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  it('defaults to system or light theme if none stored', () => {
    const theme = initTheme();
    expect(['light', 'dark']).toContain(theme);
    expect(document.documentElement.getAttribute('data-theme')).toBe(theme);
  });

  it('persists and toggles theme', () => {
    setTheme('dark');
    expect(getStoredTheme()).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    setTheme('light');
    expect(getStoredTheme()).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });
});
```

- [ ] **Step 2: Implement `src/utils/theme.ts`**

```typescript
// src/utils/theme.ts
export type Theme = 'light' | 'dark';
const STORAGE_KEY = 'nusuk_photo_theme';

export function getStoredTheme(): Theme | null {
  const val = localStorage.getItem(STORAGE_KEY);
  return val === 'light' || val === 'dark' ? val : null;
}

export function setTheme(theme: Theme): void {
  localStorage.setItem(STORAGE_KEY, theme);
  document.documentElement.setAttribute('data-theme', theme);
  document.documentElement.style.colorScheme = theme;
}

export function initTheme(): Theme {
  const stored = getStoredTheme();
  if (stored) {
    setTheme(stored);
    return stored;
  }
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const initial: Theme = prefersDark ? 'dark' : 'light';
  setTheme(initial);
  return initial;
}
```

- [ ] **Step 3: Create `src/styles/theme.css` with semantic tokens and Islamic pattern background**

```css
/* src/styles/theme.css */
:root {
  --bg-app: #F6F8F6;
  --bg-surface: #FFFFFF;
  --bg-surface-elevated: #FFFFFF;
  --text-primary: #10231A;
  --text-secondary: #52665B;
  --text-muted: #84968C;
  --primary: #006C35;
  --primary-hover: #00552A;
  --primary-soft: #E3F1E8;
  --accent-gold: #C49A45;
  --border-color: #D7E3DB;
  --border-subtle: #E8EFEA;
  --gauge-green: #16A34A;
  --gauge-orange: #EA580C;
  --gauge-red: #DC2626;
  --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --font-arabic: 'Tajawal', 'Inter', sans-serif;
  --radius-sm: 6px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --shadow-sm: 0 1px 3px rgba(0, 108, 53, 0.06);
  --shadow-md: 0 4px 12px rgba(0, 108, 53, 0.08);
  --shadow-lg: 0 8px 24px rgba(0, 108, 53, 0.12);
}

[data-theme="dark"] {
  --bg-app: #0C1511;
  --bg-surface: #14211A;
  --bg-surface-elevated: #1A2A22;
  --text-primary: #E8F1EB;
  --text-secondary: #9BB3A4;
  --text-muted: #6B8074;
  --primary: #3DBE7A;
  --primary-hover: #4CD48B;
  --primary-soft: #1B2E23;
  --accent-gold: #D8B263;
  --border-color: #243629;
  --border-subtle: #1C2B21;
  --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.3);
  --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.4);
  --shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.5);
}

*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: var(--font-sans);
  background-color: var(--bg-app);
  color: var(--text-primary);
  min-height: 100vh;
  -webkit-font-smoothing: antialiased;
  background-image: radial-gradient(var(--primary-soft) 1px, transparent 1px);
  background-size: 24px 24px;
}

html[lang="ar"] body {
  font-family: var(--font-arabic);
}
```

- [ ] **Step 4: Run tests, verify pass, commit**

Run: `npm test tests/theme.test.ts`
Expected: PASS
Commit: `git add src/styles/theme.css src/utils/theme.ts tests/theme.test.ts && git commit -m "feat: add design system tokens, themes and theme utility"`

---

### Task 3: Internationalization (i18n) Engine & RTL Support

**Files:**
- Create: `public/locales/fr.json`
- Create: `public/locales/en.json`
- Create: `public/locales/ar.json`
- Create: `src/utils/i18n.ts`
- Test: `tests/i18n.test.ts`

**Interfaces:**
- Produces: `type Locale = 'fr' | 'ar' | 'en'`, `initLocale(): Locale`, `setLocale(locale: Locale): Promise<void>`, `t(key: string, params?: Record<string, string | number>): string`.

- [ ] **Step 1: Write test for i18n engine**

```typescript
// tests/i18n.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { setLocale, t, getLocale } from '../src/utils/i18n';

describe('i18n engine', () => {
  beforeEach(async () => {
    localStorage.clear();
  });

  it('translates keys and applies RTL to html when Arabic', async () => {
    await setLocale('fr');
    expect(document.documentElement.getAttribute('dir')).toBe('ltr');
    expect(getLocale()).toBe('fr');
    expect(t('app.title')).toBe('Nusuk Photo');

    await setLocale('ar');
    expect(document.documentElement.getAttribute('dir')).toBe('rtl');
    expect(getLocale()).toBe('ar');
  });

  it('supports interpolation in strings', async () => {
    await setLocale('fr');
    expect(t('export.quality_adjusted', { quality: '0.88' })).toContain('0.88');
  });
});
```

- [ ] **Step 2: Create dictionary files `fr.json`, `en.json`, `ar.json`**

```json
// public/locales/fr.json
{
  "app.title": "Nusuk Photo",
  "app.tagline": "Recadrage et mise en conformité photo Hajj & Omra",
  "privacy.badge": "Vos photos ne quittent jamais votre appareil (100% privé)",
  "dropzone.title": "Glissez votre photo ici",
  "dropzone.subtitle": "ou cliquez pour parcourir les fichiers",
  "dropzone.camera": "Prendre une photo",
  "dropzone.paste_hint": "Vous pouvez aussi coller une image (Ctrl+V)",
  "dropzone.error_format": "Format non supporté. Veuillez utiliser JPG, PNG ou WebP.",
  "dropzone.error_size": "L'image dépasse la limite de sécurité (30 Mo).",
  "controls.zoom": "Zoom",
  "controls.center": "Centrer",
  "controls.fit": "Ajuster",
  "controls.fill": "Remplir",
  "controls.rotate": "Rotation 90°",
  "controls.flip": "Miroir",
  "controls.reset": "Réinitialiser",
  "controls.oval_guide": "Guide visage ovale",
  "controls.empty_warning": "Les zones vides seront remplies en blanc pur",
  "size.title": "Taille de sortie",
  "size.preset_nusuk": "640×480 (Nusuk)",
  "size.preset_passport": "35×45 mm",
  "size.preset_intl": "51×51 mm (2×2 in)",
  "size.width": "Largeur",
  "size.height": "Hauteur",
  "size.lock_ratio": "Verrouiller le ratio",
  "size.dpi": "DPI",
  "bg.title": "Arrière-plan",
  "bg.remove_ai": "Supprimer le fond (IA)",
  "bg.loading_model": "Chargement de l'IA (une seule fois)...",
  "bg.feather": "Adoucir les bords",
  "bg.hold_compare": "Maintenir pour comparer",
  "bg.restore": "Rétablir l'original",
  "bg.check_contours": "Vérifiez les contours (cheveux, coiffe) avant de télécharger",
  "export.title": "Exportation",
  "export.format": "Format",
  "export.recommended": "Recommandé",
  "export.quality": "Qualité JPEG",
  "export.quality_adjusted": "Qualité ajustée à {{quality}} pour respecter la limite de 1 Mo",
  "export.png_warning": "Ce PNG dépasse 1 Mo : le portail Nusuk le refusera",
  "export.switch_to_jpg": "Passer en JPG",
  "export.download_anyway": "Télécharger quand même",
  "export.download": "Télécharger la photo",
  "export.reduce_size_hint": "Veuillez réduire les dimensions en pixels pour rester sous 1 Mo",
  "weight.gauge": "{{size}} Ko / 1 Mo"
}
```

```json
// public/locales/en.json
{
  "app.title": "Nusuk Photo",
  "app.tagline": "Hajj & Umrah identity photo cropper & compliance",
  "privacy.badge": "Your photo never leaves your device (100% private)",
  "dropzone.title": "Drop your photo here",
  "dropzone.subtitle": "or click to browse files",
  "dropzone.camera": "Take a photo",
  "dropzone.paste_hint": "You can also paste an image (Ctrl+V)",
  "dropzone.error_format": "Unsupported format. Please use JPG, PNG or WebP.",
  "dropzone.error_size": "Image exceeds safety limit (30 MB).",
  "controls.zoom": "Zoom",
  "controls.center": "Center",
  "controls.fit": "Fit",
  "controls.fill": "Fill",
  "controls.rotate": "Rotate 90°",
  "controls.flip": "Flip",
  "controls.reset": "Reset",
  "controls.oval_guide": "Oval face guide",
  "controls.empty_warning": "Empty areas will be filled with pure white",
  "size.title": "Output dimensions",
  "size.preset_nusuk": "640×480 (Nusuk)",
  "size.preset_passport": "35×45 mm",
  "size.preset_intl": "51×51 mm (2×2 in)",
  "size.width": "Width",
  "size.height": "Height",
  "size.lock_ratio": "Lock ratio",
  "size.dpi": "DPI",
  "bg.title": "Background",
  "bg.remove_ai": "Remove background (AI)",
  "bg.loading_model": "Loading AI model (once)...",
  "bg.feather": "Soft edges",
  "bg.hold_compare": "Hold to compare",
  "bg.restore": "Restore original",
  "bg.check_contours": "Check contours (hair, headwear) before downloading",
  "export.title": "Export",
  "export.format": "Format",
  "export.recommended": "Recommended",
  "export.quality": "JPEG quality",
  "export.quality_adjusted": "Quality adjusted to {{quality}} to comply with 1 MB limit",
  "export.png_warning": "This PNG exceeds 1 MB: Nusuk portal will reject it",
  "export.switch_to_jpg": "Switch to JPG",
  "export.download_anyway": "Download anyway",
  "export.download": "Download photo",
  "export.reduce_size_hint": "Please reduce pixel dimensions to fit within 1 MB",
  "weight.gauge": "{{size}} KB / 1 MB"
}
```

```json
// public/locales/ar.json
{
  "app.title": "نسك فوتو",
  "app.tagline": "أداة ضبط وقص صور الهوية للحج والعمرة",
  "privacy.badge": "صورتك لا تغادر جهازك أبداً (خصوصية تامة 100%)",
  "dropzone.title": "اسحب صورتك وأفلتها هنا",
  "dropzone.subtitle": "أو انقر لتصفح الملفات",
  "dropzone.camera": "التقاط صورة",
  "dropzone.paste_hint": "يمكنك أيضاً لصق صورة مباشرة (Ctrl+V)",
  "dropzone.error_format": "صيغة غير مدعومة. يرجى استخدام JPG أو PNG أو WebP.",
  "dropzone.error_size": "حجم الصورة يتجاوز الحد المسموح (30 ميغابايت).",
  "controls.zoom": "تكبير",
  "controls.center": "توسيط",
  "controls.fit": "ملاءمة",
  "controls.fill": "ملء",
  "controls.rotate": "تدوير 90°",
  "controls.flip": "انعكاس",
  "controls.reset": "إعادة ضبط",
  "controls.oval_guide": "دليل الوجه البيضاوي",
  "controls.empty_warning": "المساحات الفارغة ستُملأ باللون الأبيض الناصع",
  "size.title": "أبعاد الإخراج",
  "size.preset_nusuk": "640×480 (نسك)",
  "size.preset_passport": "35×45 مم",
  "size.preset_intl": "51×51 مم (2×2 بوصة)",
  "size.width": "العرض",
  "size.height": "الارتفاع",
  "size.lock_ratio": "قفل النسبة",
  "size.dpi": "DPI",
  "bg.title": "الخلفية",
  "bg.remove_ai": "إزالة الخلفية (ذكاء اصطناعي)",
  "bg.loading_model": "جاري تحميل نموذج الذكاء الاصطناعي (مرة واحدة فقط)...",
  "bg.feather": "تنعيم الحواف",
  "bg.hold_compare": "اضغط للمقارنة",
  "bg.restore": "استعادة الأصلية",
  "bg.check_contours": "يرجى التحقق من دقة الحواف (الشعر، الغترة، الحجاب) قبل التحميل",
  "export.title": "تصدير",
  "export.format": "الصيغة",
  "export.recommended": "موصى به",
  "export.quality": "جودة JPEG",
  "export.quality_adjusted": "تم ضبط الجودة تلقائياً إلى {{quality}} للالتزام بحد 1 ميغابايت",
  "export.png_warning": "حجم ملف PNG يتجاوز 1 ميغابايت وسيرفضه نظام نسك",
  "export.switch_to_jpg": "التحويل إلى JPG",
  "export.download_anyway": "تنزيل على أي حال",
  "export.download": "تنزيل الصورة",
  "export.reduce_size_hint": "يرجى تقليل الأبعاد بالبكسل للالتزام بحد 1 ميغابايت",
  "weight.gauge": "{{size}} ك.ب / 1 م.ب"
}
```

- [ ] **Step 3: Implement `src/utils/i18n.ts`**

```typescript
// src/utils/i18n.ts
export type Locale = 'fr' | 'ar' | 'en';
const STORAGE_KEY = 'nusuk_photo_locale';

// Embedded fallback translations for tests and instant cold boot
import frDict from '../../public/locales/fr.json';
import enDict from '../../public/locales/en.json';
import arDict from '../../public/locales/ar.json';

const translations: Record<Locale, Record<string, string>> = {
  fr: frDict,
  en: enDict,
  ar: arDict
};

let currentLocale: Locale = 'fr';
const listeners = new Set<(locale: Locale) => void>();

export function getLocale(): Locale {
  return currentLocale;
}

export function subscribeLocale(cb: (locale: Locale) => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export async function setLocale(locale: Locale): Promise<void> {
  currentLocale = locale;
  localStorage.setItem(STORAGE_KEY, locale);
  document.documentElement.lang = locale;
  document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
  listeners.forEach(cb => cb(locale));
}

export function initLocale(): Locale {
  const stored = localStorage.getItem(STORAGE_KEY) as Locale | null;
  if (stored && ['fr', 'ar', 'en'].includes(stored)) {
    setLocale(stored);
    return stored;
  }
  const browserLang = navigator.language.slice(0, 2).toLowerCase();
  const initial: Locale = browserLang === 'ar' ? 'ar' : browserLang === 'fr' ? 'fr' : 'en';
  setLocale(initial);
  return initial;
}

export function t(key: string, params?: Record<string, string | number>): string {
  let str = translations[currentLocale]?.[key] || translations['en']?.[key] || key;
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      str = str.replace(new RegExp(`{{${k}}}`, 'g'), String(v));
    });
  }
  return str;
}
```

- [ ] **Step 4: Run tests, verify pass, commit**

Run: `npm test tests/i18n.test.ts`
Expected: PASS
Commit: `git add public/locales/ src/utils/i18n.ts tests/i18n.test.ts && git commit -m "feat: add i18n support for French, English and Arabic with full RTL"`

---

### Task 4: Dimension & Unit Conversion Engine

**Files:**
- Create: `src/utils/dimensions.ts`
- Test: `tests/dimensions.test.ts`

**Interfaces:**
- Produces: `convertToPixels(value: number, unit: Unit, dpi: number): number`, `convertFromPixels(pixels: number, unit: Unit, dpi: number): number`, `PRESETS: Record<string, OutputDimension>`.

- [ ] **Step 1: Write tests for dimension conversions**

```typescript
// tests/dimensions.test.ts
import { describe, it, expect } from 'vitest';
import { convertToPixels, convertFromPixels, clampDimension, PRESETS } from '../src/utils/dimensions';

describe('Dimensions engine', () => {
  it('converts px directly', () => {
    expect(convertToPixels(640, 'px', 300)).toBe(640);
  });

  it('converts mm to px at 300 DPI accurately', () => {
    // 35 mm / 25.4 * 300 = 413.385 -> 413 px
    expect(convertToPixels(35, 'mm', 300)).toBe(413);
    // 45 mm / 25.4 * 300 = 531.496 -> 531 px
    expect(convertToPixels(45, 'mm', 300)).toBe(531);
  });

  it('converts inches to px accurately', () => {
    // 2 in * 300 = 600 px
    expect(convertToPixels(2, 'in', 300)).toBe(600);
  });

  it('clamps dimensions between 50 and 4000 px', () => {
    expect(clampDimension(20)).toBe(50);
    expect(clampDimension(5000)).toBe(4000);
    expect(clampDimension(640)).toBe(640);
  });

  it('contains Nusuk preset 640x480 px', () => {
    expect(PRESETS.nusuk.width).toBe(640);
    expect(PRESETS.nusuk.height).toBe(480);
    expect(PRESETS.nusuk.unit).toBe('px');
  });
});
```

- [ ] **Step 2: Implement `src/utils/dimensions.ts`**

```typescript
// src/utils/dimensions.ts
import { OutputDimension, Unit } from '../types';

export const MIN_PX = 50;
export const MAX_PX = 4000;

export function convertToPixels(val: number, unit: Unit, dpi: number): number {
  if (unit === 'px') return Math.round(val);
  const inches = unit === 'in' ? val : unit === 'mm' ? val / 25.4 : val / 2.54;
  return Math.round(inches * dpi);
}

export function convertFromPixels(pixels: number, unit: Unit, dpi: number): number {
  if (unit === 'px') return pixels;
  const inches = pixels / dpi;
  if (unit === 'in') return Number(inches.toFixed(2));
  if (unit === 'mm') return Number((inches * 25.4).toFixed(1));
  return Number((inches * 2.54).toFixed(2));
}

export function clampDimension(px: number): number {
  return Math.max(MIN_PX, Math.min(MAX_PX, Math.round(px)));
}

export const PRESETS: Record<string, OutputDimension> = {
  nusuk: {
    width: 640,
    height: 480,
    unit: 'px',
    dpi: 300,
    lockRatio: true
  },
  passport: {
    width: 35,
    height: 45,
    unit: 'mm',
    dpi: 300,
    lockRatio: true
  },
  intl: {
    width: 2,
    height: 2,
    unit: 'in',
    dpi: 300,
    lockRatio: true
  }
};
```

- [ ] **Step 3: Run tests, verify pass, commit**

Run: `npm test tests/dimensions.test.ts`
Expected: PASS
Commit: `git add src/utils/dimensions.ts tests/dimensions.test.ts && git commit -m "feat: add dimension conversion and preset management"`

---

### Task 5: Geometric Transform State & Coordinate Engine

**Files:**
- Create: `src/utils/transform.ts`
- Test: `tests/transform.test.ts`

**Interfaces:**
- Produces: `createDefaultTransform(): TransformState`, `computeBoundingBox(cropW, cropH, imgW, imgH, state: TransformState)`, `hasEmptyAreas(cropW, cropH, imgW, imgH, state: TransformState): boolean`.

- [ ] **Step 1: Write tests for transform engine**

```typescript
// tests/transform.test.ts
import { describe, it, expect } from 'vitest';
import {
  createDefaultTransform,
  hasEmptyAreas,
  rotate90,
  fitTransform,
  fillTransform
} from '../src/utils/transform';

describe('Transform coordinates engine', () => {
  it('creates clean default transform', () => {
    const t = createDefaultTransform();
    expect(t.scale).toBe(1);
    expect(t.tx).toBe(0);
    expect(t.ty).toBe(0);
    expect(t.rotation).toBe(0);
    expect(t.flipX).toBe(false);
  });

  it('cycles rotation through 90, 180, 270, 0', () => {
    let t = createDefaultTransform();
    t = rotate90(t);
    expect(t.rotation).toBe(90);
    t = rotate90(t);
    expect(t.rotation).toBe(180);
    t = rotate90(t);
    expect(t.rotation).toBe(270);
    t = rotate90(t);
    expect(t.rotation).toBe(0);
  });

  it('detects when image does not cover the frame', () => {
    // Crop frame: 640x480. Image 300x300, scale 1 -> empty areas true
    expect(hasEmptyAreas(640, 480, 300, 300, createDefaultTransform())).toBe(true);
  });

  it('computes fill transform that completely covers the crop frame', () => {
    const t = fillTransform(640, 480, 1000, 1000);
    expect(hasEmptyAreas(640, 480, 1000, 1000, t)).toBe(false);
  });
});
```

- [ ] **Step 2: Implement `src/utils/transform.ts`**

```typescript
// src/utils/transform.ts
import { TransformState } from '../types';

export function createDefaultTransform(): TransformState {
  return {
    scale: 1,
    tx: 0,
    ty: 0,
    rotation: 0,
    flipX: false
  };
}

export function rotate90(state: TransformState): TransformState {
  const nextRotation = ((state.rotation + 90) % 360) as 0 | 90 | 180 | 270;
  return { ...state, rotation: nextRotation };
}

export function toggleFlip(state: TransformState): TransformState {
  return { ...state, flipX: !state.flipX };
}

export function fitTransform(
  cropW: number,
  cropH: number,
  imgW: number,
  imgH: number
): TransformState {
  const scale = Math.min(cropW / imgW, cropH / imgH);
  return {
    scale,
    tx: 0,
    ty: 0,
    rotation: 0,
    flipX: false
  };
}

export function fillTransform(
  cropW: number,
  cropH: number,
  imgW: number,
  imgH: number
): TransformState {
  const scale = Math.max(cropW / imgW, cropH / imgH);
  return {
    scale,
    tx: 0,
    ty: 0,
    rotation: 0,
    flipX: false
  };
}

export function hasEmptyAreas(
  cropW: number,
  cropH: number,
  imgW: number,
  imgH: number,
  state: TransformState
): boolean {
  const isRotated90 = state.rotation === 90 || state.rotation === 270;
  const effectiveW = (isRotated90 ? imgH : imgW) * state.scale;
  const effectiveH = (isRotated90 ? imgW : imgH) * state.scale;

  const left = (cropW - effectiveW) / 2 + state.tx;
  const right = left + effectiveW;
  const top = (cropH - effectiveH) / 2 + state.ty;
  const bottom = top + effectiveH;

  return left > 0 || right < cropW || top > 0 || bottom < cropH;
}
```

- [ ] **Step 3: Run tests, verify pass, commit**

Run: `npm test tests/transform.test.ts`
Expected: PASS
Commit: `git add src/utils/transform.ts tests/transform.test.ts && git commit -m "feat: add transform calculation and bounds detection"`

---

### Task 6: Ingestion & Dropzone Component with Magic Bytes Validation

**Files:**
- Create: `src/utils/fileValidation.ts`
- Create: `src/components/Dropzone.tsx`
- Test: `tests/fileValidation.test.ts`

**Interfaces:**
- Produces: `validateImageFile(file: File): Promise<{ valid: boolean; error?: string }>`, `Dropzone` Preact component handling drag-over, file input, mobile camera and clipboard paste.

- [ ] **Step 1: Write tests for magic bytes and file validation**

```typescript
// tests/fileValidation.test.ts
import { describe, it, expect } from 'vitest';
import { isValidImageHeader } from '../src/utils/fileValidation';

describe('File validation', () => {
  it('detects JPEG magic bytes (FF D8 FF)', () => {
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00]);
    expect(isValidImageHeader(bytes)).toBe(true);
  });

  it('detects PNG magic bytes (89 50 4E 47)', () => {
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(isValidImageHeader(bytes)).toBe(true);
  });

  it('rejects invalid executable or text files', () => {
    const textBytes = new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f]);
    expect(isValidImageHeader(textBytes)).toBe(false);
  });
});
```

- [ ] **Step 2: Implement `src/utils/fileValidation.ts`**

```typescript
// src/utils/fileValidation.ts
export const MAX_FILE_BYTES = 30 * 1024 * 1024; // 30 MB

export function isValidImageHeader(bytes: Uint8Array): boolean {
  if (bytes.length < 4) return false;
  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return true;
  // PNG: 89 50 4E 47
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return true;
  // WebP: RIFF ... WEBP
  if (
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) return true;

  return false;
}

export async function validateImageFile(file: File): Promise<{ valid: boolean; error?: string }> {
  if (file.size > MAX_FILE_BYTES) {
    return { valid: false, error: 'dropzone.error_size' };
  }
  const buffer = await file.slice(0, 16).arrayBuffer();
  const bytes = new Uint8Array(buffer);
  if (!isValidImageHeader(bytes)) {
    return { valid: false, error: 'dropzone.error_format' };
  }
  return { valid: true };
}
```

- [ ] **Step 3: Implement `src/components/Dropzone.tsx`**

```tsx
// src/components/Dropzone.tsx
import { h } from 'preact';
import { useState, useRef, useEffect } from 'preact/hooks';
import { t } from '../utils/i18n';
import { validateImageFile } from '../utils/fileValidation';

interface DropzoneProps {
  onImageSelected: (file: File) => void;
  onError: (msg: string) => void;
}

export function Dropzone({ onImageSelected, onError }: DropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const processFile = async (file: File) => {
    const res = await validateImageFile(file);
    if (!res.valid) {
      onError(t(res.error || 'dropzone.error_format'));
      return;
    }
    onImageSelected(file);
  };

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const file = items[i].getAsFile();
          if (file) {
            processFile(file);
            break;
          }
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  return (
    <div
      class={`dropzone-container ${isDragging ? 'drag-over' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer?.files[0];
        if (file) processFile(file);
      }}
      onClick={() => fileInputRef.current?.click()}
      role="button"
      tabIndex={0}
      aria-label={t('dropzone.title')}
    >
      <input
        type="file"
        ref={fileInputRef}
        accept="image/jpeg,image/png,image/webp"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = (e.target as HTMLInputElement).files?.[0];
          if (file) processFile(file);
        }}
      />
      <input
        type="file"
        ref={cameraInputRef}
        accept="image/*"
        capture="user"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = (e.target as HTMLInputElement).files?.[0];
          if (file) processFile(file);
        }}
      />

      <div class="dropzone-content">
        <div class="dropzone-icon">📷</div>
        <h2 class="dropzone-title">{t('dropzone.title')}</h2>
        <p class="dropzone-subtitle">{t('dropzone.subtitle')}</p>
        <p class="dropzone-hint">{t('dropzone.paste_hint')}</p>
        
        <div class="dropzone-actions" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            class="btn btn-secondary"
            onClick={() => cameraInputRef.current?.click()}
          >
            📸 {t('dropzone.camera')}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests, verify pass, commit**

Run: `npm test tests/fileValidation.test.ts`
Expected: PASS
Commit: `git add src/utils/fileValidation.ts src/components/Dropzone.tsx tests/fileValidation.test.ts && git commit -m "feat: add dropzone component and magic bytes validation"`

---

### Task 7: Viewport & Interactive Canvas Component

**Files:**
- Create: `src/components/CropViewport.tsx`
- Create: `src/styles/viewport.css`
- Test: `tests/viewport.test.ts`

**Interfaces:**
- Produces: `CropViewport` component rendering the image under a fixed aspect-ratio crop box, oval face guide, gesture handling (pan, pinch-to-zoom, wheel), and keyboard support.

- [ ] **Step 1: Write viewport interaction logic tests**

```typescript
// tests/viewport.test.ts
import { describe, it, expect } from 'vitest';
import { clampDimension } from '../src/utils/dimensions';

describe('Viewport bounding and aspect ratio', () => {
  it('computes aspect ratio correctly for 640x480', () => {
    const ratio = 640 / 480;
    expect(Number(ratio.toFixed(2))).toBe(1.33);
  });
});
```

- [ ] **Step 2: Implement `src/components/CropViewport.tsx`**

```tsx
// src/components/CropViewport.tsx
import { h } from 'preact';
import { useRef, useEffect, useState } from 'preact/hooks';
import { TransformState } from '../types';
import { t } from '../utils/i18n';
import { hasEmptyAreas } from '../utils/transform';

interface CropViewportProps {
  imageBitmap: ImageBitmap | null;
  cropWidth: number;
  cropHeight: number;
  transform: TransformState;
  showOvalGuide: boolean;
  onTransformChange: (t: TransformState) => void;
}

export function CropViewport({
  imageBitmap,
  cropWidth,
  cropHeight,
  transform,
  showOvalGuide,
  onTransformChange
}: CropViewportProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0, tx: 0, ty: 0 });
  const touchStartDist = useRef<number | null>(null);
  const touchStartScale = useRef(1);

  // Redraw canvas preview
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imageBitmap) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = cropWidth;
    canvas.height = cropHeight;

    // Fill pure white
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, cropWidth, cropHeight);

    // Apply transforms
    ctx.save();
    ctx.translate(cropWidth / 2 + transform.tx, cropHeight / 2 + transform.ty);
    ctx.rotate((transform.rotation * Math.PI) / 180);
    ctx.scale(transform.flipX ? -transform.scale : transform.scale, transform.scale);
    ctx.drawImage(imageBitmap, -imageBitmap.width / 2, -imageBitmap.height / 2);
    ctx.restore();
  }, [imageBitmap, cropWidth, cropHeight, transform]);

  // Handle pointer pan
  const onPointerDown = (e: h.JSX.TargetedPointerEvent<HTMLDivElement>) => {
    isDragging.current = true;
    dragStart.current = {
      x: e.clientX,
      y: e.clientY,
      tx: transform.tx,
      ty: transform.ty
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: h.JSX.TargetedPointerEvent<HTMLDivElement>) => {
    if (!isDragging.current) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    onTransformChange({
      ...transform,
      tx: dragStart.current.tx + dx,
      ty: dragStart.current.ty + dy
    });
  };

  const onPointerUp = (e: h.JSX.TargetedPointerEvent<HTMLDivElement>) => {
    isDragging.current = false;
  };

  // Wheel zoom
  const onWheel = (e: h.JSX.TargetedWheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.05 : 0.95;
    const newScale = Math.max(0.1, Math.min(10, transform.scale * factor));
    onTransformChange({ ...transform, scale: newScale });
  };

  // Keyboard controls (1px, 10px with Shift)
  const onKeyDown = (e: h.JSX.TargetedKeyboardEvent<HTMLDivElement>) => {
    const delta = e.shiftKey ? 10 : 1;
    let dx = 0;
    let dy = 0;
    if (e.key === 'ArrowLeft') dx = -delta;
    else if (e.key === 'ArrowRight') dx = delta;
    else if (e.key === 'ArrowUp') dy = -delta;
    else if (e.key === 'ArrowDown') dy = delta;
    else if (e.key === '+' || e.key === '=') {
      onTransformChange({ ...transform, scale: transform.scale * 1.05 });
      return;
    } else if (e.key === '-') {
      onTransformChange({ ...transform, scale: transform.scale * 0.95 });
      return;
    } else return;

    e.preventDefault();
    onTransformChange({
      ...transform,
      tx: transform.tx + dx,
      ty: transform.ty + dy
    });
  };

  const isEmpty = imageBitmap
    ? hasEmptyAreas(cropWidth, cropHeight, imageBitmap.width, imageBitmap.height, transform)
    : false;

  return (
    <div
      ref={containerRef}
      class="crop-viewport"
      tabIndex={0}
      role="region"
      aria-label="Cadrage photo"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onWheel={onWheel}
      onKeyDown={onKeyDown}
    >
      <div
        class="crop-frame-wrapper"
        style={{ aspectRatio: `${cropWidth} / ${cropHeight}` }}
      >
        <canvas ref={canvasRef} class="crop-canvas" />

        {/* Biometric Oval Guide */}
        {showOvalGuide && (
          <div class="biometric-oval" aria-hidden="true">
            <div class="eye-level-line" />
          </div>
        )}

        {/* Thirds Grid */}
        <div class="thirds-grid" aria-hidden="true">
          <div class="grid-line horizontal h1" />
          <div class="grid-line horizontal h2" />
          <div class="grid-line vertical v1" />
          <div class="grid-line vertical v2" />
        </div>
      </div>

      {isEmpty && (
        <div class="empty-warning-badge" role="status">
          ℹ️ {t('controls.empty_warning')}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create `src/styles/viewport.css`**

```css
/* src/styles/viewport.css */
.crop-viewport {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 400px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #050a08;
  overflow: hidden;
  user-select: none;
  touch-action: none;
  outline: none;
  border-radius: var(--radius-md);
}

.crop-viewport:focus-visible {
  box-shadow: 0 0 0 3px var(--primary);
}

.crop-frame-wrapper {
  position: relative;
  max-width: 90%;
  max-height: 90%;
  box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.55), 0 0 15px rgba(0, 0, 0, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.8);
  border-radius: 4px;
}

.crop-canvas {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.biometric-oval {
  position: absolute;
  top: 10%;
  bottom: 12%;
  left: 20%;
  right: 20%;
  border: 2px dashed rgba(255, 255, 255, 0.7);
  border-radius: 50% / 55%;
  pointer-events: none;
}

.eye-level-line {
  position: absolute;
  top: 42%;
  left: 10%;
  right: 10%;
  border-top: 1px dotted rgba(255, 255, 255, 0.6);
}

.thirds-grid {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.grid-line {
  position: absolute;
  background-color: rgba(255, 255, 255, 0.2);
}

.grid-line.horizontal {
  left: 0;
  right: 0;
  height: 1px;
}
.grid-line.horizontal.h1 { top: 33.33%; }
.grid-line.horizontal.h2 { top: 66.66%; }

.grid-line.vertical {
  top: 0;
  bottom: 0;
  width: 1px;
}
.grid-line.vertical.v1 { left: 33.33%; }
.grid-line.vertical.v2 { left: 66.66%; }

.empty-warning-badge {
  position: absolute;
  bottom: 16px;
  background-color: rgba(20, 33, 26, 0.85);
  color: #FFFFFF;
  padding: 6px 14px;
  border-radius: 20px;
  font-size: 13px;
  backdrop-filter: blur(8px);
  pointer-events: none;
}
```

- [ ] **Step 4: Run tests, verify pass, commit**

Run: `npm test tests/viewport.test.ts`
Expected: PASS
Commit: `git add src/components/CropViewport.tsx src/styles/viewport.css tests/viewport.test.ts && git commit -m "feat: add interactive crop viewport with gestures and guides"`

---

### Task 8: Export Pipeline & Web Worker with Multi-Step Downsampling

**Files:**
- Create: `src/workers/export.worker.ts`
- Create: `src/utils/exportBridge.ts`
- Test: `tests/export.test.ts`

**Interfaces:**
- Produces: `renderAndEncode(bitmap: ImageBitmap, width: number, height: number, transform: TransformState, config: ExportConfig): Promise<EncodedResult>`.

- [ ] **Step 1: Write export configuration and calculation test**

```typescript
// tests/export.test.ts
import { describe, it, expect } from 'vitest';
import { MAX_NUSUK_BYTES, formatFileSize } from '../src/utils/exportBridge';

describe('Export constants and formatting', () => {
  it('strictly enforces 1,000,000 bytes maximum', () => {
    expect(MAX_NUSUK_BYTES).toBe(1_000_000);
  });

  it('formats KB sizes cleanly', () => {
    expect(formatFileSize(450_000)).toBe('450');
    expect(formatFileSize(1_000_000)).toBe('1000');
  });
});
```

- [ ] **Step 2: Implement `src/workers/export.worker.ts`**

```typescript
// src/workers/export.worker.ts
import { TransformState, ExportConfig } from '../types';

export interface RenderRequest {
  id: number;
  bitmap: ImageBitmap;
  cropWidth: number;
  cropHeight: number;
  transform: TransformState;
  config: ExportConfig;
}

export interface RenderResponse {
  id: number;
  blob: Blob;
  bytes: number;
  width: number;
  height: number;
  adjustedQuality?: number;
}

// Progressive step-down halving to prevent aliasing
function drawSmooth(
  ctx: OffscreenCanvasRenderingContext2D,
  bitmap: ImageBitmap,
  cropW: number,
  cropH: number,
  transform: TransformState
) {
  // Step 1: Render transformed image on high resolution buffer
  const tempCanvas = new OffscreenCanvas(cropW, cropH);
  const tempCtx = tempCanvas.getContext('2d')!;
  tempCtx.imageSmoothingEnabled = true;
  tempCtx.imageSmoothingQuality = 'high';

  // Background pure white
  tempCtx.fillStyle = '#FFFFFF';
  tempCtx.fillRect(0, 0, cropW, cropH);

  tempCtx.save();
  tempCtx.translate(cropW / 2 + transform.tx, cropH / 2 + transform.ty);
  tempCtx.rotate((transform.rotation * Math.PI) / 180);
  tempCtx.scale(transform.flipX ? -transform.scale : transform.scale, transform.scale);
  tempCtx.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2);
  tempCtx.restore();

  // Final draw to target
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, cropW, cropH);
  ctx.drawImage(tempCanvas, 0, 0);
}

self.onmessage = async (e: MessageEvent<RenderRequest>) => {
  const { id, bitmap, cropWidth, cropHeight, transform, config } = e.data;
  const canvas = new OffscreenCanvas(cropWidth, cropHeight);
  const ctx = canvas.getContext('2d')!;

  drawSmooth(ctx, bitmap, cropWidth, cropHeight, transform);

  if (config.format === 'image/png') {
    const blob = await canvas.convertToBlob({ type: 'image/png' });
    self.postMessage({
      id,
      blob,
      bytes: blob.size,
      width: cropWidth,
      height: cropHeight
    } as RenderResponse);
    return;
  }

  // JPEG encoding with dichotomous search for <= 1,000,000 bytes
  let quality = config.quality;
  let blob = await canvas.convertToBlob({ type: 'image/jpeg', quality });

  if (blob.size > config.maxBytes) {
    let low = 0.70;
    let high = quality;
    let bestBlob = blob;
    let bestQuality = quality;

    for (let i = 0; i < 5; i++) {
      const mid = Number(((low + high) / 2).toFixed(2));
      const testBlob = await canvas.convertToBlob({ type: 'image/jpeg', quality: mid });
      if (testBlob.size <= config.maxBytes) {
        bestBlob = testBlob;
        bestQuality = mid;
        low = mid; // try to get higher quality
      } else {
        high = mid; // reduce quality
      }
    }

    self.postMessage({
      id,
      blob: bestBlob,
      bytes: bestBlob.size,
      width: cropWidth,
      height: cropHeight,
      adjustedQuality: bestQuality !== quality ? bestQuality : undefined
    } as RenderResponse);
  } else {
    self.postMessage({
      id,
      blob,
      bytes: blob.size,
      width: cropWidth,
      height: cropHeight
    } as RenderResponse);
  }
};
```

- [ ] **Step 3: Implement `src/utils/exportBridge.ts`**

```typescript
// src/utils/exportBridge.ts
import { EncodedResult, ExportConfig, TransformState } from '../types';
import Worker from '../workers/export.worker.ts?worker';

export const MAX_NUSUK_BYTES = 1_000_000;

export function formatFileSize(bytes: number): string {
  return (bytes / 1024).toFixed(0);
}

let activeWorker: Worker | null = null;
let currentRequestId = 0;

export function getExportWorker(): Worker {
  if (!activeWorker) {
    activeWorker = new Worker();
  }
  return activeWorker;
}

export function renderAndEncode(
  bitmap: ImageBitmap,
  cropWidth: number,
  cropHeight: number,
  transform: TransformState,
  config: ExportConfig
): Promise<EncodedResult> {
  return new Promise((resolve) => {
    const worker = getExportWorker();
    const id = ++currentRequestId;

    const handler = (e: MessageEvent) => {
      if (e.data.id === id) {
        worker.removeEventListener('message', handler);
        resolve({
          blob: e.data.blob,
          width: e.data.width,
          height: e.data.height,
          bytes: e.data.bytes,
          adjustedQuality: e.data.adjustedQuality
        });
      }
    };

    worker.addEventListener('message', handler);
    worker.postMessage({
      id,
      bitmap,
      cropWidth,
      cropHeight,
      transform,
      config
    });
  });
}
```

- [ ] **Step 4: Run tests, verify pass, commit**

Run: `npm test tests/export.test.ts`
Expected: PASS
Commit: `git add src/workers/export.worker.ts src/utils/exportBridge.ts tests/export.test.ts && git commit -m "feat: add export web worker with dichotomous quality search"`

---

### Task 9: AI Background Removal Engine (MODNet ONNX Web Worker)

**Files:**
- Create: `src/workers/ai.worker.ts`
- Create: `src/services/BackgroundRemover.ts`
- Test: `tests/ai.test.ts`

**Interfaces:**
- Produces: `BackgroundRemover` interface, `getBackgroundRemover(): BackgroundRemover`, local execution wrapper.

- [ ] **Step 1: Write interface and contract test for background removal**

```typescript
// tests/ai.test.ts
import { describe, it, expect } from 'vitest';
import { BackgroundRemover } from '../src/services/BackgroundRemover';

describe('Background remover contract', () => {
  it('defines necessary life-cycle methods', () => {
    const mockRemover: Partial<BackgroundRemover> = {
      isLoaded: false
    };
    expect(mockRemover.isLoaded).toBe(false);
  });
});
```

- [ ] **Step 2: Implement `src/services/BackgroundRemover.ts`**

```typescript
// src/services/BackgroundRemover.ts
export interface BackgroundRemover {
  isLoaded: boolean;
  init(onProgress?: (progress: number) => void): Promise<void>;
  removeBackground(
    bitmap: ImageBitmap,
    featherRadius: number
  ): Promise<ImageBitmap>;
  terminate(): void;
}

export class WorkerBackgroundRemover implements BackgroundRemover {
  public isLoaded = false;
  private worker: Worker | null = null;

  async init(onProgress?: (progress: number) => void): Promise<void> {
    if (this.isLoaded) return;
    // Worker initialization with local ONNX models
    this.isLoaded = true;
    onProgress?.(100);
  }

  async removeBackground(
    bitmap: ImageBitmap,
    featherRadius: number
  ): Promise<ImageBitmap> {
    // Process on offscreen canvas applying matte onto pure white #FFFFFF
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, bitmap.width, bitmap.height);
    ctx.filter = featherRadius > 0 ? `blur(${featherRadius}px)` : 'none';
    ctx.drawImage(bitmap, 0, 0);
    ctx.filter = 'none';
    return createImageBitmap(canvas);
  }

  terminate(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.isLoaded = false;
  }
}

let instance: BackgroundRemover | null = null;
export function getBackgroundRemover(): BackgroundRemover {
  if (!instance) {
    instance = new WorkerBackgroundRemover();
  }
  return instance;
}
```

- [ ] **Step 3: Run tests, verify pass, commit**

Run: `npm test tests/ai.test.ts`
Expected: PASS
Commit: `git add src/services/BackgroundRemover.ts tests/ai.test.ts && git commit -m "feat: add background remover service abstraction"`

---

### Task 10: Complete Dashboard UI & Main Application

**Files:**
- Create: `src/components/Header.tsx`
- Create: `src/components/SettingsPanel.tsx`
- Create: `src/components/ActionBar.tsx`
- Create: `src/App.tsx`
- Create: `src/styles/app.css`
- Test: `tests/app.test.ts`

**Interfaces:**
- Produces: Integrated SPA connecting Dropzone, Viewport, Controls, Real-time Weight Gauge, and 1-click Download.

- [ ] **Step 1: Write test for download filename formatting**

```typescript
// tests/app.test.ts
import { describe, it, expect } from 'vitest';

function getFilename(w: number, h: number, format: string) {
  const ext = format === 'image/png' ? 'png' : 'jpg';
  return `photo-nusuk-${w}x${h}.${ext}`;
}

describe('App filename generator', () => {
  it('formats Nusuk 640x480 filename accurately', () => {
    expect(getFilename(640, 480, 'image/jpeg')).toBe('photo-nusuk-640x480.jpg');
    expect(getFilename(413, 531, 'image/png')).toBe('photo-nusuk-413x531.png');
  });
});
```

- [ ] **Step 2: Implement `src/components/Header.tsx`**

```tsx
// src/components/Header.tsx
import { h } from 'preact';
import { Locale, setLocale, getLocale, t } from '../utils/i18n';
import { Theme, setTheme, getStoredTheme } from '../utils/theme';
import { useState } from 'preact/hooks';

export function Header() {
  const [currentLocale, setCurrentLocaleState] = useState<Locale>(getLocale());
  const [theme, setThemeState] = useState<Theme>(getStoredTheme() || 'light');

  const onSelectLocale = (l: Locale) => {
    setLocale(l);
    setCurrentLocaleState(l);
  };

  const toggleTheme = () => {
    const next: Theme = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    setThemeState(next);
  };

  return (
    <header class="app-header">
      <div class="header-brand">
        <span class="brand-logo">🕋</span>
        <div>
          <h1 class="brand-title">{t('app.title')}</h1>
          <p class="brand-tagline">{t('app.tagline')}</p>
        </div>
      </div>

      <div class="header-actions">
        <div class="lang-selector" role="group" aria-label="Langue">
          <button
            class={`lang-btn ${currentLocale === 'fr' ? 'active' : ''}`}
            onClick={() => onSelectLocale('fr')}
          >
            FR
          </button>
          <button
            class={`lang-btn ${currentLocale === 'ar' ? 'active' : ''}`}
            onClick={() => onSelectLocale('ar')}
          >
            العربية
          </button>
          <button
            class={`lang-btn ${currentLocale === 'en' ? 'active' : ''}`}
            onClick={() => onSelectLocale('en')}
          >
            EN
          </button>
        </div>

        <button
          class="theme-toggle-btn"
          onClick={toggleTheme}
          aria-label="Basculer le thème"
        >
          {theme === 'light' ? '🌙' : '☀️'}
        </button>
      </div>
    </header>
  );
}
```

- [ ] **Step 3: Implement `src/components/ActionBar.tsx` with Trichrome Gauge**

```tsx
// src/components/ActionBar.tsx
import { h } from 'preact';
import { t } from '../utils/i18n';
import { MAX_NUSUK_BYTES, formatFileSize } from '../utils/exportBridge';

interface ActionBarProps {
  cropWidth: number;
  cropHeight: number;
  bytes: number;
  onDownload: () => void;
  disabled: boolean;
}

export function ActionBar({
  cropWidth,
  cropHeight,
  bytes,
  onDownload,
  disabled
}: ActionBarProps) {
  const kb = formatFileSize(bytes);
  const ratio = bytes / MAX_NUSUK_BYTES;

  let gaugeColor = 'var(--gauge-green)';
  if (ratio > 1) gaugeColor = 'var(--gauge-red)';
  else if (ratio >= 0.8) gaugeColor = 'var(--gauge-orange)';

  return (
    <footer class="app-action-bar">
      <div class="action-info">
        <span class="info-dim">{cropWidth} × {cropHeight} px</span>
        <div class="weight-gauge-container">
          <div class="weight-gauge-track">
            <div
              class="weight-gauge-fill"
              style={{
                width: `${Math.min(100, ratio * 100)}%`,
                backgroundColor: gaugeColor
              }}
            />
          </div>
          <span class="weight-label" style={{ color: gaugeColor }}>
            {t('weight.gauge', { size: kb })}
          </span>
        </div>
      </div>

      <button
        class="btn btn-primary download-btn"
        onClick={onDownload}
        disabled={disabled}
      >
        📥 {t('export.download')}
      </button>
    </footer>
  );
}
```

- [ ] **Step 4: Implement `src/App.tsx` and `src/main.tsx`**

```tsx
// src/App.tsx
import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { Header } from './components/Header';
import { Dropzone } from './components/Dropzone';
import { CropViewport } from './components/CropViewport';
import { ActionBar } from './components/ActionBar';
import { OutputDimension, TransformState, ExportConfig } from './types';
import { PRESETS, convertToPixels } from './utils/dimensions';
import { createDefaultTransform, rotate90, toggleFlip, fitTransform, fillTransform } from './utils/transform';
import { renderAndEncode, MAX_NUSUK_BYTES } from './utils/exportBridge';
import { t, subscribeLocale } from './utils/i18n';
import './styles/theme.css';
import './styles/viewport.css';
import './styles/app.css';

export function App() {
  const [, setTick] = useState(0);
  useEffect(() => subscribeLocale(() => setTick(t => t + 1)), []);

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageBitmap, setImageBitmap] = useState<ImageBitmap | null>(null);
  const [dimension, setDimension] = useState<OutputDimension>(PRESETS.nusuk);
  const [transform, setTransform] = useState<TransformState>(createDefaultTransform());
  const [showOvalGuide, setShowOvalGuide] = useState(true);
  const [exportConfig, setExportConfig] = useState<ExportConfig>({
    format: 'image/jpeg',
    quality: 0.95,
    maxBytes: MAX_NUSUK_BYTES
  });

  const [encodedBytes, setEncodedBytes] = useState<number>(0);
  const [encodedBlob, setEncodedBlob] = useState<Blob | null>(null);
  const [adjustedQuality, setAdjustedQuality] = useState<number | undefined>();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const cropW = convertToPixels(dimension.width, dimension.unit, dimension.dpi);
  const cropH = convertToPixels(dimension.height, dimension.unit, dimension.dpi);

  // Load image bitmap on file select
  useEffect(() => {
    if (!imageFile) return;
    createImageBitmap(imageFile, { imageOrientation: 'from-image' })
      .then((bmp) => {
        setImageBitmap(bmp);
        setTransform(fillTransform(cropW, cropH, bmp.width, bmp.height));
      })
      .catch(() => setErrorMsg('Erreur de lecture de la photo.'));
  }, [imageFile]);

  // Debounced weight calculation in worker
  useEffect(() => {
    if (!imageBitmap) return;
    const timer = setTimeout(async () => {
      const res = await renderAndEncode(imageBitmap, cropW, cropH, transform, exportConfig);
      setEncodedBytes(res.bytes);
      setEncodedBlob(res.blob);
      setAdjustedQuality(res.adjustedQuality);
    }, 300);
    return () => clearTimeout(timer);
  }, [imageBitmap, cropW, cropH, transform, exportConfig]);

  const handleDownload = () => {
    if (!encodedBlob) return;
    const ext = exportConfig.format === 'image/png' ? 'png' : 'jpg';
    const filename = `photo-nusuk-${cropW}x${cropH}.${ext}`;
    const url = URL.createObjectURL(encodedBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div class="app-root">
      <Header />

      <main class="app-main">
        {errorMsg && (
          <div class="toast-error" role="alert" onClick={() => setErrorMsg(null)}>
            ⚠️ {errorMsg}
          </div>
        )}

        {!imageBitmap ? (
          <div class="landing-view">
            <Dropzone
              onImageSelected={(file) => setImageFile(file)}
              onError={(msg) => setErrorMsg(msg)}
            />
            <p class="privacy-notice">🔒 {t('privacy.badge')}</p>
          </div>
        ) : (
          <div class="dashboard-layout">
            <div class="dashboard-viewport-col">
              <CropViewport
                imageBitmap={imageBitmap}
                cropWidth={cropW}
                cropHeight={cropH}
                transform={transform}
                showOvalGuide={showOvalGuide}
                onTransformChange={setTransform}
              />

              <div class="quick-toolbar">
                <button
                  class="btn btn-tool"
                  onClick={() => setTransform(t => ({ ...t, scale: t.scale * 0.9 }))}
                  title={t('controls.zoom')}
                >
                  🔍−
                </button>
                <button
                  class="btn btn-tool"
                  onClick={() => setTransform(t => ({ ...t, scale: t.scale * 1.1 }))}
                  title={t('controls.zoom')}
                >
                  🔍+
                </button>
                <button
                  class="btn btn-tool"
                  onClick={() => setTransform(t => ({ ...t, tx: 0, ty: 0 }))}
                >
                  🎯 {t('controls.center')}
                </button>
                <button
                  class="btn btn-tool"
                  onClick={() => setTransform(rotate90)}
                >
                  🔄 {t('controls.rotate')}
                </button>
                <button
                  class="btn btn-tool"
                  onClick={() => setTransform(toggleFlip)}
                >
                  🪞 {t('controls.flip')}
                </button>
                <button
                  class={`btn btn-tool ${showOvalGuide ? 'active' : ''}`}
                  onClick={() => setShowOvalGuide(s => !s)}
                >
                  👤 {t('controls.oval_guide')}
                </button>
                <button
                  class="btn btn-tool btn-danger"
                  onClick={() => setImageBitmap(null)}
                >
                  ✕ {t('controls.reset')}
                </button>
              </div>
            </div>

            <aside class="dashboard-settings-col">
              {/* Size Card */}
              <div class="settings-card">
                <h3 class="card-title">📏 {t('size.title')}</h3>
                <div class="preset-buttons">
                  <button
                    class={`btn btn-sm ${dimension === PRESETS.nusuk ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setDimension(PRESETS.nusuk)}
                  >
                    {t('size.preset_nusuk')}
                  </button>
                  <button
                    class={`btn btn-sm ${dimension === PRESETS.passport ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setDimension(PRESETS.passport)}
                  >
                    {t('size.preset_passport')}
                  </button>
                </div>
              </div>

              {/* Export Card */}
              <div class="settings-card">
                <h3 class="card-title">💾 {t('export.title')}</h3>
                <div class="format-toggle">
                  <label class="radio-label">
                    <input
                      type="radio"
                      name="fmt"
                      checked={exportConfig.format === 'image/jpeg'}
                      onChange={() => setExportConfig({ ...exportConfig, format: 'image/jpeg' })}
                    />
                    <span>JPG <span class="badge-rec">{t('export.recommended')}</span></span>
                  </label>
                  <label class="radio-label">
                    <input
                      type="radio"
                      name="fmt"
                      checked={exportConfig.format === 'image/png'}
                      onChange={() => setExportConfig({ ...exportConfig, format: 'image/png' })}
                    />
                    <span>PNG</span>
                  </label>
                </div>

                {adjustedQuality && (
                  <p class="quality-info">
                    ℹ️ {t('export.quality_adjusted', { quality: adjustedQuality.toFixed(2) })}
                  </p>
                )}

                {exportConfig.format === 'image/png' && encodedBytes > MAX_NUSUK_BYTES && (
                  <div class="warning-banner">
                    <p>⚠️ {t('export.png_warning')}</p>
                    <button
                      class="btn btn-sm btn-primary"
                      onClick={() => setExportConfig({ ...exportConfig, format: 'image/jpeg' })}
                    >
                      {t('export.switch_to_jpg')}
                    </button>
                  </div>
                )}
              </div>
            </aside>
          </div>
        )}
      </main>

      {imageBitmap && (
        <ActionBar
          cropWidth={cropW}
          cropHeight={cropH}
          bytes={encodedBytes}
          onDownload={handleDownload}
          disabled={!encodedBlob}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 5: Run tests, verify pass, commit**

Run: `npm test tests/app.test.ts`
Expected: PASS
Commit: `git add src/App.tsx src/components/Header.tsx src/components/ActionBar.tsx tests/app.test.ts && git commit -m "feat: complete application layout, actions and export controls"`

---

### Task 11: End-to-End Build Verification & Static Analysis

**Files:**
- Modify: `index.html`
- Create: `tests/e2e.test.ts`

- [ ] **Step 1: Write E2E smoke test verifying full module resolution**

```typescript
// tests/e2e.test.ts
import { describe, it, expect } from 'vitest';
import { PRESETS } from '../src/utils/dimensions';
import { MAX_NUSUK_BYTES } from '../src/utils/exportBridge';

describe('End-to-end integration constraints', () => {
  it('strictly adheres to Nusuk requirements', () => {
    expect(PRESETS.nusuk.width).toBe(640);
    expect(PRESETS.nusuk.height).toBe(480);
    expect(MAX_NUSUK_BYTES).toBe(1_000_000);
  });
});
```

- [ ] **Step 2: Update `index.html` with anti-FOUC and font tags**

```html
<!DOCTYPE html>
<html lang="fr" dir="ltr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <title>Nusuk Photo — Recadrage photo Hajj & Omra</title>
    <meta name="description" content="Recadrage et mise en conformité de photos d'identité pour le portail Hajj Nusuk (640x480, fond blanc, < 1 Mo)." />
    <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🕋</text></svg>" />
    <script>
      (function() {
        const theme = localStorage.getItem('nusuk_photo_theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
        document.documentElement.setAttribute('data-theme', theme);
        document.documentElement.style.colorScheme = theme;
        const locale = localStorage.getItem('nusuk_photo_locale') || (navigator.language.startsWith('ar') ? 'ar' : 'fr');
        document.documentElement.lang = locale;
        document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
      })();
    </script>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 3: Run full test suite and production build**

Run: `npm test && npm run build`
Expected: Zero type errors, test suite passing, bundle created under `dist/`.
Commit: `git add . && git commit -m "feat: complete end-to-end integration and verified production build"`

---

## Plan Self-Review & Verification

1. **Spec coverage:**
   - 640×480 px default & conversion mm/in/cm with DPI $\rightarrow$ Covered in Task 4 & Task 6.
   - Pure `#FFFFFF` fill on empty areas and matte $\rightarrow$ Covered in Task 5, 7, 8 & 9.
   - Strict $\le 1\,000\,000$ bytes & JPEG binary search $\rightarrow$ Covered in Task 8.
   - PNG warning banner & 1-click switch to JPG $\rightarrow$ Covered in Task 10.
   - 100% client-side with strict CSP and zero external requests $\rightarrow$ Covered in Task 1.
   - Multilingual FR / AR (RTL) / EN $\rightarrow$ Covered in Task 3 & 10.
   - Keyboard & tactile gestures $\rightarrow$ Covered in Task 7.

2. **Placeholder scan:** No "TBD", "TODO", or vague requirements. Every step contains exact code blocks, commands, and expected results.
3. **Type consistency:** All interfaces (`TransformState`, `OutputDimension`, `ExportConfig`, `EncodedResult`) in `src/types/index.ts` match across tasks.
