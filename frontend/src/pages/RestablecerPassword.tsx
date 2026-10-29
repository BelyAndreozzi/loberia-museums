import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { API_URL } from '../config';
import '../styles/Auth.scss';

export default function RestablecerPassword() {
    const location = useLocation();
    const parametros = new URLSearchParams(location.hash.slice(1));
    const token = parametros.get('token') || '';
    const email = parametros.get('email') || '';
    const enlaceValido = /^[a-f0-9]{64}$/.test(token) && email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [cargando, setCargando] = useState(false);
    const [error, setError] = useState('');
    const [mensaje, setMensaje] = useState('');

    const guardar = async (evento: FormEvent<HTMLFormElement>) => {
        evento.preventDefault();
        if (cargando || !enlaceValido) return;
        setError('');
        if (password !== confirmPassword) return setError('Las contraseñas no coinciden.');
        if (new TextEncoder().encode(password).length > 72) return setError('La contraseña supera el máximo de 72 bytes.');
        setCargando(true);
        try {
            const respuesta = await fetch(`${API_URL}/api/auth/reset-password`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                credentials: 'omit', referrerPolicy: 'no-referrer',
                body: JSON.stringify({ email, token, password, confirmPassword }),
            });
            const resultado = await respuesta.json();
            if (!respuesta.ok) throw new Error(resultado.error || 'No se pudo cambiar la contraseña.');
            setMensaje(resultado.mensaje);
            setPassword('');
            setConfirmPassword('');
            window.history.replaceState(window.history.state, '', location.pathname);
        } catch (error) {
            setError(error instanceof Error ? error.message : 'No se pudo conectar con el servidor.');
        } finally {
            setCargando(false);
        }
    };

    return <main className="auth-page">
        <section className="auth-panel" aria-labelledby="restablecer-titulo">
            <div className="auth-intro">
                <span className="auth-kicker">Museos Lobería</span>
                <h1 id="restablecer-titulo">Nueva contraseña</h1>
                <p>Elegí una contraseña segura para volver a ingresar.</p>
            </div>
            {mensaje ? <p className="auth-success" role="status">{mensaje}</p>
                : !enlaceValido ? <p className="auth-error" role="alert">El enlace está incompleto o no es válido. Solicitá uno nuevo.</p>
                : <form className="auth-form" onSubmit={guardar} aria-busy={cargando}>
                    <p id="password-ayuda">Mínimo 8 caracteres, una mayúscula, una minúscula y un número. Máximo 72 bytes.</p>
                    <label>Nueva contraseña
                        <input type="password" autoComplete="new-password" minLength={8} maxLength={72}
                            pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9]).{8,}" aria-describedby="password-ayuda"
                            value={password} onChange={evento => setPassword(evento.target.value)} required disabled={cargando} />
                    </label>
                    <label>Confirmar contraseña
                        <input type="password" autoComplete="new-password" minLength={8} maxLength={72}
                            value={confirmPassword} onChange={evento => setConfirmPassword(evento.target.value)} required disabled={cargando} />
                    </label>
                    {error && <p className="auth-error" role="alert">{error}</p>}
                    <button type="submit" disabled={cargando}>{cargando ? 'Guardando...' : 'Guardar nueva contraseña'}</button>
                </form>}
            {!mensaje && <p className="auth-footer"><Link to="/olvide-password">Solicitar otro enlace</Link></p>}
            <p className="auth-footer"><Link to="/login">Volver a iniciar sesión</Link></p>
        </section>
    </main>;
}
