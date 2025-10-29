import React, { useState, useRef, useCallback, useEffect, useLayoutEffect } from 'react';
import { jsPDF } from 'jspdf';
import { toPng } from 'html-to-image';
// FIX: Corrected import paths to be relative and removed unused 'JEDDAH_SCHOOLS' import.
import { CERTIFICATE_TEMPLATES, TEXT_COLORS } from './constants';
import type { Elements, DownloadHistoryItem } from './types';
import { Controls } from './components/Controls';
import { CertificatePreview } from './components/CertificatePreview';
import { AdminDashboard } from './components/AdminDashboard';
import { PasswordModal } from './components/PasswordModal';
import { ConfirmationModal } from './components/ConfirmationModal';
import { AlertModal } from './components/AlertModal';

// --- App Component ---
const App = () => {
  const [selectedTemplateId, setSelectedTemplateId] = useState(CERTIFICATE_TEMPLATES[0].id);
  
  const getInitialElements = useCallback(() => ({
    name: {
      id: 'name', text: '', position: { x: 67, y: 37.5 },
      fontSize: 19, color: TEXT_COLORS[1],
    },
    school: {
      id: 'school', text: '', position: { x: 67, y: 43 },
      fontSize: 19, color: TEXT_COLORS[1],
    },
  }), []);

  const [elements, setElements] = useState<Elements>(getInitialElements());
  const [isLoading, setIsLoading] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [alertMessage, setAlertMessage] = useState<React.ReactNode>('');

  const [downloadHistory, setDownloadHistory] = useState<DownloadHistoryItem[]>([]);

  const previewRef = useRef<HTMLDivElement>(null);
  const reportRef = useRef<HTMLDivElement>(null);

  // Fetch stats when admin panel is opened
  useEffect(() => {
    const fetchHistory = async () => {
      if (showAdmin && isAdminAuthenticated) {
        try {
          const response = await fetch('/.netlify/functions/get-statistics');
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          const data = await response.json();
          setDownloadHistory(data);
        } catch (error) {
          console.error("Failed to fetch statistics:", error);
          setAlertMessage('فشل في جلب الإحصائيات. يرجى المحاولة مرة أخرى.');
          setShowAlertModal(true);
        }
      }
    };
    fetchHistory();
  }, [showAdmin, isAdminAuthenticated]);


  useEffect(() => {
    const canvas = document.getElementById('network-canvas') as HTMLCanvasElement;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let particles: Particle[];
    let animationFrameId: number;

    const resizeCanvas = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    class Particle {
        x: number; y: number; speedX: number; speedY: number; size: number; color: string;
        constructor(x: number, y: number, color: string) { this.x = x; this.y = y; this.speedX = Math.random() * 0.5 - 0.25; this.speedY = Math.random() * 0.5 - 0.25; this.size = Math.random() * 1.5 + 1; this.color = color; }
        update() { if (this.x > canvas.width || this.x < 0) this.speedX *= -1; if (this.y > canvas.height || this.y < 0) this.speedY *= -1; this.x += this.speedX; this.y += this.speedY; }
        draw() { ctx.fillStyle = this.color; ctx.beginPath(); ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2); ctx.fill(); }
    }
    const init = () => { resizeCanvas(); particles = []; const num = 50; for (let i = 0; i < num; i++) { particles.push(new Particle(Math.random() * canvas.width, Math.random() * canvas.height, 'rgba(0, 164, 154, 0.5)')); } };
    const connect = () => {
        let opacityValue = 1; for (let a = 0; a < particles.length; a++) { for (let b = a; b < particles.length; b++) { const distance = Math.sqrt((particles[a].x - particles[b].x) ** 2 + (particles[a].y - particles[b].y) ** 2); const connectRadius = 180; if (distance < connectRadius) { opacityValue = 1 - (distance / connectRadius); ctx.strokeStyle = `rgba(0, 164, 154, ${opacityValue})`; ctx.lineWidth = 0.5; ctx.beginPath(); ctx.moveTo(particles[a].x, particles[a].y); ctx.lineTo(particles[b].x, particles[b].y); ctx.stroke(); } } }
    };
    const animate = () => { ctx.clearRect(0, 0, canvas.width, canvas.height); particles.forEach(p => { p.update(); p.draw(); }); connect(); animationFrameId = requestAnimationFrame(animate); };
    init(); animate();
    window.addEventListener('resize', init);
    return () => { window.removeEventListener('resize', init); cancelAnimationFrame(animationFrameId); };
  }, []);

  const selectedTemplate = CERTIFICATE_TEMPLATES.find(t => t.id === selectedTemplateId) || CERTIFICATE_TEMPLATES[0];
  const handleTemplateChange = (templateId: string) => { setSelectedTemplateId(templateId); setElements(getInitialElements()); };
  const handleElementChange = (id: string, updates: Partial<{text: string; color: string}>) => setElements(prev => ({ ...prev, [id]: { ...prev[id], ...updates } }));
  const handleGlobalColorChange = (color: string) => setElements(prev => { const newElements = {...prev}; for(const key in newElements) { newElements[key].color = color; } return newElements; });
  
  const handleDownload = async (format: 'png' | 'pdf') => {
    const studentNameValue = elements['name']?.text.trim();
    const schoolNameValue = elements['school']?.text.trim();

    if (!studentNameValue || !schoolNameValue) {
        const formattedMessage = (
            <>
                <span className="block text-xl font-bold text-white mb-4">الشهادة جاهزة تقريباً!</span>
                <span className="block">لمسة أخيرة بسيطة: يرجى إضافة اسم صاحب الإنجاز والمدرسة التي يمثلها لتكتمل فرحة التكريم.</span>
            </>
        );
        setAlertMessage(formattedMessage);
        setShowAlertModal(true);
        return;
    }
      
    if (!previewRef.current) return;
    setIsLoading(true);
    try {
        const studentName = studentNameValue || 'شهادة';
        const schoolName = schoolNameValue || 'غير محدد';
        const dataUrl = await toPng(previewRef.current, { quality: 1, pixelRatio: 3, backgroundColor: 'white' });
        
        // Record download in Supabase
        const newRecord = { 
            certificate_type: selectedTemplateId, 
            file_format: format, 
            student_name: studentName,
            school_name: schoolName,
        };
        await fetch('/.netlify/functions/record-download', {
            method: 'POST',
            body: JSON.stringify(newRecord),
        });
        
        const filename = `شهادة صناعيو المستقبل_${studentName}`;
        if (format === 'png') {
            const link = document.createElement('a');
            link.download = `${filename}.png`;
            link.href = dataUrl;
            link.click();
        } else {
            const img = new Image();
            img.src = dataUrl;
            img.onload = () => {
                const pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: [img.width, img.height] });
                pdf.addImage(dataUrl, 'PNG', 0, 0, img.width, img.height);
                pdf.save(`${filename}.pdf`);
            }
        }
    } catch (error) { console.error('Download error:', error); } finally { setIsLoading(false); }
  };

    const handleDownloadPdfReport = async () => {
        if (!reportRef.current) return;
        try {
            const dataUrl = await toPng(reportRef.current, { 
                quality: 1, 
                pixelRatio: 2,
                backgroundColor: '#0f172a'
            });
            const pdf = new jsPDF({ orientation: 'portrait', unit: 'px', format: 'a4' });
            const pdfWidth = pdf.internal.pageSize.getWidth();
            pdf.addImage(dataUrl, 'PNG', 0, 0, pdfWidth, pdf.internal.pageSize.getHeight());
            pdf.save(`تقرير صناعيو المستقبل - ${new Date().toLocaleDateString('ar-SA')}.pdf`);
        } catch (error) {
            console.error('Error generating PDF report:', error);
        }
    };

    const handleDownloadExcelReport = () => {
        if (downloadHistory.length === 0) return;
        const headers = ['الوقت', 'اسم الطالب', 'المدرسة', 'نوع الشهادة', 'الصيغة'];
        const rows = downloadHistory.map(row => 
            [
                new Date(row.created_at).toLocaleString('ar-SA'),
                `"${row.student_name}"`,
                `"${row.school_name}"`,
                row.certificate_type,
                row.file_format
            ].join(',')
        );
        const csvContent = "\uFEFF" + [headers.join(','), ...rows].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', `تقرير تحميلات صناعيو المستقبل.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };

  const handleAdminClick = () => { if (isAdminAuthenticated) { setShowAdmin(!showAdmin); } else { setShowPasswordModal(true); } };
  const handlePasswordSubmit = (password: string) => { if (password === 'AdminFuture') { setIsAdminAuthenticated(true); setShowPasswordModal(false); setShowAdmin(true); } else { setAlertMessage('كلمة المرور غير صحيحة'); setShowAlertModal(true); } };
  const handleResetCounter = () => setShowResetConfirm(true);
  const executeReset = async () => { 
      try {
        await fetch('/.netlify/functions/reset-statistics', { method: 'POST' });
        setDownloadHistory([]);
      } catch (error) {
          console.error("Failed to reset statistics:", error);
          setAlertMessage('فشل في إعادة تعيين الإحصائيات.');
          setShowAlertModal(true);
      }
  };

  return (
    <>
      <div className={`min-h-screen text-white flex flex-col items-center p-4 font-['Cocon_Next_Arabic'] w-full ${showAdmin ? 'overflow-y-auto' : 'overflow-y-hidden'}`}>
        <header className="w-full max-w-4xl mx-auto flex justify-between items-center p-4 z-10 relative no-print">
            <h1 className="text-2xl sm:text-4xl font-bold text-white tracking-widest">صنـــاعيــــو المستقبـــــل</h1>
            <button onClick={handleAdminClick} className="text-white hover:text-teal-400 transition-colors p-2">
                 {showAdmin ? <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                 : <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
            </button>
        </header>
        <main className="w-full flex-grow flex flex-col items-center justify-start gap-2">
           {showAdmin ? <AdminDashboard 
                history={downloadHistory} 
                onResetCounter={handleResetCounter}
                onDownloadPdfReport={handleDownloadPdfReport}
                onDownloadExcelReport={handleDownloadExcelReport}
                reportRef={reportRef}
            />
           : <>
               <Controls
                 elements={elements} selectedTemplateId={selectedTemplateId}
                 onTemplateChange={handleTemplateChange}
                 onElementChange={handleElementChange}
                 onGlobalColorChange={handleGlobalColorChange}
                 onDownloadPNG={() => handleDownload('png')}
                 onDownloadPDF={() => handleDownload('pdf')}
                 isLoading={isLoading}
               />
               <CertificatePreview
                 previewRef={previewRef}
                 templateUrl={selectedTemplate.imageUrl}
                 elements={elements}
               />
           </>}
        </main>
      </div>
      {showPasswordModal && <PasswordModal onSubmit={handlePasswordSubmit} onClose={() => setShowPasswordModal(false)} />}
      {showResetConfirm && <ConfirmationModal
            title="تأكيد إعادة التعيين"
            message="هل أنت متأكد أنك تريد إعادة تعيين عداد وسجل التحميلات إلى 0؟ لا يمكن التراجع عن هذا الإجراء."
            confirmText="نعم، أعد التعيين"
            onConfirm={executeReset}
            onClose={() => setShowResetConfirm(false)}
      />}
      {showAlertModal && <AlertModal
        message={alertMessage}
        onClose={() => setShowAlertModal(false)}
      />}
    </>
  );
};

export default App;
