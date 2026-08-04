import { PERMISSOES, agruparPermissoes } from '../lib/supabase'

// `permissoes`: objeto { chave: boolean }
// `onToggle(chave)`: alterna uma permissão
// `agrupar`: quando true, organiza por módulo com cabeçalhos (uso interno,
//   pensado para ser ligado somente quando quem está vendo é o Administrador)
// `somenteLeitura`: desabilita os checkboxes (uso em telas de "ver permissões")
export default function PermissoesSeletor({ permissoes, onToggle, agrupar = false, somenteLeitura = false }) {
  if (!agrupar) {
    return (
      <div className="fx-checkbox-grid">
        {PERMISSOES.map((p) => (
          <label key={p.key} className={`fx-checkbox-item ${somenteLeitura ? 'is-readonly' : ''}`}>
            <input
              type="checkbox"
              checked={!!permissoes[p.key]}
              disabled={somenteLeitura}
              onChange={() => onToggle(p.key)}
            />
            {p.label}
          </label>
        ))}
      </div>
    )
  }

  const grupos = agruparPermissoes()

  const marcarTodoGrupo = (itens, valor) => {
    itens.forEach((p) => {
      if (!!permissoes[p.key] !== valor) onToggle(p.key)
    })
  }

  return (
    <div className="fx-perm-grupos">
      {grupos.map(({ grupo, itens }) => {
        const ativos = itens.filter((p) => permissoes[p.key]).length
        const todasAtivas = ativos === itens.length

        return (
          <div className="fx-perm-grupo" key={grupo}>
            <div className="fx-perm-grupo-head">
              <span className="fx-perm-grupo-titulo">{grupo}</span>
              <span className="fx-perm-grupo-contador fx-mono">{ativos}/{itens.length}</span>
              {!somenteLeitura && (
                <button
                  type="button"
                  className="fx-btn fx-btn-ghost fx-btn-xs"
                  onClick={() => marcarTodoGrupo(itens, !todasAtivas)}
                >
                  {todasAtivas ? 'Desmarcar todas' : 'Marcar todas'}
                </button>
              )}
            </div>
            <div className="fx-checkbox-grid">
              {itens.map((p) => (
                <label key={p.key} className={`fx-checkbox-item ${somenteLeitura ? 'is-readonly' : ''}`}>
                  <input
                    type="checkbox"
                    checked={!!permissoes[p.key]}
                    disabled={somenteLeitura}
                    onChange={() => onToggle(p.key)}
                  />
                  {p.label}
                </label>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
