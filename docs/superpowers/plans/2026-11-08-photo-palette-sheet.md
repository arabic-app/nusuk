# Plan d'implémentation : Planche Photo / Palette d'impression (Multi-photo print sheet)

> **Pour exécution agentique :** Ce plan décompose l'implémentation de la fonctionnalité « Palette / Planche photo » en tâches autonomes testables selon la méthodologie TDD et les directives de qualité du projet.

**Objectif :** Permettre à l'utilisateur de générer et d'exporter une planche photo d'impression (grille répétée de photos d'identité conformes) sur des formats de papier standard (10×15 cm, 13×18 cm, A4) ou personnalisés, avec repères de découpe et aperçu modal en direct.

**Architecture :**
- Module de calcul et de pavage géométrique pur (`sheetTiling.ts`) calculant la disposition optimale (colonnes, lignes, espacements, marges, centrage et repères de coupe).
- Pipeline de rendu haute résolution exécuté dans le Web Worker d'export (`export.worker.ts`), pavant le canvas sans bloquer l'interface.
- Carte dédiée « Planche photo (Palette) » insérée dans le panneau latéral sous « Taille de sortie » avec sélecteurs de presets, options de découpe et bouton d'aperçu.
- Composant modal d'aperçu interactif (`SheetPreviewModal.tsx`) pour prévisualiser la planche avant téléchargement.
- Internationalisation complète (FR, EN, AR) et respect strict du mode 100% privé sans dépendance réseau.

**Stack technique :** Preact, TypeScript, OffscreenCanvas, CSS variables (thèmes clair/sombre, RTL-friendly), Vitest.

---

## Spécifications globales & Contraintes

- **100% Client-side** : Zéro transmission de données, zéro requête externe (conforme CSP stricte).
- **Résolution d'impression optimale** : 300 DPI par défaut pour les formats physiques (ex : 10×15 cm à 300 DPI = 1181 × 1772 px).
- **Optimisation de la disposition** : Calcul automatique de l'orientation (portrait/paysage) pour maximiser le nombre de photos par planche.
- **Traits de découpe** : Repères pointillés fins (`#CBD5E1`) et marges d'impression de sécurité (~3mm) pour éviter les bords coupés par les imprimantes grand public.
- **Accessibilité & i18n** : Traduction intégrale FR / EN / AR, support clavier et aria labels.
- **Maintien des tests existants** : Conservation des 142 tests existants + nouveaux tests unitaires et d'intégration.

---

## Structure des fichiers impactés

```
src/
├── types/index.ts                  # Ajout SheetConfig, SheetPreset, SheetLayout
├── utils/
│   ├── sheetTiling.ts              # Moteur géométrique de calcul de grille & tracé des repères (NOUVEAU)
│   ├── dimensions.ts               # Presets de planches (10x15, 13x18, A4)
│   └── exportBridge.ts             # Intégration sheetConfig dans le bridge et nom de fichier
├── workers/
│   └── export.worker.ts            # Rendu de la planche répétée dans le canvas Offscreen
├── components/
│   ├── Icons.tsx                   # Icônes IconGrid, IconScissors
│   ├── SettingsPanel.tsx           # Section Planche photo sous Taille de sortie
│   ├── SheetPreviewModal.tsx       # Modale d'aperçu haute fidélité (NOUVEAU)
│   └── ActionBar.tsx               # Affichage dynamique du format planche & nombre de photos
├── styles/
│   ├── app.css                     # Styles section palette, toggle collapsible, modal
│   └── viewport.css
└── App.tsx                         # State sheetConfig, déclenchement modal, intégration export
public/locales/
├── fr.json                         # Clés i18n palette
├── en.json
└── ar.json
tests/
├── sheetTiling.test.ts             # Tests unitaires du moteur de pavage (NOUVEAU)
└── app.test.ts                     # Tests d'intégration UI et modale d'aperçu
```

---

## Découpage des tâches

### Tâche 1 : Types de données & Presets de planches
**Fichiers :**
- Modifier : `src/types/index.ts`
- Modifier : `src/utils/dimensions.ts`
- Test : `tests/dimensions.test.ts`

**Description :**
- Définir `SheetPreset = '10x15' | '13x18' | 'a4' | 'custom'`.
- Définir l'interface `SheetConfig` :
  ```ts
  export interface SheetConfig {
    enabled: boolean;
    preset: SheetPreset;
    width: number;
    height: number;
    unit: Unit;
    dpi: number;
    orientation: 'auto' | 'portrait' | 'landscape';
    cutGuides: boolean;
    spacingMm: number; // espacement entre photos (défaut: 2mm)
    marginMm: number;  // marge extérieure minimale (défaut: 3mm)
  }
  ```
- Ajouter dans `dimensions.ts` les constantes de formats papier d'impression :
  - `10x15` : 15 × 10 cm (ou 10 × 15 cm), 300 DPI (standard tirage photo).
  - `13x18` : 18 × 13 cm, 300 DPI.
  - `a4` : 29.7 × 21.0 cm, 300 DPI.
  - Fonction utilitaire `createDefaultSheetConfig()`.

---

### Tâche 2 : Moteur géométrique de pavage et repères de coupe (`sheetTiling.ts`)
**Fichiers :**
- Créer : `src/utils/sheetTiling.ts`
- Créer : `tests/sheetTiling.test.ts`

**Description :**
- Calculer les dimensions en pixels de la planche et de chaque photo selon le DPI.
- `calculateSheetLayout(photoWidthPx, photoHeightPx, config)` :
  - Détermine le nombre de colonnes et de lignes qui rentrent dans l'espace disponible (`largeur - 2 * marge`).
  - Si orientation = `'auto'`, teste portrait et paysage et retient celle offrant le plus de photos (`total = cols * rows`).
  - Calcule le centrage exact de la grille sur la planche (`startX`, `startY`).
  - Retourne les coordonnées `(x, y)` de chaque photo.
- `drawCutGuides(ctx, layout)` :
  - Dessine de fins repères de coupe (lignes pointillées ou traits d'angles) facilitant la découpe aux ciseaux ou massicot.
- `renderSheet(sourceCanvasOrBitmap, layout, cutGuides)` :
  - Rendu complet sur un `OffscreenCanvas` ou `HTMLCanvasElement` : fond blanc, copies répétées de la photo, guides de découpe.
- Tests complets :
  - Vérification du nombre de photos Nusuk (480×640) ou passeport (35×45mm) sur 10×15 cm (ex : 6 photos).
  - Vérification du basculement d'orientation auto.
  - Robustesse avec dimensions personnalisées ou marges serrées.

---

### Tâche 3 : Pipeline d'export et Web Worker
**Fichiers :**
- Modifier : `src/workers/export.worker.ts`
- Modifier : `src/utils/exportBridge.ts`
- Modifier : `tests/export.test.ts`

**Description :**
- Étendre `RenderRequest` pour accepter un `sheetConfig?: SheetConfig` optionnel.
- Dans `export.worker.ts` :
  - Si `sheetConfig?.enabled` est actif, le worker :
    1. Génère le rendu lissé de la photo individuelle recadrée (`drawSmooth`).
    2. Calcule la disposition de la planche via `calculateSheetLayout`.
    3. Crée le canvas aux dimensions de la planche (`sheetWidthPx`, `sheetHeightPx`).
    4. Pave les `totalPhotos` sur la planche et trace les repères si `cutGuides` est activé.
    5. Encode le blob final (JPEG ou PNG) et renvoie le résultat avec les dimensions de la planche.
  - Si désactivé, conserve le comportement classique (export d'une photo unique).
- Dans `exportBridge.ts` :
  - Adapter `getExportFilename` : ex. `planche-photo-nusuk-10x15cm.jpg` si la planche est active.

---

### Tâche 4 : Nouvelles icônes vectorielles SVG
**Fichiers :**
- Modifier : `src/components/Icons.tsx`

**Description :**
- Ajouter `IconGrid` : icône grille 2×2 / 3×2 moderne pour symboliser la planche photo.
- Ajouter `IconScissors` : icône ciseaux fins pour symboliser les guides de découpe.

---

### Tâche 5 : Section Planche photo dans `SettingsPanel.tsx`
**Fichiers :**
- Modifier : `src/components/SettingsPanel.tsx`
- Modifier : `public/locales/fr.json`, `en.json`, `ar.json`
- Modifier : `src/styles/app.css`

**Description :**
- Placer la carte `.settings-card` immédiatement sous la carte « Taille de sortie ».
- En-tête : Titre avec `IconGrid` et switch/toggle : `Activer la planche photo`.
- Contenu dépliable (visible si `sheetConfig.enabled`) :
  - Boutons de presets : `10×15 cm`, `13×18 cm`, `A4`, `Personnalisé`.
  - Si personnalisé : champs largeur, hauteur, unité (`cm`, `mm`, `in`, `px`), DPI.
  - Option orientation : Auto / Paysage / Portrait.
  - Option `Guides de découpe` (avec coche et `IconScissors`).
  - Badge d'information dynamique : ex. `✨ 6 photos par planche (3 colonnes × 2 lignes)` avec dimensions réelles d'impression.
  - Bouton d'action proéminent : `👁️ Aperçu de la planche`.

---

### Tâche 6 : Modale d'aperçu de la planche (`SheetPreviewModal.tsx`)
**Fichiers :**
- Créer : `src/components/SheetPreviewModal.tsx`
- Modifier : `src/styles/app.css`
- Modifier : `src/App.tsx`

**Description :**
- Modale accessible (touche Échap, clic arrière-plan, focus trap, bouton fermeture).
- En-tête avec titre, format (ex : `10×15 cm • 6 photos`) et bouton fermer (`IconClose`).
- Corps de la modale : affichage du rendu haute fidélité de la planche générée avec ses photos répétées et traits de coupe, fond blanc soigné avec ombre portée.
- Pied de modale : bouton `Télécharger la planche` (`IconDownload`) et bouton fermer.

---

### Tâche 7 : Intégration dans `App.tsx` et barre d'actions
**Fichiers :**
- Modifier : `src/App.tsx`
- Modifier : `src/components/ActionBar.tsx`

**Description :**
- État `sheetConfig` initialisé via `createDefaultSheetConfig()`.
- Synchronisation automatique : quand la planche est activée, le recalcul en arrière-plan génère la planche et met à jour le poids (Ko) affiché dans la jauge.
- Dans `ActionBar.tsx` : affiche `Planche 10×15 cm (6 photos)` et le bouton de téléchargement télécharge la planche complète.
- Gestion de l'ouverture/fermeture de la modale d'aperçu.

---

### Tâche 8 : Tests automatisés & Validation globale
**Fichiers :**
- `tests/sheetTiling.test.ts`
- `tests/export.test.ts`
- `tests/app.test.ts`

**Description :**
- Tests unitaires complets sur le calcul géométrique et le rendu canvas.
- Tests d'intégration sur l'activation de la planche, le changement de preset, le basculement portrait/paysage, et l'ouverture de la modale d'aperçu.
- Validation des 142 tests existants + nouveaux tests.
- Vérification du build de production (`npm run build`).
