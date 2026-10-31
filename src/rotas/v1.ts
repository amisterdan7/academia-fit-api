import { Router } from 'express'
import { autenticar } from '../auth/middleware'
import { rotasAlunos } from './alunos'
import { rotasAuth } from './auth'
import { rotasMatriculas } from './matriculas'
import { rotasPlanos } from './planos'
import { rotasPublico } from './publico'
import { rotasUsuarios } from './usuarios'

// Tudo que desktop, mobile e site devem usar daqui para frente.
export const v1: Router = Router()

v1.use('/auth', rotasAuth)
v1.use('/publico', rotasPublico)
v1.use('/planos', rotasPlanos) // GET público; criar/editar/excluir exigem login
v1.use('/alunos', autenticar, rotasAlunos)
v1.use('/matriculas', autenticar, rotasMatriculas)
v1.use('/usuarios', autenticar, rotasUsuarios)
