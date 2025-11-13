import Head from 'next/head'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { postReliability } from '../lib/api'

export default function Step3(){
  const [mle, setMle] = useState(null)
  const [rr, setRr] = useState(null)
  const [recommendation, setRecommendation] = useState('')
  const [recommendedMethod, setRecommendedMethod] = useState(null)
  const [loading, setLoading] = useState(false)
  const [rrMethod, setRrMethod] = useState('LS')
  

  useEffect(()=>{
    const r_mle = JSON.parse(localStorage.getItem('results_mle')||'null')
    const r_rr = JSON.parse(localStorage.getItem('results_rr')||'null')
    const last_payload = JSON.parse(localStorage.getItem('last_payload')||'null')
    
    // Check for errors in results
    if(r_mle && r_mle.error){
      alert('MLE Error: ' + r_mle.error)
    }
    if(r_rr && r_rr.error){
      alert('Rank Regression Error: ' + r_rr.error)
    }
    
    setMle(r_mle)
    setRr(r_rr)
    // initialize rrMethod from saved requested_method or rr.method
    if(r_rr && r_rr.requested_method) setRrMethod(r_rr.requested_method)
    else if(r_rr && r_rr.method && r_rr.method.includes('RRX')) setRrMethod('RRX')
    else if(r_rr && r_rr.method && r_rr.method.includes('RRY')) setRrMethod('RRY')
    else if(last_payload && last_payload.rr_method) setRrMethod(last_payload.rr_method)
    
    // Calculate recommendation based on metrics
    if(r_mle && r_rr){
      let mle_score = 0
      let rr_score = 0
      let metrics_counted = 0

      // loglik (higher is better)
      if(r_mle.loglik && r_rr.loglik){
        metrics_counted++
        if(r_mle.loglik > r_rr.loglik) mle_score++
        else if(r_rr.loglik > r_mle.loglik) rr_score++
      }

      // AD (lower is better)
      if(r_mle.AD && r_rr.AD){
        metrics_counted++
        if(r_mle.AD < r_rr.AD) mle_score++
        else if(r_rr.AD < r_mle.AD) rr_score++
      }

      // AICc (lower is better) - only if available
      if(r_mle.AICc && r_mle.AICc !== 'N/A' && r_rr.AICc){
        metrics_counted++
        if(r_mle.AICc < r_rr.AICc) mle_score++
        else if(r_rr.AICc < r_mle.AICc) rr_score++
      }

      if(mle_score > rr_score){
        setRecommendation(`MLE is recommended, scoring better on ${mle_score} out of ${metrics_counted} metrics.`)
        setRecommendedMethod('mle')
      }else if(rr_score > mle_score){
        setRecommendation(`Rank Regression is recommended, scoring better on ${rr_score} out of ${metrics_counted} metrics.`)
        setRecommendedMethod('rr')
      }else{
        setRecommendation('Both methods provide a very similar statistical fit.')
        setRecommendedMethod('mle')
      }
    }
  },[])

  const getMetricBadge = (mleVal, rrVal, lowerIsBetter=false) => {
    if(!mleVal || !rrVal) return null
    const mleWins = lowerIsBetter ? (mleVal < rrVal) : (mleVal > rrVal)
    return {
      mleBetter: mleWins,
      rrBetter: !mleWins && mleVal !== rrVal
    }
  }

  function choose(method){
    setLoading(true)
    localStorage.setItem('chosen_method', method)
    const chosenResults = method === 'mle' ? mle : rr
    if(method==='mle' && chosenResults && chosenResults.pattern==='Age-related failure'){
      localStorage.setItem('chosen_results', JSON.stringify(chosenResults))
      window.location.href = '/step3b'
    }else{
      postReliability(method, chosenResults, null).then(res=>{
        localStorage.setItem('final_result', JSON.stringify(res.result || {}))
        localStorage.setItem('chosen_results', JSON.stringify(chosenResults))
        window.location.href = '/step4'
      }).catch(err=>{
        alert('Error computing final results: ' + err.message)
        setLoading(false)
      })
    }
  }

  async function recomputeRR(){
    const payload = JSON.parse(localStorage.getItem('last_payload')||'null')
    if(!payload){
      alert('No saved data payload found. Please re-enter data on Step 2.')
      return
    }
    // attach selected rr method
    payload.rr_method = rrMethod
    setLoading(true)
    try{
      const res = await (await fetch((process.env.NEXT_PUBLIC_BACKEND_URL||process.env.NEXT_PUBLIC_API_URL||'http://localhost:5000') + '/api/step2',{ method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload)})).json()
      if(res.error) throw new Error(res.error)
      localStorage.setItem('results_mle', JSON.stringify(res.results_mle || {}))
      localStorage.setItem('results_rr', JSON.stringify(res.results_rr || {}))
      setMle(res.results_mle || {})
      setRr(res.results_rr || {})
      // recompute recommendation quickly
      // (reuse effect logic by recalculating here)
      let mle_score = 0, rr_score = 0, metrics_counted = 0
      if(res.results_mle && res.results_rr){
        const rm = res.results_mle, rrn = res.results_rr
        if(rm.loglik && rrn.loglik){ metrics_counted++; if(rm.loglik > rrn.loglik) mle_score++; else if(rrn.loglik > rm.loglik) rr_score++ }
        if(rm.AD && rrn.AD){ metrics_counted++; if(rm.AD < rrn.AD) mle_score++; else if(rrn.AD < rm.AD) rr_score++ }
        if(rm.AICc && rm.AICc !== 'N/A' && rrn.AICc){ metrics_counted++; if(rm.AICc < rrn.AICc) mle_score++; else if(rrn.AICc < rm.AICc) rr_score++ }
        if(mle_score > rr_score){ setRecommendation(`MLE is recommended, scoring better on ${mle_score} out of ${metrics_counted} metrics.`); setRecommendedMethod('mle') }
        else if(rr_score > mle_score){ setRecommendation(`Rank Regression is recommended, scoring better on ${rr_score} out of ${metrics_counted} metrics.`); setRecommendedMethod('rr') }
        else { setRecommendation('Both methods provide a very similar statistical fit.'); setRecommendedMethod('mle') }
      }
    }catch(err){
      alert('Error recomputing Rank Regression: ' + (err.message || err))
    }
    setLoading(false)
  }

  if(!mle || !rr){
    return (
      <div className="container py-5">
        <div className="card mx-auto shadow-lg border-0" style={{maxWidth:700, borderRadius: 20}}>
          <div className="card-header text-white d-flex align-items-center py-3" style={{background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', borderTopLeftRadius: 20, borderTopRightRadius: 20}}>
            <i className="fas fa-info-circle me-3" style={{fontSize: '1.8rem'}}></i>
            <h4 className="mb-0">Loading Results...</h4>
          </div>
          <div className="card-body p-4">
            <div className="text-center py-4">
              <div className="spinner-border text-primary mb-3" style={{width: '3rem', height: '3rem'}} role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
              <p className="text-muted">Please wait while we load your analysis results...</p>
            </div>
            <div className="text-center pt-3 border-top">
              <Link href="/step2" className="btn btn-outline-secondary rounded-pill px-4"><i className="fas fa-arrow-left me-2"></i>Back to Data Entry</Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Check if results have errors
  if(mle.error || rr.error){
    return (
      <div className="container py-5">
        <div className="card mx-auto shadow-lg border-0" style={{maxWidth:700, borderRadius: 20}}>
          <div className="card-header text-white d-flex align-items-center py-3" style={{background: 'linear-gradient(135deg, #f5576c 0%, #d63031 100%)', borderTopLeftRadius: 20, borderTopRightRadius: 20}}>
            <i className="fas fa-exclamation-triangle me-3" style={{fontSize: '1.8rem'}}></i>
            <h4 className="mb-0">Error Computing Results</h4>
          </div>
          <div className="card-body p-4">
            {mle.error && <div className="alert alert-danger shadow-sm"><i className="fas fa-times-circle me-2"></i><strong>MLE Error:</strong> {mle.error}</div>}
            {rr.error && <div className="alert alert-danger shadow-sm"><i className="fas fa-times-circle me-2"></i><strong>Rank Regression Error:</strong> {rr.error}</div>}
            <div className="text-center pt-3 border-top">
              <Link href="/step2" className="btn btn-outline-secondary rounded-pill px-4"><i className="fas fa-arrow-left me-2"></i>Back to Data Entry</Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Check if beta and alpha are missing
  if(!mle.beta || !mle.alpha || !rr.beta || !rr.alpha){
    return (
      <div className="container py-5">
        <div className="card mx-auto shadow-lg border-0" style={{maxWidth:700, borderRadius: 20}}>
          <div className="card-header text-white d-flex align-items-center py-3" style={{background: 'linear-gradient(135deg, #f39c12 0%, #e67e22 100%)', borderTopLeftRadius: 20, borderTopRightRadius: 20}}>
            <i className="fas fa-exclamation-circle me-3" style={{fontSize: '1.8rem'}}></i>
            <h4 className="mb-0">Incomplete Results</h4>
          </div>
          <div className="card-body p-4">
            <div className="alert alert-warning shadow-sm">
              <i className="fas fa-exclamation-triangle me-2"></i>
              Error computing final results: results object with beta and alpha required
            </div>
            <p><strong>The analysis did not produce valid Weibull parameters.</strong> This may happen if:</p>
            <ul className="mb-3">
              <li>Insufficient data points were provided</li>
              <li>Data format was incorrect</li>
              <li>The fit did not converge</li>
            </ul>
            <div className="text-center pt-3 border-top">
              <Link href="/step2" className="btn btn-outline-secondary rounded-pill px-4"><i className="fas fa-arrow-left me-2"></i>Back to Data Entry</Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <Head>
        <title>Step 3: Choose Method</title>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" />
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
        <style>{`
          .gradient-header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          }
          .recommendation-banner {
            background: linear-gradient(135deg, #667eea15 0%, #764ba215 100%);
            border-left: 4px solid #667eea;
            border-radius: 12px;
            padding: 1.25rem;
          }
          .choose-btn {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border: none;
            color: white;
            font-weight: 700;
            padding: 0.75rem 2rem;
            border-radius: 50px;
            box-shadow: 0 6px 18px rgba(102, 126, 234, 0.3);
            transition: all 0.3s;
          }
          .choose-btn:hover:not(:disabled) {
            transform: translateY(-2px);
            box-shadow: 0 10px 24px rgba(102, 126, 234, 0.4);
            color: white;
          }
          .choose-btn:disabled {
            opacity: 0.6;
          }
          .choose-btn-outline {
            border: 2px solid #667eea;
            background: white;
            color: #667eea;
            font-weight: 700;
            padding: 0.75rem 2rem;
            border-radius: 50px;
            transition: all 0.3s;
          }
          .choose-btn-outline:hover:not(:disabled) {
            background: #667eea;
            color: white;
            transform: translateY(-2px);
            box-shadow: 0 6px 18px rgba(102, 126, 234, 0.3);
          }
        `}</style>
      </Head>
      <div className="container py-5">
        <div className="card mx-auto shadow-lg border-0" style={{maxWidth:1100, borderRadius: 20}}>
          <div className="card-header gradient-header text-white d-flex align-items-center py-3" style={{borderTopLeftRadius: 20, borderTopRightRadius: 20}}>
            <i className="fas fa-balance-scale me-3" style={{fontSize: '1.8rem'}}></i>
            <h3 className="mb-0 flex-grow-1" style={{fontWeight: 700}}>Step 3: Compare Analysis Methods</h3>
          </div>
          <div className="card-body p-4" style={{background: '#fafbfc'}}>
            {/* Recommendation Banner */}
            <div className="recommendation-banner mb-4" role="alert">
              <i className="fas fa-trophy me-2" style={{fontSize: '1.3rem', color: '#667eea'}}></i>
              <strong>Statistical Recommendation:</strong> {recommendation}
            </div>

            {/* Comparison Table */}
            {/* Rank Regression variant selector */}
            <div className="mb-3 p-3 bg-white rounded-3 shadow-sm border border-light">
              <div className="d-flex align-items-center gap-3 flex-wrap">
                <label className="mb-0 fw-semibold"><i className="fas fa-sliders-h me-2 text-primary"></i>Rank Regression Variant:</label>
                <select className="form-select form-select-sm w-auto shadow-sm" style={{borderRadius: '8px'}} value={rrMethod} onChange={e=>setRrMethod(e.target.value)}>
                  <option value="LS">LS (auto choose RRX/RRY)</option>
                  <option value="RRX">RRX (Rank Regression on X)</option>
                  <option value="RRY">RRY (Rank Regression on Y)</option>
                </select>
                <button className="btn btn-sm btn-outline-primary rounded-pill" onClick={recomputeRR} disabled={loading}>
                  {loading ? <><i className="fas fa-spinner fa-spin me-2"></i>Recomputing...</> : <><i className="fas fa-sync-alt me-2"></i>Recompute</>}
                </button>
              </div>
            </div>
            <div className="table-responsive mb-4 bg-white rounded-3 shadow-sm p-3">
              <table className="table table-bordered table-hover">
                <thead className="table-light">
                  <tr>
                    <th style={{width:'25%'}}>Metric</th>
                    <th style={{width:'35%'}} className="text-center">
                      <strong>MLE</strong>
                      {recommendedMethod === 'mle' && <span className="badge bg-success ms-2">✓ Recommended</span>}
                    </th>
                    <th style={{width:'35%'}} className="text-center">
                      <strong>Rank Regression</strong>
                      {recommendedMethod === 'rr' && <span className="badge bg-success ms-2">✓ Recommended</span>}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><strong>Beta (Shape)</strong></td>
                    <td className="text-center">{mle.beta}</td>
                    <td className="text-center">{rr.beta}</td>
                  </tr>
                  <tr>
                    <td><strong>Alpha (Scale)</strong></td>
                    <td className="text-center">{mle.alpha}</td>
                    <td className="text-center">{rr.alpha}</td>
                  </tr>
                  <tr>
                    <td><strong>Pattern</strong></td>
                    <td className="text-center">
                      <span className="badge bg-info">{mle.pattern}</span>
                    </td>
                    <td className="text-center">
                      <span className="badge bg-info">{rr.pattern}</span>
                    </td>
                  </tr>
                  <tr>
                    <td><strong>Fitting Method</strong></td>
                    <td className="text-center"><small className="text-muted">{mle.method || 'MLE'}</small></td>
                    <td className="text-center"><small className="text-muted">{rr.method || 'LS'}</small></td>
                  </tr>
                  <tr className={getMetricBadge(mle.loglik, rr.loglik, false)?.mleBetter ? 'table-success' : getMetricBadge(mle.loglik, rr.loglik, false)?.rrBetter ? 'table-warning' : ''}>
                    <td><strong>Log-Likelihood</strong> <small className="text-muted">(Higher is better)</small></td>
                    <td className="text-center">
                      {mle.loglik}
                      {getMetricBadge(mle.loglik, rr.loglik, false)?.mleBetter && <span className="badge bg-success ms-2">✓</span>}
                    </td>
                    <td className="text-center">
                      {rr.loglik}
                      {getMetricBadge(mle.loglik, rr.loglik, false)?.rrBetter && <span className="badge bg-success ms-2">✓</span>}
                    </td>
                  </tr>
                  <tr className={getMetricBadge(mle.AD, rr.AD, true)?.mleBetter ? 'table-success' : getMetricBadge(mle.AD, rr.AD, true)?.rrBetter ? 'table-warning' : ''}>
                    <td><strong>Anderson-Darling</strong> <small className="text-muted">(Lower is better)</small></td>
                    <td className="text-center">
                      {mle.AD}
                      {getMetricBadge(mle.AD, rr.AD, true)?.mleBetter && <span className="badge bg-success ms-2">✓</span>}
                    </td>
                    <td className="text-center">
                      {rr.AD}
                      {getMetricBadge(mle.AD, rr.AD, true)?.rrBetter && <span className="badge bg-success ms-2">✓</span>}
                    </td>
                  </tr>
                  {mle.AICc && mle.AICc !== 'N/A' && rr.AICc && (
                    <tr className={getMetricBadge(mle.AICc, rr.AICc, true)?.mleBetter ? 'table-success' : getMetricBadge(mle.AICc, rr.AICc, true)?.rrBetter ? 'table-warning' : ''}>
                      <td><strong>AICc</strong> <small className="text-muted">(Lower is better)</small></td>
                      <td className="text-center">
                        {mle.AICc}
                        {getMetricBadge(mle.AICc, rr.AICc, true)?.mleBetter && <span className="badge bg-success ms-2">✓</span>}
                      </td>
                      <td className="text-center">
                        {rr.AICc}
                        {getMetricBadge(mle.AICc, rr.AICc, true)?.rrBetter && <span className="badge bg-success ms-2">✓</span>}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Action Buttons */}
            <div className="d-flex gap-3 justify-content-center mb-3 flex-wrap">
              <button 
                className={recommendedMethod === 'mle' ? 'choose-btn' : 'choose-btn-outline'}
                onClick={()=>choose('mle')}
                disabled={loading}
              >
                {loading ? <><i className="fas fa-spinner fa-spin me-2"></i>Processing...</> : <><i className="fas fa-check-circle me-2"></i>Choose MLE</>}
                {recommendedMethod === 'mle' && <span className="ms-2">(Recommended)</span>}
              </button>
              <button 
                className={recommendedMethod === 'rr' ? 'choose-btn' : 'choose-btn-outline'}
                onClick={()=>choose('rr')}
                disabled={loading}
              >
                {loading ? <><i className="fas fa-spinner fa-spin me-2"></i>Processing...</> : <><i className="fas fa-check-circle me-2"></i>Choose Rank Regression</>}
                {recommendedMethod === 'rr' && <span className="ms-2">(Recommended)</span>}
              </button>
            </div>

            {/* Plotting moved to Step 4 */}

            <div className="text-center pt-3 border-top mt-4">
              <Link href="/step2" className="text-muted text-decoration-none"><i className="fas fa-arrow-left me-2"></i>Back to Data Entry</Link>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
