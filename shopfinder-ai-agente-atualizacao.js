/**
 * ShopFinder AI — Agente de IA para atualização do catálogo
 * ------------------------------------------------------------
 * O pipeline de importação (shopfinder-ai-pipeline-importacao.js)
 * já traz os dados brutos de cada loja e normaliza pro schema comum.
 * O motor de recomendação (shopfinder-ai-motor-recomendacao.js) já
 * calcula score e badges com regras determinísticas.
 *
 * Este agente entra NO MEIO dos dois — ele resolve as três tarefas
 * que regra fixa não resolve bem, porque exigem entendimento de
 * linguagem/contexto, não só comparação numérica:
 *
 *   1) Casar o "mesmo produto" quando ele vem de lojas diferentes
 *      com título, categoria e ficha técnica diferentes.
 *   2) Escrever a explicação em linguagem natural que aparece no
 *      "ai-box" da página de produto ("Por que o ShopFinder AI
 *      recomenda").
 *   3) Detectar preço "riscado" inflado artificialmente (loja marca
 *      um preço "de" mais alto só pra parecer desconto maior).
 *
 * Roda como uma etapa entre a importação e o re-ranking:
 *
 *   [Pipeline de importação] -> [Agente de IA] -> [Motor de recomendação]
 */

// ---------------------------------------------------------------
// 0. CHAMADA AO MODELO
// ---------------------------------------------------------------
// Uma função única de acesso ao modelo, usada pelas três tarefas
// abaixo. Trocar de provedor/modelo não deve exigir mexer no resto
// do agente.

async function chamarIA(promptSistema, promptUsuario) {
  const resposta = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 800,
      system: promptSistema,
      messages: [{ role: "user", content: promptUsuario }],
    }),
  });
  const dados = await resposta.json();
  return dados.content.map((bloco) => bloco.text || "").join("\n").trim();
}


// ---------------------------------------------------------------
// 1. CASAMENTO DE PRODUTOS ENTRE LOJAS (PRODUCT MATCHING)
// ---------------------------------------------------------------
// Sem isso, o comparador de preço da página de produto não existe:
// cada loja teria seu produto isolado, mesmo sendo o mesmo item.
// Estratégia em duas etapas — barata primeiro, IA só quando precisa.

// Etapa 1 (barata, sem IA): pré-filtra candidatos por categoria +
// similaridade de texto simples, pra não gastar chamada de IA
// comparando tudo com tudo.
function preFiltrarCandidatos(produto, catalogoExistente) {
  return catalogoExistente.filter((candidato) => {
    if (candidato.categoria !== produto.categoria) return false;
    if (candidato.loja.nome === produto.loja.nome) return false; // já é a mesma loja
    const similaridade = similaridadeSimples(produto.nome, candidato.nome);
    return similaridade > 0.35;
  });
}

function similaridadeSimples(a, b) {
  const palavrasA = new Set(a.toLowerCase().split(/\s+/));
  const palavrasB = new Set(b.toLowerCase().split(/\s+/));
  const intersecao = [...palavrasA].filter((p) => palavrasB.has(p)).length;
  return intersecao / Math.max(palavrasA.size, palavrasB.size);
}

// Etapa 2 (só pros candidatos que sobraram): a IA confirma se é
// realmente o mesmo produto, considerando variações de nome/marca
// que um filtro de texto simples não pega.
async function confirmarMesmoProdutoComIA(produto, candidato) {
  const promptSistema =
    "Você compara duas fichas de produto de lojas diferentes e diz se é " +
    "o mesmo produto (mesma marca, modelo e especificações), mesmo com " +
    "nomes escritos de forma diferente. Responda apenas 'sim' ou 'nao'.";

  const promptUsuario =
    `Produto 1 (${produto.loja.nome}): ${produto.nome}\n` +
    `Produto 2 (${candidato.loja.nome}): ${candidato.nome}`;

  const resposta = await chamarIA(promptSistema, promptUsuario);
  return resposta.toLowerCase().includes("sim");
}

// Função principal: devolve o grupo de produtos equivalentes entre
// lojas, usado pra montar a tabela de comparação da página de produto.
async function agruparProdutoEquivalente(produto, catalogoExistente) {
  const candidatos = preFiltrarCandidatos(produto, catalogoExistente);
  const equivalentes = [];

  for (const candidato of candidatos) {
    const ehMesmo = await confirmarMesmoProdutoComIA(produto, candidato);
    if (ehMesmo) equivalentes.push(candidato);
  }

  return equivalentes; // usado para preencher a tabela "Compare entre lojas"
}


// ---------------------------------------------------------------
// 2. GERAÇÃO DA EXPLICAÇÃO DA IA (texto do "ai-box")
// ---------------------------------------------------------------
// Gera o texto que aparece em "Por que o ShopFinder AI recomenda"
// na página de produto — a partir dos MESMOS dados objetivos que
// alimentam o score (nunca inventa dado que o produto não tem).

async function gerarExplicacaoIA(produto, score, badges) {
  const promptSistema =
    "Você escreve, em português do Brasil, de 2 a 3 marcadores curtos " +
    "explicando por que um produto é recomendado, com base SOMENTE nos " +
    "dados fornecidos. Nunca invente dado que não foi passado. Seja " +
    "direto, sem linguagem de propaganda ('imperdível', 'incrível').";

  const promptUsuario = `
Produto: ${produto.nome}
Preço atual: R$ ${produto.preco.atual} (preço original: R$ ${produto.preco.original})
Avaliação: ${produto.avaliacao.nota} com ${produto.avaliacao.numeroAvaliacoes} avaliações
Vendas últimos 7 dias: ${produto.vendas.unidadesUltimos7Dias} (semana anterior: ${produto.vendas.unidadesSemanaAnterior})
Badges já calculados por regra: ${badges.join(", ") || "nenhum"}
Score da IA: ${score}
`;

  return chamarIA(promptSistema, promptUsuario);
  // Saída típica, no formato usado no ai-box:
  // "Preço 20% abaixo da média das últimas 8 semanas"
  // "Nota consistente (4.8) em quase 9 mil avaliações verificadas"
}


// ---------------------------------------------------------------
// 3. DETECÇÃO DE PREÇO "RISCADO" INFLADO
// ---------------------------------------------------------------
// Problema comum em afiliados: a loja mostra um "preço original"
// artificialmente alto só pra parecer um desconto maior. Isso mina
// a confiança que o ShopFinder AI promete na seção "Por que confiar".

function detectarPrecoInfladoSuspeito(produto) {
  const historico90d = produto.preco.historico.slice(-90);
  if (historico90d.length < 10) return { suspeito: false, motivo: null };

  const maiorPrecoJaPraticado = Math.max(...historico90d.map((p) => p.valor));
  const precoOriginalDeclarado = produto.preco.original;

  // Se o "preço original" declarado nunca foi de fato praticado
  // nos últimos 90 dias, é sinal de desconto inflado artificialmente.
  const inflacaoPercentual =
    (precoOriginalDeclarado - maiorPrecoJaPraticado) / maiorPrecoJaPraticado;

  if (inflacaoPercentual > 0.15) {
    return {
      suspeito: true,
      motivo: `Preço "original" de R$ ${precoOriginalDeclarado} nunca foi praticado nos últimos 90 dias (máximo real: R$ ${maiorPrecoJaPraticado})`,
    };
  }
  return { suspeito: false, motivo: null };
}

// Produtos marcados como suspeitos não recebem o badge "Queda de
// preço" mesmo que a regra numérica simples indicasse isso — a
// checagem de inflação tem prioridade sobre o cálculo de desconto.
function ajustarBadgesComChecagemDeInflacao(produto, badges) {
  const checagem = detectarPrecoInfladoSuspeito(produto);
  if (checagem.suspeito) {
    return badges.filter((b) => b !== "Queda de preço");
  }
  return badges;
}


// ---------------------------------------------------------------
// 4. ORQUESTRAÇÃO — onde isso entra no fluxo diário
// ---------------------------------------------------------------

async function processarComAgenteIA(catalogoBruto, catalogoExistente) {
  const catalogoProcessado = [];

  for (const produto of catalogoBruto) {
    const equivalentes = await agruparProdutoEquivalente(produto, catalogoExistente);

    catalogoProcessado.push({
      ...produto,
      produtosEquivalentes: equivalentes.map((e) => e.id), // alimenta o comparador
    });
  }

  return catalogoProcessado;
}

// Uso no fluxo diário completo (junta os três arquivos):
//
// const catalogoBruto = await rodarImportacaoDiaria(conectores, catalogoAnterior);
// const catalogoComEquivalencias = await processarComAgenteIA(catalogoBruto, catalogoAnterior);
// const catalogoRankeado = reordenarCatalogo(catalogoComEquivalencias); // aplica score + badges
//
// for (const produto of catalogoRankeado) {
//   produto.badges = ajustarBadgesComChecagemDeInflacao(produto, produto.badges);
//   produto.explicacaoIA = await gerarExplicacaoIA(produto, produto.score, produto.badges);
// }
//
// await salvarCatalogo(catalogoRankeado);


// ---------------------------------------------------------------
// 5. CUSTO E FREQUÊNCIA (ponto de atenção prático)
// ---------------------------------------------------------------
// Chamar IA por produto todo dia fica caro num catálogo de milhares
// de itens. Recomendação:
//
//   - Casamento de produtos (seção 1): só roda quando um produto é
//     NOVO no catálogo, não a cada atualização de preço.
//   - Explicação da IA (seção 2): só regenera quando o score muda
//     de forma relevante (ex: mudou de faixa de badge) ou a cada
//     7 dias, o que vier primeiro — não precisa ser diário.
//   - Detecção de preço inflado (seção 3): é regra determinística,
//     sem custo de IA, pode rodar em todo produto todo dia.
