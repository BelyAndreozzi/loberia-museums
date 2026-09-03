import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/useAuth';
import '../styles/Header.scss';

const Header = () => {
    const { usuario, logout } = useAuth();
    const navigate = useNavigate();

    const manejarCerrarSesion = async () => {
        await logout();
        navigate('/');
    };

    return (
        <header className="site-header">
            <Link to="/" className="header-logo">Museos Lobería</Link>
            <nav className="header-nav">
                {usuario ? (
                    <>
                        <span className="header-user-info">
                            Hola, <strong>{usuario.username}</strong>
                            <span className="header-user-role">{usuario.rol}</span>
                        </span>
                        <button
                            className="btn-header btn-logout"
                            onClick={manejarCerrarSesion}
                        >
                            Cerrar Sesión
                        </button>
                    </>
                ) : (
                    <>
                        <Link to="/login" className="btn-header btn-login">Iniciar sesión</Link>
                        <Link to="/registro" className="btn-header btn-register">Crear cuenta</Link>
                    </>
                )}
            </nav>
        </header>
    );
};

export default Header;
