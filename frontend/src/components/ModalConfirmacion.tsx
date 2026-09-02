import '../styles/Modal.scss';

interface ModalConfirmacionProps {
    isOpen: boolean;
    titulo: string;
    mensaje: string;
    onConfirmar: () => void;
    onCancelar: () => void;
}

const ModalConfirmacion = ({ isOpen, titulo, mensaje, onConfirmar, onCancelar }: ModalConfirmacionProps) => {
    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onCancelar}>
            <div className="modal-content modal-confirmacion" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>{titulo}</h3>
                    <button className="btn-cerrar" onClick={onCancelar}>&times;</button>
                </div>

                <div className="modal-body">
                    <p className="mensaje-principal">{mensaje}</p>
                    <p className="mensaje-alerta">⚠️ Esta acción no podrá revertirse.</p>
                </div>

                <div className="modal-footer">
                    <button className="btn-cancelar" onClick={onCancelar}>Cancelar</button>
                    <button className="btn-peligro" onClick={onConfirmar}>Sí, eliminar</button>
                </div>
            </div>
        </div>
    );
};

export default ModalConfirmacion;