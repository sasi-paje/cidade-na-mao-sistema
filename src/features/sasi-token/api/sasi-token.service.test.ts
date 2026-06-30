import { describe, it, expect, beforeEach } from 'vitest'
import {
  getSasiTokenFromUrl,
  getSasiTokenParamFromUrl,
  hasSasiToken,
  storeSasiToken,
  getStoredSasiToken,
  getStoredSasiTokenKind,
  clearSasiToken,
  resolveSasiToken,
  resolveSasiTokenWithKind,
} from './sasi-token.service'

beforeEach(() => {
  window.history.pushState({}, '', '/')
  window.sessionStorage.clear()
})

describe('getSasiTokenFromUrl', () => {
  it('retorna null quando o token não está na URL', () => {
    expect(getSasiTokenFromUrl()).toBeNull()
  })

  it('retorna o token do param sasi-token (deep-link mobile)', () => {
    window.history.pushState({}, '', '/m/eventos?sasi-token=abc123xyz')
    expect(getSasiTokenFromUrl()).toBe('abc123xyz')
  })

  it('aceita o param genérico token (caso principal do deep-link)', () => {
    window.history.pushState({}, '', '/m/eventos?token=alt-789')
    expect(getSasiTokenFromUrl()).toBe('alt-789')
  })

  it('aceita os aliases sasiToken / sasi-refresh-token / sasiRefreshToken', () => {
    window.history.pushState({}, '', '/m/eventos?sasiToken=cam')
    expect(getSasiTokenFromUrl()).toBe('cam')
    window.history.pushState({}, '', '/m/eventos?sasi-refresh-token=rt1')
    expect(getSasiTokenFromUrl()).toBe('rt1')
    window.history.pushState({}, '', '/m/eventos?sasiRefreshToken=rt2')
    expect(getSasiTokenFromUrl()).toBe('rt2')
  })

  it('prioriza token sobre os demais aliases', () => {
    window.history.pushState({}, '', '/m/eventos?sasi-token=second&token=first')
    expect(getSasiTokenFromUrl()).toBe('first')
  })

  it('retorna o token quando há outros parâmetros junto', () => {
    window.history.pushState({}, '', '/m/eventos?ref=email&sasi-token=token-456')
    expect(getSasiTokenFromUrl()).toBe('token-456')
  })

  it('retorna null quando só há outros parâmetros', () => {
    window.history.pushState({}, '', '/m/eventos?ref=email&page=2')
    expect(getSasiTokenFromUrl()).toBeNull()
  })

  it('retorna o token exato sem transformações', () => {
    const raw = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test'
    window.history.pushState({}, '', `/m/eventos?sasi-token=${encodeURIComponent(raw)}`)
    expect(getSasiTokenFromUrl()).toBe(raw)
  })

  it('lê de uma search string explícita quando fornecida', () => {
    expect(getSasiTokenFromUrl('?sasi-token=fromArg')).toBe('fromArg')
  })

  it('ignora token vazio', () => {
    expect(getSasiTokenFromUrl('?sasi-token=')).toBeNull()
  })
})

describe('hasSasiToken', () => {
  it('retorna false sem token', () => {
    expect(hasSasiToken()).toBe(false)
  })

  it('retorna true com token presente', () => {
    window.history.pushState({}, '', '/m/eventos?sasi-token=any')
    expect(hasSasiToken()).toBe(true)
  })
})

describe('storage helpers', () => {
  it('persiste e recupera o token', () => {
    storeSasiToken('stored-1')
    expect(getStoredSasiToken()).toBe('stored-1')
  })

  it('limpa o token persistido', () => {
    storeSasiToken('stored-2')
    clearSasiToken()
    expect(getStoredSasiToken()).toBeNull()
  })
})

describe('resolveSasiToken', () => {
  it('usa o token da URL e o persiste', () => {
    window.history.pushState({}, '', '/m/eventos?sasi-token=url-token')
    expect(resolveSasiToken()).toBe('url-token')
    expect(getStoredSasiToken()).toBe('url-token')
  })

  it('faz fallback no token armazenado quando a URL não tem', () => {
    storeSasiToken('saved-token')
    expect(resolveSasiToken()).toBe('saved-token')
  })

  it('retorna null quando não há token em lugar nenhum', () => {
    expect(resolveSasiToken()).toBeNull()
  })
})

describe('classificação access vs refresh', () => {
  it('getSasiTokenParamFromUrl identifica access (token)', () => {
    window.history.pushState({}, '', '/m/eventos?token=acc')
    expect(getSasiTokenParamFromUrl()).toEqual({ param: 'token', value: 'acc', kind: 'access' })
  })

  it('getSasiTokenParamFromUrl identifica refresh (sasi-refresh-token)', () => {
    window.history.pushState({}, '', '/web/eventos?sasi-refresh-token=rt')
    expect(getSasiTokenParamFromUrl()).toEqual({
      param: 'sasi-refresh-token',
      value: 'rt',
      kind: 'refresh',
    })
  })

  it('resolveSasiTokenWithKind persiste valor e tipo (refresh)', () => {
    window.history.pushState({}, '', '/m/eventos?sasiRefreshToken=rt9')
    expect(resolveSasiTokenWithKind()).toEqual({ value: 'rt9', kind: 'refresh' })
    expect(getStoredSasiToken()).toBe('rt9')
    expect(getStoredSasiTokenKind()).toBe('refresh')
  })

  it('storeSasiToken default é access', () => {
    storeSasiToken('x')
    expect(getStoredSasiTokenKind()).toBe('access')
  })
})
