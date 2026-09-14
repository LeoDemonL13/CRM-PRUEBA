(function () {
    'use strict';

    const waitFrame = () => new Promise(resolve => requestAnimationFrame(() => resolve()));

    function statusElement() {
        let status = document.getElementById('estado-pdf-v125');
        if (!status) {
            status = document.createElement('div');
            status.id = 'estado-pdf-v125';
            status.className = 'hidden rounded-lg border border-blue-500/20 bg-blue-950/10 px-3 py-2 text-[10px] text-blue-300';
            const preview = document.getElementById('vistaPrevia')?.parentElement;
            preview?.insertAdjacentElement('afterend', status);
        }
        return status;
    }

    function setBusy(busy, message = '') {
        const status = statusElement();
        status.classList.toggle('hidden', !busy && !message);
        status.textContent = message;
        document.querySelectorAll('button[onclick^="descargarPDF"]').forEach(button => {
            button.disabled = busy;
            button.classList.toggle('opacity-60', busy);
            button.classList.toggle('cursor-wait', busy);
        });
    }

    window.descargarPDF = async function (imprimir) {
        const list = seleccion();
        if (!list.length) return alert('Selecciona al menos un material o categoría.');
        const copies = Math.max(1, Math.min(50, Number(document.getElementById('copias').value) || 1));
        const total = list.length * copies;
        if (total > 1000) return alert('El máximo por archivo es de 1,000 etiquetas. Reduce la selección o las copias.');

        const [labelWidth, labelHeight] = document.getElementById('tamanoEtiqueta').value.split('x').map(Number);
        const { jsPDF } = window.jspdf || {};
        if (!jsPDF) return alert('No se pudo cargar el generador de PDF.');

        let printWindow = null;
        if (imprimir) {
            printWindow = window.open('', '_blank');
            if (!printWindow) return alert('El navegador bloqueó la ventana de impresión. Permite ventanas emergentes para este sitio.');
            printWindow.document.write('<p style="font-family:Arial;padding:24px">Generando etiquetas…</p>');
        }

        setBusy(true, `Preparando ${total} etiquetas…`);
        try {
            const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
            const pageWidth = 210;
            const pageHeight = 297;
            const margin = 8;
            const gap = 3;
            const columns = Math.max(1, Math.floor((pageWidth - 2 * margin + gap) / (labelWidth + gap)));
            const rows = Math.max(1, Math.floor((pageHeight - 2 * margin + gap) / (labelHeight + gap)));
            const perPage = columns * rows;
            let index = 0;

            for (const item of list) {
                for (let copy = 0; copy < copies; copy += 1) {
                    if (index > 0 && index % perPage === 0) doc.addPage();
                    const position = index % perPage;
                    const column = position % columns;
                    const row = Math.floor(position / columns);
                    const x = margin + column * (labelWidth + gap);
                    const y = margin + row * (labelHeight + gap);

                    // Resolución contenida para evitar que el navegador agote memoria al pasar de 10 etiquetas.
                    const ratio = Math.max(1.35, labelWidth / Math.max(1, labelHeight));
                    const canvasHeight = 300;
                    const canvasWidth = Math.round(canvasHeight * ratio);
                    const canvas = crearEtiquetaCanvas(item, canvasWidth, canvasHeight);
                    doc.addImage(canvas, 'PNG', x, y, labelWidth, labelHeight, undefined, 'FAST');
                    canvas.width = 1;
                    canvas.height = 1;
                    index += 1;

                    if (index % 4 === 0 || index === total) {
                        setBusy(true, `Generando etiqueta ${index} de ${total}…`);
                        await waitFrame();
                    }
                }
            }

            setBusy(true, 'Finalizando PDF…');
            await waitFrame();
            const filename = `Etiquetas_${tipoCodigo}_${new Date().toISOString().slice(0, 10)}.pdf`;
            if (imprimir) {
                const blob = doc.output('blob');
                const url = URL.createObjectURL(blob);
                printWindow.location.href = url;
                setTimeout(() => URL.revokeObjectURL(url), 120000);
            } else {
                doc.save(filename);
            }
            setBusy(false, `PDF generado correctamente: ${total} etiquetas.`);
            setTimeout(() => setBusy(false, ''), 4000);
        } catch (error) {
            if (printWindow && !printWindow.closed) printWindow.close();
            console.error(error);
            setBusy(false, '');
            alert(`No se pudo generar el PDF: ${error.message}`);
        }
    };
})();
