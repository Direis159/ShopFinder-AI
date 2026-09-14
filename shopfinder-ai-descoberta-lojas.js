/**
 * ShopFinder AI — Agente de descoberta de lojas afiliadas
 * ------------------------------------------------------------
 * Até aqui o pipeline (shopfinder-ai-pipeline-importacao.js) trabalha
 * com uma lista FIXA de 5 lojas (Amazon, Mercado Livre, Shopee,
 * AliExpress, Magalu). Este agente resolve o problema de expandir
 * pra "qualquer loja" sem precisar integrar uma por uma manualmente.
 *
 * IMPORTANTE — o que a IA pode e não pode automatizar aqui:
 *   - PODE: encontrar, avaliar e ranquear programas de afiliados
 *     relevantes pro catálogo, e preparar a integração técnica.
 *   - NÃO PODE: se inscrever sozinha em programas de afiliados —
 *     isso normalmente exige aprovação manual da loja/rede (CNPJ,
 *     análise de site, aceite de termos). Esse passo continua
 *     humano. O agente elimina o trabalho de garimpar e avaliar
 *     candidatos, não o de assinar contrato.
 *
 * Dois caminhos pra cobrir "qualquer loja":
 *
 *   Caminho A — Redes de afiliados agregadoras (recomendado)
 *     Uma rede como Awin, Rakuten Advertising, Admitad ou Lomadee
 *     já reúne centenas/milhares de lojas sob UM contrato e UMA API.
 *     Em vez de integrar loja por loja, você integra a rede uma vez
 *     e ganha acesso a todo o catálogo de lojas participantes dela.
 *     Isso é o que de fato torna "qualquer loja" viável na prática.
 *
 *   Caminho B — Loja específica fora de qualquer rede
 *     Quando alguém pede uma loja pontual que não está em nenhuma
 *     rede agregadora, a IA pesquisa se essa loja tem programa de
 *     afiliados próprio e prepara um resumo pra decisão humana.
 */


// ---------------------------------------------------------------
// CAMINHO A — DESCOBERTA VIA REDE DE AFILIADOS AGREGADORA
// ---------------------------------------------------------------

// Interface comum pra qualquer rede agregadora (Awin, Admitad,
// Rakuten, Lomadee...). Cada rede real implementa esses métodos
// com sua própria API de "programas" (advertisers/merchants).
class RedeAfiliados {
  constructor(nomeRede, credenciais) {
    this.nomeRede = nomeRede;
    this.credenciais = credenciais;
  }

  // Lista lojas (merchants/advertisers) disponíveis na rede,
  // opcionalmente filtradas por categoria.
  async listarLojasDisponiveis(categoria) {
    throw new Error(`listarLojasDisponiveis não implementado para ${this.nomeRede}`);
  }
}

// Exemplo de implementação (estrutura — endpoint real muda por rede)
class RedeAwin extends RedeAfiliados {
  constructor(credenciais) {
    super("Awin", credenciais);
  }

  async listarLojasDisponiveis(categoria) {
    const resposta = await fetch(
      `https://api.awin.com/publishers/${this.credenciais.publisherId}/programmes?relationship=joined&category=${categoria}`,
      { headers: { Authorization: `Bearer ${this.credenciais.token}` } }
    );
    const dados = await resposta.json();
    return dados; // lista bruta de programas da Awin
  }
}

// A IA entra aqui: dado o volume de lojas que uma rede agregadora
// devolve (podem ser centenas), a avaliação de "vale a pena integrar"
// é o que não dá pra fazer só com filtro numérico.
async function avaliarLojaComIA(loja) {
  const promptSistema =
    "Você avalia se vale a pena um marketplace de curadoria de ofertas " +
    "(brasileiro, focado em produtos físicos de consumo) integrar uma " +
    "loja parceira de um programa de afiliados. Responda em JSON com: " +
    '{"relevante": true/false, "motivo": "...", "prioridade": "alta/media/baixa"}.';

  const promptUsuario = `
Nome da loja: ${loja.nome}
Categoria declarada: ${loja.categoria}
Comissão média: ${loja.comissaoMedia}%
Duração do cookie: ${loja.duracaoCookieDias} dias
Tem feed de produtos automatizado: ${loja.temFeedProdutos ? "sim" : "não"}
Nota/reputação na rede (se disponível): ${loja.reputacaoRede ?? "não informado"}
`;

  const resposta = await chamarIA(promptSistema, promptUsuario);
  try {
    return JSON.parse(resposta);
  } catch {
    return { relevante: false, motivo: "Resposta da IA não pôde ser interpretada", prioridade: "baixa" };
  }
}

async function chamarIA(promptSistema, promptUsuario) {
  const resposta = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 500,
      system: promptSistema,
      messages: [{ role: "user", content: promptUsuario }],
    }),
  });
  const dados = await resposta.json();
  return dados.content.map((bloco) => bloco.text || "").join("\n").trim();
}

// Função principal do Caminho A: varre uma rede agregadora por
// categoria e devolve uma lista já ranqueada de lojas candidatas.
async function descobrirLojasViaRede(rede, categorias) {
  const candidatas = [];

  for (const categoria of categorias) {
    const lojas = await rede.listarLojasDisponiveis(categoria);
    for (const loja of lojas) {
      const avaliacao = await avaliarLojaComIA(loja);
      if (avaliacao.relevante) {
        candidatas.push({ ...loja, ...avaliacao, rede: rede.nomeRede });
      }
    }
  }

  const ordemPrioridade = { alta: 3, media: 2, baixa: 1 };
  return candidatas.sort((a, b) => ordemPrioridade[b.prioridade] - ordemPrioridade[a.prioridade]);
}


// ---------------------------------------------------------------
// CAMINHO B — LOJA ESPECÍFICA FORA DE QUALQUER REDE
// ---------------------------------------------------------------
// Uso: alguém (você, ou futuramente um admin do painel) digita o
// nome/site de uma loja específica que quer avaliar. A IA pesquisa
// e devolve um resumo — a decisão de aplicar continua manual.

async function pesquisarProgramaDeAfiliados(nomeOuUrlDaLoja) {
  const promptSistema =
    "Você pesquisa se uma loja específica tem programa de afiliados " +
    "próprio (não via rede agregadora) e resume, em português, como " +
    "encontrar a página de inscrição, se existir. Se não encontrar " +
    "informação confiável, diga isso claramente em vez de supor.";

  const promptUsuario = `Loja: ${nomeOuUrlDaLoja}. Tem programa de afiliados próprio? Onde se inscrever?`;

  return chamarIA(promptSistema, promptUsuario);
  // Retorna texto pra exibição no painel administrativo, numa fila
  // de "lojas sugeridas para avaliação manual" — não integra sozinho.
}


// ---------------------------------------------------------------
// FILA DE APROVAÇÃO (humano no circuito)
// ---------------------------------------------------------------
// Tanto o Caminho A quanto o B alimentam a mesma fila. Isso vira
// uma seção nova no painel administrativo: "Lojas sugeridas".

function adicionarNaFilaDeAprovacao(filaAtual, lojaCandidata) {
  return [
    ...filaAtual,
    {
      nome: lojaCandidata.nome,
      origem: lojaCandidata.rede ?? "pesquisa direta",
      motivo: lojaCandidata.motivo,
      prioridade: lojaCandidata.prioridade ?? "media",
      status: "aguardando_avaliacao_humana",
      sugeridoEm: new Date().toISOString(),
    },
  ];
}

// Quando uma loja da fila é aprovada manualmente (alguém aplicou pro
// programa e foi aceito), ela vira uma entrada nova em
// ESTRATEGIA_POR_LOJA (shopfinder-ai-pipeline-importacao.js) e passa
// a ser importada normalmente todo dia, junto com as outras.
