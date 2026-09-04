import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/useAuth';
import type { Usuario, RolUsuario } from '../contexts/auth-context';
import DashboardLayout from '../components/DashboardLayout';
import '../styles/Admin.scss';

const Admin = () => {
    const { usuario, fetchConSesion } = useAuth();
    const navigate = useNavigate();
    const [usuarios, setUsuarios] = useState<(Usuario & { museo_nombre: string })[]>([]);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState('');

    const puedeAsignarRol = usuario?.rol === 'encargado';
    const museoId = usuario?.museo_id ?? 1;

    useEffect(() => {
        if (usuario && usuario.rol !== 'encargado' && usuario.rol !== 'admin') {
            navigate('/dashboard');
        }
    }, [usuario, navigate]);

    useEffect(() => {
        let cancelado = false;

        const cargar = async () => {
            try {
                const respuesta = await fetchConSesion('/api/usuarios');
                if (!cancelado && respuesta.ok) {
                    setUsuarios(await respuesta.json());
                } else if (!cancelado) {
                    setError('No se pudieron cargar los usuarios.');
                }
            } catch {
                if (!cancelado) setError('Error de conexión.');
            } finally {
                if (!cancelado) setCargando(false);
            }
        };

        cargar();
        return () => { cancelado = true; };
    }, []);

    const cambiarRol = async (id: number, nuevoRol: RolUsuario) => {
        try {
            const respuesta = await fetchConSesion(`/api/usuarios/${id}/rol`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rol: nuevoRol })
            });

            if (respuesta.ok) {
                setUsuarios(usuarios.map(u =>
                    u.id === id ? { ...u, rol: nuevoRol } : u
                ));
            } else {
                const data = await respuesta.json();
                alert(data.error || 'No se pudo cambiar el rol.');
            }
        } catch {
            alert('Error de conexión.');
        }
    };

    return (
        <DashboardLayout titulo="Gestión de Usuarios" museoId={museoId}>
            {cargando ? (
                <div className="admin-loading">Cargando usuarios...</div>
            ) : (
                <>
                    {error && <p className="admin-error">{error}</p>}

                    <div className="table-responsive">
                        <table className="data-table admin-table">
                            <thead>
                                <tr>
                                    <th>Username</th>
                                    <th>Email</th>
                                    <th>Museo</th>
                                    <th>Rol</th>
                                    {puedeAsignarRol && <th style={{ textAlign: 'center' }}>Acciones</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {usuarios.length === 0 ? (
                                    <tr><td colSpan={5} className="mensaje-vacio">No hay usuarios registrados.</td></tr>
                                ) : (
                                    usuarios.map(u => (
                                        <tr key={u.id}>
                                            <td><strong>{u.username}</strong></td>
                                            <td>{u.email}</td>
                                            <td>{u.museo_nombre ?? '—'}</td>
                                            <td>
                                                <span className={`badge-rol ${u.rol}`}>
                                                    {u.rol}
                                                </span>
                                            </td>
                                            {puedeAsignarRol && (
                                                <td style={{ textAlign: 'center' }}>
                                                    {u.id === usuario?.id ? (
                                                        <span className="text-muted">Vos</span>
                                                    ) : (
                                                        <select
                                                            className="select-rol"
                                                            value={u.rol}
                                                            onChange={(e) => cambiarRol(u.id, e.target.value as RolUsuario)}
                                                        >
                                                            <option value="usuario">usuario</option>
                                                            <option value="admin">admin</option>
                                                        </select>
                                                    )}
                                                </td>
                                            )}
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </>
            )}
        </DashboardLayout>
    );
};

export default Admin;
