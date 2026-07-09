import type { TechEvent } from '../../types';
import * as cheerio from 'cheerio';

export async function scrapeEventbriteOnline(): Promise<TechEvent[]> {
  try {
    const response = await fetch('https://www.eventbrite.com/d/online/science-and-tech--events/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch Eventbrite: ${response.statusText}`);
    }

    const html = await response.text();
    
    // Extract JSON-LD or internal __SERVER_DATA__
    const regex = /window\.__SERVER_DATA__ = ({.*?});/s;
    const match = regex.exec(html);

    if (!match || match.length < 2) {
      return [];
    }

    const data = JSON.parse(match[1]);
    const events: TechEvent[] = [];

    if (data.jsonld && data.jsonld.length > 0) {
      const itemList = data.jsonld[0]?.itemListElement || [];
      
      for (const el of itemList) {
        if (!el.item) continue;
        const item = el.item;
        
        const title = item.name || '';
        if (!title) continue;

        // Determine Category (rough guess for generic tech events)
        let category = 'AI & Data Science'; // Default
        const titleLower = title.toLowerCase();
        if (titleLower.includes('web') || titleLower.includes('react') || titleLower.includes('frontend')) category = 'Web Development';
        if (titleLower.includes('cloud') || titleLower.includes('aws') || titleLower.includes('devops')) category = 'Cloud & DevOps';
        if (titleLower.includes('security') || titleLower.includes('cyber')) category = 'Cybersecurity';
        if (titleLower.includes('startup') || titleLower.includes('business')) category = 'Entrepreneurship';

        // Check if free
        const isFree = item.offers && item.offers.price === 0 || item.description?.toLowerCase().includes('free');

        events.push({
          id: `eb-${Buffer.from(item.url || '').toString('base64').substring(0, 10)}`,
          title: title,
          description: item.description?.substring(0, 120) + '...' || 'Evento de tecnología global online.',
          url: item.url,
          source: 'Eventbrite',
          category: category,
          location: { city: 'Virtual', isVirtual: true },
          date: { start: new Date(item.startDate) },
          isLive: false,
          isFree: isFree,
          price: isFree ? undefined : 'Consultar',
          imageUrl: item.image || 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800&q=80'
        });

        // Limit to 6 global events to not clutter
        if (events.length >= 6) break;
      }
    }

    return events;
  } catch (error) {
    console.error('Error scraping Eventbrite:', error);
    return [];
  }
}
