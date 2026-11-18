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

export type BlogContentBlock =
  | {
      type: "heading";
      text: string;
    }
  | {
      type: "paragraph";
      text: string;
    }
  | {
      type: "tip";
      title: string;
      text: string;
      tone?: "teal" | "rose" | "amber";
    }
  | {
      type: "checklist";
      title: string;
      items: string[];
    }
  | {
      type: "table";
      caption: string;
      headers: string[];
      rows: string[][];
    }
  | {
      type: "interactiveFabricTable";
      title: string;
      note: string;
    }
  | {
      type: "svgDiagram";
      diagram: SvgDiagramKind;
      title: string;
      caption: string;
    };

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
  contenidoEstructurado: BlogContentBlock[];
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
      "Deja de gastar dinero de más en el almacén de telas o quedarte corta a mitad del corte. Compara rollos de 140 cm y 150 cm en segundos.",
    categoria: "Telas y Materiales",
    tiempoLectura: "6 min",
    fecha: "2026-11-10",
    resumenSEO:
      "Guía práctica y tabla interactiva para calcular exactamente cuántos metros de tela comprar de la talla XS a la XL según el ancho del rollo (140 cm o 150 cm).",
    palabrasClave: [
      "cuánta tela comprar",
      "metros de tela por talla",
      "ancho de tela 140 150 cm",
      "calcular tela vestido blusa pantalon",
    ],
    contenidoEstructurado: [
      {
        type: "paragraph",
        text: "Una de las preguntas que más estrés genera frente al mostrador de telas es: '¿Con metro y medio me alcanza o mejor llevo dos metros?'. Si compras de menos, pierdes el proyecto entero porque cuando vuelves por otro pedazo el tono del rollo ya cambió. Si compras de más, terminas con bolsas llenas de retazos caros que nunca usas.",
      },
      {
        type: "paragraph",
        text: "La cantidad exacta depende de tres cosas: tu talla (sobre todo el contorno de cadera y busto), el largo de la prenda y el ancho útil del rollo. La gran mayoría de telas de moda vienen de 140 cm o 150 cm de ancho, y esos 10 centímetros de diferencia determinan si dos piezas caben lado a lado o si tienes que comprar un largo extra.",
      },
      {
        type: "interactiveFabricTable",
        title: "Calculadora rápida: Elige tu talla y el ancho de la tela",
        note: "Los valores incluyen margen de costura estándar (1 a 1.5 cm) y tolerancia para encuadrar el hilo de la tela.",
      },
      {
        type: "heading",
        text: "3 casos en los que SÍ debes sumar de 25 a 50 cm extra",
      },
      {
        type: "checklist",
        title: "Checklist antes de pagar en el almacén",
        items: [
          "Telas que encogen (lino, algodón 100%, rayón o chalis): suma 15 cm extra por cada metro para poder prelavar la tela antes de cortar.",
          "Estampados con dirección, cuadros grandes o rayas: necesitarás mover las piezas para casar las líneas en costados y centros (+30 a +50 cm).",
          "Telas con pelo o brillo unidireccional (terciopelo, pana, satén pesado): todas las piezas deben cortarse mirando hacia el mismo lado, nunca invertidas.",
          "Detalles extra como bolsillos grandes, vuelos/boleros en el bajo, mangas globo o cinturones largos (+30 a +60 cm).",
        ],
      },
      {
        type: "tip",
        title: "Truco de taller para ahorrar tela sin perder calidad",
        text: "Si vas a hacer una blusa o vestido en talla L o XL y la tela mide solo 140 cm, no dobles la tela exactamente por la mitad. Dóblala de forma asimétrica solo al ancho que necesita la pieza del delantero o la espalda; así dejas una franja lateral entera para cortar mangas, cuello, vista y cinturón.",
        tone: "teal",
      },
    ],
    accionGenerador: {
      label: "Hacer este molde con mis medidas ahora →",
      description:
        "MoldeFácil calcula en tiempo real los metros exactos de tela (140 cm y 150 cm) con tus medidas reales antes de ir a comprar.",
      href: "/?prenda=vestido&estilo=cruzado",
      secondaryLink: {
        label: "Probar Simulador de Plan de Corte",
        href: "/taller?tab=corte",
      },
    },
  },
  {
    slug: "como-tomar-10-medidas-corporales-sin-ayuda",
    titulo:
      "Cómo tomar las 10 medidas corporales exactas sin ayuda (Guía paso a paso)",
    subtitulo:
      "Un molde perfecto empieza por una cinta métrica bien puesta. Aprende dónde medir sin apretar, frente al espejo y con resultados repetibles.",
    categoria: "Patronaje",
    tiempoLectura: "7 min",
    fecha: "2026-11-11",
    resumenSEO:
      "Aprende a tomarte sola las 10 medidas esenciales de costura (busto, cintura, cadera, talle, tiro y más) con diagrama anatómico paso a paso.",
    palabrasClave: [
      "como tomar medidas para costura",
      "medidas corporales patronaje",
      "altura de tiro",
      "largo de talle",
    ],
    contenidoEstructurado: [
      {
        type: "paragraph",
        text: "El 80% de las prendas que 'no quedan bien' fallaron antes de tocar la tijera: la cinta métrica estaba torcida en la espalda, apretaste demasiado en la cintura o mediste con ropa gruesa encima. Para lograr medidas reales, ponte ropa interior cómoda (o una licra pegada), párate frente a un espejo con postura natural y ata un cordón fino o elástico suave alrededor de tu cintura natural.",
      },
      {
        type: "svgDiagram",
        diagram: "body-measurements",
        title: "Mapa visual de las 10 medidas de MoldeFácil",
        caption:
          "Usa un elástico delgado en la cintura como punto de referencia fijo para medir talle, falda y altura de tiro sin errores.",
      },
      {
        type: "heading",
        text: "Paso a paso para cada medida (sin ayuda)",
      },
      {
        type: "table",
        caption: "Guía rápida de las 10 medidas clave",
        headers: ["Medida", "Dónde pasar la cinta", "Error más común"],
        rows: [
          [
            "1. Busto / Pecho",
            "Por la parte más saliente del busto, manteniendo la cinta horizontal en la espalda.",
            "Dejar caer la cinta atrás (resta de 2 a 4 cm reales).",
          ],
          [
            "2. Cintura",
            "Justo sobre el elástico guía, en la parte más estrecha o donde dobla el torso de lado.",
            "Meter el abdomen al medir; respira normal antes de leer.",
          ],
          [
            "3. Cadera",
            "Alrededor de la zona más prominente del glúteo (unos 18-20 cm bajo la cintura).",
            "Medir en los huesos de la cadera alta y dejar apretado el pantalón.",
          ],
          [
            "4. Ancho de espalda",
            "De hueso de hombro a hueso de hombro por detrás, o de pliegue a pliegue de axila.",
            "Encorvar los hombros hacia adelante al intentar leer el metro.",
          ],
          [
            "5. Largo de talle",
            "Desde el punto más alto del hombro (junto al cuello) pasando por el busto hasta la cintura.",
            "Medir por el costado en lugar de pasar sobre el volumen del busto.",
          ],
          [
            "6. Largo de manga",
            "Con el brazo ligeramente doblado, desde la punta del hombro pasando por el codo hasta la muñeca.",
            "Medir con el brazo estirado (al doblar el codo la manga queda corta).",
          ],
          [
            "7. Largo de falda",
            "Desde la cintura (elástico guía) por el costado hasta el largo deseado (mini, rodilla, midi).",
            "Inclinar la cabeza hacia abajo para ver la cinta (acorta el torso).",
          ],
          [
            "8. Altura de tiro",
            "Sentada recta en una silla dura: desde el elástico de la cintura hasta el asiento.",
            "Medir de pie entre las piernas sin silla (suele quedar tirante al sentarse).",
          ],
          [
            "9. Contorno de muslo",
            "Alrededor de la parte más ancha del muslo, unos 3 cm bajo la entrepierna.",
            "Apretar la cinta; deja pasar 1 dedo cómodo si la tela no estira.",
          ],
          [
            "10. Largo de pierna",
            "Desde el costado de la cintura (o desde la entrepierna para entrepierna) hasta el tobillo.",
            "Medir descalza si vas a usar el pantalón con tacón o plataforma.",
          ],
        ],
      },
      {
        type: "tip",
        title: "El secreto infalible de la silla para el tiro del pantalón",
        text: "Para acertar el tiro sin ayuda, siéntate con la espalda recta en una silla de madera o plástico plana (no un sofá blando). Apoya la punta metálica del metro en el asiento al costado de tu cadera y sube hasta el cordón de tu cintura. Esa cifra exacta (por ejemplo 26 o 28 cm) garantiza que el pantalón no tire ni haga bolsas incómodas.",
        tone: "rose",
      },
    ],
    accionGenerador: {
      label: "Hacer este molde con mis medidas ahora →",
      description:
        "Introduce estas 10 medidas en el Paso 2 del Generador y mira cómo las curvas del molde se ajustan a tu cuerpo en vivo.",
      href: "/?prenda=blusa&estilo=oficina",
      secondaryLink: {
        label: "Guardar medidas de clientas en Mi Taller",
        href: "/taller?tab=libreta",
      },
    },
  },
  {
    slug: "diccionario-telas-costureras-agujas-puntadas",
    titulo:
      "Diccionario de telas para costureras: Rígidas, con caída y elásticas (y qué aguja usar en cada una)",
    subtitulo:
      "¿La máquina se salta puntadas o frunce la costura? Casi nunca es la máquina: es usar la aguja equivocada para esa tela.",
    categoria: "Telas y Materiales",
    tiempoLectura: "7 min",
    fecha: "2026-11-12",
    resumenSEO:
      "Aprende a distinguir telas planas, con caída y elásticas, y consulta la tabla exacta de calibre de agujas (70/10 a 100/16) y puntadas recomendadas.",
    palabrasClave: [
      "que aguja usar para cada tela",
      "telas rigidas y elasticas",
      "aguja punta de bola",
      "calibre aguja maquina coser",
    ],
    contenidoEstructurado: [
      {
        type: "paragraph",
        text: "En MoldeFácil te pedimos elegir entre 'Tela rígida (tejido plano)' y 'Tela elástica (punto/licra)' porque el comportamiento de las fibras cambia por completo las holguras del patrón. Una tela rígida necesita pinzas y centímetros extra para respirar y mover los brazos; una tela elástica abraza el cuerpo y a veces incluso requiere restar holgura.",
      },
      {
        type: "heading",
        text: "Los 3 grandes grupos de telas que debes dominar",
      },
      {
        type: "checklist",
        title: "Cómo identificarlas al tacto en 5 segundos",
        items: [
          "1. Tejido plano firme (sin caída): Popelina, lino grueso, drill, gabardina, denim, tafetán. Mantienen la forma por sí solas y marcan muy bien los pliegues y cuellos.",
          "2. Tejido plano con caída fluida: Rayón, chalis, viscosa, crepé georgette, gasa, seda poliéster. No estiran al halarlas a lo ancho, pero caen pegadas al cuerpo haciendo ondas suaves.",
          "3. Tejido de punto o elástico: Jersey de algodón, rib, suplex, licra, scuba, punto roma. Se estiran al menos un 20% a lo ancho y recuperan su forma al soltarlas.",
        ],
      },
      {
        type: "table",
        caption: "Tabla maestra de agujas (70/10 a 100/16) y puntadas",
        headers: [
          "Tipo de tela",
          "Calibre y punta de aguja",
          "Puntada y largo ideal",
        ],
        rows: [
          [
            "Gasa, chifón, seda fina, tul",
            "Universal o Microtex 70/10 (fina)",
            "Recta corta: 1.8 – 2.0 mm (evita que frunza)",
          ],
          [
            "Popelina, lino, rayón, chalis, crepé",
            "Universal 80/12",
            "Recta estándar: 2.5 mm",
          ],
          [
            "Jersey, algodón licrado, rib, pijamas",
            "Punta de bola (Ballpoint / Jersey) 75/11 u 80/12",
            "Zigzag angosto (ancho 1.5, largo 2.5 mm) o puntada elástica",
          ],
          [
            "Licra deportiva, suplex, trajes de baño",
            "Stretch (Super Stretch) 75/11 o 90/14",
            "Zigzag 3 pasos o zigzag suave + hilo poliéster resistente",
          ],
          [
            "Gabardina, drill, pana, lino pesado",
            "Universal o Jeans 90/14",
            "Recta 2.8 – 3.0 mm",
          ],
          [
            "Denim grueso, lona, costuras con varias capas",
            "Jeans / Denim 100/16",
            "Recta larga 3.0 – 3.5 mm (puedes usar hilo de pespunte)",
          ],
        ],
      },
      {
        type: "tip",
        title: "Regla de oro antes de empezar un proyecto nuevo",
        text: "Cambia la aguja cada 8 horas de costura continua o cada 2 prendas grandes. Una aguja con la punta micro-doblada pica los hilos de la tela de punto y crea carreras o huequitos después de la primera lavada.",
        tone: "amber",
      },
    ],
    accionGenerador: {
      label: "Hacer este molde con mis medidas ahora →",
      description:
        "Prueba un Vestido Cruzado en tela fluida o cambia a tela elástica en el Paso 2 para ver cómo el generador recalcula la holgura.",
      href: "/?prenda=vestido&estilo=boho_ruffle_dress",
    },
  },
  {
    slug: "como-imprimir-moldes-pdf-en-casa-sin-descuadrar",
    titulo:
      "Cómo imprimir moldes PDF en casa (Carta y A4) y armarlos sin que se descuadren ni 1 milímetro",
    subtitulo:
      "El paso a paso para configurar tu impresora a escala real 100%, comprobar el cuadro de prueba y pegar las hojas como un plano profesional.",
    categoria: "Trucos de Taller",
    tiempoLectura: "5 min",
    fecha: "2026-11-13",
    resumenSEO:
      "Evita que tus moldes impresos salgan más pequeños o más grandes. Aprende a imprimir PDF a escala 100% (tamaño real) en hojas Carta o A4.",
    palabrasClave: [
      "imprimir moldes pdf tamaño real",
      "escala 100 por ciento pdf costura",
      "armar patron pdf carta a4",
      "cuadro de prueba molde",
    ],
    contenidoEstructurado: [
      {
        type: "paragraph",
        text: "No hay nada más frustrante que imprimir 12 hojas, pegarlas con cinta y darte cuenta cuando terminas que el cuadro de prueba mide 4.6 cm en vez de 5.0 cm. Eso significa que toda la prenda salió un 8% más pequeña — en una cintura de 72 cm acabas perdiendo casi 6 centímetros.",
      },
      {
        type: "svgDiagram",
        diagram: "pdf-tiling",
        title: "Cómo comprobar la escala y empatar las hojas sin errores",
        caption:
          "Siempre imprime primero únicamente la hoja que contiene el cuadro de verificación y mídelo con regla física antes de imprimir el resto.",
      },
      {
        type: "heading",
        text: "Configuración obligatoria al darle a 'Imprimir'",
      },
      {
        type: "checklist",
        title: "4 clics que salvan cualquier impresión",
        items: [
          "1. Abre el PDF descargado en Adobe Acrobat Reader o directamente desde Chrome/Edge/Brave (evita imprimir desde vistas previas de WhatsApp en el celular porque suelen reescalar).",
          "2. En Tamaño / Escala selecciona 'Tamaño real' o 'Escala personalizada: 100%'. Nunca dejes marcado 'Ajustar a la página' ni 'Reducir páginas grandes'.",
          "3. Verifica que el formato de papel elegido en MoldeFácil (Carta o A4) sea exactamente el mismo papel que pusiste en la bandeja de tu impresora.",
          "4. Mide el cuadro de calibración (por ejemplo 5 × 5 cm o 10 × 10 cm): si mide exacto, ya puedes imprimir todas las páginas restantes.",
        ],
      },
      {
        type: "table",
        caption: "Diferencia práctica entre papel Carta y A4 al armar moldes",
        headers: ["Formato", "Medidas reales", "Dónde se usa más", "Consejo de armado"],
        rows: [
          [
            "Carta (US Letter)",
            "21.59 × 27.94 cm",
            "Colombia, México, EE. UU., Centroamérica y parte de Sudamérica",
            "Recorta solo el borde derecho e inferior de cada hoja antes de sobreponer.",
          ],
          [
            "A4",
            "21.00 × 29.70 cm",
            "España, Argentina, Chile, Uruguay y Europa",
            "Alinea las marcas de esquina (cruces o números de fila/columna) sobre una ventana con luz.",
          ],
        ],
      },
      {
        type: "tip",
        title: "Usa pegamento en barra en lugar de solo cinta pegante",
        text: "La cinta transparente brilla y a veces resbala la tijera o se derrite si pasas la plancha cerca. Un toque rápido de pegamento en barra escolar en el borde superpuesto deja las hojas planas como un solo pliego grande y puedes recortar encima con total suavidad.",
        tone: "teal",
      },
    ],
    accionGenerador: {
      label: "Hacer este molde con mis medidas ahora →",
      description:
        "En el Paso 3 de MoldeFácil puedes activar la vista de 'Cuadrícula de hojas' para ver exactamente cuántas hojas Carta o A4 ocupará tu molde antes de descargarlo.",
      href: "/?prenda=vestido&estilo=camisero",
    },
  },
  {
    slug: "formula-exacta-faldas-circulares-plato-medio-doble",
    titulo:
      "Fórmula exacta para cortar faldas circulares (Plato, Medio Plato y Doble Plato) sin desperdiciar tela",
    subtitulo:
      "Domina la geometría de una buena vez: calcula el radio perfecto de cintura con pi (π) y evita que la cintura quede enorme por cortar al sesgo.",
    categoria: "Patronaje",
    tiempoLectura: "6 min",
    fecha: "2026-11-14",
    resumenSEO:
      "Fórmula matemática fácil para calcular el radio de cintura en faldas cuarto de plato, medio plato, plato completo y doble plato sin errores.",
    palabrasClave: [
      "formula falda circular",
      "falda plato radio cintura",
      "falda medio plato cuanta tela",
      "falda doble plato medidas",
    ],
    contenidoEstructurado: [
      {
        type: "paragraph",
        text: "Cortar una falda circular directamente sobre la tela doblada da vértigo si no entiendes de dónde sale ese número del 'radio de cintura'. Pero en realidad es pura aritmética de escuela aplicada al vestido más bonito y vendible de cualquier taller.",
      },
      {
        type: "svgDiagram",
        diagram: "circle-skirt-formula",
        title: "Esquema geométrico: Radio de cintura (R) y Largo (L)",
        caption:
          "El compás improvisado con tu cinta métrica gira desde la esquina superior derecha trazando primero R (cintura) y luego R + Largo (ruedo).",
      },
      {
        type: "table",
        caption: "Fórmulas exactas según el vuelo elegido (C = Contorno de cintura)",
        headers: [
          "Tipo de vuelo",
          "Fórmula del Radio (R)",
          "Ejemplo para cintura 72 cm",
          "Caída y uso ideal",
        ],
        rows: [
          [
            "Cuarto de plato (90°)",
            "R = (C × 2) ÷ π",
            "45.8 cm (sin margen)",
            "Vuelo sutil, elegante para oficina y telas con cuerpo.",
          ],
          [
            "Medio plato (180°)",
            "R = C ÷ π",
            "22.9 cm (sin margen)",
            "Vuelo medio equilibrado; entra en una sola pieza doblada en telas de 150 cm.",
          ],
          [
            "Plato completo (360°)",
            "R = C ÷ (2 × π)",
            "11.5 cm (sin margen)",
            "Giro amplio tipo años 50; requiere más tela si el largo supera 60 cm.",
          ],
          [
            "Doble plato (720°)",
            "R = C ÷ (4 × π)",
            "5.7 cm por cada círculo",
            "Máximo volumen para vestidos de fiesta o baile (2 círculos unidos en costados).",
          ],
        ],
      },
      {
        type: "tip",
        title: "Cuidado con el estiramiento al sesgo en la cintura",
        text: "El arco de la cintura queda cortado en gran parte al sesgo (diagonal al hilo de la tela) y tiende a ceder 2 o 3 cm mientras manipulas la tela. Por eso conviene restar 1 cm al radio al marcar la curva (ya incluido en nuestra calculadora) y pasar una costura recta de refuerzo justo a 0.5 cm del borde antes de coser la pretina.",
        tone: "rose",
      },
      {
        type: "paragraph",
        text: "Además, recuerda dejar colgada la falda 24 horas en un gancho antes de cortar e igualar el dobladillo: las zonas que caen al sesgo se estiran por gravedad hacia abajo y así evitas picos desiguales.",
      },
    ],
    accionGenerador: {
      label: "Hacer este molde con mis medidas ahora →",
      description:
        "Genera ahora el molde completo de Falda Circular con pretina incluida o usa nuestra Calculadora Geométrica interactiva en Mi Taller.",
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
      "Cobrar 'a ojo' o igual que la competencia te hace trabajar gratis. Aprende la fórmula profesional para cubrir materiales, luz, agujas y dejar utilidad real.",
    categoria: "Negocio y Precios",
    tiempoLectura: "6 min",
    fecha: "2026-11-15",
    resumenSEO:
      "Guía financiera práctica para modistas y talleres de costura: cómo cobrar mano de obra, costos fijos, insumos y margen de ganancia sin regalar tu tiempo.",
    palabrasClave: [
      "cuanto cobrar por coser",
      "como poner precio ropa a medida",
      "cotizar costura",
      "ganancia taller de costura",
    ],
    contenidoEstructurado: [
      {
        type: "paragraph",
        text: "Muchas modistas talentosas terminan agotadas a fin de mes sin entender por qué no les queda dinero si tuvieron trabajo todos los días. El culpable casi siempre es el mismo: cobran solo el 'tiempo sentadas frente a la máquina' o duplican el precio de la tela, olvidando las horas de tomar medidas, trazar el molde, cortar, hilvanar, hacer pruebas y planchar.",
      },
      {
        type: "heading",
        text: "Los 4 pilares de una cotización profesional",
      },
      {
        type: "table",
        caption: "Qué debe incluir cada presupuesto (ejemplo real de un vestido cruzado)",
        headers: ["Concepto", "Qué abarca", "Cómo calcularlo"],
        rows: [
          [
            "1. Materiales e insumos",
            "Tela, hilo al tono, entretela, cierre, botones, elástico",
            "Suma real de factura + 5% de imprevistos en avíos.",
          ],
          [
            "2. Mano de obra real",
            "Patronaje + corte + costura + pruebas + planchado final",
            "Total de horas reales × el valor hora que merece tu experiencia.",
          ],
          [
            "3. Costos fijos del taller (15%)",
            "Electricidad, agujas, aceite, repuestos, alquiler/internet",
            "Suma un 10% a 18% sobre la base de materiales + mano de obra.",
          ],
          [
            "4. Margen de ganancia (25%)",
            "Dinero limpio para crecer, comprar maquinaria o ahorrar",
            "Tu sueldo paga tu trabajo; el margen paga al taller como negocio.",
          ],
        ],
      },
      {
        type: "checklist",
        title: "Reglas sanas para cobrar sin discusiones con el cliente",
        items: [
          "Siempre pide un abono del 50% antes de comprar tela o cortar (cubre materiales y asegura el compromiso).",
          "Incluye máximo 1 o 2 pruebas de entalle en el presupuesto; cambios completos de diseño después de cortado se cobran aparte.",
          "Nunca compitas por ser la más barata de la zona: compite por puntualidad en la entrega, acabados limpios y calce exacto.",
        ],
      },
      {
        type: "tip",
        title: "Envía cotizaciones claras y profesionales por WhatsApp",
        text: "Al cliente no le envíes tu desglose interno de porcentajes o valor por hora; envíale un mensaje limpio con el nombre de la prenda, qué incluye (patronaje a medida, insumos, pruebas, confección), tiempo de entrega y precio total.",
        tone: "teal",
      },
    ],
    accionGenerador: {
      label: "Hacer este molde con mis medidas ahora →",
      description:
        "Ahorra hasta 1 hora de trazado en cada encargo sacando la base del patrón en segundos con MoldeFácil y cotiza el trabajo en Mi Taller.",
      href: "/?prenda=conjunto&estilo=sastre",
      secondaryLink: {
        label: "Usar Cotizador '¿Cuánto cobrar por coser?'",
        href: "/taller?tab=cotizador",
      },
    },
  },
  {
    slug: "guia-acabados-limpios-vistas-sesgos-dobladillos",
    titulo:
      "Guía de acabados limpios: Cómo coser vistas de escote, sesgos y dobladillos invisibles",
    subtitulo:
      "La diferencia entre una prenda 'casera' y una de boutique está por dentro. Aprende a dar la vuelta a curvas perfectas sin arrugas ni bultos.",
    categoria: "Trucos de Taller",
    tiempoLectura: "6 min",
    fecha: "2026-11-16",
    resumenSEO:
      "Técnicas profesionales paso a paso para coser vistas con entretela, sesgo oculto, piquetes en curvas, pespunte de carga y dobladillo pañuelo o invisible.",
    palabrasClave: [
      "como coser vista de escote",
      "poner sesgo en escote y sisas",
      "dobladillo invisible a mano o maquina",
      "pespunte de carga costura",
    ],
    contenidoEstructurado: [
      {
        type: "paragraph",
        text: "Puedes haber acertado todas las medidas del cuerpo, pero si el escote se levanta hacia afuera o el dobladillo de la falda hace pliegues torcidos, la prenda pierde todo su encanto. La buena noticia es que los acabados limpios no requieren máquinas industriales costosas: solo 3 trucos de plancha y tijera.",
      },
      {
        type: "svgDiagram",
        diagram: "clean-finishes",
        title: "Anatomía de un escote impecable y un bajo bien pulido",
        caption:
          "Los piquetes en la curva y el pespunte de carga ('understitching') obligan a la tela interior a esconderse para siempre.",
      },
      {
        type: "heading",
        text: "Los 3 trucos que transforman tus acabados hoy",
      },
      {
        type: "checklist",
        title: "Paso a paso de boutique",
        items: [
          "1. Piquetes en curvas (escotes y sisas): Antes de girar una vista o sesgo, haz pequeños cortes triangulares o rectos cada 1.5 cm en el margen de costura, llegando a 2 mm del hilo sin cortarlo.",
          "2. Pespunte de carga (Understitch): Voltea el margen de costura hacia la vista (no hacia el derecho de la prenda) y pasa una costura recta a 2 mm del borde agarrando solo vista + márgenes. ¡La vista jamás volverá a asomarse por fuera!",
          "3. Dobladillo fino en telas fluidas (dobladillo pañuelo): Pasa primero una costura recta a 0.6 cm del borde, dobla siguiendo esa línea, plancha, vuelve a doblar 0.5 cm y cose pegado al doblez. Queda firme sin retorcerse.",
        ],
      },
      {
        type: "tip",
        title: "El secreto de la plancha: cose y plancha al momento",
        text: "La regla número uno de la sastrería es no cruzar nunca una costura sin haberla planchado antes. Abrir o asentar cada costura con vapor antes de unir la siguiente pieza elimina el 90% de las arrugas finales.",
        tone: "amber",
      },
    ],
    accionGenerador: {
      label: "Hacer este molde con mis medidas ahora →",
      description:
        "Cada molde de MoldeFácil incluye su guía dinámica de armado con recomendaciones exactas de telas, insumos y orden de costura.",
      href: "/?prenda=blusa&estilo=campesina",
    },
  },
  {
    slug: "como-adaptar-molde-basico-mangas-kimono-imperio-blusado",
    titulo:
      "Cómo adaptar un molde básico para lograr mangas kimono, cortes imperio o caída blusada",
    subtitulo:
      "No necesitas empezar desde cero para cada diseño nuevo: a partir de un corpiño base bien calibrado puedes crear docenas de variaciones modernas.",
    categoria: "Patronaje",
    tiempoLectura: "7 min",
    fecha: "2026-11-17",
    resumenSEO:
      "Aprende transformaciones básicas de patronaje plano: cómo sacar manga kimono sin sisa, subir el talle a corte imperio y dar caída blusada.",
    palabrasClave: [
      "transformacion molde manga kimono",
      "corte imperio patronaje",
      "adaptar molde basico vestido",
      "caida blusada cintura",
    ],
    contenidoEstructurado: [
      {
        type: "paragraph",
        text: "Cuando dominas un patrón base que te calza perfecto en hombros, pecho y cintura, ya tienes el 70% de cualquier prenda que veas en Pinterest. Los grandes talleres no redibujan todo cada temporada: aplican transformaciones geométricas sencillas sobre la misma base.",
      },
      {
        type: "svgDiagram",
        diagram: "pattern-adaptations",
        title: "3 transformaciones rápidas sobre tu patrón base",
        caption:
          "Izquierda: prolongar hombro para manga kimono. Centro: corte bajo el busto para estilo imperio. Derecha: ensanchar costado para caída blusada.",
      },
      {
        type: "table",
        caption: "Resumen rápido de cada transformación",
        headers: ["Estilo deseado", "Qué se modifica del molde básico", "Recomendación de tela"],
        rows: [
          [
            "Manga Kimono / Murciélago",
            "Extiendes la línea de hombro hacia afuera (18–25 cm) con ligera inclinación de 15° y dibujas una curva suave bajo la axila.",
            "Rayón, viscosa, lino suave o tejido de punto con caída.",
          ],
          [
            "Corte Imperio (estilo Bridgerton)",
            "Mides unos 8–10 cm bajo el pezón, trazas un corte horizontal bajo el busto y unes la falda fruncida o semicircular desde ahí.",
            "Popelina, gasa forrada, lino liviano o satén fluido.",
          ],
          [
            "Caída Blusada (Blouson)",
            "Eliminas o relajas la pinza de cintura, sumas 3–4 cm de largo al talle y recoges la cintura con elástico o jareta.",
            "Chalis, seda fría, crepé o viscosa estampada.",
          ],
        ],
      },
      {
        type: "tip",
        title: "No tengas miedo de experimentar sin papel de sobra",
        text: "En MoldeFácil puedes probar estas combinaciones en segundos sin gastar papel: cambia el tipo de manga a 'Kimono', prueba 'Holgado / Fluido' o elige directamente los diseños curados en 'Explorar Modas y Estilos'.",
        tone: "rose",
      },
    ],
    accionGenerador: {
      label: "Hacer este molde con mis medidas ahora →",
      description:
        "Abre el diseño Corte Imperio o Vestido Cruzado con manga kimono precargado en el Generador y ajústalo a tus medidas.",
      href: "/?prenda=vestido&estilo=imperio",
    },
  },
];

export function getBlogPostBySlug(slug: string): BlogPost | undefined {
  return BLOG_POSTS.find((post) => post.slug === slug);
}
