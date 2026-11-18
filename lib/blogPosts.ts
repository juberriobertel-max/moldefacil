import type { IllustrationKind } from "@/components/blog/SewingIllustration";
import type { WidgetKind } from "@/components/blog/ArticleWidgets";

export type BlogCategory =
  | "Patronaje"
  | "Telas y Materiales"
  | "Negocio y Precios"
  | "Trucos de Taller";

export type SvgDiagramKind =
  | "body-measurements"
  | "pdf-tiling"
  | "circle-skirt-formula"
  | "clean-finishes"
  | "pattern-adaptations";

export type ContentBlock =
  | {
      type: "resumen_rapido";
      puntos: string[];
    }
  | {
      type: "subtitulo";
      texto: string;
    }
  | {
      type: "parrafo";
      texto: string;
    }
  | {
      type: "truco_taller";
      titulo?: string;
      texto: string;
    }
  | {
      type: "alerta_tijera";
      titulo?: string;
      texto: string;
    }
  | {
      type: "ilustracion_svg";
      tipo: IllustrationKind;
      titulo?: string;
      nota?: string;
    }
  | {
      type: "widget_interactivo";
      widget: WidgetKind;
      titulo?: string;
    }
  | {
      type: "tabla_comparativa";
      titulo: string;
      encabezados: string[];
      filas: string[][];
    };

export type BlogContentBlock = ContentBlock;

export interface GeneratorAction {
  label: string;
  description: string;
  href: string;
  secondaryLink?: {
    label: string;
    href: string;
  };
}

export interface BlogPost {
  slug: string;
  titulo: string;
  subtitulo: string;
  categoria: BlogCategory;
  tiempoLectura: string;
  fecha: string;
  resumenSEO: string;
  palabrasClave: string[];
  contenidoEstructurado: ContentBlock[];
  accionGenerador: GeneratorAction;
}

export const BLOG_CATEGORIES: readonly ("Todas" | BlogCategory)[] = [
  "Todas",
  "Patronaje",
  "Telas y Materiales",
  "Negocio y Precios",
  "Trucos de Taller",
];

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: "tabla-cuanta-tela-comprar-por-prenda-y-talla",
    titulo:
      "Tabla definitiva: ¿Cuánta tela comprar según la prenda y la talla? (XS a XL)",
    subtitulo:
      "Calcula en segundos los metros exactos para rollos de 150 cm, 140 cm o 115 cm sin gastar dinero de más ni quedarte corta en la mesa de corte.",
    categoria: "Telas y Materiales",
    tiempoLectura: "6 min",
    fecha: "2026-11-10",
    resumenSEO:
      "Calculadora interactiva y tabla por tallas (XS a XL) para saber cuántos metros de tela comprar en ancho 150 cm y 140 cm según la prenda.",
    palabrasClave: [
      "cuánta tela comprar",
      "metros de tela por talla",
      "ancho de tela 140 150 cm",
      "calcular tela vestido blusa pantalon",
    ],
    contenidoEstructurado: [
      {
        type: "resumen_rapido",
        puntos: [
          "Blusa básica (XS–M): 1.10 m en tela de 150 cm; en tallas L–XL lleva de 1.45 m a 1.65 m.",
          "Vestido midi o pantalón recto (talla M): 1.80 m a 2.20 m en doble ancho (150 cm).",
          "Suma siempre +15 cm por metro si es lino, rayón o algodón 100% porque encogen al primer lavado.",
        ],
      },
      {
        type: "parrafo",
        texto: "Cuando estás frente al mostrador de telas, dudar por 30 centímetros sale caro: si llevas de menos ya no consigues el mismo lote de color, y si compras a ojo terminas acumulando retazos costosos.",
      },
      {
        type: "widget_interactivo",
        widget: "calculador_tela",
      },
      {
        type: "subtitulo",
        texto: "¿Por qué cambia tanto el consumo entre 140 cm y 150 cm?",
      },
      {
        type: "parrafo",
        texto: "Esos 10 centímetros extra del rollo de 150 cm permiten que en tallas M y L el delantero y la espalda quepan uno al lado del otro al doblar la tela. En telas de 140 cm o 115 cm toca acomodar una pieza debajo de la otra.",
      },
      {
        type: "ilustracion_svg",
        tipo: "doblez-tela",
        titulo: "Cómo apoyar tus moldes sobre el doblez para no desperdiciar tela",
        nota: "Apoya siempre el centro del delantero o espalda ras con ras sobre el lomo doblado, sin agregar margen en ese borde.",
      },
      {
        type: "alerta_tijera",
        titulo: "⚠️ ¡Cuidado antes de cortar telas naturales!",
        texto: "Nunca cortes lino, chalis, viscosa ni popelina de algodón sin haberlos mojado y planchado antes. Pueden encoger entre un 5% y un 8% a lo largo en la primera lavada.",
      },
      {
        type: "tabla_comparativa",
        titulo: "Referencia rápida de metros en rollo de 150 cm vs. 140 cm",
        encabezados: ["Prenda", "Tallas XS – M (150 cm)", "Tallas L – XL (150 cm)", "Extra en 140 cm"],
        filas: [
          ["Blusa manga corta", "1.00 – 1.20 m", "1.40 – 1.60 m", "+0.15 a +0.25 m"],
          ["Blusa manga larga / Kimono", "1.35 – 1.55 m", "1.75 – 1.95 m", "+0.20 m"],
          ["Falda recta a la rodilla", "0.85 – 0.95 m", "1.15 – 1.35 m", "+0.15 m"],
          ["Pantalón recto o Palazzo", "1.50 – 1.75 m", "2.05 – 2.30 m", "+0.25 m"],
          ["Vestido cruzado midi", "1.90 – 2.20 m", "2.45 – 2.75 m", "+0.30 m"],
        ],
      },
      {
        type: "truco_taller",
        titulo: "💡 Truco de Taller: El doblez asimétrico",
        texto: "Si solo necesitas doblar 28 cm para sacar el delantero, no dobles todo el rollo de 150 cm por la mitad. Dobla solo esos 28 cm y te quedará una franja libre de 94 cm de ancho para sacar mangas, vistas y cinturón de una sola vez.",
      },
    ],
    accionGenerador: {
      label: "Abrir el Generador con esta prenda →",
      description:
        "MoldeFácil calcula en vivo los metros exactos según tus medidas reales de busto, cintura, cadera y largo.",
      href: "/?prenda=vestido&estilo=cruzado",
      secondaryLink: {
        label: "Simular Plan de Corte en Mi Taller",
        href: "/taller?tab=corte",
      },
    },
  },
  {
    slug: "como-tomar-10-medidas-corporales-sin-ayuda",
    titulo:
      "Cómo tomar las 10 medidas corporales exactas sin ayuda (Guía paso a paso)",
    subtitulo:
      "El método del cordón en la cintura y la silla plana para medirte frente al espejo con precisión de sastrería.",
    categoria: "Patronaje",
    tiempoLectura: "7 min",
    fecha: "2026-11-11",
    resumenSEO:
      "Guía ilustrada de frente y perfil para tomar las 10 medidas corporales de costura (busto, cintura, cadera, talle y tiro) sin ayuda.",
    palabrasClave: [
      "como tomar medidas para costura",
      "medidas corporales patronaje",
      "altura de tiro",
      "largo de talle",
    ],
    contenidoEstructurado: [
      {
        type: "resumen_rapido",
        puntos: [
          "Ata un cordón o elástico fino en tu cintura natural antes de empezar: será tu línea cero para todo.",
          "Mide en ropa interior o licra ajustada, mirando al frente sin inclinar la cabeza hacia el metro.",
          "La cinta debe quedar al ras de la piel sin apretar: el margen de holgura ya lo pone el molde.",
        ],
      },
      {
        type: "parrafo",
        texto: "El 80% de los moldes que quedan grandes en la espalda o apretados en la cadera fallaron en la toma de medidas. Cuando te mides sola y bajas la barbilla para mirar el número, tu torso se encorva y el talle pierde hasta 3 centímetros.",
      },
      {
        type: "ilustracion_svg",
        tipo: "medidas-cuerpo",
        titulo: "Mapa visual de frente y perfil: dónde pasar la cinta métrica",
        nota: "Comprueba de perfil en un espejo que las cintas de busto, cintura y cadera estén totalmente horizontales y paralelas al piso.",
      },
      {
        type: "subtitulo",
        texto: "Las 10 medidas de MoldeFácil explicadas al grano",
      },
      {
        type: "tabla_comparativa",
        titulo: "Dónde apoyar el metro y cómo evitar el error típico",
        encabezados: ["Medida", "Recorrido exacto de la cinta", "Qué evitar"],
        filas: [
          [
            "1. Busto / Pecho",
            "Rodea la espalda recta y pasa por el punto más saliente del pecho.",
            "Que la cinta se caiga hacia la cintura en la espalda.",
          ],
          [
            "2. Cintura",
            "Justo encima del cordón guía donde se marca el quiebre lateral del torso.",
            "Sumir el abdomen al leer el número; respira normal.",
          ],
          [
            "3. Cadera",
            "Por la parte más saliente de los glúteos (unos 18–20 cm bajo la cintura).",
            "Medir sobre el hueso alto de la pelvis en vez del glúteo.",
          ],
          [
            "4. Ancho de espalda",
            "De hueso a hueso de hombro por detrás (o de pliegue a pliegue de axila).",
            "Echar los hombros hacia adelante mientras sostienes la cinta.",
          ],
          [
            "5. Largo de talle",
            "Desde la base del cuello/hombro, pasando sobre el busto hasta el cordón de cintura.",
            "Bajar por el costado evitando el volumen del busto.",
          ],
          [
            "6. Largo de manga",
            "Con la mano en la cintura (codo semi-doblado), del hombro a la muñeca.",
            "Medir con el brazo rígido hacia abajo (quedará corta).",
          ],
          [
            "7. Largo de falda",
            "Desde el cordón de la cintura por el costado hasta la rodilla, midi o tobillo.",
            "Agacharte para leer el metro en la pierna.",
          ],
          [
            "8. Altura de tiro",
            "Sentada recta en silla dura: desde el cordón de la cintura hasta la madera del asiento.",
            "Intentar medir la curva de entrepierna de pie.",
          ],
          [
            "9. Contorno de muslo",
            "Rodea la parte más gruesa del muslo, 3 cm bajo el pliegue del glúteo.",
            "Apretar la cinta contra la piel.",
          ],
          [
            "10. Largo de pierna",
            "Por la cara interna de la pierna, desde la entrepierna hasta el tobillo.",
            "Medir descalza si usarás tacones con ese pantalón.",
          ],
        ],
      },
      {
        type: "truco_taller",
        titulo: "💡 Truco de Taller: Sujeta el cero con cinta de enmascarar",
        texto: "Cuando midas largos verticales tú sola, pega el extremo '0 cm' de la cinta métrica en la base de tu cuello con un pedacito de cinta de papel y lee el número frente al espejo sin mover los brazos.",
      },
      {
        type: "alerta_tijera",
        titulo: "⚠️ ¡Cuidado antes de cortar pantalones!",
        texto: "Nunca sumes centímetros 'por si acaso' a tus medidas corporales antes de meterlas al generador. Si inflas cintura o cadera dos veces, el tiro se desplazará y hará bolsas adelante.",
      },
    ],
    accionGenerador: {
      label: "Abrir el Generador con esta prenda →",
      description:
        "Escribe tus medidas reales en centímetros en el Paso 2 y descarga tu molde base calibrado.",
      href: "/?prenda=blusa&estilo=oficina",
      secondaryLink: {
        label: "Guardar medidas en la Libreta de Mi Taller",
        href: "/taller?tab=libreta",
      },
    },
  },
  {
    slug: "diccionario-telas-costureras-agujas-puntadas",
    titulo:
      "Diccionario de telas para costureras: Rígidas, con caída y elásticas (y qué aguja usar en cada una)",
    subtitulo:
      "Selecciona en un toque qué aguja (70/10 a 100/16) y qué largo de puntada poner para que tu máquina cosa suave a la primera.",
    categoria: "Telas y Materiales",
    tiempoLectura: "7 min",
    fecha: "2026-11-12",
    resumenSEO:
      "Guía interactiva de agujas y puntadas según el tipo de tela: rígidas, fluidas con caída y tejidos de punto o licra.",
    palabrasClave: [
      "que aguja usar para cada tela",
      "telas rigidas y elasticas",
      "aguja punta de bola",
      "calibre aguja maquina coser",
    ],
    contenidoEstructurado: [
      {
        type: "resumen_rapido",
        puntos: [
          "Telas finas con caída (gasa, chalis, viscosa): Aguja fina 70/10 y puntada corta de 2.0 mm.",
          "Telas planas medias (popelina, lino, crepé): Aguja Universal 80/12 y puntada de 2.5 mm.",
          "Telas que estiran (licra, jersey, rib): Aguja Punta de Bola / Stretch 75/11 y puntada zig-zag estrecho.",
        ],
      },
      {
        type: "parrafo",
        texto: "Cuando la máquina salta puntadas en una blusa de licra o arruga una viscosa, casi nunca está desajustada: simplemente tiene puesta una aguja gruesa o de punta aguda que choca contra el tejido.",
      },
      {
        type: "widget_interactivo",
        widget: "selector_agujas",
      },
      {
        type: "subtitulo",
        texto: "Por qué el hilo de la tela manda igual que la aguja",
      },
      {
        type: "parrafo",
        texto: "Además de elegir la aguja correcta, toda tela tiene un sentido de estabilidad paralelo al orillo. Si giras el molde por ahorrar un pedacito de tela, la costura quedará al sesgo y un lado caerá más largo que el otro.",
      },
      {
        type: "ilustracion_svg",
        tipo: "hilo-tela",
        titulo: "Sí vs. No: Cómo alinear la flecha del hilo con el orillo",
        nota: "Mide con la cinta desde la flecha del patrón hasta el orillo en ambos extremos antes de clavar el segundo alfiler.",
      },
      {
        type: "tabla_comparativa",
        titulo: "Tabla rápida de calibres universales y especiales",
        encabezados: ["Calibre", "Grosor de tela", "Telas ideales", "Hilo recomendado"],
        filas: [
          ["70/10", "Muy liviana", "Chifón, gasa, batista, tul, georgette", "Poliéster fino 120"],
          ["80/12", "Media (la más usada)", "Popelina, rayón, chalis, lino camisero, crepé", "Poliéster estándar 100"],
          ["75/11 o 80/12 Ballpoint", "Punto y elásticas", "Jersey algodón, licra, suplex, rib, pijamas", "Poliéster + hilaza en fileteadora"],
          ["90/14", "Media–Pesada", "Gabardina, drill, pana, lino sastre, paño liviano", "Poliéster estándar"],
          ["100/16 Jeans", "Pesada", "Denim grueso, lona, loneta, sobre-costuras", "Hilo calibre 40 o 60"],
        ],
      },
      {
        type: "alerta_tijera",
        titulo: "⚠️ ¡Cuidado antes de cortar telas resbaladizas!",
        texto: "No cortes gasa, satén ni seda fría con la tela colgando fuera de la mesa: el propio peso del rollo hala la tela y deforma las curvas. Apoya todo el tramo sobre la mesa y usa pesas o alfileres finos cada 5 cm.",
      },
    ],
    accionGenerador: {
      label: "Abrir el Generador con esta prenda →",
      description:
        "Elige entre tela normal o tela elástica en el Paso 2 del Generador para que las holguras se ajusten solas.",
      href: "/?prenda=vestido&estilo=boho_ruffle_dress",
    },
  },
  {
    slug: "como-imprimir-moldes-pdf-en-casa-sin-descuadrar",
    titulo:
      "Cómo imprimir moldes PDF en casa (Carta y A4) y armarlos sin que se descuadren ni 1 milímetro",
    subtitulo:
      "El protocolo de taller en 6 pasos para verificar el cuadro de 5×5 cm y unir tus hojas en minutos sin sorpresas de talla.",
    categoria: "Trucos de Taller",
    tiempoLectura: "5 min",
    fecha: "2026-11-13",
    resumenSEO:
      "Checklist interactivo y diagrama para imprimir moldes PDF a escala 100% en hojas Carta o A4 y comprobar el cuadro de 5x5 cm.",
    palabrasClave: [
      "imprimir moldes pdf tamaño real",
      "escala 100 por ciento pdf costura",
      "armar patron pdf carta a4",
      "cuadro de prueba molde",
    ],
    contenidoEstructurado: [
      {
        type: "resumen_rapido",
        puntos: [
          "Imprime primero solo la Hoja 1 y mide el cuadro de control con regla: debe medir 5.0 × 5.0 cm exactos.",
          "En las opciones de tu impresora marca siempre 'Tamaño real' o 'Escala: 100%' (jamás 'Ajustar a página').",
          "Recorta únicamente el margen superior e izquierdo de cada hoja y únelas guiándote por las coordenadas F1-C1.",
        ],
      },
      {
        type: "parrafo",
        texto: "Si dejas activada la opción por defecto de la impresora ('Ajustar al área de impresión'), el programa encoge todas las hojas un 7% u 8%. Parece poco en una hoja, pero en un vestido representa perder una talla entera.",
      },
      {
        type: "ilustracion_svg",
        tipo: "cuadro-calibracion",
        titulo: "La prueba reina antes de gastar papel: el cuadro de 5.0 × 5.0 cm",
        nota: "Si tu regla marca 4.6 o 4.8 cm, cambia el ajuste de escala de tu impresora a 'Tamaño real' o '100%' antes de imprimir el resto.",
      },
      {
        type: "subtitulo",
        texto: "Sigue este checklist en tu mesa mientras armas el molde",
      },
      {
        type: "widget_interactivo",
        widget: "checklist_impresion",
      },
      {
        type: "truco_taller",
        titulo: "💡 Truco de Taller: Pegamento en barra en las esquinas",
        texto: "En lugar de gastar rollos de cinta adhesiva (que brilla y desafila las tijeras), pasa pegamento escolar en barra sobre la pestaña de unión y pon solo un pedacito de cinta de papel en los cruces de las líneas del molde.",
      },
      {
        type: "alerta_tijera",
        titulo: "⚠️ ¡Cuidado antes de cortar el papel!",
        texto: "No mezcles formato Carta y A4. Si en tu casa compras resmas tamaño Carta (común en Colombia y México), asegúrate de que en el Paso 3 de MoldeFácil esté marcado el botón 'Hoja Carta' antes de descargar el PDF.",
      },
    ],
    accionGenerador: {
      label: "Abrir el Generador con esta prenda →",
      description:
        "Activa el botón 'Ver cuadrícula de hojas' sobre el lienzo del Generador para previsualizar el armado exacto en Carta o A4.",
      href: "/?prenda=vestido&estilo=camisero",
    },
  },
  {
    slug: "formula-exacta-faldas-circulares-plato-medio-doble",
    titulo:
      "Fórmula exacta para cortar faldas circulares (Plato, Medio Plato y Doble Plato) sin desperdiciar tela",
    subtitulo:
      "Calcula el radio de cintura sin miedo a las matemáticas y aprende cómo doblar la tela para que no se deforme al sesgo.",
    categoria: "Patronaje",
    tiempoLectura: "6 min",
    fecha: "2026-11-14",
    resumenSEO:
      "Tabla de radios de cintura y guía de corte al doblez para faldas cuarto de plato, medio plato, plato completo y doble plato.",
    palabrasClave: [
      "formula falda circular",
      "falda plato radio cintura",
      "falda medio plato cuanta tela",
      "falda doble plato medidas",
    ],
    contenidoEstructurado: [
      {
        type: "resumen_rapido",
        puntos: [
          "Medio plato (180°): divide tu cintura entre 3.14 y réstale 1 cm para compensar el estiramiento al sesgo.",
          "Plato completo (360°): divide tu cintura entre 6.28 (por ejemplo, para 72 cm de cintura el radio es 10.5 cm).",
          "Cuelga la falda 24 horas en un gancho antes de doblar y coser el ruedo.",
        ],
      },
      {
        type: "parrafo",
        texto: "Las faldas circulares favorecen todas las siluetas porque no llevan pinzas en la cintura ni abultan la cadera. Todo el secreto consiste en clavar el inicio de tu cinta métrica en la esquina de la tela doblada y usarla como un compás.",
      },
      {
        type: "tabla_comparativa",
        titulo: "Tabla lista de radios de cintura (ya incluye descuento anti-sesgo)",
        encabezados: [
          "Cintura real",
          "Cuarto plato (90°)",
          "Medio plato (180°)",
          "Plato entero (360°)",
          "Doble plato (720°)",
        ],
        filas: [
          ["64 cm (XS)", "39.5 cm", "19.4 cm", "9.2 cm", "4.5 cm (×2 círculos)"],
          ["72 cm (S/M)", "44.5 cm", "21.9 cm", "10.5 cm", "5.1 cm (×2 círculos)"],
          ["80 cm (L)", "49.5 cm", "24.5 cm", "11.7 cm", "5.7 cm (×2 círculos)"],
          ["90 cm (XL)", "56.0 cm", "27.6 cm", "13.3 cm", "6.5 cm (×2 círculos)"],
          ["100 cm (XXL)", "62.4 cm", "30.8 cm", "14.9 cm", "7.3 cm (×2 círculos)"],
        ],
      },
      {
        type: "subtitulo",
        texto: "Cómo apoyar el molde sobre el doblez sin añadir centímetros de más",
      },
      {
        type: "ilustracion_svg",
        tipo: "doblez-tela",
        titulo: "El borde recto va pegado al doblez de la tela",
        nota: "Al cortar medio plato en una sola pieza sin costuras laterales, apoya un lado sobre el doblez y deja margen de 1.5 cm únicamente en el borde opuesto donde irá el cierre.",
      },
      {
        type: "alerta_tijera",
        titulo: "⚠️ ¡Cuidado antes de cortar la curva de cintura!",
        texto: "No estires la curva recién cortada para 'medir si quedó bien'. Como el arco pasa por el bies de la tela, si lo halas con las manos cederá hasta 4 cm antes de ponerle la pretina.",
      },
      {
        type: "truco_taller",
        titulo: "💡 Truco de Taller: Costura de retención a los 2 minutos de cortar",
        texto: "Apenas retires el molde, pasa una costura recta normal a 0.5 cm del borde de la cintura de extremo a extremo sin rematar ni fruncir. Ese hilo sujeta las fibras diagonales y garantiza que la cintura conserve tu medida exacta.",
      },
    ],
    accionGenerador: {
      label: "Abrir el Generador con esta prenda →",
      description:
        "Descarga el patrón listo de Falda Circular a tu medida o calcula cualquier vuelo en nuestra calculadora de Mi Taller.",
      href: "/?prenda=falda&estilo=circular",
      secondaryLink: {
        label: "Abrir Calculadora de Faldas Circulares",
        href: "/taller?tab=falda",
      },
    },
  },
  {
    slug: "como-ponerle-precio-justo-a-tu-trabajo-de-costura",
    titulo:
      "Cómo ponerle precio justo a tu trabajo de costura y calcular tu ganancia real por hora",
    subtitulo:
      "La fórmula clara en 4 bloques para que cada prenda pague tus materiales, tu tiempo real, el desgaste de tu máquina y deje ganancia limpia.",
    categoria: "Negocio y Precios",
    tiempoLectura: "6 min",
    fecha: "2026-11-15",
    resumenSEO:
      "Fórmula paso a paso para cobrar trabajos de costura y confección a medida calculando materiales, mano de obra, costos fijos y margen.",
    palabrasClave: [
      "cuanto cobrar por coser",
      "como poner precio ropa a medida",
      "cotizar costura",
      "ganancia taller de costura",
    ],
    contenidoEstructurado: [
      {
        type: "resumen_rapido",
        puntos: [
          "Nunca cobres 'el doble de la tela': si la clienta trae una tela barata pero difícil de coser, pierdes dinero.",
          "Suma siempre 4 bloques: Materiales + (Horas totales × tu valor hora) + 15% desgaste fijo + 25% utilidad del taller.",
          "Pide siempre el 50% de anticipo al tomar medidas para cubrir insumos y asegurar el compromiso.",
        ],
      },
      {
        type: "parrafo",
        texto: "El error que más quema a las modistas independientes es contar únicamente las horas sentadas en la máquina. Atender a la clienta, trazar el molde, tender la tela, cortar con precisión, hilvanar, hacer la prueba y planchar también es trabajo profesional.",
      },
      {
        type: "subtitulo",
        texto: "Desglose real de tiempos que sí debes cobrar",
      },
      {
        type: "tabla_comparativa",
        titulo: "Tiempo promedio real por prenda a medida (incluyendo corte y prueba)",
        encabezados: [
          "Prenda",
          "Molde y corte",
          "Costura, prueba y plancha",
          "Total horas a cobrar",
        ],
        filas: [
          ["Falda recta o circular básica", "0.8 h", "2.0 h", "2.8 a 3.0 horas"],
          ["Blusa con vistas o cuello", "1.0 h", "2.5 h", "3.5 horas"],
          ["Pantalón a medida con bolsillos", "1.2 h", "3.5 h", "4.7 a 5.0 horas"],
          ["Vestido cruzado o camisero", "1.5 h", "4.0 h", "5.5 horas"],
          ["Conjunto sastre (Blusa + Palazzo)", "2.0 h", "5.5 h", "7.5 horas"],
        ],
      },
      {
        type: "truco_taller",
        titulo: "💡 Truco de Taller: Separa tu sueldo de la ganancia del taller",
        texto: "Tu pago por hora es tu sueldo como costurera. El 25% de margen adicional es la ganancia de tu taller como negocio: es el fondo que te permite comprar una fileteadora nueva, tijeras profesionales o tomarte vacaciones.",
      },
      {
        type: "ilustracion_svg",
        tipo: "hilo-tela",
        titulo: "Cortar bien a la primera ahorra horas de descoser",
        nota: "Dedicar 3 minutos a medir el hilo de la tela evita tener que desarmar costados torcidos durante la prueba con la clienta.",
      },
      {
        type: "alerta_tijera",
        titulo: "⚠️ ¡Cuidado antes de cortar sin anticipo!",
        texto: "Jamás cortes una tela (ni siquiera si la trajo la clienta) sin haber dejado por escrito en WhatsApp el modelo acordado, la fecha de prueba y el abono del 50% recibido.",
      },
    ],
    accionGenerador: {
      label: "Abrir el Generador con esta prenda →",
      description:
        "Reduce tu tiempo de patronaje de 1 hora a 2 minutos con el Generador y arma el presupuesto listo para WhatsApp en Mi Taller.",
      href: "/?prenda=conjunto&estilo=sastre",
      secondaryLink: {
        label: "Abrir Cotizador de Costura en Mi Taller",
        href: "/taller?tab=cotizador",
      },
    },
  },
  {
    slug: "guia-acabados-limpios-vistas-sesgos-dobladillos",
    titulo:
      "Guía de acabados limpios: Cómo coser vistas de escote, sesgos y dobladillos invisibles",
    subtitulo:
      "Los 3 secretos de taller (piquetes en V, pespunte de carga y plancha por pasos) para que tus cuellos y sisas luzcan de tienda fina.",
    categoria: "Trucos de Taller",
    tiempoLectura: "6 min",
    fecha: "2026-11-16",
    resumenSEO:
      "Aprende con diagramas Sí vs No cómo hacer piquetes en curvas, pespunte de carga en vistas y dobladillos finos sin ondas.",
    palabrasClave: [
      "como coser vista de escote",
      "poner sesgo en escote y sisas",
      "dobladillo invisible a mano o maquina",
      "pespunte de carga costura",
    ],
    contenidoEstructurado: [
      {
        type: "resumen_rapido",
        puntos: [
          "Toda costura curva (escote o sisa) necesita piquetes cada 1.5 cm antes de voltear la tela.",
          "Pasa siempre un pespunte de carga ('understitch') a 2 mm sobre la vista sujetando los márgenes internos.",
          "En telas fluidas haz dobladillo pañuelo en 2 pasadas con plancha intermedia para que no se retuerza.",
        ],
      },
      {
        type: "parrafo",
        texto: "Cuando una vista de escote se asoma hacia afuera o forma pequeños picos alrededor del cuello, no es culpa de tu pulso al coser: es porque el margen interno tiene un recorrido distinto al de la prenda y necesita liberar tensión.",
      },
      {
        type: "ilustracion_svg",
        tipo: "piquetes-curvas",
        titulo: "Sí vs. No: Por qué los piquetes transforman cualquier escote",
        nota: "Usa la punta de tu tijera bien afilada para cortar pequeños triángulos llegando a 2 mm de la costura, sin tocar jamás el hilo.",
      },
      {
        type: "subtitulo",
        texto: "Qué acabado elegir según la tela de tu proyecto",
      },
      {
        type: "tabla_comparativa",
        titulo: "Comparativa de acabados para escotes, sisas y bajos",
        encabezados: ["Zona de la prenda", "Acabado ideal", "Cuándo usarlo"],
        filas: [
          [
            "Escote redondo, V o cuadrado",
            "Vista interna con entretela + pespunte de carga",
            "Vestidos y blusas en lino, popelina, crepé o viscosa.",
          ],
          [
            "Sisas sin manga y escotes finos",
            "Sesgo oculto de la misma tela (cortado a 45°)",
            "Gasa, chalis, blusas livianas y ropa infantil.",
          ],
          [
            "Ruedo en falda circular o fluida",
            "Dobladillo pañuelo (0.5 cm + 0.5 cm)",
            "Evita las arrugas que deja un dobladillo ancho en curva.",
          ],
          [
            "Bota de pantalón sastre o falda recta",
            "Dobladillo de 3 a 4 cm con puntada invisible",
            "Gabardina, paño, lino pesado y crepé sastre.",
          ],
        ],
      },
      {
        type: "truco_taller",
        titulo: "💡 Truco de Taller: El pespunte de carga que nadie ve",
        texto: "Después de hacer los piquetes, abre la vista, empuja ambos márgenes de costura hacia el lado de la vista y pasa una costura recta por el derecho de la vista a 2 mm de la unión. Al doblar hacia adentro, la costura queda oculta 1 milímetro por detrás del borde.",
      },
      {
        type: "alerta_tijera",
        titulo: "⚠️ ¡Cuidado antes de cortar tiras de sesgo!",
        texto: "Una tira cortada al hilo recto NO sirve para bordear un escote curvo porque no cede y dejará el cuello levantado. Dóblala siempre a 45° exactos (diagonal perfecta entre orillo y trama).",
      },
    ],
    accionGenerador: {
      label: "Abrir el Generador con esta prenda →",
      description:
        "Genera el molde de Blusa Campesina o de Oficina con su guía de armado e insumos detallados paso a paso.",
      href: "/?prenda=blusa&estilo=campesina",
    },
  },
  {
    slug: "como-adaptar-molde-basico-mangas-kimono-imperio-blusado",
    titulo:
      "Cómo adaptar un molde básico para lograr mangas kimono, cortes imperio o caída blusada",
    subtitulo:
      "Multiplica tu catálogo de diseños modificando tres líneas simples sobre tu patrón base de confianza.",
    categoria: "Patronaje",
    tiempoLectura: "7 min",
    fecha: "2026-11-17",
    resumenSEO:
      "Guía práctica de transformación de patrones: cómo pasar de un molde básico a manga kimono, corte imperio bajo busto o efecto blusado.",
    palabrasClave: [
      "transformacion molde manga kimono",
      "corte imperio patronaje",
      "adaptar molde basico vestido",
      "caida blusada cintura",
    ],
    contenidoEstructurado: [
      {
        type: "resumen_rapido",
        puntos: [
          "Manga kimono: prolonga la línea de hombro de 18 a 25 cm, baja 2 cm en la punta y suaviza la curva de axila.",
          "Corte imperio: corta el molde horizontalmente de 8 a 10 cm bajo el punto del busto y añade margen a ambas piezas.",
          "Caída blusada: suma +4 cm al largo del talle y deja +5 cm de holgura en cintura para recoger con elástico o lazo.",
        ],
      },
      {
        type: "parrafo",
        texto: "El secreto de los talleres rentables es no empezar desde cero en cada pedido. Cuando tienes una base cuyas medidas de busto, espalda y cintura ya comprobaste, cualquier diseño de tendencia es solo un ajuste geométrico.",
      },
      {
        type: "ilustracion_svg",
        tipo: "doblez-tela",
        titulo: "Mantén siempre el centro del corpiño alineado al doblez",
        nota: "Aunque modifiques hombro, sisa o cintura, la línea central del delantero (salvo que sea cruzado o con botones) se conserva recta sobre el doblez.",
      },
      {
        type: "subtitulo",
        texto: "Tabla de medidas exactas para transformar tu base",
      },
      {
        type: "tabla_comparativa",
        titulo: "Cuánto mover cada línea según el efecto que buscas",
        encabezados: ["Transformación", "Ajuste en hombro / sisa", "Ajuste en cintura / talle", "Tela ideal"],
        filas: [
          [
            "Manga Kimono corta",
            "Extiende hombro +18 cm, baja 2 cm y haz curva amplia en costado",
            "Holgura +3 cm por costado para levantar el brazo cómoda",
            "Viscosa, rayón, lino liviano",
          ],
          [
            "Corte Imperio romántico",
            "Conserva sisa normal o combina con manga globo",
            "Corta a 8–10 cm bajo el pezón; falda evasé o fruncida",
            "Popelina, gasa forrada, satén",
          ],
          [
            "Talle Blusado con cinturón",
            "Sisa 1.5 cm más baja para mayor soltura",
            "Alarga el talle +4 cm para que forme bolsa elegante sobre la cintura",
            "Chalis, crepé, seda fría",
          ],
          [
            "Frente Cruzado (Wrap)",
            "Cruza el escote en V hasta el costado opuesto de la cintura",
            "Corta 2 delanteros completos (ya no va al doblez)",
            "Tejido de punto o viscosa fluida",
          ],
        ],
      },
      {
        type: "truco_taller",
        titulo: "💡 Truco de Taller: Curva suave bajo la axila en mangas kimono",
        texto: "En las mangas kimono nunca dejes un ángulo recto entre el bajo de la manga y el costado de la blusa, porque tirará al levantar el brazo. Dibuja una curva redondeada de al menos 6 cm de radio y hazle 3 piquetes después de coser.",
      },
      {
        type: "ilustracion_svg",
        tipo: "piquetes-curvas",
        titulo: "Haz piquetes en la curva bajo el brazo de tu manga kimono",
        nota: "Al igual que en el escote, esos 3 pequeños cortes bajo la axila evitan que la manga haga arrugas cuando bajas el brazo.",
      },
    ],
    accionGenerador: {
      label: "Abrir el Generador con esta prenda →",
      description:
        "En MoldeFácil estas transformaciones ya están programadas: cámbialas en 1 clic sin redibujar en papel.",
      href: "/?prenda=vestido&estilo=imperio",
    },
  },
];

export function getBlogPostBySlug(slug: string): BlogPost | undefined {
  return BLOG_POSTS.find((post) => post.slug === slug);
}
