/**
 * ShopFinder AI — Pipeline de importação do catálogo
 * ------------------------------------------------------------
 * Este arquivo define como os dados chegam das lojas parceiras
 * até o schema normalizado (ver shopfinder-ai-motor-recomendacao.js)
 * que alimenta o site e o motor de recomendação.
 *
 * Fluxo geral:
 *
 *   [Lojas parceiras] -> [Conectores] -> [Normalizador] ->
 *   [Catálogo bruto] -> [Motor de recomendação] -> [Catálogo publicado]
 *
 * Roda em cron job (recomendado: 1x por dia, de madrugada).
 */

// ---------------------------------------------------------------
// 1. ESTRATÉGIA POR LOJA
// ---------------------------------------------------------------
// Cada loja parceira tem uma forma diferente de acesso. Prioridade:
// sempre API oficial de afiliados > feed de dados > scraping.
// Scraping só como último recurso, e apenas onde os termos de uso
// do programa de afiliados permitem.

const ESTRATEGIA_POR_LOJA = {
  amazon: {
    metodo: "api",
    fonte: "Amazon Product Advertising API (via Amazon Associates)",
    frequenciaRecomendada: "diária",
    ativo: true,
    observacao:
      "Requer conta aprovada no Amazon Associates. Retorna preço, avaliação, imagens e disponibilidade oficialmente.",
  },
  mercadoLivre: {
    metodo: "api",
    fonte: "API pública do Mercado Livre + Mercado Livre Afiliados",
    frequenciaRecomendada: "diária",
    ativo: true,
    observacao: "Tem endpoint de busca/itens sem necessidade de scraping.",
  },
  magalu: {
    metodo: "feed",
    fonte: "Feed de produtos do programa de afiliados (Magalu Parceiro)",
    frequenciaRecomendada: "diária",
    ativo: true,
    observacao: "Geralmente disponibilizado como XML/CSV atualizado periodicamente.",
  },
  shopee: {
    metodo: "api",
    fonte: "Shopee Affiliate Open API",
    frequenciaRecomendada: "diária",
    ativo: true,
    observacao: "Requer aprovação como afiliado Shopee.",
  },
  aliExpress: {
    metodo: "api",
    fonte: "AliExpress Affiliate API (Portals)",
    frequenciaRecomendada: "diária",
    ativo: true,
    observacao: "Bom para categorias de nicho e preço baixo.",
  },
  shein: {
    metodo: "api",
    fonte: "SHEIN Affiliate Program (portal próprio de afiliados)",
    frequenciaRecomendada: "diária",
    ativo: false, // moda/acessórios não é o nicho inicial (eletroportáteis) —
                   // ativar junto com o segundo nicho (Fase 3 da estratégia de crescimento)
    observacao:
      "Programa de afiliados próprio, fora das redes agregadoras. Forte em moda/acessórios — deixar configurado e desligado até o site abrir a categoria de moda.",
  },
  tiktokShop: {
    metodo: "api",
    fonte: "TikTok Shop Affiliate/Partner API",
    frequenciaRecomendada: "diária",
    ativo: true, // TikTok Shop vende eletroportáteis também — cabe no nicho atual,
                  // e se conecta direto com a distribuição via vídeo curto da
                  // estratégia de tráfego (cortes de guias de compra)
    observacao:
      "Comissão definida por cada vendedor dentro do TikTok Shop (varia por produto, não por loja inteira).",
  },
};


// ---------------------------------------------------------------
// 2. CONECTOR (INTERFACE COMUM)
// ---------------------------------------------------------------
// Cada loja implementa essa mesma interface. Assim o restante do
// pipeline não precisa saber os detalhes de cada API.

/**
 * @typedef {Object} ProdutoBruto
 * Formato "cru" que cada conector devolve, ainda não normalizado.
 */

class ConectorLoja {
  constructor(nomeLoja, chaveEstrategia) {
    this.nomeLoja = nomeLoja;
    this.chaveEstrategia = chaveEstrategia; // chave em ESTRATEGIA_POR_LOJA (ex: "mercadoLivre")
  }

  // Cada conector real sobrescreve este método.
  async buscarProdutos(categoria) {
    throw new Error(`buscarProdutos não implementado para ${this.nomeLoja}`);
  }
}

// Exemplo de conector real (estrutura — a chamada de API muda por loja)
class ConectorMercadoLivre extends ConectorLoja {
  constructor(credenciais) {
    super("Mercado Livre", "mercadoLivre");
    this.credenciais = credenciais;
  }

  async buscarProdutos(categoria) {
    const resposta = await fetch(
      `https://api.mercadolibre.com/sites/MLB/search?category=${categoria}&sort=sold_quantity_desc`,
      { headers: { Authorization: `Bearer ${this.credenciais.token}` } }
    );
    const dados = await resposta.json();
    return dados.results; // formato bruto da API do Mercado Livre
  }
}

// Os demais conectores (Amazon, Magalu, Shopee, AliExpress) seguem
// a mesma ideia: uma classe por loja, cada uma sabendo falar com
// sua própria API/feed.


// ---------------------------------------------------------------
// 3. NORMALIZADOR
// ---------------------------------------------------------------
// Transforma o formato bruto de cada loja no schema único do
// catálogo (visto em shopfinder-ai-motor-recomendacao.js).
// Cada loja tem seu próprio normalizador porque os campos de origem
// são diferentes; a saída é sempre igual.

function normalizarProdutoMercadoLivre(bruto, historicoAnterior = []) {
  return {
    id: `ml-${bruto.id}`,
    nome: bruto.title,
    categoria: bruto.category_id,
    subcategoria: null,

    loja: {
      nome: "Mercado Livre",
      idProdutoNaLoja: bruto.id,
      urlAfiliado: gerarLinkAfiliado("mercadoLivre", bruto.permalink),
      frete: {
        valor: bruto.shipping?.free_shipping ? 0 : null,
        gratisAcimaDe: null,
      },
      prazoEntregaDias: null,
    },

    preco: {
      atual: bruto.price,
      original: bruto.original_price ?? bruto.price,
      moeda: bruto.currency_id,
      historico: [...historicoAnterior, { data: hoje(), valor: bruto.price }].slice(-90),
    },

    avaliacao: {
      nota: bruto.reviews?.rating_average ?? null,
      numeroAvaliacoes: bruto.reviews?.total ?? 0,
    },

    vendas: {
      unidadesUltimos7Dias: null, // Mercado Livre não expõe isso diretamente —
      unidadesSemanaAnterior: null, // ver seção 5 (dados que precisam de estimativa)
    },

    comissao: { percentual: null }, // vem do contrato de afiliados, não da API de busca

    imagens: bruto.thumbnail ? [bruto.thumbnail] : [],
    ativo: bruto.available_quantity > 0,
    atualizadoEm: new Date().toISOString(),
  };
}

function gerarLinkAfiliado(loja, urlOriginal) {
  const TAGS_AFILIADO = {
    mercadoLivre: "shopfinder_ml",
    amazon: "shopfinder-20",
    magalu: "shopfinder_magalu",
    shopee: "shopfinder_shopee",
    aliExpress: "shopfinder_ali",
    shein: "shopfinder_shein",
    tiktokShop: "shopfinder_tiktok",
  };
  const separador = urlOriginal.includes("?") ? "&" : "?";
  return `${urlOriginal}${separador}ref=${TAGS_AFILIADO[loja]}`;
}

function hoje() {
  return new Date().toISOString().slice(0, 10);
}


// ---------------------------------------------------------------
// 4. ORQUESTRAÇÃO DIÁRIA
// ---------------------------------------------------------------

async function rodarImportacaoDiaria(conectores, catalogoAnterior) {
  const catalogoBruto = [];

  for (const conector of conectores) {
    const config = ESTRATEGIA_POR_LOJA[conector.chaveEstrategia];
    if (config && config.ativo === false) {
      continue; // loja configurada mas desligada (ex: Shein até abrir o nicho de moda)
    }

    try {
      const categoriasAcompanhadas = ["cozinha", "eletronicos", "casa", "moveis"];
      for (const categoria of categoriasAcompanhadas) {
        const produtosBrutos = await conector.buscarProdutos(categoria);
        catalogoBruto.push(
          ...produtosBrutos.map((p) => normalizar(conector.nomeLoja, p, catalogoAnterior))
        );
      }
    } catch (erro) {
      // Uma loja falhar não pode derrubar a importação inteira.
      console.error(`Falha ao importar de ${conector.nomeLoja}:`, erro.message);
    }
  }

  return catalogoBruto;
  // Próximo passo: reordenarCatalogo(catalogoBruto) — ver
  // shopfinder-ai-motor-recomendacao.js
}

function normalizar(nomeLoja, produtoBruto, catalogoAnterior) {
  const anterior = catalogoAnterior.find((p) => p.loja.idProdutoNaLoja === produtoBruto.id);
  const historicoAnterior = anterior?.preco.historico ?? [];

  switch (nomeLoja) {
    case "Mercado Livre":
      return normalizarProdutoMercadoLivre(produtoBruto, historicoAnterior);
    // case "Amazon": return normalizarProdutoAmazon(...)
    // case "Magalu": return normalizarProdutoMagalu(...)
    // case "Shopee": return normalizarProdutoShopee(...)
    // case "AliExpress": return normalizarProdutoAliExpress(...)
    default:
      throw new Error(`Normalizador não implementado para ${nomeLoja}`);
  }
}


// ---------------------------------------------------------------
// 5. DADOS QUE PRECISAM DE ESTIMATIVA (nem toda API expõe tudo)
// ---------------------------------------------------------------
// "unidadesUltimos7Dias" é usado no motor de recomendação, mas
// poucas APIs de afiliados expõem volume de vendas diretamente.
// Alternativas, da mais confiável pra mais aproximada:
//
//   1) Programas que expõem "sold_quantity" acumulado — calcular a
//      diferença entre duas leituras (hoje vs. 7 dias atrás).
//   2) Ranking de "mais vendidos" da categoria como proxy de posição
//      (loja retorna produtos ordenados por venda, mesmo sem número).
//   3) Cliques no próprio link de afiliado do ShopFinder AI como sinal
//      complementar (dado que a plataforma já possui, ver item 3
//      da lista de próximos passos: painel administrativo).
//
// Recomendação: começar com (1) onde disponível e (3) como reforço —
// não depender de scraping de "unidades vendidas" quando a loja não
// expõe isso oficialmente.


// ---------------------------------------------------------------
// 6. AGENDAMENTO (exemplo com cron)
// ---------------------------------------------------------------
// 0 3 * * *  -> todos os dias às 3h da manhã
//
// const cron = require("node-cron");
// cron.schedule("0 3 * * *", async () => {
//   const catalogoBruto = await rodarImportacaoDiaria(conectores, catalogoAnterior);
//   const catalogoPublicado = reordenarCatalogo(catalogoBruto); // do motor de recomendação
//   await salvarCatalogo(catalogoPublicado);
// });
