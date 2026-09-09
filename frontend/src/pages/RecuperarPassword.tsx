import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { API_URL } from '../config';
import '../styles/Auth.scss';

export default function RecuperarPassword() {
    const [email, setEmail] = useState('');
    const [cargando, setCargando] = useState(false);
    const [error, setError] = useState('');
    const [mensaje, setMensaje] = useState('');

    const enviar = async (evento: FormEvent<HTMLFormElement>) => {
        evento.preventDefault();
        if (cargando) return;
        setCargando(true);
        setError('');
        try {
            const respuesta = await fetch(`${API_URL}/api/auth/forgot-password`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email.trim().toLowerCase() }),
                credentials: 'omit', referrerPolicy: 'no-referrer',
            });
            const resultado = await respuesta.json();
            if (!respuesta.ok) throw new Error(resultado.error || 'No se pudo enviar la solicitud.');
            setMensaje(resultado.mensaje);
        } catch (error) {
            setError(error instanceof Error ? error.message : 'No se pudo conectar con el servidor.');
        } finally {
            setCargando(false);
        }
    };

    return <main className="auth-page">
        <section className="auth-panel" aria-labelledby="recuperar-titulo">
            <div className="auth-intro">
                <span className="auth-kicker">Museos Lobería</span>
                <h1 id="recuperar-titulo">Recuperá tu acceso</h1>
                <p>Ingresá el email de tu cuenta. Te enviaremos un enlace para crear una nueva contraseña.</p>
            </div>
            {mensaje ? <div role="status">
                <p className="auth-success">{mensaje}</p>
                <p>Revisá también la carpeta de spam. El enlace vence en 30 minutos.</p>
            </div> : <form className="auth-form" onSubmit={enviar} aria-busy={cargando}>
                <label>Email
                    <input type="email" autoComplete="email" maxLength={254} required
                        value={email} onChange={evento => setEmail(evento.target.value)} disabled={cargando} />
                </label>
                {error && <p className="auth-error" role="alert">{error}</p>}
                <button type="submit" disabled={cargando}>{cargando ? 'Enviando...' : 'Enviar enlace'}</button>
            </form>}
            <p className="auth-footer"><Link to="/login">Volver a iniciar sesión</Link></p>
        </section>
    </main>;
}
