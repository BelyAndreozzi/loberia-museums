import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import '../styles/Dashboard.scss';
import FormularioPieza from '../components/FormularioPieza';
import ModalDetalles from '../components/ModalDetalles';

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

    // Estado para controlar qué pieza se está viendo en el modal (null si está cerrado)
    const [piezaSeleccionada, setPiezaSeleccionada] = useState<any>(null);

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

    // Sacamos el fetch a una función suelta para poder usarla al guardar
    const cargarDatos = async () => {
        setCargando(true);
        try {
            const respuesta = await fetch(`http://localhost:3000/api/piezas?museo_id=${usuario.museo_id}`);
            if (respuesta.ok) {
                const datos = await respuesta.json();
                setPiezas(datos);
            }
        } catch (error) {
            console.error('Error:', error);
        } finally {
            setCargando(false);
        }
    };

    // Se ejecuta solo la primera vez que carga la pantalla
    useEffect(() => {
        cargarDatos();
    }, [usuario.museo_id]);

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
                            <button onClick={() => setMostrandoFormulario(true)}>Cargar Pieza</button>
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
                        // SI ES TRUE: Mostramos el formulario
                        <FormularioPieza
                            usuario={usuario}
                            alGuardar={() => {
                                setMostrandoFormulario(false);
                                cargarDatos();
                            }}
                        />
                    ) : (
                        // SI ES FALSE: Mostramos la tabla
                        <div className="card-table">
                            <div className="card-header">
                                <h3>Últimas piezas registradas</h3>
                                <button className="btn-agregar" onClick={() => setMostrandoFormulario(true)}>
                                    + Nueva Pieza
                                </button>
                            </div>

                            <div className="table-responsive">
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th>Museo</th>
                                            <th>N° Inventario</th>
                                            <th>Designación / Nombre</th>
                                            <th>Estado</th>
                                            <th>Procedencia</th>
                                            <th>Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {piezas.map((pieza: any) => (
                                            <tr key={pieza.id}>
                                                <td>
                                                    <span className={`badge-museo ${pieza.museo_id === 1 ? 'naturales' : 'historia'}`}>
                                                        {pieza.nombre_museo}
                                                    </span>
                                                </td>
                                                <td><strong>{pieza.numero_inventario}</strong></td>
                                                <td>{pieza.nombre_designacion}</td>
                                                <td>{pieza.estado_conservacion}</td>
                                                <td>{pieza.procedencia}</td>
                                                <td>
                                                    <button
                                                        className="btn-accion"
                                                        onClick={() => setPiezaSeleccionada(pieza)}
                                                    >
                                                        Ver Detalles
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
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
            />

        </div>

    );
};

export default Dashboard;
