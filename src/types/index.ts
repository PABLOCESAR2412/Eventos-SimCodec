export type EventSource = 'Meetup' | 'Eventbrite' | 'GitHub' | 'lu.ma' | 'Dev.to' | 'Scraped';
export type TechCategory = 'Web Development' | 'AI & Data Science' | 'Cybersecurity' | 'Cloud & DevOps' | 'Design & UX' | 'General Tech' | 'Entrepreneurship' | 'Education';

export interface EventLocation {
  city: 'Quito' | 'Guayaquil' | 'Cuenca' | 'Other' | 'Virtual';
  address?: string;
  isVirtual: boolean;
}

export interface EventDate {
  start: Date;
  end?: Date;
}

export interface TechEvent {
  id: string;
  title: string;
  description: string;
  url: string;
  source: EventSource;
  category: TechCategory;
  location: EventLocation;
  date: EventDate;
  imageUrl?: string;
  isLive: boolean; // Computed dynamically
  isFree: boolean;
  price?: string;
}
