import { PatternResult } from "./types";

export interface SewingGuide {
  title: string;
  difficulty: "Principiante" | "Intermedio" | "Avanzado (Sastrería)";
  recommendedFabrics: string[];
  notions: string[];
  steps: string[];
}

export function generateSewingGuide(pattern: PatternResult): SewingGuide {
  const label = pattern.subStyleLabel.toLowerCase();
  const pieceIds = new Set(pattern.pieces.map((p) => p.id));

  // 1. ENTERIZOS Y OVEROLES
  if (pattern.category === "jumpsuit") {
    if (label.includes("overol")) {
      return {
        title: `Guía de Confección — ${pattern.subStyleLabel}`,
        difficulty: "Intermedio",
        recommendedFabrics: [
          "Denim / Mezclilla mediana (8 a 11 oz)",
          "Dril de algodón o gabardina estructurada",
          "Lino pesado o lona suave",
        ],
        notions: [
          "2 hebillas con broche para overol (4 cm de ancho)",
          "Botones metálicos laterales de 17 mm",
          "Hilo de pespunte grueso o poliéster resistente",
        ],
        steps: [
          "1. Dobla y pespunta la boca superior del bolsillo de pechera y cóselo sobre la marca de la Pechera Delantera.",
          "2. Cose las dos piezas de cada Tirante derecho con derecho, voltea, plancha y pasa pespunte por ambos bordes.",
          "3. Forra la Pechera Delantera y la Pechera Trasera (insertando los extremos traseros de los tirantes en los piquetes superiores).",
          "4. Une los tiros delantero y trasero del pantalón (con +3 cm de holgura vertical para comodidad al sentarse) y cierra entrepierna y costados.",
          "5. Une el pantalón con las pecheras mediante la Pretina de Unión e instala los herrajes de los tirantes.",
        ],
      };
    }

    return {
      title: `Guía de Confección — ${pattern.subStyleLabel}`,
      difficulty: "Intermedio",
      recommendedFabrics: [
        "Lino con viscosa, chalis o rayón pesado",
        "Crepé sastre, tencel o chambray",
        "Punto roma o french terry liviano",
      ],
      notions: [
        "Cierre invisible de 50 cm para la espalda",
        "Elástico suave de 1 cm (opcional en cintura)",
        "Aguja universal 80/12",
      ],
      steps: [
        "1. Une hombros y costados del Corpiño Delantero y Corpiño Trasero, dejando abierto el centro trasero para el cierre.",
        "2. Si lleva mangas, cose la copa haciendo coincidir el piquete de hombro con el embebido calculado (+1.25 cm).",
        "3. Cose el tiro delantero y trasero de las piezas inferiores (que ya incluyen +3 cm de holgura vertical para sentarse cómodamente).",
        "4. Une el corpiño con el pantalón/short por la línea de cintura haciendo coincidir las costuras laterales.",
        "5. Instala el cierre invisible en el centro espalda y realiza el dobladillo de bota.",
      ],
    };
  }

  // 2. ROPA INFANTIL Y BEBÉ
  if (pattern.category === "kids") {
    if (label.includes("body") || label.includes("pelele")) {
      return {
        title: `Guía de Confección — ${pattern.subStyleLabel}`,
        difficulty: "Principiante",
        recommendedFabrics: [
          "Algodón Pima 100% hipoalergénico (Interlock o Jersey)",
          "Rib de algodón suave para vivo de cuello y piernas",
          "Algodón orgánico peinado",
        ],
        notions: [
          "3 broches de presión metálicos (snaps) de 9 mm",
          "Tira de rib de 3 cm para ribetear escote y curva de pañal",
          "Aguja punta de bola (Jersey 75/11)",
        ],
        steps: [
          "1. Ribetea el escote del Delantero y Trasero y cruza los hombros en los piquetes (escote americano extensible para vestir fácil al bebé).",
          "2. Cose las Mangas Cortas abiertas haciendo coincidir el piquete central con el hombro.",
          "3. Cierra manga y costado en una sola costura continua con puntada elástica o fileteadora.",
          "4. Aplica las Vistas de Broches en la lengüeta inferior para reforzar la tela y ribetea toda la curva de pañal.",
          "5. Coloca los 3 broches de presión en las marcas de entrepierna.",
        ],
      };
    }

    if (label.includes("vestido")) {
      return {
        title: `Guía de Confección — ${pattern.subStyleLabel}`,
        difficulty: "Principiante",
        recommendedFabrics: [
          "Popelina de algodón 100%, batista o plumeti",
          "Lino suave, vichy o broderie inglés",
          "Viyela o franela liviana para clima fresco",
        ],
        notions: [
          "3 a 4 botones pequeños nacarados para la espalda",
          "Tira de entretela liviana para el cruce trasero",
        ],
        steps: [
          "1. Plancha el cruce de botones (+2.2 cm) en las dos piezas del Corpiño Trasero Infantil.",
          "2. Une hombros y costados del Corpiño Delantero y Trasero y termina el escote con bies o vista.",
          "3. Pasa dos costuras flojas por el borde superior de la Falda Evasé y frunce hasta igualar el ancho del corpiño.",
          "4. Une la falda fruncida al corpiño corto, haz ojales/botones en la espalda y cose el ruedo.",
        ],
      };
    }

    return {
      title: `Guía de Confección — ${pattern.subStyleLabel}`,
      difficulty: "Principiante",
      recommendedFabrics: [
        "French terry (burda liviana), algodón perchado o interlock",
        "Lino lavado, dril suave o muselina doble",
      ],
      notions: [
        "Elástico suave de 2.5 cm de ancho (largo = cintura del niño menos 3 cm)",
        "Aguja universal o punta de bola según la tela",
      ],
      steps: [
        "1. Une por separado los tiros delanteros y los tiros traseros de las piernas.",
        "2. Enfrenta delantero con trasero y cose la entrepierna de un tobillo al otro y luego ambos costados.",
        "3. Dobla hacia adentro los 4 cm superiores por la 'Línea de doblez para elástico', cose dejando 3 cm abiertos e introduce el elástico.",
        "4. Cierra el anillo del elástico, termina la costura del túnel y realiza el dobladillo de las botas.",
      ],
    };
  }

  // 3. DEPORTIVO Y PIJAMAS
  if (pattern.category === "loungewear") {
    if (label.includes("leggings") || label.includes("licra")) {
      return {
        title: `Guía de Confección — ${pattern.subStyleLabel}`,
        difficulty: "Principiante",
        recommendedFabrics: [
          "Suplex deportivo de alta compresión (Poliamida + Elastano 20%)",
          "Lycra deportiva pesada (280–320 g/m²) con elongación en 4 sentidos",
          "Microfibra deportiva elástica",
        ],
        notions: [
          "Hilo de nylon espuma (mousse) en los loopers de la fileteadora",
          "Aguja Stretch / Punta de bola 75/11",
        ],
        steps: [
          "1. Cada pierna se corta en 1 sola pieza envolvente (con reducción negativa del -13% y SIN costura en el costado exterior).",
          "2. Dobla cada pierna a lo largo de la 'Línea lateral (Sin costura)' y cose únicamente la entrepierna desde el tobillo hasta el tiro.",
          "3. Mete una pierna dentro de la otra (derecho con derecho) y cose la curva completa del tiro delantero al trasero.",
          "4. Cierra el Fajón Anatómico Deportivo en anillo, dóblalo a la mitad (9 cm de alto final) y únelo a la cintura estirando suavemente.",
          "5. Haz dobladillo elástico en los tobillos con aguja gemela o recubridora.",
        ],
      };
    }

    return {
      title: `Guía de Confección — ${pattern.subStyleLabel}`,
      difficulty: "Principiante",
      recommendedFabrics: [
        "Satén de seda o poliéster fluido",
        "Franela de algodón, popelina suave o viscosa",
        "Modal o jersey de algodón pima",
      ],
      notions: [
        "4 a 5 botones medianos para la camisa",
        "Elástico suave de 3 cm para la cintura del pantalón",
        "Vivo / bies contrastante (opcional en bordes)",
      ],
      steps: [
        "1. Cose el bolsillo en el delantero izquierdo de la Camisa Pijama y dobla las vistas del cruce delantero.",
        "2. Une hombros de camisa, pega las mangas abiertas y cierra manga y costado recto de una sola vez.",
        "3. Para el Pantalón Pijama: cose tiros, entrepierna y costados.",
        "4. Dobla el túnel superior de 4.5 cm en la cintura del pantalón, introduce el elástico y cose los ruedos.",
      ],
    };
  }

  // 4. ACCESORIOS TEXTILES
  if (pattern.category === "accessories") {
    if (label.includes("sombrero") || label.includes("bucket")) {
      return {
        title: `Guía de Confección — ${pattern.subStyleLabel}`,
        difficulty: "Principiante",
        recommendedFabrics: [
          "Gabardina de algodón, dril, lona suave o denim",
          "Corderoy / pana, lino grueso o tela impermeable",
          "Popelina de algodón para el forro interior",
        ],
        notions: [
          "Entretela termoadhesiva mediana para el Ala Caída y la Banda",
          "Hilo de pespunte al tono o contrastante",
        ],
        steps: [
          "1. Une por los costados las 2 mitades de la Banda Lateral Inclinada formando un anillo cónico.",
          "2. Haz coincidir los 4 piquetes cardinales (Frente, Atrás, Izq., Der.) de la Corona Superior Circular con el borde superior de la Banda y cóselos en círculo.",
          "3. Une los costados de las 2 piezas del Ala Caída, plánchala con entretela y cósela al borde inferior de la Banda Lateral.",
          "4. Repite los pasos 1–3 con las piezas de forro, enfrenta sombrero exterior y forro por el borde del ala, voltea y pasa 3 pespuntes decorativos en el ala.",
        ],
      };
    }

    if (label.includes("delantal")) {
      return {
        title: `Guía de Confección — ${pattern.subStyleLabel}`,
        difficulty: "Principiante",
        recommendedFabrics: [
          "Lona de algodón, dril pesado, mezclilla (denim) o gabardina",
          "Lino rústico lavado o tela antimanchas",
        ],
        notions: [
          "Hilo resistente de poliéster o algodón",
          "2 argollas en D metálicas (opcional para tira de cuello ajustable)",
        ],
        steps: [
          "1. Dobla y cose los bordes laterales, inferior y las curvas de sisa del Cuerpo Principal del Delantal.",
          "2. Haz el dobladillo superior de 2.5 cm en el Bolsillo Dividido, fíjalo en el centro del delantal y pasa la costura vertical divisoria.",
          "3. Cose y voltea las 3 Tiras de Amarre (1 de cuello de 62 cm y 2 de cintura de 78 cm) y asegúralas con remate en X en las esquinas.",
        ],
      };
    }

    return {
      title: `Guía de Confección — ${pattern.subStyleLabel}`,
      difficulty: "Principiante",
      recommendedFabrics: [
        "Lona estampada, tela impermeable, gabardina o acolchado (quilted)",
        "Popelina o impermeable liviano para el forro",
      ],
      notions: [
        "1 cierre / cremallera de nylon o metal de 22 a 25 cm",
        "Entretela adhesiva o guata delgada para dar cuerpo",
        "2 Tiradores laterales doblados",
      ],
      steps: [
        "1. Coloca el cierre entre el borde superior de la tela exterior y el forro de cada lado del Cuerpo con Fuelle y asienta con pespunte.",
        "2. Abre el cierre a la mitad; enfrenta exterior con exterior y forro con forro, y cose la base y los costados (dejando 7 cm abiertos en el forro).",
        "3. Abre cada una de las 4 esquinas recortadas en caja (4.5 × 4.5 cm) haciendo coincidir la costura lateral con la del fondo (insertando los Tiradores en los extremos del cierre) y cose recto para formar el fuelle 3D.",
        "4. Voltea el neceser por la abertura del forro y cierra la abertura con puntada invisible.",
      ],
    };
  }

  // 5. CATEGORÍAS CLÁSICAS (Top, Chaqueta, Vestido, Falda, Pantalón, Conjunto)
  const hasTailoredLapel = pieceIds.has("tailored_collar_top") || pieceIds.has("lapel_facing");
  const hasWrap = pieceIds.has("wrap_facing");
  const hasShirtCollar = pieceIds.has("collar_stand") || pieceIds.has("shirt_collar");
  const hasFly = pieceIds.has("fly_facing");
  const hasItalianPocketCutout = pieceIds.has("italian_pocket_upperbag");
  const hasBackYoke = pieceIds.has("back_yoke");
  const hasPrincessSeams =
    pieceIds.has("front_center") && pieceIds.has("front_side");
  const sleevePiece = pattern.pieces.find((p) => p.id === "sleeve");
  const hasRaglan = typeof sleevePiece?.seamAnchors?.raglanSeam === "number";
  const hasTwoPieceSleeve = pieceIds.has("upper_sleeve") && pieceIds.has("under_sleeve");
  const isSemicircular = label.includes("semicircular");
  const hasInterfacing = pattern.pieces.some((p) => (p.interfacingQuantity ?? 0) > 0);

  return {
    title: `Guía de Confección — ${pattern.subStyleLabel}`,
    difficulty:
      hasTailoredLapel || hasTwoPieceSleeve || hasPrincessSeams || hasBackYoke
        ? "Avanzado (Sastrería)"
        : "Intermedio",
    recommendedFabrics:
      pattern.category === "pants"
        ? ["Gabardina, lino sastre, crepé pesado o dril con caída"]
        : hasTailoredLapel
          ? ["Paño liviano, lino sastre, gabardina, crepé sastre y entretela fusionable"]
          : isSemicircular
            ? ["Crepé fluido, chalis, viscosa, satén o gasa con forro"]
            : ["Popelina de algodón, lino, viscosa, chalis o crepé fluido"],
    notions: [
      hasTailoredLapel
        ? "Entretela sastre fusionable para Vista de Solapa y Cuello + 2 botones"
        : hasShirtCollar
          ? "Entretela liviana para Pie de Cuello, Cuello y Puños + 6 botones de camisa"
          : hasFly
            ? "Cierre metálico/nylon de 18 cm, botón/gancho de pantalón y entretela para pretina/aleta"
            : hasWrap
              ? "Entretela liviana para Vista de Escote Cruzado"
              : hasInterfacing
                ? "Entretela liviana para vistas/pretina + cierre o botones según abertura"
                : "Hilo al tono + cierre invisible si aplica",
    ],
    steps: [
      hasTailoredLapel
        ? "1. Cose las pinzas de busto (planchando hacia abajo) y pinzas verticales de entalle (hacia el centro), y fusiona entretela en Vista de Solapa y Cuello Inferior."
        : hasFly
          ? hasItalianPocketCutout
            ? "1. Cose pinzas traseras planchando hacia el centro; une Bolsa Sup. por la boca inclinada de Pierna Del., voltea/asienta con pespunte y fija Bolsa Inf. + Vista para reconstruir la esquina de cintura y costado; instala luego aleta y aletilla de cierre."
            : "1. Cose pinzas traseras planchando hacia el centro, arma los bolsillos italianos con su vista e instala la aleta y aletilla de cierre en el delantero."
          : hasPrincessSeams
            ? "1. Une cada Centro con su Costadillo Princesa derecho con derecho haciendo coincidir piquetes de busto/omóplato y cintura, piquetea márgenes curvos, plancha abierto y cierra hombros y costados."
            : hasBackYoke
              ? "1. Forma el tablón central de 6 cm en el Trasero inferior siguiendo piquetes, envuélvelo entre los 2 Canesúes (método burrito) incluyendo la unión limpia de hombros adelantados y cose costados."
              : hasRaglan
                ? "1. Cierra primero las pinzas de busto y pinzas de entalle si aplican (sin unir hombros tradicionales)."
                : isSemicircular
                  ? "1. Une costados y centro espalda instalando cierre invisible (margen 2 cm). Coloca la pretina con entretela y deja colgar la falda 24 h al bies antes de emparejar el ruedo."
                  : "1. Cose primero las pinzas de busto (hacia abajo) y pinzas de cintura (hacia el centro); luego une hombros y costados haciendo coincidir piquetes (1 delantero, 2 espalda).",
      hasRaglan
        ? `2. Si es tela plana, cierra la pinza superior de hombro de la Manga Raglán; luego cose los raglán delanteros (1 piquete) y traseros (2 piquetes) al cuerpo${pieceIds.has("shirt_cuff") ? ", arma puños con entretela" : ""} y cierra manga + costado en una costura continua.`
        : hasTwoPieceSleeve
          ? "2. Arma la manga sastre uniendo Hoja Superior e Inferior por codo y costura interna, pasa embebido en copa y pega haciendo coincidir piquetes 1 del. / 2 esp."
          : pieceIds.has("sleeve")
            ? `2. Pasa doble pespunte de embebido en la copa de la manga${pieceIds.has("shirt_cuff") ? ", arma la portañuela y pega el puño con entretela" : ""} y encaja piquetes (1 delantero, 2 espalda).`
            : hasShirtCollar
              ? "2. Fusiona entretela en Pie de Cuello y Cuello Superior, ármalos y únelos al escote haciendo coincidir piquetes de hombro y centro."
              : "2. Fusiona entretela en las vistas anatómicas de escote o pretina, une por hombros y asienta con pespunte invisible.",
      pieceIds.has("pocket_bag") || pieceIds.has("pocket_flap")
        ? "3. Instala los bolsillos siguiendo los piquetes laterales y realiza la prueba de ajuste antes de cerrar el ruedo (3 cm)."
        : "3. Realiza la prueba de ajuste, cose las aberturas traseras o portañuelas si aplica y asienta los ruedos con plancha.",
    ],
  };
}
