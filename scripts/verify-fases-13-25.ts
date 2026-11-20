import assert from "node:assert/strict";
import { ESTADO_INICIAL_AMPLIACION } from "@/lib/community/expansionSeed";
import {
  aceptarMentoriaComoMentora,
  actualizarEstadoEncargo,
  alternarConsentimientoMedidasEncargo,
  alternarPasoRuta,
  crearAjusteMolde,
  crearSolicitudEncargo,
  crearSolicitudMentoria,
  obtenerAjustesAgrupadosConKAnonimato,
  publicarResenaEncargo,
  publicarResenaProveedor,
  puedeLeerPublicacionesCirculo,
  registrarLecturaMedidasModista,
  registrarRetroalimentacionCalce,
  toggleFeatureFlagComunidad,
} from "@/lib/community/expansionStore";
import { agruparEnRango5Cm } from "@/lib/community/privacyAggregation";
import { sincronizarColaOffline, type ElementoColaOffline } from "@/lib/community/offlineQueue";
import { DEFAULT_GARMENT_EXTRAS } from "@/lib/types";
import { construirConfigMoldeDesdeGenerador } from "@/lib/community/patternBridge";

async function run() {
  const modista = { id: "00000000-0000-4000-8000-000000000101", rol: "moderadora" as const };
  const clienta = { id: "00000000-0000-4000-8000-000000000102", rol: "usuaria" as const };

  // 1. Fase 13 & 14: Privacidad rango 5 cm y k >= 5
  assert.equal(agruparEnRango5Cm(92.4), "90–94 cm");
  const fb = registrarRetroalimentacionCalce(ESTADO_INICIAL_AMPLIACION, clienta, {
    molde_categoria: "dress",
    version_config: 1,
    bustoCm: 92,
    cinturaCm: 73,
    caderaCm: 99,
    tela_usada: "Lino",
    ajuste_talle: "perfecto",
    ajuste_busto: "perfecto",
    ajuste_cintura: "perfecto",
    ajuste_cadera: "perfecto",
    ajuste_hombros: "perfecto",
    ajuste_manga: "perfecto",
    volveria_hacer: true,
  });
  assert.equal(fb.ok, true);
  assert.equal(fb.estado.retroalimentaciones[0].rango_busto_5cm, "90–94 cm");
  assert.equal(
    JSON.stringify(fb.estado.retroalimentaciones[0]).includes('"92"'),
    false
  );

  // Grupo con >=5 autoras ("dress") visible; grupo con 1 autora ("pants") oculto por k<5
  const dressGroups = obtenerAjustesAgrupadosConKAnonimato(fb.estado, "dress");
  assert.ok(dressGroups.length > 0 && dressGroups[0].cumpleKAnonimato === true);

  const ajSmall = crearAjusteMolde(fb.estado, clienta, {
    molde_categoria: "pants",
    version_config: 1,
    bustoCm: 102,
    zona: "tiro",
    cm_delta: 1,
    descripcion_corta: "Ajuste individual en tiro trasero para prueba de k<5.",
  });
  assert.equal(ajSmall.ok, true);
  const pantsGroups = obtenerAjustesAgrupadosConKAnonimato(ajSmall.estado, "pants");
  assert.equal(pantsGroups[0].cumpleKAnonimato, false);
  assert.equal(pantsGroups[0].items.length, 0);

  // 2. Fase 18: Encargo excluye medidas por defecto, permite 30d consent + auditoría, bloquea tras revocar
  const cfg = construirConfigMoldeDesdeGenerador({
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
    necklineStyle: "round",
    sleeveStyle: "short",
    torsoFit: "fitted",
    seamAllowance: 1,
    fabricType: "woven",
    extras: { ...DEFAULT_GARMENT_EXTRAS },
    quickLength: "photo",
    styleVariant: "default",
    apariencia3D: { tela: "lino", color: "#C85A32", estampado: "liso", mostrarCosturas: false },
  });

  const encRes = crearSolicitudEncargo(ESTADO_INICIAL_AMPLIACION, clienta, {
    modistaId: modista.id,
    titulo_prenda: "Vestido Prueba Privacidad",
    config_molde: cfg,
    tela_color_deseado: "Lino beige",
    notas_clienta: "Sin cierre",
  });
  assert.equal(encRes.ok, true);
  const encId = encRes.encargoId!;
  const lecturaSinPermiso = registrarLecturaMedidasModista(encRes.estado, modista, encId);
  assert.equal(lecturaSinPermiso.permitido, false);

  const conPermiso = alternarConsentimientoMedidasEncargo(
    encRes.estado,
    clienta,
    encId,
    true,
    { bust: 94, waist: 74, hip: 100 }
  );
  const lecturaOk = registrarLecturaMedidasModista(conPermiso.estado, modista, encId);
  assert.equal(lecturaOk.permitido, true);
  assert.equal(lecturaOk.medidas?.bust, 94);
  assert.ok(lecturaOk.estado.auditoriaMedidas.some((a) => a.encargo_id === encId));

  // Revocar acceso bloquea nueva lectura
  const revocado = alternarConsentimientoMedidasEncargo(
    lecturaOk.estado,
    clienta,
    encId,
    false
  );
  const lecturaRevocada = registrarLecturaMedidasModista(revocado.estado, modista, encId);
  assert.equal(lecturaRevocada.permitido, false);

  // Solo 1 reseña permitida tras aceptar encargo
  const aceptado = actualizarEstadoEncargo(revocado.estado, modista, encId, "aceptada");
  const res1 = publicarResenaEncargo(aceptado.estado, clienta, encId, 5, "Muy cumplida");
  assert.equal(res1.ok, true);
  const res2 = publicarResenaEncargo(res1.estado, clienta, encId, 5, "Intento doble");
  assert.equal(res2.ok, false);

  // 3. Fase 19 & 20: Aislamiento círculo privado y mentoría
  const circPrivado = ESTADO_INICIAL_AMPLIACION.circulos[1];
  assert.equal(puedeLeerPublicacionesCirculo(circPrivado, clienta), false);

  const mNueva = crearSolicitudMentoria(
    ESTADO_INICIAL_AMPLIACION,
    clienta,
    "Necesito ayuda calibrando tensión antes de coser viscosa."
  );
  assert.equal(mNueva.ok, true);
  const mentAccept = aceptarMentoriaComoMentora(
    mNueva.estado,
    modista,
    mNueva.estado.mentorias[0].id
  );
  assert.equal(mentAccept.ok, true);

  // 4. Fase 22 & 23: Rutas y anti-fraude reseña tienda (cuenta nueva < 30 días rechazada, antigua > 30d aceptada)
  const rutaRes = alternarPasoRuta(
    ESTADO_INICIAL_AMPLIACION,
    clienta,
    "ruta-falda-7d",
    "paso-1"
  );
  assert.equal(rutaRes.ok, true);

  const cuentaReciente = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
  const bloqueadaNueva = publicarResenaProveedor(
    ESTADO_INICIAL_AMPLIACION,
    clienta,
    cuentaReciente,
    2,
    {
      proveedor_id: "prov-demo-2",
      calificacion: 5,
      comentario: "Buen surtido de hilos.",
      tiene_relacion_negocio: false,
    }
  );
  assert.equal(bloqueadaNueva.ok, false);

  const cuentaAntigua = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString();
  const resenaPromo = publicarResenaProveedor(
    ESTADO_INICIAL_AMPLIACION,
    clienta,
    cuentaAntigua,
    3,
    {
      proveedor_id: "prov-demo-2",
      calificacion: 5,
      comentario: "Compra ya con este cupón descuento especial 100% recomendado",
      tiene_relacion_negocio: false,
    }
  );
  assert.equal(resenaPromo.ok, true);
  assert.equal(resenaPromo.estado.resenasProveedores[0].marcada_revision, true);

  // 5. Feature Flags: Fase 24 (aiAssistant) bloqueada; demás toggles funcionales
  assert.equal(ESTADO_INICIAL_AMPLIACION.featureFlags.aiAssistant, false);
  const aiToggle = toggleFeatureFlagComunidad(
    ESTADO_INICIAL_AMPLIACION,
    modista,
    "aiAssistant",
    true
  );
  assert.equal(aiToggle.ok, false);

  // 6. Cola offline (fallback node/memory si no hay window)
  const colaMock = await sincronizarColaOffline(async (item: ElementoColaOffline) => ({
    ok: Boolean(item.id),
  }));
  assert.equal(colaMock.errores, 0);

  console.log("FASES_13_25_VERIFICATION_OK: privacidad k>=5, encargos 30d, circulos, anti-fraude, rutas y feature flags OK.");
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});