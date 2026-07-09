import * as cheerio from 'cheerio';
import type { TechEvent } from '../../types';

export async function scrapeLocalEvents(): Promise<TechEvent[]> {
  try {
    // Ejemplo de web scraping para extraer eventos locales de un DOM genérico
    // En producción, se reemplazaría `html` por un `await (await fetch('URL_UNIVERSIDAD')).text()`
    
    const targetUrl = 'https://epn.edu.ec/eventos-tecnologicos-simulados';
    
    const html = `
      <div class="event-item">
        <h2 class="title">Hackathon Quito IA 2026</h2>
        <p class="desc">Competencia de 48 horas resolviendo problemas locales con Modelos de Lenguaje.</p>
        <span class="date">${new Date(Date.now() + 86400 * 1000 * 3).toISOString()}</span>
        <span class="location">Quito - EPN</span>
      </div>
      <div class="event-item">
        <h2 class="title">Congreso de Ciberseguridad EcuCERT</h2>
        <p class="desc">Análisis de vulnerabilidades web y mitigación de DDoS en infraestructura.</p>
        <span class="date">${new Date(Date.now() - 3600 * 1000).toISOString()}</span>
        <span class="location">Guayaquil</span>
      </div>
    `;
    
    const $ = cheerio.load(html);
    const events: TechEvent[] = [];

    $('.event-item').each((_, element) => {
      const title = $(element).find('.title').text().trim();
      const description = $(element).find('.desc').text().trim();
      const dateStr = $(element).find('.date').text().trim();
      const cityText = $(element).find('.location').text().trim();
      
      let city: 'Quito' | 'Guayaquil' | 'Cuenca' | 'Other' = 'Other';
      if (cityText.includes('Quito')) city = 'Quito';
      else if (cityText.includes('Guayaquil')) city = 'Guayaquil';
      else if (cityText.includes('Cuenca')) city = 'Cuenca';

      events.push({
        id: `scraped-${Date.now()}-${Math.random()}`,
        title,
        description,
        url: targetUrl,
        source: 'Scraped',
        category: title.includes('IA') ? 'AI & Data Science' : 'Cybersecurity',
        location: { city, isVirtual: false },
        date: { start: new Date(dateStr) },
        isLive: false, // Will be computed in the main service
        isFree: title.includes('Congreso') ? false : true,
        price: title.includes('Congreso') ? '$50.00' : undefined
      });
    });

    return events;
  } catch (error) {
    console.error('Error scraping local events:', error);
    return [];
  }
}
