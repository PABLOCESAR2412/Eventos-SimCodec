import type { TechEvent } from '../../types';

export async function fetchDevToEvents(): Promise<TechEvent[]> {
  try {
    // API pública de Dev.to para artículos etiquetados con "event" (Usamos esto como fuente de eventos open source)
    const res = await fetch('https://dev.to/api/articles?tag=event&state=fresh&per_page=3');
    if (!res.ok) return [];
    
    const data = await res.json();
    return data.map((item: any) => ({
      id: `devto-${item.id}`,
      title: item.title,
      description: item.description || 'Evento de comunidad tech publicado en Dev.to',
      url: item.url,
      source: 'Dev.to',
      category: 'General Tech',
      location: { city: 'Virtual', isVirtual: true },
      date: { start: new Date(item.created_at) }, // Simulamos la fecha del evento con la fecha de creación
      isLive: false,
      isFree: true,
      imageUrl: item.social_image || item.cover_image
    }));
  } catch (error) {
    console.error('Error fetch Dev.to:', error);
    return [];
  }
}
