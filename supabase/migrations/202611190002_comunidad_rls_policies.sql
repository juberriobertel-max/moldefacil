-- ============================================================================
-- MoldeFácil Comunidad: Políticas RLS, Triggers de Moderación y Privacidad
-- Roles: usuaria, moderadora, admin
-- ============================================================================

-- Funciones auxiliares de autorización
CREATE OR REPLACE FUNCTION public.rol_actual(uid uuid DEFAULT auth.uid())
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT p.rol FROM public.perfiles p WHERE p.id = uid LIMIT 1),
    'usuaria'
  );
$$;

CREATE OR REPLACE FUNCTION public.es_moderadora_o_admin(uid uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.perfiles p
    WHERE p.id = uid
      AND p.rol IN ('moderadora', 'admin')
      AND p.suspendida = false
  );
$$;

CREATE OR REPLACE FUNCTION public.hay_bloqueo_entre(a uuid, b uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN a IS NULL OR b IS NULL THEN false
    ELSE EXISTS (
      SELECT 1
      FROM public.bloqueos bl
      WHERE (bl.bloqueadora_id = a AND bl.bloqueada_id = b)
         OR (bl.bloqueadora_id = b AND bl.bloqueada_id = a)
    )
  END;
$$;

-- Trigger 1: Las usuarias nuevas pasan a revisión antes de su primera publicación pública
CREATE OR REPLACE FUNCTION public.forzar_revision_primera_publicacion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_aprobadas integer;
  v_rol text;
  v_suspendida boolean;
BEGIN
  SELECT p.publicaciones_aprobadas_count, p.rol, p.suspendida
  INTO v_aprobadas, v_rol, v_suspendida
  FROM public.perfiles p
  WHERE p.id = NEW.autora_id;

  IF v_suspendida THEN
    RAISE EXCEPTION 'Tu cuenta está suspendida temporalmente para publicar.';
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.estado <> 'borrador' AND v_rol = 'usuaria' AND COALESCE(v_aprobadas, 0) = 0 THEN
      NEW.estado := 'en_revision';
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.estado = 'publicada' AND OLD.estado <> 'publicada' AND NOT public.es_moderadora_o_admin(auth.uid()) THEN
      IF COALESCE(v_aprobadas, 0) = 0 THEN
        NEW.estado := 'en_revision';
      END IF;
    END IF;
  END IF;

  NEW.actualizado_en := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_forzar_revision_primera_pub ON public.publicaciones;
CREATE TRIGGER trg_forzar_revision_primera_pub
  BEFORE INSERT OR UPDATE ON public.publicaciones
  FOR EACH ROW
  EXECUTE FUNCTION public.forzar_revision_primera_publicacion();

-- Trigger 2: Comentarios solo anidados a 1 nivel y editables dentro de 15 minutos
CREATE OR REPLACE FUNCTION public.validar_comentario_reglas()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_abuelo uuid;
BEGIN
  IF NEW.padre_id IS NOT NULL THEN
    SELECT c.padre_id INTO v_abuelo
    FROM public.comentarios c
    WHERE c.id = NEW.padre_id;

    IF v_abuelo IS NOT NULL THEN
      RAISE EXCEPTION 'Solo se permite un nivel de respuesta en comentarios.';
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' AND NOT public.es_moderadora_o_admin(auth.uid()) THEN
    IF OLD.contenido IS DISTINCT FROM NEW.contenido AND (now() - OLD.creado_en) > interval '15 minutes' THEN
      RAISE EXCEPTION 'El tiempo límite de 15 minutos para editar este comentario ya expiró.';
    END IF;
    NEW.editado_en := now();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_comentario ON public.comentarios;
CREATE TRIGGER trg_validar_comentario
  BEFORE INSERT OR UPDATE ON public.comentarios
  FOR EACH ROW
  EXECUTE FUNCTION public.validar_comentario_reglas();

-- Trigger 3: Blindar que una usuaria normal no escale su propio rol ni marque publicaciones aprobadas
CREATE OR REPLACE FUNCTION public.proteger_campos_sensibles_perfil()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.es_moderadora_o_admin(auth.uid()) THEN
    NEW.rol := OLD.rol;
    NEW.suspendida := OLD.suspendida;
    NEW.publicaciones_aprobadas_count := OLD.publicaciones_aprobadas_count;
  END IF;
  NEW.actualizado_en := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_proteger_perfil ON public.perfiles;
CREATE TRIGGER trg_proteger_perfil
  BEFORE UPDATE ON public.perfiles
  FOR EACH ROW
  EXECUTE FUNCTION public.proteger_campos_sensibles_perfil();

-- ============================================================================
-- Activación de Row Level Security (RLS) en todas las tablas
-- ============================================================================
ALTER TABLE public.perfiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.publicaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fotos_publicacion ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comentarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reacciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guardados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seguidores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.preguntas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.respuestas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.etiquetas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pregunta_etiquetas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.participaciones_reto ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.votos_reto ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insignias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insignias_usuaria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reportes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bloqueos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notificaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.descargables ENABLE ROW LEVEL SECURITY;

-- PERFILES
DROP POLICY IF EXISTS "perfiles_select" ON public.perfiles;
CREATE POLICY "perfiles_select" ON public.perfiles
  FOR SELECT USING (
    id = auth.uid()
    OR public.es_moderadora_o_admin(auth.uid())
    OR (
      suspendida = false
      AND NOT public.hay_bloqueo_entre(auth.uid(), id)
      AND (visibilidad_perfil = 'publico' OR auth.uid() IS NOT NULL)
    )
  );

DROP POLICY IF EXISTS "perfiles_insert_propio" ON public.perfiles;
CREATE POLICY "perfiles_insert_propio" ON public.perfiles
  FOR INSERT WITH CHECK (id = auth.uid() AND rol = 'usuaria' AND suspendida = false);

DROP POLICY IF EXISTS "perfiles_update_propio_o_admin" ON public.perfiles;
CREATE POLICY "perfiles_update_propio_o_admin" ON public.perfiles
  FOR UPDATE USING (id = auth.uid() OR public.es_moderadora_o_admin(auth.uid()))
  WITH CHECK (id = auth.uid() OR public.es_moderadora_o_admin(auth.uid()));

-- PUBLICACIONES (ocultas/borrador/en_revision solo visibles por autora y moderación)
DROP POLICY IF EXISTS "publicaciones_select" ON public.publicaciones;
CREATE POLICY "publicaciones_select" ON public.publicaciones
  FOR SELECT USING (
    (estado = 'publicada' AND NOT public.hay_bloqueo_entre(auth.uid(), autora_id))
    OR autora_id = auth.uid()
    OR public.es_moderadora_o_admin(auth.uid())
  );

DROP POLICY IF EXISTS "publicaciones_insert" ON public.publicaciones;
CREATE POLICY "publicaciones_insert" ON public.publicaciones
  FOR INSERT WITH CHECK (autora_id = auth.uid());

DROP POLICY IF EXISTS "publicaciones_update" ON public.publicaciones;
CREATE POLICY "publicaciones_update" ON public.publicaciones
  FOR UPDATE USING (autora_id = auth.uid() OR public.es_moderadora_o_admin(auth.uid()))
  WITH CHECK (autora_id = auth.uid() OR public.es_moderadora_o_admin(auth.uid()));

DROP POLICY IF EXISTS "publicaciones_delete" ON public.publicaciones;
CREATE POLICY "publicaciones_delete" ON public.publicaciones
  FOR DELETE USING (autora_id = auth.uid() OR public.rol_actual(auth.uid()) = 'admin');

-- FOTOS DE PUBLICACIÓN
DROP POLICY IF EXISTS "fotos_pub_select" ON public.fotos_publicacion;
CREATE POLICY "fotos_pub_select" ON public.fotos_publicacion
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.publicaciones p
      WHERE p.id = publicacion_id
        AND (p.estado = 'publicada' OR p.autora_id = auth.uid() OR public.es_moderadora_o_admin(auth.uid()))
    )
  );

DROP POLICY IF EXISTS "fotos_pub_manage_autora" ON public.fotos_publicacion;
CREATE POLICY "fotos_pub_manage_autora" ON public.fotos_publicacion
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.publicaciones p
      WHERE p.id = publicacion_id AND (p.autora_id = auth.uid() OR public.es_moderadora_o_admin(auth.uid()))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.publicaciones p
      WHERE p.id = publicacion_id AND p.autora_id = auth.uid()
    )
  );

-- COMENTARIOS
DROP POLICY IF EXISTS "comentarios_select" ON public.comentarios;
CREATE POLICY "comentarios_select" ON public.comentarios
  FOR SELECT USING (
    (oculto = false AND NOT public.hay_bloqueo_entre(auth.uid(), autora_id))
    OR autora_id = auth.uid()
    OR public.es_moderadora_o_admin(auth.uid())
  );

DROP POLICY IF EXISTS "comentarios_insert" ON public.comentarios;
CREATE POLICY "comentarios_insert" ON public.comentarios
  FOR INSERT WITH CHECK (
    autora_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.publicaciones p
      WHERE p.id = publicacion_id
        AND p.estado = 'publicada'
        AND NOT public.hay_bloqueo_entre(auth.uid(), p.autora_id)
    )
  );

DROP POLICY IF EXISTS "comentarios_update" ON public.comentarios;
CREATE POLICY "comentarios_update" ON public.comentarios
  FOR UPDATE USING (autora_id = auth.uid() OR public.es_moderadora_o_admin(auth.uid()))
  WITH CHECK (autora_id = auth.uid() OR public.es_moderadora_o_admin(auth.uid()));

DROP POLICY IF EXISTS "comentarios_delete" ON public.comentarios;
CREATE POLICY "comentarios_delete" ON public.comentarios
  FOR DELETE USING (autora_id = auth.uid() OR public.es_moderadora_o_admin(auth.uid()));

-- REACCIONES, GUARDADOS Y SEGUIDORES
DROP POLICY IF EXISTS "reacciones_select" ON public.reacciones;
CREATE POLICY "reacciones_select" ON public.reacciones FOR SELECT USING (true);

DROP POLICY IF EXISTS "reacciones_manage_propia" ON public.reacciones;
CREATE POLICY "reacciones_manage_propia" ON public.reacciones
  FOR ALL USING (usuaria_id = auth.uid())
  WITH CHECK (usuaria_id = auth.uid());

DROP POLICY IF EXISTS "guardados_solo_propia" ON public.guardados;
CREATE POLICY "guardados_solo_propia" ON public.guardados
  FOR ALL USING (usuaria_id = auth.uid())
  WITH CHECK (usuaria_id = auth.uid());

DROP POLICY IF EXISTS "seguidores_select" ON public.seguidores;
CREATE POLICY "seguidores_select" ON public.seguidores FOR SELECT USING (true);

DROP POLICY IF EXISTS "seguidores_manage_propia" ON public.seguidores;
CREATE POLICY "seguidores_manage_propia" ON public.seguidores
  FOR ALL USING (seguidora_id = auth.uid())
  WITH CHECK (seguidora_id = auth.uid() AND NOT public.hay_bloqueo_entre(seguidora_id, seguida_id));

-- PREGUNTAS Y RESPUESTAS
DROP POLICY IF EXISTS "preguntas_select" ON public.preguntas;
CREATE POLICY "preguntas_select" ON public.preguntas
  FOR SELECT USING (
    (oculto = false AND NOT public.hay_bloqueo_entre(auth.uid(), autora_id))
    OR autora_id = auth.uid()
    OR public.es_moderadora_o_admin(auth.uid())
  );

DROP POLICY IF EXISTS "preguntas_insert" ON public.preguntas;
CREATE POLICY "preguntas_insert" ON public.preguntas
  FOR INSERT WITH CHECK (autora_id = auth.uid());

DROP POLICY IF EXISTS "preguntas_update" ON public.preguntas;
CREATE POLICY "preguntas_update" ON public.preguntas
  FOR UPDATE USING (autora_id = auth.uid() OR public.es_moderadora_o_admin(auth.uid()))
  WITH CHECK (autora_id = auth.uid() OR public.es_moderadora_o_admin(auth.uid()));

DROP POLICY IF EXISTS "preguntas_delete" ON public.preguntas;
CREATE POLICY "preguntas_delete" ON public.preguntas
  FOR DELETE USING (autora_id = auth.uid() OR public.rol_actual(auth.uid()) = 'admin');

DROP POLICY IF EXISTS "respuestas_select" ON public.respuestas;
CREATE POLICY "respuestas_select" ON public.respuestas
  FOR SELECT USING (
    oculto = false
    OR autora_id = auth.uid()
    OR public.es_moderadora_o_admin(auth.uid())
  );

DROP POLICY IF EXISTS "respuestas_insert" ON public.respuestas;
CREATE POLICY "respuestas_insert" ON public.respuestas
  FOR INSERT WITH CHECK (autora_id = auth.uid());

DROP POLICY IF EXISTS "respuestas_update" ON public.respuestas;
CREATE POLICY "respuestas_update" ON public.respuestas
  FOR UPDATE USING (autora_id = auth.uid() OR public.es_moderadora_o_admin(auth.uid()))
  WITH CHECK (autora_id = auth.uid() OR public.es_moderadora_o_admin(auth.uid()));

DROP POLICY IF EXISTS "respuestas_delete" ON public.respuestas;
CREATE POLICY "respuestas_delete" ON public.respuestas
  FOR DELETE USING (autora_id = auth.uid() OR public.es_moderadora_o_admin(auth.uid()));

-- ETIQUETAS, INSIGNIAS, RETOS Y DESCARGABLES
DROP POLICY IF EXISTS "etiquetas_select" ON public.etiquetas;
CREATE POLICY "etiquetas_select" ON public.etiquetas FOR SELECT USING (true);

DROP POLICY IF EXISTS "pregunta_etiquetas_select" ON public.pregunta_etiquetas;
CREATE POLICY "pregunta_etiquetas_select" ON public.pregunta_etiquetas FOR SELECT USING (true);

DROP POLICY IF EXISTS "pregunta_etiquetas_insert" ON public.pregunta_etiquetas;
CREATE POLICY "pregunta_etiquetas_insert" ON public.pregunta_etiquetas
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.preguntas q WHERE q.id = pregunta_id AND q.autora_id = auth.uid())
  );

DROP POLICY IF EXISTS "retos_select" ON public.retos;
CREATE POLICY "retos_select" ON public.retos FOR SELECT USING (true);

DROP POLICY IF EXISTS "retos_admin" ON public.retos;
CREATE POLICY "retos_admin" ON public.retos
  FOR ALL USING (public.es_moderadora_o_admin(auth.uid()))
  WITH CHECK (public.es_moderadora_o_admin(auth.uid()));

DROP POLICY IF EXISTS "participaciones_select" ON public.participaciones_reto;
CREATE POLICY "participaciones_select" ON public.participaciones_reto FOR SELECT USING (true);

DROP POLICY IF EXISTS "participaciones_insert" ON public.participaciones_reto;
CREATE POLICY "participaciones_insert" ON public.participaciones_reto
  FOR INSERT WITH CHECK (autora_id = auth.uid());

DROP POLICY IF EXISTS "votos_reto_select" ON public.votos_reto;
CREATE POLICY "votos_reto_select" ON public.votos_reto FOR SELECT USING (votante_id = auth.uid() OR public.es_moderadora_o_admin(auth.uid()));

DROP POLICY IF EXISTS "votos_reto_insert" ON public.votos_reto;
CREATE POLICY "votos_reto_insert" ON public.votos_reto
  FOR INSERT WITH CHECK (votante_id = auth.uid());

DROP POLICY IF EXISTS "insignias_select" ON public.insignias;
CREATE POLICY "insignias_select" ON public.insignias FOR SELECT USING (true);

DROP POLICY IF EXISTS "insignias_usuaria_select" ON public.insignias_usuaria;
CREATE POLICY "insignias_usuaria_select" ON public.insignias_usuaria FOR SELECT USING (true);

DROP POLICY IF EXISTS "insignias_usuaria_mod" ON public.insignias_usuaria;
CREATE POLICY "insignias_usuaria_mod" ON public.insignias_usuaria
  FOR ALL USING (public.es_moderadora_o_admin(auth.uid()))
  WITH CHECK (public.es_moderadora_o_admin(auth.uid()));

-- REPORTES, BLOQUEOS Y NOTIFICACIONES
DROP POLICY IF EXISTS "reportes_insert" ON public.reportes;
CREATE POLICY "reportes_insert" ON public.reportes
  FOR INSERT WITH CHECK (reportante_id = auth.uid());

DROP POLICY IF EXISTS "reportes_select" ON public.reportes;
CREATE POLICY "reportes_select" ON public.reportes
  FOR SELECT USING (reportante_id = auth.uid() OR public.es_moderadora_o_admin(auth.uid()));

DROP POLICY IF EXISTS "reportes_update_mod" ON public.reportes;
CREATE POLICY "reportes_update_mod" ON public.reportes
  FOR UPDATE USING (public.es_moderadora_o_admin(auth.uid()))
  WITH CHECK (public.es_moderadora_o_admin(auth.uid()));

DROP POLICY IF EXISTS "bloqueos_propios" ON public.bloqueos;
CREATE POLICY "bloqueos_propios" ON public.bloqueos
  FOR ALL USING (bloqueadora_id = auth.uid())
  WITH CHECK (bloqueadora_id = auth.uid());

DROP POLICY IF EXISTS "notificaciones_propias" ON public.notificaciones;
CREATE POLICY "notificaciones_propias" ON public.notificaciones
  FOR ALL USING (usuaria_id = auth.uid())
  WITH CHECK (usuaria_id = auth.uid());

DROP POLICY IF EXISTS "descargables_select" ON public.descargables;
CREATE POLICY "descargables_select" ON public.descargables FOR SELECT USING (true);
