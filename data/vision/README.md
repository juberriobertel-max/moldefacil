# Biblioteca de referencia y evaluación del detector visual

Esta carpeta organiza dos conjuntos **estrictamente separados**:

- `reference/`: imágenes de referencia reales o renders propios para calcular vectores una sola vez y guardarlos en `public/vision/reference/<modelo>.json`.
- `eval/`: fotos reales etiquetadas apartadas (**nunca incluidas en `reference/`**) para medir precisión antes y después de cada cambio.
- `reports/`: reportes automáticos generados por `npm run vision:eval` (`latest.md` y archivos JSON con marca de tiempo).

> **Regla de oro (cero fuga de datos):** nunca pongas la misma foto en `reference/` y en `eval/`. El script de evaluación compara hashes SHA-256 y excluye automáticamente cualquier duplicado.

## Estructura de carpetas

```text
data/vision/
├─ README.md
├─ reference/
│  ├─ manifest.json
│  └─ images/          # tus fotos reales (no se suben a git)
├─ eval/
│  ├─ manifest.json
│  └─ images/          # tus ~100 fotos reales de prueba (no se suben a git)
└─ reports/            # resultados generados (no se suben a git)
```

## Formato de `manifest.json`

Tanto `data/vision/reference/manifest.json` como `data/vision/eval/manifest.json` usan la misma estructura:

```json
{
  "version": 1,
  "items": [
    {
      "id": "ref-00",
      "file": "images/mi-carpeta/vestido-cruzado-01.jpg",
      "labels": {
        "category": "vestido",
        "neckline": "wrap",
        "sleeve": "kimono",
        "length": "short"
      },
      "source": "propia",
      "license": "foto propia de taller",
      "notes": "Opcional: tela algodón, fondo claro"
    }
  ]
}
```

Valores válidos para `source`:
- `"propia"`: fotografías tomadas por ti.
- `"modista"`: fotos cedidas por modistas aliadas **con permiso explícito**.
- `"render_propio"`: capturas o renders generados por tu propia app 3D o ilustraciones propias.
- `"licencia_abierta"`: imágenes con licencia abierta revisadas una a una (p. ej. CC0 / CC-BY comercialmente compatible).
- `"ai_generated"`: solo para pruebas de humo internas (**no sustituye la medición real**).

> **Sobre datasets públicos de moda:** no uses datasets públicos de investigación que prohíban uso comercial o redistribución dentro de un producto.

## IDs permitidos en `labels`

| Atributo (`labels.<clave>`) | Vista / Recorte | IDs permitidos |
|---|---|---|
| `category` | `full` | `vestido`, `blusa`, `chaqueta`, `falda`, `pantalon`, `conjunto`, `enterizo`, `bucketHat` |
| `neckline` | `neckline` | `wrap`, `v_neck`, `round`, `square`, `tailored_lapel`, `shirt_collar`, `high` |
| `sleeve` | `sleeves` | `kimono`, `farol`, `acampanada`, `short`, `long`, `sleeveless` |
| `fit` | `full` | `fitted`, `loose` |
| `length` | `full` | `short`, `midi`, `long` |
| `skirtCut` | `waistLower` | `straight`, `a_line`, `semicircular` |
| `pantsCut` | `waistLower` | `straight`, `wide`, `shorts` |
| `waistTie` | `waistLower` | `with_belt`, `no_belt` |
| `ruffle` | `waistLower` | `with_ruffle`, `no_ruffle` |
| `fabric` | `full` | `seda`, `crepe`, `lino`, `licra` |
| `print` | `full` | `liso`, `lunares`, `rayas`, `vichy` |

Puedes etiquetar solo los atributos que sean claramente visibles en cada foto (por ejemplo, en una foto de pantalón no pongas `neckline` ni `sleeve`).

## Cuántas fotos juntar

- **Evaluación (`eval/`):** apunta a **~100 fotos reales** variadas (fondos reales de casa/taller, maniquí, persona, telas lisas y estampadas), con al menos ~8 ejemplos por cada valor de `neckline` y `sleeve`.
- **Referencia (`reference/`):** apunta a **15 a 30 imágenes reales por cada valor** de atributo que quieras reforzar (frente, maniquí, persona, distintas telas y luces).

## Comandos

1. **Construir archivo de vectores de referencia** (opcional `--loo` para validar *leave-one-out*):
   ```bash
   npm run vision:ref -- --loo
   ```
   Genera `public/vision/reference/siglip-base-patch16-224.json` (o el modelo indicado con `--model=<id>`).

2. **Medir aciertos del detector actual vs referencia (`zeroshot`, `knn`, `blend`):**
   ```bash
   npm run vision:eval -- --methods=zeroshot,knn,blend
   ```
   Guarda el reporte detallado en `data/vision/reports/latest.md` y el detalle completo en JSON dentro de `data/vision/reports/`.
