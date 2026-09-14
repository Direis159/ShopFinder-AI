// ShopFinder AI — lógica do site
// Carrega products.json (o catálogo) e renderiza cada página.
// Trocar products.json pela saída real do pipeline de importação
// (ver shopfinder-ai-pipeline-importacao.js) é o que liga o site
// a dados de verdade, sem precisar mexer neste arquivo.

async function carregarCatalogo() {
  const resposta = await fetch("products.json");
  return resposta.json();
}

function formatarPreco(valor) {
  return "R$ " + valor.toFixed(2).replace(".", ",");
}

function cardHTML(produto) {
  const badgesHTML = produto.badges
    .map((b) => {
      const classe = b.includes("Queda") || b.includes("Menor preço") ? "drop" : "trend";
      return `<span class="tag ${classe}">${b}</span>`;
    })
    .join("");

  const wasHTML =
    produto.precoOriginal > produto.precoAtual
      ? `<span class="was">${formatarPreco(produto.precoOriginal)}</span>`
      : "";

  return `
    <a class="card" href="produto.html?id=${produto.id}">
      <div class="thumb">${produto.imagemEmoji}</div>
      ${badgesHTML}
      <p class="store">${produto.loja}</p>
      <h4>${produto.nome}</h4>
      <div class="price-row">
        <span class="price">${formatarPreco(produto.precoAtual)}</span>
        ${wasHTML}
      </div>
      <p class="rating">${produto.nota} · ${produto.numeroAvaliacoes.toLocaleString("pt-BR")} avaliações</p>
      <span class="cta">Ver oferta</span>
    </a>
  `;
}

function irParaBusca(inputEl) {
  const termo = inputEl.value.trim();
  const destino = termo
    ? `categoria.html?busca=${encodeURIComponent(termo)}`
    : "categoria.html";
  window.location.href = destino;
}

// ---------------------------------------------------------------
// HOME
// ---------------------------------------------------------------
async function renderHome() {
  const produtos = await carregarCatalogo();

  const selecionadosIA = [...produtos].sort((a, b) => b.score - a.score).slice(0, 4);
  const maisVendidos = [...produtos]
    .sort((a, b) => b.numeroAvaliacoes - a.numeroAvaliacoes)
    .slice(0, 4);

  document.getElementById("grid-selecionados-ia").innerHTML = selecionadosIA.map(cardHTML).join("");
  document.getElementById("grid-mais-vendidos").innerHTML = maisVendidos.map(cardHTML).join("");
}

// ---------------------------------------------------------------
// CATEGORIA
// ---------------------------------------------------------------
let CATALOGO_CATEGORIA = [];
let ESTADO_FILTRO = { categoria: null, lojas: new Set(), notaMin: 0, ordenar: "ia", busca: "" };

async function renderCategoria() {
  CATALOGO_CATEGORIA = await carregarCatalogo();

  const params = new URLSearchParams(window.location.search);
  ESTADO_FILTRO.categoria = params.get("cat");
  ESTADO_FILTRO.busca = params.get("busca") || "";

  const tituloEl = document.getElementById("categoria-titulo");
  if (ESTADO_FILTRO.busca) {
    tituloEl.textContent = `Resultados para "${ESTADO_FILTRO.busca}"`;
  } else if (ESTADO_FILTRO.categoria) {
    tituloEl.textContent = capitalizar(ESTADO_FILTRO.categoria);
  } else {
    tituloEl.textContent = "Todos os produtos";
  }

  const lojasDisponiveis = [...new Set(CATALOGO_CATEGORIA.map((p) => p.loja))];
  document.getElementById("filtro-lojas").innerHTML = lojasDisponiveis
    .map(
      (loja) => `
      <label class="filter-option">
        <input type="checkbox" value="${loja}" onchange="alternarLoja('${loja}')">
        ${loja}
      </label>`
    )
    .join("");

  document.querySelectorAll(".chip[data-sort]").forEach((el) => {
    el.addEventListener("click", () => {
      document.querySelectorAll(".chip[data-sort]").forEach((c) => c.classList.remove("active"));
      el.classList.add("active");
      ESTADO_FILTRO.ordenar = el.dataset.sort;
      aplicarFiltros();
    });
  });

  document.querySelectorAll("input[name='nota']").forEach((el) => {
    el.addEventListener("change", () => {
      ESTADO_FILTRO.notaMin = parseFloat(el.value) || 0;
      aplicarFiltros();
    });
  });

  aplicarFiltros();
}

function alternarLoja(loja) {
  if (ESTADO_FILTRO.lojas.has(loja)) ESTADO_FILTRO.lojas.delete(loja);
  else ESTADO_FILTRO.lojas.add(loja);
  aplicarFiltros();
}

function limparFiltros() {
  ESTADO_FILTRO.lojas.clear();
  ESTADO_FILTRO.notaMin = 0;
  ESTADO_FILTRO.busca = "";
  document.querySelectorAll("#filtro-lojas input").forEach((el) => (el.checked = false));
  document.querySelectorAll("input[name='nota']").forEach((el) => (el.checked = false));
  aplicarFiltros();
}

function aplicarFiltros() {
  let lista = [...CATALOGO_CATEGORIA];

  if (ESTADO_FILTRO.busca) {
    const termo = ESTADO_FILTRO.busca.toLowerCase();
    lista = lista.filter((p) => p.nome.toLowerCase().includes(termo));
  } else if (ESTADO_FILTRO.categoria) {
    lista = lista.filter((p) => p.categoria === ESTADO_FILTRO.categoria);
  }

  if (ESTADO_FILTRO.lojas.size > 0) {
    lista = lista.filter((p) => ESTADO_FILTRO.lojas.has(p.loja));
  }

  if (ESTADO_FILTRO.notaMin > 0) {
    lista = lista.filter((p) => p.nota >= ESTADO_FILTRO.notaMin);
  }

  switch (ESTADO_FILTRO.ordenar) {
    case "preco-menor":
      lista.sort((a, b) => a.precoAtual - b.precoAtual);
      break;
    case "vendidos":
      lista.sort((a, b) => b.numeroAvaliacoes - a.numeroAvaliacoes);
      break;
    case "avaliados":
      lista.sort((a, b) => b.nota - a.nota);
      break;
    default:
      lista.sort((a, b) => b.score - a.score);
  }

  const grid = document.getElementById("grid-produtos");
  const contagem = document.getElementById("result-count");
  contagem.textContent = `${lista.length} produto${lista.length === 1 ? "" : "s"}`;

  grid.innerHTML = lista.length
    ? lista.map(cardHTML).join("")
    : `<div class="empty-state">Nenhum produto encontrado com esses filtros.</div>`;
}

function capitalizar(texto) {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

// ---------------------------------------------------------------
// PRODUTO
// ---------------------------------------------------------------
async function renderProduto() {
  const produtos = await carregarCatalogo();
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");
  const produto = produtos.find((p) => p.id === id);

  if (!produto) {
    document.getElementById("produto-container").innerHTML =
      `<div class="empty-state">Produto não encontrado. <a href="categoria.html" style="color:var(--gold)">Voltar ao catálogo</a></div>`;
    return;
  }

  document.title = `${produto.nome} — ShopFinder AI`;

  const desconto =
    produto.precoOriginal > produto.precoAtual
      ? Math.round(((produto.precoOriginal - produto.precoAtual) / produto.precoOriginal) * 100)
      : 0;

  document.getElementById("produto-container").innerHTML = `
    <p class="breadcrumb"><a href="index.html">Início</a> / <a href="categoria.html?cat=${produto.categoria}">${capitalizar(produto.categoria)}</a></p>

    <div class="product-layout">
      <div>
        <div class="gallery-main">${produto.imagemEmoji}</div>
      </div>
      <div>
        <div class="store-row">Vendido por <strong style="color:var(--text)">${produto.loja}</strong></div>
        <h1 style="font-size:26px; margin-top:10px;">${produto.nome}</h1>
        <div class="rating-row"><span class="stars">★★★★★</span> ${produto.nota} <span style="color:var(--text-faint)">· ${produto.numeroAvaliacoes.toLocaleString("pt-BR")} avaliações</span></div>

        <div class="price-block">
          ${produto.precoOriginal > produto.precoAtual ? `<p class="was">${formatarPreco(produto.precoOriginal)}</p>` : ""}
          <p class="now">${formatarPreco(produto.precoAtual)}</p>
          ${desconto > 0 ? `<span class="save">Economia de ${desconto}%</span>` : ""}
          <a class="buy-cta" href="${produto.urlAfiliado}" target="_blank" rel="nofollow sponsored noopener">Ver oferta em ${produto.loja}</a>
          <p class="note">Você será redirecionado à loja parceira para concluir a compra.</p>
        </div>

        <div class="ai-box">
          <p class="label">Por que o ShopFinder AI recomenda</p>
          <ul>${produto.explicacaoIA.map((linha) => `<li><span class="mark">＋</span> ${linha}</li>`).join("")}</ul>
        </div>
      </div>
    </div>
  `;

  renderComparador(produto, produtos);
  renderHistorico(produto);
  renderDisclosure();
}

function renderComparador(produto, todosProdutos) {
  const secao = document.getElementById("secao-comparador");
  if (!produto.grupoEquivalente) {
    secao.style.display = "none";
    return;
  }

  const equivalentes = todosProdutos.filter((p) => p.grupoEquivalente === produto.grupoEquivalente);
  const melhor = [...equivalentes].sort((a, b) => a.precoAtual - b.precoAtual)[0];

  const linhas = equivalentes
    .map((p) => {
      const ehMelhor = p.id === melhor.id;
      return `
      <div class="compare-row ${ehMelhor ? "best" : ""}">
        <div><span class="compare-store">${p.loja}</span>${ehMelhor ? '<p class="best-tag">Melhor preço no grupo</p>' : ""}</div>
        <span class="compare-price">${formatarPreco(p.precoAtual)}</span>
        <span>${p.nota} (${p.numeroAvaliacoes.toLocaleString("pt-BR")})</span>
        <span style="font-size:13px; color:var(--text-muted);">${p.frete}</span>
        <a class="compare-btn" href="${p.urlAfiliado}" target="_blank" rel="nofollow sponsored noopener">Ver oferta</a>
      </div>`;
    })
    .join("");

  document.getElementById("comparador-tabela").innerHTML = `
    <div class="compare-row head"><span>Loja</span><span>Preço</span><span>Avaliação</span><span>Frete</span><span></span></div>
    ${linhas}
  `;
}

function renderHistorico(produto) {
  const max = Math.max(...produto.historico30d);
  const min = Math.min(...produto.historico30d);
  const menorPreco = min === produto.precoAtual;

  document.getElementById("chart-historico").innerHTML = produto.historico30d
    .map((valor) => {
      const altura = 30 + ((valor - min) / Math.max(max - min, 1)) * 70;
      const classe = valor === min ? "bar low" : "bar";
      return `<div class="${classe}" style="height:${altura}%"></div>`;
    })
    .join("");

  document.getElementById("chart-caption").textContent = menorPreco
    ? `${formatarPreco(max)} → ${formatarPreco(produto.precoAtual)} · menor preço em 30 dias`
    : `Variação nos últimos 30 dias`;
}

function renderDisclosure() {
  document.getElementById("disclosure-produto").innerHTML = `
    O ShopFinder AI participa de programas de afiliados das lojas parceiras. Ao comprar através de um link nesta página, podemos receber uma comissão, sem custo adicional para você — isso não altera o preço nem influencia a ordenação do comparador.
  `;
}
