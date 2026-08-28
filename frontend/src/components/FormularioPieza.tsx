import React, { useState } from 'react';
import '../styles/Formulario.scss';

interface FormularioProps {
    usuario: {
        nombre: string;
        rol: string;
        museo_id: number;
    };
    alGuardar: () => void;
}


const FormularioPieza = ({ usuario, alGuardar }: FormularioProps) => {
    const [cargando, setCargando] = useState(false);
    const [error, setError] = useState('');

    const [formData, setFormData] = useState({
        numero_inventario: '',
        nombre_designacion: '',
        estado_conservacion: 'Bueno',
        procedencia: '',
        categoria: '',
        ubicacion_museo: false,
        material_principal: '',
        material_secundario: '',
        largo_cm: '',
        ancho_cm: '',
        forma_ingreso: ''
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        const checked = (e.target as HTMLInputElement).checked;

        setFormData({
            ...formData,
            [name]: type === 'checkbox' ? checked : value
        });
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setCargando(true);
        setError('');

        try {
            const datosParaGuardar = { ...formData, museo_id: usuario.museo_id };

            const respuesta = await fetch('http://localhost:3000/api/piezas', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(datosParaGuardar)
            });

            if (respuesta.ok) {
                alGuardar();
            } else {
                setError('Hubo un problema al guardar en la base de datos.');
            }
        } catch (err) {
            setError('Error de conexión con el servidor.');
        } finally {
            setCargando(false);
        }
    };

    return (
        <div className="form-container card-table">
            <div className="card-header">
                <h3>Cargar Nueva Pieza</h3>
            </div>

            <form onSubmit={handleSubmit} className="pieza-form">
                <h4 className="form-section-title">Datos Generales</h4>
                <div className="form-grid">
                    <div className="form-group">
                        <label>N° Inventario</label>
                        <input type="text" name="numero_inventario" value={formData.numero_inventario} onChange={handleChange} required />
                    </div>
                    <div className="form-group">
                        <label>Designación / Nombre</label>
                        <input type="text" name="nombre_designacion" value={formData.nombre_designacion} onChange={handleChange} required />
                    </div>
                    <div className="form-group">
                        <label>Estado de Conservación</label>
                        <select name="estado_conservacion" value={formData.estado_conservacion} onChange={handleChange}>
                            <option value="Bueno">Bueno</option>
                            <option value="Regular">Regular</option>
                            <option value="Malo">Malo</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <label>Procedencia</label>
                        <input type="text" name="procedencia" value={formData.procedencia} onChange={handleChange} required />
                    </div>
                </div>

                {usuario.museo_id === 2 && (
                    <>
                        <h4 className="form-section-title">Detalles Específicos - Historia</h4>
                        <div className="form-grid">
                            <div className="form-group">
                                <label>Forma de Ingreso</label>
                                <input type="text" name="forma_ingreso" value={formData.forma_ingreso} onChange={handleChange} />
                            </div>
                            <div className="form-group">
                                <label>Material Principal</label>
                                <input type="text" name="material_principal" value={formData.material_principal} onChange={handleChange} />
                            </div>
                            <div className="form-group">
                                <label>Largo (cm)</label>
                                <input type="number" step="0.1" name="largo_cm" value={formData.largo_cm} onChange={handleChange} />
                            </div>
                            <div className="form-group">
                                <label>Ancho (cm)</label>
                                <input type="number" step="0.1" name="ancho_cm" value={formData.ancho_cm} onChange={handleChange} />
                            </div>
                        </div>
                    </>
                )}

                {usuario.museo_id === 1 && (
                    <>
                        <h4 className="form-section-title">Detalles Específicos - Cs. Naturales</h4>
                        <div className="form-grid">
                            <div className="form-group">
                                <label>Categoría</label>
                                <input type="text" name="categoria" value={formData.categoria} onChange={handleChange} />
                            </div>
                            <div className="form-group checkbox-group">
                                <label>
                                    <input type="checkbox" name="ubicacion_museo" checked={formData.ubicacion_museo} onChange={handleChange} />
                                    ¿Está exhibido en el museo?
                                </label>
                            </div>
                        </div>
                    </>
                )}

                {error && <p className="error-msg">{error}</p>}

                <div className="form-actions">
                    <button type="button" className="btn-cancelar" onClick={alGuardar}>Cancelar</button>
                    <button type="submit" className="btn-guardar" disabled={cargando}>
                        {cargando ? 'Guardando...' : 'Guardar Pieza'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default FormularioPieza;