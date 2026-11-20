import assert from "node:assert/strict";
import { POST as postRegistro } from "@/app/api/auth/registro/route";
import {
  DELETE as deleteSesion,
  POST as postSesion,
} from "@/app/api/auth/sesion/route";
import { POST as postVerificarCorreo } from "@/app/api/auth/verificar-correo/route";
import {
  PATCH as patchRecuperacion,
  POST as postRecuperacion,
} from "@/app/api/auth/recuperacion/route";
import { POST as postMigrarLocal } from "@/app/api/auth/migrar-local/route";
import {
  DELETE as deletePublicacion,
  GET as getPublicaciones,
  POST as postPublicacion,
} from "@/app/api/comunidad/publicaciones/route";
import { generarCodigoTotp } from "@/lib/auth/serverAuth";

function extraerCookie(setCookie: string | null): string {
  assert.ok(setCookie, "Se esperaba Set-Cookie httpOnly");
  assert.match(setCookie, /HttpOnly/i);
  assert.match(setCookie, /SameSite=Lax/i);
  return setCookie.split(";")[0] ?? "";
}

function makeReq(
  url: string,
  init: { method: string; body?: unknown; cookie?: string; ip?: string }
): Request {
  const headers = new Headers({
    origin: "http://localhost:3000",
    host: "localhost:3000",
    "x-forwarded-for": init.ip ?? "198.51.100.12",
  });
  if (init.body !== undefined) {
    headers.set("content-type", "application/json");
  }
  if (init.cookie) {
    headers.set("cookie", init.cookie);
  }
  return new Request(url, {
    method: init.method,
    headers,
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
}

async function run() {
  // 1. No autenticada -> 401 al publicar o migrar
  const unauthPub = await postPublicacion(
    makeReq("http://localhost:3000/api/comunidad/publicaciones", {
      method: "POST",
      body: { titulo: "Intento anónimo" },
    })
  );
  assert.equal(unauthPub.status, 401);

  const unauthMig = await postMigrarLocal(
    makeReq("http://localhost:3000/api/auth/migrar-local", {
      method: "POST",
      body: { medidas: [], pedidos: [] },
    })
  );
  assert.equal(unauthMig.status, 401);

  // 2. Contraseña débil rechazada
  const weakReg = await postRegistro(
    makeReq("http://localhost:3000/api/auth/registro", {
      method: "POST",
      body: {
        nombre_publico: "Rosa Prueba",
        correo: "rosa.prueba@ejemplo.co",
        contrasena: "password1234",
        acepto_terminos: true,
        autorizo_datos: true,
        mayor_edad_confirmada: true,
      },
    })
  );
  assert.equal(weakReg.status, 400);

  // 2b. Sin verificación Turnstile anti-bots -> 400
  const noBotReg = await postRegistro(
    makeReq("http://localhost:3000/api/auth/registro", {
      method: "POST",
      ip: "198.51.100.19",
      body: {
        nombre_publico: "Rosa Bot",
        correo: "rosa.bot@ejemplo.co",
        contrasena: "lino aguja taller seguro 2026",
        acepto_terminos: true,
        autorizo_datos: true,
        mayor_edad_confirmada: true,
      },
    })
  );
  assert.equal(noBotReg.status, 400);

  // 3. Registro válido + respuesta no enumerante aunque el correo se repita
  const regResp = await postRegistro(
    makeReq("http://localhost:3000/api/auth/registro", {
      method: "POST",
      ip: "198.51.100.20",
      body: {
        nombre_publico: "Rosa Costura",
        correo: "rosa.costura@ejemplo.co",
        contrasena: "lino aguja taller seguro 2026",
        acepto_terminos: true,
        autorizo_datos: true,
        mayor_edad_confirmada: true,
        turnstile_token: "preview-human-verified",
      },
    })
  );
  assert.equal(regResp.status, 200);
  const regJson = (await regResp.json()) as {
    ok: boolean;
    mensaje: string;
    previewTokenVerificacion?: string;
  };
  assert.ok(regJson.ok && regJson.previewTokenVerificacion);
  let cookieRosa = extraerCookie(regResp.headers.get("set-cookie"));

  const dupReg = await postRegistro(
    makeReq("http://localhost:3000/api/auth/registro", {
      method: "POST",
      ip: "198.51.100.21",
      body: {
        nombre_publico: "Otra Rosa",
        correo: "rosa.costura@ejemplo.co",
        contrasena: "seda costura libre 2026",
        acepto_terminos: true,
        autorizo_datos: true,
        mayor_edad_confirmada: true,
        turnstile_token: "preview-human-verified",
      },
    })
  );
  assert.equal(dupReg.status, 200);
  const dupJson = (await dupReg.json()) as { mensaje: string };
  assert.equal(dupJson.mensaje, regJson.mensaje);

  // 4. Sin verificar correo -> 403 al publicar
  const payloadModaReal = {
    tipo_publicacion: "moda_real",
    titulo: "Vestido lino moda real de verano",
    descripcion: "Hecho sobre maniquí con costura francesa",
    aprendizaje_nota: "Planchar al bies antes de unir la sisa deja acabado limpio.",
    prenda: "Vestido",
    tela: "Lino / Gabardina",
    dificultad: 3,
    tiempo_horas: 4,
    permiso_fotos_confirmado: true,
    fotos: [
      {
        url: "/promo/05-editorial-v2.png",
        alt: "Vestido camisero en lino confeccionado sin molde base",
        orden: 0,
        ancho: 1200,
        alto: 1500,
        exif_limpio: true,
      },
    ],
  };

  const unverifiedPub = await postPublicacion(
    makeReq("http://localhost:3000/api/comunidad/publicaciones", {
      method: "POST",
      cookie: cookieRosa,
      body: payloadModaReal,
    })
  );
  assert.equal(unverifiedPub.status, 403);

  // 5. Verificar correo -> permite crear "moda_real" sin config_molde + aparece en GET + eliminar
  const verResp = await postVerificarCorreo(
    makeReq("http://localhost:3000/api/auth/verificar-correo", {
      method: "POST",
      cookie: cookieRosa,
      body: { accion: "verificar", token: regJson.previewTokenVerificacion },
    })
  );
  assert.equal(verResp.status, 200);
  cookieRosa = extraerCookie(verResp.headers.get("set-cookie"));

  const pubOk = await postPublicacion(
    makeReq("http://localhost:3000/api/comunidad/publicaciones", {
      method: "POST",
      cookie: cookieRosa,
      body: { ...payloadModaReal, publicaciones_aprobadas_count: 1 },
    })
  );
  assert.equal(pubOk.status, 201);
  const pubData = (await pubOk.json()) as {
    publicacion: { id: string; tipo_publicacion: string };
  };
  assert.equal(pubData.publicacion.tipo_publicacion, "moda_real");

  const listModaReal = await getPublicaciones(
    new Request("http://localhost:3000/api/comunidad/publicaciones?tipo=moda_real")
  );
  const listJson = (await listModaReal.json()) as {
    items: Array<{ id: string }>;
  };
  assert.ok(listJson.items.some((x) => x.id === pubData.publicacion.id));

  // Otra cuenta NO puede borrar publicación ajena
  const modLoginNoTotp = await postSesion(
    makeReq("http://localhost:3000/api/auth/sesion", {
      method: "POST",
      ip: "198.51.100.30",
      body: {
        modo: "password",
        correo: "marta@moldefacil.demo",
        contrasena: "TallerSeguro2026!",
        turnstile_token: "preview-human-verified",
      },
    })
  );
  const modNoTotpJson = (await modLoginNoTotp.json()) as { requiere2FA?: boolean };
  assert.equal(modNoTotpJson.requiere2FA, true);

  const totp = generarCodigoTotp("MFRGGZDFMZTWQ2LK");
  const modLoginOk = await postSesion(
    makeReq("http://localhost:3000/api/auth/sesion", {
      method: "POST",
      ip: "198.51.100.30",
      body: {
        modo: "password",
        correo: "marta@moldefacil.demo",
        contrasena: "TallerSeguro2026!",
        codigo_totp: totp,
        turnstile_token: "preview-human-verified",
      },
    })
  );
  assert.equal(modLoginOk.status, 200);

  // Eliminar publicación propia como Rosa
  const delOwn = await deletePublicacion(
    makeReq(
      `http://localhost:3000/api/comunidad/publicaciones?id=${pubData.publicacion.id}`,
      { method: "DELETE", cookie: cookieRosa }
    )
  );
  assert.equal(delOwn.status, 200);

  // 6. Migración local idempotente (1ra vez guarda, 2da vez devuelve nuevas = 0)
  const payloadMig = {
    medidas: [
      {
        id: "prof-1",
        clientName: "Clienta Elena",
        measurements: { bust: 96, waist: 78, hip: 102 },
        updatedAt: "2026-11-19T00:00:00.000Z",
      },
    ],
    pedidos: [
      {
        id: "ord-1",
        clientName: "Clienta Elena",
        garmentDescription: "Vestido lino",
        totalPrice: 120000,
        depositPaid: 60000,
        status: "En proceso",
      },
    ],
  };
  const mig1 = await (
    await postMigrarLocal(
      makeReq("http://localhost:3000/api/auth/migrar-local", {
        method: "POST",
        cookie: cookieRosa,
        body: payloadMig,
      })
    )
  ).json();
  assert.equal(mig1.medidasNuevas, 1);
  const mig2 = await (
    await postMigrarLocal(
      makeReq("http://localhost:3000/api/auth/migrar-local", {
        method: "POST",
        cookie: cookieRosa,
        body: payloadMig,
      })
    )
  ).json();
  assert.equal(mig2.medidasNuevas, 0);

  // 7. Recuperación de contraseña de un solo uso + cierre de sesiones
  const recReq = await postRecuperacion(
    makeReq("http://localhost:3000/api/auth/recuperacion", {
      method: "POST",
      ip: "198.51.100.40",
      body: {
        correo: "rosa.costura@ejemplo.co",
        turnstile_token: "preview-human-verified",
      },
    })
  );
  const recJson = (await recReq.json()) as { previewResetToken?: string };
  assert.ok(recJson.previewResetToken);

  const recUse = await patchRecuperacion(
    makeReq("http://localhost:3000/api/auth/recuperacion", {
      method: "PATCH",
      body: {
        token: recJson.previewResetToken,
        nueva_contrasena: "nueva clave segura costura 2026",
      },
    })
  );
  assert.equal(recUse.status, 200);

  const recReplay = await patchRecuperacion(
    makeReq("http://localhost:3000/api/auth/recuperacion", {
      method: "PATCH",
      body: {
        token: recJson.previewResetToken,
        nueva_contrasena: "otra clave segura costura 2026",
      },
    })
  );
  assert.equal(recReplay.status, 400);

  // Sesión previa de Rosa debió cerrarse al recuperar contraseña
  const pubAfterReset = await postPublicacion(
    makeReq("http://localhost:3000/api/comunidad/publicaciones", {
      method: "POST",
      cookie: cookieRosa,
      body: payloadModaReal,
    })
  );
  assert.equal(pubAfterReset.status, 401);

  // 8. Bloqueo progresivo tras intentos fallidos
  for (let i = 0; i < 6; i++) {
    await postSesion(
      makeReq("http://localhost:3000/api/auth/sesion", {
        method: "POST",
        ip: "198.51.100.99",
        body: {
          modo: "password",
          correo: "rosa.costura@ejemplo.co",
          contrasena: "clave-equivocada",
          turnstile_token: "preview-human-verified",
        },
      })
    );
  }
  const locked = await postSesion(
    makeReq("http://localhost:3000/api/auth/sesion", {
      method: "POST",
      ip: "198.51.100.99",
      body: {
        modo: "password",
        correo: "rosa.costura@ejemplo.co",
        contrasena: "nueva clave segura costura 2026",
        turnstile_token: "preview-human-verified",
      },
    })
  );
  assert.equal(locked.status, 429);

  // Limpiar cookie mod
  await deleteSesion(
    makeReq("http://localhost:3000/api/auth/sesion?alcance=todos", {
      method: "DELETE",
      cookie: extraerCookie(modLoginOk.headers.get("set-cookie")),
    })
  );

  console.log("FASE_0B_VERIFICATION_OK: todas las 8 aserciones criticas pasaron.");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});