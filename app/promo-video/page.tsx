"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Check,
  Copy,
  Download,
  Film,
  Music,
  Play,
  Scissors,
  Sparkles,
  Square,
  Volume2,
} from "lucide-react";
import SiteHeader from "@/components/SiteHeader";

interface PromoScene {
  id: number;
  badge: string;
  screenTitle: string;
  voiceover: string;
  images: string[];
  accentColor: string;
  floatingPills: string[];
}

const PROMO_SCENES: PromoScene[] = [
  {
    id: 1,
    badge: "BIENVENIDA A TU TALLER DIGITAL",
    screenTitle: "Hecho por y para modistas ✂️🧵 • 100% Gratis",
    voiceover:
      "Si coses desde casa o tienes tu propio taller, esto fue creado especialmente para ti. Conoce MoldeFácil: la plataforma gratuita hecha por y para las modistas.",
    images: ["/promo/01-foto-ia.png", "/promo/03-molde-pdf.png"],
    accentColor: "#C85A32",
    floatingPills: [
      "✂️ Patrones a medida 1:1",
      "🛠️ Herramientas de Taller",
      "📖 Guías Visuales",
    ],
  },
  {
    id: 2,
    badge: "DE FOTO A MOLDE EXACTAMENTE A TU TALLA",
    screenTitle: "1. Sube una foto → Obtén el molde a tus medidas",
    voiceover:
      "¿Te enviaron la foto de un vestido y no tienes el patrón? Súbela aquí. Nuestro sistema detecta el estilo, las mangas y la caída, y traza el molde exacto con tus medidas o las de tus clientas.",
    images: ["/promo/01-foto-ia.png", "/promo/02-medidas-guardadas.png"],
    accentColor: "#E11D48",
    floatingPills: [
      "✨ IA detecta corte y mangas",
      "📒 Guarda medidas de clientas",
    ],
  },
  {
    id: 3,
    badge: "IMPRESIÓN EN CASA SIN DESCUADRES",
    screenTitle: "2. Imprime en hojas Carta o A4 y cose sin errores",
    voiceover:
      "Descarga tu molde en PDF dividido por hojas Carta o A4, con cuadro de calibración, cuánta tela comprar y el paso a paso de confección listo para empezar a cortar.",
    images: ["/promo/03-molde-pdf.png"],
    accentColor: "#3B7A57",
    floatingPills: [
      "📏 Cuadro de control 5×5 cm",
      "✓ Costuras verificadas 1:1",
    ],
  },
  {
    id: 4,
    badge: "SUITE MI TALLER DE COSTURA",
    screenTitle: "3. Cotiza sin perder dinero y organiza tus pedidos",
    voiceover:
      "Y como sabemos lo duro que es el trabajo de taller, incluimos calculadoras para saber cuánto cobrar sin regalar tu trabajo, sacar el radio exacto de faldas plato, acomodar piezas en la tela y anotar los encargos de tus clientas.",
    images: ["/promo/04-cotizador-taller.png", "/promo/05-falda-plan-corte.png"],
    accentColor: "#0D9488",
    floatingPills: [
      "💰 Cotizador para WhatsApp",
      "⭕ Faldas Plato + Plan de Corte",
    ],
  },
  {
    id: 5,
    badge: "CUADERNO VISUAL E INTERACTIVO",
    screenTitle: "4. Guías visuales, tablas de tela y trucos reales",
    voiceover:
      "Además, tienes una revista completa con guías visuales de patronaje, tablas de agujas y calculadoras rápidas de tela para resolver cualquier duda en tu mesa de corte.",
    images: ["/promo/06-revista-guias.png"],
    accentColor: "#C85A32",
    floatingPills: [
      "⚡ Respuestas en 15 segundos",
      "✅ Ilustraciones Sí vs. No",
    ],
  },
  {
    id: 6,
    badge: "NUESTRO COMPROMISO CONTIGO",
    screenTitle: "Seguimos mejorando cada semana para ti 💛 • Entra gratis hoy",
    voiceover:
      "Y lo mejor: seguimos mejorando la página cada semana escuchando tus ideas para hacer tu costura más fácil y rentable. Entra gratis hoy mismo y empieza a crear tus moldes.",
    images: ["/promo/03-molde-pdf.png", "/promo/04-cotizador-taller.png"],
    accentColor: "#E11D48",
    floatingPills: [
      "💛 Nuevas mejoras cada semana",
      "🌐 moldefacil-tawny.vercel.app",
    ],
  },
];

const PREFERRED_VOICE_KEYWORDS = [
  "dalia",
  "helena",
  "sabina",
  "paloma",
  "elvira",
  "paulina",
  "francisca",
  "catalina",
  "camila",
  "sofia",
  "google español",
  "microsoft",
  "natural",
  "online",
];

function splitIntoSubtitleChunks(text: string): string[] {
  const words = text.trim().split(/\s+/);
  const chunks: string[] = [];
  let current: string[] = [];

  for (const word of words) {
    current.push(word);
    const joined = current.join(" ");
    const endsPunctuation = /[.,;:?!]$/.test(word);
    if (current.length >= 6 || (current.length >= 4 && endsPunctuation) || joined.length >= 38) {
      chunks.push(joined);
      current = [];
    }
  }
  if (current.length > 0) {
    chunks.push(current.join(" "));
  }
  return chunks;
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function wrapCanvasText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (ctx.measureText(testLine).width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }
  return lines;
}

interface AmbientSynthController {
  stream: MediaStream;
  stopWithFade: () => Promise<void>;
}

function startAmbientAtelierMusic(volumePercent = 0.12): AmbientSynthController {
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AudioCtx();
  const dest = ctx.createMediaStreamDestination();

  const masterGain = ctx.createGain();
  masterGain.gain.setValueAtTime(0.001, ctx.currentTime);
  masterGain.gain.linearRampToValueAtTime(volumePercent, ctx.currentTime + 0.8);
  masterGain.connect(ctx.destination);
  masterGain.connect(dest);

  // Warm progression in F major / D minor (Kalimba / Rhodes style)
  const chords = [
    [261.63, 329.63, 392.0, 493.88], // Cmaj7
    [220.0, 261.63, 329.63, 392.0], // Am7
    [174.61, 220.0, 261.63, 349.23], // Fmaj7
    [196.0, 246.94, 293.66, 392.0], // G6
  ];

  let step = 0;
  let stopped = false;

  const playNote = (freq: number, delaySec: number, durationSec: number, gainPeak: number) => {
    if (stopped || ctx.state === "closed") return;
    const start = ctx.currentTime + delaySec;
    const osc = ctx.createOscillator();
    const overtone = ctx.createOscillator();
    const noteGain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, start);

    overtone.type = "triangle";
    overtone.frequency.setValueAtTime(freq * 2, start);

    const overtoneGain = ctx.createGain();
    overtoneGain.gain.setValueAtTime(0.15, start);

    noteGain.gain.setValueAtTime(0.0001, start);
    noteGain.gain.linearRampToValueAtTime(gainPeak, start + 0.04);
    noteGain.gain.exponentialRampToValueAtTime(0.0001, start + durationSec);

    osc.connect(noteGain);
    overtone.connect(overtoneGain);
    overtoneGain.connect(noteGain);
    noteGain.connect(masterGain);

    osc.start(start);
    overtone.start(start);
    osc.stop(start + durationSec + 0.05);
    overtone.stop(start + durationSec + 0.05);
  };

  const triggerBar = () => {
    if (stopped) return;
    const chord = chords[step % chords.length];
    step += 1;
    // Soft pad root + fifth
    playNote(chord[0] * 0.5, 0, 2.6, 0.28);
    // Gentle kalimba arpeggio notes
    chord.forEach((freq, idx) => {
      playNote(freq, idx * 0.42, 1.9, 0.22);
    });
    playNote(chord[2] * 2, 1.85, 1.5, 0.12);
  };

  triggerBar();
  const intervalId = window.setInterval(triggerBar, 2400);

  return {
    stream: dest.stream,
    stopWithFade: async () => {
      if (stopped) return;
      stopped = true;
      window.clearInterval(intervalId);
      try {
        const now = ctx.currentTime;
        masterGain.gain.cancelScheduledValues(now);
        masterGain.gain.setValueAtTime(Math.max(masterGain.gain.value, 0.001), now);
        masterGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.1);
        await new Promise((r) => setTimeout(r, 1150));
        if (ctx.state !== "closed") {
          await ctx.close();
        }
      } catch {
        // Ignore close errors
      }
    },
  };
}

export default function PromoVideoGeneratorPage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const loadedImagesRef = useRef<Record<string, HTMLImageElement>>({});
  const [imagesReadyCount, setImagesReadyCount] = useState(0);

  // Voice & Audio state
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState<string>("");
  const [speechRate, setSpeechRate] = useState<number>(0.98);
  const [speechPitch, setSpeechPitch] = useState<number>(1.02);
  const [musicEnabled, setMusicEnabled] = useState<boolean>(true);

  // Playback & Recording state
  const [activeSceneIndex, setActiveSceneIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>(
    "Listo para reproducir o grabar tu comercial vertical 9:16 (1080×1920 px)."
  );
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [copiedScript, setCopiedScript] = useState<boolean>(false);

  // Animation refs for 30fps loop
  const activeSceneIndexRef = useRef<number>(0);
  const sceneStartTimeRef = useRef<number>(0);
  const sceneProgressRef = useRef<number>(0);
  const charIndexRef = useRef<number>(0);
  const stopRequestedRef = useRef<boolean>(false);
  const synthControllerRef = useRef<AmbientSynthController | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  // Preload the 6 real screenshots from /public/promo/
  useEffect(() => {
    const allPaths = [
      "/promo/01-foto-ia.png",
      "/promo/02-medidas-guardadas.png",
      "/promo/03-molde-pdf.png",
      "/promo/04-cotizador-taller.png",
      "/promo/05-falda-plan-corte.png",
      "/promo/06-revista-guias.png",
    ];
    let loaded = 0;

    allPaths.forEach((src) => {
      const img = new window.Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        loadedImagesRef.current[src] = img;
        loaded += 1;
        setImagesReadyCount(loaded);
      };
      img.onerror = () => {
        loaded += 1;
        setImagesReadyCount(loaded);
      };
      img.src = src;
    });
  }, []);

  // Load Spanish voices from window.speechSynthesis
  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    const updateVoices = () => {
      const all = window.speechSynthesis.getVoices();
      if (!all.length) return;

      const spanish = all.filter((v) =>
        v.lang.toLowerCase().startsWith("es")
      );
      const list = spanish.length > 0 ? spanish : all;
      setVoices(list);

      setSelectedVoiceURI((prev) => {
        if (prev && list.some((v) => v.voiceURI === prev)) return prev;
        // Score voices to pick the most natural Spanish female voice
        let bestVoice = list[0];
        let bestScore = -1;
        for (const v of list) {
          const nameLower = `${v.name} ${v.lang}`.toLowerCase();
          let score = 0;
          if (nameLower.includes("es-mx") || nameLower.includes("es-co") || nameLower.includes("es-es") || nameLower.includes("es-us")) {
            score += 4;
          }
          for (let i = 0; i < PREFERRED_VOICE_KEYWORDS.length; i++) {
            if (nameLower.includes(PREFERRED_VOICE_KEYWORDS[i])) {
              score += 20 - i;
            }
          }
          if (score > bestScore) {
            bestScore = score;
            bestVoice = v;
          }
        }
        return bestVoice?.voiceURI || "";
      });
    };

    updateVoices();
    window.speechSynthesis.onvoiceschanged = updateVoices;
    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  const selectedVoice = useMemo(
    () => voices.find((v) => v.voiceURI === selectedVoiceURI) || voices[0] || null,
    [voices, selectedVoiceURI]
  );

  // Draw single frame on the 1080x1920 Canvas
  const renderCanvasFrame = useCallback((nowMs: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = 1080;
    const H = 1920;
    const sceneIdx = activeSceneIndexRef.current;
    const scene = PROMO_SCENES[sceneIdx] || PROMO_SCENES[0];
    const elapsedSec = Math.max(0, (nowMs - sceneStartTimeRef.current) / 1000);
    const progress = Math.min(1, Math.max(sceneProgressRef.current, elapsedSec / 9.5));

    // 1. Warm Atelier Cream Background (#FAF6F0)
    const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
    bgGrad.addColorStop(0, "#FAF6F0");
    bgGrad.addColorStop(0.5, "#FFFDF9");
    bgGrad.addColorStop(1, "#F5EDE2");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // Subtle sewing pattern grid lines
    ctx.save();
    ctx.strokeStyle = "rgba(200, 90, 50, 0.055)";
    ctx.lineWidth = 2;
    const gridOffset = (elapsedSec * 18) % 90;
    for (let x = 0; x < W; x += 90) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
    for (let y = -90 + gridOffset; y < H; y += 90) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
    ctx.restore();

    // Soft decorative circles
    ctx.save();
    ctx.fillStyle = "rgba(200, 90, 50, 0.07)";
    ctx.beginPath();
    ctx.arc(960, 220, 260, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(59, 122, 87, 0.07)";
    ctx.beginPath();
    ctx.arc(120, 1520, 290, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 2. Top Progress Bar (6 scenes segments)
    const segGap = 14;
    const totalBarW = W - 120;
    const segW = (totalBarW - segGap * (PROMO_SCENES.length - 1)) / PROMO_SCENES.length;
    for (let i = 0; i < PROMO_SCENES.length; i++) {
      const sx = 60 + i * (segW + segGap);
      const sy = 44;
      drawRoundedRect(ctx, sx, sy, segW, 12, 6);
      ctx.fillStyle = "rgba(45, 42, 38, 0.14)";
      ctx.fill();

      const fillRatio = i < sceneIdx ? 1 : i === sceneIdx ? Math.min(1, progress) : 0;
      if (fillRatio > 0) {
        drawRoundedRect(ctx, sx, sy, Math.max(12, segW * fillRatio), 12, 6);
        ctx.fillStyle = "#C85A32";
        ctx.fill();
      }
    }

    // 3. Brand Pill Header
    drawRoundedRect(ctx, 60, 82, 410, 68, 34);
    ctx.fillStyle = "#FFFFFF";
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#E5DCD0";
    ctx.stroke();

    drawRoundedRect(ctx, 74, 92, 48, 48, 14);
    ctx.fillStyle = "#E11D48";
    ctx.fill();
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "900 26px 'Segoe UI', Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("✂", 98, 126);

    ctx.textAlign = "left";
    ctx.fillStyle = "#2D2A26";
    ctx.font = "900 28px 'Segoe UI', Arial, sans-serif";
    ctx.fillText("MoldeFácil", 138, 126);
    ctx.fillStyle = "#C85A32";
    ctx.font = "800 22px 'Segoe UI', Arial, sans-serif";
    ctx.fillText("• Taller Digital", 302, 125);

    // Scene Counter Badge on Right
    drawRoundedRect(ctx, W - 260, 82, 200, 68, 34);
    ctx.fillStyle = "#2D2A26";
    ctx.fill();
    ctx.textAlign = "center";
    ctx.fillStyle = "#FAF6F0";
    ctx.font = "800 24px 'Segoe UI', Arial, sans-serif";
    ctx.fillText(`ESCENA ${scene.id} / 6`, W - 160, 125);

    // 4. Top Headline Card (On-screen title)
    drawRoundedRect(ctx, 60, 172, W - 120, 212, 36);
    ctx.fillStyle = "#FFFFFF";
    ctx.shadowColor = "rgba(45, 42, 38, 0.08)";
    ctx.shadowBlur = 28;
    ctx.shadowOffsetY = 8;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.lineWidth = 4;
    ctx.strokeStyle = scene.accentColor;
    ctx.stroke();

    // Badge inside Headline Card
    drawRoundedRect(ctx, 96, 196, 540, 44, 22);
    ctx.fillStyle = "#FAF6F0";
    ctx.fill();
    ctx.textAlign = "left";
    ctx.fillStyle = scene.accentColor;
    ctx.font = "900 21px 'Segoe UI', Arial, sans-serif";
    ctx.fillText(`✦ ${scene.badge}`, 118, 225);

    // Wrapped Screen Title
    ctx.fillStyle = "#2D2A26";
    ctx.font = "900 42px 'Segoe UI', Arial, sans-serif";
    const titleLines = wrapCanvasText(ctx, scene.screenTitle, W - 192);
    titleLines.slice(0, 2).forEach((line, idx) => {
      ctx.fillText(line, 96, 292 + idx * 50);
    });

    // 5. Center Stage (y: 410 to 1470)
    if (scene.id === 1) {
      // Scene 1: Emotional Hook + Animated Scissors/Thread & Dual Preview Cards
      const img1 = loadedImagesRef.current["/promo/01-foto-ia.png"];
      const img2 = loadedImagesRef.current["/promo/03-molde-pdf.png"];

      // Central Atelier Hero Card
      drawRoundedRect(ctx, 80, 420, W - 160, 430, 40);
      ctx.fillStyle = "#2D2A26";
      ctx.fill();

      // Animated pulsing terracotta circle with scissors & thread
      const pulse = 1 + Math.sin(elapsedSec * 3.2) * 0.05;
      ctx.save();
      ctx.translate(W / 2, 540);
      ctx.scale(pulse, pulse);
      ctx.beginPath();
      ctx.arc(0, 0, 74, 0, Math.PI * 2);
      ctx.fillStyle = "#C85A32";
      ctx.fill();
      ctx.fillStyle = "#FFFFFF";
      ctx.textAlign = "center";
      ctx.font = "900 66px 'Segoe UI', Arial, sans-serif";
      ctx.fillText("✂️", 0, 24);
      ctx.restore();

      ctx.textAlign = "center";
      ctx.fillStyle = "#FAF6F0";
      ctx.font = "900 48px 'Segoe UI', Arial, sans-serif";
      ctx.fillText("Tu taller de costura en el celular", W / 2, 680);

      ctx.fillStyle = "#FCD34D";
      ctx.font = "800 32px 'Segoe UI', Arial, sans-serif";
      ctx.fillText("Moldes a medida • Cotizador • Faldas Plato • Revista", W / 2, 738);

      drawRoundedRect(ctx, W / 2 - 250, 768, 500, 56, 28);
      ctx.fillStyle = "#3B7A57";
      ctx.fill();
      ctx.fillStyle = "#FFFFFF";
      ctx.font = "800 25px 'Segoe UI', Arial, sans-serif";
      ctx.fillText("✓ Sin pagos • Sin registros • 100% en español", W / 2, 804);

      // Two angled phone cards below
      const drawAngledPhone = (
        img: HTMLImageElement | undefined,
        cx: number,
        cy: number,
        angleRad: number
      ) => {
        if (!img) return;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(angleRad);
        const pw = 390;
        const ph = 560;
        drawRoundedRect(ctx, -pw / 2 - 10, -ph / 2 - 10, pw + 20, ph + 20, 34);
        ctx.fillStyle = "#1E293B";
        ctx.shadowColor = "rgba(15, 23, 42, 0.28)";
        ctx.shadowBlur = 30;
        ctx.fill();
        ctx.shadowBlur = 0;

        drawRoundedRect(ctx, -pw / 2, -ph / 2, pw, ph, 26);
        ctx.clip();
        ctx.drawImage(img, 0, 0, img.width, img.height * 0.72, -pw / 2, -ph / 2, pw, ph);
        ctx.restore();
      };

      const floatY = Math.sin(elapsedSec * 2.2) * 10;
      drawAngledPhone(img1, 330, 1175 + floatY, -0.06);
      drawAngledPhone(img2, 750, 1175 - floatY, 0.06);
    } else if (scene.id === 6) {
      // Scene 6: Commitment & Call to Action Finale
      const img1 = loadedImagesRef.current["/promo/03-molde-pdf.png"];
      const img2 = loadedImagesRef.current["/promo/04-cotizador-taller.png"];

      // Background preview cards
      if (img1 && img2) {
        ctx.save();
        ctx.globalAlpha = 0.25;
        ctx.drawImage(img1, 70, 430, 440, 820);
        ctx.drawImage(img2, 570, 430, 440, 820);
        ctx.restore();
      }

      // Main Finale Commitment Card
      drawRoundedRect(ctx, 76, 450, W - 152, 980, 44);
      ctx.fillStyle = "#FFFFFF";
      ctx.shadowColor = "rgba(45, 42, 38, 0.16)";
      ctx.shadowBlur = 40;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.lineWidth = 5;
      ctx.strokeStyle = "#C85A32";
      ctx.stroke();

      // Badge
      drawRoundedRect(ctx, W / 2 - 280, 504, 560, 62, 31);
      ctx.fillStyle = "#FDF3EE";
      ctx.fill();
      ctx.textAlign = "center";
      ctx.fillStyle = "#C85A32";
      ctx.font = "900 26px 'Segoe UI', Arial, sans-serif";
      ctx.fillText("💛 CREADO ESCUCHANDO A LAS MODISTAS", W / 2, 544);

      ctx.fillStyle = "#2D2A26";
      ctx.font = "900 50px 'Segoe UI', Arial, sans-serif";
      ctx.fillText("Cada semana sumamos", W / 2, 646);
      ctx.fillText("nuevos moldes y mejoras", W / 2, 708);

      // 4 Feature Check Rows
      const perks = [
        "✂️ Generador de Moldes en PDF (Carta y A4)",
        "💰 Cotizador Profesional de Costura para WhatsApp",
        "⭕ Calculadora de Faldas Plato y Plan de Corte",
        "📖 Cuaderno Visual de Guías y Tablas de Agujas",
      ];
      perks.forEach((perk, i) => {
        const py = 768 + i * 92;
        drawRoundedRect(ctx, 130, py, W - 260, 74, 22);
        ctx.fillStyle = i % 2 === 0 ? "#FAF6F0" : "#F2F7F4";
        ctx.fill();
        ctx.textAlign = "left";
        ctx.fillStyle = "#2D2A26";
        ctx.font = "800 28px 'Segoe UI', Arial, sans-serif";
        ctx.fillText(perk, 164, py + 47);
      });

      // Pulsing CTA Button
      const btnPulse = 1 + Math.sin(elapsedSec * 4) * 0.03;
      ctx.save();
      ctx.translate(W / 2, 1245);
      ctx.scale(btnPulse, btnPulse);
      drawRoundedRect(ctx, -400, -58, 800, 116, 34);
      ctx.fillStyle = "#E11D48";
      ctx.shadowColor = "rgba(225, 29, 72, 0.35)";
      ctx.shadowBlur = 28;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.textAlign = "center";
      ctx.fillStyle = "#FFFFFF";
      ctx.font = "900 38px 'Segoe UI', Arial, sans-serif";
      ctx.fillText("👉 Entra gratis hoy a MoldeFácil", 0, -4);
      ctx.fillStyle = "#FFE4E6";
      ctx.font = "800 26px 'Segoe UI', Arial, sans-serif";
      ctx.fillText("moldefacil-tawny.vercel.app", 0, 36);
      ctx.restore();
    } else {
      // Scenes 2, 3, 4, 5: Real Mobile Screenshot Showcase with Ken Burns Effect
      const hasTwoImages = scene.images.length > 1;
      const showSecondImage = hasTwoImages && progress >= 0.48;
      const primarySrc = showSecondImage ? scene.images[1] : scene.images[0];
      const secondarySrc = hasTwoImages
        ? showSecondImage
          ? scene.images[0]
          : scene.images[1]
        : null;

      const mainImg = loadedImagesRef.current[primarySrc];
      const backImg = secondarySrc ? loadedImagesRef.current[secondarySrc] : null;

      // If dual-image scene, draw secondary screenshot softly in background on the side
      if (backImg) {
        ctx.save();
        const sideX = showSecondImage ? 75 : 495;
        ctx.globalAlpha = 0.38;
        drawRoundedRect(ctx, sideX, 460, 510, 960, 34);
        ctx.fillStyle = "#1E293B";
        ctx.fill();
        ctx.clip();
        ctx.drawImage(backImg, sideX, 460, 510, 960);
        ctx.restore();
      }

      // Main Phone Frame (centered)
      const frameW = hasTwoImages ? 640 : 680;
      const frameH = 1030;
      const frameX = hasTwoImages
        ? showSecondImage
          ? 340
          : 100
        : (W - frameW) / 2;
      const frameY = 415;

      // Phone Outer Bezel
      ctx.save();
      drawRoundedRect(ctx, frameX - 14, frameY - 14, frameW + 28, frameH + 28, 46);
      ctx.fillStyle = "#1E293B";
      ctx.shadowColor = "rgba(15, 23, 42, 0.26)";
      ctx.shadowBlur = 36;
      ctx.shadowOffsetY = 14;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
      ctx.lineWidth = 4;
      ctx.strokeStyle = scene.accentColor;
      ctx.stroke();

      // Clip inside screen and apply smooth Ken Burns zoom + vertical pan
      drawRoundedRect(ctx, frameX, frameY, frameW, frameH, 34);
      ctx.clip();
      ctx.fillStyle = "#FAF8F5";
      ctx.fillRect(frameX, frameY, frameW, frameH);

      if (mainImg) {
        const subProgress = hasTwoImages
          ? showSecondImage
            ? (progress - 0.48) / 0.52
            : progress / 0.48
          : progress;
        const clampedSub = Math.max(0, Math.min(1, subProgress));
        const scale = 1.02 + clampedSub * 0.08; // Smooth Ken Burns zoom 1.02x -> 1.10x
        const panY = -clampedSub * 110; // Gentle upward scroll to reveal full mobile screen

        const drawW = frameW * scale;
        const drawH = (mainImg.height / mainImg.width) * drawW;
        const drawX = frameX - (drawW - frameW) / 2;
        const drawY = frameY + panY;

        ctx.drawImage(mainImg, drawX, drawY, drawW, drawH);
      }
      ctx.restore();

      // Floating Callout Pills on top of phone frame
      scene.floatingPills.forEach((pillText, idx) => {
        const pillW = 470;
        const pillH = 66;
        const px = idx === 0 ? 64 : W - pillW - 64;
        const py = idx === 0 ? 430 : 1365;

        ctx.save();
        drawRoundedRect(ctx, px, py, pillW, pillH, 33);
        ctx.fillStyle = idx === 0 ? "#2D2A26" : scene.accentColor;
        ctx.shadowColor = "rgba(0,0,0,0.22)";
        ctx.shadowBlur = 18;
        ctx.fill();
        ctx.shadowBlur = 0;

        ctx.textAlign = "center";
        ctx.fillStyle = "#FFFFFF";
        ctx.font = "800 25px 'Segoe UI', Arial, sans-serif";
        ctx.fillText(pillText, px + pillW / 2, py + 42);
        ctx.restore();
      });
    }

    // 6. Dynamic Synchronized Subtitles Pill in Lower Safe Zone (y: 1495 to 1790)
    const chunks = splitIntoSubtitleChunks(scene.voiceover);
    const currentChar = charIndexRef.current;

    // Pick which chunk corresponds to current spoken character index (or time fallback)
    let activeChunkIndex = 0;
    if (currentChar > 0) {
      let acc = 0;
      for (let i = 0; i < chunks.length; i++) {
        acc += chunks[i].length + 1;
        if (currentChar <= acc) {
          activeChunkIndex = i;
          break;
        }
        activeChunkIndex = i;
      }
    } else {
      activeChunkIndex = Math.min(
        chunks.length - 1,
        Math.floor(progress * chunks.length)
      );
    }

    const activeSubtitleText = chunks[activeChunkIndex] || chunks[0] || "";

    // Subtitle Container Pill
    drawRoundedRect(ctx, 64, 1500, W - 128, 250, 38);
    ctx.fillStyle = "rgba(45, 42, 38, 0.94)";
    ctx.shadowColor = "rgba(0, 0, 0, 0.25)";
    ctx.shadowBlur = 24;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.lineWidth = 4;
    ctx.strokeStyle = "#C85A32";
    ctx.stroke();

    // Small Voiceover Indicator inside Subtitle Box
    ctx.textAlign = "center";
    ctx.fillStyle = "#FBBF24";
    ctx.font = "800 22px 'Segoe UI', Arial, sans-serif";
    ctx.fillText(
      `🔊 VOZ EN OFF • FRASE ${activeChunkIndex + 1} DE ${chunks.length}`,
      W / 2,
      1548
    );

    // Animated Subtitle Phrase
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "900 40px 'Segoe UI', Arial, sans-serif";
    const subLines = wrapCanvasText(ctx, `"${activeSubtitleText}"`, W - 210);
    subLines.slice(0, 3).forEach((line, idx) => {
      ctx.fillText(line, W / 2, 1614 + idx * 52);
    });

    // 7. Bottom Safe Footer Bar
    ctx.textAlign = "center";
    ctx.fillStyle = "#5C554E";
    ctx.font = "800 24px 'Segoe UI', Arial, sans-serif";
    ctx.fillText(
      "✂️ MoldeFácil — Hecho por y para las modistas • moldefacil-tawny.vercel.app",
      W / 2,
      1845
    );
  }, []);

  // Continuous 30fps Canvas render loop
  useEffect(() => {
    let frameId: number;
    let lastDraw = 0;
    const interval = 1000 / 30;

    const loop = (now: number) => {
      if (now - lastDraw >= interval) {
        lastDraw = now;
        renderCanvasFrame(now);
      }
      frameId = window.requestAnimationFrame(loop);
    };

    sceneStartTimeRef.current = performance.now();
    frameId = window.requestAnimationFrame(loop);
    return () => window.cancelAnimationFrame(frameId);
  }, [renderCanvasFrame, imagesReadyCount]);

  // Speak a single scene and resolve when utterance.onend fires (+ 400ms natural pause)
  const speakScene = useCallback(
    (scene: PromoScene): Promise<void> => {
      return new Promise((resolve) => {
        if (stopRequestedRef.current) {
          resolve();
          return;
        }

        sceneStartTimeRef.current = performance.now();
        sceneProgressRef.current = 0;
        charIndexRef.current = 0;

        const wordCount = scene.voiceover.split(/\s+/).length;
        const estimatedMs = Math.max(4800, (wordCount / (2.5 * speechRate)) * 1000);

        // Smooth progress ticker for Ken Burns & subtitle fallback
        const progressInterval = window.setInterval(() => {
          const elapsed = performance.now() - sceneStartTimeRef.current;
          sceneProgressRef.current = Math.min(0.98, elapsed / estimatedMs);
        }, 60);

        let settled = false;
        const finishScene = () => {
          if (settled) return;
          settled = true;
          window.clearInterval(progressInterval);
          sceneProgressRef.current = 1;
          // 400ms natural dramatic pause between scenes
          window.setTimeout(() => resolve(), 400);
        };

        // Safety fallback timer if browser speechSynthesis is muted or stalls
        const safetyTimer = window.setTimeout(() => {
          finishScene();
        }, estimatedMs + 3500);

        if (typeof window === "undefined" || !("speechSynthesis" in window)) {
          setTimeout(() => {
            clearTimeout(safetyTimer);
            finishScene();
          }, estimatedMs);
          return;
        }

        try {
          window.speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(scene.voiceover);
          utterance.lang = selectedVoice?.lang || "es-ES";
          if (selectedVoice) {
            utterance.voice = selectedVoice;
          }
          utterance.rate = speechRate;
          utterance.pitch = speechPitch;

          utterance.onboundary = (event) => {
            if (typeof event.charIndex === "number") {
              charIndexRef.current = event.charIndex;
              sceneProgressRef.current = Math.min(
                0.98,
                event.charIndex / Math.max(1, scene.voiceover.length)
              );
            }
          };

          utterance.onend = () => {
            window.clearTimeout(safetyTimer);
            finishScene();
          };

          utterance.onerror = () => {
            window.clearTimeout(safetyTimer);
            finishScene();
          };

          window.speechSynthesis.speak(utterance);
        } catch {
          window.clearTimeout(safetyTimer);
          finishScene();
        }
      });
    },
    [selectedVoice, speechRate, speechPitch]
  );

  const stopPlayback = useCallback(async () => {
    stopRequestedRef.current = true;
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    if (synthControllerRef.current) {
      await synthControllerRef.current.stopWithFade();
      synthControllerRef.current = null;
    }
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.stop();
    }
    setIsPlaying(false);
    setIsRecording(false);
    setStatusMessage("Reproducción detenida.");
  }, []);

  // Test Voiceover button
  const handleTestVoice = useCallback(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const sample = new SpeechSynthesisUtterance(
      "Hola colega modista, bienvenida a MoldeFácil. Así sonará la voz en off de tu video."
    );
    sample.lang = selectedVoice?.lang || "es-ES";
    if (selectedVoice) sample.voice = selectedVoice;
    sample.rate = speechRate;
    sample.pitch = speechPitch;
    window.speechSynthesis.speak(sample);
    setStatusMessage(
      `Probando voz: ${selectedVoice?.name || "Español predeterminada"} (${speechRate}x)`
    );
  }, [selectedVoice, speechRate, speechPitch]);

  // Run full 6-scene commercial sequence
  const runCommercialSequence = useCallback(
    async (withRecording: boolean) => {
      if (isPlaying || isRecording) return;

      stopRequestedRef.current = false;
      setDownloadUrl(null);
      setIsPlaying(true);

      let displayStream: MediaStream | null = null;
      let mixAudioCtx: AudioContext | null = null;

      try {
        if (withRecording) {
          setIsRecording(true);
          setStatusMessage(
            "Selecciona 'Esta pestaña' y activa 'Compartir audio de la pestaña' para grabar la voz IA + música..."
          );

          try {
            displayStream = await navigator.mediaDevices.getDisplayMedia({
              video: true,
              audio: true,
              preferCurrentTab: true,
            } as DisplayMediaStreamOptions);
          } catch {
            // Fallback: continue recording canvas + Web Audio music even if tab sharing was skipped
            displayStream = null;
          }
        }

        // Start soft ambient Web Audio synth (12% volume)
        if (musicEnabled) {
          synthControllerRef.current = startAmbientAtelierMusic(0.12);
        }

        // If recording, set up MediaRecorder combining canvas 30fps video + audio tracks
        let recorderClosedPromise: Promise<void> = Promise.resolve();
        if (withRecording && canvasRef.current) {
          const canvasStream = canvasRef.current.captureStream(30);
          const AudioCtx =
            window.AudioContext ||
            (window as unknown as { webkitAudioContext: typeof AudioContext })
              .webkitAudioContext;
          mixAudioCtx = new AudioCtx();
          const mixDest = mixAudioCtx.createMediaStreamDestination();

          // Mix Web Audio ambient music stream
          if (
            synthControllerRef.current &&
            synthControllerRef.current.stream.getAudioTracks().length > 0
          ) {
            const synthSource = mixAudioCtx.createMediaStreamSource(
              synthControllerRef.current.stream
            );
            synthSource.connect(mixDest);
          }

          // Mix tab audio stream (which carries window.speechSynthesis voiceover)
          if (displayStream && displayStream.getAudioTracks().length > 0) {
            const tabAudioSource = mixAudioCtx.createMediaStreamSource(
              new MediaStream(displayStream.getAudioTracks())
            );
            tabAudioSource.connect(mixDest);
          }

          const combinedTracks: MediaStreamTrack[] = [
            ...canvasStream.getVideoTracks(),
            ...mixDest.stream.getAudioTracks(),
          ];
          const combinedStream = new MediaStream(combinedTracks);

          const mimeType = MediaRecorder.isTypeSupported(
            "video/webm;codecs=vp9,opus"
          )
            ? "video/webm;codecs=vp9,opus"
            : MediaRecorder.isTypeSupported("video/webm;codecs=vp8,opus")
            ? "video/webm;codecs=vp8,opus"
            : "video/webm";

          const chunks: BlobPart[] = [];
          const recorder = new MediaRecorder(combinedStream, {
            mimeType,
            videoBitsPerSecond: 6_000_000,
          });
          mediaRecorderRef.current = recorder;

          recorder.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) {
              chunks.push(e.data);
            }
          };

          recorderClosedPromise = new Promise<void>((resolve) => {
            recorder.onstop = () => {
              const blob = new Blob(chunks, { type: mimeType });
              const url = URL.createObjectURL(blob);
              setDownloadUrl(url);

              // Trigger automatic download
              const a = document.createElement("a");
              a.href = url;
              a.download = "moldefacil-comercial-modistas-9x16.webm";
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              resolve();
            };
          });

          recorder.start(250);
        }

        // Play all 6 scenes sequentially driven by utterance.onend
        for (let i = 0; i < PROMO_SCENES.length; i++) {
          if (stopRequestedRef.current) break;
          activeSceneIndexRef.current = i;
          setActiveSceneIndex(i);
          setStatusMessage(
            `${withRecording ? "🔴 Grabando" : "▶️ Reproduciendo"} Escena ${
              i + 1
            } de ${PROMO_SCENES.length}: "${PROMO_SCENES[i].screenTitle}"`
          );
          await speakScene(PROMO_SCENES[i]);
        }

        // Fade out music smoothly at the end
        if (synthControllerRef.current) {
          await synthControllerRef.current.stopWithFade();
          synthControllerRef.current = null;
        }

        if (
          mediaRecorderRef.current &&
          mediaRecorderRef.current.state !== "inactive"
        ) {
          mediaRecorderRef.current.stop();
          await recorderClosedPromise;
        }

        if (!stopRequestedRef.current) {
          setStatusMessage(
            withRecording
              ? "✅ ¡Comercial grabado y descargado automáticamente (.webm)!"
              : "✅ Vista previa completada. Puedes grabarlo en 1 clic cuando quieras."
          );
        }
      } finally {
        if (displayStream) {
          displayStream.getTracks().forEach((t) => t.stop());
        }
        if (mixAudioCtx && mixAudioCtx.state !== "closed") {
          try {
            await mixAudioCtx.close();
          } catch {
            // ignore
          }
        }
        setIsPlaying(false);
        setIsRecording(false);
      }
    },
    [isPlaying, isRecording, musicEnabled, speakScene]
  );

  const handleCopyFullScript = useCallback(async () => {
    const fullText = PROMO_SCENES.map(
      (s) =>
        `ESCENA ${s.id} — ${s.screenTitle}\nVoz en off: "${s.voiceover}"`
    ).join("\n\n");
    try {
      await navigator.clipboard.writeText(fullText);
      setCopiedScript(true);
      window.setTimeout(() => setCopiedScript(false), 2600);
    } catch {
      // ignore clipboard errors
    }
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF8F5] text-[#2D2A26] overflow-x-hidden">
      <SiteHeader
        rightSlot={
          <Link
            href="/"
            className="min-h-[44px] px-4 py-2 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold shadow-xs inline-flex items-center gap-2 transition"
          >
            <Scissors className="h-4 w-4" />
            <span>Ir al Generador</span>
          </Link>
        }
      />

      <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 lg:px-8 py-6 space-y-6">
        {/* Hero Header */}
        <section className="rounded-3xl bg-white border border-[#E5DCD0] p-5 sm:p-7 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-2 max-w-3xl">
            <span className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#FAF6F0] text-[#C85A32] border border-[#E5DCD0] text-xs font-extrabold uppercase tracking-wider">
              <Film className="h-4 w-4" />
              Estudio de Video Comercial Vertical 9:16 (1080×1920 px)
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#2D2A26] tracking-tight">
              Comercial Oficial: &ldquo;MoldeFácil, hecho por y para las modistas&rdquo;
            </h1>
            <p className="text-sm sm:text-base text-[#5C554E] leading-relaxed">
              Combina las 6 capturas reales de nuestra plataforma con locución IA en español sincronizada escena por escena, música cálida de taller y subtítulos dinámicos listos para TikTok, Reels y Shorts.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={handleCopyFullScript}
              className="min-h-[48px] px-4 py-2.5 rounded-2xl bg-[#FAF6F0] hover:bg-[#F3ECE2] text-[#2D2A26] border border-[#E5DCD0] text-sm font-extrabold inline-flex items-center gap-2 transition cursor-pointer"
            >
              {copiedScript ? (
                <>
                  <Check className="h-4 w-4 text-[#3B7A57]" />
                  <span className="text-[#3B7A57]">✓ Guion copiado</span>
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 text-[#C85A32]" />
                  <span>📋 Copiar guion completo</span>
                </>
              )}
            </button>
          </div>
        </section>

        {/* Primary Action Bar above Canvas (Paso 4) */}
        <section className="rounded-3xl bg-gradient-to-r from-[#FAF6F0] via-white to-[#FDF3EE] border-2 border-[#C85A32]/35 p-4 sm:p-6 shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={isPlaying || isRecording}
                onClick={() => runCommercialSequence(false)}
                className="min-h-[54px] px-6 py-3 rounded-2xl bg-[#3B7A57] hover:bg-[#2E6245] disabled:opacity-50 text-white text-sm sm:text-base font-extrabold shadow-sm inline-flex items-center gap-2.5 transition cursor-pointer"
              >
                <Play className="h-5 w-5 fill-current" />
                <span>▶️ Vista previa completa (con Voz IA y Música)</span>
              </button>

              <button
                type="button"
                disabled={isPlaying || isRecording}
                onClick={() => runCommercialSequence(true)}
                className="min-h-[54px] px-6 py-3 rounded-2xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-sm sm:text-base font-extrabold shadow-md shadow-rose-600/25 inline-flex items-center gap-2.5 transition cursor-pointer"
              >
                <Film className="h-5 w-5" />
                <span>🎬 Grabar y Descargar Video Final (.webm)</span>
              </button>

              {(isPlaying || isRecording) && (
                <button
                  type="button"
                  onClick={stopPlayback}
                  className="min-h-[54px] px-5 py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-extrabold inline-flex items-center gap-2 transition cursor-pointer"
                >
                  <Square className="h-4 w-4 fill-current" />
                  <span>Detener</span>
                </button>
              )}
            </div>

            {downloadUrl && (
              <a
                href={downloadUrl}
                download="moldefacil-comercial-modistas-9x16.webm"
                className="min-h-[50px] px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-extrabold inline-flex items-center gap-2 shadow-xs transition"
              >
                <Download className="h-4 w-4" />
                <span>Descargar archivo .webm nuevamente</span>
              </a>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm font-bold text-[#5C554E] bg-white/90 px-4 py-2.5 rounded-2xl border border-[#E5DCD0]">
            <span>{statusMessage}</span>
            <span className="text-[#3B7A57]">
              Capturas cargadas: {imagesReadyCount} / 6 • Resolución 1080×1920 (30 fps)
            </span>
          </div>
        </section>

        {/* Main Studio Grid: Left Canvas (9:16) + Right Voice & Storyboard Controls */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: 1080x1920 Vertical Canvas Preview */}
          <div className="lg:col-span-5 flex flex-col items-center space-y-4">
            <div className="w-full max-w-[420px] rounded-[36px] bg-slate-900 p-3 shadow-xl border-4 border-[#C85A32]/50">
              <canvas
                ref={canvasRef}
                width={1080}
                height={1920}
                className="w-full h-auto rounded-[26px] bg-[#FAF6F0] block"
              />
            </div>
            <p className="text-xs font-bold text-center text-[#5C554E]">
              Lienzo nativo en alta definición `1080 × 1920 px` (`9:16`). Toca cualquier escena a la derecha para previsualizarla.
            </p>
          </div>

          {/* Right Column: AI Voice Controls + 6-Scene Storyboard */}
          <div className="lg:col-span-7 space-y-6">
            {/* Paso 2: Motor de Voz en Off con IA + Música */}
            <section className="rounded-3xl bg-white border border-[#E5DCD0] p-5 sm:p-6 shadow-xs space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="w-10 h-10 rounded-2xl bg-[#FAF6F0] border border-[#E5DCD0] text-[#C85A32] flex items-center justify-center">
                    <Volume2 className="h-5 w-5" />
                  </span>
                  <div>
                    <h2 className="text-lg font-extrabold text-[#2D2A26]">
                      Motor de Voz en Off IA y Música Ambiental
                    </h2>
                    <p className="text-xs sm:text-sm text-[#5C554E]">
                      Sincronización automática con `utterance.onend` (+400 ms de pausa natural entre escenas)
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleTestVoice}
                  className="min-h-[44px] px-4 py-2 rounded-2xl bg-[#FAF6F0] hover:bg-[#FDF3EE] text-[#C85A32] border border-[#C85A32]/40 text-sm font-extrabold inline-flex items-center gap-2 transition cursor-pointer"
                >
                  <Volume2 className="h-4 w-4" />
                  <span>🔊 Probar voz en off</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5 md:col-span-2">
                  <label
                    htmlFor="voice-select"
                    className="block text-xs font-extrabold uppercase tracking-wide text-[#5C554E]"
                  >
                    Voz en Español detectada en tu navegador ({voices.length} disponibles)
                  </label>
                  <select
                    id="voice-select"
                    value={selectedVoiceURI}
                    onChange={(e) => setSelectedVoiceURI(e.target.value)}
                    className="w-full min-h-[48px] px-4 rounded-2xl bg-[#FAF8F5] border border-[#E5DCD0] text-sm sm:text-base font-bold text-[#2D2A26] focus:outline-none focus:ring-2 focus:ring-[#C85A32]"
                  >
                    {voices.length === 0 ? (
                      <option value="">
                        Voz en Español del sistema (predeterminada)
                      </option>
                    ) : (
                      voices.map((v) => (
                        <option key={v.voiceURI} value={v.voiceURI}>
                          {v.name} ({v.lang})
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div className="rounded-2xl bg-[#FAF6F0] border border-[#E5DCD0] p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs font-extrabold text-[#2D2A26]">
                    <span>VELOCIDAD DE LOCUCIÓN</span>
                    <span className="text-[#C85A32]">{speechRate.toFixed(2)}x</span>
                  </div>
                  <input
                    type="range"
                    min={0.82}
                    max={1.18}
                    step={0.02}
                    value={speechRate}
                    onChange={(e) => setSpeechRate(parseFloat(e.target.value))}
                    className="w-full accent-[#C85A32] cursor-pointer"
                  />
                  <span className="block text-[11px] text-[#5C554E]">
                    Por defecto `0.98x` para un ritmo cálido y claro de taller.
                  </span>
                </div>

                <div className="rounded-2xl bg-[#FAF6F0] border border-[#E5DCD0] p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs font-extrabold text-[#2D2A26]">
                    <span>TONO DE VOZ (PITCH)</span>
                    <span className="text-[#3B7A57]">{speechPitch.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min={0.88}
                    max={1.16}
                    step={0.01}
                    value={speechPitch}
                    onChange={(e) => setSpeechPitch(parseFloat(e.target.value))}
                    className="w-full accent-[#3B7A57] cursor-pointer"
                  />
                  <span className="block text-[11px] text-[#5C554E]">
                    Por defecto `1.02` para entonación amable y cercana.
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-2xl bg-[#F2F7F4] border border-[#C4DDD0] px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <Music className="h-5 w-5 text-[#3B7A57]" />
                  <div>
                    <span className="block text-sm font-extrabold text-[#1E3F2D]">
                      Música ambiental Web Audio API (Kalimba / Piano suave al 12%)
                    </span>
                    <span className="block text-xs text-[#264735]">
                      Con fade-out automático al terminar la Escena 6 y libre de derechos de autor en TikTok
                    </span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={musicEnabled}
                  onChange={(e) => setMusicEnabled(e.target.checked)}
                  className="h-5 w-5 accent-[#3B7A57] cursor-pointer"
                />
              </div>
            </section>

            {/* Paso 3: Guion y Selector de las 6 Escenas */}
            <section className="rounded-3xl bg-white border border-[#E5DCD0] p-5 sm:p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-extrabold text-[#2D2A26] flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-[#C85A32]" />
                  <span>Guion Oficial y Escenas del Comercial (6 Escenas)</span>
                </h2>
                <span className="text-xs font-bold text-[#5C554E]">
                  Toca una escena para verla en el lienzo
                </span>
              </div>

              <div className="space-y-3">
                {PROMO_SCENES.map((scene, idx) => {
                  const isCurrent = activeSceneIndex === idx;
                  return (
                    <div
                      key={scene.id}
                      onClick={() => {
                        activeSceneIndexRef.current = idx;
                        sceneStartTimeRef.current = performance.now();
                        sceneProgressRef.current = 0.35;
                        setActiveSceneIndex(idx);
                      }}
                      className={`rounded-2xl p-4 border-2 transition cursor-pointer ${
                        isCurrent
                          ? "bg-[#FAF6F0] border-[#C85A32] shadow-xs"
                          : "bg-white border-[#E5DCD0] hover:border-[#C85A32]/50"
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                        <span className="text-xs font-extrabold uppercase tracking-wider text-[#C85A32]">
                          Escena {scene.id} • {scene.badge}
                        </span>
                        <span className="text-xs font-bold text-[#3B7A57] bg-[#F2F7F4] px-2.5 py-0.5 rounded-full border border-[#C4DDD0]">
                          {scene.images.map((p) => p.replace("/promo/", "")).join(" + ")}
                        </span>
                      </div>

                      <h3 className="text-base font-extrabold text-[#2D2A26] mb-1">
                        {scene.screenTitle}
                      </h3>

                      <p className="text-sm text-[#4A453F] leading-relaxed italic">
                        &ldquo;{scene.voiceover}&rdquo;
                      </p>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
