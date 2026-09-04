import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/useAuth';
import { API_URL } from '../config';
import '../styles/Auth.scss';
import logoNaturales from '../assets/logos/logo-naturales.jpg';
import logoHistoria from '../assets/logos/logo-historia.jpg';

const Login = () => {
    const navigate = useNavigate();
    const { login } = useAuth();
    const [datos, setDatos] = useState({ email: '', password: '' });
    const [error, setError] = useState('');
    const [cargando, setCargando] = useState(false);
    const [sesionActiva, setSesionActiva] = useState(false);

    const actualizarCampo = (campo: 'email' | 'password', valor: string) => {
        setDatos({ ...datos, [campo]: valor });
        setError('');
    };

    const iniciarSesion = async (evento: FormEvent<HTMLFormElement>) => {
        evento.preventDefault();
        setCargando(true);
        setError('');

        try {
            const respuesta = await fetch(`${API_URL}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(datos)
            });
            const resultado = await respuesta.json();

            if (!respuesta.ok) {
                if (respuesta.status === 409 && resultado.error === 'Ya estás logueado.') {
                    setSesionActiva(true);
                }
                setError(resultado.error || 'No se pudo iniciar sesión.');
                return;
            }

            if (resultado.usuario) {
                login(resultado.usuario);
            }
            navigate('/dashboard');
        } catch {
            setError('No se pudo conectar con el servidor.');
        } finally {
            setCargando(false);
        }
    };

    return (
        <main className="auth-page">
            <section className="auth-panel">
                <div className="auth-intro">
                    <span className="auth-kicker">Museos Lobería</span>
                    <h1>Iniciar sesión</h1>
                    <p>Ingresá para gestionar el patrimonio de tu museo.</p>
                </div>

                <form className="auth-form" onSubmit={iniciarSesion}>
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

                    {error && <p className="auth-error">{error}</p>}
                    <button type="submit" disabled={cargando}>
                        {cargando ? 'Ingresando...' : 'Ingresar'}
                    </button>
                </form>

                {sesionActiva && (
                    <div className="museum-links">
                        <Link to="/dashboard?museo_id=1" className="museum-link">
                            <img src={logoNaturales} alt="" />
                            <span>Ciencias Naturales</span>
                        </Link>
                        <Link to="/dashboard?museo_id=2" className="museum-link">
                            <img src={logoHistoria} alt="" />
                            <span>Museo Histórico</span>
                        </Link>
                    </div>
                )}

                <p className="auth-footer">¿Todavía no tenés una cuenta? <Link to="/registro">Crear cuenta</Link></p>
            </section>
        </main>
    );
};

export default Login;
