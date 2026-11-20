import { PERFILES_DEMO } from "./demoSeed";
import { obtenerFeatureFlagsBase } from "./featureFlags";
import type { EstadoAmpliacionComunidad } from "./expansionTypes";
import { DEFAULT_GARMENT_EXTRAS } from "@/lib/types";
import { construirConfigMoldeDesdeGenerador } from "./patternBridge";

const CONFIG_ENCARGO_DEMO = construirConfigMoldeDesdeGenerador({
  category: "dress",
  topSubStyle: "blouse",
  pantsSubStyle: "straight",
  skirtSubStyle: "a_line",
  dressSubStyle: "dress",
  twoPieceTopStyle: "crop_top",
  twoPieceBottomStyle: "aline_skirt",
  jumpsuitSubStyle: "romper_long",
  kidsSubStyle: "baby_bodysuit",
  loungewearSubStyle: "leggings",
  accessorySubStyle: "bucket_hat",
  necklineStyle: "v_neck",
  sleeveStyle: "kimono",
  torsoFit: "loose",
  seamAllowance: 1,
  fabricType: "woven",
  extras: { ...DEFAULT_GARMENT_EXTRAS, wrapFront: true },
  quickLength: "midi",
  styleVariant: "default",
  apariencia3D: {
    tela: "crepe",
    color: "#C85A32",
    estampado: "liso",
    mostrarCosturas: false,
  },
});

export const ESTADO_INICIAL_AMPLIACION: EstadoAmpliacionComunidad = {
  featureFlags: obtenerFeatureFlagsBase(),
  probadorasBetaIds: [PERFILES_DEMO[0].id, PERFILES_DEMO[1].id],
  retroalimentaciones: [
    // 6 reportes en rango 90–94 cm en dress para superar k >= 5 con privacidad
    ...["u_demo_1", "u_demo_2", "u_demo_3", "u_demo_4", "u_demo_5", "u_demo_6"].map(
      (uid, idx) => ({
        id: `calce-demo-${idx + 1}`,
        autora_id: uid,
        molde_categoria: "dress",
        version_config: 1,
        rango_busto_5cm: "90–94 cm",
        rango_cintura_5cm: "70–74 cm",
        rango_cadera_5cm: "95–99 cm",
        tela_usada: idx % 2 === 0 ? "Crepé / Viscosa" : "Lino / Gabardina",
        ajuste_talle: "perfecto" as const,
        ajuste_busto: idx < 4 ? ("perfecto" as const) : ("grande" as const),
        ajuste_cintura: "perfecto" as const,
        ajuste_cadera: "perfecto" as const,
        ajuste_hombros: "perfecto" as const,
        ajuste_manga: idx === 5 ? ("pequeno" as const) : ("perfecto" as const),
        volveria_hacer: true,
        es_probadora_beta: idx === 0,
        es_demo: true,
        creado_en: `2026-11-1${Math.min(9, idx + 1)}T14:00:00.000Z`,
      })
    ),
    // 3 reportes en rango 100-104 cm (< 5 para demostrar regla de k-anonimato)
    ...["u_demo_7", "u_demo_8", "u_demo_9"].map((uid, idx) => ({
      id: `calce-demo-small-${idx + 1}`,
      autora_id: uid,
      molde_categoria: "pants",
      version_config: 1,
      rango_busto_5cm: "100–104 cm",
      rango_cintura_5cm: "85–89 cm",
      rango_cadera_5cm: "110–114 cm",
      tela_usada: "Gabardina",
      ajuste_talle: "perfecto" as const,
      ajuste_busto: "perfecto" as const,
      ajuste_cintura: "pequeno" as const,
      ajuste_cadera: "perfecto" as const,
      ajuste_hombros: "perfecto" as const,
      ajuste_manga: "perfecto" as const,
      volveria_hacer: true,
      es_probadora_beta: false,
      es_demo: true,
      creado_en: "2026-11-18T10:00:00.000Z",
    })),
  ],
  novedadesMolde: [
    {
      id: "nov-dress-v2",
      molde_categoria: "dress",
      version_nueva: 2,
      titulo: "Mejora aplicada en Vestido Base v2",
      resumen:
        "Suavizamos 0.6 cm en la sisa delantera y ampliamos la vista del escote en V gracias a reportes reales de tallas 90–94 cm.",
      es_demo: true,
      creado_en: "2026-11-18T18:00:00.000Z",
    },
  ],
  ajustesMolde: [
    ...["u_aj_1", "u_aj_2", "u_aj_3", "u_aj_4", "u_aj_5"].map((uid, idx) => ({
      id: `ajuste-demo-sisa-${idx + 1}`,
      autora_id: uid,
      molde_categoria: "dress",
      version_config: 1,
      rango_busto_5cm: "90–94 cm",
      zona: "sisa" as const,
      cm_delta: 1,
      descripcion_corta:
        "Subir 1 cm la base de la sisa en telas muy livianas evita que se asome el sostén.",
      conteo_me_funciono: 11 + idx,
      usuarios_que_confirmaron: [],
      estado_editorial: idx === 0 ? ("en_blog" as const) : ("destacado" as const),
      slug_blog:
        idx === 0
          ? "como-adaptar-patrones-cuerpo-real-sin-perder-proporcion"
          : undefined,
      es_demo: true,
      creado_en: "2026-11-15T12:00:00.000Z",
    })),
    {
      id: "ajuste-demo-tiro-1",
      autora_id: PERFILES_DEMO[3].id,
      molde_categoria: "pants",
      version_config: 1,
      rango_busto_5cm: "100–104 cm",
      zona: "tiro" as const,
      cm_delta: 1.5,
      descripcion_corta:
        "Añadir 1.5 cm al tiro trasero en gabardina rígida para mayor comodidad al sentarse.",
      conteo_me_funciono: 3,
      usuarios_que_confirmaron: [],
      estado_editorial: "pendiente",
      es_demo: true,
      creado_en: "2026-11-17T15:00:00.000Z",
    },
  ],
  bitacoras: [
    {
      id: "bit-demo-1",
      autora_id: PERFILES_DEMO[0].id,
      titulo: "Vestido cruzado lino verano (Bitácora ejemplo)",
      prenda: "Vestido",
      tela: "Lino lavado 160g",
      molde_categoria: "dress",
      etapa_actual: "prueba",
      etapas: [
        {
          id: "et-1",
          nombre: "molde",
          nota: "Imprimí el patrón en tamaño Carta (12 hojas) y ajusté el largo midi.",
          fotoUrl: "/promo/03-molde-pdf.png",
          altFoto: "Piezas de patrón impresas y unidas sobre mesa de corte",
          creado_en: "2026-11-14T10:00:00.000Z",
        },
        {
          id: "et-2",
          nombre: "corte",
          nota: "Corte al hilo con margen de 1 cm en costados y 1.5 cm en ruedo.",
          fotoUrl: "/promo/01-foto-ia.png",
          altFoto: "Tela cortada lista para hilvanar",
          creado_en: "2026-11-15T16:00:00.000Z",
        },
        {
          id: "et-3",
          nombre: "prueba",
          nota: "Hilvanado sobre maniquí: la cintura asienta bien, haré pespunte de asiento en la vista.",
          fotoUrl: "/promo/02-studio-3d.png",
          altFoto: "Primera prueba de calce sobre busto",
          creado_en: "2026-11-16T18:00:00.000Z",
        },
      ],
      es_demo: true,
      creado_en: "2026-11-14T10:00:00.000Z",
      actualizado_en: "2026-11-16T18:00:00.000Z",
    },
  ],
  perfilesPro: [
    {
      usuaria_id: PERFILES_DEMO[0].id,
      portafolio: [
        {
          id: "port-1",
          titulo: "Vestido cruzado en crepé terracota",
          prenda: "Vestido",
          tela: "Crepé / Viscosa",
          fotoUrl: "/promo/01-foto-ia.png",
          alt: "Vestido cruzado terracota terminado sobre maniquí",
          tiempo_entrega_dias: 7,
        },
        {
          id: "port-2",
          titulo: "Blusa camisera de oficina",
          prenda: "Blusa",
          tela: "Popelina algodón",
          fotoUrl: "/promo/04-cotizador-taller.png",
          alt: "Blusa blanca cuello camisero confeccionada a medida",
          tiempo_entrega_dias: 5,
        },
      ],
      servicios: ["Vestidos a medida", "Ajustes y entalles", "Sastrería suave"],
      tiempo_respuesta_horas: 12,
      ciudad_pais: "Medellín, Colombia",
      verificada_manual: true,
      nota_verificacion:
        "Identidad de taller revisada manualmente por el equipo (no constituye garantía comercial de terceros).",
      acepta_mentoria: true,
      max_aprendices: 2,
    },
    {
      usuaria_id: PERFILES_DEMO[2].id,
      portafolio: [
        {
          id: "port-3",
          titulo: "Pantalón palazzo lino camel",
          prenda: "Pantalón",
          tela: "Lino pesado",
          fotoUrl: "/promo/02-studio-3d.png",
          alt: "Pantalón ancho de lino camel con pinzas",
          tiempo_entrega_dias: 8,
        },
      ],
      servicios: ["Pantalones y sastrería", "Prendas de ceremonia"],
      tiempo_respuesta_horas: 24,
      ciudad_pais: "Ciudad de México, México",
      verificada_manual: true,
      nota_verificacion:
        "Modista con trayectoria comprobada en taller y respuestas verificadas (acuerdo directo fuera de la plataforma).",
      acepta_mentoria: true,
      max_aprendices: 2,
    },
  ],
  encargos: [
    {
      id: "enc-demo-1",
      clienta_id: PERFILES_DEMO[1].id,
      modista_id: PERFILES_DEMO[0].id,
      titulo_prenda: "Vestido cruzado kimono midi en crepé terracota",
      config_molde: CONFIG_ENCARGO_DEMO,
      captura_3d_url: "/promo/01-foto-ia.png",
      tela_color_deseado: "Crepé suave color terracota o vino",
      notas_clienta: "Para evento familiar en 2 semanas, sin cierre en espalda.",
      estado: "aceptada",
      medidas_compartidas: false,
      mensajes: [
        {
          id: "msg-enc-1",
          autora_id: PERFILES_DEMO[1].id,
          contenido:
            "Hola Marta, me encantó este diseño del probador 3D. ¿Lo haces en crepé mate?",
          creado_en: "2026-11-17T10:00:00.000Z",
        },
        {
          id: "msg-enc-2",
          autora_id: PERFILES_DEMO[0].id,
          contenido:
            "¡Hola Lucía! Sí, lo confecciono en 7 días hábiles. Si quieres compartirme tus medidas de forma temporal, podemos revisar si necesitas 2 m de tela.",
          creado_en: "2026-11-17T14:00:00.000Z",
        },
      ],
      es_demo: true,
      creado_en: "2026-11-17T10:00:00.000Z",
      actualizado_en: "2026-11-17T14:00:00.000Z",
    },
  ],
  auditoriaMedidas: [],
  circulos: [
    {
      id: "circ-bog-med",
      nombre: "Círculo Lino y Costura Lenta Colombia",
      tema_o_ciudad: "Colombia · Telas naturales",
      nivel_sugerido: "todas",
      tipo_acceso: "abierto",
      anfitriona_id: PERFILES_DEMO[0].id,
      miembros_ids: [
        PERFILES_DEMO[0].id,
        PERFILES_DEMO[1].id,
        PERFILES_DEMO[4].id,
      ],
      pendientes_ids: [],
      publicaciones_privadas: [
        {
          id: "cpub-1",
          autora_id: PERFILES_DEMO[0].id,
          contenido:
            "Bienvenidas al círculo. Compartan sus muestras de tensión en máquina recta antes de cortar el lino.",
          creado_en: "2026-11-16T11:00:00.000Z",
        },
      ],
      archivado_por_inactividad: false,
      ultima_actividad_en: "2026-11-19T11:00:00.000Z",
      es_demo: true,
      creado_en: "2026-10-01T10:00:00.000Z",
    },
    {
      id: "circ-sastreria-priv",
      nombre: "Grupo Cerrado de Sastrería y Solapas",
      tema_o_ciudad: "Nivel intermedio / avanzado",
      nivel_sugerido: "intermedia",
      tipo_acceso: "con_solicitud",
      anfitriona_id: PERFILES_DEMO[2].id,
      miembros_ids: [PERFILES_DEMO[2].id, PERFILES_DEMO[3].id],
      pendientes_ids: [],
      publicaciones_privadas: [
        {
          id: "cpub-priv-1",
          autora_id: PERFILES_DEMO[2].id,
          contenido:
            "Apuntes privados de entretenimiento sastre: picado a mano del bajo cuello.",
          creado_en: "2026-11-17T09:00:00.000Z",
        },
      ],
      archivado_por_inactividad: false,
      ultima_actividad_en: "2026-11-17T09:00:00.000Z",
      es_demo: true,
      creado_en: "2026-10-20T10:00:00.000Z",
    },
  ],
  mentorias: [
    {
      id: "ment-demo-1",
      aprendiz_id: PERFILES_DEMO[1].id,
      mentora_id: null,
      tema_concreto:
        "Revisión rápida antes de cortar mi primera falda semicircular en viscosa (duda con la caída al bies).",
      estado: "abierta",
      mensajes: [],
      agradecimiento_me_ayudo: false,
      vence_sin_respuesta_en: "2026-11-26T20:00:00.000Z",
      es_demo: true,
      creado_en: "2026-11-19T20:00:00.000Z",
    },
  ],
  rutas: [
    {
      id: "ruta-falda-7d",
      titulo: "Tu primera falda en 7 días",
      descripcion:
        "Ruta guiada paso a paso para principiantes: desde tomar 3 medidas clave hasta lucir tu falda con cierre limpio.",
      duracion_estimada: "7 días · ~4 horas totales",
      molde_recomendado: "Falda Línea A",
      insignia_completada: "Completó ruta: Primera Falda",
      pasos: [
        {
          id: "paso-1",
          titulo: "Día 1 · Toma tus medidas sin apretar la cinta",
          detalle: "Anota cintura, cadera alta/baja y largo deseado.",
          enlace: "/",
        },
        {
          id: "paso-2",
          titulo: "Día 2 · Imprime y une las hojas en escala 100%",
          detalle: "Verifica el cuadro de calibración de 5×5 cm antes de recortar.",
          enlace: "/",
        },
        {
          id: "paso-3",
          titulo: "Día 4 · Hilvana costados y asienta pretina",
          detalle: "Usa pespunte largo de prueba antes de remallar.",
        },
        {
          id: "paso-4",
          titulo: "Día 7 · Ruedo invisible y fotos para la galería",
          detalle: "Plancha con trapo húmedo y comparte tu logro.",
        },
      ],
    },
    {
      id: "ruta-pantalon-calce",
      titulo: "Domina el tiro del pantalón",
      descripcion:
        "Aprende a diagnosticar y corregir bolsas o tensión en el tiro trasero antes de cortar tu tela definitiva.",
      duracion_estimada: "5 días · Nivel intermedio",
      molde_recomendado: "Pantalón Palazzo / Recto",
      insignia_completada: "Completó ruta: Maestro de Tiro",
      pasos: [
        {
          id: "pt-1",
          titulo: "1 · Mide altura de tiro sentada en silla firme",
          detalle: "Mantén la espalda recta de cintura hasta el asiento.",
        },
        {
          id: "pt-2",
          titulo: "2 · Haz un toile de prueba en lienzo económico",
          detalle: "Evalúa líneas de tensión alrededor de cadera y entrepierna.",
        },
        {
          id: "pt-3",
          titulo: "3 · Documenta el ajuste que funcionó para tu rango",
          detalle: "Comparte cuántos centímetros sumaste o restaste.",
        },
      ],
    },
  ],
  progresoRutasPorUsuaria: {},
  paisGlosarioPreferido: "Colombia",
  glosario: [
    {
      id: "gl-1",
      termino_base: "Cremallera / Cierre",
      definicion_clara:
        "Pieza con dientes metálicos o de nailon usada para abrir y cerrar prendas con comodidad.",
      variantes: {
        Colombia: "Cremallera / Cierre",
        México: "Cierre",
        Argentina: "Cierre",
        España: "Cremallera",
        Perú: "Cierre",
      },
      aprobado: true,
      es_demo: true,
    },
    {
      id: "gl-2",
      termino_base: "Dobladillo / Ruedo",
      definicion_clara:
        "Terminación inferior de faldas, mangas o pantalones doblada hacia el revés para evitar que se deshilache.",
      variantes: {
        Colombia: "Ruedo",
        México: "Bastilla / Dobladillo",
        Argentina: "Ruedo / Dobladillo",
        España: "Bajo / Dobladillo",
        Perú: "Basta",
      },
      aprobado: true,
      es_demo: true,
    },
    {
      id: "gl-3",
      termino_base: "Sesgo / Bies",
      definicion_clara:
        "Tira de tela cortada a 45° respecto al hilo para que tenga elasticidad y rodee curvas como escotes y sisas.",
      variantes: {
        Colombia: "Sesgo",
        México: "Bies",
        Argentina: "Bies / Cinta al bies",
        España: "Bies",
        Perú: "Sesgo / Bies",
      },
      aprobado: true,
      es_demo: true,
    },
    {
      id: "gl-4",
      termino_base: "Remalladora / Overlock",
      definicion_clara:
        "Máquina que recorta y sobrehila el borde de la tela al mismo tiempo para un acabado profesional por dentro.",
      variantes: {
        Colombia: "Fileteadora",
        México: "Over / Overlock",
        Argentina: "Overlock",
        España: "Remalladora",
        Perú: "Remalladora",
      },
      aprobado: true,
      es_demo: true,
    },
  ],
  proveedores: [
    {
      id: "prov-demo-1",
      nombre: "Telas La Alborada (Ejemplo)",
      ciudad_pais: "Medellín, Colombia",
      categoria: "Linos, viscosas y entretelas",
      descripcion:
        "Bodega tradicional con venta desde 1 metro de lino prelavado, popelina y tricot fusible.",
      es_demo: true,
    },
    {
      id: "prov-demo-2",
      nombre: "Mercería El Botón de Oro (Ejemplo)",
      ciudad_pais: "Ciudad de México, México",
      categoria: "Hilos, cierres invisibles y prensatelas",
      descripcion:
        "Surtido completo de cierres invisibles por color, aguja doble y tijeras de sastre.",
      es_demo: true,
    },
  ],
  resenasProveedores: [
    {
      id: "res-prov-1",
      proveedor_id: "prov-demo-1",
      autora_id: PERFILES_DEMO[0].id,
      calificacion: 5,
      comentario:
        "El lino lavado casi no encoge al primer lavado y cortan recto al hilo.",
      tiene_relacion_negocio: false,
      respuesta_dueno:
        "¡Muchas gracias Marta! Siempre cuidamos el corte recto para quienes trazan moldes.",
      marcada_revision: false,
      es_demo: true,
      creado_en: "2026-11-12T10:00:00.000Z",
    },
  ],
  modoAhorroDatosManual: false,
};