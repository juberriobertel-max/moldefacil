-- ============================================================================
-- MoldeFácil Fase 0B: Cuentas, Autenticación, Seguridad, Medidas Privadas
-- y Soporte de Publicaciones de Modas Reales + Eliminación
-- ============================================================================

-- 1. Ampliación de perfiles para cumplimiento, verificación de correo y 2FA
ALTER TABLE public.perfiles
  ADD COLUMN IF NOT EXISTS correo_verificado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS acepto_terminos_en timestamptz,
  ADD COLUMN IF NOT EXISTS version_terminos text,
  ADD COLUMN IF NOT EXISTS acepto_datos_en timestamptz,
  ADD COLUMN IF NOT EXISTS version_datos text,
  ADD COLUMN IF NOT EXISTS mayor_edad_confirmada boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS dos_fa_activo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pendiente_eliminacion_hasta timestamptz;

-- 2. Ampliación de publicaciones: permitir "Modas reales" sin config_molde obligatoria
ALTER TABLE public.publicaciones
  ADD COLUMN IF NOT EXISTS tipo_publicacion text NOT NULL DEFAULT 'molde_plataforma'
    CHECK (tipo_publicacion IN ('molde_plataforma', 'moda_real')),
  ADD COLUMN IF NOT EXISTS referencia_inspiracion text CHECK (referencia_inspiracion IS NULL OR char_length(referencia_inspiracion) <= 180);

ALTER TABLE public.publicaciones
  ALTER COLUMN config_molde DROP NOT NULL;

ALTER TABLE public.publicaciones
  DROP CONSTRAINT IF EXISTS publicaciones_config_molde_check;

ALTER TABLE public.publicaciones
  ADD CONSTRAINT publicaciones_config_molde_requerida_o_moda_real CHECK (
    (tipo_publicacion = 'moda_real' AND (config_molde IS NULL OR public.config_molde_sin_medidas(config_molde)))
    OR
    (tipo_publicacion = 'molde_plataforma' AND config_molde IS NOT NULL AND public.config_molde_sin_medidas(config_molde))
  );

-- Política de eliminación de publicaciones propias (autora o admin)
DROP POLICY IF EXISTS "publicaciones_delete_owner_or_admin" ON public.publicaciones;
CREATE POLICY "publicaciones_delete_owner_or_admin"
  ON public.publicaciones FOR DELETE
  USING (
    auth.uid() = autora_id
    OR EXISTS (
      SELECT 1 FROM public.perfiles p
      WHERE p.id = auth.uid() AND p.rol IN ('moderadora', 'admin')
    )
  );

-- 3. Medidas privadas ligadas a cuenta (NUNCA públicas, RLS estricto)
CREATE TABLE IF NOT EXISTS public.medidas_privadas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuaria_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre_perfil text NOT NULL CHECK (char_length(trim(nombre_perfil)) BETWEEN 1 AND 80),
  telefono_nota text,
  notas text,
  medidas_cm jsonb NOT NULL,
  origen_local_id text,
  creado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  UNIQUE (usuaria_id, origen_local_id)
);

ALTER TABLE public.medidas_privadas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "medidas_privadas_only_owner" ON public.medidas_privadas;
CREATE POLICY "medidas_privadas_only_owner"
  ON public.medidas_privadas FOR ALL
  USING (auth.uid() = usuaria_id)
  WITH CHECK (auth.uid() = usuaria_id);

-- 4. Pedidos privados del taller sincronizados desde Mi Taller
CREATE TABLE IF NOT EXISTS public.pedidos_taller_privados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuaria_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  clienta_nombre text NOT NULL,
  descripcion_prenda text NOT NULL,
  fecha_entrega text,
  precio_total numeric NOT NULL DEFAULT 0,
  abono numeric NOT NULL DEFAULT 0,
  moneda text NOT NULL DEFAULT 'COP',
  estado text NOT NULL DEFAULT 'En proceso',
  origen_local_id text,
  creado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  UNIQUE (usuaria_id, origen_local_id)
);

ALTER TABLE public.pedidos_taller_privados ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pedidos_taller_only_owner" ON public.pedidos_taller_privados;
CREATE POLICY "pedidos_taller_only_owner"
  ON public.pedidos_taller_privados FOR ALL
  USING (auth.uid() = usuaria_id)
  WITH CHECK (auth.uid() = usuaria_id);

-- 5. Registro de eventos de seguridad visible por la propia usuaria
CREATE TABLE IF NOT EXISTS public.sesiones_y_eventos_seguridad (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuaria_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo_evento text NOT NULL CHECK (
    tipo_evento IN (
      'registro',
      'inicio_sesion',
      'inicio_sospechoso',
      'cierre_global',
      'cambio_contrasena',
      'recuperacion_contrasena',
      'cambio_correo',
      'vinculacion_google',
      'activacion_2fa',
      'solicitud_eliminacion',
      'cancelacion_eliminacion',
      'migracion_datos_locales'
    )
  ),
  descripcion text NOT NULL,
  ip_enmascarada text,
  dispositivo text,
  creado_en timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sesiones_y_eventos_seguridad ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "eventos_seguridad_only_owner_read" ON public.sesiones_y_eventos_seguridad;
CREATE POLICY "eventos_seguridad_only_owner_read"
  ON public.sesiones_y_eventos_seguridad FOR SELECT
  USING (auth.uid() = usuaria_id);

-- 6. Solicitudes de eliminación de cuenta con período de gracia de 14 días
CREATE TABLE IF NOT EXISTS public.solicitudes_eliminacion_cuenta (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuaria_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  solicitado_en timestamptz NOT NULL DEFAULT now(),
  programado_para timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  estado text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'cancelada', 'ejecutada')),
  motivo_opcional text
);

ALTER TABLE public.solicitudes_eliminacion_cuenta ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "eliminacion_only_owner" ON public.solicitudes_eliminacion_cuenta;
CREATE POLICY "eliminacion_only_owner"
  ON public.solicitudes_eliminacion_cuenta FOR ALL
  USING (auth.uid() = usuaria_id)
  WITH CHECK (auth.uid() = usuaria_id);

-- 7. Trigger automático al crear usuario en Supabase Auth -> crea perfil rol 'usuaria'
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  base_username text;
  final_username text;
BEGIN
  base_username := lower(regexp_replace(coalesce(NEW.raw_user_meta_data->>'usuario_unico', split_part(NEW.email, '@', 1), 'modista'), '[^a-z0-9_]', '_', 'g'));
  IF char_length(base_username) < 3 THEN
    base_username := 'modista_' || substring(NEW.id::text from 1 for 6);
  END IF;
  final_username := left(base_username, 22) || '_' || substring(NEW.id::text from 1 for 6);

  INSERT INTO public.perfiles (
    id,
    nombre_publico,
    usuario_unico,
    rol,
    correo_verificado,
    acepto_terminos_en,
    version_terminos,
    acepto_datos_en,
    version_datos,
    mayor_edad_confirmada
  )
  VALUES (
    NEW.id,
    coalesce(nullif(trim(NEW.raw_user_meta_data->>'nombre_publico'), ''), 'Modista del taller'),
    final_username,
    'usuaria',
    NEW.email_confirmed_at IS NOT NULL,
    coalesce((NEW.raw_user_meta_data->>'acepto_terminos_en')::timestamptz, now()),
    coalesce(NEW.raw_user_meta_data->>'version_terminos', '2026-11-19'),
    coalesce((NEW.raw_user_meta_data->>'acepto_datos_en')::timestamptz, now()),
    coalesce(NEW.raw_user_meta_data->>'version_datos', '2026-11-19'),
    coalesce((NEW.raw_user_meta_data->>'mayor_edad_confirmada')::boolean, false)
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_auth_user();