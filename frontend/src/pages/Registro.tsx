import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { API_URL } from '../config';
import '../styles/Auth.scss';
import { MUSEOS, museoPorId } from '../museos';
import type { Museo } from '../museos';

const Registro = ({ museo }: { museo?: Museo }) => {
    const [datos, setDatos] = useState({
        username: '',
        email: '',
        museo_id: museo ? String(museo.id) : '',
        password: '',
        confirmPassword: ''
    });
    const [mensaje, setMensaje] = useState('');
    const [errores, setErrores] = useState<Record<string, string>>({});
    const [cargando, setCargando] = useState(false);
    const museoElegido = museoPorId(Number(datos.museo_id));

    const actualizarCampo = (campo: string, valor: string) => {
        setDatos({ ...datos, [campo]: valor });
        setErrores({ ...errores, [campo]: '' });
        setMensaje('');
    };

    const registrar = async (evento: FormEvent<HTMLFormElement>) => {
        evento.preventDefault();
        if (cargando) return;
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
            setDatos({ username: '', email: '', museo_id: datos.museo_id, password: '', confirmPassword: '' });
        } catch {
            setErrores({ general: 'No se pudo conectar con el servidor.' });
        } finally {
            setCargando(false);
        }
    };

    return (
        <main className="auth-page">
            <section className={`auth-panel${museoElegido ? ` auth-museum-${museoElegido.id}` : ''}`}>
                <div className="auth-intro">
                    {museoElegido && <img className="auth-museum-logo" src={museoElegido.logo} alt="" />}
                    <span className="auth-kicker">Museos Lobería</span>
                    <h1>Crear cuenta</h1>
                    {museoElegido && <h2 className="auth-museum-name">{museoElegido.nombre}</h2>}
                    <p>{museoElegido ? `Tu cuenta pertenecerá a ${museoElegido.nombre}.` : 'Elegí a qué museo pertenecés para crear tu cuenta.'}</p>
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

                    {!museo && <fieldset className="museum-selector" disabled={cargando}>
                        <legend className="museum-selector-label">Museo al que pertenecés</legend>
                        <div className="museum-options">
                            {MUSEOS.map(opcion => <label key={opcion.id} className={`museum-option ${datos.museo_id === String(opcion.id) ? 'selected' : ''}`}>
                                <input type="radio" name="museo_id" value={opcion.id} required checked={datos.museo_id === String(opcion.id)} onChange={e => actualizarCampo('museo_id', e.target.value)} />
                                <img src={opcion.logo} alt="" />
                                <span className="museum-option-name">{opcion.nombre}</span>
                                <span className="museum-option-check" aria-hidden="true">{datos.museo_id === String(opcion.id) ? '●' : '○'}</span>
                            </label>)}
                        </div>
                        {errores.museo_id && <small>{errores.museo_id}</small>}
                    </fieldset>}

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

                    {errores.general && <p className="auth-error" role="alert">{errores.general}</p>}
                    {mensaje && <p className="auth-success" role="status">{mensaje}</p>}
                    <button type="submit" disabled={cargando || Boolean(mensaje)}>{cargando ? 'Registrando...' : 'Crear cuenta'}</button>
                </form>

                <p className="auth-footer">¿Ya tenés una cuenta? <Link to={museoElegido ? `/login/${museoElegido.slug}` : '/login'}>Iniciar sesión{museoElegido ? ` en ${museoElegido.nombre}` : ''}</Link></p>
                <p className="auth-footer"><Link to="/registro">Elegir otro museo</Link></p>
            </section>
        </main>
    );
};

export default Registro;
