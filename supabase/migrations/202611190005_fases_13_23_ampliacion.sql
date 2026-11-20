-- Migración 0005: Ampliación Comunidad de Modistas (Fases 13 a 23)
-- Mantiene privacidad por defecto (solo rangos de 5 cm y k >= 5 para agregación),
-- consentimiento temporal revocable para encargos y cero pagos dentro de la plataforma.

ALTER TABLE public.perfiles
  ADD COLUMN IF NOT EXISTS portafolio_trabajos jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS servicios_ofrecidos text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS tiempo_respuesta_horas int CHECK (tiempo_respuesta_horas BETWEEN 1 AND 720),
  ADD COLUMN IF NOT EXISTS verificada_manual boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS nota_verificacion text,
  ADD COLUMN IF NOT EXISTS acepta_mentoria boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS max_aprendices_activos smallint NOT NULL DEFAULT 2 CHECK (max_aprendices_activos BETWEEN 1 AND 5);

-- Fase 13: Retroalimentación rápida de calce (sin medidas exactas: solo rango de 5 cm)
CREATE TABLE IF NOT EXISTS public.retroalimentacion_calce (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  autora_id uuid NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  molde_categoria text NOT NULL,
  version_config int NOT NULL DEFAULT 1,
  rango_busto_5cm text NOT NULL,
  rango_cintura_5cm text NOT NULL,
  rango_cadera_5cm text NOT NULL,
  tela_usada text NOT NULL,
  ajuste_talle text NOT NULL CHECK (ajuste_talle IN ('pequeno', 'perfecto', 'grande')),
  ajuste_busto text NOT NULL CHECK (ajuste_busto IN ('pequeno', 'perfecto', 'grande')),
  ajuste_cintura text NOT NULL CHECK (ajuste_cintura IN ('pequeno', 'perfecto', 'grande')),
  ajuste_cadera text NOT NULL CHECK (ajuste_cadera IN ('pequeno', 'perfecto', 'grande')),
  ajuste_hombros text NOT NULL CHECK (ajuste_hombros IN ('pequeno', 'perfecto', 'grande')),
  ajuste_manga text NOT NULL CHECK (ajuste_manga IN ('pequeno', 'perfecto', 'grande')),
  volveria_hacer boolean NOT NULL DEFAULT true,
  es_probadora_beta boolean NOT NULL DEFAULT false,
  es_demo boolean NOT NULL DEFAULT false,
  creado_en timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.novedades_molde (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  molde_categoria text NOT NULL,
  version_nueva int NOT NULL,
  titulo text NOT NULL,
  resumen text NOT NULL,
  es_demo boolean NOT NULL DEFAULT false,
  creado_en timestamptz NOT NULL DEFAULT now()
);

-- Fase 14: Biblioteca de ajustes que funcionaron (agrupada en rangos de 5 cm, k >= 5)
CREATE TABLE IF NOT EXISTS public.ajustes_molde (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  autora_id uuid NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  molde_categoria text NOT NULL,
  version_config int NOT NULL DEFAULT 1,
  rango_busto_5cm text NOT NULL,
  zona text NOT NULL CHECK (zona IN ('sisa', 'espalda', 'tiro', 'busto', 'cintura', 'cadera', 'largo')),
  cm_delta numeric(4,1) NOT NULL CHECK (cm_delta BETWEEN -15 AND 15),
  descripcion_corta text NOT NULL,
  conteo_me_funciono int NOT NULL DEFAULT 0,
  estado_editorial text NOT NULL DEFAULT 'pendiente' CHECK (estado_editorial IN ('pendiente', 'destacado', 'en_blog')),
  slug_blog text,
  es_demo boolean NOT NULL DEFAULT false,
  creado_en timestamptz NOT NULL DEFAULT now()
);

-- Fase 15: Bitácoras de proyecto por etapas
CREATE TABLE IF NOT EXISTS public.bitacoras_proyecto (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  autora_id uuid NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  prenda text NOT NULL,
  tela text NOT NULL,
  molde_categoria text NOT NULL,
  etapa_actual text NOT NULL CHECK (etapa_actual IN ('molde', 'corte', 'prueba', 'costura', 'terminada')),
  etapas jsonb NOT NULL DEFAULT '[]'::jsonb,
  publicacion_graduada_id uuid REFERENCES public.publicaciones(id) ON DELETE SET NULL,
  es_demo boolean NOT NULL DEFAULT false,
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  creado_en timestamptz NOT NULL DEFAULT now()
);

-- Fase 18: Encargos entre clienta y modista (sin pagos en plataforma + consentimiento revocable 30 días)
CREATE TABLE IF NOT EXISTS public.encargos_modista (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clienta_id uuid NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  modista_id uuid NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  titulo_prenda text NOT NULL,
  config_molde jsonb NOT NULL,
  captura_3d_url text,
  tela_color_deseado text NOT NULL,
  notas_clienta text NOT NULL DEFAULT '',
  estado text NOT NULL DEFAULT 'enviada' CHECK (estado IN ('enviada', 'aceptada', 'rechazada', 'en_proceso', 'entregada', 'cancelada')),
  resena_calificacion smallint CHECK (resena_calificacion BETWEEN 1 AND 5),
  resena_comentario text,
  es_demo boolean NOT NULL DEFAULT false,
  creado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT config_encargo_sin_medidas CHECK (public.config_molde_sin_medidas(config_molde))
);

CREATE TABLE IF NOT EXISTS public.consentimientos_medidas_encargo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  encargo_id uuid NOT NULL REFERENCES public.encargos_modista(id) ON DELETE CASCADE,
  clienta_id uuid NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  modista_id uuid NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  compartido boolean NOT NULL DEFAULT false,
  medidas_snapshot jsonb,
  expira_en timestamptz,
  revocado_en timestamptz,
  creado_en timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.auditoria_accesos_medidas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  encargo_id uuid NOT NULL REFERENCES public.encargos_modista(id) ON DELETE CASCADE,
  consentimiento_id uuid NOT NULL REFERENCES public.consentimientos_medidas_encargo(id) ON DELETE CASCADE,
  visor_id uuid NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  accion text NOT NULL,
  creado_en timestamptz NOT NULL DEFAULT now()
);

-- Fase 19: Círculos de costura
CREATE TABLE IF NOT EXISTS public.circulos_costura (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  tema_o_ciudad text NOT NULL,
  nivel_sugerido text NOT NULL,
  tipo_acceso text NOT NULL DEFAULT 'abierto' CHECK (tipo_acceso IN ('abierto', 'con_solicitud')),
  anfitriona_id uuid NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  archivado_por_inactividad boolean NOT NULL DEFAULT false,
  ultima_actividad_en timestamptz NOT NULL DEFAULT now(),
  es_demo boolean NOT NULL DEFAULT false,
  creado_en timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.miembros_circulo (
  circulo_id uuid NOT NULL REFERENCES public.circulos_costura(id) ON DELETE CASCADE,
  usuaria_id uuid NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  estado text NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'pendiente', 'expulsado')),
  creado_en timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (circulo_id, usuaria_id)
);

-- Fase 20: Mentoría 1 a 1
CREATE TABLE IF NOT EXISTS public.mentorias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aprendiz_id uuid NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  mentora_id uuid REFERENCES public.perfiles(id) ON DELETE SET NULL,
  tema_concreto text NOT NULL,
  estado text NOT NULL DEFAULT 'abierta' CHECK (estado IN ('abierta', 'asignada', 'reenviada', 'cerrada')),
  agradecimiento_me_ayudo boolean NOT NULL DEFAULT false,
  vence_sin_respuesta_en timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  es_demo boolean NOT NULL DEFAULT false,
  creado_en timestamptz NOT NULL DEFAULT now()
);

-- Fase 22: Rutas de aprendizaje y glosario colaborativo
CREATE TABLE IF NOT EXISTS public.progreso_rutas (
  usuaria_id uuid NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  ruta_id text NOT NULL,
  pasos_completados text[] NOT NULL DEFAULT '{}'::text[],
  completada_en timestamptz,
  PRIMARY KEY (usuaria_id, ruta_id)
);

CREATE TABLE IF NOT EXISTS public.glosario_costura (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  termino_base text NOT NULL,
  definicion_clara text NOT NULL,
  variantes_regionales jsonb NOT NULL DEFAULT '{}'::jsonb,
  sugerido_por uuid REFERENCES public.perfiles(id) ON DELETE SET NULL,
  aprobado boolean NOT NULL DEFAULT true,
  es_demo boolean NOT NULL DEFAULT false,
  creado_en timestamptz NOT NULL DEFAULT now()
);

-- Fase 23: Directorio de telas y mercerías (anti-fraude)
CREATE TABLE IF NOT EXISTS public.proveedores_tela (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  ciudad_pais text NOT NULL,
  categoria text NOT NULL,
  descripcion text NOT NULL,
  es_demo boolean NOT NULL DEFAULT false,
  creado_en timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.resenas_proveedor (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proveedor_id uuid NOT NULL REFERENCES public.proveedores_tela(id) ON DELETE CASCADE,
  autora_id uuid NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  calificacion smallint NOT NULL CHECK (calificacion BETWEEN 1 AND 5),
  comentario text NOT NULL,
  tiene_relacion_negocio boolean NOT NULL DEFAULT false,
  respuesta_dueno text,
  marcada_revision boolean NOT NULL DEFAULT false,
  es_demo boolean NOT NULL DEFAULT false,
  creado_en timestamptz NOT NULL DEFAULT now(),
  UNIQUE (proveedor_id, autora_id)
);
