import Head from 'next/head'
import { useState, useEffect } from 'react'
import { postReliability } from '../lib/api'

export default function Step3b(){
  const [reliability, setReliability] = useState('0.8')
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState(null)

  const [chosenResults, setChosenResults] = useState(null)
  const [chosenMethod, setChosenMethod] = useState('mle')

  useEffect(()=>{
    // Only access localStorage on the client
    if(typeof window === 'undefined') return
    try{
      const cr = JSON.parse(localStorage.getItem('chosen_results') || 'null')
      const cm = localStorage.getItem('chosen_method') || 'mle'
      setChosenResults(cr)
      setChosenMethod(cm)
    }catch(e){
      setChosenResults(null)
      setChosenMethod('mle')
    }
  },[])

  async function onSubmit(e){
    e.preventDefault()
    setProcessing(true)
    setError(null)
    try{
      if(!chosenResults){
        setError('No chosen results found. Please return to Step 3 and select a method.')
        setProcessing(false)
        return
      }
      const res = await postReliability(chosenMethod, chosenResults, parseFloat(reliability))
      localStorage.setItem('final_result', JSON.stringify(res.result || {}))
      window.location.href = '/step4'
    }catch(err){
      setError(err.message)
    }
    setProcessing(false)
  }

  return (
    <>
      <Head>
        <title>Step 3b: Reliability Level</title>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" />
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
        <style>{`
          .gradient-header {
            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
          }
          .compute-btn {
            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
            border: none;
            color: white;
            font-weight: 700;
            padding: 0.75rem 2.5rem;
            border-radius: 50px;
            box-shadow: 0 6px 18px rgba(245, 87, 108, 0.3);
            transition: all 0.3s;
          }
          .compute-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 24px rgba(245, 87, 108, 0.4);
            color: white;
          }
          .compute-btn:disabled {
            opacity: 0.6;
          }
          .info-box {
            background: linear-gradient(135deg, #667eea15 0%, #764ba215 100%);
            border-left: 4px solid #f5576c;
            padding: 1rem 1.25rem;
            border-radius: 8px;
          }
        `}</style>
      </Head>
      <div className="container py-5">
        <div className="card mx-auto shadow-lg border-0" style={{maxWidth:750, borderRadius: 20}}>
          <div className="card-header gradient-header text-white d-flex align-items-center py-3" style={{borderTopLeftRadius: 20, borderTopRightRadius: 20}}>
            <i className="fas fa-bullseye me-3" style={{fontSize: '1.8rem'}}></i>
            <h3 className="mb-0 flex-grow-1" style={{fontWeight: 700}}>Step 3b: Set Reliability Level</h3>
          </div>
          <div className="card-body p-4" style={{background: '#fafbfc'}}>
            <div className="info-box mb-4">
              <i className="fas fa-lightbulb text-warning me-2"></i>
              <strong>What is Reliability Level?</strong>
              <p className="mb-0 mt-2 small">The reliability level represents the probability that a component will operate successfully for a given mission time. Common values: 0.9 (90%), 0.8 (80%), or 0.5 (50%).</p>
            </div>
            {error && <div className="alert alert-danger shadow-sm"><i className="fas fa-exclamation-triangle me-2"></i>{error}</div>}
            <form onSubmit={onSubmit}>
              <div className="mb-4">
                <label className="form-label fw-semibold"><i className="fas fa-percentage me-2 text-primary"></i>Reliability Level (0 to 1)</label>
                <input 
                  className="form-control form-control-lg shadow-sm" 
                  type="number"
                  step="0.01"
                  min="0"
                  max="1"
                  value={reliability} 
                  onChange={e=>setReliability(e.target.value)}
                  placeholder="e.g., 0.8 for 80% reliability"
                  style={{borderRadius: '12px'}}
                />
                <small className="text-muted"><i className="fas fa-info-circle me-1"></i>Typical values: 0.9 (high confidence), 0.8 (standard), 0.5 (median)</small>
              </div>
              <div className="d-flex justify-content-between align-items-center pt-3 border-top">
                <a className="text-decoration-none text-secondary" href="/step3"><i className="fas fa-arrow-left me-2"></i>Back</a>
                <button className="compute-btn" disabled={processing}>
                  {processing ? <><i className="fas fa-spinner fa-spin me-2"></i>Computing...</> : <><i className="fas fa-calculator me-2"></i>Compute Mission Time</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  )
}
