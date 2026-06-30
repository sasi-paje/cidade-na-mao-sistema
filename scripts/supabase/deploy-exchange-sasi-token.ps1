<#
.SYNOPSIS
  Configura o secret SASI_API_URL e faz o deploy da Edge Function
  `exchange-sasi-token` em um projeto Supabase (homologação).

.DESCRIPTION
  Passo a passo da ponte SASI -> sessão Supabase (caminho `{ token }`):
    1. link do projeto
    2. set do secret SASI_API_URL
    3. list dos secrets (apenas nomes; sem expor valores)
    4. deploy da function exchange-sasi-token

  NÃO pede, imprime nem testa token SASI. NÃO valida URL com token.
  Para no primeiro erro (qualquer comando que falhar interrompe o script).

  Pré-requisitos:
    - Supabase CLI instalado e no PATH
    - Login feito previamente: `supabase login`
    - Permissão no projeto de homologação

.PARAMETER ProjectRef
  Ref do projeto Supabase (homologação). Ex.: tfupwytzrkpzocfxheeq

.PARAMETER SasiApiUrl
  Base da API SASI usada pelo caminho `{ token }` da function
  (GET {SasiApiUrl}/api/v2/providers/external/me). Default: https://api.sasi.io

.EXAMPLE
  # Homologação:
  .\scripts\supabase\deploy-exchange-sasi-token.ps1 -ProjectRef "tfupwytzrkpzocfxheeq"

.EXAMPLE
  # Com base SASI alternativa:
  .\scripts\supabase\deploy-exchange-sasi-token.ps1 -ProjectRef "tfupwytzrkpzocfxheeq" -SasiApiUrl "https://api.sasi.io"

.NOTES
  Este script NÃO toca o caminho `{ refreshToken }` (gated/501) nem o banco.
  Ver docs/SMOKE-SASI-TOKEN.md para o smoke manual pós-deploy.
#>

[CmdletBinding()]
param(
  [Parameter(Mandatory = $true, HelpMessage = "Ref do projeto Supabase de homologação (ex.: tfupwytzrkpzocfxheeq)")]
  [ValidateNotNullOrEmpty()]
  [string]$ProjectRef,

  [Parameter(Mandatory = $false)]
  [ValidateNotNullOrEmpty()]
  [string]$SasiApiUrl = "https://api.sasi.io"
)

$ErrorActionPreference = "Stop"

function Write-Step  { param([string]$m) Write-Host "`n==> $m" -ForegroundColor Cyan }
function Write-Ok    { param([string]$m) Write-Host "[ok] $m"   -ForegroundColor Green }
function Write-Warn2 { param([string]$m) Write-Host "[!]  $m"   -ForegroundColor Yellow }

# Para todo comando nativo: se exit code != 0, aborta.
function Invoke-OrFail {
  param([Parameter(Mandatory = $true)][scriptblock]$Cmd, [string]$What)
  & $Cmd
  if ($LASTEXITCODE -ne 0) {
    throw "Falhou: $What (exit code $LASTEXITCODE). Abortando."
  }
}

Write-Step "Verificando o Supabase CLI no PATH"
$cli = Get-Command supabase -ErrorAction SilentlyContinue
if ($null -eq $cli) {
  throw "Supabase CLI não encontrado no PATH. Instale (https://supabase.com/docs/guides/cli) e rode 'supabase login' antes de continuar."
}
Write-Ok "supabase encontrado em: $($cli.Source)"
Invoke-OrFail { supabase --version } "supabase --version"

Write-Step "Linkando o projeto (ProjectRef: $ProjectRef)"
Invoke-OrFail { supabase link --project-ref $ProjectRef } "supabase link"
Write-Ok "Projeto linkado."

Write-Step "Configurando o secret SASI_API_URL (valor não é exibido)"
# O valor do secret NÃO é impresso. Passamos como par chave=valor único.
Invoke-OrFail { supabase secrets set "SASI_API_URL=$SasiApiUrl" } "supabase secrets set SASI_API_URL"
Write-Ok "Secret SASI_API_URL configurado."

Write-Step "Listando secrets (apenas nomes/digests; sem valores)"
Invoke-OrFail { supabase secrets list } "supabase secrets list"
Write-Warn2 "Confirme que 'SASI_API_URL' aparece na lista acima (o valor não é exibido pelo CLI)."

Write-Step "Deploy da Edge Function exchange-sasi-token"
Invoke-OrFail { supabase functions deploy exchange-sasi-token } "supabase functions deploy exchange-sasi-token"
Write-Ok "Function exchange-sasi-token redeployada."

Write-Host "`n==============================================================" -ForegroundColor DarkGray
Write-Ok "Concluído. Próximo passo: smoke manual com token SASI real."
Write-Host "Siga docs/SMOKE-SASI-TOKEN.md (NÃO cole token em logs/arquivos/prints)." -ForegroundColor Gray
Write-Host "Este script não testou nenhuma URL com token." -ForegroundColor Gray
