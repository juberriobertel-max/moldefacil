-- Migración 0006: Row Level Security (Fases 13 a 23) + semillas de demostración (es_demo = true)

ALTER TABLE public.retroalimentacion_calce ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.novedades_molde ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ajustes_molde ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bitacoras_proyecto ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.encargos_modista ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consentimientos_medidas_encargo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auditoria_accesos_medidas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.circulos_costura ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.miembros_circulo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mentorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.progreso_rutas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.glosario_costura ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proveedores_tela ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resenas_proveedor ENABLE ROW LEVEL SECURITY;

-- Retroalimentación y ajustes agregados
DROP POLICY IF EXISTS calce_select ON public.retroalimentacion_calce;
CREATE POLICY calce_select ON public.retroalimentacion_calce
  FOR SELECT USING (autora_id = auth.uid() OR es_demo = true OR public.es_moderadora_o_admin());
DROP POLICY IF EXISTS calce_insert ON public.retroalimentacion_calce;
CREATE POLICY calce_insert ON public.retroalimentacion_calce
  FOR INSERT WITH CHECK (autora_id = auth.uid());

DROP POLICY IF EXISTS novedades_select ON public.novedades_molde;
CREATE POLICY novedades_select ON public.novedades_molde FOR SELECT USING (true);

DROP POLICY IF EXISTS ajustes_select ON public.ajustes_molde;
CREATE POLICY ajustes_select ON public.ajustes_molde FOR SELECT USING (true);
DROP POLICY IF EXISTS ajustes_insert ON public.ajustes_molde;
CREATE POLICY ajustes_insert ON public.ajustes_molde
  FOR INSERT WITH CHECK (autora_id = auth.uid());

-- Bitácoras privadas de su autora salvo cuando son demostración
DROP POLICY IF EXISTS bitacoras_owner ON public.bitacoras_proyecto;
CREATE POLICY bitacoras_owner ON public.bitacoras_proyecto
  FOR ALL USING (autora_id = auth.uid() OR es_demo = true OR public.es_moderadora_o_admin())
  WITH CHECK (autora_id = auth.uid());

-- Encargos: solo clienta, modista asignada y moderación
DROP POLICY IF EXISTS encargos_partes ON public.encargos_modista;
CREATE POLICY encargos_partes ON public.encargos_modista
  FOR ALL USING (clienta_id = auth.uid() OR modista_id = auth.uid() OR public.es_moderadora_o_admin())
  WITH CHECK (clienta_id = auth.uid() OR modista_id = auth.uid());

-- Consentimiento y auditoría de medidas temporales
DROP POLICY IF EXISTS consentimiento_clienta ON public.consentimientos_medidas_encargo;
CREATE POLICY consentimiento_clienta ON public.consentimientos_medidas_encargo
  FOR ALL USING (clienta_id = auth.uid() OR modista_id = auth.uid())
  WITH CHECK (clienta_id = auth.uid());

DROP POLICY IF EXISTS consentimiento_modista_lectura_vigente ON public.consentimientos_medidas_encargo;
CREATE POLICY consentimiento_modista_lectura_vigente ON public.consentimientos_medidas_encargo
  FOR SELECT USING (
    clienta_id = auth.uid()
    OR (
      modista_id = auth.uid()
      AND compartido = true
      AND revocado_en IS NULL
      AND (expira_en IS NULL OR expira_en > now())
    )
  );

DROP POLICY IF EXISTS auditoria_medidas_select ON public.auditoria_accesos_medidas;
CREATE POLICY auditoria_medidas_select ON public.auditoria_accesos_medidas
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.encargos_modista e
      WHERE e.id = encargo_id AND (e.clienta_id = auth.uid() OR e.modista_id = auth.uid())
    )
  );
DROP POLICY IF EXISTS auditoria_medidas_insert ON public.auditoria_accesos_medidas;
CREATE POLICY auditoria_medidas_insert ON public.auditoria_accesos_medidas
  FOR INSERT WITH CHECK (visor_id = auth.uid());

-- Círculos y membresía
DROP POLICY IF EXISTS circulos_select ON public.circulos_costura;
CREATE POLICY circulos_select ON public.circulos_costura FOR SELECT USING (true);
DROP POLICY IF EXISTS miembros_circulo_select ON public.miembros_circulo;
CREATE POLICY miembros_circulo_select ON public.miembros_circulo
  FOR SELECT USING (
    usuaria_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.miembros_circulo mc WHERE mc.circulo_id = circulo_id AND mc.usuaria_id = auth.uid() AND mc.estado = 'activo')
  );

-- Mentoría 1 a 1
DROP POLICY IF EXISTS mentorias_partes ON public.mentorias;
CREATE POLICY mentorias_partes ON public.mentorias
  FOR ALL USING (aprendiz_id = auth.uid() OR mentora_id = auth.uid() OR estado = 'abierta' OR public.es_moderadora_o_admin())
  WITH CHECK (aprendiz_id = auth.uid() OR mentora_id = auth.uid());

-- Rutas, glosario y proveedores (anti-fraude: cuenta >= 30 días o moderación en aplicación)
DROP POLICY IF EXISTS progreso_rutas_owner ON public.progreso_rutas;
CREATE POLICY progreso_rutas_owner ON public.progreso_rutas
  FOR ALL USING (usuaria_id = auth.uid()) WITH CHECK (usuaria_id = auth.uid());

DROP POLICY IF EXISTS glosario_select ON public.glosario_costura;
CREATE POLICY glosario_select ON public.glosario_costura FOR SELECT USING (aprobado = true OR sugerido_por = auth.uid());

DROP POLICY IF EXISTS proveedores_select ON public.proveedores_tela;
CREATE POLICY proveedores_select ON public.proveedores_tela FOR SELECT USING (true);

DROP POLICY IF EXISTS resenas_prov_select ON public.resenas_proveedor;
CREATE POLICY resenas_prov_select ON public.resenas_proveedor FOR SELECT USING (true);
DROP POLICY IF EXISTS resenas_prov_insert ON public.resenas_proveedor;
CREATE POLICY resenas_prov_insert ON public.resenas_proveedor
  FOR INSERT WITH CHECK (
    autora_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.perfiles p
      WHERE p.id = auth.uid() AND p.creado_en <= now() - interval '30 days'
    )
  );

-- Semillas de ejemplo claramente marcadas es_demo = true
INSERT INTO public.novedades_molde (molde_categoria, version_nueva, titulo, resumen, es_demo)
VALUES ('dress', 2, 'Sisa más cómoda en Vestido Base v2', 'Ajustamos 0.6 cm la curva delantera gracias a 18 reportes reales de modistas.', true)
ON CONFLICT DO NOTHING;

INSERT INTO public.glosario_costura (termino_base, definicion_clara, variantes_regionales, aprobado, es_demo)
VALUES
  ('Cierre', 'Sistema dentado para abrir y cerrar prendas.', '{"Colombia":"Cremallera / Cierre","México":"Cierre","España":"Cremallera","Argentina":"Cierre"}', true, true),
  ('Dobladillo', 'Terminación doblada hacia el revés en el borde inferior de faldas o pantalones.', '{"Colombia":"Ruedo","México":"Bastilla / Dobladillo","Argentina":"Ruedo / Dobladillo","Perú":"Basta"}', true, true)
ON CONFLICT DO NOTHING;
