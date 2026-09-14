# ShopFinder AI — Blueprint do Projeto

Documento de referência único para levar a quem for construir o produto (dev, agência, ou você mesmo usando ferramentas de geração de código).

---

## 1. Visão geral

**O que é**: uma plataforma de curadoria de ofertas por afiliados — sem estoque próprio — que agrega os produtos mais vendidos de Amazon, Mercado Livre, Shopee, AliExpress, Magalu, Shein e TikTok Shop, e usa IA para explicar *por que* cada produto é uma boa escolha, não só listá-lo.

**Modelo de negócio**: comissão por venda através de links de afiliado. Nenhum produto passa fisicamente pela plataforma.

**Diferencial competitivo**: em vez de ser "mais uma vitrine de dropshipping", o site funciona como um comparador inteligente — mostra histórico de preço, badges explicáveis ("Escolha da IA", "Em alta", "Queda de preço") e um comparador entre lojas para o mesmo produto.

---

## 2. Arquitetura de ponta a ponta

```
[Redes de afiliados agregadoras]  [Lojas parceiras]
      │  (Awin, Admitad, etc.)         │  (APIs/feeds de afiliados)
      ▼                                ▼
[Agente de descoberta de lojas]  [Pipeline de importação]  ──► normaliza cada loja para o schema único
      │  (avalia e ranqueia            │
      │   candidatas, fila de          ▼
      │   aprovação humana)      [Agente de IA de atualização] ──► casa produtos equivalentes entre lojas,
      │                            │                                escreve a explicação da IA,
      ▼                            │                                detecta preço "riscado" inflado
[aprovado manualmente vira         ▼
 nova entrada no pipeline]   [Motor de recomendação]   ──► calcula score da IA + badges
      │
      ▼
[Catálogo publicado]
      │
      ├──► Home (selecionados pela IA, mais vendidos)
      ├──► Categoria (grid + filtros)
      └──► Produto (comparador entre lojas + explicação da IA)

[Cliques do usuário] ──► [Painel administrativo] ──► métricas de
                                                       conversão e comissão
                                                       (e reforça dados de
                                                       demanda no motor)
```

Cada peça já foi prototipada nesta conversa. Resumo do que existe e onde usar:

| Peça | Arquivo | O que resolve |
|---|---|---|
| Prompt de briefing | `prompt-site-vendas-sem-estoque.md` | Descrição completa do produto pra ferramentas de geração de site (Lovable, v0, Bolt) ou briefing pra um dev |
| Agente de descoberta de lojas | `shopfinder-ai-descoberta-lojas.js` | Encontra e avalia novas lojas/programas de afiliados além das 5 fixas, via redes agregadoras |
| Landing page | `shopfinder-ai-landing.html` | Primeira impressão, proposta de valor, seção "selecionados pela IA" |
| Página de categoria | `shopfinder-ai-categoria.html` | Navegação e filtros (preço, avaliação, loja, frete) |
| Página de produto | `shopfinder-ai-produto.html` | Comparador entre lojas + explicação da IA + histórico de preço |
| Motor de recomendação | `shopfinder-ai-motor-recomendacao.js` | Schema do produto, cálculo de score, regras de badges, re-ranking diário |
| Pipeline de importação | `shopfinder-ai-pipeline-importacao.js` | Conectores por loja, normalização, orquestração diária, agendamento |
| Agente de IA de atualização | `shopfinder-ai-agente-atualizacao.js` | Casa o mesmo produto entre lojas, gera a explicação da IA, detecta preço inflado |
| Painel administrativo | `shopfinder-ai-painel-admin.html` | Cliques, comissão estimada, saúde do catálogo, status das integrações |

---

## 3. Identidade de marca

- **Nome**: ShopFinder AI (alternativas cogitadas: MegaShop AI, VendaMax, SmartMarket AI, ShopGenius, TurboStore AI, ProfitShop).
- **Conceito visual**: "radar de preços" — a IA escaneando o mercado e travando na melhor oferta.
- **Paleta**: azul-carvão profundo (`#0F1320` / `#171C2E`) como base, dourado (`#F0A93A`) reservado para CTAs e "achado", verde (`#4ADE80`) reservado para sinais de queda de preço/economia.
- **Tipografia**: Space Grotesk (títulos), Inter (texto), JetBrains Mono (preços e dados numéricos — reforça a sensação de dado real, não decoração).
- **Tom de marca**: profissional e transparente. Evita deliberadamente clichês de dropshipping (contador de urgência falso, pop-up de saída, banners genéricos).

---

## 4. Modelo de dados (resumo)

Cada produto normalizado carrega:

- Identificação (id, nome, categoria)
- Dados da loja de origem (nome, id na loja, link de afiliado, frete, prazo)
- Preço atual + preço original + histórico diário (últimos 90 dias)
- Avaliação (nota + número de avaliações)
- Vendas recentes (últimos 7 dias vs. semana anterior — usado pra tendência)
- Comissão (percentual do programa de afiliados)
- Status (ativo/inativo)

Detalhe completo dos campos: `shopfinder-ai-motor-recomendacao.js`, seção 1.

---

## 5. Motor de recomendação (resumo)

Score da IA = combinação ponderada de:

- **Demanda** (30%) — volume de vendas recente, normalizado em escala logarítmica
- **Avaliação** (30%) — nota ponderada pela confiança (volume de avaliações)
- **Tendência** (20%) — crescimento de vendas semana a semana
- **Preço relativo** (20%) — quão abaixo da média dos últimos 30 dias está o preço atual

Badges (Escolha da IA, Em alta, Queda de preço, Menor preço em 60 dias) são derivados de regras objetivas — nunca da comissão paga pela loja. Isso é o que sustenta a promessa de transparência feita na seção "Por que confiar" do site.

Lógica completa: `shopfinder-ai-motor-recomendacao.js`, seções 2 e 3.

---

## 6. Agente de descoberta de lojas afiliadas (resumo)

Resolve o problema de expandir além das 5 lojas fixas do pipeline, sem precisar integrar uma por uma manualmente. Dois caminhos:

- **Redes de afiliados agregadoras** (Awin, Rakuten Advertising, Admitad, Lomadee) — cada rede já reúne centenas/milhares de lojas sob um único contrato e uma única API. Integrar a rede uma vez dá acesso a todo o catálogo de lojas participantes. É o caminho recomendado pra escalar "qualquer loja" de verdade.
- **Loja específica fora de qualquer rede** — a IA pesquisa se ela tem programa de afiliados próprio e resume como se inscrever.

Em ambos os casos, a IA **avalia e ranqueia** candidatas (comissão, duração de cookie, disponibilidade de feed de produtos, relevância pro catálogo) — mas **não se inscreve sozinha** em nenhum programa. Inscrição normalmente exige aprovação manual (CNPJ, análise do site, aceite de termos). Toda loja candidata cai numa fila de aprovação humana; só depois de aprovada manualmente ela vira uma nova entrada em `ESTRATEGIA_POR_LOJA` no pipeline de importação.

Lógica completa: `shopfinder-ai-descoberta-lojas.js`.

---

## 7. Agente de IA de atualização (resumo)

Entra entre o pipeline de importação e o motor de recomendação, resolvendo três tarefas que regra fixa não cobre bem:

- **Casamento de produtos entre lojas** — identifica quando Amazon e Magalu, por exemplo, estão vendendo o mesmo item com nomes diferentes. Pré-filtra candidatos por texto (sem custo de IA) e só usa IA pra confirmar os casos ambíguos. É o que alimenta de fato a tabela "Compare entre lojas" da página de produto.
- **Geração da explicação da IA** — escreve o texto do "ai-box" ("Por que o ShopFinder AI recomenda") a partir dos dados reais do produto, sem inventar informação que não foi fornecida.
- **Detecção de preço "riscado" inflado** — se o "preço original" declarado por uma loja nunca foi de fato praticado nos últimos 90 dias, remove o badge de desconto mesmo que a regra numérica simples indicasse queda de preço. Regra determinística, sem custo de IA.

**Custo e frequência**: casamento de produto só roda quando o produto é novo no catálogo; explicação da IA só é regerada quando o score muda de faixa ou a cada 7 dias — chamar IA por produto todo dia num catálogo de milhares de itens não compensa.

Lógica completa: `shopfinder-ai-agente-atualizacao.js`.

---

## 8. Pipeline de importação (resumo)

- **Prioridade de acesso por loja**: API oficial de afiliados > feed de dados > scraping (só como último recurso e respeitando os termos de cada programa).
- **Amazon**: Product Advertising API. **Mercado Livre**: API pública + programa de afiliados. **Magalu**: feed XML/CSV do programa de parceiros. **Shopee** e **AliExpress**: APIs de afiliados próprias. **TikTok Shop**: API de afiliados/parceiros, ativo desde a Fase 1 — vende eletroportáteis também, não é exclusivo de moda. **Shein**: programa de afiliados próprio, já configurado no pipeline mas **desligado** (`ativo: false`) até o segundo nicho (moda/acessórios) abrir na Fase 3 da estratégia de crescimento.
- Roda 1x por dia (recomendado: de madrugada), com isolamento de falha por loja — se uma integração cair, as outras continuam.
- Onde a API não expõe volume de vendas diretamente, usar como proxy: diferença de `sold_quantity` acumulado, posição no ranking de mais vendidos da categoria, ou cliques do próprio ShopFinder AI (dado do painel administrativo).

Lógica completa: `shopfinder-ai-pipeline-importacao.js`.

---

## 9. Painel administrativo (resumo)

Métricas centrais: cliques em "Ver oferta", comissão estimada, taxa de conversão clique→oferta, cliques por dia, conversão por loja, produtos mais clicados (com score da IA ao lado, para validar se o ranking bate com o comportamento real), saúde do catálogo (produtos fora de estoque na origem, links de afiliado quebrados) e status de cada integração.

---

## 10. Requisitos de transparência (obrigatório, não opcional)

O site deve exibir de forma visível — não escondida em rodapé — que participa de programas de afiliados e pode receber comissão por vendas qualificadas. Isso é exigência da maioria dos programas (ex: Amazon Associates) e já está incorporado na seção "Por que confiar" das páginas prototipadas.

---

## 11. Ordem sugerida de implementação

1. Fechar contratos/aprovações nos programas de afiliados de cada loja (pré-requisito para ter acesso às APIs).
2. Implementar o pipeline de importação para 1–2 lojas primeiro (recomendado: Mercado Livre + Amazon, que têm APIs mais diretas).
3. Implementar o motor de recomendação sobre esse catálogo inicial (o agente de atualização só faz sentido a partir de 2 lojas — antes disso não há o que casar entre lojas diferentes).
4. Publicar a home e a página de categoria com dados reais (ainda que com poucas lojas).
5. Adicionar o agente de IA de atualização e a página de produto com comparador assim que houver 2+ lojas no mesmo produto.
6. Ligar o painel administrativo ao tracking de cliques desde o primeiro dia — é dado que retroalimenta o motor de recomendação.
7. Assinar contrato com uma rede de afiliados agregadora (Awin, Admitad, Rakuten ou Lomadee) e ligar o agente de descoberta de lojas — esse é o passo que escala o catálogo de "5 lojas" pra "qualquer loja", sem depender de integração manual uma a uma.
