import { useState } from 'react'
import LibroBanco from '../components/Banco/LibroBanco'
import './Banco.css'

const mesActualISO = () => new Date().toLocaleDateString('en-CA').slice(0, 7)

export default function Banco() {
  const [cuenta, setCuenta] = useState('bs')
  const [mes, setMes] = useState(mesActualISO())

  return (
    <div>
      <h1 style={{ marginBottom: 16 }}>Banco</h1>

      <div className="nk-banco-controles">
        <div className="nk-inv-genero-tabs">
          <button
            className={`nk-inv-genero-tab ${cuenta === 'bs' ? 'nk-inv-genero-tab-activo' : ''}`}
            onClick={() => setCuenta('bs')}
          >
            Bolívares
          </button>
          <button
            className={`nk-inv-genero-tab ${cuenta === 'usd' ? 'nk-inv-genero-tab-activo' : ''}`}
            onClick={() => setCuenta('usd')}
          >
            USDT / Efectivo
          </button>
        </div>

        <input
          type="month"
          value={mes}
          onChange={(e) => e.target.value && setMes(e.target.value)}
          className="nk-banco-mes"
        />
      </div>

      <LibroBanco key={cuenta} cuenta={cuenta} mes={mes} />
    </div>
  )
}