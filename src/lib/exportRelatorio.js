import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import ExcelJS from 'exceljs'
import LogoBranco from '../assets/logo-branco.png'

// Paleta oficial do site (ver src/styles/tokens.css), duplicada aqui em
// formatos que jsPDF (arrays RGB 0-255) e ExcelJS (hex ARGB) entendem.
const NAVY_RGB = [0, 0, 69]
const MUTED_RGB = [107, 112, 148]
const LINE_RGB = [227, 229, 242]
const BG_RGB = [245, 246, 251]

const NAVY_ARGB = 'FF000045'
const ORANGE_ARGB = 'FFFF5400'
const ORANGE_BG_ARGB = 'FFFFEEE3'
const WHITE_ARGB = 'FFFFFFFF'
const MUTED_ARGB = 'FF6B7094'
const ROW_ALT_ARGB = 'FFF5F6FB'
const BORDER_ARGB = 'FFE9EAF5'

// A logo (PNG branco) precisa virar base64 pra poder ser embutida tanto no
// PDF (jsPDF) quanto na planilha (ExcelJS) — os dois pedem os bytes da
// imagem, não uma URL. Carregada uma vez só e reaproveitada.
let logoBase64Promise = null
function carregarLogoBase64() {
  if (!logoBase64Promise) {
    logoBase64Promise = fetch(LogoBranco)
      .then((resposta) => resposta.blob())
      .then((blob) => new Promise((resolve, reject) => {
        const leitor = new FileReader()
        leitor.onload = () => resolve(leitor.result)
        leitor.onerror = reject
        leitor.readAsDataURL(blob)
      }))
      .catch(() => null) // se falhar, os relatórios saem sem logo em vez de quebrar
  }
  return logoBase64Promise
}

function baixarBlob(blob, nomeArquivo) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = nomeArquivo
  link.click()
  URL.revokeObjectURL(url)
}

function formatarDataGeracao() {
  return new Date().toLocaleString('pt-BR')
}

function valorDaColuna(coluna, linha) {
  const valor = typeof coluna.render === 'function' ? coluna.render(linha) : linha[coluna.key]
  return valor === null || valor === undefined ? '' : valor
}

// ==========================================================
// PDF — cabeçalho navy com a logo, tabela com cores do site,
// rodapé com numeração de página em todas as páginas.
// ==========================================================
export async function gerarPdfRelatorio({
  titulo,
  subtitulo = '',
  resumo = [],
  colunas,
  linhas,
  linhaTotal = null,
  nomeArquivo,
  orientacao = 'landscape',
}) {
  const logo = await carregarLogoBase64()
  const doc = new jsPDF({ orientation: orientacao, unit: 'mm', format: 'a4' })
  const largura = doc.internal.pageSize.getWidth()
  const altura = doc.internal.pageSize.getHeight()

  const desenharCabecalho = () => {
    doc.setFillColor(...NAVY_RGB)
    doc.rect(0, 0, largura, 24, 'F')
    if (logo) {
      try { doc.addImage(logo, 'PNG', 12, 6, 34, 12) } catch { /* segue sem logo */ }
    }
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.text(titulo, largura - 12, 11, { align: 'right' })
    if (subtitulo) {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(215, 217, 235)
      doc.text(subtitulo, largura - 12, 17, { align: 'right' })
    }
  }

  desenharCabecalho()

  doc.setTextColor(...MUTED_RGB)
  doc.setFontSize(8)
  doc.text(`Gerado em ${formatarDataGeracao()}`, 12, 30)

  let cursorY = 34
  if (resumo.length > 0) {
    const gap = 4
    const larguraCard = (largura - 24 - gap * (resumo.length - 1)) / resumo.length
    resumo.forEach((r, i) => {
      const x = 12 + i * (larguraCard + gap)
      doc.setFillColor(...BG_RGB)
      doc.roundedRect(x, cursorY, larguraCard, 16, 2, 2, 'F')
      doc.setTextColor(...MUTED_RGB)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(7)
      doc.text(String(r.label).toUpperCase(), x + 4, cursorY + 6)
      doc.setTextColor(...NAVY_RGB)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(13)
      doc.text(String(r.value), x + 4, cursorY + 13)
    })
    cursorY += 16 + 8
  }

  const corpo = linhas.map((linha) => colunas.map((c) => valorDaColuna(c, linha)))
  const rodapeTabela = linhaTotal ? [colunas.map((c) => valorDaColuna(c, linhaTotal))] : undefined

  autoTable(doc, {
    startY: cursorY,
    head: [colunas.map((c) => c.header)],
    body: corpo,
    foot: rodapeTabela,
    styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 3, textColor: [11, 12, 34], lineColor: LINE_RGB, lineWidth: 0.1 },
    headStyles: { fillColor: NAVY_RGB, textColor: [255, 255, 255], fontStyle: 'bold' },
    footStyles: { fillColor: [255, 238, 227], textColor: NAVY_RGB, fontStyle: 'bold', lineColor: [255, 84, 0] },
    alternateRowStyles: { fillColor: BG_RGB },
    margin: { top: 30, left: 12, right: 12, bottom: 16 },
    didDrawPage: (data) => {
      if (data.pageNumber > 1) desenharCabecalho()
    },
  })

  const totalPaginas = doc.internal.getNumberOfPages()
  for (let i = 1; i <= totalPaginas; i++) {
    doc.setPage(i)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...MUTED_RGB)
    doc.text('FANEX · Gerenciador de Tarefas', 12, altura - 6)
    doc.text(`Página ${i} de ${totalPaginas}`, largura - 12, altura - 6, { align: 'right' })
  }

  doc.save(nomeArquivo)
}

// ==========================================================
// Excel (.xlsx) — cabeçalho navy com a logo embutida, colunas
// coloridas, linhas alternadas e (opcional) linha de total em laranja.
// ==========================================================
export async function gerarXlsxRelatorio({
  titulo,
  subtitulo = '',
  colunas,
  linhas,
  linhaTotal = null,
  nomeArquivo,
  nomeAba = 'Relatório',
}) {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'FANEX'
  workbook.created = new Date()

  const sheet = workbook.addWorksheet(nomeAba.slice(0, 31))
  const totalColunas = colunas.length

  const pintarFaixa = (linhaIdx, argb) => {
    for (let c = 1; c <= totalColunas; c++) {
      sheet.getCell(linhaIdx, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } }
    }
  }

  // Faixa navy com título (linhas 1-2) + logo flutuando por cima.
  sheet.mergeCells(1, 1, 2, totalColunas)
  pintarFaixa(1, NAVY_ARGB)
  pintarFaixa(2, NAVY_ARGB)
  const celTitulo = sheet.getCell(1, 1)
  celTitulo.value = titulo
  celTitulo.font = { size: 16, bold: true, color: { argb: WHITE_ARGB } }
  celTitulo.alignment = { vertical: 'middle', horizontal: 'right', indent: 2 }
  sheet.getRow(1).height = 22
  sheet.getRow(2).height = 22

  const logoBase64 = await carregarLogoBase64()
  if (logoBase64) {
    const logoId = workbook.addImage({ base64: logoBase64, extension: 'png' })
    sheet.addImage(logoId, { tl: { col: 0.15, row: 0.2 }, ext: { width: 130, height: 46 } })
  }

  // Subtítulo + data de geração (linhas 3-4).
  sheet.mergeCells(3, 1, 3, totalColunas)
  sheet.getCell(3, 1).value = subtitulo
  sheet.getCell(3, 1).font = { italic: true, size: 10.5, color: { argb: MUTED_ARGB } }
  sheet.getCell(3, 1).alignment = { horizontal: 'right' }

  sheet.mergeCells(4, 1, 4, totalColunas)
  sheet.getCell(4, 1).value = `Gerado em ${formatarDataGeracao()}`
  sheet.getCell(4, 1).font = { size: 9, color: { argb: MUTED_ARGB } }
  sheet.getCell(4, 1).alignment = { horizontal: 'right' }

  // Cabeçalho da tabela (linha 6, com uma linha em branco de respiro).
  const linhaCabecalho = 6
  const headerRow = sheet.getRow(linhaCabecalho)
  colunas.forEach((c, i) => {
    const cell = headerRow.getCell(i + 1)
    cell.value = c.header
    cell.font = { bold: true, color: { argb: WHITE_ARGB } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY_ARGB } }
    cell.alignment = { vertical: 'middle', horizontal: 'left' }
  })
  headerRow.height = 20

  linhas.forEach((linha, idx) => {
    const row = sheet.getRow(linhaCabecalho + 1 + idx)
    colunas.forEach((c, i) => {
      const cell = row.getCell(i + 1)
      cell.value = valorDaColuna(c, linha)
      cell.border = { bottom: { style: 'thin', color: { argb: BORDER_ARGB } } }
      if (idx % 2 === 1) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ROW_ALT_ARGB } }
      }
    })
  })

  if (linhaTotal) {
    const row = sheet.getRow(linhaCabecalho + 1 + linhas.length)
    colunas.forEach((c, i) => {
      const cell = row.getCell(i + 1)
      cell.value = valorDaColuna(c, linhaTotal)
      cell.font = { bold: true, color: { argb: NAVY_ARGB } }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ORANGE_BG_ARGB } }
      cell.border = { top: { style: 'thin', color: { argb: ORANGE_ARGB } } }
    })
  }

  sheet.views = [{ state: 'frozen', ySplit: linhaCabecalho }]
  colunas.forEach((c, i) => {
    sheet.getColumn(i + 1).width = c.width || Math.max(12, c.header.length + 4)
  })

  const buffer = await workbook.xlsx.writeBuffer()
  baixarBlob(
    new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    nomeArquivo,
  )
}
