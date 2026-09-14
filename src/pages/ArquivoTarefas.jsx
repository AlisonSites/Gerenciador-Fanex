import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { registrarAuditoria } from '../lib/auditoria'
import Layout from '../components/Layout'
import ConfirmModal from '../components/ConfirmModal'
import { PRIORIDADES, PRIORIDADE_CLASSE, AnexosSecao, ComentariosSecao } from './Tarefas'
import '../styles/kanban.css'
import '../styles/calendario.css'

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

// "2026-08" -> "Agosto de 2026"
function formatarMes(mesArquivo) {
  if (!mesArquivo) return 'Sem mês definido'
  const [ano, mes] = mesArquivo.split('-')
  return `${MESES[Number(mes) - 1] || mes} de ${ano}`
}

function formatarDataHoraBR(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR')
}

export default function ArquivoTarefas() {
  const { usuario, temPermissao, unidadeAtual } = useAuth()
  // Ver o arquivo de todo mundo (não só o próprio) agora é uma permissão
  // própria deste módulo, independente do Quadro de Tarefas.
  const podeVerTudo = temPermissao('ver_todos_arquivos_tarefas')
  // Editar, excluir, comentar e anexar em tarefas arquivadas agora são
  // permissões próprias deste módulo, independentes do Quadro de Tarefas.
  const podeEditar = temPermissao('editar_arquivo_tarefas')
  const podeExcluir = temPermissao('excluir_arquivo_tarefas')
  const podeComentar = temPermissao('comentar_arquivo_tarefas')
  const podeAnexar = temPermissao('anexar_arquivo_tarefas')

  const [tarefas, setTarefas] = useState([])
  const [loading, setLoading] = useState(true)
  const [mesSelecionado, setMesSelecionado] = useState(null)
  const [usuarioSelecionado, setUsuarioSelecionado] = useState(null)
  const [tarefaAberta, setTarefaAberta] = useState(null)
  const [tarefaExcluindo, setTarefaExcluindo] = useState(null)
  const [editando, setEditando] = useState(false)
  const [formEdicao, setFormEdicao] = useState(null)
  const [salvandoEdicao, setSalvandoEdicao] = useState(false)

  const carregar = async () => {
    setLoading(true)
    let query = supabase
      .from('tarefas')
      .select('*, usuarios(nome_completo), grupos(nome)')
      .eq('arquivada', true)
      .order('concluida_em', { ascending: false })

    // Reforça no próprio pedido: quem não pode ver tudo só recebe as
    // tarefas em que é o responsável.
    if (!podeVerTudo) {
      query = query.eq('usuario_id', usuario?.id || '00000000-0000-0000-0000-000000000000')
    }
    if (unidadeAtual?.id) query = query.eq('unidade_id', unidadeAtual.id)

    const { data } = await query
    setTarefas(data || [])
    setLoading(false)
  }

  useEffect(() => { carregar() }, [podeVerTudo, usuario, unidadeAtual])

  const pastasPorMes = useMemo(() => {
    const mapa = {}
    tarefas.forEach((t) => {
      const mes = t.mes_arquivo || 'sem-mes'
      if (!mapa[mes]) mapa[mes] = []
      mapa[mes].push(t)
    })
    return Object.entries(mapa)
      .map(([mes, itens]) => ({ mes, itens }))
      .sort((a, b) => b.mes.localeCompare(a.mes))
  }, [tarefas])

  const pastaDoMes = pastasPorMes.find((p) => p.mes === mesSelecionado)

  const pastasPorPessoa = useMemo(() => {
    if (!pastaDoMes) return []
    const mapa = {}
    pastaDoMes.itens.forEach((t) => {
      const chave = t.usuario_id || 'sem-responsavel'
      if (!mapa[chave]) mapa[chave] = { usuarioId: t.usuario_id, nome: t.usuarios?.nome_completo || 'Sem responsável', itens: [] }
      mapa[chave].itens.push(t)
    })
    return Object.values(mapa).sort((a, b) => a.nome.localeCompare(b.nome))
  }, [pastaDoMes])

  const pastaDaPessoa = pastasPorPessoa.find((p) => (p.usuarioId || 'sem-responsavel') === usuarioSelecionado)

  const abrirTarefa = (t) => {
    setTarefaAberta(t)
    setEditando(false)
  }

  const iniciarEdicao = () => {
    setFormEdicao({
      titulo: tarefaAberta.titulo || '',
      descricao: tarefaAberta.descricao || '',
      prioridade: tarefaAberta.prioridade || 'Normal',
    })
    setEditando(true)
  }

  const salvarEdicao = async (e) => {
    e.preventDefault()
    setSalvandoEdicao(true)
    const { error } = await supabase.from('tarefas').update(formEdicao).eq('id', tarefaAberta.id)
    setSalvandoEdicao(false)
    if (error) {
      window.alert('Não foi possível salvar as alterações: ' + error.message)
      return
    }
    registrarAuditoria({
      acao: 'editar',
      modulo: 'Tarefas',
      descricao: `Editou a tarefa arquivada "${formEdicao.titulo}"`,
      dadosAntes: { titulo: tarefaAberta.titulo, descricao: tarefaAberta.descricao, prioridade: tarefaAberta.prioridade },
      dadosDepois: formEdicao,
    })
    const atualizada = { ...tarefaAberta, ...formEdicao }
    setTarefaAberta(atualizada)
    setTarefas((prev) => prev.map((t) => (t.id === atualizada.id ? atualizada : t)))
    setEditando(false)
  }

  const excluirTarefa = async () => {
    const { error } = await supabase.from('tarefas').delete().eq('id', tarefaExcluindo.id)
    setTarefaExcluindo(null)
    if (error) {
      window.alert('Não foi possível excluir esta tarefa: ' + error.message)
      return
    }
    registrarAuditoria({
      acao: 'excluir',
      modulo: 'Tarefas',
      descricao: `Excluiu a tarefa arquivada "${tarefaExcluindo.titulo}"`,
      dadosAntes: { id: tarefaExcluindo.id, titulo: tarefaExcluindo.titulo },
    })
    setTarefaAberta(null)
    carregar()
  }

  return (
    <Layout title="Arquivo de Tarefas">
      <div className="fx-page-head">
        <div>
          {mesSelecionado ? (
            <button className="fx-back-link" onClick={() => { setMesSelecionado(null); setUsuarioSelecionado(null) }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 6l-6 6 6 6" /></svg>
              {usuarioSelecionado ? 'Voltar para as pessoas' : 'Voltar para os meses'}
            </button>
          ) : null}
          <h1>
            {usuarioSelecionado ? pastaDaPessoa?.nome : mesSelecionado ? formatarMes(mesSelecionado) : 'Arquivo de Tarefas'}
          </h1>
          <p>
            {usuarioSelecionado
              ? `Tarefas concluídas em ${formatarMes(mesSelecionado)}.`
              : mesSelecionado
                ? 'Selecione uma pessoa para ver as tarefas concluídas por ela neste mês.'
                : 'Tarefas concluídas ficam guardadas aqui, organizadas por mês, assim que o mês termina.'}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="fx-empty">Carregando arquivo…</div>
      ) : usuarioSelecionado ? (
        <div className="fx-panel">
          <div className="fx-table-wrap">
            <table className="fx-table">
              <thead>
                <tr>
                  <th>Tarefa</th>
                  <th>Prioridade</th>
                  <th>Grupo</th>
                  <th>Concluída em</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {(pastaDaPessoa?.itens || []).map((t) => (
                  <tr key={t.id} onClick={() => abrirTarefa(t)} style={{ cursor: 'pointer' }}>
                    <td><strong>{t.titulo}</strong></td>
                    <td><span className={`fx-pill fx-pill--${PRIORIDADE_CLASSE[t.prioridade] || 'normal'}`}>{t.prioridade}</span></td>
                    <td>{t.grupos?.nome || '—'}</td>
                    <td className="fx-mono">{formatarDataHoraBR(t.concluida_em)}</td>
                    <td>
                      <button type="button" className="fx-btn fx-btn-ghost fx-btn-sm" onClick={(e) => { e.stopPropagation(); abrirTarefa(t) }}>Ver</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : mesSelecionado ? (
        pastasPorPessoa.length === 0 ? (
          <div className="fx-empty"><strong>Nada por aqui</strong>Ninguém concluiu tarefas neste mês.</div>
        ) : (
          <div className="fx-group-cards">
            {pastasPorPessoa.map((p) => (
              <button key={p.usuarioId || 'sem-responsavel'} className="fx-group-card" onClick={() => setUsuarioSelecionado(p.usuarioId || 'sem-responsavel')}>
                <div className="fx-group-card-top">
                  <span className="fx-group-card-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" /></svg>
                  </span>
                </div>
                <div className="fx-group-card-title">{p.nome}</div>
                <div className="fx-group-card-meta">
                  <span>{p.itens.length} tarefa(s) concluída(s)</span>
                </div>
                <div className="fx-group-card-cta">Abrir pasta
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 6l6 6-6 6" /></svg>
                </div>
              </button>
            ))}
          </div>
        )
      ) : pastasPorMes.length === 0 ? (
        <div className="fx-empty">
          <strong>Nenhuma tarefa arquivada ainda</strong>
          Assim que um mês terminar, as tarefas concluídas nele aparecem aqui automaticamente.
        </div>
      ) : (
        <div className="fx-group-cards">
          {pastasPorMes.map((p) => (
            <button key={p.mes} className="fx-group-card" onClick={() => setMesSelecionado(p.mes)}>
              <div className="fx-group-card-top">
                <span className="fx-group-card-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2zM8 2v4m8-4v4M3 10h18" /></svg>
                </span>
              </div>
              <div className="fx-group-card-title">{formatarMes(p.mes)}</div>
              <div className="fx-group-card-meta">
                <span>{p.itens.length} tarefa(s) concluída(s)</span>
              </div>
              <div className="fx-group-card-cta">Abrir pasta
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 6l6 6-6 6" /></svg>
              </div>
            </button>
          ))}
        </div>
      )}

      {tarefaAberta && (
        <div className="fx-modal-scrim" onClick={() => setTarefaAberta(null)}>
          <div className="fx-modal" onClick={(e) => e.stopPropagation()}>
            <div className="fx-modal-head">
              <h3>{tarefaAberta.titulo}</h3>
              <button className="fx-modal-close" onClick={() => setTarefaAberta(null)}>×</button>
            </div>
            {editando ? (
              <form onSubmit={salvarEdicao}>
                <div className="fx-modal-body">
                  <label className="fx-field-group">
                    <span>Nome da tarefa</span>
                    <input required value={formEdicao.titulo} onChange={(e) => setFormEdicao({ ...formEdicao, titulo: e.target.value })} />
                  </label>
                  <label className="fx-field-group">
                    <span>Descrição</span>
                    <textarea value={formEdicao.descricao} onChange={(e) => setFormEdicao({ ...formEdicao, descricao: e.target.value })} />
                  </label>
                  <label className="fx-field-group">
                    <span>Prioridade</span>
                    <select value={formEdicao.prioridade} onChange={(e) => setFormEdicao({ ...formEdicao, prioridade: e.target.value })}>
                      {PRIORIDADES.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </label>
                </div>
                <div className="fx-modal-foot">
                  <button type="button" className="fx-btn fx-btn-ghost" onClick={() => setEditando(false)}>Cancelar</button>
                  <button type="submit" className="fx-btn fx-btn-primary" disabled={salvandoEdicao}>{salvandoEdicao ? 'Salvando...' : 'Salvar alterações'}</button>
                </div>
              </form>
            ) : (
              <>
                <div className="fx-modal-body">
                  <div className="fx-detalhe-grid">
                    <div className="fx-detalhe-item">
                      <span className="fx-detalhe-label">Prioridade</span>
                      <span className={`fx-pill fx-pill--${PRIORIDADE_CLASSE[tarefaAberta.prioridade] || 'normal'}`}>{tarefaAberta.prioridade}</span>
                    </div>
                    <div className="fx-detalhe-item">
                      <span className="fx-detalhe-label">Descrição</span>
                      <p className="fx-detalhe-valor" style={{ whiteSpace: 'pre-wrap' }}>{tarefaAberta.descricao || '—'}</p>
                    </div>
                    <div className="fx-detalhe-item">
                      <span className="fx-detalhe-label">Responsável</span>
                      <p className="fx-detalhe-valor">{tarefaAberta.usuarios?.nome_completo || '—'}</p>
                    </div>
                    <div className="fx-detalhe-item">
                      <span className="fx-detalhe-label">Grupo</span>
                      <p className="fx-detalhe-valor">{tarefaAberta.grupos?.nome || '—'}</p>
                    </div>
                    <div className="fx-detalhe-item">
                      <span className="fx-detalhe-label">Concluída em</span>
                      <p className="fx-detalhe-valor">{formatarDataHoraBR(tarefaAberta.concluida_em)}</p>
                    </div>
                  </div>
                </div>
                {(podeEditar || podeExcluir) && (
                  <div className="fx-modal-foot" style={{ justifyContent: 'space-between' }}>
                    {podeExcluir
                      ? <button className="fx-btn fx-btn-danger" onClick={() => setTarefaExcluindo(tarefaAberta)}>Excluir tarefa</button>
                      : <span />}
                    {podeEditar && <button className="fx-btn fx-btn-primary" onClick={iniciarEdicao}>Editar tarefa</button>}
                  </div>
                )}
              </>
            )}
            <AnexosSecao tarefaId={tarefaAberta.id} usuarioAtual={usuario} podeAnexar={podeAnexar} />
            <ComentariosSecao tarefaId={tarefaAberta.id} usuarioAtual={usuario} podeComentar={podeComentar} />
          </div>
        </div>
      )}

      {tarefaExcluindo && (
        <ConfirmModal
          title="Excluir tarefa"
          message={`Tem certeza que deseja excluir "${tarefaExcluindo.titulo}"? Esta ação não pode ser desfeita.`}
          onConfirm={excluirTarefa}
          onCancel={() => setTarefaExcluindo(null)}
        />
      )}
    </Layout>
  )
}
