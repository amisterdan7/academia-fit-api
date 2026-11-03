// Teste de fumaça: roda contra a API no ar e confere o que mais importa
// (login, permissões, regras de matrícula e compatibilidade com a vitrine).
// Tudo que ele cria é apagado no final.
//
// Uso (com a API rodando em outro terminal):
//   SMOKE_LOGIN=seu_admin SMOKE_SENHA=sua_senha npm run smoke
// Contra uma API publicada:  API_URL=https://sua-api.onrender.com ...

const BASE = process.env.API_URL ?? 'http://localhost:3333'
const LOGIN = process.env.SMOKE_LOGIN
const SENHA = process.env.SMOKE_SENHA

if (!LOGIN || !SENHA) {
  console.error('Defina SMOKE_LOGIN e SMOKE_SENHA com um administrador da API.')
  process.exit(1)
}

let falhas = 0
const limpeza = []

async function chamar(metodo, caminho, { token, corpo } = {}) {
  const resposta = await fetch(BASE + caminho, {
    method: metodo,
    headers: {
      ...(corpo ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: corpo ? JSON.stringify(corpo) : undefined
  })
  const texto = await resposta.text()
  let json = null
  try {
    json = texto ? JSON.parse(texto) : null
  } catch {
    // resposta sem JSON (204, por exemplo)
  }
  return { status: resposta.status, json }
}

function conferir(descricao, condicao, detalhe) {
  if (condicao) {
    console.log(`  ok    ${descricao}`)
  } else {
    falhas++
    console.log(`  FALHA ${descricao}`)
    if (detalhe !== undefined) console.log('        recebido:', JSON.stringify(detalhe))
  }
}

// Soma meses como o PostgreSQL faz: 31/01 + 1 mês = 28/02 (não 03/03).
function somarMeses(iso, meses) {
  const [ano, mes, dia] = iso.split('-').map(Number)
  const total = mes - 1 + meses
  const anoFinal = ano + Math.floor(total / 12)
  const mesFinal = total % 12
  const ultimoDia = new Date(Date.UTC(anoFinal, mesFinal + 1, 0)).getUTCDate()
  const dd = String(Math.min(dia, ultimoDia)).padStart(2, '0')
  return `${anoFinal}-${String(mesFinal + 1).padStart(2, '0')}-${dd}`
}

async function principal() {
  const sufixo = Date.now()
  console.log(`Testando ${BASE}\n`)

  console.log('Básico e compatibilidade com a vitrine')
  let r = await chamar('GET', '/saude')
  conferir('GET /saude responde 200', r.status === 200, r.status)

  r = await chamar('GET', '/v1/planos')
  conferir('GET /v1/planos (público) devolve uma lista', r.status === 200 && Array.isArray(r.json), r.status)
  const plano = r.json?.[0]
  if (!plano) {
    console.log('\nCadastre ao menos um plano no banco para continuar.')
    falhas++
    return
  }
  conferir(
    'plano: preço é número e recursos é lista de objetos',
    typeof plano.preco === 'number' && Array.isArray(plano.recursos),
    plano
  )

  r = await chamar('GET', '/planos')
  conferir('GET /planos (legado) mantém o campo "features"', r.status === 200 && Array.isArray(r.json?.[0]?.features), r.json?.[0])

  console.log('\nLogin')
  r = await chamar('GET', '/v1/alunos')
  conferir('sem token, GET /v1/alunos = 401', r.status === 401, r.status)

  r = await chamar('POST', '/v1/auth/login', { corpo: { login: LOGIN, senha: SENHA + 'x' } })
  conferir('senha errada = 401', r.status === 401, r.status)

  r = await chamar('POST', '/v1/auth/login', { corpo: { login: LOGIN, senha: SENHA } })
  const admin = r.json?.token
  conferir('login do administrador devolve token', r.status === 200 && Boolean(admin), r.status)
  if (!admin) return

  r = await chamar('GET', '/v1/auth/eu', { token: admin })
  conferir('GET /v1/auth/eu mostra o perfil admin', r.json?.usuario?.perfil === 'admin', r.json)

  console.log('\nAlunos e matrículas (administrador)')
  r = await chamar('POST', '/v1/alunos', { token: admin, corpo: { nome: 'a', data_nascimento: '2099-01-01' } })
  conferir('dados inválidos = 400 com código VALIDACAO', r.status === 400 && r.json?.error?.code === 'VALIDACAO', r.json)

  r = await chamar('POST', '/v1/alunos', {
    token: admin,
    corpo: { nome: `Smoke Teste ${sufixo}`, data_nascimento: '1990-01-31', telefone: '(84) 99999-0000' }
  })
  const aluno = r.json
  conferir('cria aluno = 201', r.status === 201 && Boolean(aluno?.id), r)
  if (!aluno?.id) return
  limpeza.push(() => chamar('DELETE', `/v1/alunos/${aluno.id}`, { token: admin }))
  conferir('data_nascimento volta como texto AAAA-MM-DD', aluno.data_nascimento === '1990-01-31', aluno.data_nascimento)

  r = await chamar('GET', '/v1/alunos', { token: admin })
  conferir(
    'aluno novo aparece na lista como "sem_matricula"',
    r.json?.find((a) => a.id === aluno.id)?.status_matricula === 'sem_matricula',
    r.json?.find((a) => a.id === aluno.id)
  )

  r = await chamar('POST', '/v1/matriculas', {
    token: admin,
    corpo: { id_aluno: aluno.id, id_plano: plano.id, data_inicio: '2026-01-31' }
  })
  const matricula = r.json
  conferir('cria matrícula = 201', r.status === 201 && Boolean(matricula?.id), r)
  if (!matricula?.id) return
  conferir(
    `fim = início + ${plano.duracao_meses} mês(es), calculado pela API`,
    matricula.data_fim_estimada === somarMeses('2026-01-31', plano.duracao_meses),
    matricula.data_fim_estimada
  )

  r = await chamar('GET', '/v1/matriculas', { token: admin })
  conferir(
    'matrícula aparece na lista com os nomes e status válido',
    Boolean(r.json?.some((m) => m.id === matricula.id && m.aluno_nome === aluno.nome && ['ativa', 'vencida'].includes(m.status))),
    r.json?.find((m) => m.id === matricula.id)
  )

  r = await chamar('PATCH', `/v1/matriculas/${matricula.id}/status`, { token: admin, corpo: { status: 'inativa' } })
  conferir('inativar matrícula = 204', r.status === 204, r.status)

  r = await chamar('GET', '/v1/alunos', { token: admin })
  conferir('aluno passa a aparecer como "inativa"', r.json?.find((a) => a.id === aluno.id)?.status_matricula === 'inativa')

  console.log('\nCadastro de aluno com matrícula na mesma transação')
  const nomeComPlano = `Smoke Com Plano ${sufixo}`
  r = await chamar('POST', '/v1/alunos', {
    token: admin,
    corpo: {
      nome: nomeComPlano,
      data_nascimento: '1993-05-20',
      telefone: '(84) 97777-1111',
      id_plano: plano.id,
      data_inicio: '2026-01-31'
    }
  })
  const alunoComPlano = r.json
  conferir(
    'cria aluno com plano = 201 e retorna matricula com data_fim_estimada',
    r.status === 201 &&
      Boolean(alunoComPlano?.id) &&
      Boolean(alunoComPlano?.matricula?.id) &&
      alunoComPlano?.matricula?.id_aluno === alunoComPlano?.id &&
      alunoComPlano?.matricula?.id_plano === plano.id &&
      alunoComPlano?.matricula?.data_inicio === '2026-01-31' &&
      alunoComPlano?.matricula?.data_fim_estimada === somarMeses('2026-01-31', plano.duracao_meses),
    r
  )
  if (alunoComPlano?.id) {
    limpeza.push(() => chamar('DELETE', `/v1/alunos/${alunoComPlano.id}`, { token: admin }))
  }

  r = await chamar('POST', '/v1/alunos', {
    token: admin,
    corpo: {
      nome: nomeComPlano,
      data_nascimento: '1993-05-20',
      id_plano: plano.id
    }
  })
  conferir(
    'aluno duplicado (mesmo nome + data_nascimento) com plano = 409 CONFLITO',
    r.status === 409 && r.json?.error?.code === 'CONFLITO',
    r
  )

  const nomePlanoInexistente = `Smoke Plano Inexistente ${sufixo}`
  r = await chamar('POST', '/v1/alunos', {
    token: admin,
    corpo: {
      nome: nomePlanoInexistente,
      data_nascimento: '1994-08-10',
      id_plano: 999999999
    }
  })
  conferir('criar aluno com plano inexistente = 404 NAO_ENCONTRADO', r.status === 404 && r.json?.error?.code === 'NAO_ENCONTRADO', r)

  r = await chamar('GET', '/v1/alunos', { token: admin })
  conferir(
    'aluno não foi criado após falha de plano inexistente (rollback da transação)',
    Array.isArray(r.json) && !r.json.some((a) => a.nome === nomePlanoInexistente),
    r.json?.find((a) => a.nome === nomePlanoInexistente)
  )

  console.log('\nConcorrência (corrida de matrículas)')
  const rAlunoCorrida = await chamar('POST', '/v1/alunos', {
    token: admin,
    corpo: { nome: `Smoke Corrida ${sufixo}`, data_nascimento: '1992-04-12', telefone: '(84) 98765-4321' }
  })
  const alunoCorrida = rAlunoCorrida.json
  if (alunoCorrida?.id) {
    limpeza.push(() => chamar('DELETE', `/v1/alunos/${alunoCorrida.id}`, { token: admin }))

    const [resCorrida1, resCorrida2] = await Promise.all([
      chamar('POST', '/v1/matriculas', {
        token: admin,
        corpo: { id_aluno: alunoCorrida.id, id_plano: plano.id, data_inicio: '2026-01-01' }
      }),
      chamar('POST', '/v1/matriculas', {
        token: admin,
        corpo: { id_aluno: alunoCorrida.id, id_plano: plano.id, data_inicio: '2026-01-01' }
      })
    ])

    const codigos = [resCorrida1.status, resCorrida2.status].sort()
    conferir(
      'dois POST /v1/matriculas simultâneos para o mesmo aluno resultam em exatamente um 201 e um 409',
      codigos[0] === 201 && codigos[1] === 409,
      { status1: resCorrida1.status, status2: resCorrida2.status }
    )

    const idCriado = resCorrida1.status === 201 ? resCorrida1.json?.id : resCorrida2.json?.id
    if (idCriado) {
      limpeza.push(() => chamar('DELETE', `/v1/matriculas/${idCriado}`, { token: admin }))
    }
  }

  console.log('\nPerfil de recepção')
  const loginRecepcao = 'smoke.recepcao'
  const senhaRecepcao = 'SmokeTeste123'
  r = await chamar('POST', '/v1/usuarios', {
    token: admin,
    corpo: { nome: 'Smoke Recepcao', login: loginRecepcao, senha: senhaRecepcao, perfil: 'recepcao' }
  })
  let idRecepcao = r.json?.id
  if (r.status === 409) {
    // sobrou de uma execução anterior: reativa e redefine a senha
    const lista = await chamar('GET', '/v1/usuarios', { token: admin })
    idRecepcao = lista.json?.find((u) => u.login === loginRecepcao)?.id
    await chamar('PATCH', `/v1/usuarios/${idRecepcao}/ativo`, { token: admin, corpo: { ativo: true } })
    await chamar('PUT', `/v1/usuarios/${idRecepcao}/senha`, { token: admin, corpo: { senha: senhaRecepcao } })
  }
  conferir('usuário de recepção disponível', Boolean(idRecepcao), r)
  if (idRecepcao) {
    limpeza.push(() => chamar('PATCH', `/v1/usuarios/${idRecepcao}/ativo`, { token: admin, corpo: { ativo: false } }))
  }

  r = await chamar('POST', '/v1/auth/login', { corpo: { login: loginRecepcao, senha: senhaRecepcao } })
  const recepcao = r.json?.token
  conferir('recepção consegue entrar', Boolean(recepcao), r.status)
  if (recepcao) {
    r = await chamar('GET', '/v1/alunos', { token: recepcao })
    conferir('recepção pode listar alunos (200)', r.status === 200, r.status)

    r = await chamar('POST', '/v1/alunos', {
      token: recepcao,
      corpo: {
        nome: `Smoke Recepcao Plano ${sufixo}`,
        data_nascimento: '1996-11-05',
        telefone: '(84) 96666-2222',
        id_plano: plano.id
      }
    })
    const alunoRecepcao = r.json
    conferir(
      'recepção pode criar aluno com plano na mesma transação (201)',
      r.status === 201 && Boolean(alunoRecepcao?.id) && Boolean(alunoRecepcao?.matricula?.id),
      r
    )
    if (alunoRecepcao?.id) {
      limpeza.push(() => chamar('DELETE', `/v1/alunos/${alunoRecepcao.id}`, { token: admin }))
    }

    r = await chamar('DELETE', `/v1/alunos/${aluno.id}`, { token: recepcao })
    conferir('recepção NÃO pode excluir aluno (403)', r.status === 403, r.status)

    r = await chamar('PATCH', `/v1/matriculas/${matricula.id}/status`, { token: recepcao, corpo: { status: 'ativa' } })
    conferir('recepção NÃO pode reativar matrícula (403)', r.status === 403, r.status)

    r = await chamar('GET', '/v1/usuarios', { token: recepcao })
    conferir('recepção NÃO vê a lista de usuários (403)', r.status === 403, r.status)

    r = await chamar('PATCH', `/v1/usuarios/${idRecepcao}/ativo`, { token: admin, corpo: { ativo: false } })
    conferir('administrador desativa a recepção (200)', r.status === 200, r.status)

    r = await chamar('GET', '/v1/alunos', { token: recepcao })
    conferir('token de usuário desativado deixa de valer (401)', r.status === 401, r.status)
  }

  console.log('\nRota antiga da vitrine (POST /matriculas)')
  const corpoLegado = {
    nome: `Smoke Legado ${sufixo}`,
    data_nascimento: '1995-06-15',
    telefone: '84988887777',
    nome_plano: plano.nome
  }
  r = await chamar('POST', '/matriculas', { corpo: corpoLegado })
  conferir('cadastro pelo site = 201 com { sucesso, alunoId }', r.status === 201 && r.json?.sucesso === true && Boolean(r.json?.alunoId), r)
  const idLegado = r.json?.alunoId
  if (idLegado) limpeza.push(() => chamar('DELETE', `/v1/alunos/${idLegado}`, { token: admin }))

  r = await chamar('POST', '/matriculas', { corpo: corpoLegado })
  conferir('repetir o mesmo cadastro = 409 (já tem matrícula ativa)', r.status === 409 && r.json?.sucesso === false, r)

  r = await chamar('POST', '/matriculas', { corpo: { ...corpoLegado, nome_plano: 'Plano que não existe' } })
  conferir('plano inexistente = 404 com a mensagem certa', r.status === 404 && /não existe/.test(r.json?.erro ?? ''), r)
}

try {
  await principal()
} finally {
  console.log('\nLimpando o que foi criado...')
  for (const desfazer of limpeza.reverse()) {
    try {
      await desfazer()
    } catch {
      // segue limpando o resto
    }
  }
}

console.log(falhas === 0 ? '\nTUDO CERTO' : `\n${falhas} verificação(ões) com FALHA`)
process.exit(falhas === 0 ? 0 : 1)
