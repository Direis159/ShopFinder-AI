/**
 * ShopFinder AI — Agente operacional
 * ------------------------------------------------------------
 * Este agente cobre o dia a dia depois que o site já está no ar:
 *
 *   1) Fila de inscrição em afiliados — prepara os dados de cada
 *      formulário, mas a submissão final (aceitar termos, informar
 *      CNPJ/dados bancários) é sempre humana. Isso não é uma
 *      limitação de implementação — é uma exigência legal de cada
 *      programa, que existe pra evitar fraude.
 *
 *   2) Troca automática de link — assim que uma inscrição é
 *      aprovada e você cola o link real, o agente propaga a troca
 *      pra todos os produtos daquela loja no catálogo.
 *
 *   3) Detecção e reação a queda de vendas em produtos "campeões"
 *      — o caso que mais custa dinheiro se ninguém perceber a
 *      tempo.
 *
 *   4) Vigilância contínua por novas APIs/redes de afiliados
 *      (roda o agente de descoberta em ciclo, não só sob demanda).
 */

const fs = require("fs");


// ---------------------------------------------------------------
// 1. FILA DE INSCRIÇÃO EM AFILIADOS (humano assina, agente prepara)
// ---------------------------------------------------------------

const CAMPOS_PADRAO_FORMULARIO = {
  nomeDoSite: "ShopFinder AI",
  categoriaDoSite: "Comparador de preços / curadoria de ofertas",
  descricaoCurta:
    "Plataforma que compara preço, avaliação e histórico entre lojas parceiras, sem estoque próprio.",
  modeloDeMonetizacao: "Comissão por venda via link de afiliado",
};

// Gera o "pacote de inscrição" pronto pra colar no formulário de
// cada loja. Isso é o que elimina o trabalho manual de preencher
// tudo do zero — a pessoa só revisa e envia.
function prepararInscricao(nomeLoja, urlDoSite, estimativaTrafegoMensal) {
  return {
    loja: nomeLoja,
    status: "pronto_para_enviar", // -> "enviado" -> "aguardando_aprovacao" -> "aprovado" | "rejeitado"
    dadosFormulario: {
      ...CAMPOS_PADRAO_FORMULARIO,
      urlDoSite,
      estimativaTrafegoMensal,
    },
    linkDeInscricao: URLS_INSCRICAO[nomeLoja] ?? null,
    preenchidoEm: new Date().toISOString(),
  };
}

// Links oficiais de inscrição — o único clique que continua manual.
const URLS_INSCRICAO = {
  Amazon: "https://associados.amazon.com.br/",
  MercadoLivre: "https://www.mercadolivre.com.br/afiliados",
  Magalu: "https://www.magazinevoce.com.br/",
  Shopee: "https://affiliate.shopee.com.br/",
  AliExpress: "https://portals.aliexpress.com/",
  TikTokShop: "https://affiliate.tiktok.com/",
  Shein: "https://www.shein.com/affiliate",
};

function carregarFilaInscricoes(caminho) {
  if (!fs.existsSync(caminho)) return [];
  return JSON.parse(fs.readFileSync(caminho, "utf-8"));
}

function salvarFilaInscricoes(caminho, fila) {
  fs.writeFileSync(caminho, JSON.stringify(fila, null, 2));
}

// Atualiza o status quando a pessoa confirma manualmente uma etapa
// (ex: depois de receber o e-mail de aprovação da loja).
function atualizarStatusInscricao(fila, nomeLoja, novoStatus) {
  return fila.map((item) =>
    item.loja === nomeLoja ? { ...item, status: novoStatus, atualizadoEm: new Date().toISOString() } : item
  );
}


// ---------------------------------------------------------------
// 2. TROCA AUTOMÁTICA DE LINK (assim que aprovado)
// ---------------------------------------------------------------
// Uso: depois que uma inscrição é aprovada, você chama esta função
// uma vez com o "template" de link daquela loja — o agente propaga
// pra todos os produtos existentes e para os que entrarem depois.

function aplicarLinkAfiliadoAprovado(catalogo, nomeLoja, gerarLinkFn) {
  return catalogo.map((produto) => {
    if (produto.loja !== nomeLoja) return produto;
    if (!produto.urlAfiliado.includes("SEU-LINK-DE-AFILIADO-AQUI")) return produto; // já é real
    return { ...produto, urlAfiliado: gerarLinkFn(produto) };
  });
}

// Exemplo de uso real, depois de aprovado na Amazon Associates:
//
// const catalogoAtualizado = aplicarLinkAfiliadoAprovado(
//   catalogo,
//   "Amazon",
//   (produto) => `https://www.amazon.com.br/dp/${produto.idProdutoNaLoja}?tag=shopfinder-20`
// );


// ---------------------------------------------------------------
// 3. DETECÇÃO E REAÇÃO A QUEDA DE VENDAS EM PRODUTO CAMPEÃO
// ---------------------------------------------------------------
// O caso que mais importa: um produto que sempre vendeu bem some
// do topo. Pode ser fora de estoque na loja, preço subiu, ou outra
// loja ficou mais competitiva — cada causa pede uma reação diferente.

const LIMIAR_QUEDA_SIGNIFICATIVA = 0.30; // 30% de queda
const LIMIAR_PRODUTO_CAMPEAO = 0.75; // score que classifica como "vende muito"

function detectarQuedasDeVendas(catalogoHoje, catalogoOntem) {
  const alertas = [];

  for (const produto of catalogoHoje) {
    if (produto.score < LIMIAR_PRODUTO_CAMPEAO) continue; // só produtos campeões

    const anterior = catalogoOntem.find((p) => p.id === produto.id);
    if (!anterior) continue;

    const vendasHoje = produto.vendas?.unidadesUltimos7Dias ?? 0;
    const vendasAntes = anterior.vendas?.unidadesUltimos7Dias ?? 0;
    if (vendasAntes === 0) continue;

    const queda = (vendasAntes - vendasHoje) / vendasAntes;
    if (queda >= LIMIAR_QUEDA_SIGNIFICATIVA) {
      alertas.push({
        produtoId: produto.id,
        nome: produto.nome,
        quedaPercentual: Math.round(queda * 100),
        vendasAntes,
        vendasHoje,
      });
    }
  }

  return alertas;
}

// Pra cada alerta, o agente investiga a causa provável e decide a
// ação automática — sem esperar o ciclo diário normal.
async function investigarErReagir(alerta, produto, conectorDaLoja, catalogoCompleto) {
  const acoes = [];

  // Causa 1: saiu de estoque na loja de origem
  const dadosAtuais = await conectorDaLoja.buscarProdutoPorId(produto.loja.idProdutoNaLoja);
  if (!dadosAtuais || dadosAtuais.disponivel === false) {
    acoes.push({ tipo: "marcar_inativo", motivo: "Produto fora de estoque na loja de origem" });
  }

  // Causa 2: preço subiu bastante desde a última importação
  else if (dadosAtuais.preco > produto.preco.atual * 1.15) {
    acoes.push({
      tipo: "reimportar_preco_imediato",
      motivo: `Preço subiu de R$ ${produto.preco.atual} para R$ ${dadosAtuais.preco}`,
    });
  }

  // Causa 3: outra loja do mesmo grupo equivalente ficou mais competitiva
  if (produto.grupoEquivalente) {
    const concorrentes = catalogoCompleto.filter(
      (p) => p.grupoEquivalente === produto.grupoEquivalente && p.id !== produto.id
    );
    const maisBarato = concorrentes.sort((a, b) => a.preco.atual - b.preco.atual)[0];
    if (maisBarato && maisBarato.preco.atual < produto.preco.atual * 0.9) {
      acoes.push({
        tipo: "promover_concorrente_no_comparador",
        motivo: `${maisBarato.loja.nome} está vendendo por R$ ${maisBarato.preco.atual}, 10%+ mais barato`,
        produtoAlternativoId: maisBarato.id,
      });
    }
  }

  if (acoes.length === 0) {
    acoes.push({ tipo: "revisao_manual", motivo: "Queda de venda sem causa técnica clara — revisar manualmente" });
  }

  return { ...alerta, acoes };
}

// Orquestração: roda depois de cada importação diária normal,
// não substitui o ciclo — reage mais rápido quando um campeão cai.
async function rodarVigilanciaDeVendas(catalogoHoje, catalogoOntem, conectoresPorLoja) {
  const alertas = detectarQuedasDeVendas(catalogoHoje, catalogoOntem);
  const relatorio = [];

  for (const alerta of alertas) {
    const produto = catalogoHoje.find((p) => p.id === alerta.produtoId);
    const conector = conectoresPorLoja[produto.loja.nome];
    const investigado = await investigarErReagir(alerta, produto, conector, catalogoHoje);
    relatorio.push(investigado);
  }

  return relatorio; // isso alimenta uma seção nova no painel administrativo: "Alertas de venda"
}


// ---------------------------------------------------------------
// 4. VIGILÂNCIA CONTÍNUA POR NOVAS APIS/REDES (ciclo automático)
// ---------------------------------------------------------------
// Reaproveita o agente de descoberta (shopfinder-ai-descoberta-lojas.js)
// mas em execução periódica, não só sob demanda — assim novas lojas
// relevantes entram na fila de aprovação sozinhas, sem alguém
// precisar lembrar de rodar a busca.

// const { descobrirLojasViaRede, pesquisarProgramaDeAfiliados } = require("./shopfinder-ai-descoberta-lojas.js");

async function cicloDeVigilanciaDeAfiliados(redesJaConectadas, categoriasDoNicho, filaAtual) {
  let novaFila = [...filaAtual];

  for (const rede of redesJaConectadas) {
    const candidatas = await descobrirLojasViaRede(rede, categoriasDoNicho);
    for (const candidata of candidatas) {
      const jaNaFila = novaFila.some((f) => f.nome === candidata.nome);
      if (!jaNaFila) {
        novaFila.push({
          nome: candidata.nome,
          origem: rede.nomeRede,
          motivo: candidata.motivo,
          prioridade: candidata.prioridade,
          status: "aguardando_avaliacao_humana",
          sugeridoEm: new Date().toISOString(),
        });
      }
    }
  }

  return novaFila;
}

// Agendamento recomendado (ver shopfinder-ai-pipeline-importacao.js,
// seção 6, pro padrão de cron já usado no projeto):
//
// cron.schedule("0 4 * * 1", async () => { // toda segunda, 4h
//   filaInscricoes = await cicloDeVigilanciaDeAfiliados(redes, ["cozinha", "eletronicos"], filaInscricoes);
//   salvarFilaInscricoes("./fila-inscricoes-afiliados.json", filaInscricoes);
// });


module.exports = {
  prepararInscricao,
  carregarFilaInscricoes,
  salvarFilaInscricoes,
  atualizarStatusInscricao,
  aplicarLinkAfiliadoAprovado,
  detectarQuedasDeVendas,
  investigarErReagir,
  rodarVigilanciaDeVendas,
  cicloDeVigilanciaDeAfiliados,
};
