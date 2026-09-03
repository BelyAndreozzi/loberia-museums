import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import '../styles/Auth.scss';

const VerificarEmail = () => {
    const [parametros] = useSearchParams();
    const [estado, setEstado] = useState('Verificando tu email...');
    const [correcto, setCorrecto] = useState(false);

    useEffect(() => {
        const token = parametros.get('token');
        if (!token) {
            setEstado('El enlace de verificación no contiene un token válido.');
            return;
        }

        fetch(`http://localhost:3000/api/auth/verify-email?token=${encodeURIComponent(token)}`)
            .then(async respuesta => {
                const resultado = await respuesta.json();
                if (!respuesta.ok) throw new Error(resultado.error);
                setCorrecto(true);
                setEstado(resultado.mensaje);
            })
            .catch(error => setEstado(error.message || 'No se pudo verificar el email.'));
    }, [parametros]);

    return (
        <main className="auth-page">
            <section className={`auth-panel verification-panel ${correcto ? 'is-success' : ''}`}>
                <span className="auth-kicker">Museos Lobería</span>
                <h1>{correcto ? 'Email verificado' : 'Verificación de email'}</h1>
                <p>{estado}</p>
                <Link className="auth-link-button" to="/">Volver al inicio</Link>
            </section>
        </main>
    );
};

export default VerificarEmail;