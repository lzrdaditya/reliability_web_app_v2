import Head from 'next/head'
import Link from 'next/link'

export default function Home() {
  return (
    <>
      <Head>
        <title>Reliability Tool — Step 1</title>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" />
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
        <style>{`
          .gradient-header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          }
          .method-card {
            transition: all 0.3s;
            cursor: pointer;
            border: 2px solid #e9ecef;
          }
          .method-card:hover {
            transform: translateY(-8px);
            box-shadow: 0 12px 28px rgba(102, 126, 234, 0.3);
            border-color: #667eea;
          }
          .icon-box {
            width: 80px;
            height: 80px;
            border-radius: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 2.5rem;
            margin: 0 auto 1rem;
          }
        `}</style>
      </Head>
      <div className="container py-5">
        <div className="card mx-auto shadow-lg border-0" style={{maxWidth: 800, borderRadius: 20}}>
          <div className="card-header gradient-header text-white d-flex align-items-center py-3" style={{borderTopLeftRadius: 20, borderTopRightRadius: 20}}>
            <i className="fas fa-tools me-3" style={{fontSize: '1.8rem'}}></i>
            <h3 className="mb-0 flex-grow-1" style={{fontWeight: 700}}>Step 1: Choose Input Method</h3>
          </div>
          <div className="card-body p-4" style={{background: '#fafbfc'}}>
            <p className="text-center mb-4 text-secondary" style={{fontSize: '1.05rem'}}>Select how you want to provide failure data for analysis</p>
            <div className="row g-4">
              <div className="col-md-6">
                <Link href="/step2" className="text-decoration-none">
                  <div className="method-card bg-white rounded-3 p-4 h-100 text-center shadow-sm">
                    <div className="icon-box mx-auto" style={{background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'}}>
                      <i className="fas fa-keyboard text-white"></i>
                    </div>
                    <h5 className="fw-bold text-dark mb-2">Manual Entry</h5>
                    <p className="text-muted small mb-0">Enter failure times directly into the table</p>
                  </div>
                </Link>
              </div>
              <div className="col-md-6">
                <Link href="/preprocess" className="text-decoration-none">
                  <div className="method-card bg-white rounded-3 p-4 h-100 text-center shadow-sm">
                    <div className="icon-box mx-auto" style={{background: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)'}}>
                      <i className="fas fa-calendar-alt text-white"></i>
                    </div>
                    <h5 className="fw-bold text-dark mb-2">Convert Timestamps</h5>
                    <p className="text-muted small mb-0">Paste timestamps to auto-calculate failure times</p>
                  </div>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
