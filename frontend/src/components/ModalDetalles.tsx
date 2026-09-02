import '../styles/Modal.scss';

interface ModalProps {
    pieza: any;
    alCerrar: () => void;
    alEliminar: (id: number) => void;
    alEditar: (pieza: any) => void;
}

const ModalDetalles = ({ pieza, alCerrar, alEliminar, alEditar }: ModalProps) => {
    if (!pieza) return null;

    return (
        <div className="modal-overlay" onClick={alCerrar}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>Detalle de la Pieza</h3>
                    <button className="btn-cerrar" onClick={alCerrar}>&times;</button>
                </div>

                <div className="modal-body">
                    <div className="detalle-grupo">
                        <span className="label">Museo:</span>
                        <span className="valor">{pieza.nombre_museo}</span>
                    </div>
                    <div className="detalle-grupo">
                        <span className="label">N° Inventario:</span>
                        <span className="valor"><strong>{pieza.numero_inventario}</strong></span>
                    </div>
                    <div className="detalle-grupo">
                        <span className="label">Designación / Nombre:</span>
                        <span className="valor">{pieza.nombre_designacion}</span>
                    </div>
                    <div className="detalle-grupo">
                        <span className="label">Estado de Conservación:</span>
                        <span className="valor">{pieza.estado_conservacion}</span>
                    </div>
                    <div className="detalle-grupo">
                        <span className="label">Procedencia:</span>
                        <span className="valor">{pieza.procedencia}</span>
                    </div>
                    <div className="detalle-grupo">
                        <span className="label">Fecha de Registro:</span>
                        <span className="valor">{new Date(pieza.fecha_registro).toLocaleDateString()}</span>
                    </div>

                    {/* --- DATOS ESPECÍFICOS DE HISTORIA --- */}
                    {pieza.museo_id === 2 && (
                        <>
                            <h4 className="modal-subtitulo">Información Histórica</h4>
                            <div className="detalle-grupo">
                                <span className="label">Forma de Ingreso:</span>
                                <span className="valor">{pieza.forma_ingreso || 'No especificada'}</span>
                            </div>
                            <div className="detalle-grupo">
                                <span className="label">Material Principal:</span>
                                <span className="valor">{pieza.material_principal || '-'}</span>
                            </div>
                            <div className="detalle-grupo">
                                <span className="label">Material Secundario:</span>
                                <span className="valor">{pieza.material_secundario || '-'}</span>
                            </div>
                            <div className="detalle-grupo">
                                <span className="label">Dimensiones (L x An x Esp):</span>
                                <span className="valor">
                                    {pieza.largo_cm || '-'} cm x {pieza.ancho_cm || '-'} cm x {pieza.espesor_cm || '-'} cm
                                </span>
                            </div>
                            <div className="detalle-grupo">
                                <span className="label">Autor:</span>
                                <span className="valor">{pieza.autor || 'Desconocido'}</span>
                            </div>
                        </>
                    )}

                    {/* --- DATOS ESPECÍFICOS DE CIENCIAS NATURALES --- */}
                    {pieza.museo_id === 1 && (
                        <>
                            <h4 className="modal-subtitulo">Información de Ciencias Naturales</h4>
                            <div className="detalle-grupo">
                                <span className="label">Categoría:</span>
                                <span className="valor">{pieza.categoria || '-'}</span>
                            </div>
                            <div className="detalle-grupo">
                                <span className="label">Ubicación en Museo:</span>
                                <span className="valor">{pieza.ubicacion_museo ? 'Sí (Exhibido)' : 'No'}</span>
                            </div>
                        </>
                    )}
                </div>

                <div className="modal-footer">
                    <button className="btn-editar-modal" onClick={() => alEditar(pieza)}>
                        Editar Pieza
                    </button>
                    <button className="btn-eliminar-modal" onClick={() => {
                        alEliminar(pieza);
                        alCerrar();
                    }}>
                        Eliminar Pieza
                    </button>
                    <button className="btn-volver" onClick={alCerrar}>Cerrar</button>
                </div>
            </div>
        </div>
    );
};

export default ModalDetalles;