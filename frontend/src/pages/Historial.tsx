import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/useAuth';
import DashboardLayout from '../components/DashboardLayout';
import '../styles/Historial.scss';

type Accion = 'CREAR' | 'EDITAR' | 'ELIMINAR';

type Movimiento = {
    id: number;
    pieza_id: number;
    accion: Accion;
    detalles: {
        pieza?: Record<string, unknown>;
        cambios?: Record<string, { antes: unknown; despues: unknown }>;
    };
    fecha: string;
    username: string;
    pieza_existe: boolean;
    numero_inventario: string | null;
    nombre_designacion: string | null;
};

type Pagina = { registros: Movimiento[]; hayMas: boolean };

const ACCIONES: Record<Accion, string> = { CREAR: 'Alta', EDITAR: 'Edición', ELIMINAR: 'Eliminación' };

const CAMPOS: Record<string, string> = {
    numero_inventario: 'N° Inventario',
    nombre_designacion: 'Designación',
    estado_conservacion: 'Estado de conservación',
    procedencia: 'Procedencia',
    categoria: 'Categoría',
    ubicacion_museo: 'Ubicación en museo',
    ubicacion_deposito: 'Ubicación en depósito',
    estanteria: 'Estantería',
    estante: 'Estante',
    material_principal: 'Material principal',
    material_secundario: 'Material secundario',
    material_terciario: 'Material terciario',
    largo_cm: 'Largo (cm)',
    ancho_cm: 'Ancho (cm)',
    espesor_cm: 'Espesor (cm)',
    autor: 'Autor',
    forma_ingreso: 'Forma de ingreso'
};

const mostrarValor = (valor: unknown) => {
    if (valor === null || valor === undefined || valor === '') return '—';
    if (typeof valor === 'boolean') return valor ? 'Sí' : 'No';
    return String(valor);
};

const Detalle = ({ movimiento }: { movimiento: Movimiento }) => {
    const { cambios, pieza } = movimiento.detalles;

    if (cambios) {
        const campos = Object.entries(cambios);
        if (campos.length === 0) return <span className="historial-sin-cambios">Guardada sin cambios</span>;
        return (
            <ul className="historial-cambios">
                {campos.map(([campo, { antes, despues }]) => (
                    <li key={campo}>
                        <span className="historial-campo">{CAMPOS[campo] ?? campo}:</span>{' '}
                        <del>{mostrarValor(antes)}</del> → <ins>{mostrarValor(despues)}</ins>
                    </li>
                ))}
            </ul>
        );
    }

    if (!pieza) return null;
    return (
        <details className="historial-datos">
            <summary>{movimiento.accion === 'ELIMINAR' ? 'Ver datos al eliminar' : 'Ver datos cargados'}</summary>
            <dl>
                {Object.entries(pieza).map(([campo, valor]) => (
                    <div key={campo}>
                        <dt>{CAMPOS[campo] ?? campo}</dt>
                        <dd>{mostrarValor(valor)}</dd>
                    </div>
                ))}
            </dl>
        </details>
    );
};

// Se monta de nuevo (key) cada vez que cambian los filtros.
const Movimientos = ({ consulta, alElegirPieza }: { consulta: string; alElegirPieza: (id: number) => void }) => {
    const { fetchConSesion } = useAuth();
    const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
    const [hayMas, setHayMas] = useState(false);
    const [cargando, setCargando] = useState(true);
    const [cargandoMas, setCargandoMas] = useState(false);
    const [error, setError] = useState('');

    const pedir = useCallback(async (antesDe?: number): Promise<Pagina> => {
        const parametros = new URLSearchParams(consulta);
        if (antesDe) parametros.set('antes_de', String(antesDe));
        const respuesta = await fetchConSesion(`/api/piezas/auditoria?${parametros}`);
        if (!respuesta.ok) throw new Error('No se pudo cargar el historial.');
        return respuesta.json();
    }, [consulta, fetchConSesion]);

    useEffect(() => {
        let cancelado = false;
        pedir()
            .then(pagina => {
                if (cancelado) return;
                setMovimientos(pagina.registros);
                setHayMas(pagina.hayMas);
            })
            .catch(() => { if (!cancelado) setError('No se pudo cargar el historial.'); })
            .finally(() => { if (!cancelado) setCargando(false); });
        return () => { cancelado = true; };
    }, [pedir]);

    const cargarMas = async () => {
        setCargandoMas(true);
        try {
            const pagina = await pedir(movimientos[movimientos.length - 1].id);
            setMovimientos([...movimientos, ...pagina.registros]);
            setHayMas(pagina.hayMas);
        } catch {
            setError('No se pudo cargar el historial.');
        } finally {
            setCargandoMas(false);
        }
    };

    return (
        <>
            {error && <p className="historial-error" role="alert">{error}</p>}
            <div className="table-responsive">
                <table className="data-table historial-tabla">
                    <thead>
                        <tr>
                            <th>Fecha</th>
                            <th>Usuario</th>
                            <th>Acción</th>
                            <th>Pieza</th>
                            <th>Qué cambió</th>
                        </tr>
                    </thead>
                    <tbody>
                        {cargando ? Array.from({ length: 4 }, (_, fila) => (
                            <tr className="table-skeleton-row" key={`skeleton-${fila}`} aria-hidden="true">
                                {Array.from({ length: 5 }, (_, columna) => <td key={columna}><span className="skeleton table-skeleton" /></td>)}
                            </tr>
                        )) : movimientos.length === 0 ? (
                            <tr><td colSpan={5} className="mensaje-vacio">Todavía no hay movimientos registrados.</td></tr>
                        ) : movimientos.map(movimiento => (
                            <tr key={movimiento.id}>
                                <td className="historial-fecha">
                                    {new Date(movimiento.fecha).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}
                                </td>
                                <td>{movimiento.username}</td>
                                <td>
                                    <span className={`historial-accion ${movimiento.accion.toLowerCase()}`}>
                                        {ACCIONES[movimiento.accion]}
                                    </span>
                                </td>
                                <td>
                                    <button
                                        type="button"
                                        className="historial-pieza"
                                        title="Ver solo el historial de esta pieza"
                                        onClick={() => alElegirPieza(movimiento.pieza_id)}
                                    >
                                        <strong>{movimiento.numero_inventario || 's/n'}</strong> {movimiento.nombre_designacion}
                                    </button>
                                    {!movimiento.pieza_existe && <span className="historial-eliminada">eliminada</span>}
                                </td>
                                <td><Detalle movimiento={movimiento} /></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {hayMas && !cargando && (
                <button type="button" className="btn-accion historial-mas" onClick={cargarMas} disabled={cargandoMas}>
                    {cargandoMas ? 'Cargando...' : 'Cargar más'}
                </button>
            )}
        </>
    );
};

const Historial = () => {
    const { usuario } = useAuth();
    const navigate = useNavigate();
    const [parametros, setParametros] = useSearchParams();
    const piezaId = parametros.get('pieza_id');
    const accion = parametros.get('accion') ?? '';

    useEffect(() => {
        if (usuario && usuario.rol !== 'encargado' && usuario.rol !== 'admin') {
            navigate('/dashboard');
        }
    }, [usuario, navigate]);

    const cambiarFiltro = (clave: string, valor: string) => {
        const nuevos = new URLSearchParams(parametros);
        if (valor) nuevos.set(clave, valor);
        else nuevos.delete(clave);
        setParametros(nuevos);
    };

    const consulta = new URLSearchParams({
        ...(piezaId ? { pieza_id: piezaId } : {}),
        ...(accion ? { accion } : {})
    }).toString();

    return (
        <DashboardLayout titulo="Historial de cambios" museoId={usuario?.museo_id ?? 1}>
            <div className="card-header">
                <div className="top-table">
                    <h3>Altas, ediciones y eliminaciones de piezas</h3>
                </div>

                <div className="filtros-container">
                    <select className="select-filtro" value={accion} onChange={e => cambiarFiltro('accion', e.target.value)}>
                        <option value="">Todas las acciones</option>
                        <option value="CREAR">Altas</option>
                        <option value="EDITAR">Ediciones</option>
                        <option value="ELIMINAR">Eliminaciones</option>
                    </select>
                    {piezaId && (
                        <button className="btn-limpiar-filtros" onClick={() => cambiarFiltro('pieza_id', '')}>
                            Ver todas las piezas
                        </button>
                    )}
                </div>

                <Movimientos
                    key={consulta}
                    consulta={consulta}
                    alElegirPieza={id => cambiarFiltro('pieza_id', String(id))}
                />
            </div>
        </DashboardLayout>
    );
};

export default Historial;
