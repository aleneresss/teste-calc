const tabelasConfig = {
    "PARANÁ TAC": { taxa: 1.79, calcTac: (v) => aplicarAlíquotaPtac(v), calcMeta: (t) => t * 0.7825 }, 
    "PARANÁ": { taxa: 1.79, calcTac: (v) => v, calcMeta: (t) => t * 0.7825 },
    "PARANÁ SEG": { taxa: 1.79, calcTac: (v, e) => Math.max(v-(e / (100/6)), v - 600), calcMeta: (t) => t * 0.8 },
    "SENNA": { taxa: 1.8, calcTac: (v, e) => v - (e / (100/22)), calcMeta: (t) => t * 1.10 },
    "PRIME": { taxa: 1.8, calcTac: (v) => v - 70, calcMeta: (t) => t * 0.68 },
    "MONACO": { taxa: 1.8, calcTac: (v, e) => v - (e / (100/18)), calcMeta: (t) => t * 0.9 },
    "GOLD POWER": { taxa: 1.8, calcTac: (v) => v * 0.85, calcMeta: (t) => t * 0.8 },
    "LIGHT": { taxa: 1.8, calcTac: (v) => v, calcMeta: (t) => t * 0.39 }
};

const calcularTaxaAnual = (taxaMensal) => Math.pow(1 + taxaMensal, 12) - 1;
const calcularTaxaDia = (taxaAnual) => Math.pow(1 + taxaAnual, 1 / 360) - 1;

function parseDataString(dataStr) {
    const parts = dataStr.split('/').map(Number);
    return parts.length === 3 
      ? new Date(parts[2], parts[1] - 1, parts[0])
      : new Date(parts[1], parts[0], 1);
}

function calcularDesagios(datasVencimento, taxaDia) {
    const hoje = new Date();
    return datasVencimento.map(data => {
        const dias = Math.ceil((data - hoje) / (1000 * 60 * 60 * 24));
        return Math.pow(1 + taxaDia, dias);
    });
}


function capturarParcelas() {

    const inputValores = document.getElementById("parcelasInput").value;
    const tabelaSelecionada = document.getElementById("tabela").value;
    const config = tabelasConfig[tabelaSelecionada] || tabelasConfig["PARANÁ"];


    const valores = (inputValores.match(/R\$\s*\d{1,6}(?:\.\d{3})*(?:,\d{2})?/g) || [])
      .map(v => parseFloat(v.replace(/R\$|\s|\./g, '').replace(',', '.')));

    const datasVencimentoStr = inputValores.match(/(\d{2}\/\d{2}\/\d{4})|(\d{2}\/\d{4})/g) || [];
    const datasVencimento = datasVencimentoStr.map(parseDataString);

    const aliquota = [
        { min: 20000.01, max: Infinity, taxa: 0.05, adicional: 2900 },
        { min: 15000.01, max: 20000, taxa: 0.1, adicional: 1900 },
        { min: 10000.01, max: 15000, taxa: 0.15, adicional: 1150 },
        { min: 5000.01, max: 10000, taxa: 0.2, adicional: 650 },
        { min: 1000.01, max: 5000, taxa: 0.3, adicional: 150 },
        { min: 500.01, max: 1000, taxa: 0.4, adicional: 50 },
        { min: -Infinity, max: 500, taxa: 0.5, adicional: 0 },
    ];
    let saldoRestante = valores[valores.length-1]
    if (valores.length < 10 && document.getElementById("newp").checked && valores[valores.length-1] < 20) {
        for (let i = 0; i < 10; i++) {
        const regra = aliquota.find(r => saldoRestante > r.min && saldoRestante <= r.max);
        const valorParcela = saldoRestante * regra.taxa + regra.adicional;
        if (valorParcela < 0.01) break;
        valores.push(valorParcela)
        saldoRestante -= valorParcela;
        let novadata = new Date(datasVencimento[datasVencimento.length - 1]);
        novadata.setFullYear(novadata.getFullYear() + 1);
        datasVencimento.push(novadata)
        }
    }

    console.log([valores.length-1])

    if (!valores.length) {
        alert("Nenhum valor válido encontrado!");
        return;
    }


    const taxaDia = calcularTaxaDia(calcularTaxaAnual(config.taxa / 100));
    const desagios = calcularDesagios(datasVencimento, taxaDia);
    const valoresDescontados = valores.map((v, i) => v / (desagios[i] || 1));


    exibirParcelas(
        valores.slice(0, 10),
        valoresDescontados.slice(0, 10),
        datasVencimento.slice(0, 10),
        config
    );
}

function exibirParcelas(parcelas, valoresDescontados, datasVencimento, config) {
    const listaParcelas = document.getElementById("listaParcelas");
    const formatdata = datasVencimento.map(date => new Date(date).toLocaleDateString("en-GB"));
    listaParcelas.innerHTML = parcelas.map((p, i) => `
      <li>
        <span>Parcela ${i+1}: ${brl(p)} - Vencimento: ${formatdata[i] || "N/A"}</span>
        <label class="switch">
          <input type="checkbox" checked data-index="${i}">
          <span class="slider"></span>
        </label>
      </li>
    `).join('');


    document.querySelectorAll('.switch input').forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            const index = parseInt(this.dataset.index);
            document.querySelectorAll('.switch input').forEach((cb, i) => {
                cb.checked = this.checked ? (i <= index) : (i < index);
            });
            recalcularTotais(parcelas, valoresDescontados, config, datasVencimento);
        });
    });

    recalcularTotais(parcelas, valoresDescontados, config, datasVencimento);
}

function recalcularTotais(parcelas, valoresDescontados, config, datasVencimento) {
    const checkboxes = document.querySelectorAll('.switch input:checked');
    const indices = Array.from(checkboxes).map(cb => parseInt(cb.dataset.index));

    const parcelasSelecionadas = indices.map(i => parcelas[i]);
    const valoresSelecionados = indices.map(i => valoresDescontados[i]);
    const datasSelecionadas = indices.map(i => datasVencimento[i]);

    const totalDescontado = valoresSelecionados.reduce((a, b) => a + b, 0);


    const iofTotal = valoresSelecionados.reduce((total, valor, i) => {
        const hoje = new Date();
        const dataVenc = datasSelecionadas[i];
        const dias = Math.ceil((dataVenc - hoje) / (1000 * 60 * 60 * 24));

        const limitedias = Math.min(dias,365);
        const iofTotal = valor*0.0038+valor*0.000082*limitedias;

        return total + iofTotal;
    }, 0);

    const valorLiquido = totalDescontado - iofTotal;


    const tac = config.tabela === "PARANÁ" ? aplicarAlíquotaPtac(valorLiquido) : config.calcTac(valorLiquido, totalDescontado);
    console.log(config.calcTac(valorLiquido, totalDescontado))
    console.log("emissão " + totalDescontado)
    console.log("valor "+tac)
    const antecipado = parcelasSelecionadas.reduce((a, b) => a + b, 0)
    const valorMeta = config.calcMeta(tac);
    document.querySelector(".col-middle").innerHTML = `
      <h2>Resultados:</h2>
      <div class="resultado"><p>Valor meta: ${brl(valorMeta)}</p></div>
      <div class="resultado"><p>IOF total: ${brl(iofTotal)}</p></div>
      <div class="total"><p>Total antecipado: ${brl(antecipado)}</p></div>
      <div class="resultado"><p>Juros: ${brl(antecipado - tac)}</p></div>
      <div class="liberado"><p><big>Valor Liberado: <strong>${brl(tac)}</strong></big></p></div>
    `;
}


function aplicarAlíquotaPtac(valor) {
    const ptac = [
        { min: 2501.00, max: Infinity, tac: 21 },
        { min: 500.01, max: 2500.00, tac: 43/3 },
        { min: -Infinity, max: 500.00, tac: 11 },
    ];

    const faixa = ptac.find(p => valor >= p.min && valor <= p.max);


    return valor - valor / faixa.tac;
}



function brl(float) {
        let brl = float.toLocaleString('pt-br',{style: 'currency', currency: 'brl'});
        return brl
}
