import {
  AutoProcessor,
  CLIPVisionModelWithProjection,
  env,
  RawImage,
  SiglipVisionModel,
} from "@huggingface/transformers";

export type EmbedderDevice = "cpu" | "wasm" | "webgpu";

export interface LoadedImageEmbedder {
  modelId: string;
  device: EmbedderDevice;
  kind: "siglip" | "clip";
  processor: (image: RawImage) => Promise<Record<string, unknown>>;
  model: (inputs: Record<string, unknown>) => Promise<Record<string, unknown>>;
}

const cachedEmbedders = new Map<string, Promise<LoadedImageEmbedder>>();

function esEntornoNode(): boolean {
  return (
    typeof process !== "undefined" &&
    Boolean(process.versions?.node) &&
    typeof self === "undefined" &&
    typeof window === "undefined"
  );
}

function normalizarL2(raw: ArrayLike<number>): Float32Array {
  const out = new Float32Array(raw.length);
  let normSq = 0;
  for (let i = 0; i < raw.length; i++) {
    const v = raw[i];
    out[i] = v;
    normSq += v * v;
  }
  const norm = Math.sqrt(normSq);
  if (norm > 1e-12) {
    const inv = 1 / norm;
    for (let i = 0; i < out.length; i++) {
      out[i] *= inv;
    }
  }
  return out;
}

/**
 * Carga y cachea procesador + encoder visual (`SiglipVisionModel` o `CLIPVisionModelWithProjection`)
 * para extraer vectores normalizados L2 de imágenes de prenda.
 */
export async function cargarEmbedderImagen(
  modelId: string,
  device: EmbedderDevice = "cpu"
): Promise<LoadedImageEmbedder> {
  const cacheKey = `${modelId}::${device}`;
  const existente = cachedEmbedders.get(cacheKey);
  if (existente) return existente;

  const promesa = (async (): Promise<LoadedImageEmbedder> => {
    const enNode = esEntornoNode();
    env.allowLocalModels = false;
    env.allowRemoteModels = true;
    env.useBrowserCache = !enNode;
    env.useWasmCache = true;

    const kind: "siglip" | "clip" = modelId.toLowerCase().includes("siglip")
      ? "siglip"
      : "clip";

    const processorPromise = AutoProcessor.from_pretrained(modelId, {});
    const modelPromise =
      kind === "siglip"
        ? SiglipVisionModel.from_pretrained(modelId, { dtype: "q8", device })
        : CLIPVisionModelWithProjection.from_pretrained(modelId, {
            dtype: "q8",
            device,
          });

    const [processor, model] = await Promise.all([processorPromise, modelPromise]);
    return {
      modelId,
      device,
      kind,
      processor: processor as unknown as LoadedImageEmbedder["processor"],
      model: model as unknown as LoadedImageEmbedder["model"],
    };
  })().catch((err) => {
    cachedEmbedders.delete(cacheKey);
    throw err;
  });

  cachedEmbedders.set(cacheKey, promesa);
  return promesa;
}

/**
 * Calcula el vector L2-normalizado de una vista `RawImage` usando el modelo visual cargado.
 */
export async function calcularEmbeddingImagen(
  embedder: LoadedImageEmbedder,
  image: RawImage
): Promise<Float32Array> {
  const inputs = await embedder.processor(image);
  const outputs = await embedder.model(inputs);
  const tensorCandidate =
    embedder.kind === "siglip"
      ? (outputs.pooler_output as { data?: ArrayLike<number> } | undefined)
      : (outputs.image_embeds as { data?: ArrayLike<number> } | undefined);

  const data = tensorCandidate?.data;
  if (!data || data.length === 0) {
    throw new Error(
      `El modelo ${embedder.modelId} (${embedder.kind}) no devolvió el tensor de embedding esperado.`
    );
  }

  return normalizarL2(data);
}
