import { ImageResponse } from "next/og";

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#FAF8F5",
          padding: "56px",
        }}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            backgroundColor: "#FFFFFF",
            borderRadius: "36px",
            border: "3px solid #E2E8F0",
            padding: "56px",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              maxWidth: "700px",
              gap: "18px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
              <div
                style={{
                  width: "80px",
                  height: "80px",
                  borderRadius: "20px",
                  backgroundColor: "#E11D48",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#FFFFFF",
                  fontSize: "40px",
                  fontWeight: 800,
                }}
              >
                ✂
              </div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span
                  style={{
                    fontSize: "52px",
                    fontWeight: 800,
                    color: "#0F172A",
                    lineHeight: 1.05,
                  }}
                >
                  MoldeFácil
                </span>
                <span
                  style={{
                    fontSize: "26px",
                    fontWeight: 700,
                    color: "#0D9488",
                  }}
                >
                  Patrones de costura a medida
                </span>
              </div>
            </div>

            <div
              style={{
                fontSize: "32px",
                fontWeight: 700,
                color: "#1E293B",
                lineHeight: 1.25,
                marginTop: "12px",
              }}
            >
              Sube una foto, elige tu estilo de moda o ajusta tus medidas en
              segundos
            </div>

            <div
              style={{
                fontSize: "24px",
                color: "#475569",
              }}
            >
              PDF vectorial escala real 1:1 (Carta y A4)
            </div>

            <div
              style={{
                marginTop: "12px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "#E11D48",
                color: "#FFFFFF",
                borderRadius: "16px",
                padding: "16px 28px",
                fontSize: "24px",
                fontWeight: 800,
                alignSelf: "flex-start",
              }}
            >
              100% Gratis en tu navegador
            </div>
          </div>

          <svg
            width="240"
            height="360"
            viewBox="0 0 240 360"
            fill="none"
          >
            <path
              d="M78 26 C100 50, 140 50, 162 26 L208 46 L190 120 L230 330 L10 330 L50 120 L32 46 Z"
              fill="#F5EFE3"
              stroke="#1E293B"
              strokeWidth="5"
              strokeLinejoin="round"
            />
            <path
              d="M90 42 C108 60, 132 60, 150 42 L190 60 L174 120 L210 314 L30 314 L66 120 L50 60 Z"
              fill="none"
              stroke="#0D9488"
              strokeWidth="3"
              strokeDasharray="10 7"
            />
          </svg>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
