import '../styles/TarjetasEstadisticas.scss';

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
    const mostrarValor = (valor: number) => cargando ? '--' : valor;

    return (
        <section className="estadisticas-inventario" aria-label="Resumen del inventario">
            <div className="estadisticas-destacadas">
                <article className="estadistica-card estadistica-total">
                    <div className="estadistica-icono" aria-hidden="true">#</div>
                    <div>
                        <span className="estadistica-etiqueta">Patrimonio total</span>
                        <strong className="estadistica-valor">{mostrarValor(estadisticas.total)}</strong>
                        <span className="estadistica-ayuda">Piezas inventariadas</span>
                    </div>
                </article>

                <article className="estadistica-card estadistica-recientes">
                    <div className="estadistica-icono" aria-hidden="true">+</div>
                    <div>
                        <span className="estadistica-etiqueta">Ingresos recientes</span>
                        <strong className="estadistica-valor">{mostrarValor(estadisticas.ingresadasRecientemente)}</strong>
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
                                {mostrarValor(estadisticas.porEstado[estado.clave] || 0)}
                            </strong>
                        </div>
                    </article>
                ))}
            </div>
        </section>
    );
};

export default TarjetasEstadisticas;
