import Head from 'next/head'
import { useState } from 'react'
import { convertTimestamps } from '../lib/api'
import Link from 'next/link'

export default function Preprocess() {
  const [raw, setRaw] = useState('')
  const [error, setError] = useState(null)
  const [processing, setProcessing] = useState(false)

  async function onSubmit(e){
    e.preventDefault()
    setError(null)
    setProcessing(true)
    try{
      const resp = await convertTimestamps(raw)
      if(resp.error) setError(resp.error)
      else {
        // store in localStorage and navigate to step2
        localStorage.setItem('pre_filled_failures', JSON.stringify(resp.pre_filled_failures || []))
        localStorage.setItem('original_datetimes', JSON.stringify(resp.original_datetimes || []))
        window.location.href = '/step2'
      }
    }catch(err){
      setError(err.message)
    }
    setProcessing(false)
  }

  return (
    <>
      <Head>
        <title>Convert Timestamps</title>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" />
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
        <style>{`
          .gradient-header {
            background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
          }
          .process-btn {
            background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
            border: none;
            color: white;
            font-weight: 600;
            padding: 0.75rem 2rem;
            border-radius: 50px;
            box-shadow: 0 6px 18px rgba(17, 153, 142, 0.3);
            transition: all 0.3s;
          }
          .process-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 24px rgba(17, 153, 142, 0.4);
            color: white;
          }
          .process-btn:disabled {
            opacity: 0.6;
          }
        `}</style>
      </Head>
      <div className="container py-5">
        <div className="card mx-auto shadow-lg border-0" style={{maxWidth: 800, borderRadius: 20}}>
          <div className="card-header gradient-header text-white d-flex align-items-center py-3" style={{borderTopLeftRadius: 20, borderTopRightRadius: 20}}>
            <i className="fas fa-clock me-3" style={{fontSize: '1.8rem'}}></i>
            <h3 className="mb-0 flex-grow-1" style={{fontWeight: 700}}>Convert Raw Timestamps</h3>
          </div>
          <div className="card-body p-4" style={{background: '#fafbfc'}}>
            <div className="alert" style={{background: 'linear-gradient(135deg, #667eea15 0%, #764ba215 100%)', borderLeft: '4px solid #11998e', borderRadius: '8px'}}>
              <i className="fas fa-info-circle text-primary me-2"></i>
              <strong>How it works:</strong> Paste timestamps (YYYY-MM-DD HH:MM:SS or ISO 8601). The tool will sort and calculate time between events in hours.
            </div>
            {error && <div className="alert alert-danger shadow-sm"><i className="fas fa-exclamation-triangle me-2"></i>{error}</div>}
            <form onSubmit={onSubmit}>
              <div className="mb-4">
                <label htmlFor="raw_dates" className="form-label fw-semibold"><i className="fas fa-paste me-2 text-success"></i>Paste Timestamps Here</label>
                <textarea 
                  id="raw_dates" 
                  className="form-control shadow-sm" 
                  rows={10} 
                  value={raw} 
                  onChange={(e)=>setRaw(e.target.value)}
                  placeholder="Example:\n2023-08-10T14:30:00Z\n2023-08-15T16:45:00Z\n2023-08-20T09:15:00Z"
                  style={{borderRadius: '12px', fontSize: '0.95rem', fontFamily: 'monospace'}}
                />
              </div>
              <div className="d-flex justify-content-between align-items-center pt-3 border-top">
                <Link href="/" className="text-decoration-none text-secondary"><i className="fas fa-arrow-left me-2"></i>Back to Menu</Link>
                <button className="process-btn" disabled={processing}>
                  {processing ? <><i className="fas fa-spinner fa-spin me-2"></i>Processing...</> : <><i className="fas fa-arrow-right me-2"></i>Process and Continue</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  )
}
