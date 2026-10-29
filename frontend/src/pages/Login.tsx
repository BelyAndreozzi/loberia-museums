import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/useAuth';
import { API_URL } from '../config';
import '../styles/Auth.scss';
import { MUSEOS, museoPorId } from '../museos';
import type { Museo } from '../museos';

const Login = ({ museo }: { museo?: Museo }) => {
    const navigate = useNavigate();
    const { login, usuario, logout, cargando: sesionCargando } = useAuth();
    const [datos, setDatos] = useState({ email: '', password: '' });
    const [error, setError] = useState('');
    const [cargando, setCargando] = useState(false);
    const museoSesion = usuario ? museoPorId(usuario.museo_id) : undefined;

    const actualizarCampo = (campo: 'email' | 'password', valor: string) => {
        setDatos({ ...datos, [campo]: valor });
        setError('');
    };

    const iniciarSesion = async (evento: FormEvent<HTMLFormElement>) => {
        evento.preventDefault();
        if (!museo || cargando) return;
        setCargando(true);
        setError('');

        try {
            const respuesta = await fetch(`${API_URL}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ ...datos, museo_id: museo.id })
            });
            const resultado = await respuesta.json();

            if (!respuesta.ok) {
                setError(resultado.error || 'No se pudo iniciar sesión.');
                return;
            }

            if (resultado.usuario) {
                login(resultado.usuario);
            }
            navigate(`/dashboard?museo_id=${museo.id}`);
        } catch {
            setError('No se pudo conectar con el servidor.');
        } finally {
            setCargando(false);
        }
    };

    if (!museo) return (
        <main className="auth-page">
            <section className="auth-panel">
                <div className="auth-intro">
                    <span className="auth-kicker">Museos Lobería</span>
                    <h1>Elegí tu museo</h1>
                    <p>Iniciá sesión en el museo al que pertenece tu cuenta.</p>
                </div>
                <div className="museum-links">
                    {MUSEOS.map(opcion => <Link key={opcion.id} to={`/login/${opcion.slug}`} className="museum-link">
                        <img src={opcion.logo} alt="" /><span>{opcion.nombre}</span>
                    </Link>)}
                </div>
                <p className="auth-footer"><Link to="/">Volver al inicio</Link></p>
            </section>
        </main>
    );

    return (
        <main className="auth-page">
            <section className={`auth-panel auth-museum-${museo.id}`}>
                <div className="auth-intro">
                    <img className="auth-museum-logo" src={museo.logo} alt="" />
                    <span className="auth-kicker">Museos Lobería</span>
                    <h1>Iniciar sesión</h1>
                    <h2 className="auth-museum-name">{museo.nombre}</h2>
                    <p>Ingresá con tu cuenta de este museo.</p>
                </div>

                {sesionCargando ? <p role="status">Cargando sesión...</p> : usuario ? <div className="auth-form">
                    <p role="status">Tenés una sesión activa{museoSesion ? ` en ${museoSesion.nombre}` : ''}.</p>
                    {usuario.museo_id === museo.id
                        ? <Link className="auth-link-button" to={`/dashboard?museo_id=${museo.id}`}>Ir al inventario</Link>
                        : <button type="button" disabled={cargando} onClick={async () => {
                            setCargando(true);
                            await logout();
                            setCargando(false);
                        }}>Cerrar sesión para ingresar a {museo.nombre}</button>}
                </div> : <form className="auth-form" onSubmit={iniciarSesion}>
                    <label>
                        Email
                        <input
                            type="email"
                            value={datos.email}
                            onChange={evento => actualizarCampo('email', evento.target.value)}
                            autoComplete="email"
                            required
                        />
                    </label>
                    <label>
                        Contraseña
                        <input
                            type="password"
                            value={datos.password}
                            onChange={evento => actualizarCampo('password', evento.target.value)}
                            autoComplete="current-password"
                            required
                        />
                    </label>

                    {error && <p className="auth-error" role="alert">{error}</p>}
                    <button type="submit" disabled={cargando}>
                        {cargando ? 'Ingresando...' : 'Ingresar'}
                    </button>
                </form>}

                <p className="auth-footer"><Link to="/olvide-password">Olvidé mi contraseña</Link></p>

                <p className="auth-footer">¿Todavía no tenés una cuenta? <Link to={`/registro/${museo.slug}`}>Crear cuenta en {museo.nombre}</Link></p>
                <p className="auth-footer"><Link to="/login">Elegir otro museo</Link></p>
            </section>
        </main>
    );
};

export default Login;
