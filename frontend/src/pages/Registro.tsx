import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import '../styles/Auth.scss';

const API_URL = 'http://localhost:3000';

const Registro = () => {
    const [datos, setDatos] = useState({
        username: '',
        email: '',
        password: '',
        confirmPassword: ''
    });
    const [mensaje, setMensaje] = useState('');
    const [errores, setErrores] = useState<Record<string, string>>({});
    const [cargando, setCargando] = useState(false);

    const actualizarCampo = (campo: string, valor: string) => {
        setDatos({ ...datos, [campo]: valor });
        setErrores({ ...errores, [campo]: '' });
        setMensaje('');
    };

    const registrar = async (evento: FormEvent<HTMLFormElement>) => {
        evento.preventDefault();
        setCargando(true);
        setErrores({});
        setMensaje('');

        try {
            const respuesta = await fetch(`${API_URL}/api/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(datos)
            });
            const resultado = await respuesta.json();

            if (!respuesta.ok) {
                setErrores(resultado.errores || { general: resultado.error });
                return;
            }

            setMensaje(resultado.mensaje);
            setDatos({ username: '', email: '', password: '', confirmPassword: '' });
        } catch {
            setErrores({ general: 'No se pudo conectar con el servidor.' });
        } finally {
            setCargando(false);
        }
    };

    return (
        <main className="auth-page">
            <section className="auth-panel">
                <div className="auth-intro">
                    <span className="auth-kicker">Museos Lobería</span>
                    <h1>Crear cuenta</h1>
                    <p>Registrate para comenzar a gestionar el patrimonio de tu museo.</p>
                </div>

                <form className="auth-form" onSubmit={registrar}>
                    <label>
                        Username
                        <input value={datos.username} onChange={evento => actualizarCampo('username', evento.target.value)} autoComplete="username" required />
                        {errores.username && <small>{errores.username}</small>}
                    </label>
                    <label>
                        Email
                        <input type="email" value={datos.email} onChange={evento => actualizarCampo('email', evento.target.value)} autoComplete="email" required />
                        {errores.email && <small>{errores.email}</small>}
                    </label>
                    <label>
                        Contraseña
                        <input type="password" value={datos.password} onChange={evento => actualizarCampo('password', evento.target.value)} autoComplete="new-password" required />
                        {errores.password && <small>{errores.password}</small>}
                    </label>
                    <label>
                        Confirmar contraseña
                        <input type="password" value={datos.confirmPassword} onChange={evento => actualizarCampo('confirmPassword', evento.target.value)} autoComplete="new-password" required />
                        {errores.confirmPassword && <small>{errores.confirmPassword}</small>}
                    </label>

                    {errores.general && <p className="auth-error">{errores.general}</p>}
                    {mensaje && <p className="auth-success">{mensaje}</p>}
                    <button type="submit" disabled={cargando}>{cargando ? 'Registrando...' : 'Crear cuenta'}</button>
                </form>

                <p className="auth-footer">¿Ya tenés una cuenta? <Link to="/">Volver al inicio</Link></p>
            </section>
        </main>
    );
};

export default Registro;