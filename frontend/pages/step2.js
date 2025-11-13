import Head from 'next/head'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { postStep2 } from '../lib/api'

export default function Step2(){
  // Mode selections (can select multiple)
  const [enableRightCensored, setEnableRightCensored] = useState(false)
  const [enableInterval, setEnableInterval] = useState(false)
  const [enableGrouped, setEnableGrouped] = useState(false)
  
  const [rows, setRows] = useState(Array.from({length:25}, (_,i)=>({
    time:'', 
    state:'', 
    lastInspected:'',
    numberInState:'',
    subset:''
  })))

  const [error, setError] = useState(null)
  const [processing, setProcessing] = useState(false)

  useEffect(()=>{
    // Load prefilled from localStorage if available
    const pre = localStorage.getItem('pre_filled_failures')
    if(pre){
      const arr = JSON.parse(pre)
      const newRows = arr.map(x=>({
        time:String(x), 
        state:'', 
        lastInspected:'',
        numberInState:'',
        subset:''
      }))
      while(newRows.length < 25) newRows.push({time:'', state:'', lastInspected:'', numberInState:'', subset:''})
      setRows(newRows)
    }
  }, [])

  function updateRow(idx, field, val){
    const copy = rows.slice()
    copy[idx] = {...copy[idx], [field]: val}
    setRows(copy)
  }

  async function onSubmit(e){
    e.preventDefault()
    setError(null)
    setProcessing(true)

    // Prepare data structures for backend
    const failures = []
    const right_censored = []
    const interval_data = [] // [{start, end}]
    const left_censored = []
    const grouped_data = [] // [{time, freq}]

    rows.forEach(r=>{
      const t = r.time ? parseFloat(r.time) : null
      
      // Grouped mode with right censored (frequency with state)
      if(enableGrouped && enableRightCensored && t && r.numberInState && r.state){
        const freq = parseInt(r.numberInState)
        if(freq > 0){
          grouped_data.push({time: t, freq, state: r.state})
        }
      }
      // Grouped mode only (frequency without state)
      else if(enableGrouped && !enableRightCensored && t && r.numberInState){
        const freq = parseInt(r.numberInState)
        if(freq > 0){
          grouped_data.push({time: t, freq})
        }
      }
      // Right censored mode without grouped (individual observations with state)
      else if(enableRightCensored && !enableGrouped && t && r.state){
        if(r.state === 'F') failures.push(t)
        else if(r.state === 'S') right_censored.push(t)
      }
      // Interval mode (Last Inspected column)
      else if(enableInterval && t){
        if(r.lastInspected){
          const last = parseFloat(r.lastInspected)
          interval_data.push({start: last, end: t})
        } else {
          // No last inspected = left censored
          left_censored.push(t)
        }
      }
      // If no modes enabled, treat as simple failure times
      else if(!enableRightCensored && !enableInterval && !enableGrouped && t){
        failures.push(t)
      }
    })

    try{
      const payload = {
        failures,
        right_censored,
        interval_data,
        left_censored,
        grouped_data,
        modes: {
          rightCensored: enableRightCensored,
          interval: enableInterval,
          grouped: enableGrouped
        }
      }

      // Save payload so Step 3 can re-run rank regression with a different variant
      try{ localStorage.setItem('last_payload', JSON.stringify(payload)) }catch(e){}

      const res = await postStep2(payload)
      localStorage.setItem('results_mle', JSON.stringify(res.results_mle || {}))
      localStorage.setItem('results_rr', JSON.stringify(res.results_rr || {}))
      window.location.href = '/step3'
    }catch(err){
      setError(err.message)
    }
    setProcessing(false)
  }

  const noModesEnabled = !enableRightCensored && !enableInterval && !enableGrouped

  return (
    <>
      <Head>
        <title>Step 2: Enter Data</title>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" />
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
        <style>{`
          .gradient-header {
            background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
          }
          .mode-selection {
            background: linear-gradient(135deg, #667eea10 0%, #764ba210 100%);
            border-left: 4px solid #11998e;
            border-radius: 12px;
          }
          .submit-btn {
            background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
            border: none;
            color: white;
            font-weight: 700;
            padding: 0.7rem 2rem;
            border-radius: 50px;
            box-shadow: 0 6px 18px rgba(17, 153, 142, 0.3);
            transition: all 0.3s;
          }
          .submit-btn:hover:not(:disabled) {
            transform: translateY(-2px);
            box-shadow: 0 10px 24px rgba(17, 153, 142, 0.4);
            color: white;
          }
          .submit-btn:disabled {
            opacity: 0.6;
          }
        `}</style>
      </Head>
      <div className="container py-5">
        <div className="card mx-auto shadow-lg border-0" style={{maxWidth:1200, borderRadius: 20}}>
          <div className="card-header gradient-header text-white d-flex align-items-center py-3" style={{borderTopLeftRadius: 20, borderTopRightRadius: 20}}>
            <i className="fas fa-database me-3" style={{fontSize: '1.8rem'}}></i>
            <h3 className="mb-0 flex-grow-1" style={{fontWeight: 700}}>Step 2: Enter Failure Data</h3>
          </div>
          <div className="card-body p-4" style={{background: '#fafbfc'}}>
            {error && <div className="alert alert-danger shadow-sm"><i className="fas fa-exclamation-triangle me-2"></i>{error}</div>}
            
            {/* Mode Selection */}
            <div className="mb-4 p-3 mode-selection">
              <h6 className="mb-3 fw-bold"><i className="fas fa-cog me-2 text-success"></i>Select Data Type(s):</h6>
              <div className="form-check">
                <input 
                  className="form-check-input" 
                  type="checkbox" 
                  id="modeRight" 
                  checked={enableRightCensored}
                  onChange={(e)=>setEnableRightCensored(e.target.checked)}
                />
                <label className="form-check-label" htmlFor="modeRight">
                  <strong>With Right Censored Data (Suspensions)</strong> — Add State column (F/S)
                </label>
              </div>
              {/* Rank Regression variant is selected on Step 3 now */}
              <div className="form-check">
                <input 
                  className="form-check-input" 
                  type="checkbox" 
                  id="modeInterval" 
                  checked={enableInterval}
                  onChange={(e)=>setEnableInterval(e.target.checked)}
                />
                <label className="form-check-label" htmlFor="modeInterval">
                  <strong>With Interval and Left Censored Data</strong> — Add Last Inspected column
                </label>
              </div>
              <div className="form-check">
                <input 
                  className="form-check-input" 
                  type="checkbox" 
                  id="modeGrouped" 
                  checked={enableGrouped}
                  onChange={(e)=>setEnableGrouped(e.target.checked)}
                />
                <label className="form-check-label" htmlFor="modeGrouped">
                  <strong>With Grouped Observations</strong> — Add Number in State column (frequency)
                </label>
              </div>
              {noModesEnabled && (
                <small className="text-muted d-block mt-2">
                  No modes selected — times will be treated as simple failure times.
                </small>
              )}
            </div>

            <form onSubmit={onSubmit}>
              <div className="table-responsive">
                <table className="table table-bordered table-hover align-middle table-sm">
                  <thead className="table-light">
                    <tr>
                      <th style={{width:'50px'}}>No.</th>
                      <th>Time Failed</th>
                      {enableRightCensored && <th style={{width:'100px'}}>State</th>}
                      {enableInterval && <th>Last Inspected</th>}
                      {enableGrouped && <th style={{width:'130px'}}>Number in State</th>}
                      <th style={{width:'100px'}}>Subset ID</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r,i)=> (
                      <tr key={i}>
                        <td className="text-center">{i+1}</td>
                        <td>
                          <input 
                            className="form-control form-control-sm" 
                            type="number"
                            step="any"
                            value={r.time} 
                            onChange={e=>updateRow(i,'time',e.target.value)} 
                          />
                        </td>
                        {enableRightCensored && (
                          <td>
                            <select 
                              className="form-select form-select-sm" 
                              value={r.state} 
                              onChange={e=>updateRow(i,'state',e.target.value)}
                            >
                              <option value=""></option>
                              <option value="F">F</option>
                              <option value="S">S</option>
                            </select>
                          </td>
                        )}
                        {enableInterval && (
                          <td>
                            <input 
                              className="form-control form-control-sm" 
                              type="number"
                              step="any"
                              value={r.lastInspected} 
                              onChange={e=>updateRow(i,'lastInspected',e.target.value)}
                              placeholder="(optional)"
                            />
                          </td>
                        )}
                        {enableGrouped && (
                          <td>
                            <input 
                              className="form-control form-control-sm" 
                              type="number"
                              min="1"
                              value={r.numberInState} 
                              onChange={e=>updateRow(i,'numberInState',e.target.value)}
                            />
                          </td>
                        )}
                        <td>
                          <input 
                            className="form-control form-control-sm" 
                            value={r.subset} 
                            onChange={e=>updateRow(i,'subset',e.target.value)} 
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              <div className="d-flex justify-content-between align-items-center mt-4 pt-3 border-top">
                <Link href="/" className="btn btn-outline-secondary rounded-pill px-4"><i className="fas fa-arrow-left me-2"></i>Back</Link>
                <div>
                  <button
                    type="button"
                    className="btn btn-outline-warning rounded-pill px-4 me-2"
                    onClick={() => {
                      setRows(Array.from({length:25}, (_,i)=>(
                        {time:'', state:'', lastInspected:'', numberInState:'', subset:''}
                      )))
                      setError(null)
                      setEnableRightCensored(false)
                      setEnableInterval(false)
                      setEnableGrouped(false)
                      try {
                        localStorage.removeItem('pre_filled_failures')
                        localStorage.removeItem('last_payload')
                      } catch(e){}
                    }}
                  >
                    <i className="fas fa-redo me-2"></i>Reset
                  </button>
                  <button
                    type="submit"
                    className="submit-btn"
                    disabled={processing}
                  >
                    {processing ? <><i className="fas fa-spinner fa-spin me-2"></i>Processing...</> : <><i className="fas fa-arrow-right me-2"></i>Analyze Data</>}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  )
}
