import type { TechEvent } from '../types';
import { fetchDevToEvents } from './api/devto';
import { scrapeLocalEvents } from './api/scraper';
import { scrapeEventbriteOnline } from './api/eventbrite';

interface CacheItem {
  data: TechEvent[];
  timestamp: number;
}

// In-memory cache to prevent rate-limiting from Dev.to or scraping bans
const cache = new Map<string, CacheItem>();
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

export async function fetchEvents(lang: 'es' | 'en' = 'es'): Promise<TechEvent[]> {
  const cacheKey = `events_${lang}`;
  const cached = cache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
    return cached.data;
  }

  let allEvents: TechEvent[] = [];

  try {
    // Promise.allSettled permite que si una fuente falla, las demás sigan funcionando
    const results = await Promise.allSettled([
      fetchDevToEvents(),
      scrapeLocalEvents(),
      scrapeEventbriteOnline()
    ]);

    results.forEach(result => {
      if (result.status === 'fulfilled') {
        allEvents = [...allEvents, ...result.value];
      }
    });
  } catch (error) {
    console.error('Error in fetchEvents aggregator:', error);
  }

  const now = new Date();
  const processedEvents = allEvents.map(event => {
    const durationOffset = 2 * 3600 * 1000; // Asumimos 2 horas de duración si no hay end date
    const endTime = event.date.end ? event.date.end.getTime() : event.date.start.getTime() + durationOffset;
    
    const isLive = event.date.start.getTime() <= now.getTime() && endTime >= now.getTime();
    
    return { ...event, isLive };
  }).sort((a, b) => a.date.start.getTime() - b.date.start.getTime()); // Ordenamos por fecha

  cache.set(cacheKey, {
    data: processedEvents,
    timestamp: Date.now()
  });

  return processedEvents;
}
