import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import '../styles/Dashboard.scss';
import FormularioPieza from '../components/FormularioPieza';
import ModalDetalles from '../components/ModalDetalles';
import ModalConfirmacion from '../components/ModalConfirmacion';

const Dashboard = () => {
    // Simulamos un usuario logueado (en un caso real, esto vendría del backend)
    const [usuario] = useState({
        nombre: 'Belén',
        rol: 'Administradora',
        museo_id: 1
    });

    const [piezas, setPiezas] = useState([]);
    const [cargando, setCargando] = useState(true);

    const [mostrandoFormulario, setMostrandoFormulario] = useState(false);
    const [piezaAEditar, setPiezaAEditar] = useState<any>(null);

    // Estado para controlar qué pieza se está viendo en el modal (null si está cerrado)
    const [piezaSeleccionada, setPiezaSeleccionada] = useState<any>(null);

    // Guarda la pieza que el usuario quiere borrar (null si no hay ninguna en proceso de borrado)
    const [piezaAEliminar, setPiezaAEliminar] = useState<any>(null);
    // Array para guardar los IDs de las piezas tildadas
    const [idsSeleccionados, setIdsSeleccionados] = useState<number[]>([]);
    // Estado para controlar el modal de confirmación masiva
    const [modalMasivoAbierto, setModalMasivoAbierto] = useState(false);

    const [filtros, setFiltros] = useState({
        busqueda: '',
        estado_conservacion: '',
        categoria: ''
    });

    const [menuAbierto, setMenuAbierto] = useState(false);
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
                museo_id: usuario.museo_id.toString(),
            });

            if (filtros.busqueda) params.append('busqueda', filtros.busqueda);
            if (filtros.estado_conservacion) params.append('estado_conservacion', filtros.estado_conservacion);
            if (filtros.categoria && usuario.museo_id === 1) params.append('categoria', filtros.categoria);

            const respuesta = await fetch(`http://localhost:3000/api/piezas?${params.toString()}`);
            if (respuesta.ok) {
                const datos = await respuesta.json();
                setPiezas(datos);
            }
        } catch (error) {
            console.error('Error al cargar piezas:', error);
        }
    };

    // Paso 1: El usuario hace clic en eliminar y abrimos el modal de advertencia
    const solicitarEliminacion = (piezaOId: any) => {
        const piezaEncontrada = typeof piezaOId === 'object'
            ? piezaOId
            : piezas.find((p: any) => p.id === piezaOId);

        setPiezaAEliminar(piezaEncontrada);
    };

    // Paso 2: El usuario confirma en el modal y disparamos el DELETE al backend
    const confirmarEliminacion = async () => {
        if (!piezaAEliminar) return;

        try {
            const respuesta = await fetch(`http://localhost:3000/api/piezas/${piezaAEliminar.id}`, {
                method: 'DELETE',
            });

            if (respuesta.ok) {
                setPiezaAEliminar(null);
                cargarDatos();
            } else {
                alert('Hubo un error al intentar eliminar la pieza.');
            }
        } catch (error) {
            console.error('Error de red:', error);
        }
    };

    // Funciones para manejar la selección de piezas en la tabla
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
            const respuesta = await fetch('http://localhost:3000/api/piezas', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: idsSeleccionados })
            });

            if (respuesta.ok) {
                setIdsSeleccionados([]);
                setModalMasivoAbierto(false);
                cargarDatos();
            } else {
                alert('Hubo un error al intentar eliminar las piezas seleccionadas.');
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
    }, [filtros]);

    return (
        <div className="dashboard-container">
            <aside className="sidebar">
                <div className="sidebar-header">
                    <h2>Museos Lobería</h2>
                </div>
                <nav className="sidebar-nav">
                    <ul>
                        <li className={!mostrandoFormulario ? "active" : ""}>
                            <button onClick={() => setMostrandoFormulario(false)}>Mi Inventario</button>
                        </li>
                        <li className={mostrandoFormulario ? "active" : ""}>
                            <button onClick={() => { setPiezaAEditar(null); setMostrandoFormulario(true); }}>Cargar Pieza</button>
                        </li>
                        <li><Link to="/">Cerrar Sesión</Link></li>
                    </ul>
                </nav>
            </aside>

            <main className="main-content">
                <header className="top-header">
                    <div className="header-title">
                        <h1>
                            Inventario - {usuario.museo_id === 1 ? 'Museo de Ciencias Naturales' : 'Museo Histórico'}
                        </h1>
                    </div>

                    <div className="user-profile-container" id="contenedor-perfil-usuario">
                        <div
                            className="user-profile"
                            onClick={() => setMenuAbierto(!menuAbierto)}
                            style={{ cursor: 'pointer' }}
                        >
                            <div className="avatar">{usuario.nombre.charAt(0)}</div>
                            <div className="user-info">
                                <span className="user-name">Hola, {usuario.nombre}</span>
                                <span className="user-role">{usuario.rol}</span>
                            </div>
                        </div>

                        {menuAbierto && (
                            <div className="user-dropdown-menu">
                                <Link to="/" className="dropdown-item salir">
                                    Cerrar Sesión
                                </Link>
                            </div>
                        )}
                    </div>
                </header>

                <section className="content-area">
                    {mostrandoFormulario ? (
                        <FormularioPieza
                            usuario={usuario}
                            piezaAEditar={piezaAEditar}
                            alGuardar={() => {
                                setMostrandoFormulario(false);
                                setPiezaAEditar(null);
                                cargarDatos();
                            }}
                        />
                    ) : (
                        <div className="card-header">
                            <div className="top-table">
                                <h3>Últimas piezas registradas</h3>
                                <div className="acciones-header">
                                    {idsSeleccionados.length > 0 && (
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
                                    <button className="btn-agregar" onClick={() => { setPiezaAEditar(null); setMostrandoFormulario(true); }}>
                                        Nueva Pieza
                                    </button>
                                </div>
                            </div>

                            {/* Barra de Búsqueda y Filtros */}
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

                                {/* Renderizado condicional del filtro de categorías */}
                                {usuario.museo_id === 1 && (
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

                                {/* Botón para limpiar rápidamente si hay filtros activos */}
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
                                            <th style={{ width: '45px', textAlign: 'center' }}>
                                                <input
                                                    type="checkbox"
                                                    onChange={toggleSeleccionarTodo}
                                                    checked={piezas.length > 0 && idsSeleccionados.length === piezas.length}
                                                />
                                            </th>
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
                                                <td colSpan={7} className="mensaje-vacio">
                                                    Completemos el patrimonio; ¡agregá una pieza!
                                                </td>
                                            </tr>
                                        ) : (
                                            piezas.map((pieza: any) => (
                                                <tr key={pieza.id}>
                                                    <td style={{ textAlign: 'center' }}>
                                                        <input
                                                            type="checkbox"
                                                            checked={idsSeleccionados.includes(pieza.id)}
                                                            onChange={() => toggleSeleccion(pieza.id)}
                                                        />
                                                    </td>
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
                                                            <button className="btn-accion btn-editar" onClick={() => iniciarEdicion(pieza)} title="Editar">
                                                                ✏️
                                                            </button>
                                                            <button className="btn-accion btn-eliminar" onClick={() => solicitarEliminacion(pieza)} title="Eliminar">
                                                                🗑️
                                                            </button>
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
            {/* Modal de detalles */}
            <ModalDetalles
                pieza={piezaSeleccionada}
                alCerrar={() => setPiezaSeleccionada(null)}
                alEliminar={(piezaBorrar) => solicitarEliminacion(piezaBorrar)}
                alEditar={(piezaEditar) => iniciarEdicion(piezaEditar)}
            />
            {/* Modal de confirmación de borrado */}
            <ModalConfirmacion
                isOpen={Boolean(piezaAEliminar)}
                titulo="Confirmar eliminación"
                mensaje={`¿Estás segura de que querés eliminar la pieza "${piezaAEliminar?.nombre_designacion}" (N° ${piezaAEliminar?.numero_inventario})?`}
                onConfirmar={confirmarEliminacion}
                onCancelar={() => setPiezaAEliminar(null)}
            />
            {/* Modal de confirmación de borrado masivo */}
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
