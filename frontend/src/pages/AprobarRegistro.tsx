import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/useAuth';
import '../styles/Auth.scss';

const AprobarRegistro = () => {
    const { usuario, cargando: sesionCargando, fetchConSesion } = useAuth();
    const { hash, pathname } = useLocation();
    const token = new URLSearchParams(hash.slice(1)).get('token') || '';
    const tokenValido = /^[a-f0-9]{64}$/.test(token);
    const [cargando, setCargando] = useState(false);
    const [mensaje, setMensaje] = useState('');
    const [error, setError] = useState('');

    const decidir = async (decision: 'aprobado' | 'rechazado') => {
        if (!tokenValido || cargando) return;
        setCargando(true);
        setError('');
        try {
            const respuesta = await fetchConSesion('/api/auth/registration-approval', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, decision }),
                referrerPolicy: 'no-referrer'
            });
            const resultado = await respuesta.json();
            if (!respuesta.ok) throw new Error(resultado.error || 'No se pudo procesar la solicitud.');
            setMensaje(resultado.mensaje);
            window.history.replaceState(window.history.state, '', pathname);
        } catch (causa) {
            setError(causa instanceof Error ? causa.message : 'No se pudo conectar con el servidor.');
        } finally {
            setCargando(false);
        }
    };

    return <main className="auth-page">
        <section className="auth-panel verification-panel" aria-labelledby="aprobacion-titulo">
            <span className="auth-kicker">Museos Lobería</span>
            <h1 id="aprobacion-titulo">Solicitud de registro</h1>
            {!tokenValido ? <p className="auth-error" role="alert">El enlace no es válido.</p>
                : mensaje ? <p className="auth-success" role="status">{mensaje}</p>
                : sesionCargando ? <p role="status">Verificando sesión...</p>
                : usuario?.rol !== 'encargado' ? <p>
                    Para aprobar o rechazar tenés que <Link to="/login" target="_blank">iniciar sesión</Link> como
                    encargado del museo. Después recargá esta página.
                </p>
                : <>
                    <p>Confirmá si autorizás la nueva cuenta para tu museo.</p>
                    <div className="approval-actions">
                        <button type="button" disabled={cargando} onClick={() => decidir('aprobado')}>Aprobar</button>
                        <button type="button" className="approval-reject" disabled={cargando} onClick={() => decidir('rechazado')}>Rechazar</button>
                    </div>
                </>}
            {error && <p className="auth-error" role="alert">{error}</p>}
            <p className="auth-footer"><Link to="/">Volver al inicio</Link></p>
        </section>
    </main>;
};

export default AprobarRegistro;
