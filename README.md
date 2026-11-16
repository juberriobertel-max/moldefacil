# MoldeFácil — Patrones de costura a medida

Aplicación web de patronaje paramétrico 100% en el navegador construida con Next.js (App Router), TypeScript, Tailwind CSS, `jspdf` y `@huggingface/transformers`.

## Características
- **12 Estilos de Moda** preconfigurados en 1 clic (`Vestido Cruzado`, `Corte Imperio`, `Vestido Camisero`, `Conjunto Sastre`, `Palazzo`, etc.).
- **Detector Automático de Moda en el Navegador** con `Xenova/clip-vit-base-patch32` (100% client-side, sin APIs externas) + calco directo con pines arrastrables.
- **Extras de Prenda Combinables**: Frente Cruzado + Vista de Escote, Manga Acampanada, Tiras de Cintura, Bolero en Ruedo y Bolsillos Laterales.
- **Exportación PDF Vectorial Escala 1:1** para impresión casera en Carta / A4, con mini-mapa de ensamblaje, cuadro de verificación `50 × 50 mm`, omisión automática de hojas vacías y ficha técnica.
