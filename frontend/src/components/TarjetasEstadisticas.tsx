import '../styles/TarjetasEstadisticas.scss';
import type { CSSProperties } from 'react';

type Estadisticas = {
    total: number;
    porEstado: Record<string, number>;
    ingresadasRecientemente: number;
    periodoRecientesDias: number;
};

type TarjetasEstadisticasProps = {
    estadisticas: Estadisticas;
    cargando: boolean;
};

const estados = [
    { clave: 'Excelente', etiqueta: 'Excelente', clase: 'excelente' },
    { clave: 'Bueno', etiqueta: 'Bueno', clase: 'bueno' },
    { clave: 'Regular', etiqueta: 'Regular', clase: 'regular' },
    { clave: 'Malo', etiqueta: 'Malo', clase: 'malo' },
];

const TarjetasEstadisticas = ({ estadisticas, cargando }: TarjetasEstadisticasProps) => {
    const valor = (numero: number, ancho = '3.1rem') => cargando
        ? <span className="skeleton skeleton-value" style={{ '--skeleton-width': ancho } as CSSProperties} aria-hidden="true" />
        : numero;

    return (
        <section className="estadisticas-inventario" aria-label="Resumen del inventario" aria-busy={cargando}>
            <div className="estadisticas-destacadas">
                <article className="estadistica-card estadistica-total">
                    <div className="estadistica-icono" aria-hidden="true">#</div>
                    <div>
                        <span className="estadistica-etiqueta">Patrimonio total</span>
                        <strong className="estadistica-valor">{valor(estadisticas.total)}</strong>
                        <span className="estadistica-ayuda">Piezas inventariadas</span>
                    </div>
                </article>

                <article className="estadistica-card estadistica-recientes">
                    <div className="estadistica-icono" aria-hidden="true">+</div>
                    <div>
                        <span className="estadistica-etiqueta">Ingresos recientes</span>
                        <strong className="estadistica-valor">{valor(estadisticas.ingresadasRecientemente)}</strong>
                        <span className="estadistica-ayuda">Últimos {estadisticas.periodoRecientesDias} días</span>
                    </div>
                </article>
            </div>

            <div className="estadisticas-estados">
                {estados.map((estado) => (
                    <article className={`estadistica-card estadistica-estado ${estado.clase}`} key={estado.clave}>
                        <span className="estado-punto" aria-hidden="true" />
                        <div>
                            <span className="estadistica-etiqueta">Estado {estado.etiqueta}</span>
                            <strong className="estadistica-valor">
                                {valor(estadisticas.porEstado[estado.clave] || 0, '2.4rem')}
                            </strong>
                        </div>
                    </article>
                ))}
            </div>
        </section>
    );
};

export default TarjetasEstadisticas;
