const fetch = require('node-fetch');

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

/**
 * Analisa o comentário do cliente com IA
 * Retorna sentimento, resumo, tags e score ajustado
 */
async function analisarComentario({ comentario, notaGeral, nomeFuncionario }) {
  // Se não há comentário ou chave de API, retorna análise simples
  if (!comentario || comentario.trim().length < 3) {
    return gerarAnaliseSimples(notaGeral);
  }

  if (!ANTHROPIC_API_KEY || ANTHROPIC_API_KEY.includes('COLOQUE')) {
    console.log('⚠️  API da Anthropic não configurada. Usando análise básica.');
    return gerarAnaliseSimples(notaGeral, comentario);
  }

  try {
    const prompt = `Você é um sistema de análise de feedback de atendimento ao cliente.

Analise este feedback e responda APENAS com um JSON válido, sem markdown, sem explicações.

Dados:
- Funcionário avaliado: ${nomeFuncionario}
- Nota geral (1-5): ${notaGeral}
- Comentário do cliente: "${comentario}"

Responda com este JSON exato:
{
  "sentimento": "positivo" | "neutro" | "negativo",
  "resumo": "Uma frase curta resumindo o feedback (máx 80 chars)",
  "tags": ["tag1", "tag2", "tag3"],
  "score_ajustado": número de 1 a 10,
  "alerta": true | false,
  "motivo_alerta": "Motivo se alerta=true, senão null"
}

Regras:
- tags: escolha entre [cordialidade, agilidade, resolução, comunicação, empatia, tempo-espera, solução-eficaz, profissionalismo, simpatia, problema-não-resolvido, demora, mal-atendimento]
- score_ajustado: considere o tom do comentário além da nota numérica
- alerta: true se o feedback indicar insatisfação severa ou risco de perda do cliente`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 300,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const texto = data.content[0].text.trim();

    // Limpar possível markdown
    const jsonLimpo = texto.replace(/```json|```/g, '').trim();
    const resultado = JSON.parse(jsonLimpo);

    return {
      sentimento: resultado.sentimento || 'neutro',
      resumo_ia: resultado.resumo || '',
      tags_ia: JSON.stringify(resultado.tags || []),
      score_ia: resultado.score_ajustado || notaGeral * 2,
      alerta: resultado.alerta || false,
      motivo_alerta: resultado.motivo_alerta || null
    };

  } catch (err) {
    console.error('Erro na análise de IA:', err.message);
    return gerarAnaliseSimples(notaGeral, comentario);
  }
}

/**
 * Gera resumo executivo semanal da equipe
 */
async function gerarResumoSemanal({ totalPesquisas, mediaGeral, melhorFuncionario, piorFuncionario, topTags, alertasSemana }) {
  if (!ANTHROPIC_API_KEY || ANTHROPIC_API_KEY.includes('COLOQUE')) {
    return `Resumo automático indisponível. Configure a chave da API Anthropic no arquivo .env para ativar esta funcionalidade.`;
  }

  try {
    const prompt = `Você é um analista de RH e atendimento. Escreva um resumo executivo CONCISO (3-4 parágrafos) sobre o desempenho da equipe nesta semana.

Dados da semana:
- Total de avaliações: ${totalPesquisas}
- Média geral da equipe: ${mediaGeral}/5
- Melhor funcionário: ${melhorFuncionario}
- Funcionário com mais alertas: ${piorFuncionario || 'Nenhum'}
- Principais feedbacks: ${topTags.join(', ')}
- Alertas críticos: ${alertasSemana}

Escreva em português do Brasil, tom profissional mas acessível. Inclua: estado geral, destaques positivos, pontos de atenção e uma recomendação prática.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json();
    return data.content[0].text;

  } catch (err) {
    console.error('Erro ao gerar resumo:', err.message);
    return 'Não foi possível gerar o resumo automático. Verifique sua conexão e chave de API.';
  }
}

/**
 * Gera frase motivacional personalizada para o funcionário
 */
async function gerarFraseMotivacional({ nome, mediaAtual, tendencia, topQualidade }) {
  if (!ANTHROPIC_API_KEY || ANTHROPIC_API_KEY.includes('COLOQUE')) {
    const frases = [
      `Continue assim, ${nome}! Seu trabalho faz a diferença.`,
      `Cada atendimento é uma oportunidade de brilhar. Você está no caminho certo!`,
      `Excelência é um hábito. Continue construindo o seu!`
    ];
    return frases[Math.floor(Math.random() * frases.length)];
  }

  try {
    const prompt = `Escreva UMA frase motivacional curta e personalizada (máx 120 chars) para um atendente chamado ${nome}.
Contexto: média atual ${mediaAtual}/5, tendência ${tendencia}, ponto forte: ${topQualidade}.
Seja genuíno, não genérico. Apenas a frase, sem aspas.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 100,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json();
    return data.content[0].text.trim();

  } catch (err) {
    return `Parabéns, ${nome}! Seu esforço reflete nos seus resultados.`;
  }
}

// Análise simples sem IA (fallback)
function gerarAnaliseSimples(notaGeral, comentario = '') {
  let sentimento = 'neutro';
  if (notaGeral >= 4) sentimento = 'positivo';
  if (notaGeral <= 2) sentimento = 'negativo';

  // Detectar palavras-chave básicas
  const palavrasNeg = ['péssimo', 'horrível', 'absurdo', 'nunca mais', 'terrível', 'demora', 'lento'];
  const palavrasPos = ['ótimo', 'excelente', 'parabéns', 'incrível', 'maravilhoso', 'rápido', 'eficiente'];

  const texto = comentario.toLowerCase();
  if (palavrasNeg.some(p => texto.includes(p))) sentimento = 'negativo';
  if (palavrasPos.some(p => texto.includes(p))) sentimento = 'positivo';

  const tags = [];
  if (texto.includes('demor') || texto.includes('lent')) tags.push('tempo-espera');
  if (texto.includes('simpatia') || texto.includes('simpático') || texto.includes('educado')) tags.push('simpatia');
  if (texto.includes('resolv')) tags.push('solução-eficaz');
  if (tags.length === 0) tags.push(sentimento === 'positivo' ? 'cordialidade' : 'comunicação');

  return {
    sentimento,
    resumo_ia: comentario.length > 10 ? comentario.substring(0, 80) : `Avaliação ${sentimento}`,
    tags_ia: JSON.stringify(tags),
    score_ia: notaGeral * 2,
    alerta: notaGeral <= 2 || sentimento === 'negativo',
    motivo_alerta: notaGeral <= 2 ? 'Nota baixa detectada' : null
  };
}

module.exports = { analisarComentario, gerarResumoSemanal, gerarFraseMotivacional };
