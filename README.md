# 🚀 Eventos SimCodec - Plataforma B2B de Eventos Tech

Bienvenido al repositorio oficial de **Eventos SimCodec**, una plataforma centralizada y en tiempo real diseñada para descubrir meetups, hackathons y conferencias de tecnología tanto en Ecuador como a nivel global.

## ✨ Características Principales

*   **⚡ Arquitectura Moderna y Veloz:** Construido con **Astro** para un rendimiento inigualable, generando HTML estático ultraligero y enviando JavaScript únicamente cuando es estrictamente necesario (Island Architecture).
*   **🎨 Diseño Premium y Tematización:** Estilizado utilizando **Tailwind CSS v4** con una paleta de colores exclusiva B2B y modo oscuro/claro nativo. Incorpora transiciones de componentes quirúrgicas (evitando el stuttering de comodines globales) para una fluidez sedosa a 60 FPS.
*   **🤖 Motor de Data Mining Integrado:** Utiliza **Convex Serverless** para ejecutar Cron Jobs automáticos que rastrean y extraen eventos tecnológicos cada 6 horas desde 11 endpoints diferentes (Dev.to, Eventbrite, Devpost, Meetup, y APIS de Universidades como EPN, ESPOL, UCE).
*   **🔍 Búsqueda Dinámica y Filtros:** Implementación de un motor de búsqueda del lado del cliente (`client-side`) ultra rápido que permite buscar en tiempo real mediante atributos de datos (`data-search`) sin recargar la página.
*   **🌍 Internacionalización (i18n):** Soporte nativo para múltiples idiomas (Español / Inglés) de todo el contenido e interfaz.
*   **📈 SEO y Rich Snippets:** Generación automática de OpenGraph, Twitter Cards y marcado `JSON-LD Schema.org` (tipo *Event* y *WebSite*) para indexación premium en los motores de búsqueda de Google.
*   **🏂 Experiencia de Navegación:** Implementación de *Smooth Scrolling* avanzado (Lenis) y compatibilidad lista para animaciones complejas (GSAP), cuidando hasta el mínimo detalle como las cajas de desbordamiento administradas con `data-lenis-prevent`.
*   **📊 Panel de Control (Admin Dashboard):** Un dashboard administrativo privado para monitorear telemetría en tiempo real: frecuencias de scraping, estado de enlaces (Link Rotting detection) y cuotas de API.

## 🛠️ Tecnologías Utilizadas

*   **Framework Frontend:** Astro v7
*   **Estilos:** Tailwind CSS v4
*   **Backend & Serverless:** Convex (Funciones y Cron Jobs)
*   **Animación & Scroll:** GSAP + Lenis
*   **Tipografía:** Inter + JetBrains Mono (Google Fonts)

## 🚀 Instalación y Desarrollo Local

1.  Clona este repositorio:
    ```bash
    git clone https://github.com/PABLOCESAR2412/Eventos-SimCodec.git
    cd Eventos-SimCodec
    ```

2.  Instala las dependencias:
    ```bash
    npm install
    ```

3.  Levanta el entorno de base de datos (Convex) en una terminal:
    ```bash
    npx convex dev
    ```

4.  Levanta el servidor de desarrollo de Astro en otra terminal (se ejecutará en el puerto 4321):
    ```bash
    npm run dev
    # O en modo background (solo Astro)
    npx astro dev --background
    ```

5.  Visita la aplicación en [http://localhost:4321](http://localhost:4321)

## 📁 Estructura del Proyecto

```text
/
├── convex/                   # Lógica del Backend (Acciones, Consultas, Cron Jobs)
│   ├── actions.ts            # Scripts de Data Mining y Web Scraping
│   ├── crons.ts              # Configuración de tareas programadas
│   ├── events.ts             # Mutaciones y Consultas de la base de datos
│   └── schema.ts             # Esquema relacional
├── src/
│   ├── components/           # Componentes UI (EventCard, Sidebar, LanguagePicker)
│   ├── layouts/              # Layout principal con configuración SEO y Lenis
│   ├── pages/                # Rutas de Astro (index.astro, admin.astro)
│   ├── styles/               # CSS Global (Tailwind y custom properties)
│   └── i18n/                 # Diccionarios de Internacionalización
└── package.json
```

## 👨‍💻 Autor

Desarrollado para **SimCodec**. Diseñado para impulsar las comunidades tecnológicas conectando desarrolladores, emprendedores y entusiastas.
