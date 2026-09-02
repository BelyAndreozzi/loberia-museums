import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import '../styles/Auth.scss';

const API_URL = 'http://localhost:3000';

const Login = () => {
    const navigate = useNavigate();
    const [datos, setDatos] = useState({ email: '', password: '' });
    const [error, setError] = useState('');
    const [cargando, setCargando] = useState(false);

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
                setError(resultado.error || 'No se pudo iniciar sesión.');
                return;
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

                <p className="auth-footer">¿Todavía no tenés una cuenta? <Link to="/registro">Crear cuenta</Link></p>
            </section>
        </main>
    );
};

export default Login;
