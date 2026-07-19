"use client";

import { useEffect, useRef, useState } from "react";
import { X, Camera, CameraOff, Loader2, CheckCircle2, AlertCircle, SwitchCamera } from "lucide-react";

/**
 * Leitura de código de barras pela câmera do celular (modo hands-free).
 *
 * Estratégia híbrida:
 *  - BarcodeDetector nativo quando disponível (Android/Chrome — leve e rápido);
 *  - Fallback para ZXing (@zxing/browser) via import dinâmico, cobrindo iOS Safari
 *    e navegadores sem a API nativa.
 *
 * Formatos: EAN-13/8, UPC-A/E, Code 128/39, ITF, Codabar e QR Code.
 * A câmera permanece aberta para leituras consecutivas; um cooldown por código
 * evita adicionar o mesmo item várias vezes no mesmo enquadramento.
 */

const FORMATS = [
  "ean_13",
  "ean_8",
  "upc_a",
  "upc_e",
  "code_128",
  "code_39",
  "itf",
  "codabar",
  "qr_code",
] as const;

type Feedback = { tone: "ok" | "err"; text: string } | null;

export function CameraScanner({
  onDetect,
  onClose,
  playBeep,
}: {
  /** Processa o código lido; retorna o que exibir como feedback na tela. */
  onDetect: (code: string) => Promise<{ ok: boolean; text: string }>;
  onClose: () => void;
  playBeep: (ok: boolean) => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [status, setStatus] = useState<"loading" | "scanning" | "denied" | "error">(
    "loading",
  );
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [flash, setFlash] = useState<"ok" | "err" | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);

  // Refs de controle: evitam re-render e permitem parar tudo na saída.
  const streamRef = useRef<MediaStream | null>(null);
  const zxingControlsRef = useRef<{ stop: () => void } | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef<{ code: string; at: number }>({ code: "", at: 0 });
  const processingRef = useRef(false);

  function showFeedback(ok: boolean, text: string) {
    playBeep(ok);
    setFeedback({ tone: ok ? "ok" : "err", text });
    setFlash(ok ? "ok" : "err");
    window.setTimeout(() => setFlash(null), ok ? 350 : 600);
  }

  async function handleCode(raw: string) {
    const code = raw.trim();
    if (!code) return;
    const now = Date.now();
    // Cooldown por código: ignora o MESMO código lido há menos de 1,5s
    // (o enquadramento gera muitas leituras por segundo).
    if (code === lastRef.current.code && now - lastRef.current.at < 1500) return;
    if (processingRef.current) return;
    processingRef.current = true;
    lastRef.current = { code, at: now };
    try {
      const res = await onDetect(code);
      showFeedback(res.ok, res.text);
    } finally {
      // pequena janela para o servidor responder antes de aceitar a próxima leitura
      window.setTimeout(() => {
        processingRef.current = false;
      }, 500);
    }
  }

  // Torch (lanterna) — quando o dispositivo suportar.
  async function toggleTorch() {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    try {
      await track.applyConstraints({
        advanced: [{ torch: !torchOn } as MediaTrackConstraintSet],
      });
      setTorchOn((v) => !v);
    } catch {
      /* alguns dispositivos não aceitam trocar em tempo real */
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function start() {
      const video = videoRef.current;
      if (!video) return;

      // Detector nativo?
      const NativeDetector = (
        window as unknown as { BarcodeDetector?: new (o: unknown) => unknown }
      ).BarcodeDetector;

      try {
        if (NativeDetector) {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: "environment" } },
            audio: false,
          });
          if (cancelled) {
            stream.getTracks().forEach((t) => t.stop());
            return;
          }
          streamRef.current = stream;
          video.srcObject = stream;
          await video.play();
          detectTorchSupport(stream);
          setStatus("scanning");

          // Só os formatos suportados pelo dispositivo.
          let supported: string[] = FORMATS as unknown as string[];
          try {
            const all = await (
              NativeDetector as unknown as {
                getSupportedFormats?: () => Promise<string[]>;
              }
            ).getSupportedFormats?.();
            if (all?.length) supported = FORMATS.filter((f) => all.includes(f));
          } catch {
            /* usa a lista padrão */
          }
          const detector = new NativeDetector({ formats: supported }) as {
            detect: (src: CanvasImageSource) => Promise<{ rawValue: string }[]>;
          };

          const loop = async () => {
            if (cancelled) return;
            if (video.readyState >= 2) {
              try {
                const codes = await detector.detect(video);
                if (codes[0]?.rawValue) await handleCode(codes[0].rawValue);
              } catch {
                /* frame ruim — segue */
              }
            }
            rafRef.current = requestAnimationFrame(loop);
          };
          loop();
          return;
        }

        // Fallback ZXing.
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        if (cancelled) return;
        const reader = new BrowserMultiFormatReader();
        const controls = await reader.decodeFromConstraints(
          { video: { facingMode: { ideal: "environment" } }, audio: false },
          video,
          (result) => {
            if (result) void handleCode(result.getText());
          },
        );
        if (cancelled) {
          controls.stop();
          return;
        }
        zxingControlsRef.current = controls;
        // ZXing gerencia o próprio stream — capturamos p/ torch.
        streamRef.current = (video.srcObject as MediaStream) ?? null;
        if (streamRef.current) detectTorchSupport(streamRef.current);
        setStatus("scanning");
      } catch (err) {
        if (cancelled) return;
        const name = (err as { name?: string })?.name;
        setStatus(
          name === "NotAllowedError" || name === "SecurityError" ? "denied" : "error",
        );
      }
    }

    function detectTorchSupport(stream: MediaStream) {
      const track = stream.getVideoTracks()[0];
      const caps = track?.getCapabilities?.() as { torch?: boolean } | undefined;
      setHasTorch(Boolean(caps?.torch));
    }

    start();

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      zxingControlsRef.current?.stop();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-black">
      {/* Barra superior */}
      <div className="flex items-center justify-between gap-2 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] text-white">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Camera className="h-5 w-5 text-brand-400" />
          Ler pela câmera
        </div>
        <div className="flex items-center gap-1.5">
          {hasTorch && status === "scanning" && (
            <button
              onClick={toggleTorch}
              className={`grid h-10 w-10 place-items-center rounded-full transition ${
                torchOn ? "bg-brand-500 text-ink-950" : "bg-white/10 text-white"
              }`}
              aria-label="Lanterna"
              title="Lanterna"
            >
              <SwitchCamera className="h-5 w-5" />
            </button>
          )}
          <button
            onClick={onClose}
            className="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
            aria-label="Fechar câmera"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Área da câmera */}
      <div className="relative flex-1 overflow-hidden">
        <video
          ref={videoRef}
          playsInline
          muted
          className="h-full w-full object-cover"
        />

        {/* Moldura de mira */}
        {status === "scanning" && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <div
              className={`relative h-40 w-[78%] max-w-sm rounded-2xl border-2 transition-colors ${
                flash === "ok"
                  ? "border-emerald-400"
                  : flash === "err"
                    ? "border-rose-400"
                    : "border-white/70"
              }`}
            >
              <span className="absolute -left-0.5 -top-0.5 h-6 w-6 rounded-tl-2xl border-l-4 border-t-4 border-brand-400" />
              <span className="absolute -right-0.5 -top-0.5 h-6 w-6 rounded-tr-2xl border-r-4 border-t-4 border-brand-400" />
              <span className="absolute -bottom-0.5 -left-0.5 h-6 w-6 rounded-bl-2xl border-b-4 border-l-4 border-brand-400" />
              <span className="absolute -bottom-0.5 -right-0.5 h-6 w-6 rounded-br-2xl border-b-4 border-r-4 border-brand-400" />
              {/* linha de leitura animada */}
              <span className="absolute inset-x-3 top-1/2 h-0.5 animate-pulse bg-brand-400/80" />
            </div>
          </div>
        )}

        {/* Overlay de flash colorido no acerto/erro */}
        {flash && (
          <div
            className={`pointer-events-none absolute inset-0 ${
              flash === "ok" ? "bg-emerald-500/15" : "bg-rose-500/20"
            }`}
          />
        )}

        {/* Carregando */}
        {status === "loading" && (
          <div className="absolute inset-0 grid place-items-center bg-black/70 text-center text-white">
            <div>
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-brand-400" />
              <p className="mt-3 text-sm">Iniciando a câmera…</p>
            </div>
          </div>
        )}

        {/* Permissão negada */}
        {status === "denied" && (
          <div className="absolute inset-0 grid place-items-center bg-black/80 px-8 text-center text-white">
            <div>
              <CameraOff className="mx-auto h-10 w-10 text-rose-400" />
              <p className="mt-3 text-base font-semibold">Acesso à câmera negado</p>
              <p className="mx-auto mt-1 max-w-xs text-sm text-white/70">
                Libere a permissão da câmera nas configurações do navegador e tente
                novamente. Você também pode usar um leitor físico de código de barras.
              </p>
              <button
                onClick={onClose}
                className="mt-5 rounded-xl bg-white/10 px-5 py-2.5 text-sm font-semibold hover:bg-white/20"
              >
                Voltar
              </button>
            </div>
          </div>
        )}

        {/* Erro genérico */}
        {status === "error" && (
          <div className="absolute inset-0 grid place-items-center bg-black/80 px-8 text-center text-white">
            <div>
              <AlertCircle className="mx-auto h-10 w-10 text-amber-400" />
              <p className="mt-3 text-base font-semibold">Não foi possível abrir a câmera</p>
              <p className="mx-auto mt-1 max-w-xs text-sm text-white/70">
                Verifique se o dispositivo tem câmera disponível e se o acesso está em
                uma conexão segura (HTTPS).
              </p>
              <button
                onClick={onClose}
                className="mt-5 rounded-xl bg-white/10 px-5 py-2.5 text-sm font-semibold hover:bg-white/20"
              >
                Voltar
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Rodapé com o feedback da última leitura */}
      <div className="px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 text-white">
        {feedback ? (
          <div
            className={`flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium ${
              feedback.tone === "ok"
                ? "bg-emerald-500/20 text-emerald-200"
                : "bg-rose-500/20 text-rose-200"
            }`}
          >
            {feedback.tone === "ok" ? (
              <CheckCircle2 className="h-5 w-5 shrink-0" />
            ) : (
              <AlertCircle className="h-5 w-5 shrink-0" />
            )}
            <span className="min-w-0 flex-1 truncate">{feedback.text}</span>
          </div>
        ) : (
          <p className="text-center text-xs text-white/60">
            Aponte a câmera para o código de barras — a leitura é automática e contínua.
          </p>
        )}
      </div>
    </div>
  );
}
