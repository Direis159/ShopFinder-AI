/**
 * ShopFinder AI — Schema do catálogo + Motor de recomendação
 * ------------------------------------------------------------
 * Este arquivo define:
 *  1) A estrutura de dados de um produto no catálogo (o que cada
 *     integração de loja precisa entregar pra alimentar o site).
 *  2) O motor de recomendação: como calcular o "score da IA" e
 *     decidir quais badges aparecem em cada produto
 *     (Escolha da IA, Em alta, Queda de preço, Menor preço em N dias).
 *
 * As páginas (home, categoria, produto) já criadas consomem
 * exatamente esses campos — isso é o que fecha o ciclo entre
 * design e dados reais.
 */

// ---------------------------------------------------------------
// 1. SCHEMA DO PRODUTO
// ---------------------------------------------------------------
// Cada produto importado de uma loja parceira deve ser normalizado
// para este formato antes de entrar no catálogo.

const exemploProduto = {
  id: "afry-magalu-88213",          // id interno único (loja + id da loja)
  nome: "Air fryer digital 5L, painel touch",
  categoria: "cozinha",
  subcategoria: "air-fryer",

  loja: {
    nome: "Magalu",                  // Amazon | Mercado Livre | Shopee | AliExpress | Magalu
    idProdutoNaLoja: "MG-9981123",
    urlAfiliado: "https://exemplo-afiliado.com/r/MG-9981123?tag=shopfinder",
    frete: { valor: 0, gratisAcimaDe: 99 },
    prazoEntregaDias: 5,
  },

  preco: {
    atual: 312.00,
    original: 389.00,               // preço "de tabela" pra calcular desconto
    moeda: "BRL",
    historico: [
      // um ponto por dia, usado no gráfico de histórico de preço
      { data: "2026-08-11", valor: 389.00 },
      { data: "2026-08-25", valor: 349.00 },
      { data: "2026-09-01", valor: 320.00 },
      { data: "2026-09-08", valor: 312.00 },
    ],
  },

  avaliacao: {
    nota: 4.8,                      // 0 a 5
    numeroAvaliacoes: 8940,
  },

  vendas: {
    unidadesUltimos7Dias: 640,
    unidadesSemanaAnterior: 410,     // usado pra calcular tendência de crescimento
  },

  comissao: {
    percentual: 6.5,                 // % de comissão do programa de afiliados
  },

  imagens: ["https://.../img1.jpg", "https://.../img2.jpg"],
  ativo: true,                       // false = produto saiu de linha/fora de estoque na origem
  atualizadoEm: "2026-09-08T03:00:00Z",
};


// ---------------------------------------------------------------
// 2. MOTOR DE RECOMENDAÇÃO — CÁLCULO DO SCORE DA IA
// ---------------------------------------------------------------
// O score combina 4 sinais, cada um normalizado de 0 a 1 e depois
// ponderado. Pesos são ajustáveis — os valores abaixo são um ponto
// de partida razoável pra um catálogo de afiliados.

const PESOS = {
  demanda: 0.30,     // volume de vendas recente
  avaliacao: 0.30,   // nota + confiabilidade (volume de avaliações)
  tendencia: 0.20,   // crescimento de vendas semana a semana
  precoRelativo: 0.20, // quão bom é o preço atual vs. histórico
};

function calcularScore(produto) {
  const demanda = normalizarDemanda(produto.vendas.unidadesUltimos7Dias);
  const avaliacao = normalizarAvaliacao(
    produto.avaliacao.nota,
    produto.avaliacao.numeroAvaliacoes
  );
  const tendencia = calcularTendencia(
    produto.vendas.unidadesUltimos7Dias,
    produto.vendas.unidadesSemanaAnterior
  );
  const precoRelativo = calcularPrecoRelativo(produto.preco);

  const score =
    demanda * PESOS.demanda +
    avaliacao * PESOS.avaliacao +
    tendencia * PESOS.tendencia +
    precoRelativo * PESOS.precoRelativo;

  return Math.round(score * 1000) / 1000; // 0.000 a 1.000
}

// Demanda: normaliza vendas recentes numa escala 0–1 usando
// log para não deixar poucos produtos "gigantes" dominarem o ranking.
function normalizarDemanda(unidadesUltimos7Dias) {
  const TETO_ESPERADO = 2000; // ajustar com base na distribuição real do catálogo
  const valor = Math.log10(unidadesUltimos7Dias + 1) / Math.log10(TETO_ESPERADO + 1);
  return Math.min(valor, 1);
}

// Avaliação: nota pesa mais quando tem volume suficiente de avaliações
// (evita que um produto com nota 5.0 e 3 avaliações fique no topo).
function normalizarAvaliacao(nota, numeroAvaliacoes) {
  const notaNormalizada = nota / 5;
  const confianca = Math.min(numeroAvaliacoes / 500, 1); // satura em 500 avaliações
  return notaNormalizada * (0.5 + 0.5 * confianca);
}

// Tendência: cresceu, ficou estável ou caiu vs. semana anterior.
function calcularTendencia(atual, anterior) {
  if (anterior === 0) return 0.5; // produto novo, sem histórico — neutro
  const variacao = (atual - anterior) / anterior;
  // mapeia variação de -50% a +100% para uma escala 0–1
  const normalizado = (variacao + 0.5) / 1.5;
  return Math.max(0, Math.min(normalizado, 1));
}

// Preço relativo: compara o preço atual com o histórico dos últimos
// 30 dias — quanto mais abaixo da média, maior o score.
function calcularPrecoRelativo(preco) {
  const historico30d = preco.historico.slice(-30);
  const media = historico30d.reduce((soma, p) => soma + p.valor, 0) / historico30d.length;
  if (media === 0) return 0.5;
  const desconto = (media - preco.atual) / media; // positivo = mais barato que a média
  return Math.max(0, Math.min(0.5 + desconto * 2, 1));
}


// ---------------------------------------------------------------
// 3. REGRAS DE BADGES
// ---------------------------------------------------------------
// Badges são derivados de regras simples e verificáveis — o mesmo
// texto que aparece nos cards das páginas (home, categoria, produto).
// Importante: badges não usam a comissão como critério, só dado
// objetivo de preço/venda/avaliação (mantém a promessa de
// transparência da seção "Por que confiar").

function calcularBadges(produto) {
  const badges = [];

  const historico60d = produto.preco.historico.slice(-60);
  const menorPreco60d = Math.min(...historico60d.map((p) => p.valor));
  if (produto.preco.atual <= menorPreco60d) {
    badges.push("Menor preço em 60 dias");
  }

  const descontoAtual =
    (produto.preco.original - produto.preco.atual) / produto.preco.original;
  if (descontoAtual >= 0.10) {
    badges.push("Queda de preço");
  }

  const crescimento =
    (produto.vendas.unidadesUltimos7Dias - produto.vendas.unidadesSemanaAnterior) /
    Math.max(produto.vendas.unidadesSemanaAnterior, 1);
  if (crescimento >= 0.30) {
    badges.push("Em alta esta semana");
  }

  const score = calcularScore(produto);
  if (score >= 0.80) {
    badges.push("Escolha da IA");
  }

  return badges;
}


// ---------------------------------------------------------------
// 4. RE-RANKING DIÁRIO DO CATÁLOGO
// ---------------------------------------------------------------
// Roda 1x por dia (cron job) depois da importação/atualização de
// preços das lojas parceiras. Produz o catálogo já ordenado e com
// badges, pronto pra alimentar home/categoria/produto.

function reordenarCatalogo(produtos) {
  return produtos
    .filter((p) => p.ativo)
    .map((p) => ({
      ...p,
      score: calcularScore(p),
      badges: calcularBadges(p),
    }))
    .sort((a, b) => b.score - a.score);
}

// Exemplo de uso:
// const catalogoOrdenado = reordenarCatalogo(catalogoBruto);
// catalogoOrdenado.slice(0, 12) -> seção "Selecionados pela IA hoje" da home
