import { useNavigate } from 'react-router-dom'
import { PUBLIC_ROUTES } from './routePaths'

/**
 * Tela neutra de acesso para a área web do SASI / Cidade na Mão.
 *
 * Substitui o login legado (e-mail/senha) no fluxo web: aqui a autenticação é
 * feita pelo token SASI (deep-link `?sasi-token=...`). Sem sessão Supabase
 * válida após a validação, mostramos apenas esta mensagem — sem formulário e
 * sem marca do sistema legado.
 */
export function AccessRequired() {
  const navigate = useNavigate()
  return (
    <div className="flex min-h-dvh w-full items-center justify-center bg-[#f9f9f9] p-6">
      <div className="max-w-[420px] text-center">
        <h1 className="text-[22px] font-bold text-[#0f3255]">Acesso não autorizado</h1>
        <p className="mt-2 text-[15px] leading-[1.5] text-[#5b6675]">
          Acesse pelo aplicativo SASI para continuar.
        </p>
        <button
          type="button"
          onClick={() => navigate(PUBLIC_ROUTES.events)}
          className="mt-6 rounded-[8px] border-[1.5px] border-[#1e558b] px-5 py-2 text-[14px] font-semibold text-[#1e558b]"
        >
          Ver eventos públicos
        </button>
      </div>
    </div>
  )
}
