import { useState, useEffect } from 'react';
import type { MouseEvent as ReactMouseEvent, ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/useAuth';

const nombresInventario: Record<number, string> = {
    1: 'Ciencias Naturales',
    2: 'Historia'
};

type Props = {
    titulo: string;
    museoId: number;
    children: ReactNode;
};

const DashboardLayout = ({ titulo, museoId, children }: Props) => {
    const navigate = useNavigate();
    const { usuario, cargando: sesionCargando, logout } = useAuth();
    const estaAutenticado = usuario !== null;
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
        return () => document.removeEventListener('mousedown', manejarClicAfuera);
    }, [menuAbierto]);

    if (sesionCargando) {
        return <div className="dashboard-loading">Cargando sesión...</div>;
    }

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
                        <li>
                            <Link to={`/dashboard?museo_id=${museoId}`} onClick={() => setSidebarAbierta(false)}>
                                Mi Inventario
                            </Link>
                        </li>
                        {estaAutenticado && (
                            <li>
                                <Link to={`/dashboard?museo_id=${museoId}`} onClick={() => setSidebarAbierta(false)}>
                                    Cargar Pieza
                                </Link>
                            </li>
                        )}
                        {estaAutenticado && (usuario?.rol === 'encargado' || usuario?.rol === 'admin') && (
                            <li className={titulo === 'Gestión de Usuarios' ? 'active' : ''}>
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
                        <span /><span /><span />
                    </button>
                    <div className="header-title">
                        <h1>{titulo}</h1>
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
                    {children}
                </section>
            </main>
        </div>
    );
};

export default DashboardLayout;
