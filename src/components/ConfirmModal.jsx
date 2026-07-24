export default function ConfirmModal({ title, message, onConfirm, onCancel, confirmLabel = 'Excluir', danger = true }) {
  return (
    <div className="fx-modal-scrim" onClick={onCancel}>
      <div className="fx-modal" onClick={(e) => e.stopPropagation()}>
        <div className="fx-modal-head">
          <h3>{title}</h3>
          <button className="fx-modal-close" onClick={onCancel}>×</button>
        </div>
        <div className="fx-modal-body">
          <p style={{ margin: 0, color: 'var(--fx-muted)', fontSize: 14 }}>{message}</p>
        </div>
        <div className="fx-modal-foot">
          <button className="fx-btn fx-btn-ghost" onClick={onCancel}>Cancelar</button>
          <button className={`fx-btn ${danger ? 'fx-btn-danger' : 'fx-btn-primary'}`} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
