import React, { useState, useRef, useEffect } from 'react';
import { 
  X, Camera, Upload, Check, AlertCircle,
  Shield, Calendar, User, MessageSquare, Heart, Sparkles, BookOpen, Download
} from 'lucide-react';
import { motion } from 'motion/react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { doc, updateDoc, setDoc, getDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { format } from 'date-fns';
import Logo from './Logo';

interface Member {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  cpf?: string;
  birthDate?: string;
  department?: string;
  position?: string;
  conversionDate?: string;
  isBaptized: boolean;
  isSpiritBaptized: boolean;
  isTither: boolean;
  status: 'active' | 'inactive' | 'visitor';
  createdAt?: any;
  photoUrl?: string;
}

interface MemberIDCardModalProps {
  member: Member;
  onClose: () => void;
  canUploadPhoto: boolean; // True if admin, or if this is the logged-in user's own card
  onPhotoUpdated?: (memberId: string, newPhotoUrl: string) => void;
}

export default function MemberIDCardModal({ 
  member, 
  onClose, 
  canUploadPhoto,
  onPhotoUpdated 
}: MemberIDCardModalProps) {
  const [photoUrl, setPhotoUrl] = useState<string | undefined>(member.photoUrl);
  const [uploading, setUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [pastorSignature, setPastorSignature] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchSignature = async () => {
      try {
        const docSnap = await getDoc(doc(db, 'settings', 'pastor_signature'));
        if (docSnap.exists()) {
          setPastorSignature(docSnap.data().signature);
        }
      } catch (err) {
        console.error("Error fetching signature for card:", err);
      }
    };
    fetchSignature();
  }, []);

  // Generate a mock registration number based on ID and date
  const registrationNumber = `ADBN-${member.id.substring(0, 5).toUpperCase()}`;

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMsg('Por favor, selecione um arquivo de imagem.');
      return;
    }

    setUploading(true);
    setErrorMsg(null);
    setSuccessMsg(false);

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        // Standard ID card proportion is portrait (3:4 aspect ratio)
        // Let's crop/resize to 240x320 width x height
        const targetWidth = 240;
        const targetHeight = 320;
        
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext('2d');
        
        if (ctx) {
          // Fill white background
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, targetWidth, targetHeight);

          // Calculate source coordinates to center crop the image (aspect fill)
          const imgAspect = img.width / img.height;
          const targetAspect = targetWidth / targetHeight;
          let sx = 0, sy = 0, sWidth = img.width, sHeight = img.height;

          if (imgAspect > targetAspect) {
            // Image is wider than 3:4, crop sides
            sWidth = img.height * targetAspect;
            sx = (img.width - sWidth) / 2;
          } else {
            // Image is taller than 3:4, crop top/bottom
            sHeight = img.width / targetAspect;
            sy = (img.height - sHeight) / 2;
          }

          ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, targetWidth, targetHeight);
          
          // Highly compressed JPEG to keep Firestore size very small (~10KB)
          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
          
          savePhotoToFirestore(compressedBase64);
        } else {
          setUploading(false);
          setErrorMsg('Falha ao processar a imagem.');
        }
      };
      
      img.onerror = () => {
        setUploading(false);
        setErrorMsg('Erro ao abrir o arquivo de imagem.');
      };
      
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const savePhotoToFirestore = async (base64String: string) => {
    try {
      const docRef = doc(db, 'members', member.id);
      await setDoc(docRef, {
        name: member.name || 'Membro',
        email: member.email || '',
        position: member.position || 'Membro',
        status: member.status || 'active',
        photoUrl: base64String,
        updatedAt: new Date()
      }, { merge: true });
      
      setPhotoUrl(base64String);
      setSuccessMsg(true);
      if (onPhotoUpdated) {
        onPhotoUpdated(member.id, base64String);
      }
      setTimeout(() => setSuccessMsg(false), 3000);
    } catch (err: any) {
      console.error(err);
      setErrorMsg('Erro ao salvar foto no banco de dados.');
      handleFirestoreError(err, OperationType.WRITE, `members/${member.id}`);
    } finally {
      setUploading(false);
    }
  };

  const triggerFileSelect = () => {
    if (canUploadPhoto && !uploading) {
      fileInputRef.current?.click();
    }
  };



  const handleDownloadPDF = async () => {
    const frontCard = document.getElementById('id-card-front');
    const backCard = document.getElementById('id-card-back');
    if (!frontCard || !backCard) {
      setErrorMsg('Não foi possível encontrar os elementos da carteira para exportar.');
      return;
    }

    setGeneratingPdf(true);
    setErrorMsg(null);

    // Helper to convert oklch/oklab computed styles to rgb/rgba
    const convertModernColorToRgb = (colorStr: string): string => {
      if (!colorStr || (!colorStr.includes('oklch') && !colorStr.includes('oklab'))) return colorStr;
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 1;
        canvas.height = 1;
        const ctx = canvas.getContext('2d');
        if (!ctx) return colorStr;
        
        ctx.fillStyle = 'rgba(0, 0, 0, 0.001)';
        ctx.fillStyle = colorStr;
        
        if (ctx.fillStyle === 'rgba(0, 0, 0, 0.001)' || ctx.fillStyle === 'transparent') {
          if (colorStr.includes('church-navy')) return 'rgb(26, 54, 93)';
          if (colorStr.includes('church-gold')) return 'rgb(212, 175, 55)';
          return 'rgba(255, 255, 255, 1)';
        }

        ctx.fillRect(0, 0, 1, 1);
        const data = ctx.getImageData(0, 0, 1, 1).data;
        return `rgba(${data[0]}, ${data[1]}, ${data[2]}, ${data[3] / 255})`;
      } catch (e) {
        if (colorStr.includes('church-navy')) return 'rgb(26, 54, 93)';
        if (colorStr.includes('church-gold')) return 'rgb(212, 175, 55)';
        return 'rgba(255, 255, 255, 1)';
      }
    };

    try {
      // Configuration for rendering high quality image of DOM
      const canvasConfig = {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: null,
        logging: false,
        onclone: (clonedDoc: Document) => {
          // 1. Compile all stylesheets and remove links/styles to bypass html2canvas oklch/oklab parsing crash
          try {
            const stylesToInline: string[] = [];
            Array.from(document.styleSheets).forEach((sheet) => {
              try {
                const rules = Array.from(sheet.cssRules || sheet.rules);
                const cssText = rules.map(rule => rule.cssText).join('\n');
                stylesToInline.push(cssText);
              } catch (e) {
                // Ignore cross-origin stylesheet errors
              }
            });

            if (stylesToInline.length > 0) {
              // Delete existing stylesheets in the clone to stop parser evaluating invalid color profiles
              Array.from(clonedDoc.querySelectorAll('link[rel="stylesheet"], style')).forEach(el => el.remove());
              const cleanStyle = clonedDoc.createElement('style');
              let combinedCSS = stylesToInline.join('\n');
              // Replace all modern oklab/oklch functions with standard fallbacks inside the stylesheet text
              combinedCSS = combinedCSS.replace(/okl(ch|ab)\([^)]+\)/g, 'rgb(26, 54, 93)');
              cleanStyle.textContent = combinedCSS;
              clonedDoc.head.appendChild(cleanStyle);
            } else {
              // Fallback if sheets are not readable: replace in existing style tags
              Array.from(clonedDoc.querySelectorAll('style')).forEach((styleEl) => {
                let css = styleEl.textContent || '';
                css = css.replace(/okl(ch|ab)\([^)]+\)/g, 'rgb(26, 54, 93)');
                styleEl.textContent = css;
              });
            }
          } catch (e) {
            console.warn('Error sanitizing styles inside cloned document:', e);
          }

          // 2. Resolve final computed styles down the DOM tree representing each element
          const processTree = (originalNode: HTMLElement, clonedNode: HTMLElement) => {
            const style = window.getComputedStyle(originalNode);
            const colorProps = [
              'color',
              'backgroundColor',
              'borderColor',
              'borderTopColor',
              'borderRightColor',
              'borderBottomColor',
              'borderLeftColor',
              'fill',
              'stroke'
            ];

            colorProps.forEach((prop) => {
              const val = (style as any)[prop];
              if (val && (val.includes('oklch') || val.includes('oklab'))) {
                const rgbVal = convertModernColorToRgb(val);
                (clonedNode.style as any)[prop] = rgbVal;
              }
            });

            const bgImage = style.backgroundImage;
            if (bgImage && (bgImage.includes('oklch') || bgImage.includes('oklab'))) {
              const oklMatchRegex = /okl(ch|ab)\([^)]+\)/g;
              const matches = bgImage.match(oklMatchRegex);
              if (matches) {
                let newBgImage = bgImage;
                matches.forEach((match) => {
                  const rgbVal = convertModernColorToRgb(match);
                  newBgImage = newBgImage.replace(match, rgbVal);
                });
                clonedNode.style.backgroundImage = newBgImage;
              }
            }

            // Copy important layout features inline to guarantee exact alignment
            clonedNode.style.lineHeight = style.lineHeight;
            clonedNode.style.letterSpacing = style.letterSpacing;
            clonedNode.style.fontSize = style.fontSize;
            clonedNode.style.fontWeight = style.fontWeight;

            const originalChildren = Array.from(originalNode.children) as HTMLElement[];
            const clonedChildren = Array.from(clonedNode.children) as HTMLElement[];
            for (let i = 0; i < originalChildren.length; i++) {
              if (originalChildren[i] && clonedChildren[i]) {
                processTree(originalChildren[i], clonedChildren[i]);
              }
            }
          };

          const clonedFront = clonedDoc.getElementById('id-card-front');
          if (clonedFront) {
            processTree(frontCard as HTMLElement, clonedFront as HTMLElement);
          }
          const clonedBack = clonedDoc.getElementById('id-card-back');
          if (clonedBack) {
            processTree(backCard as HTMLElement, clonedBack as HTMLElement);
          }
        }
      };

      const frontCanvas = await html2canvas(frontCard, canvasConfig);
      const backCanvas = await html2canvas(backCard, canvasConfig);

      const frontImgData = frontCanvas.toDataURL('image/png');
      const backImgData = backCanvas.toDataURL('image/png');

      // Create PDF in A4, Portrait mode (mm scale)
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      // Add a header/title page
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(16);
      pdf.setTextColor(26, 54, 93); // church-navy color
      pdf.text('ASSEMBLEIA DE DEUS BOAS NOVAS', 105, 25, { align: 'center' });
      
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      pdf.setTextColor(113, 128, 150);
      pdf.text('Credencial Oficial de Membro / Cartão de Identificação', 105, 31, { align: 'center' });

      // Calculate sizes and positions for A4 page:
      const cardWidthmm = 68;
      const cardHeightmm = 96;

      // Position side by side on the center row
      const yPos = 48;
      const xFront = 32;
      const xBack = 110;

      // Draw dashed border frame guide around the cards to make cutting easier
      pdf.setDrawColor(212, 175, 55); // church-gold
      pdf.setLineDashPattern([2, 2], 0);
      pdf.setLineWidth(0.3);
      pdf.rect(xFront - 1, yPos - 1, cardWidthmm + 2, cardHeightmm + 2, 'D');
      pdf.rect(xBack - 1, yPos - 1, cardWidthmm + 2, cardHeightmm + 2, 'D');

      // Draw the images
      pdf.addImage(frontImgData, 'PNG', xFront, yPos, cardWidthmm, cardHeightmm);
      pdf.addImage(backImgData, 'PNG', xBack, yPos, cardWidthmm, cardHeightmm);

      // Add footer/help content
      pdf.setLineDashPattern([], 0); // Reset dash
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(9);
      pdf.setTextColor(26, 54, 93);
      pdf.text('Instruções para Confecção da Carteira Física:', 105, 160, { align: 'center' });

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);
      pdf.setTextColor(74, 85, 104);
      const instructions = [
        '1. Imprima este documento em folha A4 (preferencialmente papel fotográfico ou couchê de alta gramatura).',
        '2. Certifique-se de imprimir em "Tamanho Real" ou sem margens de escala nas configurações de impressão.',
        '3. Recorte os dois retângulos ao longo das linhas tracejadas.',
        '4. Dobre-os no meio (ou una as duas partes verso a verso) de maneira alinhada.',
        '5. Plastifique (ou insira em um porta-crachá rígido) para obter sua credencial física oficial.'
      ];

      let currentY = 166;
      instructions.forEach((line) => {
        pdf.text(line, 105, currentY, { align: 'center' });
        currentY += 5;
      });

      // Gold line separator
      pdf.setDrawColor(212, 175, 55);
      pdf.setLineWidth(0.5);
      pdf.line(40, currentY + 3, 170, currentY + 3);

      pdf.setFont('helvetica', 'italic');
      pdf.setFontSize(8);
      pdf.setTextColor(160, 174, 192);
      pdf.text(`Documento gerado para: ${member.name} - ADBN-Membro`, 105, currentY + 9, { align: 'center' });

      // Save PDF
      const fileName = `carteira_${member.name.toLowerCase().replace(/\s+/g, '_')}.pdf`;
      pdf.save(fileName);
    } catch (err: any) {
      console.error('Error generating PDF:', err);
      setErrorMsg('Erro ao gerar o arquivo PDF: ' + err.message);
    } finally {
      setGeneratingPdf(false);
    }
  };

  const formatDateString = (date?: string) => {
    if (!date) return 'N/A';
    try {
      const parts = date.split('-');
      if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
      return format(new Date(date), 'dd/MM/yyyy');
    } catch (e) {
      return date;
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-church-navy/70 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 30 }}
        className="w-full max-w-3xl bg-church-cream rounded-[2.5rem] overflow-hidden shadow-2xl border border-church-gold/20 flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="bg-church-navy text-white p-6 flex justify-between items-center shrink-0 border-b border-church-gold/10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-church-gold/10 text-church-gold border border-church-gold/20">
              <Shield className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-serif text-xl font-bold">Carteira de Membro</h3>
              <p className="text-xs text-church-gold/60 uppercase tracking-widest font-extrabold">AD Boas Novas</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl bg-white/10 p-2 text-white/60 hover:text-white transition-all active:scale-95"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Inner Content scrollable */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 flex flex-col items-center">
          
          {/* Live Messages & Info */}
          {canUploadPhoto && (
            <div className="w-full max-w-xl bg-church-gold/5 border border-church-gold/20 rounded-2xl p-4 text-xs text-church-navy flex items-start gap-3">
              <Sparkles className="h-4 w-4 text-church-gold shrink-0 mt-0.5" />
              <div>
                <p className="font-bold mb-1">Personalize sua Credencial!</p>
                <p className="text-church-navy/70">
                  Clique na foto da carteira abaixo para carregar uma foto diretamente do seu dispositivo. 
                  O sistema irá cortar e comprimir a foto automaticamente no tamanho oficial de retrato.
                </p>
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="w-full max-w-xl bg-red-550/10 border border-red-500/20 text-red-700 rounded-2xl p-4 text-xs flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span className="font-medium">{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="w-full max-w-xl bg-green-500/10 border border-green-500/20 text-green-700 rounded-2xl p-4 text-xs flex items-center gap-2">
              <Check className="h-4 w-4 shrink-0" />
              <span className="font-extrabold">Foto atualizada com sucesso no banco de dados!</span>
            </div>
          )}

          {/* Printable Container wrapper */}
          <div 
            ref={cardRef} 
            className="flex flex-col md:flex-row gap-6 relative p-2 bg-transparent justify-center items-center w-full"
          >
            {/* FRONT OF THE CARD */}
            <div 
              id="id-card-front"
              className="w-[340px] h-[480px] bg-gradient-to-br from-church-navy via-church-navy to-slate-900 border-4 border-church-gold rounded-3xl p-5 text-white relative shadow-xl overflow-hidden flex flex-col justify-between"
            >
              {/* Background watermark/waves */}
              <div className="absolute inset-0 opacity-[0.03] pointer-events-none select-none flex items-center justify-center">
                <Shield className="w-72 h-72 text-church-gold" />
              </div>

              {/* Decorative side accent */}
              <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-church-gold" />

              {/* Header section */}
              <div className="text-center relative pl-1">
                <div className="flex items-center justify-center gap-2">
                  <div className="h-12 w-12 flex items-center justify-center overflow-hidden shrink-0">
                    <Logo size={48} variant="front" />
                  </div>
                  <div className="text-left flex flex-col justify-center">
                    <h4 className="text-[7.5px] tracking-[0.14em] font-black uppercase text-church-gold leading-none mb-0.5">Assembleia de Deus</h4>
                    <h3 className="font-serif text-amber-50 text-[11px] font-black tracking-wider leading-none">BOAS NOVAS</h3>
                    <p className="text-[7.5px] font-extrabold text-white/70 uppercase leading-none mt-1 whitespace-nowrap">Tenda da Promessa</p>
                  </div>
                </div>
                <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-church-gold/40 to-transparent mt-2.5" />
              </div>

              {/* Title label */}
              <div className="flex justify-center my-1.5">
                <span className="bg-church-gold/10 border border-church-gold/30 text-church-gold px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest">
                  Carteira de Membro
                </span>
              </div>

              {/* Portrait Image Uploadable Frame */}
              <div className="flex flex-col items-center relative z-10 my-1">
                <div 
                  className="relative h-28 w-20 rounded-xl overflow-hidden border-2 border-church-gold/40 bg-white/5 flex items-center justify-center group"
                >
                  {photoUrl ? (
                    <img 
                      src={photoUrl} 
                      alt={member.name} 
                      className="h-full w-full object-cover rounded-xl"
                      style={{ width: '80px', height: '112px', objectFit: 'cover', borderRadius: '8px' }}
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-white/30 p-2 text-center">
                      <User className="h-8 w-8 text-white/20 mb-1" />
                      <span className="text-[8px] font-bold">Sem Foto</span>
                    </div>
                  )}

                  {canUploadPhoto && (
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center transition-all text-white p-1 text-center">
                      <Camera className="h-5 w-5 text-church-gold mb-1" />
                      <span className="text-[8px] font-extrabold uppercase">Alterar Foto</span>
                    </div>
                  )}

                  {canUploadPhoto && (
                    <input 
                      type="file" 
                      onChange={handlePhotoSelect}
                      className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-20" 
                      accept="image/*"
                      title="Escolher foto de perfil"
                    />
                  )}

                  {uploading && (
                    <div className="absolute inset-0 bg-church-navy/80 flex items-center justify-center z-30">
                      <div className="h-5 w-5 border-2 border-church-gold border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                </div>
              </div>

              {/* Member Basic Info Panel */}
              <div className="text-center px-2 relative z-10 flex flex-col items-center justify-center w-full min-h-[50px] my-1">
                <h2 
                  className="font-serif font-black tracking-tight text-white mb-2 break-words w-full max-w-[280px] text-center"
                  style={{ 
                    fontSize: member.name.length > 25 ? '11px' : member.name.length > 18 ? '13px' : '15px', 
                    lineHeight: '1.25',
                    minHeight: '26px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  {member.name}
                </h2>
                <div className="flex flex-row flex-wrap items-center justify-center gap-1.5 w-full mt-1">
                  <span className="bg-church-gold px-2.5 py-0.5 rounded text-church-navy text-[8px] font-black uppercase tracking-wider shrink-0">
                    {member.position || 'Membro'}
                  </span>
                  {member.department && (
                    <span className="text-[8px] font-black text-church-gold uppercase tracking-wider break-words max-w-[170px] text-center">
                      {member.department}
                    </span>
                  )}
                </div>
              </div>

              {/* Bottom footer bar with barcode decorative element */}
              <div className="border-t border-church-gold/20 pt-2 flex justify-between items-center text-[8px] font-bold uppercase tracking-widest text-white/65 relative z-10 px-2">
                <div>
                  <p className="text-[6px] text-white/40">Registro Oficial</p>
                  <p className="text-church-gold font-mono font-bold leading-none">{registrationNumber}</p>
                </div>
                {/* Decorative Digital Barcode */}
                <div className="flex flex-col items-end opacity-40">
                  <div className="flex gap-[1px] h-4 items-center">
                    <span className="w-[1px] h-full bg-white" />
                    <span className="w-[2px] h-full bg-white" />
                    <span className="w-[1px] h-full bg-white" />
                    <span className="w-[3px] h-full bg-white" />
                    <span className="w-[1px] h-full bg-white" />
                    <span className="w-[2px] h-full bg-white" />
                    <span className="w-[1px] h-full bg-white" />
                    <span className="w-[1px] h-full bg-white" />
                    <span className="w-[3px] h-full bg-white" />
                  </div>
                  <span className="text-[5px] font-mono leading-none tracking-tight">ADBN001</span>
                </div>
              </div>
            </div>

            {/* BACK OF THE CARD */}
            <div 
              id="id-card-back"
              className="w-[340px] h-[480px] bg-white border-4 border-church-navy rounded-3xl p-5 text-church-navy relative shadow-xl overflow-hidden flex flex-col justify-between"
            >
              {/* Decorative elements */}
              <div className="absolute right-0 top-0 bottom-0 w-1.5 bg-church-navy" />
              
              {/* Header */}
              <div className="text-center flex flex-col items-center justify-center">
                <div className="h-12 w-12 flex items-center justify-center overflow-hidden mb-1.5 shrink-0">
                  <Logo size={48} variant="back" />
                </div>
                <h4 className="text-[9px] font-black uppercase tracking-widest text-church-gold">Dados Administrativos</h4>
                <div className="h-[1px] w-full bg-church-gold/20 mt-1" />
              </div>

              {/* Main Attributes list */}
              <div className="my-2 text-xs flex flex-col gap-2.5">
                <div className="grid grid-cols-2 gap-3 mb-1">
                  <div className="bg-church-cream/40 p-2 rounded-xl border border-church-gold/10">
                    <p className="text-[7px] font-black uppercase tracking-wider text-church-navy/40">Nascimento</p>
                    <p className="font-bold text-church-navy text-xs">{formatDateString(member.birthDate)}</p>
                  </div>
                  <div className="bg-church-cream/40 p-2 rounded-xl border border-church-gold/10">
                    <p className="text-[7px] font-black uppercase tracking-wider text-church-navy/40">Conversão</p>
                    <p className="font-bold text-church-navy text-xs">{formatDateString(member.conversionDate)}</p>
                  </div>
                </div>

                {/* Email and Contacts */}
                <div className="bg-church-cream/40 p-2 rounded-xl border border-church-gold/10 flex flex-col gap-1.5">
                  {member.cpf && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[7px] w-12 font-black uppercase tracking-wider text-church-navy/40">CPF:</span>
                      <span className="font-bold text-church-navy text-[10px] font-mono">{member.cpf}</span>
                    </div>
                  )}
                  {member.whatsapp && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[7px] w-12 font-black uppercase tracking-wider text-church-navy/40">WhatsApp:</span>
                      <span className="font-bold text-church-navy text-[10px]">{member.whatsapp}</span>
                    </div>
                  )}
                  {member.email && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[7px] w-12 font-black uppercase tracking-wider text-church-navy/40">E-mail:</span>
                      <span className="font-bold text-church-navy text-[10px] break-all max-w-[210px] sm:max-w-none">{member.email}</span>
                    </div>
                  )}
                </div>

                {/* Badges/Spiritual Achievements checkmarks */}
                <div className="bg-church-navy/[0.02] p-2.5 rounded-xl border border-church-navy/5 flex flex-col gap-2.5">
                  <div className="flex flex-col gap-2.5 pt-1">
                    {/* Water baptism */}
                    <div className="flex items-center justify-between text-[10px] font-bold">
                      <span className="text-church-navy/75 uppercase tracking-wider text-[8px] font-extrabold flex items-center gap-1">
                        <span className={`w-1.5 h-1.5 rounded-full ${member.isBaptized ? 'bg-church-gold' : 'bg-church-navy/10'}`} />
                        Batismo nas Águas
                      </span>
                      <span className={`px-2 py-0.2 rounded text-[8px] font-bold uppercase ${
                        member.isBaptized ? 'bg-church-gold/10 text-church-navy' : 'bg-church-navy/5 text-church-navy/30'
                      }`}>
                        {member.isBaptized ? 'Sim' : 'Não'}
                      </span>
                    </div>

                    {/* Spirit baptism */}
                    <div className="flex items-center justify-between text-[10px] font-bold">
                      <span className="text-church-navy/75 uppercase tracking-wider text-[8px] font-extrabold flex items-center gap-1">
                        <span className={`w-1.5 h-1.5 rounded-full ${member.isSpiritBaptized ? 'bg-church-gold' : 'bg-church-navy/10'}`} />
                        Batismo No Espírito
                      </span>
                      <span className={`px-2 py-0.2 rounded text-[8px] font-bold uppercase ${
                        member.isSpiritBaptized ? 'bg-church-gold/10 text-church-navy' : 'bg-church-navy/5 text-church-navy/30'
                      }`}>
                        {member.isSpiritBaptized ? 'Sim' : 'Não'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Pastor Signature Block */}
              <div className="flex flex-col items-center text-center mt-2">
                <div className="w-40 border-b border-church-navy/30 h-10 flex items-center justify-center relative">
                  {pastorSignature && (
                    <img src={pastorSignature} alt="Assinatura" className="max-h-full max-w-full object-contain mix-blend-multiply" />
                  )}
                </div>
                <p className="text-[7px] font-black uppercase tracking-wider text-church-navy mt-1">Pr. Luiz Farias</p>
                <p className="text-[5px] font-bold uppercase tracking-widest text-church-navy/40">Presidente AD Boas Novas Paraná</p>
              </div>

              {/* Warning notice */}
              <div className="text-center border-t border-church-gold/15 pt-2">
                <p className="text-[6px] text-church-navy/40 leading-tight">
                  Esta credencial é pessoal e intransferível. Propriedade da Assembleia de Deus Boas Novas. Em caso de perda, favor devolver no endereço da Sede.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer Controls */}
        <div className="p-4 sm:p-6 bg-white border-t border-church-gold/10 flex flex-col sm:flex-row justify-between items-stretch sm:items-center shrink-0 gap-3">
          <div className="flex flex-col sm:flex-row gap-2 flex-1">
            <button
              disabled={generatingPdf}
              onClick={handleDownloadPDF}
              className="flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-church-gold text-church-navy hover:bg-church-gold/90 text-xs font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50"
            >
              {generatingPdf ? (
                <>
                  <div className="h-4 w-4 border-2 border-church-navy/30 border-t-church-navy rounded-full animate-spin" />
                  <span>Gerando PDF...</span>
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  <span>Baixar PDF (Perfeito)</span>
                </>
              )}
            </button>
          </div>
          
          <button
            onClick={onClose}
            className="px-6 py-3 bg-church-navy text-white text-xs font-black uppercase tracking-widest rounded-2xl hover:bg-church-navy/90 transition-all active:scale-95"
          >
            Fechar
          </button>
        </div>
      </motion.div>
    </div>
  );
}
