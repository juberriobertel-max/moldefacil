-- ============================================================================
-- MoldeFácil Comunidad: Esquema Inicial de Base de Datos (Fase 1)
-- Tablas, restricciones de privacidad para medidas corporales e índices en español
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Valida de forma recursiva que un JSONB de configuración de molde no filtre
-- claves sensibles de medidas corporales ni objetos de medidas personales.
CREATE OR REPLACE FUNCTION public.config_molde_sin_medidas(cfg jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  WITH RECURSIVE nodos(val) AS (
    SELECT cfg
    UNION ALL
    SELECT child.val
    FROM nodos,
    LATERAL (
      SELECT value AS val FROM jsonb_each(nodos.val) WHERE jsonb_typeof(nodos.val) = 'object'
      UNION ALL
      SELECT value AS val FROM jsonb_array_elements(nodos.val) WHERE jsonb_typeof(nodos.val) = 'array'
    ) AS child
  )
  SELECT cfg IS NOT NULL
    AND jsonb_typeof(cfg) = 'object'
    AND NOT EXISTS (
      SELECT 1
      FROM nodos,
      LATERAL jsonb_object_keys(nodos.val) AS k(clave)
      WHERE jsonb_typeof(nodos.val) = 'object'
        AND k.clave = ANY (ARRAY[
          'bust', 'waist', 'hip', 'backWidth', 'bodiceLength',
          'sleeveLength', 'skirtLength', 'crotchDepth', 'thigh',
          'inseam', 'hemWidth', 'headCircumference', 'measurements',
          'medidas', 'busto', 'cintura', 'cadera'
        ])
    );
$$;

-- 1. Perfiles de modista (sin medidas corporales)
-- Nota: en producción el id coincide con auth.users(id); se omite FK dura
-- para permitir la carga limpia del seed de modistas de demostración (es_demo = true).
CREATE TABLE IF NOT EXISTS public.perfiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre_publico text NOT NULL CHECK (char_length(trim(nombre_publico)) BETWEEN 2 AND 80),
  usuario_unico text NOT NULL UNIQUE CHECK (usuario_unico ~ '^[a-z0-9_]{3,30}$'),
  rol text NOT NULL DEFAULT 'usuaria' CHECK (rol IN ('usuaria', 'moderadora', 'admin')),
  foto text,
  ciudad_pais text CHECK (ciudad_pais IS NULL OR char_length(ciudad_pais) <= 80),
  bio text NOT NULL DEFAULT '' CHECK (char_length(bio) <= 320),
  especialidades text[] NOT NULL DEFAULT '{}',
  nivel text NOT NULL DEFAULT 'aprendiz' CHECK (nivel IN ('aprendiz', 'intermedia', 'profesional')),
  vende_por_encargo boolean NOT NULL DEFAULT false,
  mostrar_contacto boolean NOT NULL DEFAULT false,
  enlace_whatsapp text CHECK (enlace_whatsapp IS NULL OR char_length(enlace_whatsapp) <= 200),
  enlace_instagram text CHECK (enlace_instagram IS NULL OR char_length(enlace_instagram) <= 200),
  visibilidad_perfil text NOT NULL DEFAULT 'publico' CHECK (visibilidad_perfil IN ('publico', 'solo_registradas')),
  permiso_comentarios text NOT NULL DEFAULT 'todas' CHECK (permiso_comentarios IN ('todas', 'seguidoras', 'nadie')),
  resumen_semanal_correo boolean NOT NULL DEFAULT false,
  publicaciones_aprobadas_count integer NOT NULL DEFAULT 0 CHECK (publicaciones_aprobadas_count >= 0),
  suspendida boolean NOT NULL DEFAULT false,
  es_demo boolean NOT NULL DEFAULT false,
  creado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_perfiles_encargo ON public.perfiles (vende_por_encargo) WHERE vende_por_encargo = true;
CREATE INDEX IF NOT EXISTS idx_perfiles_usuario_trgm ON public.perfiles USING gin (usuario_unico gin_trgm_ops);

-- 2. Retos mensuales de costura
CREATE TABLE IF NOT EXISTS public.retos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  titulo text NOT NULL CHECK (char_length(trim(titulo)) BETWEEN 5 AND 140),
  descripcion text NOT NULL,
  reglas text NOT NULL,
  etiqueta_reto text NOT NULL,
  guia_blog_slug text,
  fecha_inicio date NOT NULL,
  fecha_fin date NOT NULL,
  activo boolean NOT NULL DEFAULT false,
  creado_en timestamptz NOT NULL DEFAULT now(),
  CHECK (fecha_fin >= fecha_inicio)
);

-- 3. Publicaciones ("Lo que cosieron")
CREATE TABLE IF NOT EXISTS public.publicaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  autora_id uuid NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  titulo text NOT NULL CHECK (char_length(trim(titulo)) BETWEEN 4 AND 140),
  descripcion text NOT NULL DEFAULT '' CHECK (char_length(descripcion) <= 2000),
  aprendizaje_nota text NOT NULL DEFAULT '' CHECK (char_length(aprendizaje_nota) <= 1000),
  prenda text NOT NULL,
  tela text NOT NULL,
  dificultad smallint NOT NULL CHECK (dificultad BETWEEN 1 AND 5),
  tiempo_horas numeric(5, 1) NOT NULL CHECK (tiempo_horas > 0 AND tiempo_horas <= 500),
  costo_aprox text CHECK (costo_aprox IS NULL OR char_length(costo_aprox) <= 60),
  config_molde jsonb NOT NULL CHECK (public.config_molde_sin_medidas(config_molde)),
  version_config integer NOT NULL DEFAULT 1 CHECK (version_config >= 1),
  captura_3d_url text,
  permiso_fotos_confirmado boolean NOT NULL DEFAULT true CHECK (permiso_fotos_confirmado = true),
  reto_id uuid REFERENCES public.retos(id) ON DELETE SET NULL,
  estado text NOT NULL DEFAULT 'en_revision' CHECK (estado IN ('borrador', 'en_revision', 'publicada', 'oculta')),
  conteo_reacciones integer NOT NULL DEFAULT 0 CHECK (conteo_reacciones >= 0),
  conteo_comentarios integer NOT NULL DEFAULT 0 CHECK (conteo_comentarios >= 0),
  conteo_guardados integer NOT NULL DEFAULT 0 CHECK (conteo_guardados >= 0),
  conteo_remixes integer NOT NULL DEFAULT 0 CHECK (conteo_remixes >= 0),
  es_demo boolean NOT NULL DEFAULT false,
  busqueda_tsv tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('spanish', coalesce(titulo, '')), 'A') ||
    setweight(to_tsvector('spanish', coalesce(prenda, '') || ' ' || coalesce(tela, '')), 'B') ||
    setweight(to_tsvector('spanish', coalesce(descripcion, '') || ' ' || coalesce(aprendizaje_nota, '')), 'C')
  ) STORED,
  creado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_publicaciones_feed ON public.publicaciones (estado, creado_en DESC);
CREATE INDEX IF NOT EXISTS idx_publicaciones_autora ON public.publicaciones (autora_id, creado_en DESC);
CREATE INDEX IF NOT EXISTS idx_publicaciones_filtros ON public.publicaciones (prenda, tela, dificultad) WHERE estado = 'publicada';
CREATE INDEX IF NOT EXISTS idx_publicaciones_tsv ON public.publicaciones USING gin (busqueda_tsv);

-- 4. Fotos de cada publicación (EXIF ya eliminado en cliente y validado en servidor)
CREATE TABLE IF NOT EXISTS public.fotos_publicacion (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  publicacion_id uuid NOT NULL REFERENCES public.publicaciones(id) ON DELETE CASCADE,
  url text NOT NULL,
  alt text NOT NULL CHECK (char_length(trim(alt)) >= 5 AND char_length(alt) <= 220),
  orden smallint NOT NULL DEFAULT 0 CHECK (orden BETWEEN 0 AND 5),
  ancho integer NOT NULL CHECK (ancho > 0 AND ancho <= 4000),
  alto integer NOT NULL CHECK (alto > 0 AND alto <= 4000),
  hash_perceptual text,
  exif_limpio boolean NOT NULL DEFAULT true CHECK (exif_limpio = true),
  creado_en timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fotos_publicacion_orden ON public.fotos_publicacion (publicacion_id, orden);

-- 5. Comentarios anidados a un solo nivel
CREATE TABLE IF NOT EXISTS public.comentarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  publicacion_id uuid NOT NULL REFERENCES public.publicaciones(id) ON DELETE CASCADE,
  autora_id uuid NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  padre_id uuid REFERENCES public.comentarios(id) ON DELETE CASCADE,
  contenido text NOT NULL CHECK (char_length(trim(contenido)) BETWEEN 2 AND 1000),
  menciones text[] NOT NULL DEFAULT '{}',
  oculto boolean NOT NULL DEFAULT false,
  editado_en timestamptz,
  creado_en timestamptz NOT NULL DEFAULT now(),
  CHECK (padre_id IS DISTINCT FROM id)
);

CREATE INDEX IF NOT EXISTS idx_comentarios_pub ON public.comentarios (publicacion_id, creado_en ASC);

-- 6. Reacciones (me_encanta, me_sirvio, inspirador)
CREATE TABLE IF NOT EXISTS public.reacciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuaria_id uuid NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  objeto_tipo text NOT NULL CHECK (objeto_tipo IN ('publicacion', 'respuesta')),
  objeto_id uuid NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('me_encanta', 'me_sirvio', 'inspirador')),
  creado_en timestamptz NOT NULL DEFAULT now(),
  UNIQUE (usuaria_id, objeto_tipo, objeto_id, tipo)
);

CREATE INDEX IF NOT EXISTS idx_reacciones_obj ON public.reacciones (objeto_tipo, objeto_id);

-- 7. Guardados y colecciones personales
CREATE TABLE IF NOT EXISTS public.guardados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuaria_id uuid NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  publicacion_id uuid NOT NULL REFERENCES public.publicaciones(id) ON DELETE CASCADE,
  coleccion text NOT NULL DEFAULT 'Inspiración' CHECK (char_length(trim(coleccion)) BETWEEN 1 AND 60),
  creado_en timestamptz NOT NULL DEFAULT now(),
  UNIQUE (usuaria_id, publicacion_id, coleccion)
);

CREATE INDEX IF NOT EXISTS idx_guardados_usuaria ON public.guardados (usuaria_id, creado_en DESC);

-- 8. Seguidores entre modistas
CREATE TABLE IF NOT EXISTS public.seguidores (
  seguidora_id uuid NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  seguida_id uuid NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  creado_en timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (seguidora_id, seguida_id),
  CHECK (seguidora_id <> seguida_id)
);

-- 9. Preguntas ("Pregúntale a la modista")
CREATE TABLE IF NOT EXISTS public.preguntas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  autora_id uuid NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  titulo text NOT NULL CHECK (char_length(trim(titulo)) BETWEEN 8 AND 160),
  detalle text NOT NULL CHECK (char_length(trim(detalle)) BETWEEN 15 AND 3000),
  categoria text NOT NULL CHECK (categoria IN (
    'medidas',
    'ajustes_molde',
    'telas',
    'costura_acabados',
    'imprimir_armar',
    'negocio_precios'
  )),
  foto_url text,
  foto_alt text CHECK (foto_alt IS NULL OR char_length(trim(foto_alt)) >= 5),
  molde_referencia text,
  config_molde jsonb CHECK (config_molde IS NULL OR public.config_molde_sin_medidas(config_molde)),
  respuesta_aceptada_id uuid,
  resuelta boolean NOT NULL DEFAULT false,
  destacada_semana boolean NOT NULL DEFAULT false,
  articulo_blog_slug text,
  conteo_respuestas integer NOT NULL DEFAULT 0 CHECK (conteo_respuestas >= 0),
  oculto boolean NOT NULL DEFAULT false,
  es_demo boolean NOT NULL DEFAULT false,
  busqueda_tsv tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('spanish', coalesce(titulo, '')), 'A') ||
    setweight(to_tsvector('spanish', coalesce(detalle, '')), 'B')
  ) STORED,
  creado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_preguntas_feed ON public.preguntas (resuelta, creado_en DESC) WHERE oculto = false;
CREATE INDEX IF NOT EXISTS idx_preguntas_tsv ON public.preguntas USING gin (busqueda_tsv);
CREATE INDEX IF NOT EXISTS idx_preguntas_titulo_trgm ON public.preguntas USING gin (titulo gin_trgm_ops);

-- 10. Respuestas a preguntas
CREATE TABLE IF NOT EXISTS public.respuestas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pregunta_id uuid NOT NULL REFERENCES public.preguntas(id) ON DELETE CASCADE,
  autora_id uuid NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  contenido text NOT NULL CHECK (char_length(trim(contenido)) BETWEEN 10 AND 3000),
  foto_url text,
  foto_alt text CHECK (foto_alt IS NULL OR char_length(trim(foto_alt)) >= 5),
  es_aceptada boolean NOT NULL DEFAULT false,
  conteo_me_sirvio integer NOT NULL DEFAULT 0 CHECK (conteo_me_sirvio >= 0),
  oculto boolean NOT NULL DEFAULT false,
  creado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.preguntas
  DROP CONSTRAINT IF EXISTS fk_preguntas_respuesta_aceptada;
ALTER TABLE public.preguntas
  ADD CONSTRAINT fk_preguntas_respuesta_aceptada
  FOREIGN KEY (respuesta_aceptada_id) REFERENCES public.respuestas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_respuestas_pregunta ON public.respuestas (pregunta_id, es_aceptada DESC, conteo_me_sirvio DESC, creado_en ASC);

-- 11. Etiquetas ligadas a selectores del generador + puente N:M
CREATE TABLE IF NOT EXISTS public.etiquetas (
  id text PRIMARY KEY,
  nombre text NOT NULL,
  grupo_selector text NOT NULL CHECK (grupo_selector IN ('escote', 'manga', 'pinzas', 'tela', 'ajuste', 'general')),
  valor_selector text
);

CREATE TABLE IF NOT EXISTS public.pregunta_etiquetas (
  pregunta_id uuid NOT NULL REFERENCES public.preguntas(id) ON DELETE CASCADE,
  etiqueta_id text NOT NULL REFERENCES public.etiquetas(id) ON DELETE CASCADE,
  PRIMARY KEY (pregunta_id, etiqueta_id)
);

-- 12. Participaciones y votos únicos en retos mensuales
CREATE TABLE IF NOT EXISTS public.participaciones_reto (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reto_id uuid NOT NULL REFERENCES public.retos(id) ON DELETE CASCADE,
  publicacion_id uuid NOT NULL REFERENCES public.publicaciones(id) ON DELETE CASCADE,
  autora_id uuid NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  destacada_moderacion boolean NOT NULL DEFAULT false,
  conteo_votos integer NOT NULL DEFAULT 0 CHECK (conteo_votos >= 0),
  creado_en timestamptz NOT NULL DEFAULT now(),
  UNIQUE (reto_id, publicacion_id)
);

CREATE TABLE IF NOT EXISTS public.votos_reto (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reto_id uuid NOT NULL REFERENCES public.retos(id) ON DELETE CASCADE,
  participacion_id uuid NOT NULL REFERENCES public.participaciones_reto(id) ON DELETE CASCADE,
  votante_id uuid NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  creado_en timestamptz NOT NULL DEFAULT now(),
  UNIQUE (reto_id, votante_id)
);

-- 13. Insignias amables y no competitivas
CREATE TABLE IF NOT EXISTS public.insignias (
  id text PRIMARY KEY,
  nombre text NOT NULL,
  descripcion text NOT NULL,
  icono text NOT NULL
);

CREATE TABLE IF NOT EXISTS public.insignias_usuaria (
  usuaria_id uuid NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  insignia_id text NOT NULL REFERENCES public.insignias(id) ON DELETE CASCADE,
  otorgada_en timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (usuaria_id, insignia_id)
);

-- 14. Reportes de moderación
CREATE TABLE IF NOT EXISTS public.reportes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reportante_id uuid NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  objeto_tipo text NOT NULL CHECK (objeto_tipo IN ('publicacion', 'comentario', 'pregunta', 'respuesta')),
  objeto_id uuid NOT NULL,
  motivo text NOT NULL CHECK (motivo IN (
    'spam',
    'falta_respeto',
    'fotos_sin_permiso',
    'contenido_sexual',
    'menores_identificables',
    'derechos_autor',
    'otro'
  )),
  detalle text CHECK (detalle IS NULL OR char_length(detalle) <= 600),
  estado text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'en_revision', 'resuelto', 'descartado')),
  resuelto_por uuid REFERENCES public.perfiles(id) ON DELETE SET NULL,
  nota_moderacion text,
  creado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reportes_estado ON public.reportes (estado, creado_en ASC);

-- 15. Bloqueos entre usuarias
CREATE TABLE IF NOT EXISTS public.bloqueos (
  bloqueadora_id uuid NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  bloqueada_id uuid NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  creado_en timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (bloqueadora_id, bloqueada_id),
  CHECK (bloqueadora_id <> bloqueada_id)
);

-- 16. Notificaciones dentro de la app
CREATE TABLE IF NOT EXISTS public.notificaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuaria_id uuid NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  tipo text NOT NULL,
  titulo text NOT NULL,
  mensaje text NOT NULL,
  enlace text,
  leida boolean NOT NULL DEFAULT false,
  creado_en timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notificaciones_usuaria ON public.notificaciones (usuaria_id, leida, creado_en DESC);

-- 17. Recursos descargables gratuitos
CREATE TABLE IF NOT EXISTS public.descargables (
  id text PRIMARY KEY,
  titulo text NOT NULL,
  descripcion text NOT NULL,
  categoria text NOT NULL,
  version text NOT NULL,
  fecha_actualizacion date NOT NULL,
  url_archivo text NOT NULL,
  conteo_descargas integer NOT NULL DEFAULT 0 CHECK (conteo_descargas >= 0)
);
