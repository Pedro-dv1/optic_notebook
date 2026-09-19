import { useEffect } from 'react'

const SCRIPT_ID = 'vlibras-widget-script'
const SCRIPT_URL = 'https://vlibras.gov.br/app/vlibras-plugin.js'

export function VLibrasWidget() {
  useEffect(() => {
    if (document.getElementById(SCRIPT_ID) || document.querySelector(`script[src="${SCRIPT_URL}"]`)) return
    const script = document.createElement('script')
    script.id = SCRIPT_ID
    script.src = SCRIPT_URL
    script.async = true
    document.body.appendChild(script)
  }, [])
  return null
}
