# ShopFinder AI — Site funcional (pronto pra publicar)

## O que é isto

Um site que **funciona de verdade** no navegador: busca, filtros, ordenação e comparador entre lojas — tudo lendo de `products.json`. Os 14 produtos de exemplo têm links de afiliado fictícios (`SEU-LINK-DE-AFILIADO-AQUI`), pra você ver a estrutura funcionando sem precisar de dado real ainda.

Arquivos:
- `index.html`, `categoria.html`, `produto.html` — as três páginas
- `style.css` — visual (mesmo sistema de design do projeto)
- `script.js` — toda a lógica (busca, filtro, ordenação, comparador)
- `products.json` — **o catálogo**. É o único arquivo que você precisa editar pra colocar produtos reais.

## Como testar agora, no seu computador

Não dá pra abrir os `.html` direto clicando duas vezes (o navegador bloqueia o carregamento do `products.json` por segurança). Rode um servidor local simples:

```
cd pasta-do-site
python3 -m http.server 8000
```

Depois abra `http://localhost:8000` no navegador.

## Como colocar 3 produtos reais em 5 minutos (teste rápido)

Abra `products.json` e edite um item existente:
1. Troque `nome`, `precoAtual`, `precoOriginal`, `nota`, `numeroAvaliacoes` pelos dados reais do produto.
2. Troque `urlAfiliado` pelo seu link de afiliado de verdade (o do Amazon Associates, Mercado Livre Afiliados, etc.).
3. Salve e recarregue a página — o site já reflete a mudança, sem precisar mexer em nenhum outro arquivo.

## Como colocar no ar (hospedar de verdade)

A forma mais rápida e gratuita, sem precisar de servidor próprio:

1. **Netlify** ou **Vercel** (ambos têm plano gratuito): crie uma conta, arraste a pasta do site pro painel — pronto, você recebe uma URL pública (ex: `shopfinder-ai.netlify.app`).
2. **GitHub Pages**: suba a pasta num repositório GitHub e ative o Pages nas configurações do repositório — também gratuito.
3. Depois, se quiser um domínio próprio (ex: `shopfinderai.com.br`), qualquer uma das duas opções acima permite conectar um domínio comprado (Registro.br, GoDaddy, etc.).

Nenhuma dessas opções precisa de conhecimento de programação além de arrastar a pasta.

## O que fazer antes da primeira venda de verdade

1. **Aplicar para os programas de afiliados** (Amazon Associates, Mercado Livre Afiliados, Magalu Parceiro, Shopee Affiliate, TikTok Shop) — isso é aprovação manual de cada loja, não tem como pular essa etapa.
2. **Trocar os 14 produtos de exemplo por produtos reais** com os links de afiliado aprovados.
3. **Publicar o site** (Netlify/Vercel/GitHub Pages, acima).
4. Só depois disso, os cliques em "Ver oferta" já geram comissão de verdade.

## O que ainda é manual (não automatizado ainda)

Este site já funciona sozinho no navegador, mas o **catálogo ainda é editado à mão** no `products.json`. Os arquivos que automatizam isso (buscar produto automaticamente, calcular score, gerar badge, escrever explicação da IA) já foram desenhados no projeto:

- `shopfinder-ai-pipeline-importacao.js` — busca produtos das lojas automaticamente
- `shopfinder-ai-motor-recomendacao.js` — calcula score e badges automaticamente
- `shopfinder-ai-agente-atualizacao.js` — casa produtos entre lojas e escreve a explicação da IA automaticamente

A saída desses três, no formato certo, é literalmente o que substitui o `products.json` manual por um catálogo que se atualiza sozinho todo dia. Isso é trabalho de programação (integrar com as APIs reais de cada loja) — o `products.json` manual é o que te permite **já começar a vender manualmente enquanto isso não está pronto**.
