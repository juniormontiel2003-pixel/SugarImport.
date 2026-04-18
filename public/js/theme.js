// theme.js - Maneja la aplicación dinámica de estilos y tipografía
(function() {
    async function applyTheme() {
        try {
            const response = await fetch('/api/settings');
            if (response.ok) {
                const settings = await response.json();
                const root = document.documentElement;

                if (settings.primary_color) root.style.setProperty('--primary-color', settings.primary_color);
                if (settings.secondary_color) root.style.setProperty('--secondary-color', settings.secondary_color);
                if (settings.bg_color) root.style.setProperty('--bg-color', settings.bg_color);
                if (settings.text_color) root.style.setProperty('--text-color', settings.text_color);
                if (settings.card_bg) root.style.setProperty('--card-bg', settings.card_bg);
                
                if (settings.font_family) {
                    root.style.setProperty('--font-main', settings.font_family);
                    // Asegurarse de que la fuente esté disponible si es de Google Fonts
                    if (!document.getElementById('dynamic-font-link')) {
                        const link = document.createElement('link');
                        link.id = 'dynamic-font-link';
                        link.rel = 'stylesheet';
                        const fontName = settings.font_family.split(',')[0].replace(/'/g, '').replace(/ /g, '+');
                        link.href = `https://fonts.googleapis.com/css2?family=${fontName}:wght@300;400;500;600;700;800&display=swap`;
                        document.head.appendChild(link);
                    }
                }

                // Ajustar variables dependientes o clases específicas si es necesario
                if (settings.bg_color) {
                    // Si el fondo es oscuro, podríamos querer ajustar el contraste de ciertos elementos
                    // Pero por ahora confiamos en las variables CSS globales
                }
            }
        } catch (error) {
            console.error('Error al aplicar el tema:', error);
        }
    }

    // Ejecutar inmediatamente
    applyTheme();

    // Exportar por si se necesita re-aplicar sin recargar
    window.refreshTheme = applyTheme;
})();
