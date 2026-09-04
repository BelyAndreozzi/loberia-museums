import { useState, useEffect } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/useAuth';
import '../styles/Dashboard.scss';
import FormularioPieza from '../components/FormularioPieza';
import ModalDetalles from '../components/ModalDetalles';
import ModalConfirmacion from '../components/ModalConfirmacion';
import TarjetasEstadisticas from '../components/TarjetasEstadisticas';
import { descargarInventarioCsv } from '../utils/exportarInventario';

const estadisticasIniciales = {
    total: 0,
    porEstado: {},
    ingresadasRecientemente: 0,
    periodoRecientesDias: 30
};

const nombresInventario: Record<number, string> = {
    1: 'Ciencias Naturales',
    2: 'Historia'
};

const Dashboard = () => {
    const navigate = useNavigate();
    const { usuario, cargando: sesionCargando, logout, fetchConSesion } = useAuth();
    const [parametros] = useSearchParams();
    const museoId = Number(parametros.get('museo_id')) === 2 ? 2 : 1;
    const estaAutenticado = usuario !== null;

    const [piezas, setPiezas] = useState([]);
    const [estadisticas, setEstadisticas] = useState(estadisticasIniciales);
    const [cargandoEstadisticas, setCargandoEstadisticas] = useState(true);

    const [mostrandoFormulario, setMostrandoFormulario] = useState(false);
    const [piezaAEditar, setPiezaAEditar] = useState<any>(null);

    const [piezaSeleccionada, setPiezaSeleccionada] = useState<any>(null);

    const [piezaAEliminar, setPiezaAEliminar] = useState<any>(null);
    const [idsSeleccionados, setIdsSeleccionados] = useState<number[]>([]);
    const [modalMasivoAbierto, setModalMasivoAbierto] = useState(false);

    const [filtros, setFiltros] = useState({
        busqueda: '',
        estado_conservacion: '',
        categoria: ''
    });

    const [menuAbierto, setMenuAbierto] = useState(false);
    const [sidebarAbierta, setSidebarAbierta] = useState(false);

    const cerrarSesion = async (evento: ReactMouseEvent<HTMLAnchorElement>) => {
        evento.preventDefault();
        await logout();
        navigate('/');
    };

    useEffect(() => {
        const manejarClicAfuera = (evento: MouseEvent) => {
            const contenedor = document.getElementById('contenedor-perfil-usuario');
            if (menuAbierto && contenedor && !contenedor.contains(evento.target as Node)) {
                setMenuAbierto(false);
            }
        };
        document.addEventListener('mousedown', manejarClicAfuera);
        return () => {
            document.removeEventListener('mousedown', manejarClicAfuera);
        };
    }, [menuAbierto]);

    const cargarDatos = async () => {
        try {
            const params = new URLSearchParams({
                museo_id: museoId.toString(),
            });

            if (filtros.busqueda) params.append('busqueda', filtros.busqueda);
            if (filtros.estado_conservacion) params.append('estado_conservacion', filtros.estado_conservacion);
            if (filtros.categoria && museoId === 1) params.append('categoria', filtros.categoria);

            const respuesta = await fetchConSesion(`/api/piezas?${params.toString()}`);
            if (respuesta.ok) {
                const datos = await respuesta.json();
                setPiezas(datos);
            }
        } catch (error) {
            console.error('Error al cargar piezas:', error);
        }
    };

    const cargarEstadisticas = async () => {
        setCargandoEstadisticas(true);

        try {
            const respuesta = await fetchConSesion(
                `/api/piezas/estadisticas?museo_id=${museoId}`
            );

            if (respuesta.ok) {
                setEstadisticas(await respuesta.json());
            }
        } catch (error) {
            console.error('Error al cargar estadísticas:', error);
        } finally {
            setCargandoEstadisticas(false);
        }
    };

    const solicitarEliminacion = (piezaOId: any) => {
        const piezaEncontrada = typeof piezaOId === 'object'
            ? piezaOId
            : piezas.find((p: any) => p.id === piezaOId);

        setPiezaAEliminar(piezaEncontrada);
    };

    const confirmarEliminacion = async () => {
        if (!piezaAEliminar) return;

        try {
            const respuesta = await fetchConSesion(`/api/piezas/${piezaAEliminar.id}`, {
                method: 'DELETE',
            });

            if (respuesta.ok) {
                setPiezaAEliminar(null);
                cargarDatos();
                cargarEstadisticas();
            } else if (respuesta.status === 401 || respuesta.status === 403) {
                alert('No tienes permisos o tu sesión expiró. Inicia sesión nuevamente.');
            } else {
                alert('No se pudo eliminar la pieza. Intenta nuevamente.');
            }
        } catch (error) {
            console.error('Error de red:', error);
        }
    };

    const toggleSeleccion = (id: number) => {
        if (idsSeleccionados.includes(id)) {
            setIdsSeleccionados(idsSeleccionados.filter(itemId => itemId !== id));
        } else {
            setIdsSeleccionados([...idsSeleccionados, id]);
        }
    };

    const toggleSeleccionarTodo = () => {
        if (idsSeleccionados.length === piezas.length) {
            setIdsSeleccionados([]);
        } else {
            setIdsSeleccionados(piezas.map((p: any) => p.id));
        }
    };

    const confirmarBorradoMasivo = async () => {
        try {
            const respuesta = await fetchConSesion(`/api/piezas`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: idsSeleccionados })
            });

            if (respuesta.ok) {
                setIdsSeleccionados([]);
                setModalMasivoAbierto(false);
                cargarDatos();
                cargarEstadisticas();
            } else if (respuesta.status === 401 || respuesta.status === 403) {
                alert('No tienes permisos o tu sesión expiró. Inicia sesión nuevamente.');
            } else {
                alert('No se pudieron eliminar las piezas seleccionadas. Intenta nuevamente.');
            }
        } catch (error) {
            console.error('Error de red:', error);
        }
    };

    const iniciarEdicion = (pieza: any) => {
        setPiezaAEditar(pieza);
        setMostrandoFormulario(true);
        setPiezaSeleccionada(null);
    };

    useEffect(() => {
        cargarDatos();
    }, [filtros, museoId]);

    useEffect(() => {
        cargarEstadisticas();
    }, [museoId]);

    if (sesionCargando) {
        return <div className="dashboard-loading">Cargando sesión...</div>;
    }

    const usuarioParaFormulario = usuario
        ? { id: usuario.id, nombre: usuario.username, rol: usuario.rol, museo_id: museoId }
        : { id: null, nombre: 'Visitante', rol: 'Consulta pública', museo_id: museoId };

    return (
        <div className="dashboard-container">
            <button
                className={`sidebar-overlay ${sidebarAbierta ? 'visible' : ''}`}
                type="button"
                aria-label="Cerrar menú"
                onClick={() => setSidebarAbierta(false)}
            />

            <aside className={`sidebar ${sidebarAbierta ? 'abierta' : ''}`}>
                <div className="sidebar-header">
                    <h2>Museos Lobería</h2>
                </div>
                <div className="sidebar-context">
                    <span>Inventario actual</span>
                    <strong>{nombresInventario[museoId]}</strong>
                </div>
                <nav className="sidebar-nav">
                    <ul>
                        <li className={!mostrandoFormulario ? "active" : ""}>
                            <button onClick={() => { setMostrandoFormulario(false); setSidebarAbierta(false); }}>Mi Inventario</button>
                        </li>
                        {estaAutenticado && (
                            <li className={mostrandoFormulario ? "active" : ""}>
                                <button onClick={() => { setPiezaAEditar(null); setMostrandoFormulario(true); setSidebarAbierta(false); }}>Cargar Pieza</button>
                            </li>
                        )}
                        {estaAutenticado && (usuario?.rol === 'encargado' || usuario?.rol === 'admin') && (
                            <li>
                                <Link to="/admin" onClick={() => setSidebarAbierta(false)}>
                                    Gestión de Usuarios
                                </Link>
                            </li>
                        )}
                        {estaAutenticado && (
                            <li>
                                <Link to="/" onClick={evento => { setSidebarAbierta(false); cerrarSesion(evento); }}>
                                    Cerrar Sesión
                                </Link>
                            </li>
                        )}
                    </ul>
                </nav>
            </aside>

            <main className="main-content">
                <header className="top-header">
                    <button
                        className="menu-toggle"
                        type="button"
                        aria-label={sidebarAbierta ? 'Cerrar menú' : 'Abrir menú'}
                        aria-expanded={sidebarAbierta}
                        onClick={() => setSidebarAbierta(!sidebarAbierta)}
                    >
                        <span />
                        <span />
                        <span />
                    </button>
                    <div className="header-title">
                        <h1>
                            Inventario de {nombresInventario[museoId]}
                        </h1>
                    </div>

                    <div className="user-profile-container" id="contenedor-perfil-usuario">
                        <div
                            className="user-profile"
                            onClick={() => setMenuAbierto(!menuAbierto)}
                            style={{ cursor: 'pointer' }}
                        >
                            <div className="avatar">{usuario?.username?.charAt(0) ?? 'V'}</div>
                            <div className="user-info">
                                <span className="user-name">Hola, {usuario?.username ?? 'Visitante'}</span>
                                <span className="user-role">{usuario?.rol ?? 'Consulta pública'}</span>
                            </div>
                        </div>

                        {menuAbierto && (
                            <div className="user-dropdown-menu">
                                {estaAutenticado ? (
                                    <Link to="/" className="dropdown-item salir" onClick={cerrarSesion}>
                                        Cerrar Sesión
                                    </Link>
                                ) : (
                                    <Link to="/login" className="dropdown-item">
                                        Iniciar sesión
                                    </Link>
                                )}
                            </div>
                        )}
                    </div>

                </header>

                <section className="content-area">
                    {mostrandoFormulario ? (
                        <FormularioPieza
                            usuario={usuarioParaFormulario}
                            piezaAEditar={piezaAEditar}
                            alGuardar={() => {
                                setMostrandoFormulario(false);
                                setPiezaAEditar(null);
                                cargarDatos();
                                cargarEstadisticas();
                            }}
                        />
                    ) : (
                        <div className="card-header">
                            <div className="top-table">
                                <h3>Últimas piezas registradas</h3>
                                <div className="acciones-header">
                                    <button
                                        className="btn-descargar"
                                        type="button"
                                        onClick={() => descargarInventarioCsv(
                                            piezas,
                                            nombresInventario[museoId],
                                            museoId
                                        )}
                                        disabled={piezas.length === 0}
                                        title="Descargar el inventario filtrado en CSV"
                                    >
                                        <span aria-hidden="true">⇩</span>
                                        Descargar Inventario
                                    </button>
                                    {estaAutenticado && idsSeleccionados.length > 0 && (
                                        <button
                                            className="btn-peligro-masivo"
                                            onClick={() => setModalMasivoAbierto(true)}
                                            style={{
                                                backgroundColor: '#d32f2f',
                                                color: '#fff',
                                                border: 'none',
                                                padding: '10px 15px',
                                                borderRadius: '5px',
                                                cursor: 'pointer',
                                                fontWeight: 500,
                                                fontSize: '0.9rem'
                                            }}
                                        >
                                            Eliminar seleccionados ({idsSeleccionados.length})
                                        </button>
                                    )}
                                    {estaAutenticado && (
                                        <button className="btn-agregar" onClick={() => { setPiezaAEditar(null); setMostrandoFormulario(true); }}>
                                            Nueva Pieza
                                        </button>
                                    )}
                                </div>
                            </div>

                            <TarjetasEstadisticas
                                estadisticas={estadisticas}
                                cargando={cargandoEstadisticas}
                            />

                            <div className="filtros-container">
                                <input
                                    type="text"
                                    className="input-busqueda"
                                    placeholder="🔍 Buscar por palabra clave, N° inventario o procedencia..."
                                    value={filtros.busqueda}
                                    onChange={(e) => setFiltros({ ...filtros, busqueda: e.target.value })}
                                />

                                <select
                                    className="select-filtro"
                                    value={filtros.estado_conservacion}
                                    onChange={(e) => setFiltros({ ...filtros, estado_conservacion: e.target.value })}
                                >
                                    <option value="">Todos los estados</option>
                                    <option value="Excelente">Excelente</option>
                                    <option value="Bueno">Bueno</option>
                                    <option value="Regular">Regular</option>
                                    <option value="Malo">Malo</option>
                                </select>

                                {museoId === 1 && (
                                    <select
                                        className="select-filtro"
                                        value={filtros.categoria}
                                        onChange={(e) => setFiltros({ ...filtros, categoria: e.target.value })}
                                    >
                                        <option value="">Todas las categorías</option>
                                        <option value="Paleontología">Paleontología</option>
                                        <option value="Geología">Geología</option>
                                        <option value="Zoología">Zoología</option>
                                        <option value="Botánica">Botánica</option>
                                    </select>
                                )}

                                {(filtros.busqueda || filtros.estado_conservacion || filtros.categoria) && (
                                    <button
                                        className="btn-limpiar-filtros"
                                        onClick={() => setFiltros({ busqueda: '', estado_conservacion: '', categoria: '' })}
                                    >
                                        Limpiar
                                    </button>
                                )}
                            </div>


                            <div className="table-responsive">
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            {estaAutenticado && (
                                                <th style={{ width: '45px', textAlign: 'center' }}>
                                                    <input
                                                        type="checkbox"
                                                        onChange={toggleSeleccionarTodo}
                                                        checked={piezas.length > 0 && idsSeleccionados.length === piezas.length}
                                                    />
                                                </th>
                                            )}
                                            <th>Museo</th>
                                            <th>N° Inventario</th>
                                            <th>Designación / Nombre</th>
                                            <th>Estado</th>
                                            <th>Procedencia</th>
                                            <th style={{ textAlign: 'center' }}>Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {piezas.length === 0 ? (
                                            <tr>
                                                <td colSpan={estaAutenticado ? 7 : 6} className="mensaje-vacio">
                                                    Completemos el patrimonio; ¡agregá una pieza!
                                                </td>
                                            </tr>
                                        ) : (
                                            piezas.map((pieza: any) => (
                                                <tr key={pieza.id}>
                                                    {estaAutenticado && (
                                                        <td style={{ textAlign: 'center' }}>
                                                            <input
                                                                type="checkbox"
                                                                checked={idsSeleccionados.includes(pieza.id)}
                                                                onChange={() => toggleSeleccion(pieza.id)}
                                                            />
                                                        </td>
                                                    )}
                                                    <td>
                                                        <span className={`badge-museo ${pieza.museo_id === 1 ? 'naturales' : 'historia'}`}>
                                                            {pieza.nombre_museo}
                                                        </span>
                                                    </td>
                                                    <td><strong>{pieza.numero_inventario}</strong></td>
                                                    <td>{pieza.nombre_designacion}</td>
                                                    <td>{pieza.estado_conservacion}</td>
                                                    <td>{pieza.procedencia}</td>
                                                    <td style={{ textAlign: 'center' }}>
                                                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', alignItems: 'center' }}>
                                                            <button className="btn-accion" onClick={() => setPiezaSeleccionada(pieza)}>
                                                                Ver Detalles
                                                            </button>
                                                            {estaAutenticado && (
                                                                <>
                                                                    <button className="btn-accion btn-editar" onClick={() => iniciarEdicion(pieza)} title="Editar">
                                                                        ✏️
                                                                    </button>
                                                                    <button className="btn-accion btn-eliminar" onClick={() => solicitarEliminacion(pieza)} title="Eliminar">
                                                                        🗑️
                                                                    </button>
                                                                </>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </section>
            </main>
            <ModalDetalles
                pieza={piezaSeleccionada}
                alCerrar={() => setPiezaSeleccionada(null)}
                alEliminar={(piezaBorrar) => solicitarEliminacion(piezaBorrar)}
                alEditar={(piezaEditar) => iniciarEdicion(piezaEditar)}
            />
            <ModalConfirmacion
                isOpen={Boolean(piezaAEliminar)}
                titulo="Confirmar eliminación"
                mensaje={`¿Estás segura de que querés eliminar la pieza "${piezaAEliminar?.nombre_designacion}" (N° ${piezaAEliminar?.numero_inventario})?`}
                onConfirmar={confirmarEliminacion}
                onCancelar={() => setPiezaAEliminar(null)}
            />
            <ModalConfirmacion
                isOpen={modalMasivoAbierto}
                titulo="Eliminación masiva"
                mensaje={`¿Estás segura de que querés eliminar las ${idsSeleccionados.length} piezas seleccionadas del inventario?`}
                onConfirmar={confirmarBorradoMasivo}
                onCancelar={() => setModalMasivoAbierto(false)}
            />

        </div>

    );
};

export default Dashboard;
