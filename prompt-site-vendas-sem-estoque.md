# Prompt Master: O Melhor Site de Vendas por Afiliados (Sem Estoque)

Use este prompt em ferramentas de geração de sites/apps (Lovable, v0, Bolt, Claude, etc.) ou como briefing completo para um time de desenvolvimento.

---

## Prompt

Crie um site de e-commerce por afiliados (sem estoque próprio) que compita de igual para igual com marketplaces grandes em experiência de uso — não deve parecer um site genérico de dropshipping, e sim uma plataforma de descoberta de produtos com curadoria por IA.

### 1. Conceito e diferencial competitivo
- O site agrega os produtos mais vendidos de grandes lojas parceiras (Amazon, Mercado Livre, Shopee, AliExpress, Magalu) e direciona a compra via link de afiliado.
- Não há estoque físico. Receita = comissão por venda.
- Diferencial: em vez de só listar produtos, o site funciona como um "curador inteligente" — a IA (ShopFinder AI) explica *por que* aquele produto é uma boa escolha (comparação de preço entre lojas, histórico de preço, nota real, alerta de "está em alta"), algo que Amazon/Shopee isoladas não oferecem.
- Posicionamento: "compare, descubra e compre pelo melhor preço, com curadoria de IA" — não "loja de tudo", e sim especialista em achar as melhores ofertas.

### 2. Motor de curadoria inteligente ("ShopFinder AI")
- Score de recomendação combinando: demanda/volume de vendas, nota e volume de avaliações, margem de comissão, tendência de crescimento, histórico de preço (para identificar promoções reais vs. falsas).
- Re-ranking automático (diário) do catálogo e das seções de destaque.
- Badges automáticos gerados pela IA: "Melhor custo-benefício", "Em alta esta semana", "Menor preço em 30 dias", "Escolha da IA".
- Comparador de preço entre lojas para o mesmo produto (ou produto equivalente), mostrando onde compensa mais comprar.

### 3. Estrutura do site
- **Home**: hero com proposta de valor clara, barra de busca em destaque, categorias visuais, seção "Selecionados pela IA hoje", "Mais vendidos", "Ofertas em queda de preço", prova social agregada (nº de produtos analisados, avaliações consolidadas).
- **Categoria**: grid com filtros avançados (preço, nota, loja de origem, frete grátis, desconto), ordenação (relevância IA, menor preço, mais vendidos), paginação infinita.
- **Produto**: galeria de imagens, título, preço, histórico de preço (gráfico simples), nota + nº de avaliações, selo da loja de origem, explicação da IA sobre por que recomenda (ou alerta se não recomenda), botão "Ver oferta" com redirecionamento rastreado, produtos relacionados/alternativos de outras lojas.
- **Busca inteligente**: sugestões em tempo real, correção de digitação, busca por linguagem natural ("fone bluetooth barato boa bateria").
- **Página "Como funciona"**: transparência total sobre o modelo de afiliados.
- **Blog/guias de compra** (opcional, forte para SEO): "Melhores X para Y", gerado a partir da curadoria da IA — traz tráfego orgânico sem depender de anúncio pago.

### 4. Experiência do usuário (o que separa um site bom de "o melhor site")
- Performance: carregamento abaixo de 2s, imagens otimizadas/lazy load, mobile-first de verdade (maioria do tráfego afiliado é mobile).
- Microinterações: skeleton loading, transições suaves, feedback visual ao clicar em "Ver oferta".
- Confiança: selos de segurança, política de transparência de afiliados bem visível (não escondida no rodapé), avaliações reais agregadas.
- Personalização: recomendações baseadas em navegação (mesmo sem login), histórico de categorias vistas.
- Zero fricção: nenhum cadastro obrigatório para navegar ou comparar; cadastro opcional só para salvar favoritos/alertas de preço.
- Alerta de preço: usuário pode "seguir" um produto e receber aviso quando baixar de preço (gera recorrência de visitas).

### 5. Requisitos técnicos
- Catálogo alimentado por integração com APIs de afiliados das lojas parceiras (ou pipeline de importação/atualização automática, com fallback de scraping autorizado onde não há API).
- Sistema de tracking de cliques/conversões por link, por loja e por produto.
- Painel administrativo: produtos mais clicados, estimativa de comissão, taxa de conversão por loja, saúde do catálogo (produtos fora de estoque na origem, links quebrados).
- SEO técnico: meta tags dinâmicas, sitemap automático, dados estruturados (schema.org Product/Offer/Review), URLs limpas.
- Arquitetura pronta para escalar o catálogo (milhares de produtos) sem perder performance — paginação/indexação eficiente, CDN para imagens.

### 6. Identidade visual
- Tom profissional e confiável, nunca "genérico de dropshipping".
- Nome sugerido: ShopFinder AI (ou variações já cogitadas: MegaShop AI, VendaMax, SmartMarket AI, ShopGenius, TurboStore AI, ProfitShop).
- Paleta: azul/petróleo profundo como base (tecnologia e confiança) + um acento vibrante (ex: laranja ou verde) reservado exclusivamente para CTAs de compra, criando contraste claro sem poluir a UI.
- Tipografia moderna e legível, hierarquia visual clara entre preço, avaliação e CTA.
- Evitar clichês visuais de dropshipping (banners genéricos de estoque, contadores de urgência falsos, pop-ups agressivos) — a credibilidade da curadoria por IA é o principal ativo de marca.

### 7. Entregáveis esperados
1. Landing page / home funcional e responsiva.
2. Template de página de categoria com filtros.
3. Template de página de produto com comparador e explicação da IA.
4. Schema de dados do catálogo pronto para importação automática.
5. Pseudo-código/lógica do motor de recomendação e do sistema de badges.
6. Painel administrativo básico (métricas de cliques e conversão).

---

**Observação de transparência legal:** o site deve exibir de forma clara e visível (não só em rodapé) que participa de programas de afiliados e pode receber comissão por vendas qualificadas — exigência da maioria dos programas (ex: Amazon Associates).
