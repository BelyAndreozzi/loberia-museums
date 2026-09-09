import logoNaturales from './assets/logos/logo-naturales.jpg';
import logoHistoria from './assets/logos/logo-historia.jpg';

export const MUSEOS = [
    { id: 1, slug: 'ciencias-naturales', nombre: 'Ciencias Naturales', logo: logoNaturales },
    { id: 2, slug: 'historia', nombre: 'Museo Histórico', logo: logoHistoria },
] as const;

export type Museo = typeof MUSEOS[number];
export const museoPorId = (id: number) => MUSEOS.find(museo => museo.id === id);
