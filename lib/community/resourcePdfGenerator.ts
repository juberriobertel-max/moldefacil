"use client";

import { jsPDF } from "jspdf";
import type { DescargableComunidad } from "./types";

interface SeccionRecurso {
  subtitulo: string;
  lineas: string[];
}

const CONTENIDOS_RECURSOS: Record<string, SeccionRecurso[]> = {
  "checklist-medidas": [
    {
      subtitulo: "Instrucciones previas en el taller",
      lineas: [
        "1. Toma las medidas sobre ropa interior o prendas muy ajustadas, sin apretar la cinta.",
        "2. Anota cada contorno manteniendo la cinta métrica paralela al suelo.",
        "3. Recuerda: estas medidas son solo para tu libreta privada o tu navegador; nunca se publican en la comunidad.",
      ],
    },
    {
      subtitulo: "Lista de las 12 medidas clave de MoldeFácil",
      lineas: [
        "[ ] Contorno de busto (parte más prominente): ______ cm",
        "[ ] Contorno de cintura (zona más estrecha o donde reposa la prenda): ______ cm",
        "[ ] Contorno de cadera (parte más saliente, aprox. 18–20 cm bajo cintura): ______ cm",
        "[ ] Ancho de espalda (de extremo a extremo de hombros): ______ cm",
        "[ ] Talle delantero / largo de cuerpo (hombro base a cintura): ______ cm",
        "[ ] Largo de manga (hombro hasta muñeca con codo ligeramente flexionado): ______ cm",
        "[ ] Largo de falda deseado (desde cintura hasta el largo final): ______ cm",
        "[ ] Tiro / altura de cadera sentada (silla plana hasta cintura): ______ cm",
        "[ ] Contorno de muslo (parte más ancha de la pierna): ______ cm",
        "[ ] Entrepierna (desde entrepierna hasta tobillo): ______ cm",
        "[ ] Ancho de bota deseado: ______ cm",
        "[ ] Contorno de cabeza (para gorros bucket y accesorios): ______ cm",
      ],
    },
  ],
  "ficha-tecnica-prenda": [
    {
      subtitulo: "Identificación de la creación o pedido",
      lineas: [
        "Prenda: _______________________   Fecha de entrega / corte: ____/____/202__",
        "Tela principal: _________________   Composición / encogimiento previo: ______",
        "Consumo aproximado: _____ metros (ancho ____ cm)   Forro / entretela: _________",
      ],
    },
    {
      subtitulo: "Configuración técnica y máquina",
      lineas: [
        "Tipo de aguja: [ ] Universal 80/12  [ ] Punta bola Jersey  [ ] Microtex 70/10",
        "Largo de puntada: ____ mm   Margen de costura elegido: [ ] 0 cm  [ ] 1 cm  [ ] 1.5 cm",
        "Hilo y color: ____________________   Cierre / botones / elástico: _______________",
      ],
    },
    {
      subtitulo: "Control de calidad antes de entregar o publicar",
      lineas: [
        "[ ] Lavado o vapor previo para controlar encogimiento.",
        "[ ] Prueba en muselina o hilván en zonas críticas (sisa, tiro o escote).",
        "[ ] Costuras asentadas con plancha y vistas aseguradas con pespunte.",
        "[ ] Dobladillo reposado 24h si lleva corte al bies o semicircular.",
      ],
    },
  ],
  "tabla-tallas-base": [
    {
      subtitulo: "Medidas corporales orientativas en centímetros (XS a 3XL)",
      lineas: [
        "XS  | Busto: 82 cm  | Cintura: 64 cm  | Cadera: 90 cm  | Ancho espalda: 35 cm",
        "S   | Busto: 88 cm  | Cintura: 70 cm  | Cadera: 96 cm  | Ancho espalda: 36.5 cm",
        "M   | Busto: 94 cm  | Cintura: 76 cm  | Cadera: 102 cm | Ancho espalda: 38 cm",
        "L   | Busto: 102 cm | Cintura: 84 cm  | Cadera: 110 cm | Ancho espalda: 40 cm",
        "XL  | Busto: 110 cm | Cintura: 92 cm  | Cadera: 118 cm | Ancho espalda: 42 cm",
        "2XL | Busto: 118 cm | Cintura: 102 cm | Cadera: 126 cm | Ancho espalda: 44 cm",
        "3XL | Busto: 126 cm | Cintura: 112 cm | Cadera: 134 cm | Ancho espalda: 46 cm",
      ],
    },
    {
      subtitulo: "Holguras recomendadas según tela",
      lineas: [
        "- Tejido plano ajustado (popelina, lino): +4 cm en busto, +2 cm en cintura.",
        "- Tejido fluido holgado (crepé, viscosa): +6 a +8 cm en busto, +4 cm en cadera.",
        "- Punto con elasticidad (licra, jersey): 0 a -4 cm de reducción negativa según elongación.",
      ],
    },
  ],
  "plantilla-costeo": [
    {
      subtitulo: "1. Materiales directos (por prenda)",
      lineas: [
        "Tela principal (metros x valor por metro): $ ______________",
        "Forro / entretela / sesgo:                 $ ______________",
        "Cierres, botones, elásticos e hilos:       $ ______________",
        "SUBTOTAL MATERIALES:                       $ ______________",
      ],
    },
    {
      subtitulo: "2. Mano de obra real y costos del taller",
      lineas: [
        "Horas de trazado, corte, prueba y costura: ______ h x valor hora $ ________",
        "Electricidad, agujas, papel de molde y desgaste máquina (10-15%): $ ________",
        "Empaque / etiquetas / transporte:          $ ______________",
      ],
    },
    {
      subtitulo: "3. Cálculo de precio justo",
      lineas: [
        "Costo total de producción (Materiales + Mano de obra + Taller): $ ____________",
        "Margen de ganancia del taller (25% a 40% sobre costo):           $ ____________",
        "PRECIO FINAL SUGERIDO AL PÚBLICO:                               $ ____________",
        "Regla de oro: nunca regales tus horas de prueba y ajuste en el precio.",
      ],
    },
  ],
};

/**
 * Genera y descarga un PDF limpio en formato Carta con la guía solicitada.
 */
export function descargarRecursoComunidadPdf(recurso: DescargableComunidad): void {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "letter",
  });

  doc.setFillColor(250, 246, 240);
  doc.rect(0, 0, 215.9, 279.4, "F");

  doc.setFillColor(179, 71, 32);
  doc.rect(0, 0, 215.9, 26, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("MoldeFácil · Recursos de la Comunidad de Modistas", 16, 12);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.text(`${recurso.categoria} · ${recurso.version} · Actualizado ${recurso.fecha_actualizacion}`, 16, 19);

  let y = 38;
  doc.setTextColor(45, 42, 38);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  const tituloSplit = doc.splitTextToSize(recurso.titulo, 182) as string[];
  doc.text(tituloSplit, 16, y);
  y += tituloSplit.length * 7 + 2;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.setTextColor(92, 85, 78);
  const descSplit = doc.splitTextToSize(recurso.descripcion, 182) as string[];
  doc.text(descSplit, 16, y);
  y += descSplit.length * 5.5 + 8;

  const secciones = CONTENIDOS_RECURSOS[recurso.id] ?? [
    {
      subtitulo: "Notas de taller",
      lineas: [recurso.descripcion],
    },
  ];

  for (const sec of secciones) {
    doc.setDrawColor(226, 214, 200);
    doc.setFillColor(255, 255, 255);
    const bloqueLineas = sec.lineas.flatMap((l) =>
      doc.splitTextToSize(l, 172) as string[]
    );
    const altoCaja = 14 + bloqueLineas.length * 6;
    if (y + altoCaja > 260) {
      doc.addPage();
      y = 20;
    }
    doc.roundedRect(14, y - 4, 188, altoCaja, 3, 3, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11.5);
    doc.setTextColor(59, 122, 87);
    doc.text(sec.subtitulo, 18, y + 3);
    y += 10;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(45, 42, 38);
    for (const ln of bloqueLineas) {
      doc.text(ln, 18, y);
      y += 6;
    }
    y += 8;
  }

  doc.setFontSize(8.5);
  doc.setTextColor(92, 85, 78);
  doc.text(
    "Recurso gratuito de uso libre para tu taller · MoldeFácil (comunidad sin exposición de medidas privadas)",
    16,
    268
  );

  doc.save(`${recurso.id}-${recurso.version}.pdf`);
}