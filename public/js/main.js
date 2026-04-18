// main.js - Lógica principal del lado del cliente para clientes públicos

let globalWhatsApp = '584246665883';

document.addEventListener('DOMContentLoaded', () => {
    loadSettings();
    loadProducts();

    const contactForm = document.getElementById('contactForm');
    if (contactForm) {
        contactForm.addEventListener('submit', (e) => {
            e.preventDefault();
            alert('¡Gracias! Hemos recibido tu mensaje y nos pondremos en contacto contigo pronto.');
            contactForm.reset();
        });
    }
});

async function loadSettings() {
    try {
        const response = await fetch('/api/settings');
        if (response.ok) {
            const settings = await response.json();
            
            if (settings.footer_text) document.getElementById('dynamic-footer-text').innerHTML = settings.footer_text;
            
            if (settings.contact_email) {
                const emailContainer = document.getElementById('contact-email-container');
                const emailAnchor = document.getElementById('dynamic-contact-email');
                if (emailContainer && emailAnchor) {
                    emailContainer.style.display = 'block';
                    emailAnchor.href = `mailto:${settings.contact_email}`;
                    emailAnchor.innerText = settings.contact_email;
                }
            }
            if (settings.hero_title) document.getElementById('dynamic-hero-title').innerText = settings.hero_title;
            if (settings.hero_subtitle) document.getElementById('dynamic-hero-subtitle').innerText = settings.hero_subtitle;
            if (settings.about_text) document.getElementById('dynamic-about-text').innerHTML = settings.about_text;
            if (settings.hero_image_url) {
                const heroSection = document.querySelector('.hero');
                if (heroSection) {
                    heroSection.style.backgroundImage = `radial-gradient(circle at 50% 50%, rgba(11, 15, 25, 0.5) 0%, var(--bg-color) 100%), url('${settings.hero_image_url}')`;
                    heroSection.style.backgroundSize = 'cover';
                    heroSection.style.backgroundPosition = 'center';
                }
            }
            if (settings.whatsapp_number) {
                globalWhatsApp = settings.whatsapp_number;
                const waBtn = document.querySelector('.whatsapp-float');
                if (waBtn) waBtn.href = `https://wa.me/${globalWhatsApp}`;
            }
        }
    } catch (error) {
        console.error('Error cargando configuraciones:', error);
    }
}

async function loadProducts() {
    const productsContainer = document.getElementById('products-grid');
    if (!productsContainer) return;

    try {
        const response = await fetch('/api/products');
        if (!response.ok) throw new Error('Error al obtener productos');
        
        const products = await response.json();
        renderProducts(products, productsContainer);
    } catch (error) {
        console.error('Error:', error);
        productsContainer.innerHTML = '<p>Error al cargar el catálogo de dispositivos. Por favor, intenta más tarde.</p>';
    }
}

function renderProducts(products, container) {
    if (products.length === 0) {
        container.innerHTML = '<p>No hay productos disponibles en este momento.</p>';
        return;
    }

    container.innerHTML = '';
    products.forEach(product => {
        const fallbackImg = 'https://via.placeholder.com/250x300.png?text=Sin+Imagen';
        const imgUrl = product.image_url || fallbackImg;

        const card = document.createElement('div');
        card.className = 'product-card glass';
        card.innerHTML = `
            <img src="${imgUrl}" alt="${product.name}" class="product-image" onerror="this.src='${fallbackImg}'">
            <div class="product-info">
                <div class="brand">${product.brand}</div>
                <h3>${product.name}</h3>
                <div class="price">$${parseFloat(product.price).toFixed(2)}</div>
               <a href="https://wa.me/${globalWhatsApp}?text=Hola,%20me%20interesa%20comprar%20el%20dispositivo:%20${encodeURIComponent(product.name)}" target="_blank" style="text-decoration: none;">
                    <button class="buy-btn">Consultar / Comprar</button>
               </a>
            </div>
        `;
        container.appendChild(card);
    });
}
