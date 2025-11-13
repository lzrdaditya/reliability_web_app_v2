import Head from 'next/head'
import { useState, useEffect } from 'react'
import { fetchPlot } from '../lib/api'

export default function Step4() {
  const [plotImage, setPlotImage] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)
  const [showPlot, setShowPlot] = useState(false)

  useEffect(() => {
    // Load final result summary (saved by step3/step3b) for display
    if (typeof window !== 'undefined') {
      try {
        const fr = JSON.parse(localStorage.getItem('final_result') || 'null')
        setResult(fr)
      } catch (e) { setResult(null) }
    }
  }, [])

  // Calculate additional parameters
  function getAdditionalParams(res) {
    if (!res || !res.alpha || !res.beta) return null
    const alpha = parseFloat(res.alpha)
    const beta = parseFloat(res.beta)
    const pattern = res.pattern || ''
    // Median life (50% reliability point)
    const median = alpha * Math.pow(Math.log(2), 1 / beta)
    // B10 life (10% failure point)
    const b10 = alpha * Math.pow(-Math.log(0.9), 1 / beta)
    // Mode (most likely failure time) - only for Age-related failure
    let mode = 0
    if (pattern === 'Age-related failure' && beta > 1) {
      mode = alpha * Math.pow((beta - 1) / beta, 1 / beta)
    }
    return { median, mode, b10 }
  }

  const additionalParams = result ? getAdditionalParams(result) : null

  async function handleShowPlot() {
    setShowPlot(true)
    setLoading(true)
    setError(null)
    setPlotImage(null)
    // Prefer chosen results (alpha/beta) if available
    let chosen = null
    let last_payload = null
    try {
      chosen = JSON.parse(localStorage.getItem('chosen_results') || 'null')
    } catch (e) { chosen = null }
    try {
      last_payload = JSON.parse(localStorage.getItem('last_payload') || 'null')
    } catch (e) { last_payload = null }
    const payload = { plot_type: 'reliability' }
    if (chosen && chosen.alpha && chosen.beta) {
      payload.alpha = chosen.alpha
      payload.beta = chosen.beta
    } else if (last_payload) {
      payload.failures = last_payload.failures || []
      payload.right_censored = last_payload.right_censored || []
      payload.left_censored = last_payload.left_censored || []
      payload.interval_data = last_payload.interval_data || []
      payload.grouped_data = last_payload.grouped_data || []
      if (last_payload.rr_method) payload.rr_method = last_payload.rr_method
      const chosen_method = localStorage.getItem('chosen_method') || 'mle'
      payload.plot_for = chosen_method === 'mle' ? 'mle' : 'rr'
    } else {
      setError('No fit parameters or input data available to create plot.')
      setLoading(false)
      return
    }
    try {
      const res = await fetchPlot(payload)
      const j = await res.json().catch(() => null)
      if (!res.ok) throw new Error((j && j.error) || `HTTP ${res.status}`)
      if (j && j.image) {
        setPlotImage('data:image/png;base64,' + j.image)
      } else {
        throw new Error((j && j.error) || 'No image returned')
      }
    } catch (err) {
      setError(err.message || String(err))
    } finally {
      setLoading(false)
    }
  }

  // Helper for interpretation
  function getInterpretation(pattern) {
    if (!pattern) return ''
    if (pattern === 'Age-related failure') return 'Wear-out phase, failures increase over time.'
    if (pattern === 'Random failure') return 'Random failure phase, failures occur at a constant rate.'
    if (pattern === 'Infant mortality (RCA Required)') return 'Infant mortality phase, early failures dominate. RCA Analysis Required'
    return ''
  }

  return (
    <>
      <Head>
        <title>Step 4: Beta Analysis Results</title>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" />
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
        <style>{`
          .gradient-header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          }
          .param-card {
            transition: transform 0.2s, box-shadow 0.2s;
          }
          .param-card:hover {
            transform: translateY(-4px);
            box-shadow: 0 8px 24px rgba(0,0,0,0.12) !important;
          }
          .stat-badge {
            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
            color: white;
            font-weight: 700;
            padding: 0.5rem 1rem;
            border-radius: 50px;
            display: inline-block;
            box-shadow: 0 4px 12px rgba(245, 87, 108, 0.3);
          }
          .icon-circle {
            width: 50px;
            height: 50px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.5rem;
            margin-bottom: 0.75rem;
          }
          .interpretation-box {
            background: linear-gradient(135deg, #667eea15 0%, #764ba215 100%);
            border-left: 4px solid #667eea;
            padding: 1rem 1.25rem;
            border-radius: 8px;
            margin-top: 1rem;
          }
          .graph-btn {
            background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
            border: none;
            color: white;
            font-weight: 700;
            letter-spacing: 1.2px;
            padding: 0.85rem 2.5rem;
            border-radius: 50px;
            box-shadow: 0 8px 20px rgba(17, 153, 142, 0.3);
            transition: all 0.3s;
          }
          .graph-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 12px 28px rgba(17, 153, 142, 0.4);
            color: white;
          }
          .additional-param-row {
            background: #f8f9fa;
            border-radius: 8px;
            padding: 0.5rem 1rem;
            margin-bottom: 0.5rem;
            border-left: 3px solid #667eea;
          }
        `}</style>
      </Head>
      <div className="container py-5">
        <div className="card mx-auto shadow-lg border-0" style={{ maxWidth: 1000, borderRadius: 20 }}>
          <div className="card-header gradient-header text-white d-flex align-items-center py-3" style={{ borderTopLeftRadius: 20, borderTopRightRadius: 20 }}>
            <i className="fas fa-chart-line me-3" style={{ fontSize: '1.8rem' }}></i>
            <h3 className="mb-0 flex-grow-1" style={{ fontWeight: 700 }}>Step 4: Beta Analysis Results</h3>
          </div>
          <div className="card-body p-4" style={{ background: '#fafbfc' }}>
            {result && (
              <>
                <div className="row g-4 mb-4">
                  {/* Left Column: Main Results */}
                  <div className="col-lg-7">
                    <div className="h-100 bg-white rounded-3 shadow-sm p-4 border border-light">
                      <div className="d-flex align-items-center mb-3">
                        <div className="icon-circle" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
                          <i className="fas fa-flask text-white"></i>
                        </div>
                        <h5 className="ms-3 mb-0 fw-bold">Beta Analysis Interpretation</h5>
                      </div>

                      {/* Mission Time or MTBF */}
                      {result.mission_time && (
                        <div className="mb-3">
                          <div className="d-flex align-items-baseline mb-1">
                            <i className="fas fa-clock text-primary me-2"></i>
                            <span className="fw-semibold text-secondary" style={{ fontSize: '0.95rem' }}>
                              Recommened Maintenance Interval for Reliability {result.reliability !== undefined ? `${(result.reliability * 100).toFixed(0)}%` : ''}:
                            </span>
                          </div>
                          <div className="stat-badge ms-4 mb-2">
                            {result.mission_time.toFixed(2)} hours
                          </div>
                          <div className="ms-4 text-muted" style={{ fontSize: '0.9rem' }}>
                            <i className="fas fa-calendar-alt me-2"></i>
                            {result.mission_time_days?.toFixed(2)} days • {result.mission_time_months?.toFixed(2)} months • {result.mission_time_years?.toFixed(4)} years
                          </div>
                        </div>
                      )}

                      {result.mtbf && (
                        <div className="mb-3">
                          <div className="d-flex align-items-baseline mb-1">
                            <i className="fas fa-tools text-success me-2"></i>
                            <span className="fw-semibold text-secondary" style={{ fontSize: '0.95rem' }}>Maintenance Interval Recommendation:</span>
                          </div>
                          <div className="ms-4 mb-2">
                            <span className="text-dark">Formula:</span> <code>Maintenance Interval = MTBF × Unavailability × 2</code>
                          </div>
                          <div className="ms-4 mb-2">
                            <span className="text-dark">Where Unavailability = </span>
                            <span className="badge bg-info text-dark">0.01 (Safety Device)</span> or <span className="badge bg-warning text-dark">0.02 (Non-Safety Device)</span>
                          </div>
                          <div className="ms-4 mb-2">
                            <span className="text-dark">MTBF:</span> {result.mtbf.toFixed(2)} hours
                          </div>
                          <div className="ms-4 mb-2">
                            <span className="text-dark">Safety Device Calculation:</span> {result.mtbf.toFixed(2)} × 0.01 × 2 = <span className="fw-bold text-success">{(result.mtbf * 0.01 * 2).toFixed(2)} hours</span>
                          </div>
                          <div className="ms-4 mb-2">
                            <span className="text-dark">Non-Safety Device Calculation:</span> {result.mtbf.toFixed(2)} × 0.02 × 2 = <span className="fw-bold text-danger">{(result.mtbf * 0.02 * 2).toFixed(2)} hours</span>
                          </div>
                          <div className="ms-4 text-muted" style={{ fontSize: '0.9rem' }}>
                            <i className="fas fa-info-circle me-2"></i>
                            Use 0.01 for safety devices, 0.02 for non-safety devices.
                          </div>
                        </div>
                      )}

                      {/* Interpretation Box */}
                      <div className="interpretation-box mt-4">
                        <div className="d-flex align-items-start">
                          <i className="fas fa-lightbulb text-warning me-2 mt-1" style={{ fontSize: '1.2rem' }}></i>
                          <div>
                            <strong className="text-dark">Interpretation:</strong>
                            <div className="mt-1">{getInterpretation(result.pattern)}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Distribution Parameters */}
                  <div className="col-lg-5">
                    <div className="h-100 bg-white rounded-3 shadow-sm p-4 border border-2 border-primary">
                      <div className="text-center mb-3">
                        <div className="icon-circle mx-auto" style={{ background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' }}>
                          <i className="fas fa-cog text-white"></i>
                        </div>
                        <h6 className="fw-bold text-primary">Distribution Parameters</h6>
                      </div>
                      
                      <table className="table table-borderless mb-0">
                        <tbody>
                          <tr>
                            <td className="py-2">
                              <i className="fas fa-wave-square text-primary me-2"></i>
                              <span className="fw-semibold">Beta (Shape):</span>
                            </td>
                            <td className="text-end py-2 fw-bold">{result.beta?.toFixed(4) ?? 'N/A'}</td>
                          </tr>
                          <tr>
                            <td className="py-2">
                              <i className="fas fa-ruler text-success me-2"></i>
                              <span className="fw-semibold">Alpha (Scale):</span>
                            </td>
                            <td className="text-end py-2 fw-bold">{result.alpha?.toFixed(4) ?? 'N/A'}</td>
                          </tr>
                          <tr>
                            <td className="py-2">
                              <i className="fas fa-tag text-info me-2"></i>
                              <span className="fw-semibold">Pattern:</span>
                            </td>
                            <td className="text-end py-2">
                              <span className="badge" style={{ 
                                background: result.pattern === 'Age-related failure' ? '#667eea' : 
                                           result.pattern === 'Random failure' ? '#38ef7d' : '#f5576c',
                                fontSize: '0.75rem',
                                padding: '0.4rem 0.8rem'
                              }}>
                                {result.pattern || 'N/A'}
                              </span>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* Additional Parameters Section */}
                {additionalParams && (
                  <div className="bg-white rounded-3 shadow-sm p-4 border border-light mb-4">
                    <h6 className="fw-bold mb-3">
                      <i className="fas fa-plus-circle text-primary me-2"></i>
                      Additional Reliability Metrics
                    </h6>
                    <div className="row g-3">
                      <div className="col-md-4">
                        <div className="additional-param-row">
                          <div className="text-muted small">Median Life (B50)</div>
                          <div className="fw-bold text-dark">{additionalParams.median.toFixed(2)} hrs</div>
                          <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                            {(additionalParams.median / 24).toFixed(2)} days
                          </div>
                        </div>
                      </div>
                      {/* Show Mode only for Age-related failure */}
                      {result.pattern === 'Age-related failure' && additionalParams.mode > 0 && (
                        <div className="col-md-4">
                          <div className="additional-param-row">
                            <div className="text-muted small">Mode (Peak)</div>
                            <div className="fw-bold text-dark">{additionalParams.mode.toFixed(2)} hrs</div>
                            <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                              {(additionalParams.mode / 24).toFixed(2)} days
                            </div>
                          </div>
                        </div>
                      )}
                      <div className="col-md-4">
                        <div className="additional-param-row">
                          <div className="text-muted small">B10 Life</div>
                          <div className="fw-bold text-dark">{additionalParams.b10.toFixed(2)} hrs</div>
                          <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                            {(additionalParams.b10 / 24).toFixed(2)} days
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="mt-2 text-muted small">
                      <i className="fas fa-info-circle me-1"></i>
                      <em>B10: 10% of items fail by this time • Median: 50% failure point{result.pattern === 'Age-related failure' ? ' • Mode: Most likely failure time' : ''}</em>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Show Graph Button */}
            <div className="w-100 text-center mt-4">
              {!showPlot && !loading && (
                <button className="graph-btn" onClick={handleShowPlot}>
                  <i className="fas fa-chart-area me-2"></i>
                  SHOW RELIABILITY GRAPH
                </button>
              )}
            </div>

            {/* Plot Section */}
            {loading && (
              <div className="py-5 text-center">
                <div className="spinner-border text-primary mb-3" role="status" style={{ width: '3rem', height: '3rem' }}>
                  <span className="visually-hidden">Loading...</span>
                </div>
                <div className="fw-semibold text-secondary">Generating reliability plot…</div>
              </div>
            )}

            {error && (
              <div className="alert alert-danger w-100 text-center mt-4 shadow-sm">
                <i className="fas fa-exclamation-triangle me-2"></i>
                {error}
              </div>
            )}

            {showPlot && !loading && plotImage && (
              <div className="w-100 mt-4">
                <div className="bg-white rounded-3 shadow-sm p-3 border border-light">
                  <h6 className="fw-bold mb-3 text-center">
                    <i className="fas fa-chart-line text-success me-2"></i>
                    Reliability Function Plot
                  </h6>
                  <img 
                    src={plotImage} 
                    alt="Reliability vs Time" 
                    className="img-fluid" 
                    style={{ borderRadius: 12, boxShadow: '0 4px 16px rgba(0,0,0,0.08)', width: '100%' }} 
                  />
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="w-100 text-center mt-4 pt-3 border-top">
              <a href="/" className="btn btn-outline-secondary px-4 rounded-pill">
                <i className="fas fa-redo me-2"></i>
                Start Over
              </a>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
