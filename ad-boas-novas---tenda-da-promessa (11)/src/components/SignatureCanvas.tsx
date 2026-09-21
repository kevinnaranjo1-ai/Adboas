import React, { useRef } from 'react';
import SignaturePad from 'react-signature-canvas';
import { Trash2, Check, X } from 'lucide-react';

interface SignatureCanvasProps {
  onSave: (base64: string) => void;
  onClose: () => void;
  title?: string;
}

export default function SignatureCanvas({ onSave, onClose, title = 'Assinatura Digital' }: SignatureCanvasProps) {
  const sigCanvas = useRef<SignaturePad | null>(null);

  const clear = () => {
    sigCanvas.current?.clear();
  };

  const save = () => {
    if (sigCanvas.current?.isEmpty()) {
      alert('Por favor, desenhe sua assinatura antes de salvar.');
      return;
    }
    
    try {
      // Try to get trimmed canvas first
      const canvas = sigCanvas.current?.getTrimmedCanvas();
      const base64 = canvas?.toDataURL('image/png');
      if (base64) {
        onSave(base64);
      }
    } catch (err) {
      console.warn("Trimming failed, falling back to raw canvas:", err);
      // Fallback to raw canvas if trimming fails
      const rawCanvas = sigCanvas.current?.getCanvas();
      const base64 = rawCanvas?.toDataURL('image/png');
      if (base64) {
        onSave(base64);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-church-navy/60 backdrop-blur-md">
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden">
        <div className="bg-church-navy p-6 flex items-center justify-between">
          <h3 className="font-serif text-xl font-bold text-white">{title}</h3>
          <button onClick={onClose} className="text-white/60 hover:text-white transition-colors">
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="bg-church-cream/30 border-2 border-dashed border-church-gold/30 rounded-2xl overflow-hidden relative group">
            <SignaturePad
              ref={sigCanvas}
              canvasProps={{
                className: 'signature-canvas w-full h-64 cursor-crosshair',
              }}
              backgroundColor="rgba(255, 255, 255, 0)"
              penColor="#1a365d"
            />
            <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <p className="text-[10px] font-bold text-church-navy/30 uppercase tracking-widest">Área de Desenho</p>
            </div>
          </div>

          <p className="text-xs text-center text-church-navy/60 font-medium italic">
            Use o dedo ou o mouse para assinar no espaço acima.
          </p>

          <div className="flex gap-3">
            <button
              onClick={clear}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-gray-100 py-3.5 text-sm font-bold text-gray-600 hover:bg-gray-200 transition-all active:scale-95"
            >
              <Trash2 className="h-4 w-4" /> Limpar
            </button>
            <button
              onClick={save}
              className="flex-[2] flex items-center justify-center gap-2 rounded-xl bg-church-navy py-3.5 text-sm font-bold text-white shadow-lg hover:bg-church-navy/90 transition-all active:scale-95"
            >
              <Check className="h-4 w-4 text-church-gold" /> Salvar Assinatura
            </button>
          </div>
        </div>
      </div>
      <style>{`
        .signature-canvas {
          width: 100% !important;
          height: 256px !important;
          display: block;
        }
      `}</style>
    </div>
  );
}
